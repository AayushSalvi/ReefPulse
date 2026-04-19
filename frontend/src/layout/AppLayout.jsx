/**
 * ReefPulse — application shell (persistent chrome)
 *
 * Single-row header: brand → main nav → icon shortcut (Dashboard).
 * `/dashboard` via the user icon on the right.
 */
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

/** Main nav items (beach-first IA). */
const navItems = [
  { to: "/explore", label: "Explore location", end: false },
  { to: "/marine-life", label: "Marine life", end: true },
  { to: "/assistant", label: "Assistant", end: true },
  { to: "/challenges", label: "Challenges", end: true },
  { to: "/community", label: "Community", end: true }
];

function IconSun() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function AppLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const isHome = pathname === "/";
  const fullBleed = isHome;

  return (
    <div className="app-shell">
      <header className="top-nav">
        <NavLink to="/" className="top-nav-brand" end>
          ReefPulse
        </NavLink>

        <nav className="top-nav-links" aria-label="Main">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `top-nav-link ${isActive ? "is-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="top-nav-tools">
          <NavLink
            to="/dashboard"
            className={({ isActive }) => `top-nav-icon ${isActive ? "is-active" : ""}`}
            title="Dashboard"
            aria-label="Dashboard"
            end
          >
            <IconSun />
            <span className="visually-hidden">Dashboard</span>
          </NavLink>
          {loading ? (
            <span className="top-nav-user" aria-live="polite">
              …
            </span>
          ) : user ? (
            <>
              <span className="top-nav-user" title={user.email || user.id}>
                {user.handle}
              </span>
              <button
                type="button"
                className="top-nav-link"
                onClick={async () => {
                  await logout();
                  navigate("/", { replace: true });
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <NavLink to="/login" className="top-nav-link" state={{ from: { pathname } }}>
              Log in
            </NavLink>
          )}
        </div>
      </header>

      <main className={fullBleed ? "page-content page-content--bleed" : "page-content page-content--app"}>
        <div key={pathname} className="rp-route-outlet">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AppLayout;
