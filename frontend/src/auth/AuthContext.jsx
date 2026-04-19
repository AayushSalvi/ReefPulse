/**
 * Session: JWT in sessionStorage + profile from GET /auth/me.
 * Login/register hydrate the user in the same turn so navigation does not flash "logged out".
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { getApiBase } from "../lib/apiBase";

const TOKEN_KEY = "reefpulse_access_token";

const AuthContext = createContext(null);

async function readApiError(res) {
  let body = {};
  try {
    body = await res.json();
  } catch {
    return res.statusText;
  }
  const d = body.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    return d
      .map((e) => (typeof e === "object" && e !== null ? e.msg || JSON.stringify(e) : String(e)))
      .join("; ");
  }
  return res.statusText;
}

export function AuthProvider({ children }) {
  const base = getApiBase();
  const [token, setTokenState] = useState(() => sessionStorage.getItem(TOKEN_KEY) || null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => !!sessionStorage.getItem(TOKEN_KEY));

  const setToken = useCallback((t) => {
    if (t) sessionStorage.setItem(TOKEN_KEY, t);
    else sessionStorage.removeItem(TOKEN_KEY);
    setTokenState(t || null);
  }, []);

  const loadProfile = useCallback(
    async (accessToken) => {
      const res = await fetch(`${base}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      if (!res.ok) {
        const msg = await readApiError(res);
        throw new Error(msg);
      }
      setUser(await res.json());
    },
    [base]
  );

  /** Sync user from sessionStorage token (e.g. app load or after external token change). */
  const refreshUser = useCallback(async () => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    if (!t) {
      setUser(null);
      setTokenState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await loadProfile(t);
    } catch {
      sessionStorage.removeItem(TOKEN_KEY);
      setTokenState(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [loadProfile]);

  useEffect(() => {
    void refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email, password) => {
      let res;
      try {
        res = await fetch(`${base}/api/v1/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
      } catch (e) {
        if (e instanceof TypeError) {
          throw new Error("Could not reach the API. Start the backend (e.g. uvicorn) and use the Vite dev server so /api is proxied.");
        }
        throw e;
      }
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      const access = data.access_token;
      sessionStorage.setItem(TOKEN_KEY, access);
      setTokenState(access);
      setLoading(true);
      try {
        await loadProfile(access);
      } catch (e) {
        sessionStorage.removeItem(TOKEN_KEY);
        setTokenState(null);
        setUser(null);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [base, loadProfile]
  );

  const register = useCallback(
    async (email, password, handle) => {
      let res;
      try {
        res = await fetch(`${base}/api/v1/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, handle: handle || null })
        });
      } catch (e) {
        if (e instanceof TypeError) {
          throw new Error("Could not reach the API. Start the backend and use the Vite dev server so /api is proxied.");
        }
        throw e;
      }
      if (!res.ok) throw new Error(await readApiError(res));
      const data = await res.json();
      const access = data.access_token;
      sessionStorage.setItem(TOKEN_KEY, access);
      setTokenState(access);
      setLoading(true);
      try {
        await loadProfile(access);
      } catch (e) {
        sessionStorage.removeItem(TOKEN_KEY);
        setTokenState(null);
        setUser(null);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [base, loadProfile]
  );

  const logout = useCallback(async () => {
    const t = sessionStorage.getItem(TOKEN_KEY);
    try {
      await fetch(`${base}/api/v1/auth/logout`, {
        method: "POST",
        headers: t ? { Authorization: `Bearer ${t}` } : {}
      });
    } catch {
      /* ignore */
    }
    sessionStorage.removeItem(TOKEN_KEY);
    setTokenState(null);
    setUser(null);
    setLoading(false);
  }, [base]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      refreshUser,
      apiBase: base
    }),
    [user, token, loading, login, register, logout, refreshUser, base]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
