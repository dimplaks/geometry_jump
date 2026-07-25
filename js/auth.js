import { apiUrl, isOfflineMode } from "./config.js";

const TOKEN_KEY = "geometry-jump-token";
const OFFLINE_USER_KEY = "geometry-jump-offline-user";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getOfflineUser() {
  try {
    const raw = localStorage.getItem(OFFLINE_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setOfflineUser(user) {
  if (user) localStorage.setItem(OFFLINE_USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(OFFLINE_USER_KEY);
}

export function enterOfflineGuest(name = "guest") {
  const username = String(name || "guest")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .slice(0, 20) || "guest";
  const user = {
    username: `offline_${username}`,
    offline: true,
    createdAt: Date.now(),
    progress: null,
  };
  setToken("");
  setOfflineUser(user);
  return user;
}

export function clearOfflineGuest() {
  setOfflineUser(null);
}

async function api(path, { method = "GET", body, auth = true } = {}) {
  if (isOfflineMode()) {
    const err = new Error("Нет соединения с сервером");
    err.status = 0;
    err.offline = true;
    throw err;
  }
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = {};
  }
  if (!res.ok) {
    const err = new Error(data.error || `Ошибка ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function register(username, password) {
  const data = await api("/api/register", {
    method: "POST",
    body: { username, password },
    auth: false,
  });
  setToken(data.token);
  clearOfflineGuest();
  return data.user;
}

export async function login(username, password) {
  const data = await api("/api/login", {
    method: "POST",
    body: { username, password },
    auth: false,
  });
  setToken(data.token);
  clearOfflineGuest();
  return data.user;
}

export async function logout() {
  try {
    if (!isOfflineMode() && getToken()) {
      await api("/api/logout", { method: "POST" });
    }
  } catch (_) {
    /* offline / expired */
  }
  setToken("");
  clearOfflineGuest();
}

export async function fetchMe() {
  const offline = getOfflineUser();
  if (offline) return offline;
  if (!getToken()) return null;
  try {
    const data = await api("/api/me");
    return data.user;
  } catch (e) {
    if (e.status === 401) setToken("");
    return null;
  }
}

export async function saveProgress(progress) {
  if (getOfflineUser() || isOfflineMode()) return null;
  if (!getToken()) return null;
  const data = await api("/api/progress", { method: "PUT", body: progress });
  return data.user;
}

export async function fetchPlayers() {
  const data = await api("/api/players", { auth: false });
  return data.players || [];
}
