import { drawSkin, getSkinById } from "./skins.js";

/** Geometry Dash–style cube physics (block units, y-up). */
export const PHYSICS = {
  SIZE: 1,
  // Classic cube horizontal speed ≈ 10.4 blocks/s
  BASE_SPEED: 10.4,
  // High gravity → short airtime, jump again sooner
  GRAVITY: 125.0,
  // Apex ≈ 2.05 blocks (not higher — just snappier): h = v²/(2g)
  JUMP_VEL: 22.6,
  PAD_VEL: 29.5,
  // Max fall speed (terminal)
  MAX_FALL: 32.0,
  // Rotation while airborne (deg/s)
  SPIN_SPEED: 620,
  // Forgiving hazard hitboxes
  SPIKE_SHRINK: 0.28,
  SAW_SHRINK: 0.16,
  // Jump buffer / coyote — chain jumps more easily
  JUMP_BUFFER: 0.12,
  COYOTE: 0.09,
};

export class Game {
  constructor(canvas, { onProgress, onDeath, onComplete, onPauseChange } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.onProgress = onProgress || (() => {});
    this.onDeath = onDeath || (() => {});
    this.onComplete = onComplete || (() => {});
    this.onPauseChange = onPauseChange || (() => {});

    this.dpr = 1;
    this.blockPx = 48;
    this.running = false;
    this.paused = false;
    this.level = null;
    this.skin = getSkinById("peashooter");
    this.attempt = 1;
    this.time = 0;
    this.animT = 0;

    this.player = null;
    this.cameraX = 0;
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.practice = false;
    this.checkpoints = [];
    this._raf = 0;
    this._last = 0;
    this._skinCanvas = document.createElement("canvas");
    this._skinCanvas.width = 128;
    this._skinCanvas.height = 128;
    this._skinCtx = this._skinCanvas.getContext("2d");

    this._onResize = () => this.resize();
    window.addEventListener("resize", this._onResize);
    this.resize();
  }

  setPractice(enabled) {
    this.practice = !!enabled;
    if (!this.practice) this.checkpoints = [];
  }

  placeCheckpoint() {
    if (!this.running || !this.practice || this.paused) return false;
    const p = this.player;
    if (!p || p.dead || p.finished) return false;
    this.checkpoints.push({
      x: p.x,
      y: Math.max(0, p.y),
      rotation: Math.round(p.rotation / 90) * 90,
    });
    if (this.checkpoints.length > 40) this.checkpoints.shift();
    this._spawnDust(p.x + 0.5, p.y, 8, "#6ec8ff");
    return true;
  }

  removeCheckpoint() {
    if (!this.practice || !this.checkpoints.length) return false;
    this.checkpoints.pop();
    return true;
  }

  setSkin(skin) {
    this.skin = skin;
  }

  resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.viewW = w;
    this.viewH = h;
    // Keep ~10 blocks visible vertically around playfield
    this.blockPx = Math.max(36, Math.min(56, h / 12));
  }

  startLevel(level, { attempt = 1, practice = false } = {}) {
    this.level = level;
    this.attempt = attempt;
    this.paused = false;
    this.running = true;
    this.time = 0;
    this.animT = 0;
    this.particles = [];
    this.shake = 0;
    this.flash = 0;
    this.cameraX = 0;
    this.setPractice(practice);
    this._resetPlayer();
    this._last = performance.now();
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame((t) => this._loop(t));
    this.onPauseChange(false);
  }

  _resetPlayer() {
    const speed = this.level?.speed ?? PHYSICS.BASE_SPEED;
    const cp =
      this.practice && this.checkpoints.length
        ? this.checkpoints[this.checkpoints.length - 1]
        : null;
    this.player = {
      x: cp ? cp.x : 2,
      y: cp ? cp.y : 0,
      vx: speed,
      vy: 0,
      w: PHYSICS.SIZE,
      h: PHYSICS.SIZE,
      grounded: true,
      rotation: cp ? cp.rotation || 0 : 0,
      dead: false,
      finished: false,
      jumpBuffer: 0,
      coyote: PHYSICS.COYOTE,
      padCooldown: 0,
    };
    this.cameraX = cp ? Math.max(0, cp.x - 3.2) : 0;
  }

  stop() {
    this.running = false;
    this.paused = false;
    cancelAnimationFrame(this._raf);
  }

  togglePause() {
    if (!this.running || this.player?.dead || this.player?.finished) return;
    this.paused = !this.paused;
    this.onPauseChange(this.paused);
    if (!this.paused) {
      this._last = performance.now();
      this._raf = requestAnimationFrame((t) => this._loop(t));
    }
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.onPauseChange(false);
    this._last = performance.now();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  requestJump() {
    if (!this.running || this.paused || !this.player || this.player.dead || this.player.finished) return;
    this.player.jumpBuffer = PHYSICS.JUMP_BUFFER;
  }

  _tryJump() {
    const p = this.player;
    if (p.jumpBuffer <= 0) return;
    if (p.grounded || p.coyote > 0) {
      p.vy = PHYSICS.JUMP_VEL;
      p.grounded = false;
      p.coyote = 0;
      p.jumpBuffer = 0;
      this._spawnDust(p.x + 0.5, p.y, 6);
    }
  }

  _loop(now) {
    if (!this.running || this.paused) return;
    const dt = Math.min(0.033, (now - this._last) / 1000);
    this._last = now;
    this._update(dt);
    this._draw();
    this._raf = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    if (!this.player || this.player.dead || this.player.finished) {
      this.animT += dt;
      this._updateParticles(dt);
      this.shake = Math.max(0, this.shake - dt * 8);
      this.flash = Math.max(0, this.flash - dt * 3);
      return;
    }

    const p = this.player;
    const level = this.level;
    this.time += dt;
    this.animT += dt;

    p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
    p.coyote = Math.max(0, p.coyote - dt);
    p.padCooldown = Math.max(0, p.padCooldown - dt);

    this._tryJump();

    const wasGrounded = p.grounded;
    const prevX = p.x;
    const prevY = p.y;

    // Axis-separated move (GD-style): X then Y, resolve with previous pose
    p.vx = level.speed;
    p.x += p.vx * dt;
    if (this._resolveSolidHits("x", prevX, prevY)) return;

    p.vy -= PHYSICS.GRAVITY * dt;
    if (p.vy < -PHYSICS.MAX_FALL) p.vy = -PHYSICS.MAX_FALL;
    p.y += p.vy * dt;
    p.grounded = false;

    // Ground plane y=0 (standing on top => player.y = 0)
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
    }

    if (this._resolveSolidHits("y", prevX, prevY)) return;

    if (p.grounded && !wasGrounded) {
      // Snap rotation to upright cardinal angle (GD cube land)
      p.rotation = Math.round(p.rotation / 90) * 90;
      this._spawnDust(p.x + 0.5, p.y, 4);
    }

    if (!p.grounded) {
      p.rotation += PHYSICS.SPIN_SPEED * dt;
    } else {
      p.coyote = PHYSICS.COYOTE;
    }

    // Hazards
    if (this._hitHazard()) {
      this._die();
      return;
    }

    // Jump pads
    this._checkPads();

    // Camera follow with slight lead
    const targetCam = p.x - 3.2;
    this.cameraX += (targetCam - this.cameraX) * Math.min(1, dt * 10);

    const progress = Math.max(0, Math.min(1, p.x / level.length));
    this.onProgress(progress);

    if (p.x >= level.length) {
      p.finished = true;
      p.vx = 0;
      this.flash = 0.6;
      this.onComplete({ time: this.time, attempt: this.attempt });
    }

    this._updateParticles(dt);
    this.shake = Math.max(0, this.shake - dt * 8);
    this.flash = Math.max(0, this.flash - dt * 3);
  }

  /**
   * Resolve AABB vs blocks for one axis.
   * Landing is allowed when feet were at/above the platform top before the move,
   * or when clipping a ledge near the top (GD-like forgiveness).
   * True side/ceiling hits still kill.
   * @returns {boolean} true if player died
   */
  _resolveSolidHits(axis, prevX, prevY) {
    const p = this.player;
    const prevBottom = prevY;
    const prevTop = prevY + p.h;
    // How far below the top we still treat as a valid landing / ledge grab
    const landEps = 0.28;
    const ledgeAssist = 0.7;

    for (const o of this.level.objects) {
      if (o.type !== "block") continue;

      const ox1 = o.x;
      const ox2 = o.x + o.w;
      const oy1 = o.y;
      const oy2 = o.y + o.h;

      // Narrower body for side checks — easier to land on platforms
      const hitX = axis === "x" ? p.x + 0.16 : p.x;
      const hitW = axis === "x" ? p.w - 0.32 : p.w;
      if (!this._aabb(hitX, p.y, hitW, p.h, ox1, oy1, o.w, o.h)) continue;

      if (axis === "y") {
        // Came from above → land on platform
        if (p.vy <= 0 && prevBottom >= oy2 - landEps) {
          p.y = oy2;
          p.vy = 0;
          p.grounded = true;
          continue;
        }
        // Hit underside while rising → death
        if (p.vy > 0 && prevTop <= oy1 + landEps) {
          this._die();
          return true;
        }
        // Deep fall into top surface — still land if feet are in upper band
        if (p.vy <= 0 && p.y >= oy2 - ledgeAssist) {
          p.y = oy2;
          p.vy = 0;
          p.grounded = true;
          continue;
        }
        this._die();
        return true;
      }

      // axis === "x"
      // Already on / clearing the top
      if (prevBottom >= oy2 - landEps || p.y >= oy2 - landEps) {
        p.y = oy2;
        p.vy = Math.min(p.vy, 0);
        p.grounded = true;
        continue;
      }

      // Ledge grab: jumping onto a platform from the side near the top
      if (p.y >= oy2 - ledgeAssist) {
        p.y = oy2;
        p.vy = Math.min(p.vy, 0);
        p.grounded = true;
        continue;
      }

      this._die();
      return true;
    }
    return false;
  }

  _hitHazard() {
    const p = this.player;
    const shrink = PHYSICS.SPIKE_SHRINK;
    const pcx = p.x + p.w / 2;
    const pcy = p.y + p.h / 2;

    for (const o of this.level.objects) {
      if (o.type === "spike") {
        // Triangle pointing up; smaller hitbox
        const hx = o.x + shrink;
        const hw = 1 - shrink * 2;
        const hy = o.y;
        const hh = 1 - shrink;
        if (this._aabb(p.x, p.y, p.w, p.h, hx, hy, hw, hh)) {
          // Extra: only if near tip / body — simple AABB is enough with shrink
          return true;
        }
      } else if (o.type === "spikeDown") {
        const hx = o.x + shrink;
        const hw = 1 - shrink * 2;
        const hy = o.y + shrink;
        const hh = 1 - shrink;
        if (this._aabb(p.x, p.y, p.w, p.h, hx, hy, hw, hh)) return true;
      } else if (o.type === "saw") {
        const r = o.r * (1 - PHYSICS.SAW_SHRINK);
        const dx = pcx - o.x;
        const dy = pcy - o.y;
        const pr = p.w * 0.35;
        if (dx * dx + dy * dy < (r + pr) * (r + pr)) return true;
      }
    }
    return false;
  }

  _checkPads() {
    const p = this.player;
    if (p.padCooldown > 0) return;
    for (const o of this.level.objects) {
      if (o.type !== "pad") continue;
      if (this._aabb(p.x, p.y, p.w, p.h, o.x, o.y, 1, 0.35)) {
        p.vy = PHYSICS.PAD_VEL;
        p.grounded = false;
        p.padCooldown = 0.2;
        this._spawnDust(p.x + 0.5, p.y, 10, this.level.theme.accent);
        break;
      }
    }
  }

  _aabb(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  _die() {
    if (this.player.dead) return;
    this.player.dead = true;
    this.shake = 0.45;
    this.flash = 0.35;
    this._spawnBurst(this.player.x + 0.5, this.player.y + 0.5);
    this.onDeath({ attempt: this.attempt, practice: this.practice });
    // Auto-restart after short delay (practice → last checkpoint)
    setTimeout(() => {
      if (!this.running || !this.player?.dead) return;
      this.attempt += 1;
      this._resetPlayer();
      this.particles = [];
    }, 550);
  }

  _spawnDust(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 4,
        vy: Math.random() * 3 + 1,
        life: 0.35 + Math.random() * 0.25,
        max: 0.5,
        size: 0.08 + Math.random() * 0.1,
        color: color || "rgba(255,255,255,0.7)",
      });
    }
  }

  _spawnBurst(x, y) {
    const c = this.skin.body;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      const sp = 3 + Math.random() * 5;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.5 + Math.random() * 0.3,
        max: 0.7,
        size: 0.12 + Math.random() * 0.12,
        color: c,
      });
    }
  }

  _updateParticles(dt) {
    this.particles = this.particles.filter((p) => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 20 * dt;
      return p.life > 0;
    });
  }

  // --- Rendering ---------------------------------------------------------

  _worldToScreen(x, y) {
    const groundY = this.viewH * 0.72;
    const sx = (x - this.cameraX) * this.blockPx;
    const sy = groundY - y * this.blockPx;
    return { x: sx, y: sy, groundY };
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    const level = this.level;
    if (!level) return;

    let shakeX = 0;
    let shakeY = 0;
    if (this.shake > 0) {
      shakeX = (Math.random() - 0.5) * 12 * this.shake;
      shakeY = (Math.random() - 0.5) * 12 * this.shake;
    }

    ctx.save();
    ctx.translate(shakeX, shakeY);

    this._drawBackground(level);
    this._drawGround(level);
    this._drawObjects(level);
    this._drawCheckpoints();
    this._drawParticles();
    if (this.player && !this.player.dead) this._drawPlayer();
    this._drawFinish(level);

    ctx.restore();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.55})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.player?.dead) {
      ctx.fillStyle = "rgba(180,30,20,0.22)";
      ctx.fillRect(0, 0, w, h);
    }
  }

  _drawBackground(level) {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, level.theme.sky[0]);
    g.addColorStop(1, level.theme.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Parallax hills
    const cam = this.cameraX;
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    this._hillBand(h * 0.55, 90, cam * 0.15, "#00000022");
    this._hillBand(h * 0.62, 70, cam * 0.28, "#00000018");

    // Grid feel
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    const { groundY } = this._worldToScreen(0, 0);
    const start = -((cam * this.blockPx) % this.blockPx);
    for (let x = start; x < w; x += this.blockPx) {
      ctx.beginPath();
      ctx.moveTo(x, groundY - 8 * this.blockPx);
      ctx.lineTo(x, groundY);
      ctx.stroke();
    }
  }

  _hillBand(baseY, amp, offset, color) {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) {
      const y = baseY + Math.sin((x + offset * 40) * 0.01) * amp * 0.35;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }

  _drawGround(level) {
    const ctx = this.ctx;
    const w = this.viewW;
    const h = this.viewH;
    const { groundY } = this._worldToScreen(0, 0);

    ctx.fillStyle = level.theme.ground;
    ctx.fillRect(0, groundY, w, h - groundY);

    // Grass strip
    const grass = ctx.createLinearGradient(0, groundY - 6, 0, groundY + 18);
    grass.addColorStop(0, level.theme.accent);
    grass.addColorStop(1, level.theme.ground);
    ctx.fillStyle = grass;
    ctx.fillRect(0, groundY - 4, w, 16);

    // Soil pattern
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    const start = -((this.cameraX * this.blockPx) % (this.blockPx * 2));
    for (let x = start; x < w; x += this.blockPx * 2) {
      ctx.fillRect(x, groundY + 22, this.blockPx, 4);
    }
  }

  _drawObjects(level) {
    const ctx = this.ctx;
    const cam = this.cameraX;
    const margin = 2;

    for (const o of level.objects) {
      if (o.x + (o.w || 2) < cam - margin || o.x > cam + this.viewW / this.blockPx + margin) continue;

      if (o.type === "block") this._drawBlock(o, level);
      else if (o.type === "spike") this._drawSpike(o, false, level);
      else if (o.type === "spikeDown") this._drawSpike(o, true, level);
      else if (o.type === "saw") this._drawSaw(o, level);
      else if (o.type === "pad") this._drawPad(o);
    }
  }

  _drawCheckpoints() {
    if (!this.practice || !this.checkpoints.length) return;
    const ctx = this.ctx;
    const bp = this.blockPx;
    this.checkpoints.forEach((cp, i) => {
      const last = i === this.checkpoints.length - 1;
      const s = this._worldToScreen(cp.x + 0.5, cp.y + 0.15);
      ctx.save();
      ctx.globalAlpha = last ? 0.95 : 0.45;
      // diamond checkpoint (GD-like)
      ctx.fillStyle = last ? "#6ec8ff" : "#3a7fa8";
      ctx.strokeStyle = "#e8f7ff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - bp * 0.35);
      ctx.lineTo(s.x + bp * 0.22, s.y);
      ctx.lineTo(s.x, s.y + bp * 0.35);
      ctx.lineTo(s.x - bp * 0.22, s.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  _drawBlock(o, level) {
    const ctx = this.ctx;
    const bp = this.blockPx;
    const p = this._worldToScreen(o.x, o.y + o.h);
    const x = p.x;
    const y = p.y;
    const w = o.w * bp;
    const h = o.h * bp;

    const g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, "#6a4a30");
    g.addColorStop(1, "#3a2818");
    ctx.fillStyle = g;
    ctx.strokeStyle = level.theme.accent;
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, y, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fillRect(x + 4, y + 4, w - 8, h * 0.25);
  }

  _drawSpike(o, down, level) {
    const ctx = this.ctx;
    const bp = this.blockPx;
    const base = this._worldToScreen(o.x, o.y);
    const top = this._worldToScreen(o.x + 0.5, o.y + 1);

    ctx.beginPath();
    if (!down) {
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(base.x + bp, base.y);
      ctx.lineTo(top.x, top.y);
    } else {
      const tip = this._worldToScreen(o.x + 0.5, o.y);
      const left = this._worldToScreen(o.x, o.y + 1);
      const right = this._worldToScreen(o.x + 1, o.y + 1);
      ctx.moveTo(left.x, left.y);
      ctx.lineTo(right.x, right.y);
      ctx.lineTo(tip.x, tip.y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(base.x, base.y - bp, base.x, base.y);
    g.addColorStop(0, "#e8e8e8");
    g.addColorStop(1, "#8a8a8a");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // tint tip
    ctx.fillStyle = level.theme.accent + "55";
    ctx.fill();
  }

  _drawSaw(o, level) {
    const ctx = this.ctx;
    const bp = this.blockPx;
    const c = this._worldToScreen(o.x, o.y);
    const r = o.r * bp;
    const rot = this.animT * 6;

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(rot);

    const teeth = 12;
    ctx.fillStyle = "#c0c4c8";
    ctx.beginPath();
    for (let i = 0; i < teeth; i++) {
      const a0 = (i / teeth) * Math.PI * 2;
      const a1 = ((i + 0.5) / teeth) * Math.PI * 2;
      const a2 = ((i + 1) / teeth) * Math.PI * 2;
      if (i === 0) ctx.moveTo(Math.cos(a0) * r * 0.7, Math.sin(a0) * r * 0.7);
      ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
      ctx.lineTo(Math.cos(a2) * r * 0.7, Math.sin(a2) * r * 0.7);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = level.theme.accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = "#222";
    ctx.fill();
    ctx.restore();
  }

  _drawPad(o) {
    const ctx = this.ctx;
    const bp = this.blockPx;
    const p = this._worldToScreen(o.x, o.y + 0.2);
    const pulse = 0.7 + Math.sin(this.animT * 8) * 0.3;
    ctx.fillStyle = `rgba(245, 215, 110, ${pulse})`;
    roundRectPath(ctx, p.x + 4, p.y, bp - 8, 0.25 * bp, 4);
    ctx.fill();
    ctx.strokeStyle = "#fff3a0";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  _drawPlayer() {
    const p = this.player;
    const bp = this.blockPx;
    const screen = this._worldToScreen(p.x + p.w / 2, p.y + p.h / 2);

    drawSkin(this._skinCtx, this.skin, 128, (this.animT % 1));

    ctxSaveRotate(this.ctx, screen.x, screen.y, (p.rotation * Math.PI) / 180);
    this.ctx.drawImage(this._skinCanvas, -bp / 2, -bp / 2, bp, bp);
    this.ctx.restore();

    // Ground shadow
    if (p.grounded) {
      this.ctx.fillStyle = "rgba(0,0,0,0.25)";
      this.ctx.beginPath();
      const g = this._worldToScreen(p.x + 0.5, 0);
      this.ctx.ellipse(g.x, g.y + 2, bp * 0.35, bp * 0.1, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  _drawParticles() {
    const ctx = this.ctx;
    for (const p of this.particles) {
      const s = this._worldToScreen(p.x, p.y);
      const a = Math.max(0, p.life / p.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(s.x, s.y, p.size * this.blockPx, p.size * this.blockPx);
    }
    ctx.globalAlpha = 1;
  }

  _drawFinish(level) {
    const x = level.length;
    const ctx = this.ctx;
    const bp = this.blockPx;
    const top = this._worldToScreen(x, 6);
    const bot = this._worldToScreen(x, 0);
    const stripeW = bp * 0.7;

    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#f5f5f5" : "#222";
      const y1 = bot.y - (i + 1) * bp * 0.75;
      ctx.fillRect(bot.x, y1, stripeW, bp * 0.75);
    }

    ctx.fillStyle = level.theme.accent;
    ctx.font = `800 ${Math.floor(bp * 0.35)}px Nunito, sans-serif`;
    ctx.fillText("ФИНИШ", top.x - bp * 0.2, top.y);
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this._onResize);
  }
}

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function ctxSaveRotate(ctx, x, y, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
}
