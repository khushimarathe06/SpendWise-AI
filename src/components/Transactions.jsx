import { useState } from "react";
import "./Transactions.css";

// Convert a stored date string to YYYY-MM-DD for <input type="date">
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toIsoDate(value) {
  if (!value) return formatLocalDate(new Date());

  const cleaned = String(value).trim();
  const today = new Date();

  const relativeDate = cleaned.match(/^(today|yesterday|just now)(?:\s+.*)?$/i);
  if (relativeDate) {
    if (relativeDate[1].toLowerCase() === "yesterday") {
      today.setDate(today.getDate() - 1);
    }
    return formatLocalDate(today);
  }

  // Keep the calendar date when older records include a full ISO timestamp.
  const isoDate = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|T)/);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    if (
      parsed.getFullYear() === Number(year) &&
      parsed.getMonth() === Number(month) - 1 &&
      parsed.getDate() === Number(day)
    ) {
      return `${year}-${month}-${day}`;
    }
    return formatLocalDate(new Date());
  }

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime())
    ? formatLocalDate(new Date())
    : formatLocalDate(parsed);
}

function formatDisplayDate(value) {
  const [year, month, day] = toIsoDate(value).split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function Transactions({
  transactions = [],
  onBack,
  onDeleteTransaction,
  onUpdateTransaction,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [today] = useState(() => formatLocalDate(new Date()));

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    category: "",
    amount: "",
    type: "expense",
    date: "",
  });
  const [editError, setEditError] = useState("");

  // Inline delete confirmation (replaces window.confirm)
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const getAmount = (amount) =>
    Number(String(amount ?? 0).replace(/[₹,\s]/g, "")) || 0;

  const formatCurrency = (amount) =>
    `₹${getAmount(amount).toLocaleString("en-IN")}`;

  const totalIncome = transactions
    .filter((t) => String(t.type).toLowerCase() === "income")
    .reduce((sum, t) => sum + getAmount(t.amount), 0);

  const totalExpenses = transactions
    .filter((t) => String(t.type).toLowerCase() === "expense")
    .reduce((sum, t) => sum + getAmount(t.amount), 0);

  const filteredTransactions = transactions.filter((transaction) => {
    const search = searchTerm.toLowerCase();

    const matchesSearch = [
      transaction.title,
      transaction.description,
      transaction.category,
    ].some((value) =>
      String(value || "").toLowerCase().includes(search)
    );

    const matchesType =
      filterType === "all" ||
      String(transaction.type).toLowerCase() === filterType;

    return matchesSearch && matchesType;
  });

  function startEditing(transaction) {
    setEditingId(transaction.id);
    setEditForm({
      title: transaction.title || transaction.description || "",
      category: transaction.category || "Other",
      amount: String(getAmount(transaction.amount)),
      type: String(transaction.type || "expense").toLowerCase(),
      date: toIsoDate(transaction.date),
    });
    setEditError("");
    setPendingDeleteId(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setEditError("");
  }

  async function saveEdit(event) {
    event.preventDefault();
    if (savingEdit) return;
    setEditError("");

    const amount = Number(editForm.amount);

    if (!editForm.title.trim()) {
      setEditError("Please enter a title.");
      return;
    }

    if (editForm.title.trim().length > 100) {
      setEditError("Title must be 100 characters or fewer.");
      return;
    }

    if (!editForm.category.trim()) {
      setEditError("Please enter a category.");
      return;
    }

    if (editForm.category.trim().length > 60) {
      setEditError("Category must be 60 characters or fewer.");
      return;
    }

    if (
      editForm.amount.trim() === "" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      setEditError("Please enter a valid amount greater than zero.");
      return;
    }

    if (!editForm.date) {
      setEditError("Please select a date.");
      return;
    }

    setSavingEdit(true);
    try {
      await onUpdateTransaction?.(editingId, {
        title: editForm.title.trim(),
        description: editForm.title.trim(),
        category: editForm.category.trim(),
        amount,
        type: editForm.type,
        date: editForm.date,
      });

      setEditingId(null);
      setEditError("");
    } catch (error) {
      setEditError(error.message || "Could not update this transaction. Please try again.");
    } finally {
      setSavingEdit(false);
    }
  }

  function requestDelete(transaction) {
    setPendingDeleteId(transaction.id);
    setDeleteError("");
    setEditingId(null);
  }

  async function confirmDelete(id) {
    if (deletingId !== null) return;
    setDeletingId(id);
    setDeleteError("");
    try {
      await onDeleteTransaction?.(id);
      setPendingDeleteId(null);
    } catch (error) {
      setDeleteError(error.message || "Could not delete this transaction. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  function cancelDelete() {
    if (deletingId !== null) return;
    setPendingDeleteId(null);
    setDeleteError("");
  }

  return (
    <div className="transactions-page">
      <header className="transactions-header">
        <div>
          <h1>Transactions</h1>
          <p>Manage and review all your financial activity.</p>
        </div>

        <button
          className="transactions-back-btn"
          onClick={onBack}
          type="button"
        >
          ← Dashboard
        </button>
      </header>

      <section className="transactions-summary">
        <div className="transactions-summary-card">
          <span>Total Transactions</span>
          <h2>{transactions.length}</h2>
        </div>

        <div className="transactions-summary-card">
          <span>Total Income</span>
          <h2>{formatCurrency(totalIncome)}</h2>
        </div>

        <div className="transactions-summary-card">
          <span>Total Expenses</span>
          <h2>{formatCurrency(totalExpenses)}</h2>
        </div>
      </section>

      <section className="transactions-table-panel">
        <div className="transactions-table-heading">
          <div>
            <h2>All Transactions</h2>
            <p>Your recorded income and expenses</p>
          </div>
        </div>

        <div className="transaction-controls">
          <input
            type="search"
            placeholder="Search by name or category..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            aria-label="Search transactions"
          />

          <select
            value={filterType}
            onChange={(event) => setFilterType(event.target.value)}
            aria-label="Filter transactions by type"
          >
            <option value="all">All Transactions</option>
            <option value="income">Income Only</option>
            <option value="expense">Expenses Only</option>
          </select>
        </div>

        {/* Inline edit validation error */}
        {editError && (
          <div className="transaction-edit-error" role="alert">
            {editError}
          </div>
        )}

        {filteredTransactions.length === 0 ? (
          <div className="transactions-empty">
            <div className="transactions-empty-icon">💳</div>
            <h3>No transactions found</h3>
            <p>Try changing your search or filter.</p>
          </div>
        ) : (
          <div className="transactions-table-wrapper">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>Transaction</th>
                  <th>Category</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Amount</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredTransactions.map((transaction) => {
                  const isIncome =
                    String(transaction.type).toLowerCase() === "income";

                  const isEditing = editingId === transaction.id;
                  const isPendingDelete =
                    pendingDeleteId === transaction.id;

                  return (
                    <tr key={transaction.id}>
                      {/* Title */}
                      <td>
                        {isEditing ? (
                          <input
                            className="transaction-edit-input"
                            value={editForm.title}
                            maxLength={100}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                title: event.target.value,
                              })
                            }
                            aria-label="Transaction title"
                          />
                        ) : (
                          <div className="transaction-name">
                            <span className="transaction-table-icon">
                              {transaction.icon || "💳"}
                            </span>
                            <strong>
                              {transaction.title ||
                                transaction.description ||
                                "Transaction"}
                            </strong>
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td>
                        {isEditing ? (
                          <input
                            className="transaction-edit-input"
                            value={editForm.category}
                            maxLength={60}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                category: event.target.value,
                              })
                            }
                            aria-label="Transaction category"
                          />
                        ) : (
                          transaction.category || "Other"
                        )}
                      </td>

                      {/* Date — editable when in edit mode */}
                      <td>
                        {isEditing ? (
                          <input
                            className="transaction-edit-input"
                            type="date"
                            value={editForm.date}
                            max={today}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                date: event.target.value,
                              })
                            }
                            aria-label="Transaction date"
                          />
                        ) : (
                          transaction.date ? formatDisplayDate(transaction.date) : "—"
                        )}
                      </td>

                      {/* Type */}
                      <td>
                        {isEditing ? (
                          <select
                            value={editForm.type}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                type: event.target.value,
                              })
                            }
                            aria-label="Transaction type"
                          >
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                          </select>
                        ) : (
                          <span
                            className={`transaction-type ${
                              isIncome ? "income" : "expense"
                            }`}
                          >
                            {isIncome ? "Income" : "Expense"}
                          </span>
                        )}
                      </td>

                      {/* Amount */}
                      <td
                        className={`transaction-amount ${
                          isIncome ? "income-text" : "expense-text"
                        }`}
                      >
                        {isEditing ? (
                          <input
                            className="transaction-edit-input amount-input"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={editForm.amount}
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                amount: event.target.value,
                              })
                            }
                            aria-label="Transaction amount"
                          />
                        ) : (
                          `${isIncome ? "+" : "-"}${formatCurrency(
                            transaction.amount
                          )}`
                        )}
                      </td>

                      {/* Actions */}
                      <td>
                        <div className="transaction-actions">
                          {isEditing ? (
                            <>
                              <button
                                className="save-transaction-btn"
                                type="button"
                                onClick={saveEdit}
                                disabled={savingEdit}
                              >
                                {savingEdit ? "Saving…" : "Save"}
                              </button>

                              <button
                                className="cancel-transaction-btn"
                                type="button"
                                onClick={cancelEditing}
                                disabled={savingEdit}
                              >
                                Cancel
                              </button>
                            </>
                          ) : isPendingDelete ? (
                            /* Inline delete confirmation — replaces window.confirm() */
                            <div className="transaction-confirm-delete">
                              <span>{deletingId === transaction.id ? "Deleting…" : "Delete?"}</span>
                              {deleteError && (
                                <span className="transaction-edit-error" role="alert">
                                  {deleteError}
                                </span>
                              )}
                              <button
                                className="delete-transaction-btn"
                                type="button"
                                onClick={() => confirmDelete(transaction.id)}
                                disabled={deletingId !== null}
                              >
                                {deletingId === transaction.id ? "Deleting…" : "Yes"}
                              </button>
                              <button
                                className="cancel-transaction-btn"
                                type="button"
                                onClick={cancelDelete}
                                disabled={deletingId !== null}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                className="edit-transaction-btn"
                                type="button"
                                onClick={() => startEditing(transaction)}
                              >
                                Edit
                              </button>

                              <button
                                className="delete-transaction-btn"
                                type="button"
                                onClick={() => requestDelete(transaction)}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Transactions;
