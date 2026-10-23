import { lazy, Suspense, useEffect, useState } from "react";
import "./App.css";

import SummaryCard from "./components/SummaryCard";
import TransactionItem from "./components/TransactionItem";
import AddTransaction from "./components/AddTransaction";
import Transactions from "./components/Transactions";
import Budget from "./components/Budget";
import SavingsGoals from "./components/SavingsGoals";
import Auth from "./components/Auth";
import Settings from "./components/Settings";
import { API_BASE } from "./apiConfig";
import "./visual-polish.css";

const Analytics = lazy(() => import("./components/Analytics"));
const AIAdvisor = lazy(() => import("./components/AIAdvisor"));

// Existing account that owns the legacy transaction backup.
const LEGACY_OWNER_EMAIL = "khushimarathe06@gmail.com";

const BACKUP_KEY = "spendwise_transactions";

function getAmount(amount) {
  const value =
    typeof amount === "number"
      ? amount
      : Number(String(amount ?? 0).replace(/[₹,\s]/g, ""));

  return Number.isFinite(value) ? value : 0;
}

function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

// Returns an appropriate greeting based on the current hour
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}


function normalizeTransaction(transaction) {
  const title = String(
    transaction.title ||
      transaction.description ||
      transaction.category ||
      "Transaction"
  ).trim();

  return {
    ...transaction,
    id: transaction.id ?? transaction._id,
    title,
    description: String(
      transaction.description || title
    ).slice(0, 200),
    category: String(transaction.category || "Other"),
    amount: getAmount(transaction.amount),
    type: String(transaction.type || "expense").toLowerCase(),
    icon: transaction.icon || "💳",
    date: String(transaction.date || "Today"),
  };
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        "Can't connect to the SpendWise server. Check that the backend is running, then try again."
      );
    }
    throw error;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      window.dispatchEvent(new Event("spendwise:session-expired"));
    }
    const error = new Error(
      data?.message || `Request failed (${response.status}).`
    );
    error.status = response.status;
    throw error;
  }

  return data;
}

function App() {
  // AUTHENTICATION
  // This is only an authenticated/not-authenticated flag. The actual session
  // token is held by the browser in an HttpOnly cookie.
  const [hasSession, setHasSession] = useState(null);

  const [authUser, setAuthUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("spendwise_user")) || null;
    } catch {
      return null;
    }
  });
  const [authChecking, setAuthChecking] = useState(true);
  const [referenceDate] = useState(() => new Date());

  // PAGE STATE
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [chartRange, setChartRange] = useState("6months");

  // TRANSACTION STATE
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsReady, setTransactionsReady] = useState(false);
  const [transactionsLoadError, setTransactionsLoadError] = useState("");
  const [transactionError, setTransactionError] = useState("");
  const [migrationMessage, setMigrationMessage] = useState("");

  // BUDGET STATE — no default budget or category limits.
  const [monthlyBudget, setMonthlyBudget] = useState(null);
  const [categoryLimits, setCategoryLimits] = useState({});
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [budgetError, setBudgetError] = useState("");

  // SAVINGS GOALS STATE — loaded from the logged-in user's database records.
  const [savingsGoals, setSavingsGoals] = useState([]);
  const [savingsGoalsLoading, setSavingsGoalsLoading] = useState(false);
  const [savingsGoalsError, setSavingsGoalsError] = useState("");

  // AUTHENTICATION HANDLERS
  function handleAuthSuccess(data) {
    localStorage.removeItem("spendwise_token");
    localStorage.setItem("spendwise_user", JSON.stringify(data.user));

    setHasSession(true);
    setAuthUser(data.user);
    setAuthChecking(false);
  }

  function handleLogout() {
    // The server clears the HttpOnly cookie; local state is cleared immediately.
    fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
    localStorage.removeItem("spendwise_token");
    localStorage.removeItem("spendwise_user");

    setHasSession(null);
    setAuthUser(null);
    setAuthChecking(false);

    setTransactions([]);
    setTransactionsReady(false);
    setTransactionsLoadError("");
    setMonthlyBudget(null);
    setCategoryLimits({});
    setSavingsGoals([]);

    setTransactionError("");
    setBudgetError("");
    setSavingsGoalsError("");
    setMigrationMessage("");

    setCurrentPage("dashboard");
    setShowTransactionForm(false);
  }

  useEffect(() => {
    function handleSessionExpired() {
      handleLogout();
    }

    window.addEventListener("spendwise:session-expired", handleSessionExpired);
    return () =>
      window.removeEventListener("spendwise:session-expired", handleSessionExpired);
  }, []);

  function handleProfileUpdated(updatedUser) {
    setAuthUser(updatedUser);
    localStorage.setItem("spendwise_user", JSON.stringify(updatedUser));
  }

  // Recheck stored sessions with the server before loading account data.
  useEffect(() => {
    let cancelled = false;

    async function validateSession() {
      try {
        const legacyToken = localStorage.getItem("spendwise_token");
        const response = await fetch(`${API_BASE}/auth/me`, {
          credentials: "include",
          headers: legacyToken ? { Authorization: `Bearer ${legacyToken}` } : {},
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(data.message || "Please log in to continue.");
          error.status = response.status;
          throw error;
        }

        if (cancelled) return;
        setAuthUser(data.user);
        setHasSession(true);
        localStorage.removeItem("spendwise_token");
        localStorage.setItem("spendwise_user", JSON.stringify(data.user));
      } catch (error) {
        if (cancelled) return;

        if (error.status === 401) {
          localStorage.removeItem("spendwise_token");
          localStorage.removeItem("spendwise_user");
          setHasSession(null);
          setAuthUser(null);
          setTransactions([]);
          setTransactionsReady(false);
          setTransactionsLoadError("");
          setMonthlyBudget(null);
          setCategoryLimits({});
          setSavingsGoals([]);
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }

    validateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  // LOAD CURRENT USER'S TRANSACTIONS.
  // Preserve the existing legacy-backup migration behavior.
  useEffect(() => {
    if (!hasSession || !authUser?.id || authChecking) return undefined;

    let cancelled = false;

    async function loadTransactions() {
      setTransactionsLoading(true);
      setTransactionsReady(false);
      setTransactionsLoadError("");
      setTransactionError("");
      setMigrationMessage("");

      try {
        const serverTransactions = await apiRequest(
          "/transactions"
        );

        if (!Array.isArray(serverTransactions)) {
          throw new Error(
            "The server returned an invalid transaction list."
          );
        }

        if (cancelled) return;

        setTransactions(serverTransactions.map(normalizeTransaction));
        setTransactionsReady(true);

        const loggedInEmail = String(
          authUser.email || ""
        ).toLowerCase();

        const legacyOwnerEmail =
          LEGACY_OWNER_EMAIL.toLowerCase();

        if (
          legacyOwnerEmail.includes("YOUR_EXISTING_ACCOUNT_EMAIL") ||
          loggedInEmail !== legacyOwnerEmail
        ) {
          return;
        }

        const migrationKey =
          `spendwise_migration_v1_${authUser.id}`;

        if (localStorage.getItem(migrationKey) === "complete") {
          return;
        }

        const backupText = localStorage.getItem(BACKUP_KEY);

        if (!backupText) {
          setMigrationMessage(
            "No local transaction backup was found. Your database records were loaded."
          );
          return;
        }

        let backup;

        try {
          backup = JSON.parse(backupText);
        } catch {
          throw new Error(
            "The local backup is not valid JSON. It has not been changed."
          );
        }

        if (!Array.isArray(backup)) {
          throw new Error(
            "The local backup is not a transaction list. It has not been changed."
          );
        }

        if (backup.length === 0) {
          setMigrationMessage("The local backup is empty.");
          return;
        }

        for (const oldTransaction of backup) {
          if (cancelled) return;

          if (
            oldTransaction.id === undefined ||
            oldTransaction.id === null
          ) {
            throw new Error(
              "A backup transaction has no ID. Migration stopped to avoid duplicates."
            );
          }

          const normalized = normalizeTransaction(oldTransaction);

          if (
            !normalized.title ||
            !normalized.category ||
            normalized.amount <= 0 ||
            !["income", "expense"].includes(normalized.type) ||
            !normalized.date
          ) {
            throw new Error(
              `Transaction ${oldTransaction.id} has invalid data. The backup remains unchanged.`
            );
          }

          await apiRequest("/transactions", {
            method: "POST",
            body: JSON.stringify({
              legacyId: String(oldTransaction.id),
              title: normalized.title,
              description: normalized.description,
              category: normalized.category,
              amount: normalized.amount,
              type: normalized.type,
              icon: normalized.icon,
              date: normalized.date,
            }),
          });
        }

        const verifiedTransactions = await apiRequest("/transactions");

        const serverLegacyIds = new Set(
          verifiedTransactions
            .filter(
              (transaction) =>
                transaction.legacyId !== undefined &&
                transaction.legacyId !== null
            )
            .map((transaction) => String(transaction.legacyId))
        );

        const allLegacyIdsPresent = backup.every((transaction) =>
          serverLegacyIds.has(String(transaction.id))
        );

        if (!allLegacyIdsPresent) {
          throw new Error(
            "Transaction migration verification failed. Your backup remains intact."
          );
        }

        localStorage.setItem(migrationKey, "complete");

        if (cancelled) return;

        setTransactions(verifiedTransactions.map(normalizeTransaction));

        setMigrationMessage(
          `Migration verified: ${backup.length} backed-up transactions are present in your account.`
        );
      } catch (error) {
        if (!cancelled) {
          setTransactionError(error.message);
          setTransactionsLoadError(error.message);
        }
      } finally {
        if (!cancelled) {
          setTransactionsLoading(false);
        }
      }
    }

    loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [hasSession, authUser?.id, authUser?.email, authChecking]);

  // LOAD THE LOGGED-IN USER'S BUDGET.
  useEffect(() => {
    if (!hasSession || !authUser?.id || authChecking) return undefined;

    let cancelled = false;

    async function loadBudget() {
      setBudgetLoading(true);
      setBudgetError("");

      try {
        const data = await apiRequest("/budget");

        if (cancelled) return;

        setMonthlyBudget(data.monthlyBudget ?? null);
        setCategoryLimits(data.categoryLimits ?? {});
      } catch (error) {
        if (!cancelled) {
          setBudgetError(error.message);
        }
      } finally {
        if (!cancelled) {
          setBudgetLoading(false);
        }
      }
    }

    loadBudget();

    return () => {
      cancelled = true;
    };
  }, [hasSession, authUser?.id, authChecking]);

  // LOAD THE LOGGED-IN USER'S SAVINGS GOALS FROM MONGODB.
  useEffect(() => {
    if (!hasSession || !authUser?.id || authChecking) return undefined;

    let cancelled = false;

    async function loadSavingsGoals() {
      setSavingsGoalsLoading(true);
      setSavingsGoalsError("");

      try {
        const data = await apiRequest("/savings-goals");

        if (!Array.isArray(data)) {
          throw new Error("The server returned an invalid savings goals list.");
        }

        if (!cancelled) setSavingsGoals(data);
      } catch (error) {
        if (!cancelled) setSavingsGoalsError(error.message);
      } finally {
        if (!cancelled) setSavingsGoalsLoading(false);
      }
    }

    loadSavingsGoals();

    return () => {
      cancelled = true;
    };
  }, [hasSession, authUser?.id, authChecking]);

  // SAVE MONTHLY BUDGET TO MONGODB.
  async function handleSaveMonthlyBudget(amount) {
    if (!hasSession) {
      throw new Error("Please log in before saving your budget.");
    }

    const data = await apiRequest("/budget/monthly", {
      method: "PUT",
      body: JSON.stringify({
        monthlyBudget: amount,
      }),
    });

    setMonthlyBudget(data.monthlyBudget);

    return data;
  }

  // SAVE CATEGORY LIMITS TO MONGODB.
  async function handleSaveCategoryLimits(limits) {
    if (!hasSession) {
      throw new Error("Please log in before saving category limits.");
    }

    const data = await apiRequest("/budget/categories", {
      method: "PUT",
      body: JSON.stringify({
        categoryLimits: limits,
      }),
    });

    setCategoryLimits(data.categoryLimits ?? {});

    return data;
  }

  // DATE HELPER
  function getTransactionDate(value) {
    if (!value || typeof value !== "string") return null;

    const cleaned = value.trim();
    const today = new Date(referenceDate);

    today.setHours(0, 0, 0, 0);

    const relativeDate = cleaned.match(/^(today|yesterday|just now)(?:\s+.*)?$/i);
    if (relativeDate) {
      if (relativeDate[1].toLowerCase() === "yesterday") {
        today.setDate(today.getDate() - 1);
      }
      return today;
    }

    const isoDate = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);

    if (isoDate) {
      const parsed = new Date(
        Number(isoDate[1]),
        Number(isoDate[2]) - 1,
        Number(isoDate[3])
      );

      if (
        parsed.getFullYear() !== Number(isoDate[1]) ||
        parsed.getMonth() !== Number(isoDate[2]) - 1 ||
        parsed.getDate() !== Number(isoDate[3])
      ) {
        return null;
      }

      return parsed;
    }

    const parsed = new Date(cleaned);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  function isInCurrentMonth(value) {
    const date = getTransactionDate(value);
    const now = referenceDate;

    return (
      date &&
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  // SPENDING CHART
  const spendingChartData = (() => {
    const now = referenceDate;

    const startMonth =
      chartRange === "year" ? 0 : now.getMonth() - 5;

    const monthCount =
      chartRange === "year" ? now.getMonth() + 1 : 6;

    const months = Array.from(
      { length: monthCount },
      (_, index) => {
        const date = new Date(
          now.getFullYear(),
          startMonth + index,
          1
        );

        return {
          year: date.getFullYear(),
          monthIndex: date.getMonth(),
          month: date.toLocaleDateString("en-IN", {
            month: "short",
          }),
          income: 0,
          expense: 0,
        };
      }
    );

    transactions.forEach((transaction) => {
      const date = getTransactionDate(transaction.date);

      if (!date) return;

      const month = months.find(
        (item) =>
          item.year === date.getFullYear() &&
          item.monthIndex === date.getMonth()
      );

      if (!month) return;

      const amount = getAmount(transaction.amount);

      if (transaction.type === "income") {
        month.income += amount;
      }

      if (transaction.type === "expense") {
        month.expense += amount;
      }
    });

    return months;
  })();

  const chartMaxValue = Math.max(
    5000,
    ...spendingChartData.flatMap((item) => [
      item.income,
      item.expense,
    ])
  );

  const chartAxisMax =
    Math.ceil(chartMaxValue / 5000) * 5000;

  const chartAxisLabels = [4, 3, 2, 1, 0].map((step) =>
    formatCurrency((chartAxisMax / 4) * step)
  );

  // FINANCIAL TOTALS
  const totalIncome = transactions
    .filter((transaction) => transaction.type === "income")
    .reduce(
      (total, transaction) =>
        total + getAmount(transaction.amount),
      0
    );

  const totalExpenses = transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce(
      (total, transaction) =>
        total + getAmount(transaction.amount),
      0
    );

  const totalBalance = totalIncome - totalExpenses;

  const dashboardCurrency = (amount) =>
    transactionsReady ? formatCurrency(amount) : "—";

  const currentMonthExpenses = transactions
    .filter((transaction) => {
      return (
        transaction.type === "expense" &&
        isInCurrentMonth(transaction.date)
      );
    })
    .reduce((total, transaction) => total + getAmount(transaction.amount), 0);

  // Savings-goal totals are separate from transaction-based cash-flow savings.
  const totalGoalSaved = savingsGoals.reduce(
    (total, goal) => total + getAmount(goal.saved),
    0
  );
  const totalGoalTarget = savingsGoals.reduce(
    (total, goal) => total + getAmount(goal.target),
    0
  );
  const overallGoalProgress = totalGoalTarget > 0
    ? Math.min((totalGoalSaved / totalGoalTarget) * 100, 100)
    : 0;

  // Do not calculate against a nonexistent budget.
  const remainingBudget =
    monthlyBudget == null
      ? null
      : monthlyBudget - currentMonthExpenses;

  const budgetPercentage =
    monthlyBudget != null && monthlyBudget > 0
      ? Math.min(
          (currentMonthExpenses / monthlyBudget) * 100,
          100
        )
      : 0;

  // Dashboard category totals.
  const getCategoryTotal = (category) =>
      transactions
      .filter(
        (transaction) =>
          transaction.type === "expense" &&
          isInCurrentMonth(transaction.date) &&
          (
            transaction.category === category ||
            (
              category === "Food & Dining" &&
              String(transaction.category).toLowerCase() === "food"
            )
          )
      )
      .reduce(
        (total, transaction) =>
          total + getAmount(transaction.amount),
        0
      );

  const foodSpent = getCategoryTotal("Food & Dining");
  const shoppingSpent = getCategoryTotal("Shopping");
  const transportationSpent = getCategoryTotal("Transportation");

  // ADD TRANSACTION TO DATABASE.
  async function handleAddTransaction(newTransaction) {
    setTransactionError("");

    try {
      const normalized = normalizeTransaction(newTransaction);

      const saved = await apiRequest("/transactions", {
        method: "POST",
        body: JSON.stringify({
          title: normalized.title,
          description: normalized.description,
          category: normalized.category,
          amount: normalized.amount,
          type: normalized.type,
          icon: normalized.icon,
          date: normalized.date,
        }),
      });

      setTransactions((previous) => [
        normalizeTransaction(saved),
        ...previous,
      ]);
      setTransactionsReady(true);
      setTransactionsLoadError("");

      setShowTransactionForm(false);
    } catch (error) {
      setTransactionError(error.message);
      throw error;
    }
  }

  // DELETE TRANSACTION.
  async function handleDeleteTransaction(id) {
    setTransactionError("");

    try {
      await apiRequest(
        `/transactions/${encodeURIComponent(String(id))}`,
        { method: "DELETE" }
      );

      setTransactions((previous) =>
        previous.filter(
          (transaction) => String(transaction.id) !== String(id)
        )
      );
    } catch (error) {
      setTransactionError(error.message);
      throw error;
    }
  }

  // UPDATE TRANSACTION.
  async function handleUpdateTransaction(id, updatedDetails) {
    setTransactionError("");

    try {
      const existing = transactions.find(
        (transaction) => String(transaction.id) === String(id)
      );

      if (!existing) {
        throw new Error("Transaction not found.");
      }

      const normalized = normalizeTransaction({
        ...existing,
        ...updatedDetails,
      });

      const updated = await apiRequest(
        `/transactions/${encodeURIComponent(String(id))}`,
        {
          method: "PUT",
          body: JSON.stringify({
            title: normalized.title,
            description: normalized.description,
            category: normalized.category,
            amount: normalized.amount,
            type: normalized.type,
            icon: normalized.icon,
            date: normalized.date,
          }),
        }
      );

      setTransactions((previous) =>
        previous.map((transaction) =>
          String(transaction.id) === String(id)
            ? normalizeTransaction(updated)
            : transaction
        )
      );
    } catch (error) {
      setTransactionError(error.message);
      throw error;
    }
  }

  // NAVIGATION
  const renderNavLink = (page, icon, label) => (
    <a
      href={`#${page}`}
      key={page}
      className={currentPage === page ? "active" : ""}
      aria-current={currentPage === page ? "page" : undefined}
      onClick={(event) => {
        event.preventDefault();
        setCurrentPage(page);
      }}
    >
      <span>{icon}</span>
      {label}
    </a>
  );

  if (authChecking) {
    return <p role="status">Checking your login…</p>;
  }

  if (!hasSession || !authUser) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // Dashboard category cards use saved category limits.
  const dashboardCategories = [
    {
      name: "Food & Dining",
      label: "🍔 Food",
      spent: foodSpent,
    },
    {
      name: "Shopping",
      label: "🛍 Shopping",
      spent: shoppingSpent,
    },
    {
      name: "Transportation",
      label: "🚕 Transportation",
      spent: transportationSpent,
    },
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-icon">S</div>
          <span>SpendWise</span>
        </div>

        <nav className="sidebar-nav">
          {renderNavLink("dashboard", "⌂", "Dashboard")}
          {renderNavLink("transactions", "↕", "Transactions")}
          {renderNavLink("budget", "◫", "Budget")}
          {renderNavLink("savings", "◎", "Savings Goals")}
          {renderNavLink("analytics", "◔", "Analytics")}
          {renderNavLink("ai-advisor", "✦", "AI Advisor")}
          {renderNavLink("settings", "⚙", "Settings")}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">
              {(authUser.name || "U").charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{authUser.name || "User"}</strong>
              <small>{authUser.email || "Personal Account"}</small>
            </div>

            <button
              type="button"
              className="logout-btn"
              onClick={handleLogout}
              title="Log out of SpendWise AI"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {transactionError && (
          <div role="alert" className="transaction-error">
            {transactionError}
          </div>
        )}

        {budgetError && (
          <div role="alert" className="transaction-error">
            Budget error: {budgetError}
          </div>
        )}

        {migrationMessage && (
          <p role="status" className="migration-message">
            {migrationMessage}
          </p>
        )}

        {transactionsLoading && (
          <p role="status">Loading your transactions…</p>
        )}

        {currentPage === "settings" ? (
          <Settings
            user={authUser}
            onProfileUpdated={handleProfileUpdated}
            onLogout={handleLogout}
          />
        ) : currentPage === "transactions" ? (
          <Transactions
            transactions={transactions}
            onBack={() => setCurrentPage("dashboard")}
            onDeleteTransaction={handleDeleteTransaction}
            onUpdateTransaction={handleUpdateTransaction}
          />
        ) : currentPage === "budget" ? (
          <Budget
            transactions={transactions}
            monthlyBudget={monthlyBudget}
            categoryLimits={categoryLimits}
            onSaveMonthlyBudget={handleSaveMonthlyBudget}
            onSaveCategoryLimits={handleSaveCategoryLimits}
            budgetLoading={budgetLoading}
          />
        ) : currentPage === "savings" ? (
          <SavingsGoals
            goals={savingsGoals}
            goalsLoading={savingsGoalsLoading}
            goalsLoadError={savingsGoalsError}
            onGoalsChange={setSavingsGoals}
          />
        ) : currentPage === "analytics" ? (
          <Suspense fallback={<p role="status">Loading analytics…</p>}>
            <Analytics
              transactions={transactions}
              monthlyBudget={monthlyBudget}
            />
          </Suspense>
        ) : currentPage === "ai-advisor" ? (
          <Suspense fallback={<p role="status">Loading AI Advisor…</p>}>
            <AIAdvisor />
          </Suspense>
        ) : (
          <>
            <header className="topbar">
              <div>
                <h1>{getGreeting()}, {authUser.name || "there"}</h1>
                <p>
                  Here's what's happening with your money today.
                </p>
              </div>

              <div className="top-actions">
                <button
                  className="add-btn"
                  type="button"
                  onClick={() => setShowTransactionForm(true)}
                >
                  + Add Transaction
                </button>
              </div>
            </header>

            <section className="summary-grid">
              <SummaryCard
                title="Total Balance"
                amount={dashboardCurrency(totalBalance)}
                icon="₹"
                type="balance-card"
              />

              <SummaryCard
                title="Income"
                amount={dashboardCurrency(totalIncome)}
                icon="↗"
                type="income-card"
              />

              <SummaryCard
                title="Expenses"
                amount={dashboardCurrency(totalExpenses)}
                icon="↘"
                type="expense-card"
              />

              <SummaryCard
                title="Saved Toward Goals"
                amount={formatCurrency(totalGoalSaved)}
                icon="✦"
                type="savings-card"
              />
            </section>

            <section className="dashboard-grid">
              <div className="panel spending-panel">
                <div className="panel-header">
                  <div>
                    <h2>Spending Overview</h2>
                    <p>
                      {chartRange === "year"
                        ? "Your income and expenses this year"
                        : "Your income and expenses over the last 6 months"}
                    </p>
                  </div>

                  <select
                    value={chartRange}
                    onChange={(event) =>
                      setChartRange(event.target.value)
                    }
                    aria-label="Choose spending chart period"
                  >
                    <option value="6months">Last 6 months</option>
                    <option value="year">This year</option>
                  </select>
                </div>

                <div className="chart">
                  {!transactionsReady ? (
                    <p role="status" className="dashboard-data-message">
                      {transactionsLoading
                        ? "Loading spending history…"
                        : "Spending history is unavailable until transactions load."}
                    </p>
                  ) : <>
                  <div className="chart-values">
                    {chartAxisLabels.map((label, index) => (
                      <span key={`${label}-${index}`}>
                        {label}
                      </span>
                    ))}
                  </div>

                  <div className="chart-area">
                    <div className="grid-line"></div>
                    <div className="grid-line"></div>
                    <div className="grid-line"></div>
                    <div className="grid-line"></div>

                    <div className="bars">
                      {spendingChartData.map((item) => (
                        <div
                          className="bar-group"
                          key={`${item.year}-${item.monthIndex}`}
                        >
                          <div
                            className="bar income-bar"
                            title={`Income: ${formatCurrency(item.income)}`}
                            style={{
                              height: `${
                                (item.income / chartAxisMax) * 100
                              }%`,
                            }}
                          ></div>

                          <div
                            className="bar expense-bar"
                            title={`Expenses: ${formatCurrency(item.expense)}`}
                            style={{
                              height: `${
                                (item.expense / chartAxisMax) * 100
                              }%`,
                            }}
                          ></div>

                          <small>{item.month}</small>
                        </div>
                      ))}
                    </div>
                  </div>

                <div className="chart-legend">
                  <span>
                    <i className="income-dot"></i>
                    Income
                  </span>

                  <span>
                    <i className="expense-dot"></i>
                    Expenses
                  </span>
                </div>
                  </>}
              </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div>
                    <h2>Monthly Budget</h2>
                    <p>
                      {referenceDate.toLocaleDateString("en-IN", {
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                </div>

                <div className="budget-total">
                  <strong>{dashboardCurrency(currentMonthExpenses)}</strong>
                  <span>
                    {!transactionsReady
                      ? transactionsLoading
                        ? "Loading transaction data"
                        : "Transaction data unavailable"
                      : monthlyBudget == null
                      ? "No monthly budget set"
                      : `of ${formatCurrency(monthlyBudget)} budget`}
                  </span>
                </div>

                <div className="progress">
                  <div
                    className="progress-fill"
                    style={{ width: `${budgetPercentage}%` }}
                  ></div>
                </div>

                <p className="remaining">
                  {!transactionsReady
                    ? "Transaction data unavailable"
                    : remainingBudget == null
                    ? "Set a budget to see what remains"
                    : remainingBudget < 0
                    ? `${formatCurrency(Math.abs(remainingBudget))} over budget`
                    : `${formatCurrency(remainingBudget)} remaining`}
                </p>

                {dashboardCategories.map((category) => {
                  const limit = categoryLimits[category.name];
                  const hasLimit =
                    limit !== undefined &&
                    limit !== null &&
                    Number.isFinite(Number(limit)) &&
                    Number(limit) > 0;

                  const percentage = hasLimit
                    ? Math.min(
                        (category.spent / Number(limit)) * 100,
                        100
                      )
                    : 0;

                  return (
                    <div
                      className="budget-category"
                      key={category.name}
                    >
                      <div>
                        <span className="category-name">
                          {category.label}
                        </span>

                        <small>
                          {hasLimit
                          ? `${dashboardCurrency(
                                category.spent
                              )} / ${formatCurrency(limit)}`
                            : `${dashboardCurrency(
                                category.spent
                              )} spent · No limit set`}
                        </small>
                      </div>

                      <div className="mini-progress">
                        <div
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}

                <button
                  className="manage-btn"
                  type="button"
                  onClick={() => setCurrentPage("budget")}
                >
                  Manage Budget →
                </button>
              </div>
            </section>

            <section className="bottom-grid">
              <div className="panel transactions-panel">
                <div className="panel-header">
                  <div>
                    <h2>Recent Transactions</h2>
                    <p>Your latest financial activity</p>
                  </div>

                  <button
                    className="view-btn"
                    type="button"
                    onClick={() => setCurrentPage("transactions")}
                  >
                    View all →
                  </button>
                </div>

                {!transactionsReady ? (
                  <p role="status">
                    {transactionsLoading
                      ? "Loading your transactions…"
                      : transactionsLoadError || "Your transactions could not be loaded."}
                  </p>
                ) : transactions.length === 0 ? (
                  <p>
                    No transactions yet. Add your first transaction.
                  </p>
                ) : (
                  transactions.slice(0, 5).map((transaction) => (
                    <TransactionItem
                      key={transaction.id}
                      icon={transaction.icon}
                      category={transaction.category}
                      description={
                        transaction.description || transaction.title
                      }
                      date={transaction.date}
                      amount={transaction.amount}
                      type={transaction.type}
                    />
                  ))
                )}
              </div>

              <div className="ai-panel">
                <div className="ai-header">
                  <div className="ai-icon">✦</div>

                  <div>
                    <h2>Budget snapshot</h2>
                    <span>Based on this month’s recorded activity</span>
                  </div>
                </div>

                <div className="ai-content">
                  <p>
                    You have recorded{" "}
                    <strong>{dashboardCurrency(currentMonthExpenses)}</strong>{" "}
                    in expenses this month.
                  </p>

                  <div className="ai-tip">
                    <span>💡</span>

                    <p>
                      {!transactionsReady
                        ? "Transaction data is unavailable. Try again after reconnecting to the server."
                        : monthlyBudget == null
                        ? "Set a monthly budget to receive insights about your remaining spending allowance."
                        : remainingBudget < 0
                        ? "Your expenses have exceeded your monthly budget. Review your spending categories."
                        : `You have ${formatCurrency(
                            remainingBudget
                          )} remaining in your monthly budget.`}
                    </p>
                  </div>
                </div>

                <button
                  className="ai-btn"
                  type="button"
                  onClick={() => setCurrentPage("ai-advisor")}
                >
                  Explore AI Advisor →
                </button>

                <button
                  className="ai-btn"
                  type="button"
                  onClick={() => setCurrentPage("analytics")}
                >
                  View Financial Analytics →
                </button>
              </div>
            </section>

            <section className="panel savings-overview-panel">
              <div className="panel-header savings-overview-header">
                <div>
                  <h2>Savings Goals Overview</h2>
                  <p>Track the progress of your personal savings goals.</p>
                </div>
                <button
                  className="view-btn"
                  type="button"
                  onClick={() => setCurrentPage("savings")}
                >
                  View all goals →
                </button>
              </div>

              {savingsGoalsError && (
                <p className="savings-overview-message" role="alert">
                  Couldn't load savings goals: {savingsGoalsError}
                </p>
              )}

              {savingsGoalsLoading ? (
                <p className="savings-overview-message" role="status">
                  Loading your savings goals…
                </p>
              ) : savingsGoals.length === 0 ? (
                <div className="savings-overview-empty">
                  <span className="savings-overview-empty-icon" aria-hidden="true">◎</span>
                  <div>
                    <strong>No savings goals yet</strong>
                    <p>Create a goal to start tracking your progress here.</p>
                  </div>
                  <button
                    className="manage-btn"
                    type="button"
                    onClick={() => setCurrentPage("savings")}
                  >
                    Create a goal →
                  </button>
                </div>
              ) : (
                <>
                  <div className="savings-overview-summary">
                    <div>
                      <span>Total saved toward goals</span>
                      <strong>{formatCurrency(totalGoalSaved)}</strong>
                    </div>
                    <div>
                      <span>Combined target</span>
                      <strong>{formatCurrency(totalGoalTarget)}</strong>
                    </div>
                    <div>
                      <span>Overall progress</span>
                      <strong>{Math.round(overallGoalProgress)}%</strong>
                    </div>
                  </div>

                  <div
                    className="savings-overview-progress"
                    role="progressbar"
                    aria-label="Overall savings goals progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(overallGoalProgress)}
                  >
                    <div style={{ width: `${overallGoalProgress}%` }} />
                  </div>

                  <div className="savings-overview-goals">
                    {savingsGoals.slice(0, 3).map((goal) => {
                      const target = getAmount(goal.target);
                      const saved = getAmount(goal.saved);
                      const progress = target > 0
                        ? Math.min((saved / target) * 100, 100)
                        : 0;

                      return (
                        <div className="savings-overview-goal" key={goal._id || goal.id || goal.name}>
                          <div className="savings-overview-goal-top">
                            <strong>{goal.name}</strong>
                            <span>{Math.round(progress)}%</span>
                          </div>
                          <div
                            className="savings-overview-goal-track"
                            role="progressbar"
                            aria-label={`${goal.name} progress`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress)}
                          >
                            <div style={{ width: `${progress}%` }} />
                          </div>
                          <p>{formatCurrency(saved)} saved of {formatCurrency(target)}</p>
                        </div>
                      );
                    })}
                  </div>
                  {savingsGoals.length > 3 && (
                    <p className="savings-overview-more">
                      Showing 3 of {savingsGoals.length} goals.
                    </p>
                  )}
                </>
              )}
            </section>

            {showTransactionForm && (
              <AddTransaction
                onClose={() => setShowTransactionForm(false)}
                onAddTransaction={handleAddTransaction}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default App;
