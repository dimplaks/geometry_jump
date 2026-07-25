/**
 * API base URL.
 * - Empty string: same-origin (local `npm start`)
 * - Set via window.__GJ_API_BASE__ (injected for Android / production)
 * - Or edit DEFAULT_REMOTE for a fixed production server
 */
const DEFAULT_REMOTE = "";

function resolveApiBase() {
  if (typeof window !== "undefined" && window.__GJ_API_BASE__ != null) {
    return String(window.__GJ_API_BASE__).replace(/\/+$/, "");
  }
  return String(DEFAULT_REMOTE || "").replace(/\/+$/, "");
}

export const API_BASE = resolveApiBase();

export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE}${p}`;
}

/** @type {boolean | null} */
let onlineCache = null;

export function isOnlineMode() {
  return onlineCache === true;
}

export function setOnlineMode(value) {
  onlineCache = !!value;
}

export function isOfflineMode() {
  return onlineCache === false;
}

export async function checkServerHealth(timeoutMs = 3500) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(apiUrl("/api/health"), {
      method: "GET",
      signal: ctrl?.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error("bad status");
    const data = await res.json();
    setOnlineMode(!!data.ok);
    return true;
  } catch {
    setOnlineMode(false);
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
