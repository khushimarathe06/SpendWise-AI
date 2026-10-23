const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "spendwise-test-secret-not-used-outside-tests";

const authRoutes = require("../auth");
const budgetRoutes = require("../budgetRoutes");
const savingsGoalRoutes = require("../savingsGoalRoutes");
const transactionRoutes = require("../transactionRoutes");
const Budget = require("../Budget");
const SavingsGoal = require("../SavingsGoal");
const Transaction = require("../Transaction");
const User = require("../User");
const createRateLimiter = require("../rateLimit");
const authenticateUser = require("../authenticateUser");

const app = express();
app.use(express.json());
app.get(
  "/__test/rate-limit",
  createRateLimiter({ windowMs: 60_000, maxRequests: 2, message: "Slow down." }),
  (req, res) => res.json({ ok: true })
);
app.get("/__test/cookie-session", authenticateUser, (req, res) => {
  res.json({ userId: req.userId });
});
app.use((req, res, next) => {
  if (req.body === undefined || req.body === null) req.body = {};
  next();
});
app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budget", budgetRoutes);
app.use("/api/savings-goals", savingsGoalRoutes);

let server;
let baseUrl;
const originalFindUserById = User.findById;
const userId = "507f1f77bcf86cd799439011";
const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "1m" });

function mockMethod(t, model, method, replacement) {
  const original = model[method];
  model[method] = replacement;
  t.after(() => {
    model[method] = original;
  });
}

before(async () => {
  User.findById = async (id) => ({ _id: id, tokenVersion: 0 });
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  User.findById = originalFindUserById;
});

async function request(method, path, body, authenticated = false) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  return response;
}

test("protected financial routes reject requests without a login", async () => {
  for (const path of [
    "/api/transactions",
    "/api/budget",
    "/api/savings-goals",
  ]) {
    const response = await request("GET", path);
    assert.equal(response.status, 401, `${path} should require authentication`);
  }
});

test("HttpOnly session cookies authenticate protected API requests", async () => {
  const response = await fetch(`${baseUrl}/__test/cookie-session`, {
    headers: {
      Cookie: `spendwise_session=${token}`,
      Authorization: "Bearer stale-legacy-token",
    },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { userId });
});

test("protected routes reject sessions invalidated by a password change", async () => {
  const oldFindById = User.findById;
  User.findById = async (id) => ({ _id: id, tokenVersion: 1 });
  try {
    const response = await request("GET", "/api/transactions", undefined, true);
    assert.equal(response.status, 401);
    assert.match((await response.json()).message, /session has ended/i);
  } finally {
    User.findById = oldFindById;
  }
});

test("rate limits return 429 and a retry delay after the request limit", async () => {
  assert.equal((await request("GET", "/__test/rate-limit")).status, 200);
  assert.equal((await request("GET", "/__test/rate-limit")).status, 200);
  const limited = await request("GET", "/__test/rate-limit");
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers.get("retry-after")) > 0);
  assert.deepEqual(await limited.json(), { message: "Slow down." });
});

test("financial list queries are scoped to the authenticated account", async (t) => {
  const originalTransactionFind = Transaction.find;
  const originalBudgetFindOne = Budget.findOne;
  const originalSavingsGoalFind = SavingsGoal.find;
  const filters = {};

  Transaction.find = (filter) => {
    filters.transactions = filter;
    return {
      sort() {
        return this;
      },
      lean: async () => [],
    };
  };
  Budget.findOne = (filter) => {
    filters.budget = filter;
    return { lean: async () => null };
  };
  SavingsGoal.find = (filter) => {
    filters.savingsGoals = filter;
    return {
      sort() {
        return this;
      },
      lean: async () => [],
    };
  };

  t.after(() => {
    Transaction.find = originalTransactionFind;
    Budget.findOne = originalBudgetFindOne;
    SavingsGoal.find = originalSavingsGoalFind;
  });

  const responses = await Promise.all([
    request("GET", "/api/transactions", undefined, true),
    request("GET", "/api/budget", undefined, true),
    request("GET", "/api/savings-goals", undefined, true),
  ]);

  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200]);
  assert.equal(String(filters.transactions.user), userId);
  assert.equal(String(filters.budget.user), userId);
  assert.equal(String(filters.savingsGoals.user), userId);
});

test("transaction writes create records for the signed-in account and scope edits", async (t) => {
  let createdTransaction;
  const transactionId = "507f191e810c19729de860ea";
  const updateFilters = [];
  const deleteFilters = [];

  mockMethod(t, Transaction, "create", async (document) => {
    createdTransaction = document;
    return {
      toObject: () => ({ _id: transactionId, ...document }),
    };
  });
  mockMethod(t, Transaction, "findOneAndUpdate", async (filter) => {
    updateFilters.push(filter);
    return null;
  });
  mockMethod(t, Transaction, "findOneAndDelete", async (filter) => {
    deleteFilters.push(filter);
    return null;
  });

  const transaction = {
    title: "Test purchase",
    category: "Other",
    amount: 25,
    type: "expense",
    date: "2026-10-21",
  };
  const created = await request(
    "POST",
    "/api/transactions",
    transaction,
    true
  );
  assert.equal(created.status, 201);
  assert.equal(String(createdTransaction.user), userId);

  const updated = await request(
    "PUT",
    `/api/transactions/${transactionId}`,
    transaction,
    true
  );
  assert.equal(updated.status, 404);
  assert.equal(String(updateFilters[0].user), userId);

  const deleted = await request(
    "DELETE",
    `/api/transactions/${transactionId}`,
    undefined,
    true
  );
  assert.equal(deleted.status, 404);
  assert.equal(String(deleteFilters[0].user), userId);
});

test("budget writes are always scoped to the signed-in account", async (t) => {
  const filters = [];
  mockMethod(t, Budget, "findOneAndUpdate", async (filter, update) => {
    filters.push(filter);
    if (update.$set.monthlyBudget !== undefined) {
      return { monthlyBudget: update.$set.monthlyBudget };
    }
    return { categoryLimits: update.$set.categoryLimits };
  });

  const monthly = await request(
    "PUT",
    "/api/budget/monthly",
    { monthlyBudget: 1200 },
    true
  );
  assert.equal(monthly.status, 200);

  const categories = await request(
    "PUT",
    "/api/budget/categories",
    { categoryLimits: { Food: 300 } },
    true
  );
  assert.equal(categories.status, 200);
  assert.equal(filters.length, 2);
  assert.ok(filters.every((filter) => String(filter.user) === userId));
});

test("savings goal writes create for and target only the signed-in account", async (t) => {
  const goalId = "507f191e810c19729de860ea";
  let createdGoal;
  const readFilters = [];
  const updateFilters = [];
  const deleteFilters = [];

  mockMethod(t, SavingsGoal, "create", async (document) => {
    createdGoal = document;
    return {
      _id: { toString: () => goalId },
      ...document,
      createdAt: new Date("2026-10-21T00:00:00.000Z"),
      updatedAt: new Date("2026-10-21T00:00:00.000Z"),
    };
  });
  mockMethod(t, SavingsGoal, "findOne", async (filter) => {
    readFilters.push(filter);
    return null;
  });
  mockMethod(t, SavingsGoal, "findOneAndUpdate", async (filter) => {
    updateFilters.push(filter);
    return null;
  });
  mockMethod(t, SavingsGoal, "findOneAndDelete", async (filter) => {
    deleteFilters.push(filter);
    return null;
  });

  const created = await request(
    "POST",
    "/api/savings-goals",
    { name: "Emergency fund", target: 1000 },
    true
  );
  assert.equal(created.status, 201);
  assert.equal(String(createdGoal.user), userId);

  const updated = await request(
    "PUT",
    `/api/savings-goals/${goalId}`,
    { name: "Emergency fund", target: 1000 },
    true
  );
  assert.equal(updated.status, 404);
  assert.equal(String(readFilters[0].user), userId);

  const savings = await request(
    "PATCH",
    `/api/savings-goals/${goalId}/savings`,
    { amount: 100 },
    true
  );
  assert.equal(savings.status, 404);
  assert.equal(String(updateFilters[0].user), userId);

  const deleted = await request(
    "DELETE",
    `/api/savings-goals/${goalId}`,
    undefined,
    true
  );
  assert.equal(deleted.status, 404);
  assert.equal(String(deleteFilters[0].user), userId);
});

test("signup and login validate input before accessing the database", async () => {
  const signup = await request("POST", "/api/auth/signup", {
    name: "A",
    email: "not-an-email",
    password: "short",
  });
  assert.equal(signup.status, 400);

  const login = await request("POST", "/api/auth/login", {});
  assert.equal(login.status, 400);
});

test("transaction creation rejects an invalid amount", async () => {
  const response = await request(
    "POST",
    "/api/transactions",
    {
      title: "Test",
      category: "Other",
      amount: 0,
      type: "expense",
      date: "2026-10-21",
    },
    true
  );
  assert.equal(response.status, 400);
});

test("transaction creation rejects impossible calendar dates", async () => {
  const response = await request(
    "POST",
    "/api/transactions",
    {
      title: "Test",
      category: "Other",
      amount: 25,
      type: "expense",
      date: "2026-02-30",
    },
    true
  );
  assert.equal(response.status, 400);
});

test("budget routes reject invalid monthly budgets and category limits", async () => {
  const monthly = await request(
    "PUT",
    "/api/budget/monthly",
    { monthlyBudget: 0 },
    true
  );
  assert.equal(monthly.status, 400);

  const categories = await request(
    "PUT",
    "/api/budget/categories",
    { categoryLimits: [] },
    true
  );
  assert.equal(categories.status, 400);
});

test("savings goal routes reject invalid goal names and savings amounts", async () => {
  const goal = await request(
    "POST",
    "/api/savings-goals",
    { name: "   ", target: 500 },
    true
  );
  assert.equal(goal.status, 400);

  const savings = await request(
    "PATCH",
    `/api/savings-goals/${userId}/savings`,
    { amount: 0 },
    true
  );
  assert.equal(savings.status, 400);
});
