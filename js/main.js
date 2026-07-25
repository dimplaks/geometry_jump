import { Game } from "./game.js";
import { LEVELS, getLevel } from "./levels.js";
import {
  SKINS,
  SKIN_COLORS,
  drawSkin,
  getSkinById,
  resolveSkin,
  isSkinUnlocked,
  getSkinsUnlockedByLevel,
  skinUnlockHint,
} from "./skins.js";
import { music } from "./music.js";
import {
  register as apiRegister,
  login as apiLogin,
  logout as apiLogout,
  fetchMe,
  saveProgress,
  enterOfflineGuest,
  getOfflineUser,
} from "./auth.js";
import {
  listCommunityLevels,
  listMyLevels,
  getSharedLevel,
  recordLevelPlay,
  fetchSocial,
  toggleLike,
  postComment,
  submitScore,
  campaignKey,
} from "./levelApi.js";
import { checkServerHealth, isOfflineMode, isOnlineMode } from "./config.js";
import { loadCustomLevels, getCustomLevel } from "./customLevels.js";

const STORAGE_KEY = "geometry-jump-pvz";

const els = {
  authPanel: document.getElementById("auth-panel"),
  authForm: document.getElementById("auth-form"),
  authUsername: document.getElementById("auth-username"),
  authPassword: document.getElementById("auth-password"),
  authError: document.getElementById("auth-error"),
  authSubmit: document.getElementById("auth-submit"),
  authStatus: document.getElementById("auth-status"),
  authHint: document.getElementById("auth-hint"),
  authTabs: document.getElementById("auth-tabs"),
  btnOffline: document.getElementById("btn-offline"),
  accountName: document.getElementById("account-name"),
  menu: document.getElementById("menu"),
  levelsPanel: document.getElementById("levels-panel"),
  communityTitle: document.getElementById("community-levels-title"),
  communityHint: document.getElementById("community-hint"),
  levelHub: document.getElementById("level-hub"),
  hubTitle: document.getElementById("hub-title"),
  hubMeta: document.getElementById("hub-meta"),
  hubLike: document.getElementById("btn-hub-like"),
  hubLeaderboard: document.getElementById("hub-leaderboard"),
  hubComments: document.getElementById("hub-comments"),
  hubCommentForm: document.getElementById("hub-comment-form"),
  hubCommentInput: document.getElementById("hub-comment-input"),
  skinsPanel: document.getElementById("skins-panel"),
  pausePanel: document.getElementById("pause-panel"),
  pausePracticeHint: document.getElementById("pause-practice-hint"),
  btnCheckpoint: document.getElementById("btn-checkpoint"),
  completePanel: document.getElementById("complete-panel"),
  hud: document.getElementById("hud"),
  btnPause: document.getElementById("btn-pause"),
  btnMute: document.getElementById("btn-mute"),
  btnMuteHud: document.getElementById("btn-mute-hud"),
  levelLabel: document.getElementById("level-label"),
  attemptLabel: document.getElementById("attempt-label"),
  practiceLabel: document.getElementById("practice-label"),
  progressFill: document.getElementById("progress-fill"),
  progressText: document.getElementById("progress-text"),
  trackLabel: document.getElementById("track-label"),
  currentSkinName: document.getElementById("current-skin-name"),
  levelGrid: document.getElementById("level-grid"),
  customLevelGrid: document.getElementById("custom-level-grid"),
  customLevelsTitle: document.getElementById("custom-levels-title"),
  communityLevelGrid: document.getElementById("community-level-grid"),
  skinGrid: document.getElementById("skin-grid"),
  colorGrid: document.getElementById("color-grid"),
  completeStats: document.getElementById("complete-stats"),
  skinUnlockToast: document.getElementById("skin-unlock-toast"),
};

/** @type {{ skinId: string, skinColor: string, maxUnlocked: number, cleared: number[] }} */
let state = defaultState();
let currentUser = null;
let authMode = "login";
/** @type {{ kind: 'campaign' | 'custom', index?: number, id?: string, practice?: boolean }} */
let currentRef = { kind: "campaign", index: 0 };
let attempts = 1;
/** @type {{ key: string, title: string, meta: string, level: any, campaignIndex?: number } | null} */
let hubContext = null;
let hubSocial = null;

const game = new Game(document.getElementById("game"), {
  onProgress: (p) => {
    const pct = Math.floor(p * 100);
    els.progressFill.style.width = `${pct}%`;
    els.progressText.textContent = `${pct}%`;
  },
  onDeath: ({ attempt }) => {
    attempts = attempt + 1;
    els.attemptLabel.textContent = `Попытка ${attempts}`;
  },
  onComplete: ({ time, attempt }) => {
    let unlockMsg = "";
    const practice = !!currentRef.practice;
    if (!practice && currentRef.kind === "campaign") {
      const idx = currentRef.index;
      const alreadyCleared = state.cleared.includes(idx);
      unlockNext(idx);
      markCleared(idx);
      ensureValidSkin();
      saveState();
      if (!alreadyCleared) {
        const unlocked = getSkinsUnlockedByLevel(idx);
        if (unlocked.length) {
          unlockMsg = `Новый скин: ${unlocked.map((s) => s.name).join(", ")}!`;
        } else if (idx === LEVELS.length - 1) {
          unlockMsg = "Кампания пройдена! Все скины открыты.";
        }
      }
    }
    if (!practice && isOnlineMode() && !currentUser?.offline) {
      const key = socialKeyForCurrent();
      if (key) {
        submitScore(key, { time, attempts: attempt }).catch(() => {});
      }
    }
    els.completeStats.textContent = practice
      ? `Практика · ${time.toFixed(2)}с · Попыток: ${attempt} (не в рейтинг)`
      : `Время: ${time.toFixed(2)}с · Попыток: ${attempt}`;
    if (unlockMsg) {
      els.skinUnlockToast.textContent = unlockMsg;
      show(els.skinUnlockToast);
    } else {
      hide(els.skinUnlockToast);
    }
    show(els.completePanel);
    hide(els.btnPause);
    hide(els.btnMuteHud);
    music.playVictory();
  },
  onPauseChange: (paused) => {
    if (paused) {
      show(els.pausePanel);
      const prac = game.practice;
      els.pausePracticeHint.classList.toggle("hidden", !prac);
      els.btnCheckpoint.classList.toggle("hidden", !prac);
      music.pause();
    } else {
      hide(els.pausePanel);
      music.resume();
    }
  },
});

function syncMuteButtons() {
  const { muted, trackName } = music.getState();
  els.btnMute.textContent = muted ? "♪ Музыка выкл" : "♪ Музыка вкл";
  els.btnMute.classList.toggle("is-muted", muted);
  els.btnMuteHud.textContent = muted ? "♫" : "♪";
  els.btnMuteHud.classList.toggle("is-muted", muted);
  if (els.trackLabel) els.trackLabel.textContent = trackName ? `♪ ${trackName}` : "";
}

music.onChange(syncMuteButtons);
syncMuteButtons();

els.btnMute.addEventListener("click", async () => {
  await music.ensure();
  music.toggleMute();
  if (!music.playing) music.playMenu();
});
els.btnMuteHud.addEventListener("click", (e) => {
  e.stopPropagation();
  music.toggleMute();
});

// Unlock audio + menu theme on first gesture
const unlockAudio = async () => {
  await music.ensure();
  if (!music.playing) music.playMenu();
  window.removeEventListener("pointerdown", unlockAudio);
};
window.addEventListener("pointerdown", unlockAudio);

// Auth UI
document.querySelectorAll(".auth-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    authMode = tab.dataset.mode === "register" ? "register" : "login";
    document.querySelectorAll(".auth-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.mode === authMode);
    });
    els.authSubmit.textContent = authMode === "register" ? "Создать аккаунт" : "Войти";
    hide(els.authError);
  });
});

els.authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hide(els.authError);
  const username = els.authUsername.value.trim();
  const password = els.authPassword.value;
  els.authSubmit.disabled = true;
  try {
    const user =
      authMode === "register"
        ? await apiRegister(username, password)
        : await apiLogin(username, password);
    enterSession(user);
  } catch (err) {
    els.authError.textContent = err.message || "Ошибка входа";
    show(els.authError);
  } finally {
    els.authSubmit.disabled = false;
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  game.stop();
  await apiLogout();
  currentUser = null;
  state = defaultState();
  showAuth();
});

els.btnOffline.addEventListener("click", () => {
  const guest = enterOfflineGuest(els.authUsername.value.trim() || "guest");
  // Load local progress cache for offline play
  enterSession({ ...guest, progress: loadLocalProgress() });
});

bootSession();

document.getElementById("btn-play").addEventListener("click", () => {
  if (!currentUser) return showAuth();
  openCampaignHub(state.maxUnlocked || 0);
});

document.getElementById("btn-levels").addEventListener("click", async () => {
  hide(els.menu);
  hide(els.levelHub);
  show(els.levelsPanel);
  await buildLevelGrid();
});

document.getElementById("btn-skins").addEventListener("click", () => {
  buildSkinGrid();
  buildColorGrid();
  hide(els.menu);
  show(els.skinsPanel);
});

document.getElementById("btn-levels-back").addEventListener("click", () => {
  hide(els.levelsPanel);
  show(els.menu);
});

document.getElementById("btn-skins-back").addEventListener("click", () => {
  hide(els.skinsPanel);
  show(els.menu);
  updateSkinLabel();
});

document.getElementById("btn-hub-back").addEventListener("click", () => {
  hide(els.levelHub);
  show(els.levelsPanel);
});
document.getElementById("btn-hub-play").addEventListener("click", () => {
  if (!hubContext) return;
  launchFromHub(false);
});
document.getElementById("btn-hub-practice").addEventListener("click", () => {
  if (!hubContext) return;
  launchFromHub(true);
});
els.hubLike.addEventListener("click", async () => {
  if (!hubContext || !currentUser) return;
  try {
    hubSocial = await toggleLike(hubContext.key);
    renderHubSocial();
  } catch (e) {
    alert(e.message || "Не удалось поставить лайк");
  }
});
els.hubCommentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!hubContext || !currentUser) return;
  const text = els.hubCommentInput.value.trim();
  if (!text) return;
  try {
    hubSocial = await postComment(hubContext.key, text);
    els.hubCommentInput.value = "";
    renderHubSocial();
  } catch (err) {
    alert(err.message || "Не удалось отправить");
  }
});

document.getElementById("btn-pause").addEventListener("click", (e) => {
  e.stopPropagation();
  game.togglePause();
});

document.getElementById("btn-resume").addEventListener("click", () => game.resume());
document.getElementById("btn-checkpoint").addEventListener("click", () => {
  game.placeCheckpoint();
  game.resume();
});
document.getElementById("btn-restart").addEventListener("click", () => {
  hide(els.pausePanel);
  restartCurrent();
});
document.getElementById("btn-to-menu").addEventListener("click", () => goMenu());

document.getElementById("btn-next").addEventListener("click", () => {
  hide(els.completePanel);
  if (
    !currentRef.practice &&
    currentRef.kind === "campaign" &&
    currentRef.index < LEVELS.length - 1
  ) {
    openCampaignHub(currentRef.index + 1);
  } else {
    goMenu();
  }
});
document.getElementById("btn-complete-restart").addEventListener("click", () => {
  hide(els.completePanel);
  restartCurrent();
});
document.getElementById("btn-complete-menu").addEventListener("click", () => goMenu());

function jumpInput(e) {
  if (e.target.closest("button, a, .level-card, .skin-card, .color-swatch, .panel, .icon-btn, input, form")) return;
  if (!els.authPanel.classList.contains("hidden")) return;
  if (!els.menu.classList.contains("hidden")) return;
  if (!els.levelsPanel.classList.contains("hidden")) return;
  if (!els.levelHub.classList.contains("hidden")) return;
  if (!els.skinsPanel.classList.contains("hidden")) return;
  if (!els.pausePanel.classList.contains("hidden")) return;
  if (!els.completePanel.classList.contains("hidden")) return;
  game.requestJump();
}

window.addEventListener("pointerdown", jumpInput);
window.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  const typing =
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    document.activeElement?.isContentEditable;
  if (typing) return;

  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") {
    if (!els.pausePanel.classList.contains("hidden")) return;
    if (!els.completePanel.classList.contains("hidden")) return;
    if (els.hud.classList.contains("hidden")) return;
    e.preventDefault();
    game.requestJump();
  }
  if (e.code === "Escape" || e.code === "KeyP") {
    if (!els.hud.classList.contains("hidden")) game.togglePause();
  }
  if (e.code === "KeyR" && !els.hud.classList.contains("hidden")) {
    restartCurrent();
  }
  if (e.code === "KeyZ" && !els.hud.classList.contains("hidden") && game.practice) {
    e.preventDefault();
    game.placeCheckpoint();
  }
  if (e.code === "KeyX" && !els.hud.classList.contains("hidden") && game.practice) {
    e.preventDefault();
    game.removeCheckpoint();
  }
});

function socialKeyForCurrent() {
  if (currentRef.kind === "campaign") return campaignKey(currentRef.index);
  if (currentRef.kind === "custom") return currentRef.id;
  return null;
}

async function openCampaignHub(index) {
  const level = getLevel(index);
  await openLevelHub({
    key: campaignKey(index),
    title: `Уровень ${level.id}: ${level.name}`,
    meta: "Кампания",
    level,
    campaignIndex: index,
  });
}

async function openCustomHub(level) {
  await openLevelHub({
    key: level.id,
    title: level.name,
    meta: level.author ? `Автор: ${level.author}` : "Свой уровень",
    level,
  });
}

async function openLevelHub(ctx) {
  hubContext = ctx;
  els.hubTitle.textContent = ctx.title;
  hide(els.levelsPanel);
  hide(els.menu);
  show(els.levelHub);

  if (isOfflineMode() || currentUser?.offline) {
    els.hubMeta.textContent = `${ctx.meta} · офлайн (рейтинг недоступен)`;
    hubSocial = { likes: 0, liked: false, comments: [], leaderboard: [] };
    renderHubSocial();
    els.hubLike.disabled = true;
    els.hubCommentInput.disabled = true;
    els.hubComments.innerHTML = `<div class="levels-empty">Нужен интернет для комментариев</div>`;
    els.hubLeaderboard.innerHTML = `<li class="levels-empty">Нужен интернет для рейтинга</li>`;
    return;
  }

  els.hubLike.disabled = false;
  els.hubCommentInput.disabled = false;
  els.hubMeta.textContent = `${ctx.meta} · загружаем рейтинг…`;
  els.hubLeaderboard.innerHTML = `<li class="levels-empty">Загрузка…</li>`;
  els.hubComments.innerHTML = `<div class="levels-empty">Загрузка…</div>`;
  try {
    hubSocial = await fetchSocial(ctx.key);
    renderHubSocial();
  } catch {
    hubSocial = { likes: 0, liked: false, comments: [], leaderboard: [] };
    renderHubSocial();
    els.hubMeta.textContent = `${ctx.meta} · соц. данные недоступны`;
  }
}

function renderHubSocial() {
  if (!hubContext || !hubSocial) return;
  const likes = hubSocial.likes || 0;
  els.hubLike.textContent = `${hubSocial.liked ? "♥" : "♡"} ${likes}`;
  els.hubLike.classList.toggle("btn-like-on", !!hubSocial.liked);
  els.hubMeta.textContent = `${hubContext.meta} · ♥ ${likes} · 💬 ${(hubSocial.comments || []).length}`;

  const board = hubSocial.leaderboard || [];
  els.hubLeaderboard.innerHTML = "";
  if (!board.length) {
    els.hubLeaderboard.innerHTML = `<li class="levels-empty">Пока нет прохождений</li>`;
  } else {
    board.forEach((row, i) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <span class="rank">${i + 1}</span>
        <span class="uname">${escapeHtml(row.username)}</span>
        <span class="score">${Number(row.time).toFixed(2)}с · ${row.attempts} поп.</span>
      `;
      els.hubLeaderboard.appendChild(li);
    });
  }

  const comments = hubSocial.comments || [];
  els.hubComments.innerHTML = "";
  if (!comments.length) {
    els.hubComments.innerHTML = `<div class="levels-empty">Комментариев пока нет</div>`;
  } else {
    [...comments].reverse().forEach((c) => {
      const div = document.createElement("div");
      div.className = "hub-comment";
      const when = new Date(c.createdAt).toLocaleString("ru-RU", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      div.innerHTML = `<span class="who">${escapeHtml(c.author)}</span><span class="when">${when}</span><div>${escapeHtml(c.text)}</div>`;
      els.hubComments.appendChild(div);
    });
  }
}

function launchFromHub(practice) {
  if (!hubContext) return;
  const { level, campaignIndex, key } = hubContext;
  if (campaignIndex != null) {
    startCampaignLevel(campaignIndex, practice);
  } else {
    startCustomLevel(level, practice);
  }
  // keep key for scores
  if (key && currentRef.kind === "custom") currentRef.id = key;
}

function startCampaignLevel(index, practice = false) {
  currentRef = { kind: "campaign", index, practice };
  const level = getLevel(index);
  const label = `${practice ? "Практика · " : ""}Уровень ${level.id}: ${level.name}`;
  beginLevel(level, label, index, practice);
}

function startCustomLevel(level, practice = false) {
  currentRef = { kind: "custom", id: level.id, practice };
  const by = level.author ? ` · ${level.author}` : "";
  const label = `${practice ? "Практика · " : ""}${level.name}${by}`;
  beginLevel(level, label, null, practice);
  recordLevelPlay(level.id);
}

async function restartCurrent() {
  const practice = !!currentRef.practice;
  if (currentRef.kind === "custom") {
    try {
      const lvl = await getSharedLevel(currentRef.id);
      startCustomLevel(lvl, practice);
    } catch {
      goMenu();
    }
  } else {
    startCampaignLevel(currentRef.index, practice);
  }
}

function beginLevel(level, label, campaignIndex, practice = false) {
  attempts = 1;
  hide(els.menu);
  hide(els.levelsPanel);
  hide(els.levelHub);
  hide(els.skinsPanel);
  hide(els.pausePanel);
  hide(els.completePanel);
  show(els.hud);
  show(els.btnPause);
  show(els.btnMuteHud);
  els.practiceLabel.classList.toggle("hidden", !practice);
  els.levelLabel.textContent = label;
  els.attemptLabel.textContent = "Попытка 1";
  els.progressFill.style.width = "0%";
  els.progressText.textContent = "0%";
  applyCurrentSkin();
  game.startLevel(level, { attempt: 1, practice });
  music.playForLevel(level, campaignIndex);
  syncMuteButtons();
}

function goMenu() {
  game.stop();
  hide(els.hud);
  hide(els.btnPause);
  hide(els.btnMuteHud);
  hide(els.pausePanel);
  hide(els.completePanel);
  hide(els.levelsPanel);
  hide(els.levelHub);
  hide(els.skinsPanel);
  hide(els.authPanel);
  if (!currentUser) {
    showAuth();
    return;
  }
  show(els.menu);
  buildLevelGrid();
  updateSkinLabel();
  music.playMenu();
}

async function bootSession() {
  els.authStatus.textContent = "Проверка сервера…";
  els.authStatus.className = "auth-status";
  const online = await checkServerHealth();
  updateAuthUiForConnectivity(online);

  if (online) {
    const user = await fetchMe();
    if (user && !user.offline) {
      enterSession(user);
      const bootCustom = new URLSearchParams(location.search).get("custom");
      if (bootCustom) {
        try {
          const lvl = await getSharedLevel(bootCustom);
          startCustomLevel(lvl);
        } catch (_) {
          /* ignore missing */
        }
        history.replaceState({}, "", "index.html");
      }
      return;
    }
  } else {
    const offline = getOfflineUser();
    if (offline) {
      enterSession({ ...offline, progress: loadLocalProgress() });
      return;
    }
  }
  showAuth();
}

function updateAuthUiForConnectivity(online) {
  if (online) {
    els.authStatus.textContent = "Сервер онлайн";
    els.authStatus.className = "auth-status online";
    els.authHint.textContent = "Создай аккаунт или войди, чтобы сохранять прогресс в облаке";
    els.authTabs.classList.remove("hidden");
    els.authForm.classList.remove("hidden");
  } else {
    els.authStatus.textContent = "Сервер недоступен — можно играть офлайн";
    els.authStatus.className = "auth-status offline";
    els.authHint.textContent = "Прогресс сохранится только на этом устройстве";
    els.authTabs.classList.add("hidden");
    els.authForm.classList.add("hidden");
  }
}

function enterSession(user) {
  currentUser = user;
  if (user.offline || !user.progress) {
    applyProgress(user.progress || loadLocalProgress());
  } else {
    applyProgress(user.progress);
  }
  ensureValidSkin();
  applyCurrentSkin();
  buildLevelGrid();
  buildSkinGrid();
  buildColorGrid();
  const tag = user.offline ? " (офлайн)" : "";
  els.accountName.textContent = `${user.username}${tag}`;
  hide(els.authPanel);
  show(els.menu);
  els.authPassword.value = "";
  hide(els.authError);
  updateOnlineSectionsVisibility();
}

function showAuth() {
  hide(els.menu);
  hide(els.levelsPanel);
  hide(els.levelHub);
  hide(els.skinsPanel);
  hide(els.hud);
  hide(els.btnPause);
  hide(els.btnMuteHud);
  hide(els.pausePanel);
  hide(els.completePanel);
  show(els.authPanel);
  updateAuthUiForConnectivity(isOnlineMode());
}

function loadLocalProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const data = JSON.parse(raw);
    return {
      skinId: data.skinId || "peashooter",
      skinColor: data.skinColor || "default",
      maxUnlocked: data.maxUnlocked ?? 0,
      cleared: Array.isArray(data.cleared) ? data.cleared : [],
    };
  } catch {
    return defaultState();
  }
}

function applyProgress(progress) {
  const p = progress || {};
  state = {
    skinId: p.skinId || "peashooter",
    skinColor: p.skinColor || "default",
    maxUnlocked: p.maxUnlocked ?? 0,
    cleared: Array.isArray(p.cleared) ? [...p.cleared] : [],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function updateOnlineSectionsVisibility() {
  const offline = isOfflineMode() || !!currentUser?.offline;
  els.communityTitle?.classList.toggle("hidden", offline);
  els.communityHint?.classList.toggle("hidden", offline);
  els.communityLevelGrid?.classList.toggle("hidden", offline);
}

function defaultState() {
  return { skinId: "peashooter", skinColor: "default", maxUnlocked: 0, cleared: [] };
}

function applyCurrentSkin() {
  const skin = resolveSkin(state.skinId, state.skinColor);
  game.setSkin(skin);
  updateSkinLabel();
}

function updateSkinLabel() {
  const skin = getSkinById(state.skinId);
  const color = SKIN_COLORS.find((c) => c.id === state.skinColor);
  const colorName = color && color.id !== "default" ? ` · ${color.name}` : "";
  els.currentSkinName.textContent = `${skin.name}${colorName}`;
}

async function buildLevelGrid() {
  els.levelGrid.innerHTML = "";
  LEVELS.forEach((level, i) => {
    const card = document.createElement("button");
    card.className = "level-card";
    const locked = i > state.maxUnlocked;
    const cleared = state.cleared.includes(i);
    if (locked) card.classList.add("locked");
    if (cleared) card.classList.add("cleared");
    card.innerHTML = `<div class="num">${level.id}</div><div class="name">${level.name}</div>`;
    card.addEventListener("click", () => {
      if (locked) return;
      openCampaignHub(i);
    });
    els.levelGrid.appendChild(card);
  });

  updateOnlineSectionsVisibility();
  const offline = isOfflineMode() || !!currentUser?.offline;

  els.customLevelGrid.innerHTML = `<div class="levels-empty">Загрузка…</div>`;
  if (!offline) {
    els.communityLevelGrid.innerHTML = `<div class="levels-empty">Загрузка…</div>`;
  }

  let mine = [];
  let community = [];
  if (offline) {
    mine = loadCustomLevels();
  } else {
    try {
      mine = await listMyLevels();
    } catch {
      mine = loadCustomLevels();
    }
    try {
      community = await listCommunityLevels();
    } catch {
      community = [];
    }
  }

  els.customLevelGrid.innerHTML = "";
  if (!mine.length) {
    els.customLevelGrid.innerHTML = `<div class="levels-empty">Пока нет — создай в редакторе и сохрани</div>`;
  } else {
    mine.forEach((level) => {
      const card = document.createElement("button");
      card.className = "level-card custom";
      card.innerHTML = `
        <div class="num">✎</div>
        <div class="name">${escapeHtml(level.name)}</div>
        <div class="meta-line">${offline ? "локально" : `♥ ${level.likes || 0} · 💬 ${level.comments || 0}`} · ▶ ${level.plays || 0}</div>
      `;
      card.addEventListener("click", async () => {
        try {
          let full = level;
          if (!offline && !level.objects?.length) {
            full = await getSharedLevel(level.id);
          } else if (offline) {
            full = getCustomLevel(level.id) || level;
          }
          await openCustomHub(full);
        } catch (e) {
          alert(e.message || "Не удалось открыть уровень");
        }
      });
      els.customLevelGrid.appendChild(card);
    });
  }

  if (offline) return;

  const others = community.filter((l) => l.author !== currentUser?.username);
  els.communityLevelGrid.innerHTML = "";
  if (!others.length) {
    els.communityLevelGrid.innerHTML = `<div class="levels-empty">Чужих уровней пока нет — позови друзей создать</div>`;
  } else {
    others.forEach((level) => {
      const card = document.createElement("button");
      card.className = "level-card community";
      card.innerHTML = `
        <div class="num">★</div>
        <div class="name">${escapeHtml(level.name)}</div>
        <div class="author">автор: ${escapeHtml(level.author || "?")}</div>
        <div class="meta-line">♥ ${level.likes || 0} · 💬 ${level.comments || 0} · ▶ ${level.plays || 0}</div>
      `;
      card.addEventListener("click", async () => {
        try {
          const full = await getSharedLevel(level.id);
          await openCustomHub(full);
        } catch (e) {
          alert(e.message || "Не удалось открыть уровень");
        }
      });
      els.communityLevelGrid.appendChild(card);
    });
  }
}

function buildSkinGrid() {
  els.skinGrid.innerHTML = "";
  SKINS.forEach((skin) => {
    const unlocked = isSkinUnlocked(skin, state.cleared);
    const card = document.createElement("button");
    card.className =
      "skin-card" +
      (skin.id === state.skinId ? " active" : "") +
      (unlocked ? "" : " locked");
    const c = document.createElement("canvas");
    c.width = 112;
    c.height = 112;
    const preview = resolveSkin(skin, state.skinColor);
    drawSkin(c.getContext("2d"), preview, 112, 0.2);
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = unlocked ? skin.name : "???";
    card.appendChild(c);
    card.appendChild(name);
    const hint = document.createElement("div");
    hint.className = "lock-hint";
    hint.textContent = unlocked ? "Открыт" : skinUnlockHint(skin);
    card.appendChild(hint);
    card.addEventListener("click", () => {
      if (!unlocked) return;
      state.skinId = skin.id;
      saveState();
      applyCurrentSkin();
      buildSkinGrid();
      buildColorGrid();
    });
    els.skinGrid.appendChild(card);
  });
}

function buildColorGrid() {
  els.colorGrid.innerHTML = "";
  SKIN_COLORS.forEach((pack) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-swatch" + (pack.id === state.skinColor ? " active" : "");
    const tint = pack.tint || getSkinById(state.skinId);
    const dot = document.createElement("span");
    dot.className = "swatch-dot";
    dot.style.setProperty("--c1", tint.body);
    dot.style.setProperty("--c2", tint.accent);
    dot.style.setProperty("--c3", tint.detail || tint.glow);
    const label = document.createElement("span");
    label.textContent = pack.name;
    btn.appendChild(dot);
    btn.appendChild(label);
    btn.addEventListener("click", () => {
      state.skinColor = pack.id;
      saveState();
      applyCurrentSkin();
      buildSkinGrid();
      buildColorGrid();
    });
    els.colorGrid.appendChild(btn);
  });
}

function ensureValidSkin() {
  const skin = getSkinById(state.skinId);
  if (!isSkinUnlocked(skin, state.cleared)) {
    state.skinId = "peashooter";
  }
  if (!SKIN_COLORS.some((c) => c.id === state.skinColor)) {
    state.skinColor = "default";
  }
}

function unlockNext(index) {
  state.maxUnlocked = Math.max(state.maxUnlocked, Math.min(LEVELS.length - 1, index + 1));
}

function markCleared(index) {
  if (!state.cleared.includes(index)) state.cleared.push(index);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!currentUser) return;
  saveProgress({
    skinId: state.skinId,
    skinColor: state.skinColor,
    maxUnlocked: state.maxUnlocked,
    cleared: state.cleared,
  }).catch(() => {
    /* keep local cache if server unreachable */
  });
}

function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
