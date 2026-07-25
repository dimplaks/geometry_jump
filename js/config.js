/**
 * API base URL.
 * - Empty: same-origin (local `npm start`)
 * - window.__GJ_API_BASE__ injected for Android / production builds
 * - Packaged Capacitor app falls back to DEFAULT_REMOTE
 */
const DEFAULT_REMOTE = "https://geometry-jump.onrender.com";

function isLikelyPackaged() {
  if (typeof window === "undefined") return false;
  const proto = window.location?.protocol || "";
  const host = window.location?.hostname || "";
  return (
    proto === "capacitor:" ||
    proto === "ionic:" ||
    proto === "file:" ||
    (proto === "https:" && host === "localhost")
  );
}

function resolveApiBase() {
  if (typeof window !== "undefined" && window.__GJ_API_BASE__) {
    return String(window.__GJ_API_BASE__).replace(/\/+$/, "");
  }
  if (isLikelyPackaged()) return DEFAULT_REMOTE;
  return "";
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

/**
 * Render free tier can take 30–60s to wake. APK uses longer timeout + retries.
 * @param {number} [timeoutMs]
 * @param {{ onAttempt?: (n: number, max: number) => void }} [opts]
 */
export async function checkServerHealth(timeoutMs, opts = {}) {
  const remote = !!API_BASE || isLikelyPackaged();
  const perTry = timeoutMs ?? (remote ? 20000 : 4000);
  const attempts = remote ? 4 : 1;

  for (let i = 1; i <= attempts; i++) {
    opts.onAttempt?.(i, attempts);
    const ok = await pingHealth(perTry);
    if (ok) {
      setOnlineMode(true);
      return true;
    }
    if (i < attempts) await sleep(1500);
  }
  setOnlineMode(false);
  return false;
}

async function pingHealth(timeoutMs) {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    const res = await fetch(apiUrl("/api/health"), {
      method: "GET",
      signal: ctrl?.signal,
      cache: "no-store",
      mode: "cors",
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.ok;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
