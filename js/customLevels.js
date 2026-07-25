const CUSTOM_KEY = "geometry-jump-custom-levels";

export const DEFAULT_THEME = {
  sky: ["#87ceeb", "#b8e0a8"],
  ground: "#5a3a22",
  accent: "#5dbf3a",
};

export function createEmptyLevel(overrides = {}) {
  return {
    id: overrides.id || `custom-${Date.now()}`,
    name: overrides.name || "Новый уровень",
    theme: clone(overrides.theme || DEFAULT_THEME),
    length: overrides.length ?? 80,
    speed: overrides.speed ?? 10.4,
    objects: Array.isArray(overrides.objects) ? clone(overrides.objects) : [],
    custom: true,
    updatedAt: Date.now(),
  };
}

function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

export function loadCustomLevels() {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.map(normalizeLevel) : [];
  } catch {
    return [];
  }
}

export function saveCustomLevels(levels) {
  localStorage.setItem(CUSTOM_KEY, JSON.stringify(levels));
}

export function upsertCustomLevel(level) {
  const levels = loadCustomLevels();
  const normalized = normalizeLevel({ ...level, custom: true, updatedAt: Date.now() });
  const idx = levels.findIndex((l) => l.id === normalized.id);
  if (idx >= 0) levels[idx] = normalized;
  else levels.unshift(normalized);
  saveCustomLevels(levels);
  return normalized;
}

export function deleteCustomLevel(id) {
  const levels = loadCustomLevels().filter((l) => l.id !== id);
  saveCustomLevels(levels);
  return levels;
}

export function getCustomLevel(id) {
  return loadCustomLevels().find((l) => l.id === id) || null;
}

export function normalizeLevel(raw) {
  const theme = raw.theme || DEFAULT_THEME;
  return {
    id: String(raw.id || `custom-${Date.now()}`),
    name: String(raw.name || "Без названия").slice(0, 48),
    theme: {
      sky: Array.isArray(theme.sky) && theme.sky.length >= 2
        ? [String(theme.sky[0]), String(theme.sky[1])]
        : [...DEFAULT_THEME.sky],
      ground: String(theme.ground || DEFAULT_THEME.ground),
      accent: String(theme.accent || DEFAULT_THEME.accent),
    },
    length: clamp(Number(raw.length) || 80, 20, 500),
    speed: clamp(Number(raw.speed) || 10.4, 8, 16),
    objects: Array.isArray(raw.objects)
      ? raw.objects.map(normalizeObject).filter(Boolean)
      : [],
    custom: true,
    author: raw.author ? String(raw.author).slice(0, 20) : "",
    plays: Number(raw.plays) || 0,
    likes: Number(raw.likes) || 0,
    comments: Number(raw.comments) || 0,
    createdAt: Number(raw.createdAt) || Number(raw.updatedAt) || Date.now(),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
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

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function levelToExportJson(level) {
  const n = normalizeLevel(level);
  return JSON.stringify(
    {
      name: n.name,
      length: n.length,
      speed: n.speed,
      theme: n.theme,
      objects: n.objects,
    },
    null,
    2
  );
}

export function parseImportedLevel(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    return data.map((item) => normalizeLevel({ ...item, id: item.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }));
  }
  return [normalizeLevel({ ...data, id: data.id || `custom-${Date.now()}` })];
}
