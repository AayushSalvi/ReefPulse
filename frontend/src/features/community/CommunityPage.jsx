/**
 * ReefPulse — Community (desktop-first feed + sticky sidebar for filters & new post)
 *
 * Route: `/community`  ·  Styles: `./community.css`, `../explore/workflow.css`
 */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getChallengeIconId } from "../../data/challengesData";
import { communitySightingsFiltered, locations } from "../../data/mockData";
import { ChallengeCardIcon } from "../challenges/challengeIcons";
import "../explore/workflow.css";
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

const SNORKELER_HIGHLIGHTS = [
  { id: "h1", handle: "maya_kelp", label: "La Jolla" },
  { id: "h2", handle: "jordan_floats", label: "Shores" },
  { id: "h3", handle: "reef_pulse", label: "Team" },
  { id: "h4", handle: "nico_bluewater", label: "Monterey" },
  { id: "h5", handle: "diverdana", label: "Crystal Cove" }
];

function formatLikes(n) {
  if (typeof n !== "number") return "";
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}k`;
  }
  return String(n);
}

function IconHeart() {
  return (
    <svg className="comm-post-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconBubble({ count }) {
  return (
    <span className="comm-post__comment-wrap">
      <svg className="comm-post-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
      {typeof count === "number" ? <span className="comm-post__comment-count">{count}</span> : null}
    </span>
  );
}

function IconShare() {
  return (
    <svg className="comm-post-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v15" />
    </svg>
  );
}

function FeedPost({ sighting: s }) {
  const [imgFailed, setImgFailed] = useState(false);
  const handle = s.username || s.author.replace(/\s+/g, "_").toLowerCase();
  const displaySpecies = s.species;
  const showImg = Boolean(s.imageUrl) && !imgFailed;

  return (
    <article className="comm-post">
      <div className="comm-post__media">
        {showImg ? (
          <img
            className="comm-post__img"
            src={s.imageUrl}
            alt={`${displaySpecies} at ${s.locationName}`}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="comm-post__img comm-post__img--fallback" role="img" aria-label="Photo unavailable" />
        )}
      </div>

      <div className="comm-post__panel">
        <header className="comm-post__head">
          <div className="comm-post__who">
            <span className="comm-post__avatar" aria-hidden>
              {handle.slice(0, 2).toUpperCase()}
            </span>
            <div className="comm-post__meta">
              <span className="comm-post__handle">{handle}</span>
              <span className="comm-post__subline">
                {displaySpecies} · {s.locationName}
              </span>
            </div>
          </div>
          <span className="comm-post__time">{s.time}</span>
        </header>

        {s.challengeCompletion ? (
          <div className="comm-post__achievement">
            <Link to="/challenges" className="comm-post__achievement-link">
              <span className="comm-post__achievement-icon" aria-hidden>
                <ChallengeCardIcon name={getChallengeIconId(s.challengeCompletion.challengeId)} />
              </span>
              <span className="comm-post__achievement-text">
                <span className="comm-post__achievement-label">Challenge</span>
                <span className="comm-post__achievement-title">{s.challengeCompletion.title}</span>
                <span className="comm-post__achievement-badge">Badge · {s.challengeCompletion.badgeName}</span>
              </span>
            </Link>
          </div>
        ) : null}

        <div className="comm-post__toolbar">
          <div className="comm-post__toolbar-left">
            <button type="button" className="comm-post__iconbtn" aria-label="Like (demo)">
              <IconHeart />
            </button>
            <button type="button" className="comm-post__iconbtn" aria-label={`Comments${typeof s.commentsCount === "number" ? `, ${s.commentsCount}` : ""} (demo)`}>
              <IconBubble count={s.commentsCount} />
            </button>
            <button type="button" className="comm-post__iconbtn" aria-label="Share (demo)">
              <IconShare />
            </button>
          </div>
        </div>

        <div className="comm-post__body">
          <p className="comm-post__likes">
            <strong>{formatLikes(s.likes)}</strong> snorkelers found this helpful
          </p>
          <p className="comm-post__caption">
            <span className="comm-post__caption-user">{handle}</span> {s.text}
          </p>
          {s.visibility ? (
            <p className="comm-post__viz">
              Water visibility: <strong>{s.visibility}</strong>
            </p>
          ) : null}
          {s.tips?.length ? (
            <>
              <p className="comm-post__tips-title">Field notes</p>
              <ul className="comm-post__tips">
                {s.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="comm-post__tags">
            {s.tags.map((t) => (
              <span key={t} className="comm-post__tag">
                #{t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function FilterToolbar({ filter, setFilter, speciesFilter, setSpeciesFilter, feedLocation, setFeedLocation, feedSort, setFeedSort }) {
  return (
    <div className="comm-toolbar" role="region" aria-label="Feed filters">
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
      <div className="comm-toolbar-row" role="group" aria-label="Refine feed">
        <label className="comm-inline">
          <span className="comm-inline-label">Species or @user</span>
          <input
            type="search"
            className="comm-input comm-input--search"
            value={speciesFilter}
            onChange={(e) => setSpeciesFilter(e.target.value)}
            placeholder="garibaldi, maya_kelp…"
          />
        </label>
        <label className="comm-inline">
          <span className="comm-inline-label">Location</span>
          <select className="comm-input comm-select" value={feedLocation} onChange={(e) => setFeedLocation(e.target.value)}>
            <option value="">All beaches</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="comm-sort" role="group" aria-label="Sort feed">
          <span className="comm-sort-label">Sort</span>
          <div className="comm-sort-inner">
            {FEED_SORT.map((x) => (
              <button
                key={x.id}
                type="button"
                className={`comm-sort-btn ${feedSort === x.id ? "is-on" : ""}`}
                onClick={() => setFeedSort(x.id)}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposerBlock({
  draft,
  setDraft,
  species,
  setSpecies,
  locationId,
  setLocationId,
  whenLocal,
  setWhenLocal,
  visibility,
  setVisibility,
  photoName,
  setPhotoName,
  aiNote,
  setAiNote
}) {
  return (
    <section className="comm-panel comm-panel--compose" aria-label="Create post">
      <div className="comm-panel-head">
        <span className="comm-panel-kicker">Share a sighting</span>
        <h2 className="comm-panel-title">New post</h2>
        <p className="comm-panel-lead">Add a photo, beach, conditions, and tips — demo form clears on submit.</p>
      </div>

      <div className="comm-compose-split comm-compose-split--sidebar">
        <div className="comm-compose-col">
          <h3 className="comm-subheading">Trip details</h3>
          <div className="comm-fields">
            <label className="comm-field">
              <span className="comm-field-label">Photo</span>
              <input
                type="file"
                accept="image/*"
                className="comm-input-file"
                onChange={(e) => setPhotoName(e.target.files?.[0]?.name || "")}
              />
              {photoName ? <span className="comm-file-name">{photoName}</span> : null}
            </label>
            <label className="comm-field">
              <span className="comm-field-label">Beach / location</span>
              <select className="comm-input comm-select" value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                <option value="">Select…</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="comm-field">
              <span className="comm-field-label">Date &amp; time</span>
              <input className="comm-input" type="datetime-local" value={whenLocal} onChange={(e) => setWhenLocal(e.target.value)} />
            </label>
            <label className="comm-field">
              <span className="comm-field-label">Water visibility</span>
              <select className="comm-input comm-select" value={visibility} onChange={(e) => setVisibility(e.target.value)}>
                <option value="">Select…</option>
                <option value="excellent">Excellent</option>
                <option value="good">Good</option>
                <option value="medium">Medium</option>
                <option value="poor">Poor</option>
              </select>
            </label>
          </div>
        </div>

        <div className="comm-compose-col comm-compose-col--wide">
          <h3 className="comm-subheading">Notes for others</h3>
          <div className="comm-fields">
            <label className="comm-field comm-field--block">
              <span className="comm-field-label">Caption / tips</span>
              <textarea
                className="comm-textarea"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Visibility was good, mild surge near rocks, saw garibaldi on the north reef…"
                rows={4}
              />
            </label>
            <label className="comm-field comm-field--block">
              <span className="comm-field-label">Tag species (if known)</span>
              <input
                className="comm-input"
                type="text"
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                placeholder="e.g. Garibaldi, leopard shark"
              />
            </label>
          </div>
        </div>
      </div>

      <div className="comm-ai-block">
        <button
          type="button"
          className="comm-btn comm-btn--ghost"
          onClick={() => {
            setAiNote("Demo: model suggests Garibaldi or kelp bass from shoreline reef context — verify in water.");
            setSpecies((prev) => prev || "Garibaldi?");
          }}
        >
          AI species suggestion (demo)
        </button>
        {aiNote ? (
          <p className="comm-ai-note" role="status">
            {aiNote}
          </p>
        ) : null}
      </div>

      <div className="comm-compose-actions">
        <button
          type="button"
          className="comm-btn comm-btn--primary"
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
        <p className="comm-compose-hint">In production this would publish to the feed and maps.</p>
      </div>
    </section>
  );
}

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

  const filterProps = {
    filter,
    setFilter,
    speciesFilter,
    setSpeciesFilter,
    feedLocation,
    setFeedLocation,
    feedSort,
    setFeedSort
  };

  const composerProps = {
    draft,
    setDraft,
    species,
    setSpecies,
    locationId,
    setLocationId,
    whenLocal,
    setWhenLocal,
    visibility,
    setVisibility,
    photoName,
    setPhotoName,
    aiNote,
    setAiNote
  };

  return (
    <div className="comm comm-page comm-page--refresh wf-page">
      <nav className="rp-breadcrumb comm-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <span aria-current="page">Community</span>
      </nav>

      <header className="rp-page-title comm-hero comm-hero--minimal">
        <h1>Community</h1>
        <p>
          Sightings, photos, and field notes from snorkelers. Complete a{" "}
          <Link to="/challenges" className="comm-hero__inline-link">
            challenge
          </Link>{" "}
          and your badge can show up here.
        </p>
      </header>

      <div className="comm-desktop-grid">
        <main className="comm-main">
          <div className="comm-highlights" aria-label="Snorkelers posting lately">
            <span className="comm-highlights__label">Posting lately</span>
            <div className="comm-highlights__row">
              {SNORKELER_HIGHLIGHTS.map((h) => (
                <span key={h.id} className="comm-highlight-chip">
                  <strong>{h.handle}</strong>
                  <span className="comm-highlight-chip__sub">{h.label}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="comm-mobile-only">
            <FilterToolbar {...filterProps} />
          </div>

          <section className="comm-feed" aria-label="Sightings from the community">
            {feed.length === 0 ? (
              <div className="comm-empty">
                <p className="comm-empty-title">No posts match these filters</p>
                <p className="comm-empty-text">Try another tag, clear the search, or pick a different beach.</p>
              </div>
            ) : (
              feed.map((s) => <FeedPost key={s.id} sighting={s} />)
            )}
          </section>

          <div className="comm-mobile-only comm-mobile-only--after-feed">
            <ComposerBlock {...composerProps} />
          </div>
        </main>

        <aside className="comm-aside" aria-label="Filters and new post">
          <div className="comm-aside__sticky">
            <FilterToolbar {...filterProps} />
            <ComposerBlock {...composerProps} />
          </div>
        </aside>
      </div>

      <div className="wf-page-footer-links comm-footer">
        <Link to="/challenges">Challenges</Link>
        <Link to="/explore">Explore</Link>
        <Link to="/marine-life">Marine life</Link>
        <Link to="/dashboard">Dashboard</Link>
      </div>
    </div>
  );
}

export default CommunityPage;
