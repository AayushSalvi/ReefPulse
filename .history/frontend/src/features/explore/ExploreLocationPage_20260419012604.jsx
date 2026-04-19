/**
 * ReefPulse — Explore location: species as collectible-style cards (TCG-inspired)
 *
 * Route: `/explore/:locationId`  ·  Any legacy `?tab=` query is stripped on load.
 * Styles: `./explore-app.css`
 */
import { useMemo } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { findLocation, locationSpeciesDeck } from "../../data/mockData";
import "./explore-app.css";

function tcgTypesFromName(name) {
  const n = name.toLowerCase();
  const types = [];
  if (
    n.includes("shark") ||
    n.includes("ray") ||
    n.includes("fish") ||
    n.includes("garibaldi") ||
    n.includes("eel") ||
    n.includes("bass") ||
    n.includes("sheephead") ||
    n.includes("abalone") ||
    n.includes("turtle")
  ) {
    types.push("Water");
  }
  if (
    n.includes("seal") ||
    n.includes("lion") ||
    n.includes("otter") ||
    n.includes("dolphin")
  ) {
    types.push("Coastal");
  }
  if (n.includes("kelp") || n.includes("forest")) {
    types.push("Kelp");
  }
  if (types.length === 0) types.push("Water");
  if (types.length === 1) types.push("Reef");
  return types.slice(0, 2);
}

function tcgStats(name, index, location) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h + name.charCodeAt(i) * (i + 1)) % 97;
  }
  const hp = 42 + h;
  const encounter = Math.max(48, 92 - index * 12);
  const swim = Math.min(
    100,
    Math.round(48 + (location.waterTempF - 54) * 1.35),
  );
  return { hp, encounter, swim };
}

function tcgRarity(index, total) {
  if (total <= 1) return { label: "★ Rare", tier: "rare" };
  if (index === 0) return { label: "★ Rare", tier: "rare" };
  if (index >= total - 1) return { label: "Common", tier: "common" };
  return { label: "Uncommon", tier: "uncommon" };
}

function ExploreLocationPage() {
  const { locationId } = useParams();
  const [sp] = useSearchParams();
  const location = findLocation(locationId);

  const speciesDeck = useMemo(
    () => (location ? locationSpeciesDeck(location) : []),
    [location],
  );

  if (!location) {
    return <Navigate to="/explore" replace />;
  }

  if (sp.has("tab")) {
    const next = new URLSearchParams(sp);
    next.delete("tab");
    const qs = next.toString();
    return (
      <Navigate to={`/explore/${locationId}${qs ? `?${qs}` : ""}`} replace />
    );
  }

  return (
    <div className="ex-location ex-location--tcg">
      <header className="ex-tcg-head">
        <Link to="/explore" className="ex-tcg-head__back">
          ← Beaches
        </Link>
        <div className="ex-tcg-head__title-block">
          <h1 className="ex-tcg-head__title">{location.name}</h1>
          <p className="ex-tcg-head__region">{location.region}</p>
        </div>
        <p className="ex-tcg-head__tagline">Species roster · card-style demo</p>
      </header>

      <section
        className="ex-poke-stage ex-tab-panels--tcg"
        aria-label="Species cards for this beach"
      >
        <p className="ex-poke-stage__lede">
          Each card is a local “encounter” hint — not a game stat. Tap a card
          for the Marine life guide.
        </p>
        <div className="ex-poke-grid">
          {speciesDeck.map((item, index) => {
            const img = item.profile?.detailImage;
            const hint =
              item.profile?.hint ||
              "Seasonal on this coast — confirm IDs in the field and follow wildlife rules.";
            const types = tcgTypesFromName(item.name);
            const { hp, encounter, swim } = tcgStats(
              item.name,
              index,
              location,
            );
            const rarity = tcgRarity(index, speciesDeck.length);
            const dexLine = hint.length > 118 ? `${hint.slice(0, 116)}…` : hint;

            return (
              <Link
                key={item.id}
                to="/marine-life"
                className={`poke-card poke-card--${rarity.tier}`}
                aria-label={`${item.name} — open Marine life`}
              >
                <div className="poke-card__shine" aria-hidden />
                <div className="poke-card__frame">
                  <div className="poke-card__top">
                    <span className="poke-card__name">{item.name}</span>
                    <span className="poke-card__hp-block">
                      <span className="poke-card__hp-label">HP</span>
                      <span className="poke-card__hp-val">{hp}</span>
                    </span>
                  </div>
                  <div className="poke-card__types" aria-hidden>
                    {types.map((ty) => (
                      <span key={ty} className="poke-card__type">
                        {ty}
                      </span>
                    ))}
                  </div>
                  <div
                    className="poke-card__art"
                    style={
                      img
                        ? { backgroundImage: `url(${img})` }
                        : {
                            background:
                              "linear-gradient(160deg, #38bdf8 0%, #0ea5e9 40%, #0369a1 100%)",
                          }
                    }
                  >
                    {!img ? (
                      <span className="poke-card__art-mono" aria-hidden>
                        {item.name.slice(0, 2).toUpperCase()}
                      </span>
                    ) : null}
                  </div>
                  <p className="poke-card__dex">{dexLine}</p>
                  <div className="poke-card__bar">
                    <span className="poke-card__rarity">{rarity.label}</span>
                    <span className="poke-card__retreat">
                      Retreat <span className="poke-card__energy" />{" "}
                      <span className="poke-card__energy" />
                    </span>
                  </div>
                  <dl className="poke-card__stats">
                    <div>
                      <dt>Encounter</dt>
                      <dd>{encounter}%</dd>
                    </div>
                    <div>
                      <dt>Swim index</dt>
                      <dd>{swim}</dd>
                    </div>
                    <div>
                      <dt>Waves</dt>
                      <dd>{location.waveFt} ft</dd>
                    </div>
                  </dl>
                  <p className="poke-card__fine">
                    weakness: surge · resistance: patience · retreat cost:
                    common sense
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
        <p className="ex-poke-stage__foot">
          <Link to="/marine-life">Marine life explorer →</Link>
        </p>
      </section>

      <footer className="ex-tcg-foot">
        <Link to="/dashboard">Dashboard</Link>
        <span className="ex-tcg-foot__sep">·</span>
        <Link to="/marine-life">Marine life</Link>
      </footer>
    </div>
  );
}

export default ExploreLocationPage;
