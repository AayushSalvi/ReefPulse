/**
 * ReefPulse — Legacy URL compatibility
 *
 * Route: `/location/:locationId` (deprecated path)
 * Redirects to the Explore detail route so bookmarks keep working.
 */
import { Navigate, useParams } from "react-router-dom";

function LegacyLocationRedirect() {
  const { locationId } = useParams();
  return <Navigate to={`/explore/${locationId}`} replace />;
}

export default LegacyLocationRedirect;
