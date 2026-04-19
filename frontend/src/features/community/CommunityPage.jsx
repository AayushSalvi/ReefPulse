/**
 * ReefPulse — Community (sightings feed + composer)
 *
 * Route: `/community`  ·  Styles: `./community.css`
 *
 * Sections:
 *   1) Breadcrumb + title
 *   2) Composer — photo, place, datetime, visibility, caption, species tags, AI demo button
 *   3) Feed controls — tag chips, species text filter, location select, sort (recent / popular / nearby)
 *   4) Feed cards — from `communitySightingsFiltered` in mock data
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { communitySightingsFiltered, locations } from "../../data/mockData";
import "./community.css";

const CHIPS = [
  { id: "all", label: "All" },
  { id: "fish", label: "Fish" },
  { id: "mammals", label: "Mammals" },
  { id: "snorkel", label: "Snorkel" },
  { id: "reef", label: "Reef" }
];

const FEED_SORT = [
  { id: "recent", label: "Recent" },
  { id: "popular", label: "Popular" },
  { id: "nearby", label: "Nearby" }
];

function CommunityPage() {
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [species, setSpecies] = useState("");
  const [locationId, setLocationId] = useState("");
  const [whenLocal, setWhenLocal] = useState("");
  const [visibility, setVisibility] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [speciesFilter, setSpeciesFilter] = useState("");
  const [feedLocation, setFeedLocation] = useState("");
  const [feedSort, setFeedSort] = useState("recent");
  const [aiNote, setAiNote] = useState("");

  const feed = useMemo(
    () =>
      communitySightingsFiltered({
        tag: filter,
        speciesQuery: speciesFilter,
        locationId: feedLocation || null,
        feedSort
      }),
    [filter, speciesFilter, feedLocation, feedSort]
  );

  return (
    <div className="comm-wrap wf-page">
      {/* —— 1) Page chrome —— */}
      <nav className="rp-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <span aria-current="page">Community</span>
      </nav>

      <div className="rp-page-title">
        <h1>Community</h1>
        <p>Post what you saw, add conditions for the next snorkeler, and browse recent reports.</p>
      </div>

      {/* —— 2) Composer —— */}
      <section className="comm-compose" aria-label="Create post">
        <h2>Log your snorkeling trip</h2>
        <div className="comm-compose-grid">
          <label className="comm-field">
            <span>Photo</span>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoName(e.target.files?.[0]?.name || "")}
            />
            {photoName ? <small className="comm-file-name">{photoName}</small> : null}
          </label>
          <label className="comm-field">
            <span>Beach / location</span>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              <option value="">Select…</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="comm-field">
            <span>Date &amp; time</span>
            <input type="datetime-local" value={whenLocal} onChange={(e) => setWhenLocal(e.target.value)} />
          </label>
          <label className="comm-field">
            <span>Water visibility</span>
            <select value={visibility} onChange={(e) => setVisibility(e.target.value)}>
              <option value="">Select…</option>
              <option value="excellent">Excellent</option>
              <option value="good">Good</option>
              <option value="medium">Medium</option>
              <option value="poor">Poor</option>
            </select>
          </label>
          <label className="comm-field comm-field--wide">
            <span>Caption / tips</span>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Visibility was good, mild surge near rocks, saw garibaldi on the north reef…"
            />
          </label>
          <label className="comm-field comm-field--wide">
            <span>Tag species (if known)</span>
            <input
              type="text"
              value={species}
              onChange={(e) => setSpecies(e.target.value)}
              placeholder="e.g. Garibaldi, leopard shark"
            />
          </label>
        </div>
        <div className="comm-ai-row">
          <button
            type="button"
            className="comm-ai-btn"
            onClick={() => {
              setAiNote("Demo: model suggests Garibaldi or kelp bass from shoreline reef context — verify in water.");
              setSpecies((prev) => prev || "Garibaldi?");
            }}
          >
            AI species suggestion (demo)
          </button>
          {aiNote ? <p className="comm-ai-note">{aiNote}</p> : null}
        </div>
        <div className="comm-compose-actions">
          <button
            type="button"
            className="comm-post-btn"
            onClick={() => {
              setDraft("");
              setSpecies("");
              setLocationId("");
              setWhenLocal("");
              setVisibility("");
              setPhotoName("");
              setAiNote("");
            }}
          >
            Post (demo — clears form)
          </button>
          <span className="comm-compose-hint">In production this would publish to the feed and maps.</span>
        </div>
      </section>

      {/* —— 3) Feed filters —— */}
      <h2 className="comm-feed-title">Feed</h2>
      <div className="comm-chips" role="group" aria-label="Filter by tag">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`comm-chip ${filter === c.id ? "is-on" : ""}`}
            onClick={() => setFilter(c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="comm-feed-filters" role="group" aria-label="Refine feed">
        <label className="comm-inline">
          Species contains
          <input
            type="search"
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            placeholder="garibaldi, shark…"
          />
        </label>
        <label className="comm-inline">
          Location
          <select value={feedLocation} onChange={(e) => setFeedLocation(e.target.value)}>
            <option value="">All</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="comm-sort" role="group" aria-label="Sort feed">
          {FEED_SORT.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`comm-sort-btn ${feedSort === s.id ? "is-on" : ""}`}
              onClick={() => setFeedSort(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* —— 4) Feed list —— */}
      <section className="comm-feed" aria-label="Sightings feed">
        {feed.map((s) => (
          <article key={s.id} className="comm-card">
            <div className="comm-card-head">
              <div>
                <strong>{s.species}</strong>
                <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "0.2rem" }}>{s.locationName}</div>
              </div>
              <span>{s.time}</span>
            </div>
            {s.visibility ? (
              <div className="comm-visibility">Visibility: {s.visibility}</div>
            ) : null}
            <p style={{ margin: 0, fontSize: "0.92rem", lineHeight: 1.5, color: "#334155" }}>{s.text}</p>
            {s.tips?.length ? (
              <ul className="comm-tips">
                {s.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ) : null}
            <div className="comm-tags">
              {s.tags.map((t) => (
                <span key={t} className="comm-tag">
                  {t}
                </span>
              ))}
            </div>
            <div className="comm-card-foot">
              <span>— {s.author}</span>
              {typeof s.likes === "number" ? <span className="comm-likes">{s.likes} likes</span> : null}
            </div>
          </article>
        ))}
      </section>

      <div className="wf-page-footer-links" style={{ marginTop: "1.5rem" }}>
        <Link to="/explore">Explore</Link>
        <Link to="/marine-life">Marine life</Link>
        <Link to="/dashboard">Dashboard</Link>
      </div>
    </div>
  );
}

export default CommunityPage;
