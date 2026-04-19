import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { locationsBySafety } from "../../data/mockData";
import "./oracle.css";

const ORACLE_SEEN_KEY = "reefpulse.oracle.seen";

function scoreFromLocation(loc) {
  const safety = Number(loc?.safetyIndex ?? 0);
  const wavePenalty = Math.max(0, (Number(loc?.waveFt ?? 0) - 2) * 8);
  const windPenalty = Math.max(0, (Number(loc?.windMph ?? 0) - 6) * 2);
  const rainPenalty = Number(loc?.rainChancePct ?? 0) * 0.45;
  const algalPenalty = loc?.algalRisk === "moderate" ? 8 : loc?.algalRisk === "high" ? 15 : 0;
  return Math.max(0, Math.min(100, Math.round(safety - wavePenalty - windPenalty - rainPenalty - algalPenalty + 18)));
}

function deriveMood(score) {
  if (score >= 85) {
    return {
      key: "serene",
      label: "Serene",
      subtitle: "The sea is calm and generous.",
      tone: "Great day for gentle exploration and longer water sessions.",
      gradient: "var(--oracle-mood-serene)",
      symbol: "Calm tide",
    };
  }
  if (score >= 68) {
    return {
      key: "luminous",
      label: "Luminous",
      subtitle: "Energy is high, but balanced.",
      tone: "Good conditions with a little pulse; watch wind and surf timing.",
      gradient: "var(--oracle-mood-luminous)",
      symbol: "Rising glow",
    };
  }
  if (score >= 50) {
    return {
      key: "volatile",
      label: "Volatile",
      subtitle: "The ocean asks for focus today.",
      tone: "Moderate variability; keep sessions short and stay near safer zones.",
      gradient: "var(--oracle-mood-volatile)",
      symbol: "Cross-current",
    };
  }
  return {
    key: "abyssal",
    label: "Abyssal",
    subtitle: "Powerful water, proceed with caution.",
    tone: "Forecast favors observation over entry; postpone exposed activities.",
    gradient: "var(--oracle-mood-abyssal)",
    symbol: "Deep pull",
  };
}

function buildFortune(loc, mood) {
  const wave = Number(loc?.waveFt ?? 0).toFixed(1);
  const temp = Number(loc?.waterTempF ?? 0);
  const wind = Number(loc?.windMph ?? 0);
  const rain = Number(loc?.rainChancePct ?? 0);
  return `${loc?.name} reads ${mood.label}. Waves ${wave} ft, water ${temp}F, wind ${wind} mph, rain ${rain}%. ${mood.tone}`;
}

export default function OceanOraclePage({ entry = false }) {
  const navigate = useNavigate();
  const options = useMemo(() => locationsBySafety(), []);
  const [locationId, setLocationId] = useState(options[0]?.id ?? "");
  const [seed, setSeed] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const current = useMemo(
    () => options.find((loc) => loc.id === locationId) ?? options[0],
    [options, locationId],
  );

  const mood = useMemo(() => deriveMood(scoreFromLocation(current) + (seed % 3) - 1), [current, seed]);
  const fortuneText = useMemo(() => buildFortune(current, mood), [current, mood]);

  const continueIntoSite = () => {
    try {
      window.localStorage.setItem(ORACLE_SEEN_KEY, "1");
    } catch {
      // Non-blocking if storage is unavailable.
    }
    navigate("/home", { replace: true });
  };

  return (
    <div className={`oracle ${entry ? "oracle--entry" : ""}`} style={{ "--oracle-mood-gradient": mood.gradient }}>
      <section className="oracle-shell" aria-labelledby="oracle-title">
        <header className="oracle-topbar">
          <Link to="/" className="oracle-brand">
            ReefPulse
          </Link>
          <div className="oracle-links">
            <Link to="/home">Home</Link>
            <Link to="/explore">Forecast map</Link>
          </div>
        </header>

        <div className="oracle-card">
          <div className={`oracle-flip ${flipped ? "is-flipped" : ""}`}>
            <div className="oracle-face oracle-face--front">
              <p className="oracle-kicker">Ocean Fortune</p>
              <h1 id="oracle-title">How does the ocean feel today?</h1>
              <p className="oracle-sub">Choose your location, then flip the card for today&apos;s reading.</p>

              <div className="oracle-controls">
                <label htmlFor="oracle-location">Choose your coast</label>
                <select
                  id="oracle-location"
                  value={locationId}
                  onChange={(e) => {
                    setLocationId(e.target.value);
                    setSeed((n) => n + 1);
                  }}
                >
                  {options.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} - {loc.region}
                    </option>
                  ))}
                </select>
                <button type="button" className="oracle-refresh" onClick={() => setFlipped(true)}>
                  Flip card
                </button>
              </div>
            </div>

            <div className="oracle-face oracle-face--back">
              <p className="oracle-kicker">Your Reading</p>
              <h2 className="oracle-result-title">{current.name}</h2>
              <p className="oracle-sub">{mood.subtitle}</p>

              <div className={`oracle-mood oracle-mood--${mood.key}`}>
                <span className="oracle-mood-label">{mood.label}</span>
                <span className="oracle-mood-symbol">{mood.symbol}</span>
              </div>

              <p className="oracle-fortune">{fortuneText}</p>

              <dl className="oracle-metrics">
                <div>
                  <dt>Wave</dt>
                  <dd>{current.waveFt.toFixed(1)} ft</dd>
                </div>
                <div>
                  <dt>Water temp</dt>
                  <dd>{current.waterTempF}F</dd>
                </div>
                <div>
                  <dt>Wind</dt>
                  <dd>{current.windMph} mph</dd>
                </div>
                <div>
                  <dt>Rain chance</dt>
                  <dd>{current.rainChancePct}%</dd>
                </div>
              </dl>

              <div className="oracle-back-actions">
                <button
                  type="button"
                  className="oracle-refresh"
                  onClick={() => {
                    setSeed((n) => n + 1);
                    setFlipped(false);
                  }}
                >
                  Draw another card
                </button>
              </div>
            </div>
          </div>

          <div className="oracle-actions">
            {entry ? (
              <button type="button" className="oracle-enter-btn" onClick={continueIntoSite}>
                Enter ReefPulse
              </button>
            ) : (
              <Link className="oracle-enter-btn" to="/explore">
                Continue to forecasts
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
