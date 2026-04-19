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
import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchCaBeachesDatastoreSql,
  normalizeCaBeachRecord,
} from "../../api/caGovBeaches";
import {
  filterLocationsByActivities,
  findLocation,
  locations,
  nearbyLocations,
  nearestLocation,
  savedPlaces,
} from "../../data/mockData";
import { ExploreMapsApiProvider } from "./ExploreMapsApiContext";
import { EXPLORE_MAP_ZOOM_FROM_SEARCH } from "./exploreMapSearchParams";
import ExploreSidebarSearchInput from "./ExploreSidebarSearchInput";
import "./workflow.css";
import "./explore-app.css";

const ACTIVITIES = [
  { id: "snorkeling", label: "Snorkeling" },
  { id: "swimming", label: "Swimming" },
  { id: "surfing", label: "Surfing" },
  { id: "fishing", label: "Fishing" },
];

function ExploreLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const match = pathname.match(/^\/explore\/([^/]+)$/);
  const locationId = match ? match[1] : null;
  const loc = locationId ? findLocation(locationId) : null;
  const qFromUrl = sp.get("q") || "";
  const [query, setQuery] = useState(qFromUrl);
  const [safeOnly, setSafeOnly] = useState(false);
  const [lowSurf, setLowSurf] = useState(false);
  const [activities, setActivities] = useState([]);

  const [caResults, setCaResults] = useState([]);
  const [caLoading, setCaLoading] = useState(false);
  const [caError, setCaError] = useState(null);
  const caAbortRef = useRef(null);

  const hideCaLive = activities.length > 0 || safeOnly || lowSurf;

  useEffect(() => {
    if (qFromUrl) setQuery(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    const q = query.trim();
    if (hideCaLive || q.length < 1) {
      caAbortRef.current?.abort();
      setCaResults([]);
      setCaError(null);
      setCaLoading(false);
      return undefined;
    }

    setCaLoading(true);
    setCaError(null);
    const timer = window.setTimeout(async () => {
      caAbortRef.current?.abort();
      const ac = new AbortController();
      caAbortRef.current = ac;
      const out = await searchCaBeachesDatastoreSql(q, {
        limit: 30,
        signal: ac.signal,
      });
      if (ac.signal.aborted) return;
      setCaLoading(false);
      if (!out.success) {
        setCaError(out.error || "California data search failed");
        setCaResults([]);
        return;
      }
      setCaError(null);
      setCaResults(out.records.map(normalizeCaBeachRecord));
    }, 280);

    return () => {
      window.clearTimeout(timer);
      caAbortRef.current?.abort();
    };
  }, [query, hideCaLive]);

  const toggleActivity = (id) => {
    setActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  const filtered = useMemo(() => {
    let list = locations;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.region.toLowerCase().includes(q) ||
          l.id.replace(/-/g, " ").includes(q),
      );
    }
    list = filterLocationsByActivities(list, activities);
    if (safeOnly) list = list.filter((l) => l.safetyIndex >= 85);
    if (lowSurf) list = list.filter((l) => l.waveFt < 3.5);
    return list;
  }, [query, safeOnly, lowSurf, activities]);

  const typeaheadItems = useMemo(() => {
    const qTrim = query.trim();
    if (qTrim.length < 1) return [];
    const qLower = qTrim.toLowerCase();
    const items = [];

    if (!hideCaLive) {
      caResults.slice(0, 10).forEach((b) => {
        items.push({
          key: b.id,
          kind: "ca",
          title: b.name,
          subtitle: `${b.region} · ${b.meta}`,
          onPick: () => {
            const next = new URLSearchParams(sp.toString());
            next.set("mlat", b.lat.toFixed(6));
            next.set("mlng", b.lng.toFixed(6));
            next.set("mz", String(EXPLORE_MAP_ZOOM_FROM_SEARCH));
            next.set("q", b.name);
            navigate({ pathname: "/explore", search: next.toString() });
            setQuery(b.name);
          },
        });
      });
    }

    const rankMock = (b) => {
      const n = b.name.toLowerCase();
      const r = b.region.toLowerCase();
      const id = b.id.replace(/-/g, " ").toLowerCase();
      if (n.startsWith(qLower)) return 0;
      if (r.startsWith(qLower)) return 1;
      if (n.includes(qLower)) return 2;
      if (r.includes(qLower) || id.includes(qLower)) return 3;
      return 99;
    };

    filtered
      .filter((b) => rankMock(b) < 99)
      .sort((a, b) => rankMock(a) - rankMock(b) || a.name.localeCompare(b.name))
      .slice(0, 8)
      .forEach((b) => {
        items.push({
          key: b.id,
          kind: "mock",
          title: b.name,
          subtitle: `${b.region} · Safety ${b.safetyIndex}`,
          onPick: () => {
            const next = new URLSearchParams(sp.toString());
            next.set("mlat", b.lat.toFixed(6));
            next.set("mlng", b.lng.toFixed(6));
            next.set("mz", String(EXPLORE_MAP_ZOOM_FROM_SEARCH));
            next.set("q", b.name);
            navigate({ pathname: "/explore", search: next.toString() });
            setQuery(b.name);
          },
        });
      });

    return items;
  }, [query, caResults, filtered, hideCaLive, sp, navigate, setQuery]);

  const neighbors = locationId ? nearbyLocations(locationId, 5) : [];
  const saved = savedPlaces();

  const mapLat = parseFloat(sp.get("mlat") || "");
  const mapLng = parseFloat(sp.get("mlng") || "");
  const mapHasCoords = Number.isFinite(mapLat) && Number.isFinite(mapLng);
  const nearestForForecast =
    !locationId && mapHasCoords ? nearestLocation(mapLat, mapLng) : null;
  return (
    <ExploreMapsApiProvider>
      <div className="wf-page ex-app">
        <nav className="rp-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="rp-breadcrumb-sep">/</span>
          <Link to="/explore">Explore locations</Link>
          {loc && (
            <>
              <span className="rp-breadcrumb-sep">/</span>
              <span aria-current="page">{loc.name}</span>
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
              ? `Collectible-style species cards for this beach.`
              : "Search beaches, coves, and reefs; filter by activity; open a place for species cards."}
          </p>
        </div>

        <div className="ex-grid">
          {/* —— Sidebar: discovery + filters (persistent while browsing Explore) —— */}
          <aside className="ex-sidebar" aria-label="Search and filters">
            <h2>Explore locations</h2>
            <p className="ex-sidebar-lead">Enter a beach</p>

            {/* Sidebar block: text search */}
            <div className="ex-label">Search</div>
            <ExploreSidebarSearchInput
              query={query}
              setQuery={setQuery}
              typeaheadItems={typeaheadItems}
              typeaheadLoading={
                !hideCaLive && caLoading && query.trim().length >= 1
              }
              typeaheadError={!hideCaLive ? caError : null}
              mapGeocodeEnabled={!locationId}
            />

            {/* Sidebar block: saved + nearby shortcuts */}
            <div className="ex-label">Saved places</div>
            <ul className="ex-mini-list">
              {saved.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/explore/${s.id}`)}
                  >
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
                      <button
                        type="button"
                        onClick={() => navigate(`/explore/${n.id}`)}
                      >
                        {n.name}
                        <span className="ex-mini-meta">
                          ~{n.distanceKm.toFixed(1)} km
                        </span>
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

            {/* Sidebar block: CA datastore SQL + demo list */}
            <div className="ex-label">Results</div>
            {hideCaLive && (
              <p className="ex-sidebar-hint">
                California database search is off while activity filters are on.
              </p>
            )}
            <ul className="ex-beach-list">
              {!hideCaLive && caError && (
                <li
                  className="ex-beach-list-msg ex-beach-list-msg--error"
                  role="status"
                >
                  {caError}
                </li>
              )}
              {!hideCaLive && caLoading && query.trim().length >= 1 && (
                <li className="ex-beach-list-msg">Searching data.ca.gov…</li>
              )}
              {!hideCaLive &&
                !caLoading &&
                query.trim().length >= 1 &&
                !caError &&
                caResults.length === 0 && (
                  <li className="ex-beach-list-msg">
                    No matches in the state beach list for that text.
                  </li>
                )}
              {!hideCaLive &&
                caResults.map((beach) => (
                  <li key={beach.id}>
                    <button
                      type="button"
                      className="ex-beach-list-btn ex-beach-list-btn--ca"
                      onClick={() => {
                        const next = new URLSearchParams(sp.toString());
                        next.set("mlat", beach.lat.toFixed(6));
                        next.set("mlng", beach.lng.toFixed(6));
                        next.set("mz", String(EXPLORE_MAP_ZOOM_FROM_SEARCH));
                        next.set("q", beach.name);
                        navigate({
                          pathname: "/explore",
                          search: next.toString(),
                        });
                        setQuery(beach.name);
                      }}
                    >
                      <strong>{beach.name}</strong>
                      <span className="ex-beach-ca-badge">data.ca.gov</span>
                      <span className="ex-beach-list-sub">
                        {beach.region}
                        {beach.meta ? ` · ${beach.meta}` : ""}
                      </span>
                    </button>
                  </li>
                ))}
              {filtered.map((beach) => (
                <li key={beach.id}>
                  <button
                    type="button"
                    className="ex-beach-list-btn"
                    onClick={() => {
                      navigate(`/explore/${beach.id}`);
                      setQuery("");
                    }}
                  >
                    <strong>{beach.name}</strong>
                    <span className="ex-beach-list-sub">
                      {beach.region} · Safety {beach.safetyIndex}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {!locationId && mapHasCoords && (
              <>
                <div className="ex-label">Map pin</div>
                <div className="ex-sidebar-map-pos" aria-live="polite">
                  <div className="ex-sidebar-coord-row">
                    <span className="ex-sidebar-coord-label">Latitude</span>
                    <code className="ex-sidebar-coord-value">
                      {mapLat.toFixed(6)}
                    </code>
                  </div>
                  <div className="ex-sidebar-coord-row">
                    <span className="ex-sidebar-coord-label">Longitude</span>
                    <code className="ex-sidebar-coord-value">
                      {mapLng.toFixed(6)}
                    </code>
                  </div>
                </div>
                {nearestForForecast && (
                  <div className="ex-sidebar-forecast-wrap">
                    <Link
                      to={`/explore/${nearestForForecast.location.id}?fishdeck=1`}
                      className="ex-sidebar-forecast-btn"
                    >
                      open fishdeck
                    </Link>
                    <p className="ex-sidebar-forecast-note">
                      For this pin, open fishdeck for the nearest ReefPulse
                      beach: <strong>{nearestForForecast.location.name}</strong>{" "}
                      (~
                      {nearestForForecast.distanceKm.toFixed(1)} km away).
                    </p>
                  </div>
                )}
              </>
            )}

            <div className="ex-sidebar-foot">
              <Link to="/community">Community</Link>
              <Link to="/marine-life">Marine life</Link>
              <Link to="/dashboard">Dashboard</Link>
            </div>
          </aside>

          {/* —— Main: child route (index map / location cards) —— */}
          <div className="ex-outlet">
            <Outlet />
          </div>
        </div>
      </div>
    </ExploreMapsApiProvider>
  );
}

export default ExploreLayout;
