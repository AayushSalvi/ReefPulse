/**
 * ReefPulse — Explore location: fishdeck species cards (ranked 1–10 from API when available)
 *
 * Route: `/explore/:locationId`  ·  Optional `?fishdeck=1` from sidebar CTA (cosmetic).
 * Strips legacy `?tab=` on load. Styles: `./explore-app.css`
 */
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import {
  fetchTaxonById,
  pickMarineTaxon,
  taxonPhotoUrl,
  taxaAutocomplete,
} from "../../api/inaturalist";
import { postSpeciesRank } from "../../api/speciesRank";
import {
  findLocation,
  locationSpeciesDeck,
  matchSpeciesQuery,
} from "../../data/mockData";
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

const CARD_TONE_CYCLE = [
  { key: "lemon", hex: "#FAFF6C" },
  { key: "magenta", hex: "#D00296" },
  { key: "lime", hex: "#D9F274" },
];

function agentDebugLog(hypothesisId, location, message, data = {}, runId = "run1") {
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

function seasonFromMonth() {
  const m = new Date().getMonth();
  if (m < 2 || m === 11) return "winter";
  if (m < 5) return "spring";
  if (m < 8) return "summer";
  return "fall";
}

function stateVectorFromLocation(loc) {
  return [
    Math.round(((loc.waterTempF - 32) * (5 / 9)) / 25 * 1000) / 1000,
    Math.round((loc.waveFt / 8) * 1000) / 1000,
    Math.round((loc.windMph / 35) * 1000) / 1000,
    Math.round((loc.safetyIndex / 100) * 1000) / 1000,
  ];
}

function ExploreLocationPage() {
  const { locationId } = useParams();
  const [sp] = useSearchParams();
  const location = findLocation(locationId);

  const [rankLoading, setRankLoading] = useState(true);
  const [rankError, setRankError] = useState(null);
  const [rankPayload, setRankPayload] = useState(null);
  const [taxonPhotos, setTaxonPhotos] = useState({});

  const fallbackDeck = useMemo(
    () => (location ? locationSpeciesDeck(location) : []),
    [location],
  );

  useEffect(() => {
    if (!location) return undefined;
    let cancelled = false;
    setRankLoading(true);
    setRankError(null);
    const body = {
      location: location.name,
      latitude: location.lat,
      longitude: location.lng,
      season: seasonFromMonth(),
      state_vector: stateVectorFromLocation(location),
      top_k: 10,
      observed_date: new Date().toISOString().slice(0, 10),
      image_count: 0,
      temperature: Math.round(((location.waterTempF - 32) * (5 / 9)) * 10) / 10,
      min_probability: 0,
      rarity: "",
    };
    // #region agent log
    agentDebugLog("H1", "ExploreLocationPage.jsx:rank:start", "Posting rank request", {
      locationId: location.id,
      body,
    });
    // #endregion
    postSpeciesRank(body)
      .then((data) => {
        // #region agent log
        agentDebugLog("H1", "ExploreLocationPage.jsx:rank:success", "Rank request success", {
          hasPredictions: Array.isArray(data?.predictions),
          predictionCount: Array.isArray(data?.predictions) ? data.predictions.length : null,
          firstPrediction: Array.isArray(data?.predictions) ? data.predictions[0] ?? null : null,
        });
        // #endregion
        if (!cancelled) setRankPayload(data);
      })
      .catch((err) => {
        // #region agent log
        agentDebugLog("H1", "ExploreLocationPage.jsx:rank:error", "Rank request failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        // #endregion
        if (!cancelled) {
          setRankPayload(null);
          setRankError(err instanceof Error ? err.message : "Rank API failed");
        }
      })
      .finally(() => {
        if (!cancelled) setRankLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [location]);

  useEffect(() => {
    const preds = rankPayload?.predictions;
    // #region agent log
    agentDebugLog("H2", "ExploreLocationPage.jsx:photo:start", "Photo hydration entered", {
      hasPredictions: Array.isArray(preds),
      predictionCount: Array.isArray(preds) ? preds.length : null,
    });
    // #endregion
    if (!Array.isArray(preds) || preds.length === 0) {
      setTaxonPhotos({});
      return undefined;
    }

    let cancelled = false;
    const ac = new AbortController();

    Promise.all(
      preds.map(async (p) => {
        const id = String(p.taxon_id || "").trim();
        const speciesName = String(p.species || "").trim();
        const cacheKey = id || speciesName;
        if (!cacheKey) return [cacheKey, null];

        try {
          if (id) {
            const byId = await fetchTaxonById(id, ac.signal);
            const idUrl = taxonPhotoUrl(byId);
            if (idUrl) return [cacheKey, idUrl];
          }
        } catch {
          // fallback to name search below
        }

        try {
          if (speciesName) {
            const results = await taxaAutocomplete(speciesName, ac.signal);
            const picked = pickMarineTaxon(results);
            const pickedUrl = taxonPhotoUrl(picked);
            if (pickedUrl) return [cacheKey, pickedUrl];
          }
        } catch {
          // ignore; keep null fallback
        }

        return [cacheKey, null];
      }),
    ).then((pairs) => {
      if (cancelled) return;
      const next = {};
      pairs.forEach(([key, url]) => {
        if (key && url) next[key] = url;
      });
      // #region agent log
      agentDebugLog("H2", "ExploreLocationPage.jsx:photo:resolved", "Photo hydration completed", {
        pairCount: pairs.length,
        resolvedPhotoCount: Object.keys(next).length,
      });
      // #endregion
      setTaxonPhotos(next);
    });

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [rankPayload]);

  const deck = useMemo(() => {
    if (!location) return [];
    const preds = rankPayload?.predictions;
    if (Array.isArray(preds) && preds.length) {
      const built = preds.map((p, i) => {
        const name = p.species || "Unknown";
        const profile = matchSpeciesQuery(name);
        const taxonId = String(p.taxon_id || "");
        const inatImage = taxonPhotos[taxonId || name] || null;
        const safetyPayload = p.safety && typeof p.safety === "object" ? p.safety : {};
        return {
          id: `rank-${location.id}-${i}-${name}`,
          name,
          rank: i + 1,
          encounterPct: Math.round((p.encounter_probability ?? 0) * 1000) / 10,
          profile,
          inatImage,
          tierLabel: (p.rarity || "common").replace(/^./, (c) => c.toUpperCase()),
          apiLabel: p.label || "",
          safety:
            typeof safetyPayload.message === "string"
              ? safetyPayload.message
              : p.safety_flag || "",
        };
      });
      // #region agent log
      agentDebugLog("H3", "ExploreLocationPage.jsx:deck:ranked", "Deck built from ranked predictions", {
        deckCount: built.length,
        photoCacheCount: Object.keys(taxonPhotos).length,
        withImageCount: built.filter((item) => Boolean(item.inatImage || item.profile?.detailImage)).length,
      });
      // #endregion
      return built;
    }
    const fallback = fallbackDeck.map((item, i) => ({
      id: item.id,
      name: item.name,
      rank: i + 1,
      encounterPct: tcgStats(item.name, i, location).encounter,
      profile: item.profile,
      inatImage: null,
      tierLabel: null,
      apiLabel: "",
      safety: "",
    }));
    // #region agent log
    agentDebugLog("H4", "ExploreLocationPage.jsx:deck:fallback", "Deck built from fallback data", {
      fallbackCount: fallback.length,
      rankError,
    });
    // #endregion
    return fallback;
  }, [location, rankPayload, fallbackDeck]);

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

  const fishdeckHint = sp.get("fishdeck") === "1";

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
        <p className="ex-tcg-head__tagline">
          Fishdeck · ranked species {rankLoading ? "(loading…)" : "1–10"}
        </p>
      </header>

      <section
        className="ex-poke-stage ex-tab-panels--tcg"
        aria-label="Ranked species cards for this beach"
      >
        {fishdeckHint ? (
          <p className="ex-poke-stage__fishdeck" role="status">
            Fishdeck opened from your map pin — ranks are for <strong>{location.name}</strong>.
          </p>
        ) : null}
        <p className="ex-poke-stage__lede">
          {rankLoading
            ? "Loading ranked encounters from the ReefPulse API…"
            : rankError
              ? `API unavailable (${rankError}). Showing local demo deck instead.`
              : "Cards are ordered by encounter rank (#1 highest). Tap a card for Marine life."}
        </p>
        <div className="ex-poke-grid">
          {deck.map((item, index) => {
            const tone = CARD_TONE_CYCLE[index % CARD_TONE_CYCLE.length];
            const img = item.inatImage || item.profile?.detailImage;
            const hint =
              item.profile?.hint ||
              item.apiLabel ||
              "Seasonal on this coast — confirm IDs in the field and follow wildlife rules.";
            const types = tcgTypesFromName(item.name);
            const { hp, swim } = tcgStats(item.name, index, location);
            const encounter = item.encounterPct;
            const dexLine = hint.length > 118 ? `${hint.slice(0, 116)}…` : hint;
            const barLabel = item.tierLabel ? `Rank ${item.rank}/10 · ${item.tierLabel}` : `Rank ${item.rank}/10`;

            return (
              <Link
                key={item.id}
                to="/marine-life"
                className={`poke-card poke-card--tone-${tone.key}`}
                aria-label={`${item.name}, rank ${item.rank} of 10`}
              >
                <div
                  className={`poke-card__shine ${tone.key === "magenta" ? "poke-card__shine--on" : ""}`}
                  aria-hidden
                />
                <div className="poke-card__frame">
                  <div className="poke-card__rank-strip" aria-hidden>
                    <span className="poke-card__rank-hash">#</span>
                    <span className="poke-card__rank-num">{item.rank}</span>
                    <span className="poke-card__rank-of">/10</span>
                  </div>
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
                        : { backgroundColor: tone.hex }
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
                    <span className="poke-card__rarity">{barLabel}</span>
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
                  {item.safety ? (
                    <p className="poke-card__fine">safety: {item.safety}</p>
                  ) : (
                    <p className="poke-card__fine">
                      weakness: surge · resistance: patience · retreat cost: common
                      sense
                    </p>
                  )}
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
