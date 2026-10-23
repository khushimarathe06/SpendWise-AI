import { useState } from "react";
import { API_BASE } from "../apiConfig";

function SavingsGoals({
  goals: savedGoals = [],
  goalsLoading: loading = false,
  goalsLoadError = "",
  onGoalsChange = () => {},
}) {
  const goals = savedGoals;
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [saving, setSaving] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editTarget, setEditTarget] = useState("");

  // Inline Add Savings state
  const [addingSavingsId, setAddingSavingsId] = useState(null);
  const [savingsAmount, setSavingsAmount] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Inline delete confirmation — replaces window.confirm()
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);


  // Format amounts in Indian Rupees.
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);

  // Common authenticated API request.
  const apiRequest = async (path, options = {}) => {
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, {
        ...options,
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...options.headers,
        },
      });
    } catch (requestError) {
      if (requestError instanceof TypeError) {
        throw new Error(
          "Can't connect to the SpendWise server. Check that the backend is running, then try again."
        );
      }
      throw requestError;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (response.status === 401) {
        window.dispatchEvent(new Event("spendwise:session-expired"));
      }
      throw new Error(data.message || "Something went wrong.");
    }

    return data;
  };

  // Create a new savings goal.
  const addGoal = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = goalName.trim();
    const target = Number(targetAmount);

    if (!name || name.length > 100) {
      setError("Goal name must contain between 1 and 100 characters.");
      return;
    }

    if (!Number.isFinite(target) || target <= 0) {
      setError("Target amount must be greater than zero.");
      return;
    }

    setSaving(true);

    try {
      const data = await apiRequest("/savings-goals", {
        method: "POST",
        body: JSON.stringify({ name, target }),
      });

      if (!data.goal) throw new Error("The server did not return the new savings goal.");
      onGoalsChange((previous) => [data.goal, ...previous]);

      setGoalName("");
      setTargetAmount("");
      setSuccess("Savings goal created successfully.");
    } catch (err) {
      setError(err.message || "Could not create your savings goal.");
    } finally {
      setSaving(false);
    }
  };

  // Start editing a goal.
  const startEditing = (goal) => {
    setEditingId(goal.id);
    setEditName(goal.name);
    setEditTarget(String(goal.target));

    setAddingSavingsId(null);
    setSavingsAmount("");

    setError("");
    setSuccess("");
  };

  // Cancel editing.
  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditTarget("");
    setError("");
  };

  // Save edited goal details to MongoDB.
  const saveEdit = async (event, goal) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = editName.trim();
    const target = Number(editTarget);

    if (!name || name.length > 100) {
      setError("Goal name must contain between 1 and 100 characters.");
      return;
    }

    if (!Number.isFinite(target) || target <= 0) {
      setError("Target amount must be greater than zero.");
      return;
    }

    if (target < Number(goal.saved)) {
      setError("Target cannot be less than the amount already saved.");
      return;
    }

    setSaving(true);

    try {
      const data = await apiRequest(`/savings-goals/${goal.id}`, {
        method: "PUT",
        body: JSON.stringify({ name, target }),
      });

      if (!data.goal) throw new Error("The server did not return the updated savings goal.");
      onGoalsChange((previous) =>
        previous.map((item) =>
          item.id === goal.id ? { ...item, ...data.goal } : item
        )
      );

      setEditingId(null);
      setEditName("");
      setEditTarget("");
      setSuccess("Savings goal updated successfully.");
    } catch (err) {
      setError(err.message || "Could not update your savings goal.");
    } finally {
      setSaving(false);
    }
  };

  // Open the inline Add Savings form.
  const startAddingSavings = (goal) => {
    setAddingSavingsId(goal.id);
    setSavingsAmount("");

    setEditingId(null);
    setEditName("");
    setEditTarget("");

    setError("");
    setSuccess("");
  };

  // Cancel adding savings.
  const cancelAddingSavings = () => {
    setAddingSavingsId(null);
    setSavingsAmount("");
    setError("");
  };

  // Add savings and save the updated amount to MongoDB.
  const addSavings = async (event, goal) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const amount = Number(savingsAmount);
    const remaining = Number(goal.target) - Number(goal.saved);

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    if (amount > remaining) {
      setError(
        `You can add up to ${formatCurrency(remaining)} to reach this goal.`
      );
      return;
    }

    setSaving(true);

    try {
      const data = await apiRequest(
        `/savings-goals/${goal.id}/savings`,
        {
          method: "PATCH",
          body: JSON.stringify({ amount }),
        }
      );

      if (!data.goal) throw new Error("The server did not return the updated savings goal.");
      onGoalsChange((previous) =>
        previous.map((item) =>
          item.id === goal.id ? { ...item, ...data.goal } : item
        )
      );

      setAddingSavingsId(null);
      setSavingsAmount("");
      setSuccess("Savings added successfully.");
    } catch (err) {
      setError(err.message || "Could not add savings.");
    } finally {
      setSaving(false);
    }
  };

  // Delete a goal — uses inline confirmation instead of window.confirm().
  const requestDeleteGoal = (id) => {
    setPendingDeleteId(id);
    setError("");
    setSuccess("");
  };

  const confirmDeleteGoal = async (id) => {
    if (deletingId !== null) return;
    setError("");
    setSuccess("");
    setDeletingId(id);

    try {
      await apiRequest(`/savings-goals/${id}`, {
        method: "DELETE",
      });

      onGoalsChange((previous) =>
        previous.filter((goal) => goal.id !== id)
      );
      setPendingDeleteId(null);

      if (editingId === id) {
        setEditingId(null);
        setEditName("");
        setEditTarget("");
      }

      if (addingSavingsId === id) {
        setAddingSavingsId(null);
        setSavingsAmount("");
      }

      setSuccess("Savings goal deleted successfully.");
    } catch (err) {
      setError(err.message || "Could not delete your savings goal.");
    } finally {
      setDeletingId(null);
    }
  };

  const cancelDeleteGoal = () => {
    if (deletingId !== null) return;
    setPendingDeleteId(null);
  };


  // Calculate summary values.
  const totalSaved = goals.reduce(
    (sum, goal) => sum + Number(goal.saved || 0),
    0
  );

  const totalTarget = goals.reduce(
    (sum, goal) => sum + Number(goal.target || 0),
    0
  );

  const activeGoals = goals.filter(
    (goal) => Number(goal.saved || 0) < Number(goal.target || 0)
  ).length;

  return (
    <div className="savings-page">
      <header className="savings-header">
        <h1>Savings Goals</h1>
        <p>Set goals, track your progress, and build better saving habits.</p>
      </header>

      {error && (
        <div className="savings-message savings-error" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="savings-message savings-success" role="status">
          {success}
        </div>
      )}

      {/* Summary cards */}
      <section className="savings-summary">
        <div className="savings-summary-card">
          <span>Total Savings</span>
          <h2>{formatCurrency(totalSaved)}</h2>
        </div>

        <div className="savings-summary-card">
          <span>Total Target</span>
          <h2>{formatCurrency(totalTarget)}</h2>
        </div>

        <div className="savings-summary-card">
          <span>Active Goals</span>
          <h2>{activeGoals}</h2>
        </div>
      </section>

      {/* Create a goal */}
      <section className="savings-form-card">
        <h2>Create a Savings Goal</h2>

        <form className="savings-form" onSubmit={addGoal}>
          <input
            type="text"
            placeholder="Goal name"
            value={goalName}
            onChange={(event) => setGoalName(event.target.value)}
            maxLength={100}
            required
          />

          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="Target amount (₹)"
            value={targetAmount}
            onChange={(event) => setTargetAmount(event.target.value)}
            required
          />

          <button type="submit" disabled={saving}>
            {saving ? "Creating..." : "+ Create Goal"}
          </button>
        </form>
      </section>

      {/* Savings goals */}
      <section className="savings-goals-section">
        <h2>Your Goals</h2>

        {loading ? (
          <p>Loading your savings goals...</p>
        ) : goalsLoadError ? (
          <p role="alert">Couldn't load your savings goals: {goalsLoadError}</p>
        ) : goals.length === 0 ? (
          <p>No goals yet. Create your first savings goal!</p>
        ) : (
          <div className="savings-goals-grid">
            {goals.map((goal) => {
              const saved = Number(goal.saved || 0);
              const target = Number(goal.target || 0);

              const percentage =
                target > 0
                  ? Math.min((saved / target) * 100, 100)
                  : 0;

              const remaining = Math.max(target - saved, 0);
              const isEditing = editingId === goal.id;
              const isAddingSavings = addingSavingsId === goal.id;

              return (
                <article className="savings-goal-card" key={goal.id}>
                  {/* Inline edit form */}
                  {isEditing ? (
                    <form
                      className="savings-edit-form"
                      onSubmit={(event) => saveEdit(event, goal)}
                    >
                      <h3>Edit Savings Goal</h3>

                      <label htmlFor={`edit-name-${goal.id}`}>
                        Goal name
                      </label>

                      <input
                        id={`edit-name-${goal.id}`}
                        type="text"
                        value={editName}
                        onChange={(event) =>
                          setEditName(event.target.value)
                        }
                        maxLength={100}
                        required
                      />

                      <label htmlFor={`edit-target-${goal.id}`}>
                        Target amount (₹)
                      </label>

                      <input
                        id={`edit-target-${goal.id}`}
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editTarget}
                        onChange={(event) =>
                          setEditTarget(event.target.value)
                        }
                        required
                      />

                      <div className="savings-edit-actions">
                        <button type="submit" disabled={saving}>
                          {saving ? "Saving..." : "Save Changes"}
                        </button>

                        <button
                          type="button"
                          onClick={cancelEditing}
                          disabled={saving}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      {/* Goal heading */}
                      <div className="savings-goal-heading">
                        <h3>{goal.name}</h3>

                        <div className="savings-goal-actions">
                          {pendingDeleteId === goal.id ? (
                            /* Inline delete confirmation */
                            <>
                              <span style={{ fontSize: "12px", color: "#d94848", fontWeight: 600 }}>
                                Delete?
                              </span>
                              <button
                                type="button"
                                onClick={() => confirmDeleteGoal(goal.id)}
                                disabled={deletingId !== null}
                                aria-label="Confirm delete"
                                title="Confirm delete"
                                style={{ fontSize: "12px", color: "#d94848", background: "#fff0f0", border: "1px solid #fecaca", borderRadius: "6px", padding: "4px 8px", cursor: "pointer" }}
                              >
                                {deletingId === goal.id ? "Deleting..." : "Yes"}
                              </button>
                              <button
                                type="button"
                                onClick={cancelDeleteGoal}
                                disabled={deletingId !== null}
                                aria-label="Cancel delete"
                                title="Cancel"
                                style={{ fontSize: "12px", color: "#596579", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: "6px", padding: "4px 8px", cursor: "pointer" }}
                              >
                                No
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditing(goal)}
                                aria-label={`Edit ${goal.name}`}
                                title="Edit goal"
                              >
                                ✏️
                              </button>

                              <button
                                type="button"
                                onClick={() => requestDeleteGoal(goal.id)}
                                aria-label={`Delete ${goal.name}`}
                                title="Delete goal"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Saved amount and target */}
                      <div className="savings-amounts">
                        <strong>{formatCurrency(saved)}</strong>
                        <span>of {formatCurrency(target)}</span>
                      </div>

                      {/* Progress bar */}
                      <div
                        className="savings-progress-track"
                        role="progressbar"
                        aria-label={`${goal.name} progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(percentage)}
                      >
                        <div
                          className="savings-progress-fill"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>

                      <p>{percentage.toFixed(1)}% saved</p>

                      {/* Inline Add Savings form */}
                      {saved < target ? (
                        isAddingSavings ? (
                          <form
                            className="savings-add-form"
                            onSubmit={(event) => addSavings(event, goal)}
                          >
                            <label htmlFor={`savings-amount-${goal.id}`}>
                              Amount to save (₹)
                            </label>

                            <input
                              id={`savings-amount-${goal.id}`}
                              type="number"
                              min="0.01"
                              max={remaining}
                              step="0.01"
                              placeholder="Enter amount"
                              value={savingsAmount}
                              onChange={(event) =>
                                setSavingsAmount(event.target.value)
                              }
                              required
                            />

                            <p className="savings-remaining">
                              Remaining: {formatCurrency(remaining)}
                            </p>

                            <div className="savings-edit-actions">
                              <button type="submit" disabled={saving}>
                                {saving ? "Saving..." : "Save Amount"}
                              </button>

                              <button
                                type="button"
                                onClick={cancelAddingSavings}
                                disabled={saving}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button
                            type="button"
                            className="savings-add-btn"
                            onClick={() => startAddingSavings(goal)}
                          >
                            + Add Savings
                          </button>
                        )
                      ) : (
                        <p>🎉 Goal completed!</p>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

export default SavingsGoals;
