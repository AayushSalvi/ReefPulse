/**
 * Route: `/register`
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import "./auth.css";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [handle, setHandle] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(email.trim(), password, handle.trim() || null);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>Create account</h1>
        <p className="sub">
          At least 8 characters; passwords may not exceed 72 bytes when encoded as UTF-8 (bcrypt limit).
        </p>
        {error ? <div className="auth-error">{error}</div> : null}
        <form className="auth-form" onSubmit={onSubmit}>
          <label htmlFor="reg-email">Email</label>
          <input
            id="reg-email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="reg-handle">Display name (optional)</label>
          <input
            id="reg-handle"
            name="handle"
            type="text"
            autoComplete="nickname"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            maxLength={128}
          />
          <label htmlFor="reg-password">Password</label>
          <input
            id="reg-password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            maxLength={72}
            required
          />
          <div className="auth-actions">
            <button className="auth-btn auth-btn--primary" type="submit" disabled={busy}>
              {busy ? "Creating…" : "Register"}
            </button>
            <Link className="auth-btn auth-btn--ghost" to="/login">
              Already have an account
            </Link>
            <Link className="auth-btn auth-btn--ghost" to="/">
              Back to app
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
