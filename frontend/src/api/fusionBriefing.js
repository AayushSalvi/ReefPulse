import { getApiBase } from "../lib/apiBase";

export async function postFusionBriefing(body) {
  const base = getApiBase();
  const path = "/api/v1/fusion/briefing";
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `fusion briefing HTTP ${res.status}`);
  }
  return res.json();
}
