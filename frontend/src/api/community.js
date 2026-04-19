import { getApiBase } from "../lib/apiBase";

function buildUrl(path, params) {
  const base = getApiBase();
  const u = new URL(base ? `${base}${path}` : path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v === undefined || v === null || v === "") return;
      u.searchParams.set(k, String(v));
    });
  }
  return base ? `${u.pathname}${u.search}` : `${u.pathname}${u.search}`;
}

async function readApiError(res) {
  try {
    const body = await res.json();
    const detail = body?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail.map((d) => d?.msg || JSON.stringify(d)).join("; ");
    }
  } catch {
    // ignore
  }
  return `HTTP ${res.status}`;
}

export async function fetchCommunityPosts(params = {}, token) {
  const url = buildUrl("/api/v1/community/posts", params);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

export async function createCommunityPost(body, token) {
  const url = buildUrl("/api/v1/community/posts");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json();
}

async function authedRequest(path, { method = "GET", body, token, params } = {}) {
  const url = buildUrl(path, params);
  const res = await fetch(url, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  if (res.status === 204) return null;
  return res.json();
}

export async function presignCommunityMedia(file, token) {
  return authedRequest("/api/v1/community/media/presign", {
    method: "POST",
    token,
    body: {
      filename: file.name,
      content_type: file.type || "image/jpeg",
      size_bytes: file.size,
    },
  });
}

export async function uploadFileToPresignedUrl(uploadUrl, file, headers = {}) {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers,
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (HTTP ${res.status})`);
}

export async function likeCommunityPost(postId, token) {
  return authedRequest(`/api/v1/community/posts/${encodeURIComponent(postId)}/like`, {
    method: "POST",
    token,
  });
}

export async function unlikeCommunityPost(postId, token) {
  return authedRequest(`/api/v1/community/posts/${encodeURIComponent(postId)}/like`, {
    method: "DELETE",
    token,
  });
}

export async function saveCommunityPost(postId, token) {
  return authedRequest(`/api/v1/community/posts/${encodeURIComponent(postId)}/save`, {
    method: "POST",
    token,
  });
}

export async function unsaveCommunityPost(postId, token) {
  return authedRequest(`/api/v1/community/posts/${encodeURIComponent(postId)}/save`, {
    method: "DELETE",
    token,
  });
}

export async function fetchCommunityComments(postId, token) {
  return authedRequest(`/api/v1/community/posts/${encodeURIComponent(postId)}/comments`, {
    method: "GET",
    token,
    params: { limit: 50, offset: 0 },
  });
}

export async function createCommunityComment(postId, text, token) {
  return authedRequest(`/api/v1/community/posts/${encodeURIComponent(postId)}/comments`, {
    method: "POST",
    token,
    body: { text },
  });
}
