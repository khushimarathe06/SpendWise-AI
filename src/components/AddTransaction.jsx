import { useEffect, useState } from "react";
import "./AddTransaction.css";

// Category options shown based on transaction type
const EXPENSE_CATEGORIES = [
  "Food & Dining",
  "Shopping",
  "Transportation",
  "Entertainment",
  "Bills & Utilities",
  "Healthcare",
  "Education",
  "Rent",
  "Other",
];

const INCOME_CATEGORIES = [
  "Salary",
  "Freelance",
  "Investment",
  "Business",
  "Gift",
  "Other",
];

const CATEGORY_ICONS = {
  "Food & Dining": "🍔",
  "Shopping": "🛍️",
  "Transportation": "🚕",
  "Entertainment": "🎬",
  "Bills & Utilities": "💡",
  "Healthcare": "🏥",
  "Education": "📚",
  "Rent": "🏠",
  "Salary": "💰",
  "Freelance": "💻",
  "Investment": "📈",
  "Business": "🏢",
  "Gift": "🎁",
  "Other": "💳",
};

// Return today's date as "YYYY-MM-DD" in local time
function todayIso() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function AddTransaction({ onClose, onAddTransaction }) {
  const today = todayIso();

  const [type, setType] = useState("expense");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Food & Dining");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape" && !saving) onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, saving]);

  // Switch type and reset category to a sensible default
  function switchType(newType) {
    setType(newType);
    setCategory(newType === "income" ? "Salary" : "Food & Dining");
    setError("");
  }

  const categories =
    type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  async function handleSave(event) {
    event.preventDefault();
    if (saving) return;
    setError("");

    const trimmedTitle = title.trim();
    const parsedAmount = Number(amount);

    if (!trimmedTitle) {
      setError("Please enter a title for this transaction.");
      return;
    }

    if (trimmedTitle.length > 100) {
      setError("Title must be 100 characters or fewer.");
      return;
    }

    if (!amount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than zero.");
      return;
    }

    if (!date) {
      setError("Please select a date.");
      return;
    }

    setSaving(true);

    try {
      // onAddTransaction sends to the backend and closes the form on success.
      // Errors are shown via the parent's error banner.
      await onAddTransaction({
        title: trimmedTitle,
        description: trimmedTitle,
        category,
        amount: parsedAmount,        // number — NOT a formatted string
        type,                         // "income" | "expense" (lowercase)
        icon: CATEGORY_ICONS[category] || "💳",
        date,                         // "YYYY-MM-DD" — NOT "Just now"
      });
    } catch (saveError) {
      setError(saveError.message || "Could not save this transaction. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  // Close when clicking the dark backdrop (not the modal itself)
  function handleOverlayClick(event) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <div
      className="add-transaction-overlay"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
      aria-label="Add transaction"
    >
      <div className="add-transaction-modal">
        {/* Header */}
        <div className="add-transaction-header">
          <div>
            <h2>Add Transaction</h2>
            <p>Record your income or expense</p>
          </div>

          <button
            className="add-transaction-close"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Income / Expense toggle */}
        <div className="add-transaction-type-toggle">
          <button
            type="button"
            className={`at-type-btn${
              type === "expense" ? " at-expense-active" : ""
            }`}
            onClick={() => switchType("expense")}
          >
            💸 Expense
          </button>

          <button
            type="button"
            className={`at-type-btn${
              type === "income" ? " at-income-active" : ""
            }`}
            onClick={() => switchType("income")}
          >
            💰 Income
          </button>
        </div>

        {/* Form fields */}
        <form className="add-transaction-form" onSubmit={handleSave}>
          {/* Title */}
          <div className="add-transaction-field">
            <label htmlFor="at-title">Title</label>
            <input
              id="at-title"
              type="text"
              placeholder={
                type === "income"
                  ? "e.g. Monthly salary"
                  : "e.g. Lunch at café"
              }
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              required
              autoFocus
            />
          </div>

          {/* Category + Date side by side */}
          <div className="add-transaction-row">
            <div className="add-transaction-field">
              <label htmlFor="at-category">Category</label>
              <select
                id="at-category"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="add-transaction-field">
              <label htmlFor="at-date">Date</label>
              <input
                id="at-date"
                type="date"
                value={date}
                max={today}
                required
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
          </div>

          {/* Amount */}
          <div className="add-transaction-field">
            <label htmlFor="at-amount">Amount (₹)</label>
            <input
              id="at-amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              min="0.01"
              step="0.01"
              required
            />
          </div>

          {/* Inline validation error */}
          {error && (
            <p className="add-transaction-error" role="alert">
              {error}
            </p>
          )}

          {/* Submit */}
          <button
            className={`add-transaction-save${
              type === "income" ? " at-income-save" : ""
            }`}
            type="submit"
            disabled={saving}
          >
            {saving
              ? "Saving…"
              : `Add ${type === "income" ? "Income" : "Expense"}`}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddTransaction;
