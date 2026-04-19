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
