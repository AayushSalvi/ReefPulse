import { getApiBase } from "../lib/apiBase";

/**
 * POST ranked species (fishdeck) for coordinates / context.
 * @param {Record<string, unknown>} body
 */
export async function postSpeciesRank(body) {
  const base = getApiBase();
  const path = "/api/v1/species/rank";
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `species rank HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * GET ranked species from coordinate-driven model path.
 * Uses: /api/v1/species/:locationSlug?lat&lon&date&top_k
 */
export async function getSpeciesRankByCoordinates({
  locationSlug,
  latitude,
  longitude,
  date,
  topK = 10,
}) {
  const base = getApiBase();
  const path = `/api/v1/species/${encodeURIComponent(locationSlug)}`;
  const url = new URL(base ? `${base}${path}` : path, window.location.origin);
  url.searchParams.set("lat", String(latitude));
  url.searchParams.set("lon", String(longitude));
  url.searchParams.set("top_k", String(topK));
  if (date) url.searchParams.set("date", date);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `species rank HTTP ${res.status}`);
  }
  return res.json();
}
