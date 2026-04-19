/**
 * Standalone operator / forecast UI — NOT mounted in `src/App.jsx`.
 * Keep for future routes (e.g. `/admin/forecast`). Co-located: `./monitor.css`.
 */
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import "./monitor.css";

function IconWave() {
  return (
    <svg className="ops-org-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M2 12c2-2 4-2 6 0s4 2 6 0 4-2 6 0M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconDoc() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
    </svg>
  );
}

function IconWarning() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  );
}

function IconTempWave() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z" />
    </svg>
  );
}

function IconSensor() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M9 9h.01M15 9h.01M9 15h.01M15 15h.01" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconLifebuoy() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="4" />
      <path d="M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M14.83 9.17l4.24-4.24M9.17 14.83l-4.24 4.24" />
    </svg>
  );
}

function IconMapPin() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function IconActivity() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function IconFish() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6.5 12c.94-2 3.08-3 5.5-3 2.42 0 4.56 1 5.5 3-1.44 2.5-4 4-5.5 4-1.5 0-4.06-1.5-5.5-4z" />
      <path d="M18 12h.5M2 12h2M12 2v2" />
    </svg>
  );
}

function IconSliders() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M9 8h6M15 16h6M7 12h8" />
    </svg>
  );
}

const recentFeed = [
  { dot: "ops-feed-dot--pink", text: "North Sector XII-A Restricted" },
  { dot: "ops-feed-dot--yellow", text: "Outer Barrier Clear for Diving" },
  { dot: "ops-feed-dot--blue", text: "Station Reef-02 Offline" }
];

function ForecastAlertsPage() {
  const [healthStatus, setHealthStatus] = useState("caution");

  return (
    <div className="ops">
      <header className="ops-topnav">
        <Link to="/" className="ops-logo">
          ReefPulse
        </Link>
        <nav className="ops-toplinks" aria-label="Primary">
          <NavLink to="/explore" className={({ isActive }) => (isActive ? "is-active" : "")}>
            Explore
          </NavLink>
          <NavLink to="/forecast-alerts" className={({ isActive }) => (isActive ? "is-active" : "")}>
            Monitoring
          </NavLink>
          <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "is-active" : "")}>
            Dashboard
          </NavLink>
          <a href="#ops-resources">Resources</a>
        </nav>
        <div className="ops-topactions">
          <button type="button" className="ops-btn-emergency">
            Emergency Alert
          </button>
          <button type="button" className="ops-icon-btn" aria-label="Notifications">
            <IconBell />
          </button>
          <button type="button" className="ops-icon-btn" aria-label="Account">
            <IconUser />
          </button>
        </div>
      </header>

      <div className="ops-body">
        <aside className="ops-sidebar" aria-label="Operator navigation">
          <div className="ops-org">
            <IconWave />
            <div>
              <p className="ops-org-title">Organization</p>
              <p className="ops-org-name">Ocean Command — Pacific Sector VII</p>
            </div>
          </div>

          <nav className="ops-side-nav">
            <NavLink end to="/explore" className={({ isActive }) => `ops-side-link ${isActive ? "is-active" : ""}`}>
              <IconMapPin aria-hidden />
              Map Explorer
            </NavLink>
            <NavLink
              to="/forecast-alerts"
              className={({ isActive }) => `ops-side-link ${isActive ? "is-active" : ""}`}
            >
              <IconActivity aria-hidden />
              Regional Health
            </NavLink>
            <a href="#alert-logs" className="ops-side-link">
              <IconBell aria-hidden />
              Alert Logs
            </a>
            <NavLink
              to="/marine-life"
              className={({ isActive }) => `ops-side-link ${isActive ? "is-active" : ""}`}
            >
              <IconFish aria-hidden />
              Species Tracking
            </NavLink>
            <NavLink
              to="/manager/safety-notice"
              className={({ isActive }) => `ops-side-link ${isActive ? "is-active" : ""}`}
            >
              <IconSliders aria-hidden />
              System Config
            </NavLink>
          </nav>

          <div className="ops-sidebar-spacer" />
          <Link to="/manager/safety-notice" className="ops-btn-report">
            New Safety Report
          </Link>
          <div className="ops-side-footer" id="ops-resources">
            <a href="#settings">
              <IconSettings aria-hidden />
              Settings
            </a>
            <a href="#support">
              <IconLifebuoy aria-hidden />
              Support
            </a>
          </div>
        </aside>

        <div className="ops-main">
          <header className="ops-main-head">
            <p className="ops-kicker">OPERATIONAL DASHBOARD</p>
            <h1 className="ops-title">Regional Health Overview</h1>
            <div className="ops-toolbar">
              <button type="button" className="ops-btn-live">
                <span className="ops-live-dot" aria-hidden />
                Live Network Stream
              </button>
              <label htmlFor="ops-filter" className="visually-hidden">
                Search or filter
              </label>
              <input
                id="ops-filter"
                className="ops-search"
                type="search"
                placeholder="Search sectors, nodes, or alerts…"
              />
            </div>
          </header>

          <div className="ops-stats">
            <article className="ops-stat ops-stat--risk">
              <div className="ops-stat-top">
                <span className="ops-stat-label">High risks</span>
                <IconWarning aria-hidden />
              </div>
              <div className="ops-stat-value">2 HAB Alerts</div>
              <p className="ops-stat-sub">Critical monitoring active</p>
            </article>
            <article className="ops-stat ops-stat--closure">
              <div className="ops-stat-top">
                <span className="ops-stat-label">Active closures</span>
                <IconCheck aria-hidden />
              </div>
              <div className="ops-stat-value">1 Zone XII-B</div>
              <p className="ops-stat-sub">Operator on-site</p>
            </article>
            <article className="ops-stat ops-stat--temp">
              <div className="ops-stat-top">
                <span className="ops-stat-label">Avg. reef temp</span>
                <IconTempWave aria-hidden />
              </div>
              <div className="ops-stat-value">24.8°C</div>
              <p className="ops-stat-sub">+0.4% from seasonal norm</p>
            </article>
            <article className="ops-stat ops-stat--network">
              <div className="ops-stat-top">
                <span className="ops-stat-label">Network health</span>
                <IconSensor aria-hidden />
              </div>
              <div className="ops-stat-value">98.2%</div>
              <p className="ops-stat-sub">142 active nodes</p>
            </article>
          </div>

          <div className="ops-map-wrap" aria-label="Regional map preview">
            <div className="ops-map-bg" />
            <div className="ops-map-overlay" />
            <div className="ops-map-layers">
              <strong>Regional Layers</strong>
              <label className="ops-layer-row">
                <input type="checkbox" defaultChecked />
                Chlorophyll-a
              </label>
              <label className="ops-layer-row">
                <input type="checkbox" defaultChecked />
                SST anomalies
              </label>
              <label className="ops-layer-row">
                <input type="checkbox" />
                Node topology
              </label>
            </div>
            <div className="ops-map-marker">
              <div className="ops-map-pulse" />
              <div className="ops-map-tooltip">Closure</div>
            </div>
            <div className="ops-map-zoom">
              <button type="button" aria-label="Zoom in">
                +
              </button>
              <button type="button" aria-label="Zoom out">
                −
              </button>
              <button type="button" aria-label="Re-center map">
                ⟲
              </button>
            </div>
          </div>
        </div>

        <aside className="ops-right" aria-label="Publish and feed">
          <div className="ops-card">
            <div className="ops-card-head">
              <IconDoc aria-hidden />
              Publish Status Update
            </div>
            <div className="ops-field">
              <label htmlFor="ops-jurisdiction">Affected location</label>
              <select id="ops-jurisdiction" defaultValue="">
                <option value="" disabled>
                  Select jurisdiction…
                </option>
                <option value="xii-a">North Sector XII-A</option>
                <option value="xii-b">Zone XII-B</option>
                <option value="outer">Outer Barrier</option>
              </select>
            </div>
            <div className="ops-field">
              <span className="ops-field-label" id="ops-status-label">
                Target health status
              </span>
              <div
                className="ops-status-group"
                role="group"
                aria-labelledby="ops-status-label"
              >
                <button
                  type="button"
                  className={`ops-status-btn ops-status-btn--safe ${healthStatus === "safe" ? "is-on" : ""}`}
                  onClick={() => setHealthStatus("safe")}
                >
                  ✓
                  <span>Safe</span>
                </button>
                <button
                  type="button"
                  className={`ops-status-btn ops-status-btn--caution ${healthStatus === "caution" ? "is-on" : ""}`}
                  onClick={() => setHealthStatus("caution")}
                >
                  ▲
                  <span>Caution</span>
                </button>
                <button
                  type="button"
                  className={`ops-status-btn ops-status-btn--closed ${healthStatus === "closed" ? "is-on" : ""}`}
                  onClick={() => setHealthStatus("closed")}
                >
                  ⊘
                  <span>Closed</span>
                </button>
              </div>
            </div>
            <div className="ops-field">
              <label htmlFor="ops-notes">Operational notes</label>
              <textarea
                id="ops-notes"
                placeholder="Briefly describe the reason for this status change…"
                defaultValue=""
              />
            </div>
            <button type="button" className="ops-btn-broadcast">
              Broadcast update
            </button>
          </div>

          <div className="ops-card" id="alert-logs">
            <div className="ops-feed-head">
              <strong>RECENT UPDATES</strong>
              <a href="#alert-logs">View all</a>
            </div>
            <ul className="ops-feed-list">
              {recentFeed.map((item) => (
                <li key={item.text} className="ops-feed-item">
                  <span className={`ops-feed-dot ${item.dot}`} aria-hidden />
                  {item.text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ForecastAlertsPage;
