/**
 * ReefPulse — User Dashboard (general forecasting for recreational ocean activities)
 *
 * Route: `/dashboard`  ·  Styles: `./dashboard.css`
 *
 * Frames nearest-beach demo data as a planning view for swimming, snorkeling, surfing,
 * and beach days: safety outlook, go / no-go context, conditions, and 14-day trend chart.
 * Visualizations use CSS + inline SVG only (no chart library).
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchRecreationFusion } from "../../api/safetyFusion";
import {
  forecastOutlook,
  nearestLocation,
  snorkelRecommendation,
} from "../../data/mockData";
import "./dashboard.css";

const FALLBACK = { lat: 32.854, lng: -117.25, label: "Demo: near La Jolla" };

const TEMP_LEGEND = "#5eb8e8";
const HAB_LEGEND = "#dfff4f";

/** Plain-language recreational focus for today (mirrors Explore location helper). */
function recreationalOutlookLine(loc) {
  const acts = loc.activities || [];
  if (acts.includes("surfing") && loc.waveFt >= 3.5) {
    return "Surf-leaning pattern: waves drive the week — plan shore entry and snorkeling only inside guarded, sheltered zones.";
  }
  if (loc.safetyIndex >= 85 && loc.waveFt <= 3.5) {
    return "Generally favorable for snorkeling, easy swimming, and family beach time in this demo window.";
  }
  if (loc.safetyIndex >= 80) {
    return "Swimming and wading are reasonable in marked zones; snorkeling if you are OK with light surge and wind chop.";
  }
  return "In-water recreation needs extra caution this week; fishing from shore or beach walking may be the safer picks.";
}

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

/** `dark` = vitals strip; `light` = white panels (navy / teal / amber per ReefPulse chrome). */
function SafetyGauge({ value, surface = "dark" }) {
  const v = clamp(value, 0, 100);
  const isLight = surface === "light";
  const stroke = isLight
    ? v >= 82
      ? "#0f766e"
      : v >= 72
        ? "#d97706"
        : "#dc2626"
    : v >= 82
      ? "#dfff4f"
      : v >= 72
        ? "#fbbf24"
        : "#fca5a5";
  const track = isLight ? "#e2e8f0" : "rgba(255,255,255,0.18)";
  return (
    <svg
      className={`dash-gauge ${isLight ? "dash-gauge--light" : ""}`}
      viewBox="0 0 112 64"
      aria-hidden
    >
      <path
        d="M 12 52 A 44 44 0 0 1 100 52"
        fill="none"
        stroke={track}
        strokeWidth="7"
        strokeLinecap="round"
        pathLength="100"
      />
      <path
        d="M 12 52 A 44 44 0 0 1 100 52"
        fill="none"
        stroke={stroke}
        strokeWidth="7"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray={`${v} 100`}
      />
    </svg>
  );
}

function SparklineTemps({ temps }) {
  const w = 120;
  const h = 28;
  const pad = 4;
  const min = Math.min(...temps);
  const max = Math.max(...temps);
  const span = max - min || 1;
  const pts = temps.map((t, i) => {
    const x = pad + (i / (temps.length - 1 || 1)) * (w - pad * 2);
    const y = h - pad - ((t - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg className="dash-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        fill="none"
        stroke="var(--rp-navy, #1b254b)"
        strokeOpacity={0.75}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
      />
    </svg>
  );
}

function UserDashboardPage() {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fusion, setFusion] = useState(null);
  const [fusionError, setFusionError] = useState(null);
  const [fusionLoading, setFusionLoading] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) {
      setCoords(FALLBACK);
      setError("Geolocation not supported — demo location.");
      setLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          label: "Your location",
        });
        setLoading(false);
      },
      () => {
        setCoords(FALLBACK);
        setError("Location denied — demo point near La Jolla.");
        setLoading(false);
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 60_000 },
    );
  }, []);

  useEffect(() => {
    if (loading || !coords) return;
    const { location: loc } = nearestLocation(coords.lat, coords.lng);
    let cancelled = false;
    setFusionLoading(true);
    setFusionError(null);
    fetchRecreationFusion(loc.id)
      .then((data) => {
        if (!cancelled) setFusion(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setFusion(null);
          setFusionError(
            err instanceof Error ? err.message : "Safety API unreachable",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setFusionLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loading, coords]);

  const future14 = useMemo(() => forecastOutlook.slice(0, 14), []);

  const chartSeries = useMemo(() => {
    if (!future14.length) return [];
    return future14.map((d, i) => {
      const wobble = Math.sin(i * 0.85) * 2.4 + (i % 4) * 0.35;
      return { ...d, tempF: 62 + wobble + d.bloomPct * 0.04 };
    });
  }, [future14]);

  const chartBars = useMemo(() => {
    if (!chartSeries.length) return [];
    const temps = chartSeries.map((r) => r.tempF);
    const minT = Math.min(...temps);
    const maxT = Math.max(...temps);
    return chartSeries.map((d, i) => {
      const tempNorm = maxT === minT ? 0.55 : (d.tempF - minT) / (maxT - minT);
      const tempPct = 36 + tempNorm * 44;
      const habPct = (d.bloomPct / 100) * 30;
      let tPct = tempPct;
      let hPct = habPct;
      const sum = tPct + hPct;
      if (sum > 86) {
        const s = 86 / sum;
        tPct *= s;
        hPct *= s;
      }
      return {
        ...d,
        tempPct: tPct,
        habPct: hPct,
        tempF: Math.round(d.tempF * 10) / 10,
      };
    });
  }, [chartSeries]);

  const sparkTemps = useMemo(() => {
    if (!chartSeries.length) return [62, 63, 62.5, 64, 63.2, 64.1, 63.8];
    return chartSeries.slice(0, 7).map((r) => r.tempF);
  }, [chartSeries]);

  const activeFusionFlags = useMemo(() => {
    if (!fusion?.public_flags || typeof fusion.public_flags !== "object")
      return [];
    return Object.entries(fusion.public_flags).filter(([, on]) => on);
  }, [fusion]);

  if (loading || !coords) {
    return (
      <div
        className="dash-wrap"
        style={{
          padding: "1.25rem",
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}
      >
        <p style={{ margin: 0 }}>Loading dashboard…</p>
      </div>
    );
  }

  const { location, distanceKm } = nearestLocation(coords.lat, coords.lng);
  const safetyIndexLive =
    fusion && typeof fusion.safety_index === "number"
      ? fusion.safety_index
      : null;
  const safetyIndex = safetyIndexLive ?? location.safetyIndex;
  const locationForSafety = { ...location, safetyIndex };
  const verdict = snorkelRecommendation(locationForSafety);
  const outlookLine = recreationalOutlookLine(locationForSafety);
  const hasAlerts = location.activeAlerts.length > 0;
  const alertCount = location.activeAlerts.length;

  const waterPct = clamp(
    ((location.waterTempF - 48) / (78 - 48)) * 100,
    4,
    100,
  );
  const wavePct = clamp((location.waveFt / 7) * 100, 4, 100);
  const windPct = clamp((location.windMph / 32) * 100, 4, 100);
  const rainPct = clamp(location.rainChancePct, 0, 100);

  return (
    <div className="dash-wrap">
      <nav
        className="rp-breadcrumb"
        aria-label="Breadcrumb"
        style={{ marginBottom: "1rem" }}
      >
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <span aria-current="page">Dashboard</span>
      </nav>

      <header className="dash-dash-head">
        <p className="dash-dash-head__kicker">Recreational ocean forecast</p>
        <h1 className="dash-dash-head__title">General Forecast</h1>
        <p className="dash-dash-head__meta">
          <strong>{location.region}</strong> · ~{distanceKm.toFixed(1)} km from{" "}
          {coords.label}
              {error ? ` · ${error}` : ""}
            </p>
        <p className="dash-dash-head__lede">
          General forecasting for{" "}
          <strong>swimming, snorkeling, surfing, and beach days</strong> — not a
          replacement for lifeguard flags, tide tables, or your own skill
          assessment.
        </p>
        {fusionLoading ? (
          <p
            className="dash-dash-head__api dash-dash-head__api--pending"
            role="status"
          >
            Loading live safety index from the ReefPulse API…
          </p>
        ) : null}
        {fusionError ? (
          <p
            className="dash-dash-head__api dash-dash-head__api--warn"
            role="status"
          >
            Safety index fallback: demo values ({fusionError}). Start the
            backend on port 8000 or set{" "}
            <code className="dash-inline-code">VITE_API_BASE_URL</code>.
          </p>
        ) : null}
        {fusion && !fusionError ? (
          <p
            className="dash-dash-head__api dash-dash-head__api--ok"
            role="status"
          >
            Activity safety index is <strong>live</strong> from the API (Model B
            always; Model A when a checkpoint is configured). Waves, rain, and
            the 14-day chart below remain demo fixtures for this screen.
          </p>
        ) : null}
        <ul
          className="dash-dash-head__acts"
          aria-label="Activity coverage in this demo"
        >
          <li>Swim / wade</li>
          <li>Snorkel</li>
          <li>Surf</li>
          <li>Beach &amp; tidepool</li>
        </ul>
        <div className="dash-dash-head__links">
          <Link
            className="dash-dash-head__btn dash-dash-head__btn--primary"
            to={`/explore/${location.id}`}
          >
            Open in Explore
          </Link>
        </div>
      </header>

      {/* —— Vitals strip (recreation-oriented snapshot) —— */}
      <section
        className="dash-vitals"
        aria-label="Recreation forecast snapshot"
      >
        <article className="dash-vital dash-vital--safety">
          <p className="dash-vital__label">Activity safety index</p>
          <div className="dash-vital__hero">
            <span className="dash-vital__num">{safetyIndex}</span>
            <SafetyGauge value={safetyIndex} surface="dark" />
          </div>
          <p className="dash-vital__foot">
            {fusion
              ? `0–100 · API fusion (${fusion.model_a_used ? "forecast + anomaly" : "anomaly-only"})`
              : "0–100 demo · in-water comfort and hazard blend"}
          </p>
        </article>
        <article
          className={`dash-vital dash-vital--alert ${hasAlerts ? "dash-vital--alert-warn" : ""}`}
        >
          <p className="dash-vital__label">Ocean &amp; HAB alerts</p>
          <p className="dash-vital__big">
            <span className="dash-vital__accent">{alertCount}</span>
            <span className="dash-vital__suffix">
              {alertCount === 1 ? " advisory" : " advisories"}
            </span>
          </p>
          <p className="dash-vital__foot">
            {hasAlerts
              ? "Check before swim or snorkel"
              : "No demo closures this week"}
          </p>
        </article>
        <article className="dash-vital dash-vital--temp">
          <p className="dash-vital__label">Sea-surface comfort (°F)</p>
          <p className="dash-vital__big dash-vital__big--dark">
            {location.waterTempF}
            <span className="dash-vital__unit">°F</span>
          </p>
          <div className="dash-vital__spark-wrap">
            <SparklineTemps temps={sparkTemps} />
              </div>
          <p className="dash-vital__foot dash-vital__foot--dark">
            7-day outlook strip (demo)
          </p>
        </article>
        <article className="dash-vital dash-vital--surf">
          <p className="dash-vital__label">Surf &amp; wind chop</p>
          <div className="dash-vital__dual">
            <div>
              <span className="dash-vital__dual-val">{location.waveFt}</span>
              <span className="dash-vital__dual-unit">ft waves</span>
            </div>
            <div>
              <span className="dash-vital__dual-val">{location.windMph}</span>
              <span className="dash-vital__dual-unit">mph wind</span>
            </div>
          </div>
          <div className="dash-vital__microbars" aria-hidden>
            <span
              style={{ width: `${wavePct}%` }}
              className="dash-vital__microbar dash-vital__microbar--wave"
            />
            <span
              style={{ width: `${windPct}%` }}
              className="dash-vital__microbar dash-vital__microbar--wind"
            />
          </div>
        </article>
      </section>

      <div className="dash-main-split">
        {/* —— Safety + verdict —— */}
        <section
          className="dash-panel dash-panel--accent"
          aria-labelledby="dash-safety-title"
        >
          <h2 id="dash-safety-title" className="dash-panel__title">
            Go / no-go for in-water play
          </h2>
          <div className="dash-panel__gauge-block">
            <div className="dash-big-gauge">
              <div className="dash-big-gauge__svg">
                <SafetyGauge value={safetyIndex} surface="light" />
              </div>
              <div className="dash-big-gauge__label">
                <span className="dash-big-gauge__value">{safetyIndex}</span>
                <span className="dash-big-gauge__sub">out of 100</span>
              </div>
            </div>
            {fusion?.beach_condition ? (
              <p className="dash-beach-band">
                <span className="dash-beach-band__label">
                  Beach condition (API)
                </span>
                <span
                  className={`dash-beach-band__pill dash-beach-band__pill--${fusion.beach_condition}`}
                >
                  {fusion.beach_condition.replace(/-/g, " ")}
                </span>
              </p>
            ) : null}
            <div
              className={`dash-verdict dash-verdict--${verdict.tone} dash-verdict--block`}
            >
              {verdict.label}
            </div>
            <p className="dash-panel__muted dash-panel__muted--emph">
              {outlookLine}
            </p>
            {fusion?.narrative ? (
              <p className="dash-panel__muted dash-panel__muted--emph">
                {fusion.narrative}
              </p>
            ) : null}
            {activeFusionFlags.length ? (
              <ul
                className="dash-fusion-flags"
                aria-label="Ocean stress flags from API"
              >
                {activeFusionFlags.map(([key]) => (
                  <li key={key}>{key.replace(/_/g, " ")}</li>
                ))}
              </ul>
            ) : null}
            <p className="dash-panel__muted">
              {fusion
                ? "The live score fuses the state forecaster and anomaly detector on the backend; this panel still blends in demo waves and weather for layout. Not a regulatory forecast — follow lifeguards and posted flags."
                : "The index blends waves, wind, rain, algae narrative, and demo hazards into one recreational read — not a regulatory forecast. Always follow lifeguards and posted flags."}
            </p>
          </div>
        </section>

        {/* —— Conditions as bar meters —— */}
        <section className="dash-panel" aria-labelledby="dash-cond-title">
          <h2 id="dash-cond-title" className="dash-panel__title">
            {"Today's drivers for ocean recreation"}
          </h2>
          <ul className="dash-meters">
            <li>
              <div className="dash-meter__head">
                <span>Water comfort (swim / snorkel)</span>
          <strong>{location.waterTempF}°F</strong>
        </div>
              <div className="dash-meter__track">
                <span
                  className="dash-meter__fill dash-meter__fill--water"
                  style={{ width: `${waterPct}%` }}
                />
              </div>
            </li>
            <li>
              <div className="dash-meter__head">
                <span>Wave exposure (surf &amp; surge)</span>
          <strong>{location.waveFt} ft</strong>
        </div>
              <div className="dash-meter__track">
                <span
                  className="dash-meter__fill dash-meter__fill--wave"
                  style={{ width: `${wavePct}%` }}
                />
              </div>
            </li>
            <li>
              <div className="dash-meter__head">
                <span>Wind chop &amp; drift</span>
          <strong>{location.windMph} mph</strong>
        </div>
              <div className="dash-meter__track">
                <span
                  className="dash-meter__fill dash-meter__fill--wind"
                  style={{ width: `${windPct}%` }}
                />
              </div>
            </li>
            <li>
              <div className="dash-meter__head">
                <span>Rain (beach day washout)</span>
          <strong>{location.rainChancePct}%</strong>
        </div>
              <div className="dash-meter__track">
                <span
                  className="dash-meter__fill dash-meter__fill--rain"
                  style={{ width: `${rainPct}%` }}
                />
        </div>
            </li>
          </ul>
          <p className="dash-panel__muted dash-panel__muted--tight">
            <strong>Algal / HAB (recreation angle):</strong>{" "}
            {location.algalRisk} — higher concern days suggest limiting
            face-in-water time and rinsing after swims.
            {location.hazardBadges?.length
              ? ` · Flags / hazards: ${location.hazardBadges.join(", ")}`
              : ""}
          </p>
          {hasAlerts ? (
            <p className="dash-panel__alertbox" role="status">
              <strong>Advisories:</strong> {location.activeAlerts.join(" · ")}
            </p>
          ) : null}
        </section>
      </div>

      {/* —— 14-day stacked chart —— */}
      <section className="dash-chart-card" aria-labelledby="dash-chart-title">
        <div className="dash-chart-card__head">
          <div>
            <h2 id="dash-chart-title" className="dash-chart-card__title">
              14-day outlook for ocean recreation
            </h2>
            <p className="dash-chart-card__sub">
              General forward view for <strong>{location.name}</strong>: modeled
              nearshore comfort temperature (°F) for swim / snorkel days,
              stacked with a demo <strong>HAB bloom index</strong> so you can
              see when water-quality risk rises relative to temperature — demo
              series shown only on this dashboard.
            </p>
          </div>
          <ul className="dash-chart-legend" aria-label="Legend">
            <li>
              <span
                className="dash-chart-legend__swatch"
                style={{ background: TEMP_LEGEND }}
              />
              Comfort temp
            </li>
            <li>
              <span
                className="dash-chart-legend__swatch dash-chart-legend__swatch--hab"
                style={{ background: HAB_LEGEND }}
              />
              HAB index
            </li>
          </ul>
        </div>
        <div
          className="dash-chart__plot"
          role="img"
          aria-label="Fourteen day stacked comfort temperature and harmful algal bloom index bars"
        >
          {chartBars.map((row) => (
            <div key={row.label} className="dash-chart-col">
              <div className="dash-chart-col__stack">
                <div
                  className="dash-chart-bar dash-chart-bar--temp"
                  style={{ height: `${row.tempPct}%` }}
                  title={`${row.tempF}°F`}
                />
                <div
                  className="dash-chart-bar dash-chart-bar--hab"
                  style={{ height: `${row.habPct}%` }}
                  title={`HAB index ${row.bloomPct}%`}
                />
      </div>
              <span className="dash-chart-col__date">{row.short}</span>
          </div>
        ))}
      </div>
        <p className="dash-chart-card__note">
          Read stacked bars as{" "}
          <span style={{ color: TEMP_LEGEND }}>thermal comfort band</span> plus{" "}
          <span style={{ color: "#b5c94a" }}>HAB pressure on top</span> — use
          with tide, surf, and your activity level.{" "}
          <Link to={`/explore/${location.id}`}>Species cards for this beach in Explore</Link>.
        </p>
      </section>
    </div>
  );
}

export default UserDashboardPage;
