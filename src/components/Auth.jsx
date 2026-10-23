
import { useState } from "react";
import { API_BASE } from "../apiConfig";

function Auth({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isLogin ? "login" : "signup";

      const response = await fetch(
        `${API_BASE}/auth/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({
            ...(isLogin ? {} : { name }),
            email: email.trim(),
            password,
          }),
        }
      );

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong.");
      }

      onAuthSuccess(data);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Can't connect to the SpendWise server. Check that the backend is running, then try again."
          : err.message || "Unable to sign in right now. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">S</div>

        <h1>SpendWise AI</h1>
        <p className="auth-subtitle">
          {isLogin
            ? "Welcome back! Sign in to manage your money."
            : "Create your account and start managing your money."}
        </p>

        <div className="auth-tabs">
          <button
            type="button"
            className={isLogin ? "auth-tab active" : "auth-tab"}
            onClick={() => {
              setIsLogin(true);
              setError("");
              setPassword("");
              setShowPassword(false);
            }}
            disabled={loading}
            aria-pressed={isLogin}
          >
            Login
          </button>

          <button
            type="button"
            className={!isLogin ? "auth-tab active" : "auth-tab"}
            onClick={() => {
              setIsLogin(false);
              setError("");
              setPassword("");
              setShowPassword(false);
            }}
            disabled={loading}
            aria-pressed={!isLogin}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {!isLogin && (
            <div className="auth-field">
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                type="text"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                maxLength={60}
                autoComplete="name"
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
                maxLength={254}
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="auth-password">Password</label>
            <div className="auth-password-control">
              <input
                id="auth-password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                autoComplete={isLogin ? "current-password" : "new-password"}
                required
              />
              <button
                className="auth-password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                disabled={loading}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && <p className="auth-error" role="alert">{error}</p>}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isLogin
                ? "Login to SpendWise"
                : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "New to SpendWise? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError("");
              setPassword("");
            }}
            disabled={loading}
          >
            {isLogin ? "Sign up" : "Login"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default Auth;
