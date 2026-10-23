import { useCallback, useMemo, useState } from "react";

function Budget({
  transactions = [],
  monthlyBudget = null,
  categoryLimits = {},
  onSaveMonthlyBudget,
  onSaveCategoryLimits,
  budgetLoading = false,
}) {
  const [referenceDate] = useState(() => new Date());
  const [budgetInput, setBudgetInput] = useState(null);
  const newBudget =
    budgetInput ?? (monthlyBudget == null ? "" : String(monthlyBudget));

  const [budgetMonth, setBudgetMonth] = useState(() => {
    const now = referenceDate;

    return `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;
  });

  const [editingCategory, setEditingCategory] = useState("");
  const [categoryLimitInput, setCategoryLimitInput] = useState("");

  const [savingBudget, setSavingBudget] = useState(false);
  const [savingCategory, setSavingCategory] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const getAmount = (amount) => {
    const value =
      typeof amount === "number"
        ? amount
        : Number(String(amount ?? 0).replace(/[₹,\s]/g, ""));

    return Number.isFinite(value) ? value : 0;
  };

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(getAmount(amount));

  const parseTransactionDate = useCallback((value) => {
    if (!value) return null;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }

    if (typeof value !== "string") return null;

    const cleaned = value.trim();

    if (!cleaned) return null;

    const now = referenceDate;

    const relativeDate = cleaned.match(/^(today|yesterday|just now)(?:\s+.*)?$/i);
    if (relativeDate) {
      const dayOffset = relativeDate[1].toLowerCase() === "yesterday" ? -1 : 0;
      return new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + dayOffset
      );
    }

    const iso = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);

    if (iso) {
      const year = Number(iso[1]);
      const month = Number(iso[2]);
      const day = Number(iso[3]);

      const date = new Date(year, month - 1, day);

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return null;
      }

      return date;
    }

    const parsed = new Date(cleaned);

    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [referenceDate]);

  const selectedMonth = useMemo(() => {
    const [year, month] = budgetMonth.split("-").map(Number);

    return {
      year,
      monthIndex: month - 1,
    };
  }, [budgetMonth]);

  const monthlyExpenses = useMemo(() => {
    return transactions.filter((transaction) => {
      if (String(transaction.type).toLowerCase() !== "expense") {
        return false;
      }

      const date = parseTransactionDate(transaction.date);

      return (
        date &&
        date.getFullYear() === selectedMonth.year &&
        date.getMonth() === selectedMonth.monthIndex
      );
    });
  }, [transactions, selectedMonth, parseTransactionDate]);

  const totalExpenses = monthlyExpenses.reduce(
    (total, transaction) =>
      total + getAmount(transaction.amount),
    0
  );

  const hasMonthlyBudget = monthlyBudget != null;

  const remainingBudget = hasMonthlyBudget
    ? monthlyBudget - totalExpenses
    : null;

  const percentageUsed =
    hasMonthlyBudget && monthlyBudget > 0
      ? (totalExpenses / monthlyBudget) * 100
      : 0;

  // Normalize Food and Food & Dining into one category.
  const categories = monthlyExpenses.reduce((result, transaction) => {
    const originalCategory = String(
      transaction.category || "Other"
    ).trim();

    const category =
      originalCategory.toLowerCase() === "food"
        ? "Food & Dining"
        : originalCategory;

    result[category] =
      (result[category] || 0) + getAmount(transaction.amount);

    return result;
  }, {});

  const monthLabel = new Date(
    selectedMonth.year,
    selectedMonth.monthIndex,
    1
  ).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  // Show categories that have actual expenses or saved limits.
  // No default category limits are created.
  const categoryNames = Array.from(
    new Set([
      ...Object.keys(categoryLimits).filter(
        (category) => category !== "Food"
      ),
      ...Object.keys(categories),
    ])
  );

  async function handleBudgetUpdate(event) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const amount = Number(newBudget);

    if (
      newBudget.trim() === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("Please enter a monthly budget greater than zero.");
      return;
    }

    if (!onSaveMonthlyBudget) {
      setError("The monthly budget save handler is not configured.");
      return;
    }

    try {
      setSavingBudget(true);

      await onSaveMonthlyBudget(amount);

      setSuccess("Monthly budget saved successfully.");
    } catch (err) {
      setError(
        err.message || "Could not save the monthly budget."
      );
    } finally {
      setSavingBudget(false);
    }
  }

  async function handleCategoryLimitSave(event, category) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const amount = Number(categoryLimitInput);

    if (
      categoryLimitInput.trim() === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setError("Please enter a category limit greater than zero.");
      return;
    }

    if (!onSaveCategoryLimits) {
      setError("The category limit save handler is not configured.");
      return;
    }

    try {
      setSavingCategory(true);

      const updatedLimits = {
        ...categoryLimits,
        [category]: amount,
      };

      delete updatedLimits.Food;

      await onSaveCategoryLimits(updatedLimits);

      setEditingCategory("");
      setCategoryLimitInput("");

      setSuccess(`${category} limit saved successfully.`);
    } catch (err) {
      setError(
        err.message || "Could not save the category limit."
      );
    } finally {
      setSavingCategory(false);
    }
  }

  return (
    <div className="budget-page">
      <header className="budget-page-header">
        <div>
          <span className="budget-eyebrow">
            YOUR MONEY, YOUR PLAN ✨
          </span>

          <h1>Budget Management</h1>

          <p>
            Plan your spending and stay in control of your money.
          </p>
        </div>

        <label className="budget-month-picker">
          <span>Budget month</span>

          <input
            type="month"
            value={budgetMonth}
            onChange={(event) =>
              setBudgetMonth(event.target.value)
            }
            aria-label="Select budget month"
          />
        </label>
      </header>

      {budgetLoading && (
        <p role="status">Loading your saved budget…</p>
      )}

      {error && (
        <div role="alert" className="transaction-error">
          {error}
        </div>
      )}

      {success && (
        <p role="status" className="migration-message">
          {success}
        </p>
      )}

      <section className="budget-overview">
        <div className="budget-main-card">
          <span className="budget-card-icon">💜</span>

          <p>Monthly Budget</p>

          <h2>
            {hasMonthlyBudget
              ? formatCurrency(monthlyBudget)
              : "Not set"}
          </h2>

          <form
            onSubmit={handleBudgetUpdate}
            className="budget-edit-form"
          >
            <label htmlFor="monthly-budget-input">
              Set your monthly spending limit
            </label>

            <input
              id="monthly-budget-input"
              type="number"
              min="0.01"
              step="0.01"
              value={newBudget}
              onChange={(event) => setBudgetInput(event.target.value)}
              placeholder="Enter monthly budget"
              required
            />

            <button
              type="submit"
              disabled={savingBudget || budgetLoading}
            >
              {savingBudget ? "Saving…" : "Save Budget"}
            </button>
          </form>
        </div>

        <div className="budget-stat-card">
          <span className="budget-card-icon">💸</span>

          <p>Total Expenses</p>

          <small>{monthLabel}</small>

          <h2>{formatCurrency(totalExpenses)}</h2>

          <span className="budget-stat-description">
            {monthlyExpenses.length} expense transaction(s)
          </span>
        </div>

        <div className="budget-stat-card">
          <span className="budget-card-icon">🌷</span>

          <p>Remaining Budget</p>

          <small>{monthLabel}</small>

          <h2
            className={
              remainingBudget != null && remainingBudget < 0
                ? "budget-danger"
                : "budget-success"
            }
          >
            {remainingBudget == null
              ? "Not available"
              : formatCurrency(remainingBudget)}
          </h2>

          <span className="budget-stat-description">
            {remainingBudget == null
              ? "Set a monthly budget to calculate your remaining amount."
              : remainingBudget < 0
              ? "Your budget has been exceeded."
              : "Available to spend this month."}
          </span>
        </div>
      </section>

      <section className="budget-section">
        <div className="budget-section-heading">
          <div>
            <span className="budget-section-kicker">
              MONTHLY TRACKER
            </span>

            <h2>Monthly Budget Usage</h2>
          </div>

          <span className="budget-percentage">
            {hasMonthlyBudget
              ? `${percentageUsed.toFixed(1)}% used`
              : "Budget not set"}
          </span>
        </div>

        <div className="budget-usage-details">
          <span>{formatCurrency(totalExpenses)} spent</span>

          <span>
            {hasMonthlyBudget
              ? `${formatCurrency(monthlyBudget)} budget`
              : "No budget set"}
          </span>
        </div>

        <div
          className="budget-progress-track"
          role="progressbar"
          aria-label="Monthly budget used"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={
            hasMonthlyBudget
              ? Math.min(Math.max(percentageUsed, 0), 100)
              : 0
          }
        >
          <div
            className="budget-progress-fill"
            style={{
              width: `${
                hasMonthlyBudget
                  ? Math.min(Math.max(percentageUsed, 0), 100)
                  : 0
              }%`,
              background:
                percentageUsed >= 100
                  ? "#dc647c"
                  : undefined,
            }}
          />
        </div>

        <p
          className={
            remainingBudget != null && remainingBudget < 0
              ? "budget-note budget-danger"
              : "budget-note"
          }
        >
          {remainingBudget == null
            ? "Set a monthly budget to start tracking your usage."
            : remainingBudget < 0
            ? `You exceeded your budget by ${formatCurrency(
                Math.abs(remainingBudget)
              )}.`
            : `${formatCurrency(
                remainingBudget
              )} remaining out of your monthly budget.`}
        </p>
      </section>

      <section className="budget-section">
        <div className="budget-section-heading">
          <div>
            <span className="budget-section-kicker">
              SPENDING BREAKDOWN
            </span>

            <h2>Category-wise Spending</h2>

            <p>
              Set limits for the categories you want to track.
            </p>
          </div>
        </div>

        {categoryNames.length === 0 ? (
          <p>
            No categories to display yet. Add an expense transaction
            to get started.
          </p>
        ) : (
          <div className="category-budget-grid">
            {categoryNames.map((category) => {
              const amount = categories[category] || 0;

              const limit =
                categoryLimits[category] == null
                  ? null
                  : getAmount(categoryLimits[category]);

              const percent =
                limit != null && limit > 0
                  ? (amount / limit) * 100
                  : 0;

              const overLimit =
                limit != null && amount > limit;

              const nearLimit =
                limit != null &&
                amount >= limit * 0.8 &&
                !overLimit;

              return (
                <article
                  className="category-budget-card"
                  key={category}
                >
                  <div className="category-budget-heading">
                    <div className="category-budget-icon">
                      {category.toLowerCase().includes("food")
                        ? "🍔"
                        : category.toLowerCase().includes("shop")
                        ? "🛍️"
                        : category.toLowerCase().includes("transport")
                        ? "🚕"
                        : "💳"}
                    </div>

                    <div>
                      <h3>{category}</h3>
                      <p>Monthly category limit</p>
                    </div>
                  </div>

                  <h2>{formatCurrency(amount)}</h2>

                  <div className="category-budget-values">
                    <span>
                      {limit != null
                        ? `Limit: ${formatCurrency(limit)}`
                        : "No limit set"}
                    </span>

                    <span>
                      {limit != null
                        ? `${Math.min(
                            (amount / limit) * 100,
                            999
                          ).toFixed(0)}%`
                        : "—"}
                    </span>
                  </div>

                  <div
                    className="budget-progress-track"
                    role="progressbar"
                    aria-label={`${category} budget used`}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-valuenow={Math.min(percent, 100)}
                  >
                    <div
                      className="budget-progress-fill"
                      style={{
                        width: `${Math.min(percent, 100)}%`,
                        background: overLimit
                          ? "#dc647c"
                          : nearLimit
                          ? "#e8ad55"
                          : undefined,
                      }}
                    />
                  </div>

                  <p
                    className={
                      overLimit
                        ? "category-budget-status budget-danger"
                        : nearLimit
                        ? "category-budget-status budget-warning"
                        : "category-budget-status"
                    }
                  >
                    {overLimit
                      ? `Over limit by ${formatCurrency(
                          amount - limit
                        )}`
                      : nearLimit
                      ? "You're getting close to your limit."
                      : limit != null
                      ? `${formatCurrency(
                          limit - amount
                        )} left to spend`
                      : "Set a limit to track this category."}
                  </p>

                  {editingCategory === category ? (
                    <form
                      className="budget-edit-form category-limit-form"
                      onSubmit={(event) =>
                        handleCategoryLimitSave(event, category)
                      }
                    >
                      <label htmlFor={`limit-${category}`}>
                        New category limit
                      </label>

                      <input
                        id={`limit-${category}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={categoryLimitInput}
                        onChange={(event) =>
                          setCategoryLimitInput(event.target.value)
                        }
                        placeholder="Enter amount"
                        required
                        autoFocus
                      />

                      <div className="category-limit-actions">
                        <button
                          type="submit"
                          disabled={savingCategory}
                        >
                          {savingCategory
                            ? "Saving…"
                            : "Save Limit"}
                        </button>

                        <button
                          type="button"
                          className="budget-cancel-btn"
                          onClick={() => {
                            setEditingCategory("");
                            setCategoryLimitInput("");
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      className="category-limit-btn"
                      type="button"
                      onClick={() => {
                        setEditingCategory(category);
                        setCategoryLimitInput(
                          limit == null ? "" : String(limit)
                        );
                      }}
                    >
                      {limit != null
                        ? "✎ Edit Limit"
                        : "+ Set Limit"}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="budget-tip">
        <div className="budget-tip-icon">💡</div>

        <div>
          <h3>A little tip for your wallet</h3>

          <p>
            Try to keep some money aside for unexpected expenses.
            Review your category limits regularly and adjust them
            to match your real spending habits.
          </p>
        </div>
      </section>
    </div>
  );
}

export default Budget;
