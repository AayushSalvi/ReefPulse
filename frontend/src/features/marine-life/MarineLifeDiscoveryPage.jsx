/**
 * ReefPulse — Marine life discovery (species-first)
 *
 * Route: `/marine-life`  ·  Styles: `./marine-life.css` (large shared file includes legacy full-screen styles below)
 *
 * Layout (CSS grid):
 *   1) Search + discovery chips
 *   2) Three columns: species profile | distribution map + layer toggles + zoom | best locations list
 *   3) Community sightings strip
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { caLatLngToPercent } from "../../utils/geo";
import {
  communitySightings,
  discoveryChips,
  findLocation,
  matchSpeciesQuery,
  snorkelSpecies,
  speciesForDiscoveryChip
} from "../../data/mockData";
import "./marine-life.css";

const ZOOM_LEVELS = [0.82, 1, 1.25, 1.55];

function MarineLifeDiscoveryPage() {
  const [query, setQuery] = useState("");
  const [zoomIdx, setZoomIdx] = useState(1);
  const [discoveryId, setDiscoveryId] = useState(null);
  const [layers, setLayers] = useState({ recent: true, historical: true, forecast: false });

  const selected = useMemo(() => {
    if (discoveryId) {
      const list = speciesForDiscoveryChip(discoveryId);
      return list[0] || null;
    }
    return matchSpeciesQuery(query);
  }, [discoveryId, query]);

  const zoom = ZOOM_LEVELS[zoomIdx];

  const sightingsBelow = useMemo(() => {
    if (!selected) return communitySightings.slice(0, 4);
    const key = selected.name.split(" ")[0].toLowerCase();
    const hit = communitySightings.filter(
      (s) =>
        s.species.toLowerCase().includes(key) ||
        s.text.toLowerCase().includes(selected.name.toLowerCase())
    );
    return hit.length ? hit : communitySightings.slice(0, 4);
  }, [selected]);

  const habIsLow = selected?.habRisk?.toLowerCase().includes("low");

  const toggleLayer = (key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="ml-app">
      {/* —— Breadcrumb —— */}
      <nav className="rp-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: "0.75rem" }}>
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <span aria-current="page">Marine life</span>
      </nav>

      {/* —— Search + suggested chips —— */}
      <div className="ml-app-search">
        <label htmlFor="ml-app-q" className="ml-app-search-label">
          What species do you want to see while snorkeling?
        </label>
        <input
          id="ml-app-q"
          className="ml-app-search-input"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDiscoveryId(null);
          }}
          placeholder="Try garibaldi, leopard shark, bat ray, sea lion…"
          list="ml-app-datalist"
        />
        <datalist id="ml-app-datalist">
          {snorkelSpecies.map((s) => (
            <option key={s.id} value={s.name} />
          ))}
        </datalist>
      </div>

      <div className="ml-discovery-chips" role="group" aria-label="Suggested searches">
        {discoveryChips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ml-discovery-chip ${discoveryId === c.id ? "is-on" : ""}`}
            onClick={() => {
              setDiscoveryId(c.id);
              const first = speciesForDiscoveryChip(c.id)[0];
              setQuery(first ? first.name : "");
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* —— Profile | map | best locations —— */}
      <div className="ml-app-grid">
        <aside className="ml-app-profile" aria-label="Species overview">
          {selected ? (
            <>
              <div className="ml-app-profile-img" style={{ backgroundImage: `url(${selected.detailImage})` }} />
              <h2>{selected.name}</h2>
              <p className="ml-app-muted">{selected.hint}</p>
              {selected.bestSeason && (
                <dl className="ml-spec-dl">
                  <div>
                    <dt>Best season</dt>
                    <dd>{selected.bestSeason}</dd>
                  </div>
                  <div>
                    <dt>Best time of day</dt>
                    <dd>{selected.bestTimeOfDay}</dd>
                  </div>
                  <div>
                    <dt>Typical habitat</dt>
                    <dd>{selected.typicalHabitat}</dd>
                  </div>
                  <div>
                    <dt>Snorkeling notes</dt>
                    <dd>{selected.difficultyNote}</dd>
                  </div>
                </dl>
              )}
              <div className="ml-app-mini">
                <div>
                  <small>Snorkel safety</small>
                  <strong>{selected.snorkelSafety}</strong>
                </div>
                <div>
                  <small>Water</small>
                  <strong>{selected.waterTempF}°F</strong>
                </div>
              </div>
              <p className="ml-app-muted" style={{ fontSize: "0.8rem" }}>
                HAB: <span className={habIsLow ? "ml-badge-low" : "ml-badge-mod"}>{selected.habRisk}</span>
              </p>
              <Link className="ml-btn-primary" style={{ display: "block", marginTop: "0.75rem" }} to={`/explore/${selected.exploreLocationId}`}>
                View beach in Explore
              </Link>
              <Link className="ml-btn-ghost" style={{ display: "block", marginTop: "0.5rem" }} to="/community">
                Share your sighting
              </Link>
            </>
          ) : (
            <p className="ml-app-muted" style={{ margin: 0 }}>
              Search or tap a chip to load profile, distribution map, best snorkeling locations, and sightings.
            </p>
          )}
        </aside>

        <div className="ml-app-map" aria-label="Distribution map">
          <div className="ml-map-layers" role="group" aria-label="Map layers">
            <label>
              <input type="checkbox" checked={layers.recent} onChange={() => toggleLayer("recent")} />
              Recent sightings
            </label>
            <label>
              <input type="checkbox" checked={layers.historical} onChange={() => toggleLayer("historical")} />
              Historical presence
            </label>
            <label>
              <input type="checkbox" checked={layers.forecast} onChange={() => toggleLayer("forecast")} />
              Forecasted presence
            </label>
          </div>
          <div className="ml-app-map-inner" style={{ transform: `scale(${zoom})` }}>
            {!selected ? (
              <div className="ml-map-hint" style={{ color: "#e2e8f0" }}>
                Map — enter a species to plot California hotspots and layer recent vs modeled presence.
              </div>
            ) : (
              <>
                {layers.historical && <div className="ml-heat ml-heat--hist" aria-hidden />}
                {layers.forecast && <div className="ml-heat ml-heat--fc" aria-hidden />}
                {layers.recent || layers.historical || layers.forecast ? (
                  selected.hotspots.map((h, idx) => {
                    const pos = caLatLngToPercent(h.lat, h.lng);
                    return (
                      <div key={`${h.label}-${idx}`} className="ml-pin" style={pos}>
                        <span className={`ml-dot ${idx === 0 ? "is-alert" : ""}`} aria-hidden />
                        <span className="ml-marker-label">{h.label}</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="ml-map-hint" style={{ color: "#e2e8f0" }}>
                    Enable at least one layer to show pins.
                  </div>
                )}
              </>
            )}
          </div>
          <div className="ml-app-map-zoom">
            <button
              type="button"
              aria-label="Zoom in"
              disabled={zoomIdx >= ZOOM_LEVELS.length - 1}
              onClick={() => setZoomIdx((i) => Math.min(i + 1, ZOOM_LEVELS.length - 1))}
            >
              +
            </button>
            <button
              type="button"
              aria-label="Zoom out"
              disabled={zoomIdx <= 0}
              onClick={() => setZoomIdx((i) => Math.max(i - 1, 0))}
            >
              −
            </button>
          </div>
        </div>

        <aside className="ml-app-locs" aria-label="Best locations">
          <h3>Best locations</h3>
          {selected ? (
            <ol className="ml-loc-list">
              {selected.hotspots.map((h, i) => {
                const beach = findLocation(selected.exploreLocationId);
                const go =
                  beach && beach.safetyIndex >= 85 && beach.waveFt <= 3.5
                    ? "Go now — conditions favorable"
                    : "Better tomorrow morning — calmer window expected";
                return (
                  <li key={h.label}>
                    <strong>{h.label}</strong>
                    <div className="ml-app-muted">
                      Chance ~{88 - i * 6}% · {beach ? `${beach.waveFt} ft waves, ${beach.waterTempF}°F` : "—"}
                    </div>
                    <div className="ml-go-hint">{go}</div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="ml-app-muted" style={{ margin: 0 }}>
              Hotspot list appears after you pick a species.
            </p>
          )}
        </aside>
      </div>

      {/* —— Related community posts —— */}
      <section className="ml-app-sightings" aria-labelledby="ml-sightings-title">
        <h3 id="ml-sightings-title">Community sightings</h3>
        <div className="ml-app-sight-grid">
          {sightingsBelow.map((s) => (
            <article key={s.id} className="ml-app-sight-card">
              <strong>{s.species}</strong>
              <span className="ml-app-sight-meta">
                {s.locationName} · {s.time}
              </span>
              <p>{s.text}</p>
              <span className="ml-app-sight-author">— {s.author}</span>
            </article>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginTop: "0.75rem" }}>
          <Link to="/community" style={{ fontWeight: 700, fontSize: "0.88rem" }}>
            Open full community feed →
          </Link>
          <Link to="/community" style={{ fontWeight: 700, fontSize: "0.88rem", color: "#0f766e" }}>
            Log your snorkeling trip
          </Link>
        </div>
      </section>
    </div>
  );
}

export default MarineLifeDiscoveryPage;
