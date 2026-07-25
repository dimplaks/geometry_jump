import { Game } from "./game.js";
import { LEVELS } from "./levels.js";
import { resolveSkin } from "./skins.js";
import {
  createEmptyLevel,
  upsertCustomLevel,
  deleteCustomLevel,
  loadCustomLevels,
  getCustomLevel,
  levelToExportJson,
  parseImportedLevel,
  normalizeLevel,
  DEFAULT_THEME,
} from "./customLevels.js";
import { music } from "./music.js";
import { getToken, getOfflineUser } from "./auth.js";
import {
  listMyLevels,
  getSharedLevel,
  publishLevel,
  deleteSharedLevel,
} from "./levelApi.js";
import { checkServerHealth, isOfflineMode } from "./config.js";

const TOOLS = ["block", "spike", "spikeDown", "saw", "pad", "erase", "pan"];
const TOOL_KEYS = {
  Digit1: "block",
  Digit2: "spike",
  Digit3: "spikeDown",
  Digit4: "saw",
  Digit5: "pad",
  KeyE: "erase",
};

const canvas = document.getElementById("editor-canvas");
const ctx = canvas.getContext("2d");
const coordsEl = document.getElementById("ed-coords");
const savedListEl = document.getElementById("saved-list");

const ui = {
  name: document.getElementById("level-name"),
  length: document.getElementById("level-length"),
  speed: document.getElementById("level-speed"),
  sky0: document.getElementById("theme-sky0"),
  sky1: document.getElementById("theme-sky1"),
  ground: document.getElementById("theme-ground"),
  accent: document.getElementById("theme-accent"),
  brushW: document.getElementById("brush-w"),
  brushH: document.getElementById("brush-h"),
  brushR: document.getElementById("brush-r"),
  snap: document.getElementById("snap-grid"),
  template: document.getElementById("template-select"),
};

let level = createEmptyLevel();
let tool = "block";
let camX = 0;
let camY = 0; // extra vertical pan in blocks (0 = default ground framing)
let blockPx = 40;
let dpr = 1;
let viewW = 0;
let viewH = 0;
let hover = null;
let dragging = false;
let dragStart = null;
let dragEnd = null;
let panning = false;
let panOrigin = null;
let spaceDown = false;
let dirty = false;

const history = [];
const future = [];
const MAX_HISTORY = 80;

// --- Init ------------------------------------------------------------------

fillTemplates();
bindUi();
loadIntoUi(level);
pushHistory();
resize();
requestAnimationFrame(loop);
window.addEventListener("resize", resize);

bootEditor();

async function bootEditor() {
  const accountEl = document.getElementById("ed-account");
  await checkServerHealth();
  const useLocal = isOfflineMode() || !!getOfflineUser() || !getToken();

  if (useLocal) {
    accountEl.innerHTML = getOfflineUser() || isOfflineMode()
      ? "Офлайн · уровни только на устройстве"
      : `Нужен вход · <a href="index.html">войти</a> · можно сохранять локально`;
  } else {
    accountEl.textContent = "Аккаунт активен · уровни видят все";
  }

  await refreshSavedList();

  const params = new URLSearchParams(location.search);
  if (params.get("id")) {
    try {
      const found = useLocal
        ? getCustomLevel(params.get("id"))
        : await getSharedLevel(params.get("id"));
      if (found) openLevel(found);
      else flashStatus("Уровень не найден");
    } catch (_) {
      flashStatus("Уровень не найден");
    }
  }
}

// --- UI --------------------------------------------------------------------

function bindUi() {
  document.querySelectorAll(".tool").forEach((btn) => {
    btn.addEventListener("click", () => setTool(btn.dataset.tool));
  });

  ui.name.addEventListener("input", () => {
    level.name = ui.name.value;
    dirty = true;
  });
  ui.length.addEventListener("input", () => {
    level.length = clamp(Number(ui.length.value) || 80, 20, 500);
    dirty = true;
  });
  ui.speed.addEventListener("input", () => {
    level.speed = clamp(Number(ui.speed.value) || 10.4, 8, 16);
    dirty = true;
  });
  [ui.sky0, ui.sky1, ui.ground, ui.accent].forEach((el) => {
    el.addEventListener("input", () => {
      applyUiToLevel();
      markDirty();
    });
  });

  document.getElementById("btn-undo").addEventListener("click", undo);
  document.getElementById("btn-redo").addEventListener("click", redo);
  document.getElementById("btn-save").addEventListener("click", saveCurrent);
  document.getElementById("btn-export").addEventListener("click", exportCurrent);
  document.getElementById("btn-import").addEventListener("change", importFile);
  document.getElementById("btn-clear").addEventListener("click", () => {
    if (!confirm("Удалить все объекты уровня?")) return;
    pushHistory();
    level.objects = [];
    markDirty();
  });
  document.getElementById("btn-new").addEventListener("click", () => {
    if (dirty && !confirm("Есть несохранённые изменения. Создать новый уровень?")) return;
    openLevel(createEmptyLevel());
  });
  document.getElementById("btn-load-template").addEventListener("click", () => {
    const idx = Number(ui.template.value);
    if (!Number.isFinite(idx) || !LEVELS[idx]) return;
    if (dirty && !confirm("Заменить текущий уровень шаблоном?")) return;
    const src = LEVELS[idx];
    openLevel(
      createEmptyLevel({
        name: `${src.name} (копия)`,
        length: src.length,
        speed: src.speed,
        theme: src.theme,
        objects: src.objects,
      })
    );
  });
  document.getElementById("btn-playtest").addEventListener("click", startPlaytest);
  document.getElementById("btn-exit-play").addEventListener("click", stopPlaytest);

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointerleave", () => {
    hover = null;
    if (!dragging) canvas.releasePointerCapture?.(canvas._ptr);
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        const next = clamp(blockPx - Math.sign(e.deltaY) * 2, 22, 72);
        const before = screenToWorld(e.offsetX, e.offsetY);
        blockPx = next;
        const after = screenToWorld(e.offsetX, e.offsetY);
        camX += before.x - after.x;
        camY += before.y - after.y;
      } else if (e.shiftKey) {
        camX += (e.deltaY || e.deltaX) * 0.04;
      } else {
        camX += e.deltaX * 0.04;
        camY -= e.deltaY * 0.03;
      }
      camX = clamp(camX, -5, level.length + 10);
      camY = clamp(camY, -2, 14);
    },
    { passive: false }
  );

  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", (e) => {
    if (e.code === "Space") {
      spaceDown = false;
      updateCursor();
    }
  });
}

function fillTemplates() {
  LEVELS.forEach((l, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `${l.id}. ${l.name}`;
    ui.template.appendChild(opt);
  });
}

function setTool(t) {
  if (!TOOLS.includes(t)) return;
  tool = t;
  document.querySelectorAll(".tool").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tool === tool);
  });
  updateCursor();
}

function updateCursor() {
  canvas.classList.toggle("panning", tool === "pan" || spaceDown);
}

function loadIntoUi(lvl) {
  ui.name.value = lvl.name;
  ui.length.value = lvl.length;
  ui.speed.value = lvl.speed;
  ui.sky0.value = toColorInput(lvl.theme.sky[0]);
  ui.sky1.value = toColorInput(lvl.theme.sky[1]);
  ui.ground.value = toColorInput(lvl.theme.ground);
  ui.accent.value = toColorInput(lvl.theme.accent);
}

function applyUiToLevel() {
  level.name = ui.name.value || "Без названия";
  level.length = clamp(Number(ui.length.value) || 80, 20, 500);
  level.speed = clamp(Number(ui.speed.value) || 10.4, 8, 16);
  level.theme = {
    sky: [ui.sky0.value, ui.sky1.value],
    ground: ui.ground.value,
    accent: ui.accent.value,
  };
}

function openLevel(lvl) {
  level = normalizeLevel(lvl);
  loadIntoUi(level);
  camX = 0;
  camY = 0;
  history.length = 0;
  future.length = 0;
  pushHistory();
  dirty = false;
  refreshSavedList();
}

function markDirty() {
  dirty = true;
}

// --- History ---------------------------------------------------------------

function snapshot() {
  return JSON.stringify(level);
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > MAX_HISTORY) history.shift();
  future.length = 0;
}

function undo() {
  if (history.length < 2) return;
  future.push(history.pop());
  level = normalizeLevel(JSON.parse(history[history.length - 1]));
  loadIntoUi(level);
  dirty = true;
}

function redo() {
  if (!future.length) return;
  const snap = future.pop();
  history.push(snap);
  level = normalizeLevel(JSON.parse(snap));
  loadIntoUi(level);
  dirty = true;
}

// --- Save / export ---------------------------------------------------------

async function saveCurrent() {
  applyUiToLevel();
  const offline = isOfflineMode() || !!getOfflineUser() || !getToken();
  try {
    if (offline) {
      level = upsertCustomLevel(level);
      loadIntoUi(level);
      dirty = false;
      await refreshSavedList();
      flashStatus("Сохранено локально");
      return;
    }
    level = await publishLevel(level);
    upsertCustomLevel(level);
    loadIntoUi(level);
    dirty = false;
    await refreshSavedList();
    flashStatus("Опубликовано для всех");
  } catch (e) {
    // Network fail → local fallback
    level = upsertCustomLevel(level);
    loadIntoUi(level);
    dirty = false;
    await refreshSavedList();
    flashStatus("Сервер недоступен · сохранено локально");
  }
}

function exportCurrent() {
  applyUiToLevel();
  const blob = new Blob([levelToExportJson(level)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${slug(level.name)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importFile(e) {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file) return;
  try {
    const text = await file.text();
    const levels = parseImportedLevel(text);
    if (!levels.length) throw new Error("empty");
    if (dirty && !confirm("Импортировать и заменить текущий уровень?")) return;
    const first = levels[0];
    first.id = `custom-${Date.now()}`;
    openLevel(first);
    if (levels.length > 1 && getToken()) {
      for (const l of levels.slice(1)) {
        try {
          await publishLevel({
            ...l,
            id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          });
        } catch (_) {}
      }
      await refreshSavedList();
    }
    dirty = true;
    flashStatus(`Импортировано: ${levels.length}`);
  } catch {
    alert("Не удалось прочитать JSON уровня");
  }
}

async function refreshSavedList() {
  savedListEl.innerHTML = `<div class="meta" style="padding:6px;color:var(--muted)">Загрузка…</div>`;
  const offline = isOfflineMode() || !!getOfflineUser() || !getToken();
  let list = [];
  if (offline) {
    list = loadCustomLevels();
  } else {
    try {
      list = await listMyLevels();
    } catch {
      list = loadCustomLevels();
    }
  }
  savedListEl.innerHTML = "";
  if (!list.length) {
    savedListEl.innerHTML = `<div class="meta" style="padding:6px;color:var(--muted)">${offline ? "Пока пусто — сохрани локально" : "Пока пусто — «Сохранить и опубликовать»"}</div>`;
    return;
  }
  list.forEach((item) => {
    const row = document.createElement("div");
    row.className = "saved-item" + (item.id === level.id ? " active" : "");
    row.innerHTML = `
      <button class="title" data-act="open">${escapeHtml(item.name)}</button>
      <div class="row-actions">
        <button data-act="play" title="Играть">▶</button>
        <button data-act="del" title="Удалить">✕</button>
      </div>
      <div class="meta">${item.objects.length} объ. · ${offline ? "локально" : `▶ ${item.plays || 0} · общие`}</div>
    `;
    row.addEventListener("click", async (ev) => {
      const act = ev.target.closest("[data-act]")?.dataset.act;
      if (act === "del") {
        if (!confirm(offline ? `Удалить «${item.name}»?` : `Удалить «${item.name}» у всех игроков?`)) return;
        try {
          if (offline) deleteCustomLevel(item.id);
          else await deleteSharedLevel(item.id);
          if (level.id === item.id) openLevel(createEmptyLevel());
          await refreshSavedList();
        } catch (e) {
          alert(e.message || "Не удалось удалить");
        }
        return;
      }
      if (act === "play") {
        location.href = `index.html?custom=${encodeURIComponent(item.id)}`;
        return;
      }
      if (dirty && item.id !== level.id && !confirm("Открыть другой уровень? Несохранённые изменения пропадут.")) return;
      openLevel(item);
    });
    savedListEl.appendChild(row);
  });
}

function flashStatus(text) {
  const prev = coordsEl.textContent;
  coordsEl.textContent = text;
  setTimeout(() => {
    if (coordsEl.textContent === text) coordsEl.textContent = prev;
  }, 900);
}

// --- Pointer / editing -----------------------------------------------------

function onKeyDown(e) {
  if (playtestActive) {
    if (e.code === "Escape") stopPlaytest();
    return;
  }

  const tag = document.activeElement?.tagName;
  if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
    if (e.code === "Escape") document.activeElement.blur();
    return;
  }

  if ((e.ctrlKey || e.metaKey) && e.code === "KeyZ") {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyY") {
    e.preventDefault();
    redo();
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.code === "KeyS") {
    e.preventDefault();
    saveCurrent();
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();
    spaceDown = true;
    updateCursor();
  }
  if (TOOL_KEYS[e.code]) setTool(TOOL_KEYS[e.code]);
  if (e.code === "ArrowLeft") camX = clamp(camX - 2, -5, level.length + 10);
  if (e.code === "ArrowRight") camX = clamp(camX + 2, -5, level.length + 10);
  if (e.code === "ArrowUp") camY = clamp(camY + 1, -2, 14);
  if (e.code === "ArrowDown") camY = clamp(camY - 1, -2, 14);
  if (e.code === "Delete" || e.code === "Backspace") {
    if (hover) {
      pushHistory();
      eraseAt(hover.x, hover.y);
      markDirty();
    }
  }
}

function onPointerDown(e) {
  canvas.setPointerCapture(e.pointerId);
  canvas._ptr = e.pointerId;
  const world = pointerWorld(e);
  hover = world;

  if (e.button === 1 || tool === "pan" || spaceDown) {
    panning = true;
    canvas.classList.add("dragging");
    panOrigin = { x: e.clientX, y: e.clientY, camX, camY };
    return;
  }

  if (e.button === 2 || tool === "erase") {
    pushHistory();
    eraseAt(world.x, world.y);
    dragging = true;
    dragStart = world;
    markDirty();
    return;
  }

  if (e.button !== 0) return;

  pushHistory();
  dragging = true;
  dragStart = world;
  dragEnd = world;

  if (tool !== "block") {
    placeTool(world.x, world.y);
    markDirty();
  }
}

function onPointerMove(e) {
  const world = pointerWorld(e);
  hover = world;
  coordsEl.textContent = `x:${fmt(world.x)} y:${fmt(world.y)} · объектов: ${level.objects.length}${dirty ? " · *" : ""}`;

  if (panning && panOrigin) {
    const dx = (e.clientX - panOrigin.x) / blockPx;
    const dy = (e.clientY - panOrigin.y) / blockPx;
    camX = clamp(panOrigin.camX - dx, -5, level.length + 10);
    camY = clamp(panOrigin.camY + dy, -2, 14);
    return;
  }

  if (!dragging || !dragStart) return;
  dragEnd = world;

  if (tool === "erase" || e.buttons === 2) {
    eraseAt(world.x, world.y);
    markDirty();
    return;
  }

  if (tool !== "block" && tool !== "erase" && tool !== "pan") {
    placeTool(world.x, world.y);
    markDirty();
  }
}

function onPointerUp(e) {
  if (panning) {
    panning = false;
    panOrigin = null;
    canvas.classList.remove("dragging");
    return;
  }

  if (dragging && tool === "block" && dragStart && dragEnd) {
    const rect = rectFrom(dragStart, dragEnd);
    // remove overlapping blocks in rect then place one block
    level.objects = level.objects.filter(
      (o) =>
        !(
          o.type === "block" &&
          o.x < rect.x + rect.w &&
          o.x + o.w > rect.x &&
          o.y < rect.y + rect.h &&
          o.y + o.h > rect.y
        )
    );
    const bw = Math.max(1, Number(ui.brushW.value) || 1);
    const bh = Math.max(1, Number(ui.brushH.value) || 1);
    // If user dragged, use drag size; if click, use brush size
    const dragged = Math.abs(dragEnd.x - dragStart.x) + Math.abs(dragEnd.y - dragStart.y) > 0;
    if (dragged) {
      level.objects.push({ type: "block", x: rect.x, y: rect.y, w: rect.w, h: rect.h });
    } else {
      level.objects.push({ type: "block", x: dragStart.x, y: dragStart.y, w: bw, h: bh });
    }
    markDirty();
  }

  dragging = false;
  dragStart = null;
  dragEnd = null;
}

function placeTool(x, y) {
  // avoid duplicates on same cell for point tools
  if (tool === "saw") {
    level.objects = level.objects.filter((o) => !(o.type === "saw" && almost(o.x, x + 0.5) && almost(o.y, y + 0.5)));
    level.objects.push({
      type: "saw",
      x: x + 0.5,
      y: y + 0.5,
      r: clamp(Number(ui.brushR.value) || 0.7, 0.4, 1.5),
    });
    return;
  }
  if (tool === "spike" || tool === "spikeDown" || tool === "pad") {
    level.objects = level.objects.filter((o) => !(o.type === tool && o.x === x && o.y === y));
    level.objects.push({ type: tool, x, y });
  }
}

function eraseAt(x, y) {
  const px = x + 0.5;
  const py = y + 0.5;
  level.objects = level.objects.filter((o) => {
    if (o.type === "block") {
      return !(px >= o.x && px < o.x + o.w && py >= o.y && py < o.y + o.h);
    }
    if (o.type === "saw") {
      const dx = o.x - px;
      const dy = o.y - py;
      return dx * dx + dy * dy > (o.r + 0.3) * (o.r + 0.3);
    }
    return !(o.x === x && o.y === y);
  });
}

function rectFrom(a, b) {
  const x1 = Math.min(a.x, b.x);
  const y1 = Math.min(a.y, b.y);
  const x2 = Math.max(a.x, b.x);
  const y2 = Math.max(a.y, b.y);
  return { x: x1, y: y1, w: Math.max(1, x2 - x1 + 1), h: Math.max(1, y2 - y1 + 1) };
}

// --- Coordinates -----------------------------------------------------------

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  viewW = rect.width;
  viewH = rect.height;
  canvas.width = Math.floor(viewW * dpr);
  canvas.height = Math.floor(viewH * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function groundScreenY() {
  return viewH * 0.72 + camY * blockPx;
}

function worldToScreen(x, y) {
  return {
    x: (x - camX) * blockPx,
    y: groundScreenY() - y * blockPx,
  };
}

function screenToWorld(sx, sy) {
  return {
    x: sx / blockPx + camX,
    y: (groundScreenY() - sy) / blockPx,
  };
}

function pointerWorld(e) {
  const rect = canvas.getBoundingClientRect();
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;
  let { x, y } = screenToWorld(sx, sy);
  if (ui.snap.checked) {
    x = Math.floor(x);
    y = Math.floor(y);
  }
  y = clamp(y, 0, 20);
  x = clamp(x, -2, level.length + 20);
  return { x, y };
}

// --- Draw ------------------------------------------------------------------

function loop() {
  draw();
  requestAnimationFrame(loop);
}

function draw() {
  applyUiToLevel();
  const w = viewW;
  const h = viewH;
  const theme = level.theme || DEFAULT_THEME;

  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, theme.sky[0]);
  g.addColorStop(1, theme.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const gy = groundScreenY();

  // grid
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.lineWidth = 1;
  const x0 = Math.floor(camX);
  const x1 = Math.ceil(camX + w / blockPx);
  for (let x = x0; x <= x1; x++) {
    const s = worldToScreen(x, 0);
    ctx.beginPath();
    ctx.moveTo(s.x, gy - 16 * blockPx);
    ctx.lineTo(s.x, gy + 2 * blockPx);
    ctx.stroke();
  }
  for (let y = 0; y <= 16; y++) {
    const s = worldToScreen(camX, y);
    ctx.beginPath();
    ctx.moveTo(0, s.y);
    ctx.lineTo(w, s.y);
    ctx.stroke();
  }

  // ground
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, gy, w, h - gy);
  ctx.fillStyle = theme.accent;
  ctx.fillRect(0, gy - 3, w, 6);

  // start zone
  const start = worldToScreen(0, 0);
  ctx.fillStyle = "rgba(93,191,58,0.15)";
  ctx.fillRect(start.x, gy - 3 * blockPx, 4 * blockPx, 3 * blockPx);
  ctx.fillStyle = theme.accent;
  ctx.font = `700 ${Math.floor(blockPx * 0.35)}px Nunito,sans-serif`;
  ctx.fillText("СТАРТ", start.x + 8, gy - 3 * blockPx + 18);

  // finish
  const fin = worldToScreen(level.length, 0);
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#f5f5f5" : "#222";
    ctx.fillRect(fin.x, gy - (i + 1) * blockPx * 0.7, blockPx * 0.6, blockPx * 0.7);
  }
  ctx.fillStyle = theme.accent;
  ctx.fillText("ФИНИШ", fin.x - 4, gy - 6 * blockPx);

  // objects
  for (const o of level.objects) drawObject(o, theme);

  // drag preview for block
  if (dragging && tool === "block" && dragStart && dragEnd) {
    const rect = rectFrom(dragStart, dragEnd);
    const dragged = Math.abs(dragEnd.x - dragStart.x) + Math.abs(dragEnd.y - dragStart.y) > 0;
    const preview = dragged
      ? rect
      : {
          x: dragStart.x,
          y: dragStart.y,
          w: Math.max(1, Number(ui.brushW.value) || 1),
          h: Math.max(1, Number(ui.brushH.value) || 1),
        };
    drawBlockGhost(preview, theme.accent);
  } else if (hover && tool === "block") {
    drawBlockGhost(
      {
        x: hover.x,
        y: hover.y,
        w: Math.max(1, Number(ui.brushW.value) || 1),
        h: Math.max(1, Number(ui.brushH.value) || 1),
      },
      theme.accent
    );
  } else if (hover && tool !== "erase" && tool !== "pan") {
    drawToolGhost(hover);
  }

  // player ghost at spawn
  const spawn = worldToScreen(2.5, 0.5);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.fillStyle = "#dff7c8";
  ctx.fillRect(spawn.x - blockPx / 2, spawn.y - blockPx / 2, blockPx, blockPx);
  ctx.restore();
}

function drawObject(o, theme) {
  if (o.type === "block") {
    const top = worldToScreen(o.x, o.y + o.h);
    const w = o.w * blockPx;
    const h = o.h * blockPx;
    const grad = ctx.createLinearGradient(top.x, top.y, top.x, top.y + h);
    grad.addColorStop(0, "#6a4a30");
    grad.addColorStop(1, "#3a2818");
    ctx.fillStyle = grad;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = 2;
    roundRect(ctx, top.x, top.y, w, h, 5);
    ctx.fill();
    ctx.stroke();
  } else if (o.type === "spike" || o.type === "spikeDown") {
    drawSpike(o, o.type === "spikeDown");
  } else if (o.type === "saw") {
    const c = worldToScreen(o.x, o.y);
    const r = o.r * blockPx;
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.fillStyle = "#c0c4c8";
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2;
      const a1 = ((i + 0.5) / 12) * Math.PI * 2;
      const a2 = ((i + 1) / 12) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a0) * r * 0.7, Math.sin(a0) * r * 0.7);
      ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
      ctx.lineTo(Math.cos(a2) * r * 0.7, Math.sin(a2) * r * 0.7);
    }
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = theme.accent;
    ctx.fill();
    ctx.restore();
  } else if (o.type === "pad") {
    const p = worldToScreen(o.x, o.y + 0.2);
    ctx.fillStyle = "#f5d76e";
    roundRect(ctx, p.x + 4, p.y, blockPx - 8, 0.25 * blockPx, 4);
    ctx.fill();
  }
}

function drawSpike(o, down) {
  const bp = blockPx;
  ctx.beginPath();
  if (!down) {
    const base = worldToScreen(o.x, o.y);
    const tip = worldToScreen(o.x + 0.5, o.y + 1);
    ctx.moveTo(base.x, base.y);
    ctx.lineTo(base.x + bp, base.y);
    ctx.lineTo(tip.x, tip.y);
  } else {
    const tip = worldToScreen(o.x + 0.5, o.y);
    const left = worldToScreen(o.x, o.y + 1);
    const right = worldToScreen(o.x + 1, o.y + 1);
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.lineTo(tip.x, tip.y);
  }
  ctx.closePath();
  ctx.fillStyle = "#e8e8e8";
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.stroke();
}

function drawBlockGhost(rect, color) {
  const top = worldToScreen(rect.x, rect.y + rect.h);
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = color;
  ctx.strokeStyle = "#fff";
  ctx.setLineDash([6, 4]);
  roundRect(ctx, top.x, top.y, rect.w * blockPx, rect.h * blockPx, 5);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
}

function drawToolGhost(cell) {
  ctx.globalAlpha = 0.4;
  if (tool === "spike") drawSpike({ x: cell.x, y: cell.y }, false);
  else if (tool === "spikeDown") drawSpike({ x: cell.x, y: cell.y }, true);
  else if (tool === "pad") drawObject({ type: "pad", x: cell.x, y: cell.y }, level.theme);
  else if (tool === "saw") {
    drawObject(
      { type: "saw", x: cell.x + 0.5, y: cell.y + 0.5, r: Number(ui.brushR.value) || 0.7 },
      level.theme
    );
  }
  ctx.globalAlpha = 1;
}

function roundRect(c, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + rr, y);
  c.arcTo(x + w, y, x + w, y + h, rr);
  c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr);
  c.arcTo(x, y, x + w, y, rr);
  c.closePath();
}

// --- Playtest --------------------------------------------------------------

let playtestActive = false;
let playGame = null;
const playRoot = document.getElementById("playtest");
const playCanvas = document.getElementById("play-canvas");
const playAttempt = document.getElementById("play-attempt");
const playProgress = document.getElementById("play-progress");

function startPlaytest() {
  applyUiToLevel();
  const testLevel = normalizeLevel(level);
  playtestActive = true;
  playRoot.classList.remove("hidden");
  playAttempt.textContent = "Попытка 1";
  playProgress.style.width = "0%";

  if (!playGame) {
    playGame = new Game(playCanvas, {
      onProgress: (p) => {
        playProgress.style.width = `${Math.floor(p * 100)}%`;
      },
      onDeath: ({ attempt }) => {
        playAttempt.textContent = `Попытка ${attempt + 1}`;
      },
      onComplete: ({ time, attempt }) => {
        playAttempt.textContent = `Пройдено! ${time.toFixed(2)}с · ${attempt} попыток`;
        music.playVictory();
      },
    });
    const saved = (() => {
      try {
        return JSON.parse(localStorage.getItem("geometry-jump-pvz") || "{}");
      } catch {
        return {};
      }
    })();
    playGame.setSkin(resolveSkin(saved.skinId || "peashooter", saved.skinColor || "default"));
  }

  playGame.resize();
  playGame.startLevel(testLevel, { attempt: 1 });
  music.playForLevel(testLevel);
}

function stopPlaytest() {
  playtestActive = false;
  playRoot.classList.add("hidden");
  playGame?.stop();
  music.stop();
}

window.addEventListener("pointerdown", (e) => {
  if (!playtestActive) return;
  if (e.target.closest("#btn-exit-play")) return;
  playGame?.requestJump();
});

window.addEventListener("keydown", (e) => {
  if (!playtestActive) return;
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    e.preventDefault();
    playGame?.requestJump();
  }
  if (e.code === "KeyR") {
    applyUiToLevel();
    playGame?.startLevel(normalizeLevel(level), { attempt: 1 });
    playAttempt.textContent = "Попытка 1";
  }
});

// --- Helpers ---------------------------------------------------------------

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}
function almost(a, b) {
  return Math.abs(a - b) < 0.01;
}
function fmt(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
function slug(s) {
  return String(s || "level")
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "level";
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function toColorInput(c) {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  // best-effort for short/named — fall back
  const map = {
    "#87ceeb": "#87ceeb",
  };
  return map[c] || "#88aa66";
}
