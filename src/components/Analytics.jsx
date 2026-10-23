import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

import "./Analytics.css";

const CHART_COLORS = [
  "#8c78d8",
  "#8acbb4",
  "#f5c49e",
  "#e99bb8",
  "#a58bfa",
  "#42b9d5",
  "#e4c64b",
  "#8a9ab5",
];

const CATEGORY_ICONS = {
  "Food & Dining": "🍔",
  Food: "🍔",
  Shopping: "🛍️",
  Transportation: "🚕",
  Entertainment: "🎬",
  Healthcare: "🏥",
  Education: "📚",
  Bills: "🧾",
  Travel: "✈️",
  Salary: "💼",
  Freelance: "💻",
  Other: "📦",
};

const currency = (amount) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount || 0);

const getValidDate = (value) => {
  if (value === null || value === undefined || value === "") return null;

  const cleaned = String(value).trim();
  if (!cleaned) return null;

  // Parse the calendar date in local time, including older ISO timestamps.
  const isoDate = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoDate) {
    const year = Number(isoDate[1]);
    const month = Number(isoDate[2]);
    const day = Number(isoDate[3]);
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

  // Parse labels such as "Today 2:30 PM" and "Yesterday 11:20 AM".
  const relativeDate = cleaned.match(/^(today|yesterday|just now)(?:\s+(.*))?$/i);
  if (relativeDate) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);

    if (relativeDate[1].toLowerCase() === "yesterday") {
      date.setDate(date.getDate() - 1);
    }

    const timeText = relativeDate[2];
    if (timeText) {
      const time = timeText.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
      if (time) {
        let hours = Number(time[1]) % 12;
        if (time[3].toUpperCase() === "PM") hours += 12;
        date.setHours(hours, Number(time[2] || 0), 0, 0);
      }
    }

    return date;
  }

  // Support other browser-parseable date values, e.g. "5 Oct 6:15 PM".
  const date = new Date(cleaned);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getTransactionDate = (transaction) => {
  if (!transaction) return null;

  return (
    getValidDate(transaction.date) ||
    getValidDate(transaction.createdAt) ||
    getValidDate(transaction.created_at) ||
    null
  );
};

const getAmount = (transaction) => {
  const amount = Number(transaction.amount);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
};

const getMonthKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

function Analytics({ transactions = [], monthlyBudget = null }) {
  const [period, setPeriod] = useState("6");
  const [referenceDate] = useState(() => new Date());

  const analysis = useMemo(() => {
    const now = referenceDate;
    const currentMonthKey = getMonthKey(now);

    const previousMonthDate = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const previousMonthKey = getMonthKey(previousMonthDate);

    const validTransactions = transactions.filter(
      (transaction) =>
        transaction &&
        (transaction.type === "income" ||
          transaction.type === "expense") &&
        getAmount(transaction) > 0
    );

    const incomeTransactions = validTransactions.filter(
      (transaction) => transaction.type === "income"
    );

    const expenseTransactions = validTransactions.filter(
      (transaction) => transaction.type === "expense"
    );

    const totalIncome = incomeTransactions.reduce(
      (sum, transaction) => sum + getAmount(transaction),
      0
    );

    const totalExpenses = expenseTransactions.reduce(
      (sum, transaction) => sum + getAmount(transaction),
      0
    );

    const netBalance = totalIncome - totalExpenses;

    const savingsRate =
      totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

    const monthlyExpenseTransactions = expenseTransactions.filter(
      (transaction) => {
        const date = getTransactionDate(transaction);
        return date && getMonthKey(date) === currentMonthKey;
      }
    );

    const monthlyIncomeTransactions = incomeTransactions.filter(
      (transaction) => {
        const date = getTransactionDate(transaction);
        return date && getMonthKey(date) === currentMonthKey;
      }
    );

    const monthlyExpenses = monthlyExpenseTransactions.reduce(
      (sum, transaction) => sum + getAmount(transaction),
      0
    );

    const previousMonthExpenses = expenseTransactions
      .filter((transaction) => {
        const date = getTransactionDate(transaction);
        return date && getMonthKey(date) === previousMonthKey;
      })
      .reduce((sum, transaction) => sum + getAmount(transaction), 0);

    const monthlySpendingDifference =
      monthlyExpenses - previousMonthExpenses;

    const monthlySpendingChange =
      previousMonthExpenses > 0
        ? (monthlySpendingDifference / previousMonthExpenses) * 100
        : null;

    const currentMonthName = now.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    const previousMonthName = previousMonthDate.toLocaleDateString("en-IN", {
      month: "long",
      year: "numeric",
    });

    const monthlyIncome = monthlyIncomeTransactions.reduce(
      (sum, transaction) => sum + getAmount(transaction),
      0
    );

    // Do not assume a budget when the user has not set one.
    const budget = Math.max(0, Number(monthlyBudget) || 0);
    const budgetRemaining = budget - monthlyExpenses;
    const budgetUsage =
      budget > 0 ? (monthlyExpenses / budget) * 100 : 0;

    const categoryMap = {};

    expenseTransactions.forEach((transaction) => {
      const originalCategory = String(transaction.category || "Other").trim();
      const category = originalCategory.toLowerCase() === "food"
        ? "Food & Dining"
        : originalCategory || "Other";
      categoryMap[category] =
        (categoryMap[category] || 0) + getAmount(transaction);
    });

    const categories = Object.entries(categoryMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const monthlyCategoryMap = {};

    monthlyExpenseTransactions.forEach((transaction) => {
      const originalCategory = String(transaction.category || "Other").trim();
      const category = originalCategory.toLowerCase() === "food"
        ? "Food & Dining"
        : originalCategory || "Other";
      monthlyCategoryMap[category] =
        (monthlyCategoryMap[category] || 0) + getAmount(transaction);
    });

    const monthlyCategories = Object.entries(monthlyCategoryMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: monthlyExpenses > 0 ? (amount / monthlyExpenses) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    // Build a real calendar-month series, including months with no transactions.
    const monthCount = Number(period);

    const months = Array.from({ length: monthCount }, (_, index) => {
      const date = new Date(
        now.getFullYear(),
        now.getMonth() - monthCount + 1 + index,
        1
      );

      return {
        key: getMonthKey(date),
        month: date.toLocaleDateString("en-IN", {
          month: "short",
          year: "2-digit",
        }),
        income: 0,
        expenses: 0,
      };
    });

    const monthMap = Object.fromEntries(
      months.map((month) => [month.key, month])
    );

    validTransactions.forEach((transaction) => {
      const date = getTransactionDate(transaction);
      if (!date) return;

      const month = monthMap[getMonthKey(date)];
      if (!month) return;

      if (transaction.type === "income") {
        month.income += getAmount(transaction);
      } else {
        month.expenses += getAmount(transaction);
      }
    });

    const datedExpenses = expenseTransactions.filter((transaction) =>
      getTransactionDate(transaction)
    );

    const undatedExpenseCount =
      expenseTransactions.length - datedExpenses.length;

    return {
      totalIncome,
      totalExpenses,
      netBalance,
      savingsRate,
      monthlyExpenses,
      monthlyIncome,
      previousMonthExpenses,
      monthlySpendingDifference,
      monthlySpendingChange,
      currentMonthName,
      previousMonthName,
      budget,
      budgetRemaining,
      budgetUsage,
      categories,
      monthlyCategories,
      months,
      expenseCount: expenseTransactions.length,
      incomeCount: incomeTransactions.length,
      datedExpenseCount: datedExpenses.length,
      undatedExpenseCount,
    };
  }, [transactions, monthlyBudget, period, referenceDate]);

  const {
    totalIncome,
    totalExpenses,
    netBalance,
    savingsRate,
    monthlyExpenses,
    monthlyIncome,
    previousMonthExpenses,
    monthlySpendingDifference,
    monthlySpendingChange,
    currentMonthName,
    previousMonthName,
    budget,
    budgetRemaining,
    budgetUsage,
    categories,
    monthlyCategories,
    months,
    expenseCount,
    incomeCount,
    datedExpenseCount,
    undatedExpenseCount,
  } = analysis;

  const highestCategory = categories[0];
  const highestMonthlyCategory = monthlyCategories[0];

  const monthWithHighestExpense = [...months].sort(
    (a, b) => b.expenses - a.expenses
  )[0];

  const hasDatedExpenses = datedExpenseCount > 0;
  const hasAnyTransactions = transactions.length > 0;

  const chartTooltipStyle = {
    borderRadius: "12px",
    border: "1px solid #e8edf5",
    boxShadow: "0 8px 24px rgba(25, 45, 85, 0.1)",
    fontSize: "12px",
  };

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <div>
          <span className="analytics-eyebrow">YOUR MONEY, EXPLAINED</span>
          <h1>Financial Analytics</h1>
          <p>
            Understand your income, discover spending patterns, and make better
            financial decisions.
          </p>
        </div>
        <div className="analytics-header-icon">📊</div>
      </header>

      {/* FINANCIAL SUMMARY */}
      <section className="analytics-summary-grid">
        <SummaryCard
          label="Total Income"
          amount={currency(totalIncome)}
          detail={`${incomeCount} income transactions`}
          icon="↗"
          type="income"
        />
        <SummaryCard
          label="Total Expenses"
          amount={currency(totalExpenses)}
          detail={`${expenseCount} expense transactions`}
          icon="↘"
          type="expense"
        />
        <SummaryCard
          label="Net Savings"
          amount={currency(netBalance)}
          detail={
            totalIncome > 0
              ? `${savingsRate.toFixed(1)}% net savings rate`
              : "Add income to calculate savings rate"
          }
          icon="₹"
          type="balance"
        />
      </section>

      {/* MONTHLY BUDGET */}
      <section className="analytics-panel analytics-budget-panel">
        <div className="analytics-panel-heading">
          <div>
            <h2>This Month's Budget</h2>
            <p>Track your spending against your monthly budget.</p>
          </div>
          <span className="analytics-panel-icon">🎯</span>
        </div>

        {budget > 0 ? (
          <>
            <div className="analytics-budget-numbers">
              <div>
                <span>Spent this month</span>
                <strong>{currency(monthlyExpenses)}</strong>
              </div>
              <div>
                <span>Monthly budget</span>
                <strong>{currency(budget)}</strong>
              </div>
              <div>
                <span>{budgetRemaining >= 0 ? "Budget left" : "Over budget"}</span>
                <strong
                  className={
                    budgetRemaining < 0 ? "negative-value" : "positive-value"
                  }
                >
                  {currency(Math.abs(budgetRemaining))}
                </strong>
              </div>
            </div>

            <div
              className="analytics-budget-track"
              role="progressbar"
              aria-label="Monthly budget used"
              aria-valuenow={Math.min(100, Math.round(budgetUsage))}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <div
                className={`analytics-budget-fill ${
                  budgetUsage > 100 ? "over-budget-fill" : ""
                }`}
                style={{ width: `${Math.min(100, budgetUsage)}%` }}
              />
            </div>

            <div className="analytics-budget-footer">
              <span>{budgetUsage.toFixed(1)}% of budget used</span>
              <span>
                {budgetUsage > 100
                  ? "You have exceeded your budget."
                  : budgetUsage >= 80
                    ? "You're getting close to your budget."
                    : "Keep tracking your expenses."}
              </span>
            </div>
          </>
        ) : (
          <EmptyState
            icon="🎯"
            title="No monthly budget set"
            message="Set a monthly budget in the Budget section to track your spending limit here."
          />
        )}
      </section>

      {/* INCOME VS EXPENSES */}
      <section className="analytics-panel analytics-chart-panel">
        <div className="analytics-panel-heading analytics-chart-heading">
          <div>
            <h2>Income vs Expenses</h2>
            <p>Compare income and spending across calendar months.</p>
          </div>
          <select
            className="analytics-period-select"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            aria-label="Choose chart period"
          >
            <option value="3">Last 3 months</option>
            <option value="6">Last 6 months</option>
            <option value="12">Last 12 months</option>
          </select>
        </div>

        <div className="analytics-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={months}
              margin={{ top: 8, right: 8, left: 8, bottom: 4 }}
              barGap={7}
            >
              <CartesianGrid
                stroke="#edf1f7"
                strokeDasharray="4 4"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{ fill: "#8792a6", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(value) =>
                  value >= 1000
                    ? `₹${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
                    : `₹${value}`
                }
                tick={{ fill: "#8792a6", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={58}
              />
              <Tooltip
                formatter={(value) => currency(value)}
                contentStyle={chartTooltipStyle}
              />
              <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
              <Bar
                dataKey="income"
                name="Income"
                fill="#35b98b"
                radius={[5, 5, 0, 0]}
                maxBarSize={30}
              />
              <Bar
                dataKey="expenses"
                name="Expenses"
                fill="#8c78d8"
                radius={[5, 5, 0, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {!hasDatedExpenses && (
          <p className="analytics-data-note">
            Add transactions with valid dates to see your historical monthly
            trend. Undated transactions are included in the summary totals but
            cannot be assigned to a month.
          </p>
        )}
      </section>

      {/* SPENDING CATEGORY + MONTHLY TREND */}
      <div className="analytics-content-grid">
        <section className="analytics-panel analytics-chart-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Expense Breakdown</h2>
              <p>See which categories account for your spending.</p>
            </div>
            <span className="analytics-panel-icon">◉</span>
          </div>

          {categories.length > 0 ? (
            <>
              <div className="analytics-pie-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categories}
                      dataKey="amount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="52%"
                      outerRadius="78%"
                      paddingAngle={3}
                    >
                      {categories.map((category, index) => (
                        <Cell
                          key={category.name}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                          stroke="none"
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => currency(value)}
                      contentStyle={chartTooltipStyle}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="analytics-category-legend">
                {categories.map((category, index) => (
                  <div className="analytics-legend-row" key={category.name}>
                    <span className="analytics-legend-label">
                      <span
                        className="analytics-legend-dot"
                        style={{
                          background: CHART_COLORS[index % CHART_COLORS.length],
                        }}
                      />
                      <span>
                        {CATEGORY_ICONS[category.name] || "📦"} {category.name}
                      </span>
                    </span>
                    <strong>{category.percentage.toFixed(1)}%</strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState
              icon="🧾"
              title="No expenses to analyse yet"
              message="Add expense transactions to see your category breakdown."
            />
          )}
        </section>

        <section className="analytics-panel analytics-chart-panel">
          <div className="analytics-panel-heading">
            <div>
              <h2>Monthly Spending Trend</h2>
              <p>Follow how your expenses change over time.</p>
            </div>
            <span className="analytics-panel-icon">↗</span>
          </div>

          <div className="analytics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={months}
                margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  stroke="#edf1f7"
                  strokeDasharray="4 4"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  tick={{ fill: "#8792a6", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(value) =>
                    value >= 1000
                      ? `₹${(value / 1000).toFixed(0)}k`
                      : `₹${value}`
                  }
                  tick={{ fill: "#8792a6", fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                />
                <Tooltip
                  formatter={(value) => currency(value)}
                  contentStyle={chartTooltipStyle}
                />
                <Line
                  type="monotone"
                  dataKey="expenses"
                  name="Expenses"
                  stroke="#8c78d8"
                  strokeWidth={3}
                  dot={{ r: 4, fill: "#8c78d8", strokeWidth: 0 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <p className="analytics-chart-footnote">
            Months without recorded expenses are shown as ₹0. Historical
            accuracy depends on the dates saved with your transactions.
          </p>
        </section>
      </div>

      {/* CATEGORY RANKING */}
      <section className="analytics-panel analytics-chart-panel">
        <div className="analytics-panel-heading">
          <div>
            <h2>Spending by Category</h2>
            <p>Compare your categories from highest to lowest expense.</p>
          </div>
          <span className="analytics-panel-icon">▥</span>
        </div>

        {categories.length > 0 ? (
          <div className="analytics-category-list">
            {categories.map((category, index) => (
              <div className="analytics-category-item" key={category.name}>
                <div className="analytics-category-heading">
                  <div className="analytics-category-name">
                    <span className="analytics-category-icon">
                      {CATEGORY_ICONS[category.name] || "📦"}
                    </span>
                    <div>
                      <h3>
                        {index + 1}. {category.name}
                      </h3>
                      <p>
                        {category.percentage.toFixed(1)}% of all recorded
                        expenses
                      </p>
                    </div>
                  </div>
                  <strong>{currency(category.amount)}</strong>
                </div>

                <div className="analytics-progress-track">
                  <div
                    className="analytics-progress-fill"
                    style={{
                      width: `${category.percentage}%`,
                      background: CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon="📈"
            title="Nothing to compare yet"
            message="Your spending categories will appear when you record expenses."
          />
        )}
      </section>

      {/* MONTHLY SPENDING COMPARISON */}
      <section className="analytics-panel monthly-comparison-panel">
        <div className="analytics-panel-heading">
          <div>
            <h2>Monthly Spending Comparison</h2>
            <p>Compare your spending with the previous calendar month.</p>
          </div>
          <span className="analytics-panel-icon">📊</span>
        </div>

        <div className="monthly-comparison-grid">
          <div className="monthly-comparison-card">
            <span>{previousMonthName}</span>
            <h3>{currency(previousMonthExpenses)}</h3>
            <p>Recorded expenses</p>
          </div>

          <div className="monthly-comparison-card">
            <span>{currentMonthName}</span>
            <h3>{currency(monthlyExpenses)}</h3>
            <p>Recorded expenses</p>
          </div>

          <div className="monthly-comparison-card">
            <span>Change in spending</span>
            <h3
              className={
                monthlySpendingDifference > 0
                  ? "negative-value"
                  : monthlySpendingDifference < 0
                    ? "positive-value"
                    : ""
              }
            >
              {monthlySpendingDifference > 0 ? "+" : ""}
              {currency(monthlySpendingDifference)}
            </h3>
            <p>
              {monthlySpendingDifference > 0
                ? "You spent more this month."
                : monthlySpendingDifference < 0
                  ? "You spent less this month."
                  : "Spending is unchanged."}
            </p>
            <strong>
              {monthlySpendingChange === null
                ? previousMonthExpenses === 0 && monthlyExpenses > 0
                  ? "No previous-month spending to compare"
                  : "0% — no spending change"
                : `${monthlySpendingChange > 0 ? "+" : ""}${monthlySpendingChange.toFixed(1)}% compared with last month`}
            </strong>
          </div>
        </div>

        {previousMonthExpenses === 0 && monthlyExpenses === 0 && (
          <p className="analytics-data-note">
            No expenses were recorded in either month, so there is no spending
            change to calculate yet.
          </p>
        )}
      </section>

      {/* SMART INSIGHTS */}
      <section className="analytics-panel spending-insight-panel">
        <div className="insight-decoration">✦</div>
        <div className="insight-heading">
          <span className="insight-bulb">💡</span>
          <div>
            <span className="analytics-eyebrow">SMART OBSERVATIONS</span>
            <h2>Your Financial Health</h2>
          </div>
        </div>

        {!hasAnyTransactions ? (
          <p className="insight-description">
            Add your income and expenses to receive useful insights about your
            financial habits.
          </p>
        ) : (
          <>
            <div className="analytics-insights-grid">
              <Insight
                icon="🏆"
                title="Highest spending category"
                value={
                  highestCategory ? highestCategory.name : "No expenses recorded"
                }
                description={
                  highestCategory
                    ? `${currency(highestCategory.amount)} (${highestCategory.percentage.toFixed(1)}% of total expenses)`
                    : "Add expenses to compare categories."
                }
              />
              <Insight
                icon="💰"
                title="Net savings"
                value={currency(netBalance)}
                description={
                  netBalance >= 0
                    ? "Your recorded income is higher than your expenses."
                    : "Your recorded expenses exceed your income."
                }
              />
              <Insight
                icon="🎯"
                title="Monthly budget"
                value={
                  budget <= 0
                    ? "Not set"
                    : budgetRemaining >= 0
                      ? `${currency(budgetRemaining)} left`
                      : `${currency(Math.abs(budgetRemaining))} over`
                }
                description={
                  budget <= 0
                    ? "Set a monthly budget to track your spending limit."
                    : `${budgetUsage.toFixed(1)}% of your budget has been used.`
                }
              />
              <Insight
                icon="📅"
                title="Highest expense month"
                value={
                  hasDatedExpenses && monthWithHighestExpense
                    ? monthWithHighestExpense.month
                    : "Not enough date data"
                }
                description={
                  hasDatedExpenses && monthWithHighestExpense
                    ? `${currency(monthWithHighestExpense.expenses)} in recorded expenses`
                    : "Valid transaction dates are needed for this comparison."
                }
              />
            </div>

            <div className="insight-tip">
              <span>🎯</span>
              <p>
                <strong>Suggested next step: </strong>
                {budget > 0 && budgetRemaining < 0
                  ? `Your recorded expenses for this month exceed your budget by ${currency(Math.abs(budgetRemaining))}. Review optional purchases and adjust your spending plan.`
                  : budget > 0 && budgetUsage >= 80
                    ? "You have used most of your monthly budget. Check upcoming bills before making optional purchases."
                    : highestMonthlyCategory
                      ? `Your biggest category this month is ${highestMonthlyCategory.name}, at ${currency(highestMonthlyCategory.amount)}. Review those transactions to find realistic saving opportunities.`
                      : highestCategory
                        ? `Your largest recorded category overall is ${highestCategory.name}. Review it for possible savings.`
                        : "Continue recording income and expenses to build a clearer picture of your finances."}
              </p>
            </div>
          </>
        )}

        {undatedExpenseCount > 0 && (
          <p className="analytics-data-note">
            {undatedExpenseCount} expense transaction(s) have no valid date.
            They are included in overall totals and category breakdowns, but not
            in monthly charts.
          </p>
        )}

        <div className="analytics-insight-footer">
          <span>Total recorded income</span>
          <strong>{currency(totalIncome)}</strong>
          <span>Total recorded expenses</span>
          <strong>{currency(totalExpenses)}</strong>
          <span>Current month income</span>
          <strong>{currency(monthlyIncome)}</strong>
          <span>Current month expenses</span>
          <strong>{currency(monthlyExpenses)}</strong>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, amount, detail, icon, type }) {
  return (
    <div className="analytics-summary-card">
      <div className="analytics-card-top">
        <span>{label}</span>
        <span className={`analytics-icon ${type}-icon`}>{icon}</span>
      </div>
      <h2>{amount}</h2>
      <p>{detail}</p>
    </div>
  );
}

function Insight({ icon, title, value, description }) {
  return (
    <div className="analytics-insight-card">
      <span className="analytics-insight-card-icon">{icon}</span>
      <div>
        <p>{title}</p>
        <h3>{value}</h3>
        <span>{description}</span>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, message }) {
  return (
    <div className="analytics-empty-state">
      <span>{icon}</span>
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  );
}

export default Analytics;
