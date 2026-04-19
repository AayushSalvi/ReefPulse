/**
 * ReefPulse — Saved places & alerts hub
 *
 * Route: `/saved`  ·  Styles: `./saved-places.css`
 *
 * Columns: saved beach list (from mock `savedPlaceIds`) | manager/advisory feed (`managerFeed`).
 * Anchor: `#coastal-alerts` used from the global header “Alerts” shortcut.
 */
import { Link } from "react-router-dom";
import { managerFeed, savedPlaces } from "../../data/mockData";
import "./saved-places.css";

function SavedPlacesPage() {
  const saved = savedPlaces();

  return (
    <div className="saved-wrap wf-page">
      <nav className="rp-breadcrumb" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <span aria-current="page">Alerts &amp; saved</span>
      </nav>

      <div className="rp-page-title">
        <h1>Alerts &amp; saved places</h1>
        <p>Monitor favorite beaches and coastal advisories in one place.</p>
      </div>

      {/* Two-column content: saved list | advisory feed */}
      <section className="saved-grid" aria-labelledby="saved-locs-title">
        <div>
          <h2 id="saved-locs-title">Saved places</h2>
          <ul className="saved-list">
            {saved.map((loc) => (
              <li key={loc.id}>
                <Link to={`/explore/${loc.id}`}>
                  <strong>{loc.name}</strong>
                  <span>
                    {loc.region} · Safety {loc.safetyIndex}
                    {loc.activeAlerts.length ? ` · ${loc.activeAlerts.length} alert(s)` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="saved-hint">
            Tip: open <Link to="/explore">Explore</Link> from the dashboard to add more beaches to your routine.
          </p>
        </div>

        <aside className="saved-alerts" id="coastal-alerts" aria-labelledby="saved-feed-title">
          <h2 id="saved-feed-title">Manager feed &amp; advisories</h2>
          <ul>
            {managerFeed.map((row, i) => (
              <li key={i}>
                <span className="saved-type">{row.type}</span>
                <strong>{row.location}</strong>
                <p>{row.message}</p>
              </li>
            ))}
          </ul>
          <p className="saved-hint" style={{ marginBottom: 0 }}>
            Demo data — in production you would subscribe to SMS or push for these beaches.
          </p>
        </aside>
      </section>
    </div>
  );
}

export default SavedPlacesPage;
