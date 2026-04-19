/**
 * ReefPulse — Explore location detail (main decision page)
 *
 * Route: `/explore/:locationId`  ·  Query: `?tab=overview|forecast|community` (default overview)
 * Styles: `./explore-app.css`
 *
 * Layout:
 *   - Center column: map card, floating advisory, tab bar, tab panels
 *   - Right rail (`ex-rail`): community pulse + quick alert digest
 *
 * Tabs (IA):
 *   Overview — snapshot + verdict + hazards + species on radar
 *   Forecast — 14-day future outlook in one scrollable row (hazard & bloom chips + species)
 *   Community — local posts with photo placeholders + tips
 */
import { useMemo } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  findLocation,
  forecastOutlook,
  sightingsForLocation,
  snorkelRecommendation,
} from "../../data/mockData";
import "./explore-app.css";

/** Tab ids must match `?tab=` values (overview omits query param when default). */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "forecast", label: "Forecast" },
  { id: "community", label: "Community" },
];

/** Maps forecast hazard label to a CSS color for chips. */
function hazardTone(h) {
  const x = h.toLowerCase();
  if (x.includes("high")) return "#b91c1c";
  if (x.includes("moderate")) return "#c2410c";
  return "#15803d";
}

/** Plain-language “what to do here today” from mock location + activities. */
function bestActivityLine(loc) {
  const acts = loc.activities || [];
  if (acts.includes("surfing") && loc.waveFt >= 3.5)
    return "Surfing window — waves elevated; snorkel inside guarded zones only.";
  if (loc.safetyIndex >= 85 && loc.waveFt <= 3.5)
    return "Best today: snorkeling & easy swimming.";
  if (loc.safetyIndex >= 80)
    return "Swimming OK in marked zones; snorkeling if you are comfortable with mild surge.";
  return "Fishing from shore may be OK; in-water activities need extra caution.";
}

function ExploreLocationPage() {
  const { locationId } = useParams();
  const [sp, setSp] = useSearchParams();
  const location = findLocation(locationId);
  const rawTab = sp.get("tab");
  const tab = rawTab === "past" ? "overview" : rawTab || "overview";
  const planning = tab === "forecast" ? "future" : "present";

  const speciesProb = useMemo(() => {
    if (!location?.speciesPreview) return [];
    return location.speciesPreview.map((name, i) => ({
      name,
      pct: Math.max(55, 88 - i * 9 - (planning === "future" ? 5 : 0)),
    }));
  }, [location, planning]);

  if (!location) {
    return <Navigate to="/explore" replace />;
  }

  if (rawTab === "past") {
    const next = new URLSearchParams(sp);
    next.delete("tab");
    const qs = next.toString();
    return (
      <Navigate to={`/explore/${locationId}${qs ? `?${qs}` : ""}`} replace />
    );
  }

  const setTab = (id) => {
    const next = new URLSearchParams(sp);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    setSp(next, { replace: true });
  };

  const future14 = forecastOutlook.slice(0, 14);
  const localSightings = sightingsForLocation(location.id);
  const verdict = snorkelRecommendation(location);
  const railSightings = localSightings.length
    ? localSightings
    : sightingsForLocation("la-jolla-shores").slice(0, 2);

  return (
    <div className="ex-location">
      <div className="ex-loc-body">
        {/* —— Center: map + tabs —— */}
        <div className="ex-loc-center">
          <div className="ex-map-card">
            {/* Map strip + pin (static hero; real app would embed map SDK) */}
            <div className="ex-map-visual">
              <span className="ex-map-pin" aria-hidden />
              <div className="ex-map-caption">
                {location.name} · {location.region}
              </div>
            </div>

            {/* Advisory callout overlay */}
            <aside
              className="ex-float-alerts"
              aria-label="Alerts"
              style={
                location.activeAlerts.length === 0
                  ? {
                      borderColor: "#bbf7d0",
                      background: "rgba(255,255,255,0.95)",
                    }
                  : undefined
              }
            >
              <strong
                style={
                  location.activeAlerts.length === 0
                    ? { color: "#166534" }
                    : undefined
                }
              >
                {location.activeAlerts.length ? "Active advisory" : "Status"}
              </strong>
              {location.activeAlerts.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155" }}>
                  No active warnings for this beach.
                </p>
              ) : (
                <ul>
                  {location.activeAlerts.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </aside>

            {/* Primary IA tabs */}
            <div className="ex-tabs" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`ex-tab ${tab === t.id ? "is-on" : ""}`}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content panels */}
            <div className="ex-tab-panels">
              {tab === "overview" && (
                <div className="ex-panel">
                  <h3>Location overview</h3>
                  <p className="ex-lede">
                    {location.name} — {location.region}. Quick read for current conditions.
                  </p>
                  <p>
                    <strong>Safety index:</strong> {location.safetyIndex}/100 ·{" "}
                    <strong>Snorkeling:</strong>{" "}
                    <span
                      style={{
                        fontWeight: 800,
                        color:
                          verdict.tone === "good"
                            ? "#166534"
                            : verdict.tone === "caution"
                              ? "#c2410c"
                              : "#b91c1c",
                      }}
                    >
                      {verdict.label}
                    </span>
                  </p>
                  <p>
                    <strong>Best activity:</strong> {bestActivityLine(location)}
                  </p>
                  <p>
                    Waves {location.waveFt} ft · Water {location.waterTempF}°F ·
                    Rain {location.rainChancePct}% · Wind {location.windMph} mph
                    · Algal activity {location.algalRisk}
                  </p>
                  {location.hazardBadges.length > 0 && (
                    <p>
                      <strong>Flags / hazards:</strong>{" "}
                      {location.hazardBadges.join(", ")}
                    </p>
                  )}
                  <p>
                    <strong>Species on radar:</strong>{" "}
                    {location.speciesPreview.join(", ")}
                  </p>
                </div>
              )}

              {tab === "forecast" && (
                <div className="ex-panel">
                  <h3>14-day forecast</h3>
                  <p className="ex-lede" style={{ marginBottom: "0.75rem" }}>
                    Forward-looking demo: fourteen days in a row (D+1 through D+14). Use{" "}
                    <strong>Overview</strong> for current conditions at this beach.
                  </p>
                  <p
                    style={{
                      marginBottom: "0.5rem",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      color: "#64748b",
                    }}
                  >
                    Hazard &amp; bloom by day
                  </p>
                  <div className="ex-forecast-row ex-forecast-row--inline">
                    {future14.map((d) => (
                      <div key={d.label} className="ex-forecast-chip">
                        <div style={{ fontWeight: 800, color: "#64748b" }}>
                          {d.short}
                        </div>
                        <div
                          style={{
                            fontWeight: 700,
                            color: hazardTone(d.hazard),
                            margin: "0.2rem 0",
                          }}
                        >
                          {d.hazard}
                        </div>
                        <div style={{ fontWeight: 800 }}>{d.bloomPct}%</div>
                        <div style={{ fontSize: "0.62rem", color: "#94a3b8" }}>
                          HAB index
                        </div>
                      </div>
                    ))}
                  </div>
                  <p>
                    <strong>Best snorkeling window (model):</strong> favor early
                    mornings in the lower-surf days below (D+1–D+4 in this demo)
                    before wind fill — align with local tide tables in real use.
                  </p>
                  <p style={{ marginBottom: "0.35rem" }}>
                    <strong>Species likelihood (next 14 days)</strong>
                  </p>
                  {speciesProb.map((row) => (
                    <p key={row.name} className="ex-spec-prob">
                      {row.name}: ~{row.pct}% in favorable visibility over the
                      next 14 days — illustrative demo.
                    </p>
                  ))}
                </div>
              )}

              {tab === "community" && (
                <div className="ex-panel">
                  <h3>Community posts</h3>
                  <p>
                    Tips, notes, and photos from snorkelers at this location.
                  </p>
                  {localSightings.length === 0 ? (
                    <p>
                      No posts here yet.{" "}
                      <Link to="/community">Share your sighting →</Link>
                    </p>
                  ) : (
                    localSightings.map((s) => (
                      <div key={s.id} className="ex-comm-card">
                        <div
                          className="ex-comm-ph"
                          role="img"
                          aria-label="Placeholder for snorkeler photo"
                        />
                        <strong>{s.species}</strong> · {s.author} · {s.time}
                        {s.visibility ? (
                          <div
                            style={{
                              fontSize: "0.78rem",
                              color: "#64748b",
                              marginTop: "0.25rem",
                            }}
                          >
                            Visibility: {s.visibility}
                          </div>
                        ) : null}
                        <p
                          style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}
                        >
                          {s.text}
                        </p>
                        {s.tips?.length ? (
                          <ul
                            style={{
                              margin: "0.5rem 0 0",
                              paddingLeft: "1.1rem",
                              fontSize: "0.82rem",
                              color: "#475569",
                            }}
                          >
                            {s.tips.map((tip) => (
                              <li key={tip}>{tip}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))
                  )}
                  <p style={{ marginTop: "0.75rem" }}>
                    <Link to="/community">Open full community feed →</Link>
                  </p>
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5rem",
              marginTop: "0.5rem",
            }}
          >
            <Link
              to={`/explore/${location.id}?tab=forecast`}
              style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1b254b" }}
            >
              View forecast tab →
            </Link>
            <Link
              to="/marine-life"
              style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1b254b" }}
            >
              Marine life near this coast →
            </Link>
            <Link
              to="/dashboard"
              style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1b254b" }}
            >
              Dashboard
            </Link>
          </div>
        </div>

        {/* —— Right rail: lightweight community + alert context —— */}
        <aside className="ex-rail" aria-label="Community and alerts">
          <div className="ex-rail-card">
            <h4>Community pulse</h4>
            {railSightings.slice(0, 3).map((s) => (
              <p key={s.id} style={{ margin: "0 0 0.6rem" }}>
                <strong>{s.species}</strong> — {s.text.slice(0, 72)}
                {s.text.length > 72 ? "…" : ""}
              </p>
            ))}
            <Link
              to="/community"
              style={{ fontWeight: 700, fontSize: "0.82rem" }}
            >
              Post what you saw
            </Link>
          </div>
          <div className="ex-rail-card">
            <h4>Quick alert</h4>
            {location.activeAlerts.length ? (
              <p style={{ margin: 0 }}>{location.activeAlerts[0]}</p>
            ) : (
              <p style={{ margin: 0 }}>
                No urgent flags — still read overview before entering water.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ExploreLocationPage;
