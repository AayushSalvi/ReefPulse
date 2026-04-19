/**
 * ReefPulse — Marine life discovery (species-first)
 *
 * Route: `/marine-life`  ·  Styles: `./marine-life.css` (large shared file includes legacy full-screen styles below)
 *
 * Layout (CSS grid):
 *   1) Search + discovery chips
 *   2) Three columns: species profile | Google distribution map + layer toggles | best locations list
 *   3) Community sightings strip
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  INAT_PLACE_ID_CALIFORNIA,
  aggregateObservationDots,
  fetchTaxonById,
  observationsByTaxonCalifornia,
  pickMarineTaxon,
  taxaAutocomplete,
  taxonPhotoUrl,
  topCaBeachesFromObservations,
} from "../../api/inaturalist";
import MarineLifeGoogleDistributionMap from "./MarineLifeGoogleDistributionMap";
import {
  communitySightings,
  discoveryChips,
  findLocation,
  locations,
  snorkelSpecies,
  speciesForDiscoveryChip,
} from "../../data/mockData";
import "./marine-life.css";

function MarineLifeDiscoveryPage() {
  const [query, setQuery] = useState("");
  const [discoveryId, setDiscoveryId] = useState(null);
  const [layers, setLayers] = useState({
    recent: true,
    historical: true,
    forecast: false,
  });

  const [inatPickedTaxon, setInatPickedTaxon] = useState(null);
  const [taxaSuggest, setTaxaSuggest] = useState([]);
  const [taxaSuggestLoading, setTaxaSuggestLoading] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  /** Shortlist species applied only after the user clicks a suggestion (not from typing alone). */
  const [mockSpeciesPick, setMockSpeciesPick] = useState(null);

  const [inatLoading, setInatLoading] = useState(false);
  const [inatError, setInatError] = useState(null);
  const [inatTaxonName, setInatTaxonName] = useState(null);
  const [inatTotal, setInatTotal] = useState(null);
  const [inatDistribution, setInatDistribution] = useState([]);
  const [inatTopPlaces, setInatTopPlaces] = useState([]);
  const inatAbortRef = useRef(null);
  const suggestAbortRef = useRef(null);
  const suggestBlurTimerRef = useRef(null);

  const selected = useMemo(() => {
    if (discoveryId) {
      const list = speciesForDiscoveryChip(discoveryId);
      return list[0] || null;
    }
    return mockSpeciesPick;
  }, [discoveryId, mockSpeciesPick]);

  const panelActive = Boolean(selected || inatPickedTaxon);

  const suggestionRows = useMemo(() => {
    if (discoveryId) return [];
    const q = query.trim().toLowerCase();
    const mockHits =
      q.length >= 1
        ? snorkelSpecies
            .filter((s) => s.name.toLowerCase().includes(q))
            .slice(0, 4)
        : [];
    const mockRows = mockHits.map((s) => ({
      kind: "mock",
      key: `mock-${s.id}`,
      species: s,
    }));
    const inatRows = taxaSuggest.map((t) => ({
      kind: "inat",
      key: `inat-${t.id}`,
      taxon: t,
    }));
    return [...mockRows, ...inatRows];
  }, [discoveryId, query, taxaSuggest]);

  useEffect(() => {
    if (discoveryId) {
      suggestAbortRef.current?.abort();
      setTaxaSuggest([]);
      setTaxaSuggestLoading(false);
      return undefined;
    }
    const q = query.trim();
    if (q.length < 2) {
      suggestAbortRef.current?.abort();
      setTaxaSuggest([]);
      setTaxaSuggestLoading(false);
      return undefined;
    }

    setTaxaSuggestLoading(true);
    const t = window.setTimeout(async () => {
      suggestAbortRef.current?.abort();
      const ac = new AbortController();
      suggestAbortRef.current = ac;
      try {
        const rows = await taxaAutocomplete(q, ac.signal);
        if (ac.signal.aborted) return;
        setTaxaSuggest(rows.slice(0, 12));
      } catch {
        if (!ac.signal.aborted) setTaxaSuggest([]);
      } finally {
        if (!ac.signal.aborted) setTaxaSuggestLoading(false);
      }
    }, 320);

    return () => {
      window.clearTimeout(t);
      suggestAbortRef.current?.abort();
    };
  }, [query, discoveryId]);

  useEffect(() => {
    const pickedId = inatPickedTaxon?.id;
    const mockName = selected?.name;

    if (!pickedId && !mockName) {
      inatAbortRef.current?.abort();
      setInatLoading(false);
      setInatError(null);
      setInatTaxonName(null);
      setInatTotal(null);
      setInatDistribution([]);
      setInatTopPlaces([]);
      return undefined;
    }

    setInatLoading(true);
    setInatError(null);

    const delayMs = pickedId ? 0 : 550;
    const t = window.setTimeout(async () => {
      inatAbortRef.current?.abort();
      const ac = new AbortController();
      inatAbortRef.current = ac;
      try {
        let taxonId = pickedId ?? null;
        let resolvedName = inatPickedTaxon?.name ?? mockName;

        if (!taxonId && mockName) {
          const taxa = await taxaAutocomplete(mockName, ac.signal);
          if (ac.signal.aborted) return;
          const taxon = pickMarineTaxon(taxa);
          taxonId = taxon?.id ?? null;
          resolvedName = taxon?.name || mockName;
        }

        if (!taxonId) {
          setInatTaxonName(null);
          setInatTotal(0);
          setInatDistribution([]);
          setInatTopPlaces([]);
          setInatLoading(false);
          return;
        }

        if (
          inatPickedTaxon?.id != null &&
          String(inatPickedTaxon.id) === String(taxonId)
        ) {
          try {
            const fullTaxon = await fetchTaxonById(taxonId, ac.signal);
            if (!ac.signal.aborted && fullTaxon) {
              const photo = taxonPhotoUrl(fullTaxon);
              if (photo) {
                setInatPickedTaxon((prev) =>
                  prev && String(prev.id) === String(taxonId)
                    ? { ...prev, photoUrl: photo }
                    : prev,
                );
              }
            }
          } catch {
            /* taxon detail is optional */
          }
        }

        setInatTaxonName(resolvedName || String(taxonId));
        setInatDistribution([]);
        const { results, totalResults } = await observationsByTaxonCalifornia(
          taxonId,
          {
            perPage: 200,
            maxPages: 2,
            signal: ac.signal,
          },
        );
        if (ac.signal.aborted) return;
        setInatTotal(totalResults);
        setInatDistribution(aggregateObservationDots(results));
        setInatTopPlaces(topCaBeachesFromObservations(results, locations, 3));
      } catch (e) {
        if (ac.signal.aborted) return;
        setInatError(
          e instanceof Error ? e.message : "iNaturalist request failed",
        );
        setInatTaxonName(null);
        setInatTotal(null);
        setInatDistribution([]);
        setInatTopPlaces([]);
      } finally {
        if (!ac.signal.aborted) setInatLoading(false);
      }
    }, delayMs);

    return () => {
      window.clearTimeout(t);
      inatAbortRef.current?.abort();
    };
  }, [
    inatPickedTaxon?.id,
    inatPickedTaxon?.name,
    selected?.id,
    selected?.name,
  ]);

  const showDemoHotspots = Boolean(
    selected && (layers.recent || layers.historical || layers.forecast),
  );

  const sightingsBelow = useMemo(() => {
    if (selected) {
      const key = selected.name.split(" ")[0].toLowerCase();
      const hit = communitySightings.filter(
        (s) =>
          s.species.toLowerCase().includes(key) ||
          s.text.toLowerCase().includes(selected.name.toLowerCase()),
      );
      return hit.length ? hit : communitySightings.slice(0, 4);
    }
    if (inatPickedTaxon?.name) {
      const key = inatPickedTaxon.name.split(" ")[0].toLowerCase();
      const hit = communitySightings.filter(
        (s) =>
          s.species.toLowerCase().includes(key) ||
          s.text.toLowerCase().includes(inatPickedTaxon.name.toLowerCase()),
      );
      return hit.length ? hit : communitySightings.slice(0, 4);
    }
    return communitySightings.slice(0, 4);
  }, [selected, inatPickedTaxon]);

  const habIsLow = Boolean(selected?.habRisk?.toLowerCase()?.includes("low"));

  const scheduleSuggestClose = () => {
    window.clearTimeout(suggestBlurTimerRef.current);
    suggestBlurTimerRef.current = window.setTimeout(
      () => setSuggestOpen(false),
      200,
    );
  };

  const pickMockRow = (species) => {
    setDiscoveryId(null);
    setQuery(species.name);
    setInatPickedTaxon(null);
    setMockSpeciesPick(species);
    setSuggestOpen(false);
  };

  const pickInatRow = (taxon) => {
    if (!taxon?.id) return;
    setDiscoveryId(null);
    setQuery(taxon.name || taxon.matched_term || "");
    setMockSpeciesPick(null);
    setInatPickedTaxon({
      id: taxon.id,
      name: taxon.name || taxon.matched_term || "Taxon",
      photoUrl: taxonPhotoUrl(taxon),
    });
    setSuggestOpen(false);
  };

  const toggleLayer = (key) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="ml-app">
      {/* —— Breadcrumb —— */}
      <nav
        className="rp-breadcrumb"
        aria-label="Breadcrumb"
        style={{ marginBottom: "0.75rem" }}
      >
        <Link to="/">Home</Link>
        <span className="rp-breadcrumb-sep">/</span>
        <span aria-current="page">Marine life</span>
      </nav>

      {/* —— Search + suggested chips —— */}
      <div className="ml-app-search">
        <label htmlFor="ml-app-q" className="ml-app-search-label">
          What species do you want to see while snorkeling?
        </label>
        <p className="ml-app-search-hint">
          Type to see matches, then click a row to load the map — Enter does not
          select.
        </p>
        <div className="ml-app-search-combo">
          <input
            id="ml-app-q"
            className="ml-app-search-input"
            type="text"
            role="combobox"
            aria-expanded={suggestOpen}
            aria-controls="ml-taxa-listbox"
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setDiscoveryId(null);
              setInatPickedTaxon(null);
              setMockSpeciesPick(null);
            }}
            onFocus={() => {
              window.clearTimeout(suggestBlurTimerRef.current);
              setSuggestOpen(true);
            }}
            onBlur={scheduleSuggestClose}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setSuggestOpen(false);
              }
              if (
                e.key === "Enter" &&
                suggestOpen &&
                suggestionRows.length > 0
              ) {
                e.preventDefault();
              }
            }}
            placeholder="Type to search iNaturalist (e.g. octopus, garibaldi)…"
            autoComplete="off"
          />
          {suggestOpen &&
            !discoveryId &&
            (suggestionRows.length > 0 || taxaSuggestLoading) && (
              <ul
                id="ml-taxa-listbox"
                className="ml-taxa-suggest"
                role="listbox"
                aria-label="Species suggestions"
              >
                {taxaSuggestLoading && suggestionRows.length === 0 && (
                  <li className="ml-taxa-suggest-status" role="presentation">
                    Searching iNaturalist…
                  </li>
                )}
                {suggestionRows.map((row) => {
                  if (row.kind === "mock") {
                    const s = row.species;
                    return (
                      <li key={row.key} role="presentation">
                        <button
                          type="button"
                          role="option"
                          className="ml-taxa-opt"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => pickMockRow(s)}
                        >
                          <span
                            className="ml-taxa-opt-thumb ml-taxa-opt-thumb--mock"
                            style={{ backgroundImage: `url(${s.detailImage})` }}
                            aria-hidden
                          />
                          <span className="ml-taxa-opt-text">
                            <span className="ml-taxa-opt-name">{s.name}</span>
                            <span className="ml-taxa-opt-meta">
                              ReefPulse guide
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  }
                  const t = row.taxon;
                  const thumb = taxonPhotoUrl(t);
                  return (
                    <li key={row.key} role="presentation">
                      <button
                        type="button"
                        role="option"
                        className="ml-taxa-opt"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickInatRow(t)}
                      >
                        <span className="ml-taxa-opt-thumb" aria-hidden>
                          {thumb ? (
                            <img
                              src={thumb}
                              alt=""
                              className="ml-taxa-opt-thumb-img"
                              loading="lazy"
                              decoding="async"
                              referrerPolicy="no-referrer"
                            />
                          ) : null}
                        </span>
                        <span className="ml-taxa-opt-text">
                          <span className="ml-taxa-opt-name">
                            {t.name || t.matched_term}
                          </span>
                          {t.matched_term && t.matched_term !== t.name && (
                            <span className="ml-taxa-opt-meta">
                              {t.matched_term}
                            </span>
                          )}
                          <span className="ml-taxa-opt-meta">iNaturalist</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
        </div>
      </div>

      <div
        className="ml-discovery-chips"
        role="group"
        aria-label="Suggested searches"
      >
        {discoveryChips.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`ml-discovery-chip ${discoveryId === c.id ? "is-on" : ""}`}
            onClick={() => {
              setDiscoveryId(c.id);
              setInatPickedTaxon(null);
              setMockSpeciesPick(null);
              const first = speciesForDiscoveryChip(c.id)[0];
              setQuery(first ? first.name : "");
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* —— Profile | map | best locations —— */}
      <div className="ml-app-grid">
        <aside className="ml-app-profile" aria-label="Species overview">
          {selected ? (
            <>
              <div
                className="ml-app-profile-img"
                style={{ backgroundImage: `url(${selected.detailImage})` }}
              />
              <h2>{selected.name}</h2>
              <p className="ml-app-muted">{selected.hint}</p>
              {selected.bestSeason && (
                <dl className="ml-spec-dl">
                  <div>
                    <dt>Best season</dt>
                    <dd>{selected.bestSeason}</dd>
                  </div>
                  <div>
                    <dt>Best time of day</dt>
                    <dd>{selected.bestTimeOfDay}</dd>
                  </div>
                  <div>
                    <dt>Typical habitat</dt>
                    <dd>{selected.typicalHabitat}</dd>
                  </div>
                  <div>
                    <dt>Snorkeling notes</dt>
                    <dd>{selected.difficultyNote}</dd>
                  </div>
                </dl>
              )}
              <div className="ml-app-mini">
                <div>
                  <small>Snorkel safety</small>
                  <strong>{selected.snorkelSafety}</strong>
                </div>
                <div>
                  <small>Water</small>
                  <strong>{selected.waterTempF}°F</strong>
                </div>
              </div>
              <p className="ml-app-muted" style={{ fontSize: "0.8rem" }}>
                HAB:{" "}
                <span className={habIsLow ? "ml-badge-low" : "ml-badge-mod"}>
                  {selected.habRisk}
                </span>
              </p>
              <div className="ml-inat-profile">
                {inatLoading && (
                  <p className="ml-app-muted ml-inat-line">
                    Loading iNaturalist (California)…
                  </p>
                )}
                {inatError && (
                  <p className="ml-app-muted ml-inat-line" role="status">
                    {inatError}
                  </p>
                )}
                {!inatLoading && !inatError && inatTaxonName && (
                  <p className="ml-app-muted ml-inat-line">
                    <strong className="ml-inat-strong">iNaturalist</strong>:
                    matched <em>{inatTaxonName}</em>
                    {inatTotal != null
                      ? ` · ~${inatTotal.toLocaleString()} CA observations`
                      : ""}
                  </p>
                )}
              </div>
              <Link
                className="ml-btn-primary"
                style={{ display: "block", marginTop: "0.75rem" }}
                to={`/explore/${selected.exploreLocationId}`}
              >
                View beach in Explore
              </Link>
              <Link
                className="ml-btn-ghost"
                style={{ display: "block", marginTop: "0.5rem" }}
                to="/community"
              >
                Share your sighting
              </Link>
            </>
          ) : inatPickedTaxon ? (
            <>
              <div className="ml-app-profile-img ml-app-profile-img--inat">
                {inatPickedTaxon.photoUrl ? (
                  <img
                    src={inatPickedTaxon.photoUrl}
                    alt=""
                    className="ml-app-profile-img__inat"
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      e.currentTarget.remove();
                    }}
                  />
                ) : null}
              </div>
              <h2>{inatPickedTaxon.name}</h2>
              <p className="ml-app-muted">
                Selected from iNaturalist. Full snorkeling guide fields (season,
                safety, waves) appear when you pick a ReefPulse shortlist
                species or a suggested chip.
              </p>
              <div className="ml-inat-profile">
                {inatLoading && (
                  <p className="ml-app-muted ml-inat-line">
                    Loading iNaturalist (California)…
                  </p>
                )}
                {inatError && (
                  <p className="ml-app-muted ml-inat-line" role="status">
                    {inatError}
                  </p>
                )}
                {!inatLoading && !inatError && inatTaxonName && (
                  <p className="ml-app-muted ml-inat-line">
                    <strong className="ml-inat-strong">iNaturalist</strong>:{" "}
                    <em>{inatTaxonName}</em>
                    {inatTotal != null
                      ? ` · ~${inatTotal.toLocaleString()} CA observations`
                      : ""}
                  </p>
                )}
              </div>
              <a
                className="ml-btn-primary"
                style={{ display: "block", marginTop: "0.75rem" }}
                href={`https://www.inaturalist.org/taxa/${inatPickedTaxon.id}`}
                target="_blank"
                rel="noreferrer"
              >
                View taxon on iNaturalist
              </a>
            </>
          ) : (
            <p className="ml-app-muted" style={{ margin: 0 }}>
              Type at least two letters for iNaturalist suggestions (with
              photos), or tap a chip. Click a suggestion row to load California
              sightings on the map.
            </p>
          )}
        </aside>

        <div className="ml-app-map" aria-label="Distribution map">
          <div className="ml-map-layers" role="group" aria-label="Map layers">
            <span className="ml-map-inat-legend" aria-hidden>
              #FAFF6C dots = iNaturalist reports (area) · teal = ReefPulse demo
              hotspots
            </span>
            <label>
              <input
                type="checkbox"
                checked={layers.recent}
                onChange={() => toggleLayer("recent")}
              />
              Recent sightings
            </label>
            <label>
              <input
                type="checkbox"
                checked={layers.historical}
                onChange={() => toggleLayer("historical")}
              />
              Historical presence
            </label>
            <label>
              <input
                type="checkbox"
                checked={layers.forecast}
                onChange={() => toggleLayer("forecast")}
              />
              Forecasted presence
            </label>
          </div>
          <p className="ml-map-sample-note">
            Map sample: up to 400 recent California observations (research +
            needs ID). Each dot is the average position of reports in a small
            grid cell (not every individual record).
          </p>
          <MarineLifeGoogleDistributionMap
            distribution={inatDistribution}
            demoHotspots={selected?.hotspots ?? []}
            showDemoHotspots={showDemoHotspots}
            loading={inatLoading}
            panelActive={panelActive}
          />
        </div>

        <aside className="ml-app-locs" aria-label="Best locations">
          <h3>Best locations</h3>
          {panelActive ? (
            <>
              {inatTopPlaces.length > 0 && (
                <div className="ml-inat-top">
                  <h4 className="ml-inat-top-title">
                    Top California beaches (from sightings)
                  </h4>
                  <p className="ml-app-muted ml-inat-top-sub">
                    Each iNaturalist observation is counted toward the nearest
                    ReefPulse California beach (within ~55 km of the reported
                    coordinates). Sample: last page of CA observations
                    (place_id={INAT_PLACE_ID_CALIFORNIA}).
                  </p>
                  <ol className="ml-loc-list ml-loc-list--inat">
                    {inatTopPlaces.map((row, i) => (
                      <li key={row.label}>
                        <strong>{row.label}</strong>
                        <div className="ml-app-muted">
                          {row.count} observation{row.count === 1 ? "" : "s"} in
                          sample
                        </div>
                        {i === 0 && (
                          <div className="ml-go-hint">
                            Most reported in this batch
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              {selected ? (
                <>
                  <h4 className="ml-demo-locs-title">
                    ReefPulse demo hotspots
                  </h4>
                  <ol className="ml-loc-list">
                    {selected.hotspots.map((h, i) => {
                      const beach = findLocation(selected.exploreLocationId);
                      const go =
                        beach && beach.safetyIndex >= 85 && beach.waveFt <= 3.5
                          ? "Go now — conditions favorable"
                          : "Better tomorrow morning — calmer window expected";
                      return (
                        <li key={h.label}>
                          <strong>{h.label}</strong>
                          <div className="ml-app-muted">
                            Chance ~{88 - i * 6}% ·{" "}
                            {beach
                              ? `${beach.waveFt} ft waves, ${beach.waterTempF}°F`
                              : "—"}
                          </div>
                          <div className="ml-go-hint">{go}</div>
                        </li>
                      );
                    })}
                  </ol>
                </>
              ) : (
                <p
                  className="ml-app-muted"
                  style={{ marginTop: "0.5rem", marginBottom: 0 }}
                >
                  ReefPulse demo hotspot list appears when you pick a shortlist
                  species or chip. iNaturalist top places above use your
                  selected taxon.
                </p>
              )}
              <p className="ml-inat-attrib">
                Observation points and place names from{" "}
                <a
                  href="https://www.inaturalist.org/"
                  target="_blank"
                  rel="noreferrer"
                >
                  iNaturalist
                </a>
                . Use subject to{" "}
                <a
                  href="https://www.inaturalist.org/pages/terms"
                  target="_blank"
                  rel="noreferrer"
                >
                  Terms of Use
                </a>
                .
              </p>
            </>
          ) : (
            <p className="ml-app-muted" style={{ margin: 0 }}>
              Hotspot list appears after you pick a species from suggestions or
              a chip.
            </p>
          )}
        </aside>
      </div>

      {/* —— Related community posts —— */}
      <section
        className="ml-app-sightings"
        aria-labelledby="ml-sightings-title"
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            marginTop: "0.75rem",
          }}
        >
          <Link
            to="/community"
            style={{ fontWeight: 700, fontSize: "0.88rem" }}
          >
            Open full community feed →
          </Link>
          <Link
            to="/community"
            style={{ fontWeight: 700, fontSize: "0.88rem", color: "#292F69" }}
          >
            Log your snorkeling trip
          </Link>
        </div>
      </section>
    </div>
  );
}

export default MarineLifeDiscoveryPage;
