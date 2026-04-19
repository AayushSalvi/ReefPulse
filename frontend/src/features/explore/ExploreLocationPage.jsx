/**
 * ReefPulse — Explore location detail (main decision page)
 *
 * Route: `/explore/:locationId`  ·  Query: `?tab=overview|past|forecast|community` (default overview)
 * Styles: `./explore-app.css`
 *
 * Layout:
 *   - Center column: map card, floating advisory, planning chips (Past/Now/Future), tab bar, tab panels
 *   - Right rail (`ex-rail`): community pulse + quick alert digest
 *
 * Tabs (IA):
 *   Overview — snapshot + verdict + hazards + species on radar
 *   Past — narrative + timeline slider (demo)
 *   Forecast — compare blocks + 7-day chips + species probability (demo)
 *   Community — local posts with photo placeholders + tips
 */
import { useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  findLocation,
  forecastOutlook,
  sightingsForLocation,
  snorkelRecommendation
} from "../../data/mockData";
import "./explore-app.css";

/** Tab ids must match `?tab=` values (overview omits query param when default). */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "past", label: "Past" },
  { id: "forecast", label: "Forecast" },
  { id: "community", label: "Community" }
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
  if (acts.includes("surfing") && loc.waveFt >= 3.5) return "Surfing window — waves elevated; snorkel inside guarded zones only.";
  if (loc.safetyIndex >= 85 && loc.waveFt <= 3.5) return "Best today: snorkeling & easy swimming.";
  if (loc.safetyIndex >= 80) return "Swimming OK in marked zones; snorkeling if you are comfortable with mild surge.";
  return "Fishing from shore may be OK; in-water activities need extra caution.";
}

function ExploreLocationPage() {
  const { locationId } = useParams();
  const [sp, setSp] = useSearchParams();
  const location = findLocation(locationId);
  const tab = sp.get("tab") || "overview";
  const planning = tab === "past" ? "past" : tab === "forecast" ? "future" : "present";
  const [pastDays, setPastDays] = useState(7);

  const speciesProb = useMemo(() => {
    if (!location?.speciesPreview) return [];
    return location.speciesPreview.map((name, i) => ({
      name,
      pct: Math.max(55, 88 - i * 9 - (planning === "future" ? 5 : 0))
    }));
  }, [location, planning]);

  if (!location) {
    return <Navigate to="/explore" replace />;
  }

  const setTab = (id) => {
    const next = new URLSearchParams(sp);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    setSp(next, { replace: true });
  };

  const week = forecastOutlook.slice(0, 7);
  const localSightings = sightingsForLocation(location.id);
  const verdict = snorkelRecommendation(location);
  const railSightings = localSightings.length ? localSightings : sightingsForLocation("la-jolla-shores").slice(0, 2);

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
                  ? { borderColor: "#bbf7d0", background: "rgba(255,255,255,0.95)" }
                  : undefined
              }
            >
              <strong style={location.activeAlerts.length === 0 ? { color: "#166534" } : undefined}>
                {location.activeAlerts.length ? "Active advisory" : "Status"}
              </strong>
              {location.activeAlerts.length === 0 ? (
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#334155" }}>No active warnings for this beach.</p>
              ) : (
                <ul>
                  {location.activeAlerts.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              )}
            </aside>

            {/* Past / Now / Future — drives same tabs (shorthand for time context) */}
            <div className="ex-planning">
              <span>Planning</span>
              <button type="button" className={planning === "past" ? "is-on" : ""} onClick={() => setTab("past")}>
                Past
              </button>
              <button type="button" className={planning === "present" ? "is-on" : ""} onClick={() => setTab("overview")}>
                Now
              </button>
              <button type="button" className={planning === "future" ? "is-on" : ""} onClick={() => setTab("forecast")}>
                Future
              </button>
            </div>

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
                  <p className="ex-lede">{location.name} — {location.region}. Quick read for {planning === "present" ? "right now" : "your selected window"}.</p>
                  <p>
                    <strong>Safety index:</strong> {location.safetyIndex}/100 · <strong>Snorkeling:</strong>{" "}
                    <span
                      style={{
                        fontWeight: 800,
                        color: verdict.tone === "good" ? "#166534" : verdict.tone === "caution" ? "#c2410c" : "#b91c1c"
                      }}
                    >
                      {verdict.label}
                    </span>
                  </p>
                  <p>
                    <strong>Best activity:</strong> {bestActivityLine(location)}
                  </p>
                  <p>
                    Waves {location.waveFt} ft · Water {location.waterTempF}°F · Rain {location.rainChancePct}% · Wind{" "}
                    {location.windMph} mph · Algal activity {location.algalRisk}
                  </p>
                  {location.hazardBadges.length > 0 && (
                    <p>
                      <strong>Flags / hazards:</strong> {location.hazardBadges.join(", ")}
                    </p>
                  )}
                  <p>
                    <strong>Species on radar:</strong> {location.speciesPreview.join(", ")}
                  </p>
                </div>
              )}

              {tab === "past" && (
                <div className="ex-panel">
                  <h3>Past conditions</h3>
                  <p>
                    Weather: typical onshore flow afternoons; mornings calmer. Ocean: max waves last week ~{" "}
                    {(location.waveFt + 0.8).toFixed(1)} ft; water ranged {location.waterTempF - 2}–{location.waterTempF + 1}
                    °F.
                  </p>
                  <p>
                    Species logged by snorkelers: {location.speciesPreview.join(", ")} (consistent with seasonal norms).
                  </p>
                  <label htmlFor="past-range" style={{ fontSize: "0.85rem", fontWeight: 700, color: "#475569" }}>
                    Timeline — days back: {pastDays}
                  </label>
                  <input
                    id="past-range"
                    type="range"
                    className="ex-past-slider"
                    min={1}
                    max={21}
                    value={pastDays}
                    onChange={(e) => setPastDays(Number(e.target.value))}
                  />
                  <p style={{ marginBottom: 0 }}>
                    Demo slider — in a live app this would load observations and satellite summaries for the selected span.
                  </p>
                </div>
              )}

              {tab === "forecast" && (
                <div className="ex-panel">
                  <h3>Forecast — plan ahead</h3>
                  <div className="ex-forecast-compare">
                    <div className="ex-forecast-block">
                      <h4>Today</h4>
                      <p style={{ margin: 0, fontSize: "0.8rem" }}>
                        Safety score ~{location.safetyIndex}. {location.algalRisk} algal risk. Best if surf stays below{" "}
                        {(location.waveFt + 0.3).toFixed(1)} ft.
                      </p>
                    </div>
                    <div className="ex-forecast-block">
                      <h4>Tomorrow</h4>
                      <p style={{ margin: 0, fontSize: "0.8rem" }}>
                        Calm water trend morning · medium visibility · low–moderate algal risk on model run.
                      </p>
                    </div>
                    <div className="ex-forecast-block">
                      <h4>Weekend</h4>
                      <p style={{ margin: 0, fontSize: "0.8rem" }}>
                        Surf &amp; bloom indicators rise; compare tabs before committing to a long swim.
                      </p>
                    </div>
                  </div>
                  <p style={{ fontWeight: 700, color: "#1b254b", marginBottom: "0.35rem" }}>Tomorrow morning (example)</p>
                  <p style={{ marginBottom: "0.75rem" }}>
                    Calm water, medium visibility, low algal risk — higher chance of {location.speciesPreview[0]} and{" "}
                    {location.speciesPreview[1] || "nearshore fish"} (model confidence ~70%).
                  </p>
                  <p style={{ marginBottom: "0.5rem", fontSize: "0.82rem", fontWeight: 800, color: "#64748b" }}>
                    7-day hazard &amp; bloom
                  </p>
                  <div className="ex-forecast-row">
                    {week.map((d) => (
                      <div key={d.label} className="ex-forecast-chip">
                        <div style={{ fontWeight: 800, color: "#64748b" }}>{d.short}</div>
                        <div style={{ fontWeight: 700, color: hazardTone(d.hazard), margin: "0.2rem 0" }}>{d.hazard}</div>
                        <div style={{ fontWeight: 800 }}>{d.bloomPct}%</div>
                        <div style={{ fontSize: "0.62rem", color: "#94a3b8" }}>HAB index</div>
                      </div>
                    ))}
                  </div>
                  <p>
                    <strong>Best snorkeling window:</strong> early mornings mid-week before wind fill — align with low tide
                    if you are new to the site.
                  </p>
                  <p style={{ marginBottom: "0.35rem" }}>
                    <strong>Species likelihood (blend of history + forecast)</strong>
                  </p>
                  {speciesProb.map((row) => (
                    <p key={row.name} className="ex-spec-prob">
                      {row.name}: ~{row.pct}% in favorable vis ({planning === "future" ? "next 48h" : planning === "past" ? "same calendar week prior" : "today"}) — illustrative demo.
                    </p>
                  ))}
                </div>
              )}

              {tab === "community" && (
                <div className="ex-panel">
                  <h3>Community posts</h3>
                  <p>Tips, notes, and photos from snorkelers at this location.</p>
                  {localSightings.length === 0 ? (
                    <p>No posts here yet. <Link to="/community">Share your sighting →</Link></p>
                  ) : (
                    localSightings.map((s) => (
                      <div key={s.id} className="ex-comm-card">
                        <div className="ex-comm-ph" role="img" aria-label="Placeholder for snorkeler photo" />
                        <strong>{s.species}</strong> · {s.author} · {s.time}
                        {s.visibility ? (
                          <div style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.25rem" }}>Visibility: {s.visibility}</div>
                        ) : null}
                        <p style={{ margin: "0.35rem 0 0", fontSize: "0.88rem" }}>{s.text}</p>
                        {s.tips?.length ? (
                          <ul style={{ margin: "0.5rem 0 0", paddingLeft: "1.1rem", fontSize: "0.82rem", color: "#475569" }}>
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

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.5rem" }}>
            <Link to={`/explore/${location.id}?tab=forecast`} style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1b254b" }}>
              View forecast tab →
            </Link>
            <Link to="/marine-life" style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1b254b" }}>
              Marine life near this coast →
            </Link>
            <Link to="/dashboard" style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1b254b" }}>
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
            <Link to="/community" style={{ fontWeight: 700, fontSize: "0.82rem" }}>
              Post what you saw
            </Link>
          </div>
          <div className="ex-rail-card">
            <h4>Quick alert</h4>
            {location.activeAlerts.length ? (
              <p style={{ margin: 0 }}>{location.activeAlerts[0]}</p>
            ) : (
              <p style={{ margin: 0 }}>No urgent flags — still read overview before entering water.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default ExploreLocationPage;
