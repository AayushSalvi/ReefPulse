import { getApiBase } from "../lib/apiBase";

function apiUrl(path) {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

export async function postModelAForecast(body) {
  const res = await fetch(apiUrl("/api/v1/forecasts/model-a"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `model-a HTTP ${res.status}`);
  }
  return res.json();
}

export async function postAnomalyScore(body) {
  const res = await fetch(apiUrl("/api/v1/anomaly/score"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `anomaly HTTP ${res.status}`);
  }
  return res.json();
}
