/**
 * ReefPulse — Explore index (no location selected)
 *
 * Route: `/explore` (nested default child of `ExploreLayout`)
 * Styles: `./explore-app.css` (inherited from parent import chain)
 *
 * Content:
 *   1) Static map hero card (prompt to use sidebar)
 *   2) “Top safety picks” grid linking to `/explore/:locationId`
 */
import { Link } from "react-router-dom";
import { locationsBySafety } from "../../data/mockData";
import ExploreGoogleMapPanel from "./ExploreGoogleMapPanel";
import "./explore-app.css";

function ExploreIndexPage() {
  const top = locationsBySafety().slice(0, 6);
  return (
    <div>
      {/* —— Google Map + search + lat/lng (see ExploreGoogleMapPanel) —— */}
      <ExploreGoogleMapPanel />

      {/* —— Curated quick links —— */}
      <p
        style={{
          margin: "0.5rem 0",
          fontWeight: 800,
          fontSize: "0.75rem",
          color: "#64748b",
          letterSpacing: "0.06em",
        }}
      >
        TOP SAFETY PICKS
      </p>
      <div className="ex-index-grid">
        {top.map((beach) => (
          <Link
            key={beach.id}
            to={`/explore/${beach.id}`}
            className="ex-index-card"
          >
            <strong style={{ color: "#1b254b" }}>{beach.name}</strong>
            <p
              style={{
                margin: "0.35rem 0 0",
                fontSize: "0.82rem",
                color: "#64748b",
              }}
            >
              {beach.region} · Safety {beach.safetyIndex}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default ExploreIndexPage;
