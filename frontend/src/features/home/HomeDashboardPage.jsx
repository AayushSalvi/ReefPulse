/**
 * ReefPulse — Marketing / landing home (full-bleed)
 *
 * Route: `/`  ·  Styles: `./home.css`
 *
 * Purpose: Hero + “safest beaches” showcase + species highlights + CTAs into the app.
 * Data: `locationsBySafety()` from `../../data/mockData.js` for beach ordering only.
 */
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { locationsBySafety } from "../../data/mockData";
import "./home.css";

const HERO_FISH_COLOR = "#5866A7";

/** Cursor low-pass — school does not jerk on fast pointer moves. */
const CURSOR_SMOOTH = 0.05;
const FISH_LERP_MIN = 0.026;
const FISH_LERP_MAX = 0.046;

const FISH_BODY_RADIUS = { md: 42, sm: 35, xs: 29 };

/** All fish swim only under the tagline; offsets spread targets around the cursor (horizontal band). */
const HERO_FISH_SCHOOL = (() => {
  const n = 12;
  const sizes = ["md", "sm", "sm", "xs", "xs", "xs", "md", "sm", "xs", "xs", "sm", "xs"];
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2 + 0.35;
    const r = 38 + (i % 4) * 14;
    return {
      size: sizes[i],
      lerp: 0.027 + (i % 6) * 0.0028,
      ox: Math.cos(t) * r,
      oy: Math.sin(t) * Math.min(18, r * 0.22),
    };
  });
})();

function HeroFishSvg({ w = 88, h = 44 }) {
  return (
    <svg
      className="home-hero-fish-svg"
      viewBox="0 0 96 48"
      width={w}
      height={h}
      xmlns="http://www.w3.org/2000/svg"
    >
      <ellipse
        cx="34"
        cy="24"
        rx="26"
        ry="13"
        fill="rgba(88, 102, 167, 0.32)"
        stroke={HERO_FISH_COLOR}
        strokeWidth="1.2"
      />
      <polygon
        points="58,24 90,11 90,37"
        fill="rgba(88, 102, 167, 0.32)"
        stroke={HERO_FISH_COLOR}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <circle cx="18" cy="24" r="2.75" fill={HERO_FISH_COLOR} />
    </svg>
  );
}

/**
 * Fish only under the tagline; smoothed cursor, slow lerp, separation so bodies do not stack.
 */
function HomeHeroFishSchool({ heroRef, fieldRef, swimZoneRef }) {
  const fishElsRef = useRef([]);
  const posRef = useRef(HERO_FISH_SCHOOL.map(() => ({ x: 0, y: 0 })));
  const angleRef = useRef(HERO_FISH_SCHOOL.map(() => 0));
  const rawCursorRef = useRef({ x: 0, y: 0 });
  const smoothCursorRef = useRef({ x: 0, y: 0 });
  const rafRef = useRef(0);

  useEffect(() => {
    const hero = heroRef.current;
    const field = fieldRef.current;
    const swim = swimZoneRef.current;
    if (!hero || !field || !swim) return;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    const rectRelToField = (el) => {
      const fr = field.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      return {
        left: r.left - fr.left,
        top: r.top - fr.top,
        width: r.width,
        height: r.height,
      };
    };

    const margin = (size) => {
      if (size === "xs") return { x: 24, y: 12 };
      if (size === "sm") return { x: 30, y: 14 };
      return { x: 36, y: 16 };
    };

    const clampInSwim = (x, y, size) => {
      const z = rectRelToField(swim);
      const m = margin(size);
      return {
        x: clamp(x, z.left + m.x, z.left + z.width - m.x),
        y: clamp(y, z.top + m.y, z.top + z.height - m.y),
      };
    };

    const resetPositions = () => {
      const z = rectRelToField(swim);
      const n = HERO_FISH_SCHOOL.length;
      HERO_FISH_SCHOOL.forEach((cfg, i) => {
        const t = (i + 0.5) / n;
        posRef.current[i] = {
          x: z.left + t * z.width,
          y: z.top + z.height / 2,
        };
      });
      const fr = field.getBoundingClientRect();
      const cx = fr.width / 2;
      const cy = fr.height / 2;
      rawCursorRef.current = { x: cx, y: cy };
      smoothCursorRef.current = { x: cx, y: cy };
    };

    resetPositions();

    const onPointerMove = (e) => {
      const fr = field.getBoundingClientRect();
      rawCursorRef.current = {
        x: clamp(e.clientX - fr.left, 8, fr.width - 8),
        y: clamp(e.clientY - fr.top, 8, fr.height - 8),
      };
    };

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const applyFish = (i, x, y, deg) => {
      const el = fishElsRef.current[i];
      if (!el) return;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.transform = `translate(-50%, -50%) rotate(${deg}deg)`;
    };

    const separateAndClamp = () => {
      const n = HERO_FISH_SCHOOL.length;
      const radii = HERO_FISH_SCHOOL.map((c) => FISH_BODY_RADIUS[c.size] ?? 36);
      for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const pi = posRef.current[i];
            const pj = posRef.current[j];
            let dx = pi.x - pj.x;
            let dy = pi.y - pj.y;
            let d = Math.hypot(dx, dy);
            const minD = radii[i] + radii[j] + 4;
            if (d < 0.001) {
              dx = 0.4;
              dy = 0;
              d = 0.4;
            }
            if (d < minD) {
              const push = ((minD - d) / d) * 0.5;
              pi.x += dx * push;
              pi.y += dy * push;
              pj.x -= dx * push;
              pj.y -= dy * push;
            }
          }
        }
      }
      HERO_FISH_SCHOOL.forEach((cfg, i) => {
        Object.assign(posRef.current[i], clampInSwim(posRef.current[i].x, posRef.current[i].y, cfg.size));
      });
    };

    if (reduced) {
      const snap = () => {
        const sc = smoothCursorRef.current;
        HERO_FISH_SCHOOL.forEach((cfg, i) => {
          const t = clampInSwim(sc.x + cfg.ox, sc.y + cfg.oy, cfg.size);
          posRef.current[i] = { ...t };
        });
        separateAndClamp();
        HERO_FISH_SCHOOL.forEach((cfg, i) => {
          const p = posRef.current[i];
          const ang = (Math.atan2(sc.y - p.y, sc.x - p.x) * 180) / Math.PI;
          angleRef.current[i] = ang;
          applyFish(i, p.x, p.y, ang);
        });
      };

      const onMove = (e) => {
        onPointerMove(e);
        smoothCursorRef.current = { ...rawCursorRef.current };
        snap();
      };

      hero.addEventListener("pointermove", onMove);
      window.addEventListener("resize", resetPositions);
      snap();
      return () => {
        hero.removeEventListener("pointermove", onMove);
        window.removeEventListener("resize", resetPositions);
      };
    }

    const tick = () => {
      const raw = rawCursorRef.current;
      const sm = smoothCursorRef.current;
      sm.x += (raw.x - sm.x) * CURSOR_SMOOTH;
      sm.y += (raw.y - sm.y) * CURSOR_SMOOTH;

      HERO_FISH_SCHOOL.forEach((cfg, i) => {
        const t = clampInSwim(sm.x + cfg.ox, sm.y + cfg.oy, cfg.size);
        const p = posRef.current[i];
        const k = clamp(cfg.lerp, FISH_LERP_MIN, FISH_LERP_MAX);
        p.x += (t.x - p.x) * k;
        p.y += (t.y - p.y) * k;
      });

      separateAndClamp();

      HERO_FISH_SCHOOL.forEach((cfg, i) => {
        const p = posRef.current[i];
        const t = clampInSwim(sm.x + cfg.ox, sm.y + cfg.oy, cfg.size);
        const dx = t.x - p.x;
        const dy = t.y - p.y;
        angleRef.current[i] = (Math.atan2(dy, dx) * 180) / Math.PI;
        applyFish(i, p.x, p.y, angleRef.current[i]);
      });

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    hero.addEventListener("pointermove", onPointerMove);
    window.addEventListener("resize", resetPositions);

    return () => {
      cancelAnimationFrame(rafRef.current);
      hero.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", resetPositions);
    };
  }, [heroRef, fieldRef, swimZoneRef]);

  const sizeClass = (size) =>
    size === "xs" ? "home-hero-fish--xs" : size === "sm" ? "home-hero-fish--sm" : "home-hero-fish--md";

  return (
    <div className="home-hero-fish-layer" aria-hidden>
      {HERO_FISH_SCHOOL.map((cfg, i) => (
        <div
          key={i}
          ref={(el) => {
            fishElsRef.current[i] = el;
          }}
          className={`home-hero-fish ${sizeClass(cfg.size)}`}
        >
          <HeroFishSvg
            w={cfg.size === "xs" ? 56 : cfg.size === "sm" ? 72 : 88}
            h={cfg.size === "xs" ? 28 : cfg.size === "sm" ? 36 : 44}
          />
        </div>
      ))}
    </div>
  );
}

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
  {
    name: "Giant Kelp Forests",
    tag: "Restoration",
    tagClass: "home-tag--teal",
    desc: "Canopy growth improving — snorkel-friendly near protected coves.",
    img: "https://images.unsplash.com/photo-1551244072-5d12893278db?w=400&q=80",
  },
  {
    name: "Garibaldi",
    tag: "Protected",
    tagClass: "home-tag--blue",
    desc: "California’s state fish — bright nests visible in rocky shallows.",
    img: "https://images.unsplash.com/photo-1528164344705-32ef40c05fb7?w=400&q=80",
  },
  {
    name: "Leopard Sharks",
    tag: "Shallow Bay",
    tagClass: "home-tag--teal",
    desc: "Gentle daytime aggregations in warm bays; give them space.",
    img: "https://images.unsplash.com/photo-1615259411995-21e92219b8dc?w=400&q=80",
  },
  {
    name: "California Sea Lions",
    tag: "Active",
    tagClass: "home-tag--warn",
    desc: "Busy haul-outs — keep distance on rocks and near marinas.",
    img: "https://images.unsplash.com/photo-1569826228932-6eec7f09bcec?w=400&q=80",
  },
];

function HomeDashboardPage() {
  const safest = locationsBySafety();
  const topBeach = safest[0];
  const nextBeaches = safest.slice(1, 4);
  const homeHeroRef = useRef(null);
  const homeHeroFishFieldRef = useRef(null);
  const homeHeroFishSwimZoneRef = useRef(null);

  return (
    <div className="home">
      {/* —— Hero + live stats strip —— */}
      <section
        ref={homeHeroRef}
        className="home-hero"
        aria-labelledby="home-hero-heading"
      >
        <div className="home-hero-inner">
          <h1 id="home-hero-heading" className="home-hero-title">
            ReefPulse
          </h1>
          <p className="home-hero-sub">Know the Ocean Before You Go</p>
          <div className="home-hero-actions">
            <Link to="/oracle" className="home-hero-oracle-btn">
              Consult Ocean Oracle
            </Link>
          </div>
          <div ref={homeHeroFishFieldRef} className="home-hero-fish-field">
            <div
              ref={homeHeroFishSwimZoneRef}
              className="home-hero-fish-zone home-hero-fish-zone--swim"
            />
            <HomeHeroFishSchool
              heroRef={homeHeroRef}
              fieldRef={homeHeroFishFieldRef}
              swimZoneRef={homeHeroFishSwimZoneRef}
            />
          </div>
        </div>
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

      {/* Animated wave between beaches (shore) and marine life (open water) */}
      <div className="home-wave-bridge" aria-hidden="true">
        <div className="home-wave-track">
          <div className="home-wave-marquee">
            <svg
              className="home-wave-chunk"
              viewBox="0 0 1000 100"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="var(--home-white)"
                d="M0,52 Q250,8 500,52 T1000,52 L1000,100 L0,100 Z"
              />
            </svg>
            <svg
              className="home-wave-chunk"
              viewBox="0 0 1000 100"
              preserveAspectRatio="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill="var(--home-white)"
                d="M0,52 Q250,8 500,52 T1000,52 L1000,100 L0,100 Z"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* —— Species / editorial cards —— */}
      <section className="home-marine" aria-labelledby="marine-heading">
        <div className="home-section-head home-marine-head">
          <div>
            <p className="home-kicker">ECO-MONITORING</p>
            <h2 id="marine-heading" className="home-section-title">
              Trending Marine Life
            </h2>
            <p className="home-marine-lede">
              From the safest shoreline picks above to what is moving offshore — a
              quick read on species our community and sensors are watching this week.
            </p>
          </div>
          <Link to="/marine-life" className="home-link-map home-marine-cta">
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
