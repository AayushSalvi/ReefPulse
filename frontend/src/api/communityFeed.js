import { getApiBase } from "../lib/apiBase";

/** @param {string} iso */
function formatRelativeTime(iso) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 45) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Maps API `CommunityPost` (snake_case JSON) to the shape `FeedPost` expects (camelCase).
 * @param {Record<string, unknown>} p
 */
export function mapCommunityPostToSighting(p) {
  const cc = p.challenge_completion;
  return {
    id: String(p.id),
    species: p.species,
    username: p.username ?? null,
    author: p.author,
    locationName: p.location_name,
    time: formatRelativeTime(p.created_at),
    text: p.text,
    visibility: p.visibility ?? null,
    tips: Array.isArray(p.tips) ? p.tips : [],
    tags: Array.isArray(p.tags) ? p.tags : [],
    likes: typeof p.likes === "number" ? p.likes : 0,
    commentsCount: typeof p.comments_count === "number" ? p.comments_count : 0,
    imageUrl: p.image_url || null,
    challengeCompletion: cc
      ? {
          challengeId: cc.challenge_id,
          title: cc.title,
          badgeName: cc.badge_name
        }
      : null
  };
}

/**
 * @param {{ token?: string | null; tag?: string | null; locationId?: string | null; speciesQuery?: string | null; sort?: string; limit?: number }} opts
 */
export async function fetchCommunityPosts(opts = {}) {
  const base = getApiBase();
  const params = new URLSearchParams();
  if (opts.tag && opts.tag !== "all") params.set("tag", opts.tag);
  if (opts.locationId) params.set("location_id", opts.locationId);
  const q = (opts.speciesQuery || "").trim();
  if (q) params.set("species_query", q);
  params.set("sort", opts.sort && ["recent", "popular", "nearby"].includes(opts.sort) ? opts.sort : "recent");
  params.set("limit", String(Math.min(100, Math.max(1, opts.limit ?? 40))));
  const path = `/api/v1/community/posts?${params.toString()}`;
  const url = base ? `${base}${path}` : path;
  const headers = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }
  return res.json();
}
