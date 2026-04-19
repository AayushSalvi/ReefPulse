/**
 * ReefPulse — Explore index (no location selected)
 *
 * Route: `/explore` (nested default child of `ExploreLayout`)
 * Styles: `./explore-app.css` (inherited from parent import chain)
 *
 * Content: live map (Google or OpenStreetMap) + lat/lng; sidebar lists beaches and forecast from pin.
 */
import ExploreGoogleMapPanel from "./ExploreGoogleMapPanel";
import "./explore-app.css";

function ExploreIndexPage() {
  return (
    <div>
      <ExploreGoogleMapPanel />
      <p className="ex-index-after-map">
        Use the sidebar to search California beaches or ReefPulse spots. After you set a pin, your latitude and
        longitude appear in the sidebar with a <strong>See forecast</strong> shortcut to the nearest beach tab.
      </p>
    </div>
  );
}

export default ExploreIndexPage;
