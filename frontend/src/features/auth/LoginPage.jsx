/**
 * Route: `/login`
 */
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "./auth.css";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || "/";

  const [email, setEmail] = useState("demo@reefpulse.dev");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Sign in</h1>
        <p className="sub">Use your ReefPulse account. New here? Create one first.</p>
        {error ? <div className="auth-error">{error}</div> : null}
        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <div className="auth-actions">
            <button className="auth-btn auth-btn--primary" type="submit" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <Link className="auth-btn auth-btn--ghost" to="/register">
              Create an account
            </Link>
            <Link className="auth-btn auth-btn--ghost" to="/">
              Back to app
            </Link>
          </div>
        </form>
        <div className="auth-hint">
          <strong>Dev demo:</strong> email <code>demo@reefpulse.dev</code> — password <code>demo123</code> (seeded with
          the database).
        </div>
      </div>
    </div>
  );
}
