/**
 * ReefPulse — Explore feature layout (location workspace shell)
 *
 * Routes: `/explore` (index) and `/explore/:locationId` (detail). This component is the parent `<Route>`.
 * Styles: `./workflow.css` (shared inner-page chrome), `./explore-app.css` (grid + sidebar).
 *
 * Layout:
 *   - Left: sidebar — search, saved, nearby (when a beach is open), activity + safety filters, results list
 *   - Right: `<Outlet />` — either `ExploreIndexPage` or `ExploreLocationPage`
 *
 * URL sync: optional `?q=` on `/explore` seeds the sidebar search (e.g. shared links).
 */
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import {
  filterLocationsByActivities,
  findLocation,
  locations,
  nearbyLocations,
  savedPlaces
} from "../../data/mockData";
import "./workflow.css";
import "./explore-app.css";

const ACTIVITIES = [
  { id: "snorkeling", label: "Snorkeling" },
  { id: "swimming", label: "Swimming" },
  { id: "surfing", label: "Surfing" },
  { id: "fishing", label: "Fishing" }
];

function ExploreLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const match = pathname.match(/^\/explore\/([^/]+)$/);
  const locationId = match ? match[1] : null;
  const loc = locationId ? findLocation(locationId) : null;
  const tab = loc ? sp.get("tab") || "overview" : null;

  const qFromUrl = sp.get("q") || "";
  const [query, setQuery] = useState(qFromUrl);
  const [safeOnly, setSafeOnly] = useState(false);
  const [lowSurf, setLowSurf] = useState(false);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    if (qFromUrl) setQuery(qFromUrl);
  }, [qFromUrl]);

  const toggleActivity = (id) => {
    setActivities((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  };

  const filtered = useMemo(() => {
    let list = locations;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.region.toLowerCase().includes(q) ||
          l.id.replace(/-/g, " ").includes(q)
      );
    }
    list = filterLocationsByActivities(list, activities);
    if (safeOnly) list = list.filter((l) => l.safetyIndex >= 85);
    if (lowSurf) list = list.filter((l) => l.waveFt < 3.5);
    return list;
  }, [query, safeOnly, lowSurf, activities]);

  const neighbors = locationId ? nearbyLocations(locationId, 5) : [];
  const saved = savedPlaces();
  const tabLabel = tab && tab !== "overview" ? tab.charAt(0).toUpperCase() + tab.slice(1) : null;

  return (
    <div className="wf-page ex-app">
      <nav className="rp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <Link to="/explore">Explore locations</Link>
        {loc && (
          <>
            <span className="rp-breadcrumb-sep">/</span>
            <span aria-current="page">
              {loc.name}
              {tabLabel ? ` · ${tabLabel}` : ""}
            </span>
          </>
        )}
        {!loc && (
          <>
            <span className="rp-breadcrumb-sep">/</span>
            <span aria-current="page">Map</span>
          </>
        )}
      </nav>

      <div className="rp-page-title">
        <h1>{loc ? loc.name : "Explore locations"}</h1>
        <p>
          {loc
            ? `Overview, past, forecast, and community for this beach — your main planning surface.`
            : "Search beaches, coves, and reefs; filter by activity; open a place for tabs and local posts."}
        </p>
      </div>

      <div className="ex-grid">
        {/* —— Sidebar: discovery + filters (persistent while browsing Explore) —— */}
        <aside className="ex-sidebar" aria-label="Search and filters">
          <h2>Explore locations</h2>
          <p className="ex-sidebar-lead">Enter a beach, cove, reef, or coastal area, then refine with filters.</p>

          {/* Sidebar block: text search */}
          <div className="ex-label">Search</div>
          <input
            className="ex-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Beach, cove, reef, coastal area…"
            aria-label="Search beaches and coastal areas"
          />

          {/* Sidebar block: saved + nearby shortcuts */}
          <div className="ex-label">Saved places</div>
          <ul className="ex-mini-list">
            {saved.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => navigate(`/explore/${s.id}`)}>
                  {s.name}
                </button>
              </li>
            ))}
          </ul>

          {loc && (
            <>
              <div className="ex-label">Nearby</div>
              <ul className="ex-mini-list">
                {neighbors.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => navigate(`/explore/${n.id}`)}>
                      {n.name}
                      <span className="ex-mini-meta">~{n.distanceKm.toFixed(1)} km</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Sidebar block: activity + extra filters */}
          <div className="ex-label">Activity filter</div>
          <div className="ex-filters ex-filters--grid">
            {ACTIVITIES.map((a) => (
              <label key={a.id}>
                <input
                  type="checkbox"
                  checked={activities.includes(a.id)}
                  onChange={() => toggleActivity(a.id)}
                />
                {a.label}
              </label>
            ))}
          </div>

          <div className="ex-label">More filters</div>
          <div className="ex-filters">
            <label>
              <input type="checkbox" checked={safeOnly} onChange={(e) => setSafeOnly(e.target.checked)} />
              Safe beaches (index ≥ 85)
            </label>
            <label>
              <input type="checkbox" checked={lowSurf} onChange={(e) => setLowSurf(e.target.checked)} />
              Low surf (&lt; 3.5 ft)
            </label>
          </div>

          {/* Sidebar block: filtered beach list → navigates to detail route */}
          <div className="ex-label">Results</div>
          <ul className="ex-beach-list">
            {filtered.map((beach) => (
              <li key={beach.id}>
                <button
                  type="button"
                  onClick={() => {
                    navigate(`/explore/${beach.id}`);
                    setQuery("");
                  }}
                >
                  <strong>{beach.name}</strong>
                  <span style={{ display: "block", fontSize: "0.72rem", opacity: 0.75 }}>
                    {beach.region} · {beach.safetyIndex}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="ex-sidebar-foot">
            <Link to="/community">Community</Link>
            <Link to="/marine-life">Marine life</Link>
            <Link to="/dashboard">Dashboard</Link>
          </div>
        </aside>

        {/* —— Main: child route (index map / location tabs) —— */}
        <div className="ex-outlet">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default ExploreLayout;
