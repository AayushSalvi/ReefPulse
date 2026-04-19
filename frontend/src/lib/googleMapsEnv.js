/**
 * Normalizes Google Maps API key strings from `.env` (quotes, BOM, whitespace).
 * @param {unknown} value
 * @returns {string}
 */
export function normalizeGoogleMapsApiKey(value) {
  if (value == null || typeof value !== "string") return "";
  let s = value.trim();
  if (!s) return "";
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1).trim();
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  return s;
}

/**
 * Resolves key from Vite-injected env (browser) plus optional build-time inject.
 * @param {string} [injectedAtBuild]
 */
export function resolveGoogleMapsApiKey(injectedAtBuild) {
  const a = normalizeGoogleMapsApiKey(import.meta.env.VITE_GOOGLE_MAPS_API_KEY);
  const b = normalizeGoogleMapsApiKey(import.meta.env.GOOGLE_MAPS_API_KEY);
  const c = normalizeGoogleMapsApiKey(injectedAtBuild);
  return a || b || c;
}
