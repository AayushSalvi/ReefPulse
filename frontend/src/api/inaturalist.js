/**
 * iNaturalist API v2 (read-only public GET).
 * @see https://api.inaturalist.org/v2/api-docs
 * Debounce calls from UI; stay under ~60 req/min per iNat guidance.
 */

const BASE = "https://api.inaturalist.org/v2";

/** California (US state) on iNaturalist */
export const INAT_PLACE_ID_CALIFORNIA = "14";

const TAXA_FIELDS =
  "name,matched_term,rank,iconic_taxon_id,default_photo.medium_url,default_photo.url,default_photo.square_url";
const TAXON_DETAIL_FIELDS = "name,default_photo.medium_url,default_photo.url,default_photo.square_url";
const OBS_FIELDS = "place_guess,location,species_guess,geojson";

/** Prefer fish, sharks/rays, mollusks, marine mammals, etc. */
const PREFERRED_ICONIC = [47178, 47534, 47115, 40151, 47286];
const DEPRIORITIZE_ICONIC = new Set([3, 47158, 47126, 47119]);

/**
 * Best-effort public image URL for a taxon (autocomplete or taxa/:id).
 * @param {{ default_photo?: { medium_url?: string, url?: string, square_url?: string, original_url?: string } }} taxon
 */
export function taxonPhotoUrl(taxon) {
  if (!taxon || typeof taxon !== "object") return null;
  const p = taxon.default_photo;
  if (!p || typeof p !== "object") return null;
  const u =
    p.medium_url ||
    p.url ||
    p.square_url ||
    (typeof p.original_url === "string" ? p.original_url : null);
  if (!u || typeof u !== "string") return null;
  const t = u.trim();
  return t.length ? t : null;
}

/**
 * Observation coordinates: prefers `location` (lat,lng); falls back to GeoJSON Point (lng,lat).
 * @param {{ location?: string, geojson?: { type?: string, coordinates?: number[] } }} o
 * @returns {{ lat: number, lng: number } | null}
 */
export function parseObservationLatLng(o) {
  if (!o || typeof o !== "object") return null;
  if (o.location) {
    const parts = String(o.location).split(",");
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0]);
      const lng = parseFloat(parts[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  }
  const gj = o.geojson;
  if (gj && gj.type === "Point" && Array.isArray(gj.coordinates) && gj.coordinates.length >= 2) {
    const lng = parseFloat(gj.coordinates[0]);
    const lat = parseFloat(gj.coordinates[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
  }
  return null;
}

/**
 * Single taxon record (helps when autocomplete omits photo fields).
 * @param {number|string} taxonId
 * @param {AbortSignal} [signal]
 * @returns {Promise<object | null>}
 */
export async function fetchTaxonById(taxonId, signal) {
  const id = String(taxonId).trim();
  if (!id) return null;
  const url = new URL(`${BASE}/taxa/${encodeURIComponent(id)}`);
  url.searchParams.set("fields", TAXON_DETAIL_FIELDS);
  const res = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`iNaturalist taxon error (${res.status})`);
  const json = await res.json();
  const results = json?.results;
  return Array.isArray(results) && results[0] ? results[0] : null;
}

/**
 * @param {object[]} results from `/taxa/autocomplete`
 * @returns {object | null}
 */
export function pickMarineTaxon(results) {
  if (!Array.isArray(results) || !results.length) return null;
  for (const iconic of PREFERRED_ICONIC) {
    const hit = results.find((t) => t.iconic_taxon_id === iconic);
    if (hit) return hit;
  }
  const ok = results.find((t) => t.iconic_taxon_id != null && !DEPRIORITIZE_ICONIC.has(t.iconic_taxon_id));
  return ok || results[0];
}

/**
 * @param {string} q
 * @param {AbortSignal} [signal]
 */
export async function taxaAutocomplete(q, signal) {
  const trimmed = String(q).trim();
  if (!trimmed) return [];

  const url = new URL(`${BASE}/taxa/autocomplete`);
  url.searchParams.set("q", trimmed);
  url.searchParams.set("per_page", "15");
  url.searchParams.set("fields", TAXA_FIELDS);

  const res = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`iNaturalist taxa error (${res.status})`);
  const json = await res.json();
  return Array.isArray(json.results) ? json.results : [];
}

/**
 * @param {number|string} taxonId
 * @param {{ perPage?: number, maxPages?: number, signal?: AbortSignal }} [opts]
 *   maxPages — fetch additional pages (1–3) for a denser map sample; stays within typical iNat rate guidance if debounced.
 */
export async function observationsByTaxonCalifornia(taxonId, opts = {}) {
  const perPage = Math.min(Math.max(Number(opts.perPage) || 200, 1), 200);
  const maxPages = Math.min(Math.max(Number(opts.maxPages) ?? 2, 1), 3);
  const signal = opts.signal;

  let all = [];
  let totalResults = 0;

  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL(`${BASE}/observations`);
    url.searchParams.set("taxon_id", String(taxonId));
    url.searchParams.set("place_id", INAT_PLACE_ID_CALIFORNIA);
    url.searchParams.set("per_page", String(perPage));
    url.searchParams.set("page", String(page));
    url.searchParams.set("quality_grade", "research,needs_id");
    url.searchParams.set("order_by", "created_at");
    url.searchParams.set("order", "desc");
    url.searchParams.set("fields", OBS_FIELDS);

    const res = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`iNaturalist observations error (${res.status})`);
    const json = await res.json();
    const batch = Array.isArray(json.results) ? json.results : [];
    if (page === 1 && typeof json.total_results === "number") totalResults = json.total_results;
    all = all.concat(batch);
    if (batch.length < perPage) break;
  }

  if (!totalResults) totalResults = all.length;
  return { results: all, totalResults };
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Buckets observations onto the nearest California beach in `beaches` (by lat/lng).
 * Observations farther than `maxKm` from every beach are ignored.
 *
 * @param {{ location?: string }[]} observations
 * @param {{ id?: string, name: string, lat: number, lng: number }[]} beaches
 * @param {number} [limit]
 * @param {number} [maxKm]
 * @returns {{ label: string; count: number }[]}
 */
export function topCaBeachesFromObservations(observations, beaches, limit = 3, maxKm = 55) {
  if (!Array.isArray(observations) || !Array.isArray(beaches) || !beaches.length) return [];

  const map = new Map();
  for (const o of observations) {
    const pos = parseObservationLatLng(o);
    if (!pos) continue;
    const { lat, lng } = pos;

    let best = null;
    let bestKm = Infinity;
    for (const b of beaches) {
      if (!Number.isFinite(b.lat) || !Number.isFinite(b.lng)) continue;
      const d = haversineKm(lat, lng, b.lat, b.lng);
      if (d < bestKm) {
        bestKm = d;
        best = b;
      }
    }
    if (best == null || bestKm > maxKm) continue;

    const key = String(best.id || best.name || "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    const label = String(best.name || "Beach").trim();
    const prev = map.get(key);
    map.set(key, { label: prev?.label || label, count: (prev?.count || 0) + 1 });
  }

  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

/**
 * @param {{ location?: string, place_guess?: string, species_guess?: string }[]} observations
 * @param {number} [maxPins]
 */
export function pinsFromObservations(observations, maxPins = 20) {
  const pins = [];
  for (const o of observations) {
    const pos = parseObservationLatLng(o);
    if (!pos) continue;
    const label = (o.place_guess || o.species_guess || "Observation").slice(0, 32);
    pins.push({ lat: pos.lat, lng: pos.lng, label });
    if (pins.length >= maxPins) break;
  }
  return pins;
}

/**
 * Grid-merge nearby coordinates for map dots. Each cell stores the **mean** lat/lng of its observations
 * (more accurate than the grid corner). Uses `parseObservationLatLng` so `geojson` is used when `location` is missing.
 *
 * @param {{ location?: string, geojson?: object, place_guess?: string, species_guess?: string }[]} observations
 * @param {{ decimals?: number }} [opts] — default 3 (~110 m); higher = more dots, less merging
 * @returns {{ lat: number, lng: number, count: number, label: string }[]}
 */
export function aggregateObservationDots(observations, opts = {}) {
  const decimals = Math.min(Math.max(Number(opts.decimals) ?? 3, 2), 5);
  if (!Array.isArray(observations)) return [];

  const map = new Map();
  for (const o of observations) {
    const pos = parseObservationLatLng(o);
    if (!pos) continue;
    const { lat, lng } = pos;
    const rlat = Number(lat.toFixed(decimals));
    const rlng = Number(lng.toFixed(decimals));
    const key = `${rlat},${rlng}`;
    const guess = (o.place_guess || o.species_guess || "").trim().slice(0, 48);
    const prev = map.get(key);
    if (prev) {
      prev.count += 1;
      prev.sumLat += lat;
      prev.sumLng += lng;
      prev.lat = prev.sumLat / prev.count;
      prev.lng = prev.sumLng / prev.count;
      if (!prev.label && guess) prev.label = guess;
    } else {
      map.set(key, {
        lat,
        lng,
        count: 1,
        sumLat: lat,
        sumLng: lng,
        label: guess
      });
    }
  }
  return [...map.values()]
    .map(({ sumLat: _s1, sumLng: _s2, ...rest }) => rest)
    .sort((a, b) => b.count - a.count);
}
