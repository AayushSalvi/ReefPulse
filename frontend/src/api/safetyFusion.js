import { getApiBase } from "../lib/apiBase";

/** Recreation safety fusion (Model A forecast + Model B anomaly) from the ReefPulse API. */
export async function fetchRecreationFusion(locationSlug) {
  const base = getApiBase();
  const path = `/api/v1/safety/${encodeURIComponent(locationSlug)}`;
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Safety API HTTP ${res.status}`);
  }
  return res.json();
}
