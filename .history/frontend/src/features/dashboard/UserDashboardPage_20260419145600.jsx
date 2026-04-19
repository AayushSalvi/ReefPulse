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
import { postFusionBriefing } from "../../api/fusionBriefing";
import { postModelAForecast } from "../../api/oceanModels";
import { fetchRecreationFusion } from "../../api/safetyFusion";
import { nearestLocation, snorkelRecommendation } from "../../data/mockData";
import "./dashboard.css";

const FALLBACK = { lat: 32.854, lng: -117.25, label: "Demo: near La Jolla" };

const METRIC_COLORS = {
  temperature: "#38bdf8",
  salinity: "#8b5cf6",
  oxygen: "#22c55e",
  chlorophyll: "#d97706",
};

function agentDebugLog(
  hypothesisId,
  location,
  message,
  data = {},
  runId = "run1",
) {
  // #region agent log
  fetch("http://127.0.0.1:7299/ingest/b199d9fc-ddef-4145-9d59-b0f1ee99e6b6", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "ddf9dc",
    },
    body: JSON.stringify({
      sessionId: "ddf9dc",
      runId,
      hypothesisId,
      location,
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

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

function toCelsius(f) {
  return (f - 32) * (5 / 9);
}

function buildPastSeries(loc) {
  const tempBase = toCelsius(loc.waterTempF);
  const salinityBase = 33.6 + (loc.waveFt - 2.5) * 0.06;
  const oxygenBase = 6.1 - (tempBase - 16) * 0.11;
  const chlBase = Math.max(0.05, loc.rainChancePct / 220);
  return Array.from({ length: 30 }, (_, i) => {
    const cycle = Math.sin((i / 29) * Math.PI * 2);
    const cycleB = Math.cos((i / 29) * Math.PI * 1.4);
    return [
      Math.round((tempBase + cycle * 0.7 + cycleB * 0.2) * 1000) / 1000,
      Math.round((salinityBase + cycleB * 0.08) * 1000) / 1000,
      Math.round((oxygenBase - cycle * 0.18) * 1000) / 1000,
      Math.round((chlBase + Math.max(0, cycle) * 0.09) * 1000) / 1000,
    ];
  });
}

/** `dark` = vitals strip; `light` = white panels (navy / teal / amber per ReefPulse chrome). */
function SafetyGauge({ value, surface = "dark" }) {
  const v = clamp(value, 0, 100);
  const isLight = surface === "light";
  const stroke = isLight
    ? v >= 82
      ? "#0f766e"
      : v >= 72
        ? "#D9F274"
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

function MetricSparkline({ values, color }) {
  const w = 220;
  const h = 72;
  const pad = 7;
  const safe = Array.isArray(values) && values.length ? values : [0];
  const min = Math.min(...safe);
  const max = Math.max(...safe);
  const span = max - min || 1;
  const pts = safe.map((v, i) => {
    const x = pad + (i / Math.max(1, safe.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / span) * (h - pad * 2);
    return `${x},${y}`;
  });
  return (
    <svg className="dash-forecast-spark" viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.6"
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
  const [modelAData, setModelAData] = useState(null);
  const [modelAError, setModelAError] = useState(null);

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

  useEffect(() => {
    if (loading || !coords) return;
    const { location: loc } = nearestLocation(coords.lat, coords.lng);
    let cancelled = false;
    setModelAError(null);
    const pastSeries = buildPastSeries(loc);
    const briefingBody = {
      latitude: coords.lat,
      longitude: coords.lng,
      target_date: new Date().toISOString().slice(0, 10),
      top_k: 5,
      location: loc.name,
    };
    // #region agent log
    agentDebugLog(
      "M1",
      "UserDashboardPage.jsx:modelA:start",
      "Calling fusion briefing",
      {
        body: briefingBody,
      },
    );
    // #endregion
    postFusionBriefing(briefingBody)
      .then((briefing) => {
        if (cancelled) return null;
        if (briefing?.forecast) {
          // #region agent log
          agentDebugLog(
            "M1",
            "UserDashboardPage.jsx:modelA:fusion-success",
            "Fusion briefing success",
            {
              horizonDays: briefing?.forecast?.horizon_days ?? null,
              channels: briefing?.forecast?.channels ?? null,
            },
          );
          // #endregion
          return briefing.forecast;
        }
        throw new Error("Fusion briefing missing forecast section");
      })
      .catch((fusionErr) => {
        // #region agent log
        agentDebugLog(
          "M1",
          "UserDashboardPage.jsx:modelA:fusion-fallback",
          "Fusion briefing unavailable, falling back to model-a",
          {
            error:
              fusionErr instanceof Error
                ? fusionErr.message
                : String(fusionErr),
          },
        );
        // #endregion
        return postModelAForecast({
          station_id: loc.id,
          past_series: pastSeries,
        });
      })
      .then((forecast) => {
        if (!forecast) return;
        if (cancelled) return;
        setModelAData(forecast);
        const day0 = Array.isArray(forecast?.forecast_mean)
          ? forecast.forecast_mean[0]
          : null;
        // #region agent log
        agentDebugLog(
          "M1",
          "UserDashboardPage.jsx:modelA:success",
          "Model A forecast success",
          {
            horizonDays: forecast?.horizon_days ?? null,
            channels: forecast?.channels ?? null,
            day0,
          },
        );
        // #endregion
      })
      .catch((err) => {
        if (cancelled) return;
        setModelAData(null);
        setModelAError(
          err instanceof Error ? err.message : "Model A API failed",
        );
        // #region agent log
        agentDebugLog(
          "M1",
          "UserDashboardPage.jsx:modelA:error",
          "Model A forecast failed",
          {
            error: err instanceof Error ? err.message : String(err),
          },
        );
        // #endregion
      });
    return () => {
      cancelled = true;
    };
  }, [loading, coords]);

  const forecast14 = useMemo(() => {
    if (
      Array.isArray(modelAData?.forecast_mean) &&
      modelAData.forecast_mean.length
    ) {
      return modelAData.forecast_mean.slice(0, 14).map((row, i) => ({
        day: `D${i + 1}`,
        temperature: Number(row?.[0] ?? 0),
        salinity: Number(row?.[1] ?? 0),
        oxygen: Number(row?.[2] ?? 0),
        chlorophyll: Number(row?.[3] ?? 0),
      }));
    }
    if (loading || !coords) return [];
    const { location: loc } = nearestLocation(coords.lat, coords.lng);
    return buildPastSeries(loc)
      .slice(-14)
      .map((row, i) => ({
        day: `D${i + 1}`,
        temperature: Number(row?.[0] ?? 0),
        salinity: Number(row?.[1] ?? 0),
        oxygen: Number(row?.[2] ?? 0),
        chlorophyll: Number(row?.[3] ?? 0),
      }));
  }, [modelAData, loading, coords]);

  const sparkTemps = useMemo(() => {
    if (!forecast14.length) return [17.2, 17.4, 17.3, 17.6, 17.5, 17.8, 17.7];
    return forecast14.slice(0, 7).map((r) => r.temperature);
  }, [forecast14]);

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

  const waterPct = clamp(
    ((location.waterTempF - 48) / (78 - 48)) * 100,
    4,
    100,
  );
  const wavePct = clamp((location.waveFt / 7) * 100, 4, 100);
  const windPct = clamp((location.windMph / 32) * 100, 4, 100);
  const rainPct = clamp(location.rainChancePct, 0, 100);
  const modelAFirstRow =
    Array.isArray(modelAData?.forecast_mean) && modelAData.forecast_mean.length
      ? modelAData.forecast_mean[0]
      : null;
  const vitalTemperatureC =
    Array.isArray(modelAFirstRow) && Number.isFinite(modelAFirstRow[0])
      ? modelAFirstRow[0]
      : Math.round(toCelsius(location.waterTempF) * 10) / 10;
  const vitalSalinity =
    Array.isArray(modelAFirstRow) && Number.isFinite(modelAFirstRow[1])
      ? modelAFirstRow[1]
      : 33.6;
  const vitalOxygen =
    Array.isArray(modelAFirstRow) && Number.isFinite(modelAFirstRow[2])
      ? modelAFirstRow[2]
      : 6.0;
  const vitalChlorophyll =
    Array.isArray(modelAFirstRow) && Number.isFinite(modelAFirstRow[3])
      ? modelAFirstRow[3]
      : 0.2;
  const metricCards = [
    {
      key: "temperature",
      title: "Temperature",
      unit: "°C",
      values: forecast14.map((r) => r.temperature),
      latest: forecast14.length
        ? forecast14[forecast14.length - 1].temperature
        : vitalTemperatureC,
      color: METRIC_COLORS.temperature,
    },
    {
      key: "salinity",
      title: "Salinity",
      unit: "psu",
      values: forecast14.map((r) => r.salinity),
      latest: forecast14.length
        ? forecast14[forecast14.length - 1].salinity
        : vitalSalinity,
      color: METRIC_COLORS.salinity,
    },
    {
      key: "oxygen",
      title: "Oxygen",
      unit: "ml/L",
      values: forecast14.map((r) => r.oxygen),
      latest: forecast14.length
        ? forecast14[forecast14.length - 1].oxygen
        : vitalOxygen,
      color: METRIC_COLORS.oxygen,
    },
    {
      key: "chlorophyll",
      title: "Chlorophyll",
      unit: "mg/m³",
      values: forecast14.map((r) => r.chlorophyll),
      latest: forecast14.length
        ? forecast14[forecast14.length - 1].chlorophyll
        : vitalChlorophyll,
      color: METRIC_COLORS.chlorophyll,
    },
  ];

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
        <article className="dash-vital dash-vital--temp">
          <p className="dash-vital__label">Temperature (Model A)</p>
          <p className="dash-vital__big dash-vital__big--dark">
            {Number(vitalTemperatureC).toFixed(1)}
            <span className="dash-vital__unit">°C</span>
          </p>
          <div className="dash-vital__spark-wrap">
            <SparklineTemps temps={sparkTemps} />
          </div>
          <p className="dash-vital__foot dash-vital__foot--dark">
            {modelAData ? "Live Model A" : "Fallback estimate"}
          </p>
        </article>
        <article className="dash-vital dash-vital--surf">
          <p className="dash-vital__label">Salinity (Model A)</p>
          <p className="dash-vital__big dash-vital__big--dark">
            {Number(vitalSalinity).toFixed(2)}
            <span className="dash-vital__unit"> psu</span>
          </p>
          <p className="dash-vital__foot dash-vital__foot--dark">
            {modelAData ? "Live Model A" : "Fallback estimate"}
          </p>
        </article>
        <article className="dash-vital dash-vital--temp">
          <p className="dash-vital__label">Oxygen (Model A)</p>
          <p className="dash-vital__big dash-vital__big--dark">
            {Number(vitalOxygen).toFixed(2)}
            <span className="dash-vital__unit"> ml/L</span>
          </p>
          <p className="dash-vital__foot dash-vital__foot--dark"></p>
        </article>
        <article className="dash-vital dash-vital--surf">
          <p className="dash-vital__label">Chlorophyll-a (Model A)</p>
          <p className="dash-vital__big dash-vital__big--dark">
            {Number(vitalChlorophyll).toFixed(3)}
            <span className="dash-vital__unit"> mg/m³</span>
          </p>
          <p className="dash-vital__foot dash-vital__foot--dark">
            {modelAData ? "Live Model A" : "Fallback estimate"}
          </p>
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
                ? "The live score uses backend fusion; this panel still blends in demo waves and weather for layout. Not a regulatory forecast — follow lifeguards and posted flags."
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
            {location.hazardBadges?.length
              ? `Flags / hazards: ${location.hazardBadges.join(", ")}`
              : "Flags / hazards: none in current demo feed."}
          </p>
        </section>
      </div>

      {/* —— 14-day Model A channels —— */}
      <section className="dash-chart-card" aria-labelledby="dash-chart-title">
        <div className="dash-chart-card__head">
          <div>
            <h2 id="dash-chart-title" className="dash-chart-card__title">
              14-day ocean forecast channels
            </h2>
          </div>
          <p className="dash-chart-card__sub">
            {modelAData
              ? "Live Model A · 14-day horizon"
              : "Fallback demo curve"}
          </p>
        </div>
        <div
          className="dash-forecast-grid"
          role="img"
          aria-label="Fourteen day channel forecast cards"
        >
          {metricCards.map((m) => (
            <article key={m.key} className="dash-forecast-card">
              <header className="dash-forecast-card__head">
                <p className="dash-forecast-card__title">{m.title}</p>
                <p
                  className="dash-forecast-card__value"
                  style={{ color: m.color }}
                >
                  {Number(m.latest).toFixed(m.key === "chlorophyll" ? 3 : 2)}{" "}
                  {m.unit}
                </p>
              </header>
              <MetricSparkline values={m.values} color={m.color} />
              <p className="dash-forecast-card__range">
                Range:{" "}
                {Number(Math.min(...m.values)).toFixed(
                  m.key === "chlorophyll" ? 3 : 2,
                )}{" "}
                -{" "}
                {Number(Math.max(...m.values)).toFixed(
                  m.key === "chlorophyll" ? 3 : 2,
                )}{" "}
                {m.unit}
              </p>
            </article>
          ))}
        </div>
        <p className="dash-chart-card__note">
          Values are direct 14-day channel forecasts (Model A order:
          temperature, salinity, oxygen, chlorophyll).{" "}
          <Link to={`/explore/${location.id}`}>
            Species cards for this beach in Explore
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

export default UserDashboardPage;
