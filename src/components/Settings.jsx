import { useState } from "react";
import "./Settings.css";
import { API_BASE } from "../apiConfig";

function Settings({ user, onProfileUpdated, onLogout }) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const trimmedName = name.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (trimmedName.length < 2 || trimmedName.length > 60) {
      setError("Enter a name between 2 and 60 characters.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: trimmedName, email: normalizedEmail }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event("spendwise:session-expired"));
        }
        throw new Error(data.message || "Could not update your profile.");
      }

      onProfileUpdated(data.user);
      setSuccess("Your account details have been saved.");
    } catch (saveError) {
      setError(
        saveError instanceof TypeError
          ? "Can't connect to the SpendWise server. Check that the backend is running, then try again."
          : saveError.message || "Could not update your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword.length < 8 || newPassword.length > 128) {
      setPasswordError("New password must be 8–128 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch(`${API_BASE}/auth/password`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event("spendwise:session-expired"));
        }
        throw new Error(data.message || "Could not update your password.");
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess(data.message || "Password updated successfully.");
    } catch (passwordSaveError) {
      setPasswordError(
        passwordSaveError instanceof TypeError
          ? "Can't connect to the SpendWise server. Check that the backend is running, then try again."
          : passwordSaveError.message || "Could not update your password."
      );
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <section className="settings-page">
      <header className="settings-header">
        <div>
          <span className="settings-eyebrow">YOUR ACCOUNT</span>
          <h1>Settings</h1>
          <p>Manage the profile details connected to your SpendWise account.</p>
        </div>
        <div className="settings-avatar" aria-hidden="true">
          {(user?.name || "U").charAt(0).toUpperCase()}
        </div>
      </header>

      <div className="settings-grid">
        <form className="settings-card settings-profile" onSubmit={saveProfile}>
          <div className="settings-card-heading">
            <div className="settings-card-icon" aria-hidden="true">👤</div>
            <div>
              <h2>Profile details</h2>
              <p>These details identify your account in SpendWise.</p>
            </div>
          </div>

          <label htmlFor="settings-name">Name</label>
          <input
            id="settings-name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            minLength={2}
            maxLength={60}
            autoComplete="name"
            required
          />

          <label htmlFor="settings-email">Email address</label>
          <input
            id="settings-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
            autoComplete="email"
            required
          />

          {error && <p className="settings-message settings-error" role="alert">{error}</p>}
          {success && <p className="settings-message settings-success" role="status">{success}</p>}

          <button className="settings-save" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <div className="settings-card settings-security">
          <div className="settings-card-heading">
            <div className="settings-card-icon" aria-hidden="true">🔒</div>
            <div>
              <h2>Account security</h2>
              <p>Your account is protected by your sign-in session.</p>
            </div>
          </div>

          <div className="settings-security-note">
            <span aria-hidden="true">✓</span>
            <p>Your financial records are linked to your account.</p>
          </div>

          <form className="settings-password-form" onSubmit={changePassword}>
            <h3>Change password</h3>
            <label htmlFor="settings-current-password">Current password</label>
            <input
              id="settings-current-password"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              maxLength={128}
              required
            />
            <label htmlFor="settings-new-password">New password</label>
            <input
              id="settings-new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              required
            />
            <label htmlFor="settings-confirm-password">Confirm new password</label>
            <input
              id="settings-confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              minLength={8}
              maxLength={128}
              required
            />
            {passwordError && <p className="settings-message settings-error" role="alert">{passwordError}</p>}
            {passwordSuccess && <p className="settings-message settings-success" role="status">{passwordSuccess}</p>}
            <button className="settings-save" type="submit" disabled={savingPassword}>
              {savingPassword ? "Updating…" : "Update password"}
            </button>
          </form>

          <button className="settings-logout" type="button" onClick={onLogout}>
            Log out of SpendWise
          </button>
        </div>
      </div>
    </section>
  );
}

export default Settings;
