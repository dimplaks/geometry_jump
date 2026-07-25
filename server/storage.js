/**
 * DB persistence: local JSON file, or Turso (libSQL) when TURSO_DATABASE_URL is set.
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "accounts.json");
const KV_KEY = "accounts";

/** @type {import("@libsql/client").Client | null} */
let turso = null;
let saveChain = Promise.resolve();

function emptyDb() {
  return { users: {}, sessions: {}, levels: {}, social: {} };
}

function normalizeDb(raw) {
  const db = raw && typeof raw === "object" ? raw : emptyDb();
  if (!db.users) db.users = {};
  if (!db.sessions) db.sessions = {};
  if (!db.levels) db.levels = {};
  if (!db.social) db.social = {};
  return db;
}

function loadFromFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    const db = emptyDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    return db;
  }
  try {
    return normalizeDb(JSON.parse(fs.readFileSync(DB_PATH, "utf8")));
  } catch {
    const db = emptyDb();
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    return db;
  }
}

function saveToFile(db) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

async function loadFromTurso() {
  await turso.execute(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  const result = await turso.execute({
    sql: "SELECT value FROM kv WHERE key = ?",
    args: [KV_KEY],
  });
  const row = result.rows[0];
  if (!row) {
    const db = emptyDb();
    await turso.execute({
      sql: "INSERT INTO kv (key, value) VALUES (?, ?)",
      args: [KV_KEY, JSON.stringify(db)],
    });
    return db;
  }
  try {
    return normalizeDb(JSON.parse(String(row.value)));
  } catch {
    return emptyDb();
  }
}

async function saveToTurso(db) {
  const value = JSON.stringify(db);
  await turso.execute({
    sql: `
      INSERT INTO kv (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `,
    args: [KV_KEY, value],
  });
}

/**
 * @returns {Promise<{ db: object, backend: string, dbPath: string }>}
 */
async function initStorage() {
  const url = process.env.TURSO_DATABASE_URL;
  if (url) {
    const { createClient } = require("@libsql/client");
    turso = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
    const db = await loadFromTurso();
    return { db, backend: "turso", dbPath: url };
  }
  const db = loadFromFile();
  return { db, backend: "file", dbPath: DB_PATH };
}

/**
 * Persist db. Serialized for Turso to avoid overlapping writes.
 * @param {object} db
 * @returns {Promise<void>}
 */
function saveDb(db) {
  if (turso) {
    saveChain = saveChain
      .then(() => saveToTurso(db))
      .catch((err) => {
        console.error("Turso save failed:", err.message || err);
      });
    return saveChain;
  }
  try {
    saveToFile(db);
  } catch (err) {
    console.error("File save failed:", err.message || err);
  }
  return Promise.resolve();
}

module.exports = {
  initStorage,
  saveDb,
  DB_PATH,
};
