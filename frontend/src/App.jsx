/**
 * ReefPulse — application routes
 *
 * Folder map (see `src/features/`):
 *   features/home/          → `/` marketing / home dashboard
 *   features/dashboard/     → `/dashboard` personalized “closest beach” view
 *   features/explore/       → `/explore`, `/explore/:locationId` location workspace + tabs
 *   features/marine-life/     → `/marine-life` species-first discovery
 *   features/community/     → `/community` posts & feed
 *   features/challenges/    → `/challenges` goals, badges, trophies
 *   features/saved/         → `/saved` alerts & saved places
 *   features/legacy/        → `/location/:id` redirects to Explore
 *   features/standalone/    → NOT routed here; optional admin / forecast UIs for future routes
 *
 * Shell: `layout/AppLayout.jsx` wraps all routes below except none (all under AppLayout).
 */
import { Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import ChallengesPage from "./features/challenges/ChallengesPage";
import CommunityPage from "./features/community/CommunityPage";
import ExploreForecastRedirect from "./features/explore/ExploreForecastRedirect";
import ExploreIndexPage from "./features/explore/ExploreIndexPage";
import ExploreLayout from "./features/explore/ExploreLayout";
import ExploreLocationPage from "./features/explore/ExploreLocationPage";
import HomeDashboardPage from "./features/home/HomeDashboardPage";
import LegacyLocationRedirect from "./features/legacy/LegacyLocationRedirect";
import MarineLifeDiscoveryPage from "./features/marine-life/MarineLifeDiscoveryPage";
import SavedPlacesPage from "./features/saved/SavedPlacesPage";
import UserDashboardPage from "./features/dashboard/UserDashboardPage";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* —— Public / marketing home —— */}
        <Route path="/" element={<HomeDashboardPage />} />

        {/* —— Explore: nested layout (sidebar + outlet) —— */}
        <Route path="/explore" element={<ExploreLayout />}>
          <Route index element={<ExploreIndexPage />} />
          <Route path=":locationId" element={<ExploreLocationPage />} />
          <Route path=":locationId/forecast" element={<ExploreForecastRedirect />} />
        </Route>

        {/* —— Other top-level app pages —— */}
        <Route path="/marine-life" element={<MarineLifeDiscoveryPage />} />
        <Route path="/dashboard" element={<UserDashboardPage />} />
        <Route path="/community" element={<CommunityPage />} />
        <Route path="/challenges" element={<ChallengesPage />} />
        <Route path="/saved" element={<SavedPlacesPage />} />

        {/* —— Back-compat deep links —— */}
        <Route path="/location/:locationId" element={<LegacyLocationRedirect />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
