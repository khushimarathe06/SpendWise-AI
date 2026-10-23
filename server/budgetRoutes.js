const express = require("express");
const Budget = require("./Budget");
const authenticateUser = require("./authenticateUser");

const router = express.Router();

// Convert a Mongoose Map or plain object into a plain object safely.
function normalizeCategoryLimits(value) {
  if (!value) {
    return {};
  }

  if (value instanceof Map) {
    return Object.fromEntries(value);
  }

  if (
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    return { ...value };
  }

  return {};
}

// Validate monthly budget data.
function validateMonthlyBudget(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value > 0
  );
}

// GET: Retrieve the current user's budget.
// Do not create a document when no budget exists.
router.get("/", authenticateUser, async (req, res) => {
  try {
    const budget = await Budget.findOne({
      user: req.userId,
    }).lean();

    if (!budget) {
      return res.json({
        monthlyBudget: null,
        categoryLimits: {},
      });
    }

    return res.json({
      monthlyBudget: budget.monthlyBudget ?? null,
      categoryLimits: normalizeCategoryLimits(
        budget.categoryLimits
      ),
    });
  } catch (error) {
    console.error("Fetch budget failed:", error);

    return res.status(500).json({
      message: "Could not fetch your budget.",
    });
  }
});

// PUT: Create or update the monthly budget.
router.put("/monthly", authenticateUser, async (req, res) => {
  try {
    const { monthlyBudget } = req.body;

    if (!validateMonthlyBudget(monthlyBudget)) {
      return res.status(400).json({
        message:
          "Monthly budget must be a valid number greater than zero.",
      });
    }

    const budget = await Budget.findOneAndUpdate(
      { user: req.userId },
      { $set: { monthlyBudget } },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: false,
      }
    );

    return res.json({
      message: "Monthly budget saved successfully.",
      monthlyBudget: budget.monthlyBudget ?? null,
    });
  } catch (error) {
    console.error("Save monthly budget failed:", error);

    return res.status(500).json({
      message: "Could not save your monthly budget.",
    });
  }
});

// PUT: Create or update category spending limits.
router.put("/categories", authenticateUser, async (req, res) => {
  try {
    const { categoryLimits } = req.body;

    if (
      !categoryLimits ||
      typeof categoryLimits !== "object" ||
      Array.isArray(categoryLimits)
    ) {
      return res.status(400).json({
        message: "Please provide valid category limits.",
      });
    }

    const entries = Object.entries(categoryLimits);

    if (entries.length > 100) {
      return res.status(400).json({
        message: "Too many category limits.",
      });
    }

    const invalidEntry = entries.some(
      ([category, amount]) =>
        !category.trim() ||
        category.length > 60 ||
        typeof amount !== "number" ||
        !Number.isFinite(amount) ||
          amount <= 0
    );

    if (invalidEntry) {
      return res.status(400).json({
        message: "Category names must be valid and limits must be greater than zero.",
      });
    }

    const budget = await Budget.findOneAndUpdate(
      { user: req.userId },
      { $set: { categoryLimits } },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: false,
      }
    );

    return res.json({
      message: "Category limits saved successfully.",
      categoryLimits: normalizeCategoryLimits(
        budget.categoryLimits
      ),
    });
  } catch (error) {
    console.error("Save category limits failed:", error);

    return res.status(500).json({
      message: "Could not save category limits.",
    });
  }
});

// DELETE: Delete the current user's budget settings.
router.delete("/", authenticateUser, async (req, res) => {
  try {
    await Budget.findOneAndDelete({
      user: req.userId,
    });

    return res.json({
      message: "Budget settings deleted successfully.",
    });
  } catch (error) {
    console.error("Delete budget failed:", error);

    return res.status(500).json({
      message: "Could not delete your budget settings.",
    });
  }
});

module.exports = router;
