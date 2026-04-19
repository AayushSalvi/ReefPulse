/**
 * ReefPulse — User Dashboard (personalized “closest beach”)
 *
 * Route: `/dashboard`
 * Co-located styles: `./dashboard.css`
 *
 * Page flow (vertical):
 *   1) Breadcrumb
 *   2) Quick alert badge (from nearest location’s activeAlerts)
 *   3) Hero: closest beach name, verdict, safety, mini-map visual, primary CTAs
 *   4) Condition metric cards (water, waves, wind, rain, algal, safety)
 *   5) Species preview strip (horizontal scroll)
 *   6) Recent / nearby community sightings
 *   7) Quick action buttons + Explore CTA card + “why this page” aside
 *
 * Data: `nearestLocation` + demo sightings from `../../data/mockData.js`.
 * Geolocation: requests user coords; falls back to La Jolla demo point if denied.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { nearestLocation, sightingsRecent, snorkelRecommendation } from "../../data/mockData";
import "./dashboard.css";

const FALLBACK = { lat: 32.854, lng: -117.25, label: "Demo: near La Jolla" };

const speciesImg = [
  "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=200&q=80",
  "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=200&q=80",
  "https://images.unsplash.com/photo-1568430465619-251d0d42ad5e?w=200&q=80"
];

function UserDashboardPage() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords(FALLBACK);
      setError("Geolocation not supported — demo location.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: "Your location" });
        setLoading(false);
      },
      () => {
        setCoords(FALLBACK);
        setError("Location denied — demo point near La Jolla.");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 }
    );
  }, []);

  if (loading || !coords) {
    return (
      <div className="dash-wrap" style={{ padding: "1.25rem", background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <p style={{ margin: 0 }}>Loading dashboard…</p>
      </div>
    );
  }

  const { location, distanceKm } = nearestLocation(coords.lat, coords.lng);
  const sightings = sightingsRecent(5);
  const nearbySightings = sightings.filter((s) => s.locationId === location.id).slice(0, 3);
  const displaySightings = nearbySightings.length ? nearbySightings : sightings.slice(0, 3);
  const verdict = snorkelRecommendation(location);
  const hasAlerts = location.activeAlerts.length > 0;

  return (
    <div className="dash-wrap">
      {/* —— 1) Breadcrumb —— */}
      <nav className="rp-breadcrumb" aria-label="Breadcrumb" style={{ marginBottom: "1rem" }}>
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <span aria-current="page">Dashboard</span>
      </nav>

      {/* —— 2) Quick alert —— */}
      <div className={`dash-alert-badge ${hasAlerts ? "dash-alert-badge--warn" : "dash-alert-badge--ok"}`}>
        {hasAlerts ? `Alert · ${location.activeAlerts[0]}` : "Quick alert · No urgent warnings for closest beach"}
      </div>

      {/* —— 3) Hero: closest beach + verdict + map visual —— */}
      <section className="dash-hero" aria-labelledby="dash-hero-title">
        <div className="dash-hero-grid">
          <div>
            <p className="dash-hero-kicker">Closest beach near you</p>
            <h2 id="dash-hero-title">{location.name}</h2>
            <p className="dash-hero-meta">
              <strong>{location.region}</strong> · ~{distanceKm.toFixed(1)} km from {coords.label}
              {error ? ` · ${error}` : ""}
            </p>
            <div className="dash-verdict-row">
              <div className={`dash-verdict dash-verdict--${verdict.tone}`}>{verdict.label}</div>
              <div className="dash-safety-pill">
                Safety <strong>{location.safetyIndex}</strong>/100
              </div>
            </div>
            <div className="dash-hero-actions">
              <Link className="primary" to={`/explore/${location.id}`}>
                Explore this location
              </Link>
              <Link className="secondary" to="/marine-life">
                Explore marine life
              </Link>
            </div>
          </div>
          <div className="dash-hero-map" aria-hidden>
            <div className="dash-hero-map-inner" />
            <span className="dash-hero-map-pin" />
            <span className="dash-hero-map-cap">{location.name}</span>
          </div>
        </div>
      </section>

      {/* —— 4) Current conditions (metric cards) —— */}
      <p className="dash-section-title">Current beach conditions</p>
      <div className="dash-cards">
        <div className="dash-card">
          <small>Water temperature</small>
          <strong>{location.waterTempF}°F</strong>
        </div>
        <div className="dash-card">
          <small>Waves</small>
          <strong>{location.waveFt} ft</strong>
        </div>
        <div className="dash-card">
          <small>Wind</small>
          <strong>{location.windMph} mph</strong>
        </div>
        <div className="dash-card">
          <small>Rain chance</small>
          <strong>{location.rainChancePct}%</strong>
        </div>
        <div className="dash-card">
          <small>Algal activity</small>
          <strong style={{ fontSize: "1.05rem" }}>{location.algalRisk}</strong>
        </div>
        <div className="dash-card">
          <small>Safety level</small>
          <strong>{location.safetyIndex}</strong>
        </div>
      </div>

      {/* —— 5) Species preview carousel —— */}
      <p className="dash-section-title">Species that might appear now</p>
      <div className="dash-species-row" role="list" aria-label="Species preview carousel">
        {location.speciesPreview.map((name, i) => (
          <div key={name} className="dash-species-card" role="listitem">
            <div
              className="img"
              style={{
                backgroundImage: `url(${speciesImg[i % speciesImg.length]})`,
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            />
            <div className="body">{name}</div>
          </div>
        ))}
      </div>

      {/* —— 6) Community sightings —— */}
      <p className="dash-section-title">Recent community sightings</p>
      <div className="dash-sightings">
        {displaySightings.map((s) => (
          <div key={s.id} className="dash-sighting">
            <div className="dash-sighting-avatar" aria-hidden />
            <div className="dash-sighting-body">
              <strong>{s.species}</strong> at {s.locationName}
              <div>{s.text}</div>
              <span>
                {s.author} · {s.time}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* —— 7) Quick actions + Explore CTA + why-aside —— */}
      <p className="dash-section-title">Quick actions</p>
      <div className="dash-actions">
        <Link to={`/explore/${location.id}`}>Explore location</Link>
        <Link to="/marine-life">Explore marine life</Link>
        <Link className="outline" to="/community">
          Post what you saw
        </Link>
        <Link className="outline" to={`/explore/${location.id}?tab=forecast`}>
          View forecast
        </Link>
      </div>

      <div className="dash-explore-card">
        <h3>Explore this location</h3>
        <p>Open the full workspace: map, overview, past, forecast, and community tabs for {location.name}.</p>
        <Link to={`/explore/${location.id}`}>Go to Explore →</Link>
      </div>

      <aside className="dash-why" aria-labelledby="dash-why-title">
        <h3 id="dash-why-title">Why this page</h3>
        <p>
          This is your fast decision view: where to go right now, whether conditions support snorkeling, and what others are
          seeing — so you can pick a spot without digging through menus.
        </p>
      </aside>
    </div>
  );
}

export default UserDashboardPage;
