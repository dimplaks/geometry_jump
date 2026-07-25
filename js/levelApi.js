import { getToken } from "./auth.js";
import { normalizeLevel } from "./customLevels.js";
import { apiUrl, isOfflineMode } from "./config.js";

async function api(path, { method = "GET", body, auth = false } = {}) {
  if (isOfflineMode()) {
    const err = new Error("Нет соединения с сервером");
    err.status = 0;
    err.offline = true;
    throw err;
  }
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (!token) {
      const err = new Error("Нужен вход в аккаунт");
      err.status = 401;
      throw err;
    }
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try {
    data = await res.json();
  } catch (_) {}
  if (!res.ok) {
    const err = new Error(data.error || `Ошибка ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

/** Public list of all shared levels (summaries). */
export async function listCommunityLevels() {
  const data = await api("/api/levels");
  return (data.levels || []).map((l) => normalizeLevel(l));
}

/** Levels owned by the logged-in player. */
export async function listMyLevels() {
  const data = await api("/api/levels/mine", { auth: true });
  return (data.levels || []).map((l) => normalizeLevel(l));
}

export async function getSharedLevel(id) {
  const data = await api(`/api/levels/${encodeURIComponent(id)}`);
  return normalizeLevel(data.level);
}

/** Create or update a shared level (author = current user). */
export async function publishLevel(level) {
  const payload = {
    id: level.id,
    name: level.name,
    theme: level.theme,
    length: level.length,
    speed: level.speed,
    objects: level.objects,
  };
  const data = await api("/api/levels", { method: "POST", body: payload, auth: true });
  return normalizeLevel(data.level);
}

export async function deleteSharedLevel(id) {
  await api(`/api/levels/${encodeURIComponent(id)}`, { method: "DELETE", auth: true });
}

export async function recordLevelPlay(id) {
  try {
    await api(`/api/levels/${encodeURIComponent(id)}/play`, { method: "POST" });
  } catch (_) {}
}

export async function fetchSocial(levelKey) {
  return api(`/api/social/${encodeURIComponent(levelKey)}`, { auth: !!getToken() });
}

export async function toggleLike(levelKey) {
  return api(`/api/social/${encodeURIComponent(levelKey)}/like`, {
    method: "POST",
    auth: true,
  });
}

export async function postComment(levelKey, text) {
  return api(`/api/social/${encodeURIComponent(levelKey)}/comments`, {
    method: "POST",
    body: { text },
    auth: true,
  });
}

export async function submitScore(levelKey, { time, attempts }) {
  return api(`/api/social/${encodeURIComponent(levelKey)}/score`, {
    method: "POST",
    body: { time, attempts },
    auth: true,
  });
}

export function campaignKey(index) {
  return `campaign-${index}`;
}
