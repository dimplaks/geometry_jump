/** PVZ-inspired skins — distinctive silhouettes + recolor packs */

/**
 * unlockLevel: 0 = сразу; иначе номер уровня кампании (1..10).
 */
export const SKINS = [
  {
    id: "peashooter",
    name: "Горохострел",
    unlockLevel: 0,
    body: "#5dbf3a",
    accent: "#2f7a22",
    detail: "#c8f090",
    eye: "#1a2e12",
    glow: "#9be86f",
    leaf: "#3f9e28",
  },
  {
    id: "sunflower",
    name: "Подсолнух",
    unlockLevel: 1,
    body: "#f0c84a",
    accent: "#e89a14",
    detail: "#6b3e18",
    eye: "#2a1810",
    glow: "#ffe28a",
    leaf: "#4aa030",
  },
  {
    id: "wallnut",
    name: "Стенорех",
    unlockLevel: 2,
    body: "#c49a6c",
    accent: "#7a4e28",
    detail: "#edd4b0",
    eye: "#3a2618",
    glow: "#e0b98a",
    leaf: "#8a6238",
  },
  {
    id: "chomper",
    name: "Пожиратель",
    unlockLevel: 3,
    body: "#7ec850",
    accent: "#5a2d7a",
    detail: "#d6ffb0",
    eye: "#1a2e12",
    glow: "#c090e8",
    mouth: "#8b1e2d",
    leaf: "#3f7a28",
  },
  {
    id: "cactus",
    name: "Кактус",
    unlockLevel: 4,
    body: "#3f9e6a",
    accent: "#246644",
    detail: "#b8efc8",
    eye: "#163824",
    glow: "#78d49a",
    leaf: "#2d6b44",
  },
  {
    id: "snowpea",
    name: "Снежный горох",
    unlockLevel: 5,
    body: "#7ec8e8",
    accent: "#3a7fa8",
    detail: "#e8f7ff",
    eye: "#163040",
    glow: "#b8e8ff",
    leaf: "#5aa8c8",
  },
  {
    id: "cherrybomb",
    name: "Вишнёвая бомба",
    unlockLevel: 6,
    body: "#e4573d",
    accent: "#9a2418",
    detail: "#ffb0a0",
    eye: "#2a1210",
    glow: "#ff8a70",
    leaf: "#3f9e28",
  },
  {
    id: "repeater",
    name: "Повторитель",
    unlockLevel: 7,
    body: "#4fc928",
    accent: "#247a18",
    detail: "#d8ffb8",
    eye: "#1a2e12",
    glow: "#a8ef70",
    leaf: "#2f7a22",
  },
  {
    id: "jalapeno",
    name: "Халапеньо",
    unlockLevel: 8,
    body: "#e85a2a",
    accent: "#b02810",
    detail: "#ffd0b0",
    eye: "#2a1210",
    glow: "#ff9a60",
    leaf: "#3f9e28",
  },
  {
    id: "tallnut",
    name: "Высокий орех",
    unlockLevel: 9,
    body: "#a87848",
    accent: "#5a3418",
    detail: "#e8c8a0",
    eye: "#2a1810",
    glow: "#d4a878",
    leaf: "#6e4524",
  },
];

/** Recolor packs — keep silhouette, change palette */
export const SKIN_COLORS = [
  { id: "default", name: "Оригинал", tint: null },
  {
    id: "lime",
    name: "Лайм",
    tint: { body: "#8fd93a", accent: "#4a8a18", detail: "#e8ffb0", glow: "#c0ff70", leaf: "#5aad20" },
  },
  {
    id: "sky",
    name: "Небо",
    tint: { body: "#5eb8f0", accent: "#2468a8", detail: "#d0f0ff", glow: "#90d8ff", leaf: "#3a90c8" },
  },
  {
    id: "berry",
    name: "Ягода",
    tint: { body: "#e05090", accent: "#8a2048", detail: "#ffd0e8", glow: "#ff90c0", leaf: "#c04070" },
  },
  {
    id: "sunset",
    name: "Закат",
    tint: { body: "#f09040", accent: "#b04810", detail: "#ffe0b8", glow: "#ffb070", leaf: "#d06820" },
  },
  {
    id: "grape",
    name: "Виноград",
    tint: { body: "#9a68d8", accent: "#5a2888", detail: "#e8d0ff", glow: "#c098f0", leaf: "#7040b0" },
  },
  {
    id: "gold",
    name: "Золото",
    tint: { body: "#e8c040", accent: "#a87810", detail: "#fff0b0", glow: "#ffe070", leaf: "#c8a020" },
  },
  {
    id: "night",
    name: "Ночь",
    tint: { body: "#4a5a78", accent: "#1a2438", detail: "#a8b8d0", glow: "#7088b0", leaf: "#384868" },
  },
];

export function getSkinById(id) {
  return SKINS.find((s) => s.id === id) || SKINS[0];
}

export function getColorById(id) {
  return SKIN_COLORS.find((c) => c.id === id) || SKIN_COLORS[0];
}

/** Merge base skin with chosen color pack (keeps mouth etc.) */
export function resolveSkin(skinOrId, colorId = "default") {
  const base = typeof skinOrId === "string" ? getSkinById(skinOrId) : skinOrId;
  const pack = getColorById(colorId);
  if (!pack.tint) return { ...base };

  const tint = pack.tint;
  return {
    ...base,
    body: tint.body,
    accent: tint.accent,
    detail: tint.detail,
    glow: tint.glow,
    leaf: tint.leaf || tint.accent,
    // keep dark eyes/mouth readable; slight soften only for night
    eye: colorId === "night" ? "#d0d8e8" : base.eye,
    mouth: base.mouth,
  };
}

export function isSkinUnlocked(skin, clearedLevelIndexes) {
  const need = skin.unlockLevel ?? 0;
  if (need <= 0) return true;
  return clearedLevelIndexes.includes(need - 1);
}

export function getSkinsUnlockedByLevel(levelIndex) {
  const levelId = levelIndex + 1;
  return SKINS.filter((s) => s.unlockLevel === levelId);
}

export function skinUnlockHint(skin) {
  const need = skin.unlockLevel ?? 0;
  if (need <= 0) return "Доступен сразу";
  return `Пройди уровень ${need}`;
}

/**
 * Draw a highly recognizable PVZ plant on the cube.
 */
export function drawSkin(ctx, skin, size, pulse = 0) {
  const s = size;
  const bob = Math.sin(pulse * Math.PI * 2) * (s * 0.015);

  ctx.clearRect(0, 0, s, s);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(s / 2, s * 0.92, s * 0.34, s * 0.08, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(0, bob);

  // soft plate behind character
  roundRect(ctx, s * 0.06, s * 0.06, s * 0.88, s * 0.88, s * 0.2);
  const plate = ctx.createLinearGradient(0, 0, s, s);
  plate.addColorStop(0, shade(skin.body, 0.35));
  plate.addColorStop(1, shade(skin.accent, -0.1));
  ctx.fillStyle = plate;
  ctx.fill();
  ctx.strokeStyle = skin.glow;
  ctx.lineWidth = Math.max(2, s * 0.035);
  ctx.stroke();

  const drawers = {
    peashooter: drawPeashooter,
    sunflower: drawSunflower,
    wallnut: drawWallnut,
    chomper: drawChomper,
    cactus: drawCactus,
    snowpea: drawSnowPea,
    cherrybomb: drawCherryBomb,
    repeater: drawRepeater,
    jalapeno: drawJalapeno,
    tallnut: drawTallnut,
  };
  (drawers[skin.id] || drawPeashooter)(ctx, skin, s);

  ctx.restore();
}

// --- Character drawers -----------------------------------------------------

function drawPeashooter(ctx, skin, s) {
  // stem leaf
  ctx.fillStyle = skin.leaf || skin.accent;
  ctx.beginPath();
  ctx.ellipse(s * 0.28, s * 0.72, s * 0.16, s * 0.07, -0.5, 0, Math.PI * 2);
  ctx.fill();

  // head
  headCircle(ctx, s * 0.42, s * 0.48, s * 0.28, skin);
  eyes(ctx, s * 0.36, s * 0.42, s * 0.48, s * 0.42, s * 0.055, skin.eye);
  smile(ctx, s * 0.4, s * 0.54, s * 0.08, skin.eye);

  // snout / cannon
  ctx.fillStyle = skin.accent;
  roundRect(ctx, s * 0.55, s * 0.42, s * 0.32, s * 0.16, s * 0.08);
  ctx.fill();
  ctx.fillStyle = skin.detail;
  ctx.beginPath();
  ctx.arc(s * 0.86, s * 0.5, s * 0.07, 0, Math.PI * 2);
  ctx.fill();
  // pea
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.arc(s * 0.78, s * 0.5, s * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = skin.accent;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  labelTag(ctx, s, "PEA");
}

function drawRepeater(ctx, skin, s) {
  ctx.fillStyle = skin.leaf || skin.accent;
  ctx.beginPath();
  ctx.ellipse(s * 0.26, s * 0.74, s * 0.15, s * 0.06, -0.4, 0, Math.PI * 2);
  ctx.fill();

  headCircle(ctx, s * 0.4, s * 0.5, s * 0.27, skin);
  eyes(ctx, s * 0.34, s * 0.44, s * 0.46, s * 0.44, s * 0.05, skin.eye);
  smile(ctx, s * 0.38, s * 0.56, s * 0.07, skin.eye);

  // double barrels
  for (const y of [0.36, 0.52]) {
    ctx.fillStyle = skin.accent;
    roundRect(ctx, s * 0.52, s * y, s * 0.34, s * 0.13, s * 0.06);
    ctx.fill();
    ctx.fillStyle = skin.detail;
    ctx.beginPath();
    ctx.arc(s * 0.85, s * (y + 0.065), s * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }
  // two peas
  ctx.fillStyle = shade(skin.body, 0.15);
  ctx.beginPath();
  ctx.arc(s * 0.76, s * 0.425, s * 0.04, 0, Math.PI * 2);
  ctx.arc(s * 0.76, s * 0.585, s * 0.04, 0, Math.PI * 2);
  ctx.fill();

  labelTag(ctx, s, "x2");
}

function drawSnowPea(ctx, skin, s) {
  // icy aura
  ctx.strokeStyle = "rgba(255,255,255,0.45)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(s * 0.42, s * 0.48, s * 0.32, 0, Math.PI * 2);
  ctx.stroke();

  headCircle(ctx, s * 0.42, s * 0.5, s * 0.27, skin);
  eyes(ctx, s * 0.36, s * 0.44, s * 0.48, s * 0.44, s * 0.05, skin.eye);
  smile(ctx, s * 0.4, s * 0.56, s * 0.07, skin.eye);

  // frosty snout
  ctx.fillStyle = skin.accent;
  roundRect(ctx, s * 0.54, s * 0.44, s * 0.32, s * 0.15, s * 0.07);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(s * 0.85, s * 0.515, s * 0.065, 0, Math.PI * 2);
  ctx.fill();
  // ice crystal
  drawSnowflake(ctx, s * 0.22, s * 0.28, s * 0.08, "#ffffff");
  drawSnowflake(ctx, s * 0.7, s * 0.28, s * 0.06, skin.detail);

  labelTag(ctx, s, "ICE");
}

function drawSunflower(ctx, skin, s) {
  const cx = s * 0.5;
  const cy = s * 0.48;
  // petals
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.1;
    const px = cx + Math.cos(a) * s * 0.3;
    const py = cy + Math.sin(a) * s * 0.3;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(a);
    ctx.fillStyle = i % 2 ? skin.accent : skin.body;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.12, s * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // center face
  ctx.fillStyle = skin.detail;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(skin.detail, -0.25);
  ctx.lineWidth = 2;
  ctx.stroke();

  eyes(ctx, cx - s * 0.07, cy - s * 0.02, cx + s * 0.07, cy - s * 0.02, s * 0.045, skin.eye, true);
  smile(ctx, cx, cy + s * 0.06, s * 0.08, skin.eye);

  // leaf under
  ctx.fillStyle = skin.leaf || "#4aa030";
  ctx.beginPath();
  ctx.ellipse(s * 0.28, s * 0.78, s * 0.14, s * 0.05, -0.6, 0, Math.PI * 2);
  ctx.fill();

  labelTag(ctx, s, "SUN");
}

function drawWallnut(ctx, skin, s) {
  // nut body
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.52, s * 0.32, s * 0.34, 0, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createLinearGradient(s * 0.2, s * 0.2, s * 0.8, s * 0.8);
  g.addColorStop(0, skin.detail);
  g.addColorStop(1, skin.accent);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.52, s * 0.3, s * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  // cracks
  ctx.strokeStyle = skin.accent;
  ctx.lineWidth = Math.max(2, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(s * 0.32, s * 0.3);
  ctx.lineTo(s * 0.4, s * 0.48);
  ctx.lineTo(s * 0.34, s * 0.62);
  ctx.moveTo(s * 0.62, s * 0.28);
  ctx.lineTo(s * 0.58, s * 0.42);
  ctx.stroke();

  // worried face
  ctx.strokeStyle = skin.eye;
  ctx.lineWidth = Math.max(2, s * 0.025);
  // brows
  ctx.beginPath();
  ctx.moveTo(s * 0.34, s * 0.42);
  ctx.lineTo(s * 0.44, s * 0.46);
  ctx.moveTo(s * 0.66, s * 0.42);
  ctx.lineTo(s * 0.56, s * 0.46);
  ctx.stroke();
  eyes(ctx, s * 0.4, s * 0.52, s * 0.6, s * 0.52, s * 0.05, skin.eye);
  // flat worried mouth
  ctx.beginPath();
  ctx.moveTo(s * 0.42, s * 0.66);
  ctx.quadraticCurveTo(s * 0.5, s * 0.62, s * 0.58, s * 0.66);
  ctx.stroke();

  labelTag(ctx, s, "NUT");
}

function drawTallnut(ctx, skin, s) {
  // taller silhouette
  roundRect(ctx, s * 0.22, s * 0.12, s * 0.56, s * 0.72, s * 0.18);
  const g = ctx.createLinearGradient(s * 0.22, s * 0.12, s * 0.78, s * 0.84);
  g.addColorStop(0, skin.detail);
  g.addColorStop(0.5, skin.body);
  g.addColorStop(1, skin.accent);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = skin.accent;
  ctx.lineWidth = 2;
  ctx.stroke();

  // helmet ridge
  ctx.fillStyle = skin.accent;
  roundRect(ctx, s * 0.2, s * 0.1, s * 0.6, s * 0.12, s * 0.06);
  ctx.fill();

  // cracks
  ctx.strokeStyle = shade(skin.accent, -0.2);
  ctx.beginPath();
  ctx.moveTo(s * 0.35, s * 0.28);
  ctx.lineTo(s * 0.42, s * 0.45);
  ctx.lineTo(s * 0.36, s * 0.6);
  ctx.stroke();

  eyes(ctx, s * 0.38, s * 0.48, s * 0.62, s * 0.48, s * 0.055, skin.eye);
  // stern mouth
  ctx.strokeStyle = skin.eye;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.4, s * 0.64);
  ctx.lineTo(s * 0.6, s * 0.64);
  ctx.stroke();

  labelTag(ctx, s, "TALL");
}

function drawChomper(ctx, skin, s) {
  // purple leaf tuft
  ctx.fillStyle = skin.accent;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(s * 0.5 + i * s * 0.08, s * 0.22, s * 0.07, s * 0.14, i * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // head
  headCircle(ctx, s * 0.5, s * 0.48, s * 0.3, skin);

  // huge mouth
  ctx.fillStyle = skin.mouth || "#8b1e2d";
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.58, s * 0.22, s * 0.16, 0, 0, Math.PI * 2);
  ctx.fill();

  // teeth
  ctx.fillStyle = "#fff";
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(s * 0.5 + i * s * 0.05, s * 0.48);
    ctx.lineTo(s * 0.5 + i * s * 0.05 - s * 0.02, s * 0.58);
    ctx.lineTo(s * 0.5 + i * s * 0.05 + s * 0.02, s * 0.58);
    ctx.fill();
  }
  // tongue
  ctx.fillStyle = "#ff6a8a";
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.66, s * 0.08, s * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  eyes(ctx, s * 0.38, s * 0.38, s * 0.62, s * 0.38, s * 0.05, skin.eye);

  labelTag(ctx, s, "CHOMP");
}

function drawCactus(ctx, skin, s) {
  // main column
  roundRect(ctx, s * 0.34, s * 0.18, s * 0.32, s * 0.62, s * 0.14);
  fillRound(ctx, skin);
  // arms
  roundRect(ctx, s * 0.14, s * 0.38, s * 0.22, s * 0.16, s * 0.08);
  ctx.fillStyle = skin.body;
  ctx.fill();
  roundRect(ctx, s * 0.64, s * 0.34, s * 0.22, s * 0.14, s * 0.07);
  ctx.fill();

  // spikes
  ctx.strokeStyle = skin.detail;
  ctx.fillStyle = skin.detail;
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 6; i++) {
    const y = s * 0.28 + i * s * 0.08;
    spike(ctx, s * 0.34, y, -1, s);
    spike(ctx, s * 0.66, y + s * 0.03, 1, s);
  }

  // face
  eyes(ctx, s * 0.42, s * 0.42, s * 0.58, s * 0.42, s * 0.045, skin.eye);
  smile(ctx, s * 0.5, s * 0.52, s * 0.06, skin.eye);

  // spike ball on right arm (cactus "gun")
  ctx.fillStyle = skin.accent;
  ctx.beginPath();
  ctx.arc(s * 0.82, s * 0.4, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = skin.detail;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(s * 0.82, s * 0.4);
    ctx.lineTo(s * 0.82 + Math.cos(a) * s * 0.1, s * 0.4 + Math.sin(a) * s * 0.1);
    ctx.stroke();
  }

  labelTag(ctx, s, "CACT");
}

function drawCherryBomb(ctx, skin, s) {
  // fuse
  ctx.strokeStyle = "#5a4030";
  ctx.lineWidth = Math.max(2, s * 0.03);
  ctx.beginPath();
  ctx.moveTo(s * 0.5, s * 0.28);
  ctx.quadraticCurveTo(s * 0.55, s * 0.12, s * 0.62, s * 0.1);
  ctx.stroke();
  // spark
  ctx.fillStyle = "#ffd040";
  ctx.beginPath();
  ctx.arc(s * 0.64, s * 0.08, s * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ff6020";
  ctx.beginPath();
  ctx.arc(s * 0.64, s * 0.08, s * 0.018, 0, Math.PI * 2);
  ctx.fill();

  // two cherries
  drawCherry(ctx, s * 0.34, s * 0.55, s * 0.2, skin, -0.15);
  drawCherry(ctx, s * 0.66, s * 0.55, s * 0.2, skin, 0.15);

  // stem join leaf
  ctx.fillStyle = skin.leaf || "#3f9e28";
  ctx.beginPath();
  ctx.ellipse(s * 0.5, s * 0.32, s * 0.1, s * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();

  labelTag(ctx, s, "BOOM");
}

function drawCherry(ctx, cx, cy, r, skin, browTilt) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, skin.detail);
  g.addColorStop(1, skin.accent);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(skin.accent, -0.2);
  ctx.lineWidth = 2;
  ctx.stroke();

  eyes(ctx, cx - r * 0.35, cy - r * 0.1, cx + r * 0.35, cy - r * 0.1, r * 0.18, skin.eye);
  // angry brows
  ctx.strokeStyle = skin.eye;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy - r * 0.35 + browTilt * r);
  ctx.lineTo(cx - r * 0.1, cy - r * 0.2);
  ctx.moveTo(cx + r * 0.55, cy - r * 0.35 - browTilt * r);
  ctx.lineTo(cx + r * 0.1, cy - r * 0.2);
  ctx.stroke();
  // frown
  ctx.beginPath();
  ctx.arc(cx, cy + r * 0.35, r * 0.25, 1.1 * Math.PI, 1.9 * Math.PI);
  ctx.stroke();
}

function drawJalapeno(ctx, skin, s) {
  // pepper body (curved)
  ctx.save();
  ctx.translate(s * 0.5, s * 0.55);
  ctx.rotate(-0.25);
  ctx.fillStyle = skin.body;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.32);
  ctx.bezierCurveTo(s * 0.22, -s * 0.2, s * 0.24, s * 0.1, s * 0.08, s * 0.32);
  ctx.bezierCurveTo(0, s * 0.38, -s * 0.18, s * 0.2, -s * 0.16, -s * 0.05);
  ctx.bezierCurveTo(-s * 0.14, -s * 0.22, -s * 0.08, -s * 0.32, 0, -s * 0.32);
  ctx.fill();
  const gloss = ctx.createLinearGradient(-s * 0.1, -s * 0.3, s * 0.15, s * 0.3);
  gloss.addColorStop(0, skin.detail);
  gloss.addColorStop(0.5, skin.body);
  gloss.addColorStop(1, skin.accent);
  ctx.fillStyle = gloss;
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();

  // green cap / stem
  ctx.fillStyle = skin.leaf || "#3f9e28";
  ctx.beginPath();
  ctx.ellipse(s * 0.42, s * 0.22, s * 0.12, s * 0.06, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(skin.leaf || "#3f9e28", -0.2);
  ctx.fillRect(s * 0.4, s * 0.1, s * 0.05, s * 0.12);

  // face
  eyes(ctx, s * 0.4, s * 0.48, s * 0.58, s * 0.5, s * 0.05, skin.eye);
  ctx.strokeStyle = skin.eye;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(s * 0.36, s * 0.42);
  ctx.lineTo(s * 0.46, s * 0.46);
  ctx.moveTo(s * 0.64, s * 0.44);
  ctx.lineTo(s * 0.54, s * 0.48);
  ctx.stroke();
  // grin
  ctx.beginPath();
  ctx.arc(s * 0.5, s * 0.58, s * 0.08, 0.05 * Math.PI, 0.95 * Math.PI);
  ctx.stroke();

  // flame tip
  ctx.fillStyle = "#ffd040";
  ctx.beginPath();
  ctx.moveTo(s * 0.72, s * 0.7);
  ctx.quadraticCurveTo(s * 0.82, s * 0.55, s * 0.88, s * 0.72);
  ctx.quadraticCurveTo(s * 0.8, s * 0.78, s * 0.72, s * 0.7);
  ctx.fill();
  ctx.fillStyle = "#ff6020";
  ctx.beginPath();
  ctx.moveTo(s * 0.76, s * 0.72);
  ctx.quadraticCurveTo(s * 0.82, s * 0.62, s * 0.86, s * 0.72);
  ctx.fill();

  labelTag(ctx, s, "HOT");
}

// --- Shared drawing helpers ------------------------------------------------

function headCircle(ctx, cx, cy, r, skin) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.15, cx, cy, r);
  g.addColorStop(0, skin.detail);
  g.addColorStop(0.55, skin.body);
  g.addColorStop(1, skin.accent);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = shade(skin.accent, -0.15);
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.stroke();
}

function eyes(ctx, x1, y1, x2, y2, r, eyeColor, darkWhite = false) {
  ctx.fillStyle = darkWhite ? "#f5e6c8" : "#fff";
  ctx.beginPath();
  ctx.arc(x1, y1, r, 0, Math.PI * 2);
  ctx.arc(x2, y2, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = eyeColor;
  ctx.beginPath();
  ctx.arc(x1 + r * 0.15, y1, r * 0.55, 0, Math.PI * 2);
  ctx.arc(x2 + r * 0.15, y2, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x1 - r * 0.15, y1 - r * 0.2, r * 0.18, 0, Math.PI * 2);
  ctx.arc(x2 - r * 0.15, y2 - r * 0.2, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function smile(ctx, cx, cy, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.25);
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();
}

function fillRound(ctx, skin) {
  // assumes path already in roundRect
  const g = ctx.createLinearGradient(0, 0, 0, 200);
  g.addColorStop(0, skin.detail);
  g.addColorStop(0.5, skin.body);
  g.addColorStop(1, skin.accent);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = skin.accent;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function spike(ctx, x, y, dir, s) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + dir * s * 0.06, y - s * 0.03);
  ctx.lineTo(x + dir * s * 0.02, y);
  ctx.fill();
}

function drawSnowflake(ctx, x, y, r, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * r, y - Math.sin(a) * r);
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    ctx.stroke();
  }
}

function labelTag(ctx, s, text) {
  ctx.save();
  ctx.font = `800 ${Math.max(8, Math.floor(s * 0.11))}px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(text).width + s * 0.08;
  const th = s * 0.14;
  const x = s * 0.5 - tw / 2;
  const y = s * 0.86 - th / 2;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  roundRect(ctx, x, y, tw, th, th * 0.35);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(text, s * 0.5, s * 0.86);
  ctx.restore();
}

function shade(hex, amount) {
  const { r, g, b } = hexToRgb(hex);
  const f = (c) => Math.max(0, Math.min(255, Math.round(c + amount * 255)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function hexToRgb(hex) {
  if (typeof hex !== "string") return { r: 100, g: 160, b: 80 };
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return { r: 100, g: 160, b: 80 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
