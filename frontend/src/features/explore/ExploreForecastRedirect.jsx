/**
 * ReefPulse — Deep link helper for forecast tab
 *
 * Route: `/explore/:locationId/forecast`
 * Behavior: Immediately replaces URL with `/explore/:locationId?tab=forecast` so the
 *           single `ExploreLocationPage` implementation owns all tab state.
 */
import { Navigate, useParams } from "react-router-dom";

function ExploreForecastRedirect() {
  const { locationId } = useParams();
  return <Navigate to={`/explore/${locationId}?tab=forecast`} replace />;
}

export default ExploreForecastRedirect;
