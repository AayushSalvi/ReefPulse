/**
 * ReefPulse — Legacy deep link `/explore/:locationId/forecast`
 *
 * Forecast tab was removed; opens the location species-card page.
 */
import { Navigate, useParams } from "react-router-dom";

function ExploreForecastRedirect() {
  const { locationId } = useParams();
  return <Navigate to={`/explore/${locationId}`} replace />;
}

export default ExploreForecastRedirect;
