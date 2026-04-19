import { getApiBase } from "../lib/apiBase";

/**
 * @param {string} message
 * @returns {Promise<{ reply: string; model: string }>}
 */
export async function postChatQuery(message) {
  const base = getApiBase();
  const path = "/api/v1/chat/query";
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = await res.json();
      if (typeof j.detail === "string") detail = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json();
}
