/**
 * ReefPulse — Marketing / landing home (full-bleed)
 *
 * Route: `/`  ·  Styles: `./home.css`
 *
 * Purpose: Hero + “safest beaches” showcase + species highlights + CTAs into the app.
 * Data: `locationsBySafety()` from `../../data/mockData.js` for beach ordering only.
 */
import { Link } from "react-router-dom";
import { locationsBySafety } from "../../data/mockData";
import "./home.css";

function IconGlobe() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconAnchor() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 22V8" />
      <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
      <circle cx="12" cy="5" r="3" />
    </svg>
  );
}

const beachThumbs = [
  "https://images.unsplash.com/photo-1519046904884-73407deabb2f?w=200&q=80",
  "https://images.unsplash.com/photo-1505118380757-91f5f5632de0?w=200&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=200&q=80",
];

const species = [
  {
    name: "Green Sea Turtle",
    tag: "Migration High",
    tagClass: "home-tag--teal",
    desc: "Peak sightings along kelp corridors this week.",
    img: "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=400&q=80",
  },
  {
    name: "Humpback Whales",
    tag: "Seasonal",
    tagClass: "home-tag--blue",
    desc: "Migrating pods reported off central coast.",
    img: "https://images.unsplash.com/photo-1568430465619-251d0d42ad5e?w=400&q=80",
  },
  {
    name: "Moon Jellyfish",
    tag: "Warning",
    tagClass: "home-tag--warn",
    desc: "Watch for sting hazards near shore breaks.",
    img: "https://images.unsplash.com/photo-1545671913-43e4dbec73b4?w=400&q=80",
  },
  {
    name: "Pacific Sardines",
    tag: "Bait Ball",
    tagClass: "home-tag--blue",
    desc: "Dense schools — great for divers, watch boat traffic.",
    img: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=400&q=80",
  },
];

function HomeDashboardPage() {
  const safest = locationsBySafety();
  const topBeach = safest[0];
  const nextBeaches = safest.slice(1, 4);

  return (
    <div className="home">
      {/* —— Hero + live stats strip —— */}
      <section className="home-hero" aria-labelledby="home-hero-heading">
        <h1 id="home-hero-heading" className="home-hero-title">
          ReefPulse
        </h1>
        <p className="home-hero-sub">Know the Ocean Before You Go</p>
      </section>

      {/* —— Safest beaches grid (driven by mock safety sort) —— */}
      <section
        className="home-beaches"
        id="coastal-map"
        aria-labelledby="beaches-heading"
      >
        <div className="home-section-head">
          <div>
            <p className="home-kicker">TOP RATED LOCATIONS</p>
            <h2 id="beaches-heading" className="home-section-title">
              Safest Beaches Today
            </h2>
          </div>
          <Link to="/explore" className="home-link-map">
            View full map →
          </Link>
        </div>

        <div className="home-beaches-grid">
          <Link to={`/explore/${topBeach.id}`} className="home-feature-card">
            <span className="home-feature-badge">High safety</span>
            <div className="home-feature-body">
              <h3>{topBeach.name}</h3>
              <p>
                {topBeach.region} — calm conditions for swimming and snorkeling.
                Safety index {topBeach.safetyIndex}.
              </p>
            </div>
          </Link>

          <div className="home-side-stack">
            {nextBeaches.map((b, i) => (
              <Link
                key={b.id}
                to={`/explore/${b.id}`}
                className="home-beach-row"
              >
                <div
                  className="home-beach-thumb"
                  style={{
                    backgroundImage: `url(${beachThumbs[i % beachThumbs.length]})`,
                  }}
                  role="img"
                  aria-hidden
                />
                <div>
                  <h4>{b.name}</h4>
                  <p>
                    {b.region} · {b.status}
                  </p>
                </div>
                <span className="home-score">{b.safetyIndex}%</span>
              </Link>
            ))}
            <div className="home-cta-card">
              <p>Plan your next expedition</p>
              <Link to="/explore" className="home-cta-btn">
                Explore locations
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* —— Species / editorial cards —— */}
      <section className="home-marine" aria-labelledby="marine-heading">
        <div className="home-section-head" style={{ marginBottom: 0 }}>
          <div>
            <p className="home-kicker">ECO-MONITORING</p>
            <h2 id="marine-heading" className="home-section-title">
              Trending Marine Life
            </h2>
          </div>
          <Link to="/marine-life" className="home-link-map">
            See all species →
          </Link>
        </div>
        <div className="home-marine-grid">
          {species.map((s) => (
            <article key={s.name} className="home-species-card">
              <div
                className="home-species-img"
                style={{ backgroundImage: `url(${s.img})` }}
              />
              <div className="home-species-body">
                <span className={`home-tag ${s.tagClass}`}>{s.tag}</span>
                <h4>{s.name}</h4>
                <p>{s.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* —— Newsletter CTA (static) —— */}
      <section className="home-newsletter" aria-labelledby="newsletter-heading">
        <div className="home-newsletter-inner">
          <p id="newsletter-heading">
            Never miss a pulse. Get real-time safety alerts and marine
            conservation updates delivered to your device.
          </p>
          <form
            className="home-newsletter-form"
            onSubmit={(e) => e.preventDefault()}
          >
            <label htmlFor="home-email" className="visually-hidden">
              Email
            </label>
            <input
              id="home-email"
              type="email"
              placeholder="Enter your email"
              autoComplete="email"
            />
            <button type="submit">Subscribe</button>
          </form>
        </div>
      </section>

      <footer className="home-footer" id="home-resources">
        <div className="home-footer-inner">
          <div>
            <div className="home-footer-brand">ReefPulse</div>
            <p className="home-footer-copy">
              © 2026 ReefPulse Monitoring Systems
            </p>
          </div>
          <nav className="home-footer-links" aria-label="Footer">
            <Link to="/explore">Explore</Link>
            <Link to="/marine-life">Marine life</Link>
            <Link to="/dashboard">Dashboard</Link>
            <Link to="/community">Community</Link>
            <a href="#privacy">Privacy</a>
            <a href="#faq">Safety FAQ</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="home-footer-icons" aria-hidden>
            <IconGlobe />
            <IconAnchor />
          </div>
        </div>
      </footer>
    </div>
  );
}

export default HomeDashboardPage;
