/**
 * California Open Data Portal — monitored beaches (CKAN datastore SQL).
 * Resource: fcbc9250-06e3-437d-b0c6-3cc5ddde93fc
 *
 * Dev / `vite preview`: use same-origin `/api/ca-datastore/...` (see `frontend/vite.config.js` proxy).
 * Production: set `VITE_CA_GOV_ACTION_BASE_URL` to a same-origin proxy, or host that adds CORS to data.ca.gov.
 *
 * Note: `datastore_search_sql` on data.ca.gov allows a restricted SQL subset (e.g. no `char_length`, `COALESCE`, …).
 */

const DATASTORE_RESOURCE_ID = "fcbc9250-06e3-437d-b0c6-3cc5ddde93fc";

/** Strip characters that could widen LIKE / SQL; escape single quotes for Postgres string literal. */
function sanitizeSqlLikeUserInput(raw) {
  const t = String(raw).trim().slice(0, 80);
  if (!t) return "";
  const noWild = t.replace(/[%_\\]/g, "");
  return noWild.replace(/'/g, "''");
}

function actionBaseUrl() {
  const fromEnv = import.meta.env.VITE_CA_GOV_ACTION_BASE_URL;
  if (typeof fromEnv === "string" && fromEnv.trim()) {
    return fromEnv.trim().replace(/\/$/, "");
  }
  return "/api/ca-datastore";
}

/**
 * @param {string} searchText
 * @param {{ limit?: number, signal?: AbortSignal }} [opts]
 * @returns {Promise<{ success: boolean, records: object[], error?: string }>}
 */
export async function searchCaBeachesDatastoreSql(searchText, opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 25, 1), 100);
  const fragment = sanitizeSqlLikeUserInput(searchText);
  if (!fragment) {
    return { success: true, records: [] };
  }

  const pattern = `%${fragment}%`;
  const patternEscaped = pattern.replace(/'/g, "''");
  const prefixLike = `${fragment}%`.replace(/'/g, "''");

  const sql = [
    `SELECT * FROM "${DATASTORE_RESOURCE_ID}"`,
    `WHERE LOWER("Beach_Name") LIKE LOWER('${patternEscaped}')`,
    `OR LOWER("County") LIKE LOWER('${patternEscaped}')`,
    `OR LOWER("NearestCityName") LIKE LOWER('${patternEscaped}')`,
    `ORDER BY`,
    `(LOWER("Beach_Name") LIKE LOWER('${prefixLike}')) DESC,`,
    `(LOWER("NearestCityName") LIKE LOWER('${prefixLike}')) DESC,`,
    `"Beach_Name"`,
    `LIMIT ${limit}`
  ].join(" ");

  const url = `${actionBaseUrl()}/datastore_search_sql?sql=${encodeURIComponent(sql)}`;

  let res;
  try {
    res = await fetch(url, { signal: opts.signal, headers: { Accept: "application/json" } });
  } catch (e) {
    return { success: false, records: [], error: e instanceof Error ? e.message : "Network error" };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return { success: false, records: [], error: "Invalid JSON response" };
  }

  if (!res.ok) {
    return { success: false, records: [], error: json?.error?.message || `HTTP ${res.status}` };
  }

  if (!json.success) {
    return { success: false, records: [], error: json?.error?.message || "CKAN action failed" };
  }

  const records = json?.result?.records;
  return { success: true, records: Array.isArray(records) ? records : [] };
}

/**
 * Alphabetical sample of monitored beaches (no search fragment required).
 * @param {{ limit?: number, signal?: AbortSignal }} [opts]
 */
export async function listCaBeachesAlphabetical(opts = {}) {
  const limit = Math.min(Math.max(Number(opts.limit) || 30, 1), 100);
  const sql = [
    `SELECT * FROM "${DATASTORE_RESOURCE_ID}"`,
    `ORDER BY "Beach_Name" ASC`,
    `LIMIT ${limit}`
  ].join(" ");

  const url = `${actionBaseUrl()}/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
  let res;
  try {
    res = await fetch(url, { signal: opts.signal, headers: { Accept: "application/json" } });
  } catch (e) {
    return { success: false, records: [], error: e instanceof Error ? e.message : "Network error" };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return { success: false, records: [], error: "Invalid JSON response" };
  }

  if (!res.ok) {
    return { success: false, records: [], error: json?.error?.message || `HTTP ${res.status}` };
  }
  if (!json.success) {
    return { success: false, records: [], error: json?.error?.message || "CKAN action failed" };
  }

  const records = json?.result?.records;
  return { success: true, records: Array.isArray(records) ? records : [] };
}

const CA_EXPLORE_ID = /^ca-beach-([A-Za-z0-9_-]{1,48})$/;

/**
 * Load one beach row for `/explore/ca-beach-…` URLs.
 * @param {string} exploreId e.g. `ca-beach-326`
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ success: boolean, record: object | null, error?: string }>}
 */
export async function fetchCaBeachByExploreId(exploreId, opts = {}) {
  const m = String(exploreId || "").match(CA_EXPLORE_ID);
  if (!m) {
    return { success: false, record: null, error: null };
  }
  const rawKey = m[1].replace(/'/g, "''");
  const sql = [
    `SELECT * FROM "${DATASTORE_RESOURCE_ID}"`,
    `WHERE CAST("BeachName_id" AS TEXT) = '${rawKey}'`,
    `OR CAST("_id" AS TEXT) = '${rawKey}'`,
    `LIMIT 1`
  ].join(" ");

  const url = `${actionBaseUrl()}/datastore_search_sql?sql=${encodeURIComponent(sql)}`;
  let res;
  try {
    res = await fetch(url, { signal: opts.signal, headers: { Accept: "application/json" } });
  } catch (e) {
    return { success: false, record: null, error: e instanceof Error ? e.message : "Network error" };
  }

  let json;
  try {
    json = await res.json();
  } catch {
    return { success: false, record: null, error: "Invalid JSON response" };
  }

  if (!res.ok) {
    return { success: false, record: null, error: json?.error?.message || `HTTP ${res.status}` };
  }
  if (!json.success) {
    return { success: false, record: null, error: json?.error?.message || "CKAN action failed" };
  }

  const records = json?.result?.records;
  const record = Array.isArray(records) && records[0] ? records[0] : null;
  return { success: true, record, error: record ? undefined : "Not found" };
}

function numOrNull(v) {
  const n = parseFloat(String(v ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

/** CKAN sometimes ships `"Beach_ UpperLon"` (typo with space). */
function pickLatUpper(rec) {
  return numOrNull(rec.Beach_UpperLat);
}

function pickLatLower(rec) {
  return numOrNull(rec.Beach_LowerLat);
}

function pickLonUpper(rec) {
  return numOrNull(rec["Beach_ UpperLon"] ?? rec["Beach_UpperLon"] ?? rec["Beach_ UpperLon "]);
}

function pickLonLower(rec) {
  return numOrNull(rec.Beach_LowerLon);
}

/**
 * @param {object} rec raw CKAN record
 * @returns {{ id: string, name: string, region: string, lat: number, lng: number, meta: string, raw: object }}
 */
export function normalizeCaBeachRecord(rec) {
  const name = String(rec.Beach_Name || rec.Description || "Unknown beach").trim();
  const region = String(rec.County || rec.Agency_Name || "").trim();
  const latU = pickLatUpper(rec);
  const latL = pickLatLower(rec);
  const lonU = pickLonUpper(rec);
  const lonL = pickLonLower(rec);

  let lat = latU ?? latL ?? null;
  let lng = lonU ?? lonL ?? null;
  if (latU != null && latL != null) lat = (latU + latL) / 2;
  if (lonU != null && lonL != null) lng = (lonU + lonL) / 2;
  if (lat == null || lng == null) {
    lat = lat ?? 34.05;
    lng = lng ?? -118.25;
  }

  const id = `ca-beach-${rec.BeachName_id ?? rec._id ?? "x"}`;
  const city = String(rec.NearestCityName || "").trim();
  const meta = [rec.WaterBodyType, city].filter(Boolean).join(" · ") || "data.ca.gov";

  return {
    id,
    name,
    region: region || "California",
    lat,
    lng,
    meta,
    raw: rec
  };
}
