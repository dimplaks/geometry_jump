/**
 * Geometry Jump — account server + static files.
 * Persistence: local JSON or Turso (TURSO_DATABASE_URL).
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { initStorage, saveDb: persistDb } = require("./storage");

const PORT = Number(process.env.PORT) || 5173;
const ROOT = path.resolve(__dirname, "..");
const CORS_ORIGINS = new Set(
  (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .concat([
      "http://localhost",
      "https://localhost",
      "http://localhost:5173",
      "http://127.0.0.1",
      "http://127.0.0.1:5173",
      "capacitor://localhost",
      "ionic://localhost",
      "http://localhost:8080",
    ])
);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

/**
 * @type {{
 *   users: Record<string, any>,
 *   sessions: Record<string, string>,
 *   levels: Record<string, any>,
 *   social: Record<string, { likes: string[], comments: any[], scores: Record<string, any> }>
 * }}
 */
let db = { users: {}, sessions: {}, levels: {}, social: {} };
let storageBackend = "file";
let storageLabel = "";

function saveDb() {
  return persistDb(db);
}

function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
  if (!origin) {
    headers["Access-Control-Allow-Origin"] = "*";
    return headers;
  }
  if (CORS_ORIGINS.has(origin) || process.env.CORS_ALLOW_ALL === "1") {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  } else if (
    origin.startsWith("http://localhost") ||
    origin.startsWith("https://localhost") ||
    origin.startsWith("http://127.0.0.1") ||
    origin.startsWith("https://127.0.0.1") ||
    origin.startsWith("capacitor://") ||
    origin.startsWith("ionic://")
  ) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }
  return headers;
}

function applyCors(req, res) {
  const headers = corsHeaders(req);
  for (const [k, v] of Object.entries(headers)) {
    if (v != null) res.setHeader(k, v);
  }
}

function ensureSocial(levelKey) {
  const key = String(levelKey || "").slice(0, 80);
  if (!key) return null;
  if (!db.social[key]) {
    db.social[key] = { likes: [], comments: [], scores: {} };
  }
  if (!Array.isArray(db.social[key].likes)) db.social[key].likes = [];
  if (!Array.isArray(db.social[key].comments)) db.social[key].comments = [];
  if (!db.social[key].scores || typeof db.social[key].scores !== "object") {
    db.social[key].scores = {};
  }
  return db.social[key];
}

function publicSocial(levelKey, viewer) {
  const s = ensureSocial(levelKey);
  const scores = Object.entries(s.scores)
    .map(([username, row]) => ({
      username,
      time: row.time,
      attempts: row.attempts,
      updatedAt: row.updatedAt,
    }))
    .sort((a, b) => a.time - b.time || a.attempts - b.attempts)
    .slice(0, 20);
  return {
    levelKey,
    likes: s.likes.length,
    liked: viewer ? s.likes.includes(viewer) : false,
    comments: s.comments.slice(-50),
    leaderboard: scores,
  };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const next = crypto.scryptSync(password, salt, 32).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(next, "hex"));
}

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

function defaultProgress() {
  return {
    skinId: "peashooter",
    skinColor: "default",
    maxUnlocked: 0,
    cleared: [],
  };
}

function publicUser(username) {
  const u = db.users[username];
  if (!u) return null;
  return {
    username: u.username,
    createdAt: u.createdAt,
    progress: u.progress || defaultProgress(),
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > 1e6) {
        reject(new Error("Body too large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(req, res, status, data) {
  const body = JSON.stringify(data);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    ...corsHeaders(req),
  };
  res.writeHead(status, headers);
  res.end(body);
}

function getToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}

function userFromToken(token) {
  if (!token) return null;
  const username = db.sessions[token];
  if (!username || !db.users[username]) return null;
  return username;
}

function normalizeUsername(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function validateUsername(name) {
  if (!/^[a-z0-9_]{3,20}$/.test(name)) {
    return "Логин: 3–20 символов (латиница, цифры, _)";
  }
  return null;
}

function validatePassword(pass) {
  if (typeof pass !== "string" || pass.length < 4 || pass.length > 64) {
    return "Пароль: от 4 до 64 символов";
  }
  return null;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizeObject(o) {
  if (!o || typeof o !== "object") return null;
  const type = o.type;
  const x = Number(o.x);
  const y = Number(o.y) || 0;
  if (!Number.isFinite(x)) return null;
  switch (type) {
    case "block":
      return {
        type,
        x,
        y,
        w: clamp(Number(o.w) || 1, 1, 40),
        h: clamp(Number(o.h) || 1, 1, 20),
      };
    case "spike":
    case "spikeDown":
    case "pad":
      return { type, x, y };
    case "saw":
      return { type, x, y, r: clamp(Number(o.r) || 0.7, 0.4, 1.5) };
    default:
      return null;
  }
}

function normalizeLevelPayload(raw, author, existing) {
  const theme = raw.theme || {};
  const sky = Array.isArray(theme.sky) && theme.sky.length >= 2 ? theme.sky : ["#87ceeb", "#b8e0a8"];
  const objects = Array.isArray(raw.objects)
    ? raw.objects.map(normalizeObject).filter(Boolean).slice(0, 2000)
    : [];
  const id =
    (existing && existing.id) ||
    (typeof raw.id === "string" && raw.id.trim()
      ? String(raw.id).slice(0, 64)
      : `lvl-${crypto.randomBytes(6).toString("hex")}`);
  return {
    id,
    name: String(raw.name || "Без названия").slice(0, 48),
    theme: {
      sky: [String(sky[0]), String(sky[1])],
      ground: String(theme.ground || "#5a3a22"),
      accent: String(theme.accent || "#5dbf3a"),
    },
    length: clamp(Number(raw.length) || 80, 20, 500),
    speed: clamp(Number(raw.speed) || 10.4, 8, 16),
    objects,
    author,
    custom: true,
    plays: existing ? Number(existing.plays) || 0 : 0,
    createdAt: existing ? existing.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
}

function levelSummary(level) {
  const social = ensureSocial(level.id);
  return {
    id: level.id,
    name: level.name,
    author: level.author,
    length: level.length,
    speed: level.speed,
    objectsCount: (level.objects || []).length,
    plays: level.plays || 0,
    likes: social.likes.length,
    comments: social.comments.length,
    theme: level.theme,
    updatedAt: level.updatedAt,
    createdAt: level.createdAt,
    custom: true,
  };
}

async function handleApi(req, res, url) {
  const route = url.pathname.replace(/\/+$/, "") || "/";

  if (req.method === "GET" && route === "/api/health") {
    return sendJson(req, res, 200, {
      ok: true,
      users: Object.keys(db.users).length,
      levels: Object.keys(db.levels).length,
      storage: storageBackend,
    });
  }

  if (req.method === "POST" && route === "/api/register") {
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(req, res, 400, { error: e.message });
    }
    const username = normalizeUsername(body.username);
    const password = body.password;
    const uErr = validateUsername(username);
    if (uErr) return sendJson(req, res, 400, { error: uErr });
    const pErr = validatePassword(password);
    if (pErr) return sendJson(req, res, 400, { error: pErr });
    if (db.users[username]) return sendJson(req, res, 409, { error: "Такой логин уже занят" });

    const { salt, hash } = hashPassword(password);
    db.users[username] = {
      username,
      salt,
      hash,
      createdAt: Date.now(),
      progress: defaultProgress(),
    };
    const token = makeToken();
    db.sessions[token] = username;
    await await saveDb();
    return sendJson(req, res, 201, { token, user: publicUser(username) });
  }

  if (req.method === "POST" && route === "/api/login") {
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(req, res, 400, { error: e.message });
    }
    const username = normalizeUsername(body.username);
    const password = body.password;
    const user = db.users[username];
    if (!user || !verifyPassword(password, user.salt, user.hash)) {
      return sendJson(req, res, 401, { error: "Неверный логин или пароль" });
    }
    const token = makeToken();
    db.sessions[token] = username;
    await await saveDb();
    return sendJson(req, res, 200, { token, user: publicUser(username) });
  }

  if (req.method === "POST" && route === "/api/logout") {
    const token = getToken(req);
    if (token && db.sessions[token]) {
      delete db.sessions[token];
      await await saveDb();
    }
    return sendJson(req, res, 200, { ok: true });
  }

  if (req.method === "GET" && route === "/api/me") {
    const username = userFromToken(getToken(req));
    if (!username) return sendJson(req, res, 401, { error: "Нужен вход" });
    return sendJson(req, res, 200, { user: publicUser(username) });
  }

  if (req.method === "PUT" && route === "/api/progress") {
    const username = userFromToken(getToken(req));
    if (!username) return sendJson(req, res, 401, { error: "Нужен вход" });
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(req, res, 400, { error: e.message });
    }
    const prev = db.users[username].progress || defaultProgress();
    db.users[username].progress = {
      skinId: typeof body.skinId === "string" ? body.skinId : prev.skinId,
      skinColor: typeof body.skinColor === "string" ? body.skinColor : prev.skinColor,
      maxUnlocked: Number.isFinite(Number(body.maxUnlocked))
        ? Math.max(0, Math.min(99, Number(body.maxUnlocked)))
        : prev.maxUnlocked,
      cleared: Array.isArray(body.cleared)
        ? [...new Set(body.cleared.map(Number).filter((n) => Number.isFinite(n) && n >= 0))]
        : prev.cleared,
    };
    await await saveDb();
    return sendJson(req, res, 200, { user: publicUser(username) });
  }

  if (req.method === "GET" && route === "/api/players") {
    const list = Object.values(db.users)
      .map((u) => ({
        username: u.username,
        createdAt: u.createdAt,
        cleared: (u.progress?.cleared || []).length,
        maxUnlocked: u.progress?.maxUnlocked ?? 0,
      }))
      .sort((a, b) => b.cleared - a.cleared || a.username.localeCompare(b.username));
    return sendJson(req, res, 200, { players: list });
  }

  // --- Shared levels -------------------------------------------------------

  if (req.method === "GET" && route === "/api/levels") {
    const author = url.searchParams.get("author");
    let list = Object.values(db.levels);
    if (author) list = list.filter((l) => l.author === author);
    list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sendJson(req, res, 200, { levels: list.map(levelSummary) });
  }

  if (req.method === "GET" && route === "/api/levels/mine") {
    const username = userFromToken(getToken(req));
    if (!username) return sendJson(req, res, 401, { error: "Нужен вход" });
    const list = Object.values(db.levels)
      .filter((l) => l.author === username)
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    return sendJson(req, res, 200, { levels: list });
  }

  const levelMatch = route.match(/^\/api\/levels\/([^/]+)$/);
  if (levelMatch) {
    const id = decodeURIComponent(levelMatch[1]);
    const level = db.levels[id];

    if (req.method === "GET") {
      if (!level) return sendJson(req, res, 404, { error: "Уровень не найден" });
      return sendJson(req, res, 200, { level });
    }

    if (req.method === "DELETE") {
      const username = userFromToken(getToken(req));
      if (!username) return sendJson(req, res, 401, { error: "Нужен вход" });
      if (!level) return sendJson(req, res, 404, { error: "Уровень не найден" });
      if (level.author !== username) return sendJson(req, res, 403, { error: "Это чужой уровень" });
      delete db.levels[id];
      await await saveDb();
      return sendJson(req, res, 200, { ok: true });
    }
  }

  const playMatch = route.match(/^\/api\/levels\/([^/]+)\/play$/);
  if (req.method === "POST" && playMatch) {
    const id = decodeURIComponent(playMatch[1]);
    const level = db.levels[id];
    if (!level) return sendJson(req, res, 404, { error: "Уровень не найден" });
    level.plays = (level.plays || 0) + 1;
    await await saveDb();
    return sendJson(req, res, 200, { plays: level.plays });
  }

  if (req.method === "POST" && route === "/api/levels") {
    const username = userFromToken(getToken(req));
    if (!username) return sendJson(req, res, 401, { error: "Нужен вход" });
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(req, res, 400, { error: e.message });
    }
    const existing =
      body.id && db.levels[body.id] && db.levels[body.id].author === username
        ? db.levels[body.id]
        : null;
    if (body.id && db.levels[body.id] && db.levels[body.id].author !== username) {
      return sendJson(req, res, 403, { error: "Нельзя перезаписать чужой уровень" });
    }
    // Limit per user
    const mine = Object.values(db.levels).filter((l) => l.author === username);
    if (!existing && mine.length >= 50) {
      return sendJson(req, res, 400, { error: "Лимит: не больше 50 уровней на игрока" });
    }
    const level = normalizeLevelPayload(body, username, existing);
    // preserve social when updating geometry
    if (existing) {
      level.plays = existing.plays || 0;
    }
    db.levels[level.id] = level;
    ensureSocial(level.id);
    await await saveDb();
    return sendJson(req, res, existing ? 200 : 201, { level });
  }

  // --- Social: likes / comments / leaderboard ------------------------------
  // levelKey: custom id OR campaign-0 .. campaign-9

  const socialMatch = route.match(/^\/api\/social\/([^/]+)$/);
  if (req.method === "GET" && socialMatch) {
    const levelKey = decodeURIComponent(socialMatch[1]);
    const viewer = userFromToken(getToken(req));
    return sendJson(req, res, 200, publicSocial(levelKey, viewer));
  }

  const likeMatch = route.match(/^\/api\/social\/([^/]+)\/like$/);
  if (req.method === "POST" && likeMatch) {
    const username = userFromToken(getToken(req));
    if (!username) return sendJson(req, res, 401, { error: "Нужен вход" });
    const levelKey = decodeURIComponent(likeMatch[1]);
    const s = ensureSocial(levelKey);
    const idx = s.likes.indexOf(username);
    if (idx >= 0) s.likes.splice(idx, 1);
    else s.likes.push(username);
    await await saveDb();
    return sendJson(req, res, 200, publicSocial(levelKey, username));
  }

  const commentMatch = route.match(/^\/api\/social\/([^/]+)\/comments$/);
  if (req.method === "POST" && commentMatch) {
    const username = userFromToken(getToken(req));
    if (!username) return sendJson(req, res, 401, { error: "Нужен вход" });
    const levelKey = decodeURIComponent(commentMatch[1]);
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(req, res, 400, { error: e.message });
    }
    const text = String(body.text || "")
      .trim()
      .slice(0, 280);
    if (text.length < 1) return sendJson(req, res, 400, { error: "Пустой комментарий" });
    const s = ensureSocial(levelKey);
    s.comments.push({
      id: crypto.randomBytes(6).toString("hex"),
      author: username,
      text,
      createdAt: Date.now(),
    });
    if (s.comments.length > 200) s.comments = s.comments.slice(-200);
    await await saveDb();
    return sendJson(req, res, 201, publicSocial(levelKey, username));
  }

  const scoreMatch = route.match(/^\/api\/social\/([^/]+)\/score$/);
  if (req.method === "POST" && scoreMatch) {
    const username = userFromToken(getToken(req));
    if (!username) return sendJson(req, res, 401, { error: "Нужен вход" });
    const levelKey = decodeURIComponent(scoreMatch[1]);
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return sendJson(req, res, 400, { error: e.message });
    }
    const time = Number(body.time);
    const attempts = Math.max(1, Number(body.attempts) || 1);
    if (!Number.isFinite(time) || time <= 0 || time > 3600) {
      return sendJson(req, res, 400, { error: "Некорректное время" });
    }
    const s = ensureSocial(levelKey);
    const prev = s.scores[username];
    if (!prev || time < prev.time || (time === prev.time && attempts < prev.attempts)) {
      s.scores[username] = { time, attempts, updatedAt: Date.now() };
      await await saveDb();
    }
    return sendJson(req, res, 200, publicSocial(levelKey, username));
  }

  return sendJson(req, res, 404, { error: "Not found" });
}

function safeJoin(root, reqPath) {
  const decoded = decodeURIComponent(reqPath.split("?")[0]);
  const cleaned = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, cleaned);
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res, url) {
  let rel = url.pathname === "/" ? "/index.html" : url.pathname;
  let filePath = safeJoin(ROOT, rel);
  if (!filePath) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=60",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}


async function start() {
  const stored = await initStorage();
  db = stored.db;
  storageBackend = stored.backend;
  storageLabel = stored.dbPath;

  const server = http.createServer(async (req, res) => {
    try {
      applyCors(req, res);
      if (req.method === "OPTIONS") {
        res.writeHead(204);
        return res.end();
      }
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(req, res, url);
      }
      return serveStatic(req, res, url);
    } catch (e) {
      console.error(e);
      if (!res.headersSent) sendJson(req, res, 500, { error: "Server error" });
    }
  });

  server.listen(PORT, () => {
    console.log(`Geometry Jump server: http://127.0.0.1:${PORT}`);
    console.log(`Storage (${storageBackend}): ${storageLabel}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
