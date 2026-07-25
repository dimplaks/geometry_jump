/**
 * Procedural PVZ-inspired music (original tunes, Web Audio).
 * Quirky lawn / cartoon energy — not the official soundtrack.
 */

const MUTE_KEY = "geometry-jump-music-muted";

const NOTE = {
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.0, A2: 110.0, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.0, A3: 220.0, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.0, A4: 440.0, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.0,
};

/** @param {number[]} semis semitone offsets from root */
function scaleNotes(rootHz, semis) {
  return semis.map((s) => rootHz * Math.pow(2, s / 12));
}

/**
 * Track recipes: jaunty / spooky / frantic PVZ vibes.
 * Patterns are step arrays (16 or 32 steps). null = rest.
 * melody/bass values are scale degree indices (0..) or -1 rest.
 */
export const TRACKS = {
  menu: {
    name: "Лобби газона",
    bpm: 96,
    swing: 0.08,
    root: NOTE.G3,
    scale: [0, 2, 3, 5, 7, 8, 10, 12], // G minor-ish
    melody: [4, -1, 5, -1, 7, 5, 4, -1, 3, -1, 4, 2, 0, -1, 2, 4, 5, -1, 7, 5, 4, 3, 2, -1, 0, 2, 3, 4, 5, -1, 4, -1],
    bass: [0, -1, -1, 0, 3, -1, -1, 3, 0, -1, -1, 0, 5, -1, 3, -1],
    hats: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    leadWave: "triangle",
    bassWave: "square",
    filter: 1800,
    gain: 0.22,
  },
  1: {
    name: "Утренний газон",
    bpm: 112,
    swing: 0.12,
    root: NOTE.C4,
    scale: [0, 2, 4, 5, 7, 9, 11, 12], // major — Grasswalk energy
    melody: [0, 2, 4, 5, 4, 2, 0, -1, 4, 5, 7, 5, 4, 2, 0, -1, 2, 4, 5, 7, 9, 7, 5, 4, 0, 2, 4, -1, 5, 4, 2, 0],
    bass: [0, -1, 0, -1, 4, -1, 4, -1, 5, -1, 5, -1, 4, -1, 2, -1],
    hats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    kick: [1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1],
    leadWave: "square",
    bassWave: "triangle",
    filter: 2200,
    gain: 0.24,
  },
  2: {
    name: "Гороховый марш",
    bpm: 118,
    swing: 0.1,
    root: NOTE.G3,
    scale: [0, 2, 3, 5, 7, 8, 10, 12],
    melody: [7, 5, 4, 5, 7, -1, 5, 4, 2, 4, 5, -1, 4, 2, 0, -1, 5, 7, 8, 7, 5, 4, 5, -1, 7, 5, 4, 2, 0, 2, 4, -1],
    bass: [0, -1, -1, 0, 3, -1, 0, -1, 5, -1, -1, 5, 3, -1, 0, -1],
    hats: [1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1],
    kick: [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1],
    snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
    leadWave: "square",
    bassWave: "sawtooth",
    filter: 2000,
    gain: 0.23,
  },
  3: {
    name: "Ореховый вальс",
    bpm: 108,
    swing: 0.16,
    root: NOTE.F3,
    scale: [0, 2, 3, 5, 7, 9, 10, 12],
    melody: [4, -1, 5, 7, -1, 5, 4, 2, 0, -1, 2, 4, 5, -1, 4, -1, 7, 5, 4, 5, 7, 9, 7, 5, 4, 2, 0, 2, 4, -1, 0, -1],
    bass: [0, -1, -1, -1, 5, -1, -1, -1, 3, -1, -1, -1, 4, -1, 5, -1],
    hats: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0],
    kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    leadWave: "triangle",
    bassWave: "triangle",
    filter: 1600,
    gain: 0.22,
  },
  4: {
    name: "Зомби на дорожке",
    bpm: 122,
    swing: 0.06,
    root: NOTE.D3,
    scale: [0, 1, 3, 5, 7, 8, 10, 12], // phrygy / spooky
    melody: [0, 1, 3, -1, 5, 3, 1, 0, 7, -1, 5, 3, 1, 3, 0, -1, 3, 5, 7, 8, 7, 5, 3, -1, 1, 0, 1, 3, 5, -1, 0, -1],
    bass: [0, -1, 0, 0, 3, -1, 3, -1, 5, -1, 5, 3, 0, -1, 1, -1],
    hats: [1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1, 1],
    kick: [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
    leadWave: "sawtooth",
    bassWave: "square",
    filter: 1400,
    gain: 0.23,
  },
  5: {
    name: "Кактусовый ритм",
    bpm: 126,
    swing: 0.05,
    root: NOTE.A3,
    scale: [0, 2, 4, 5, 7, 9, 10, 12],
    melody: [4, 4, 5, 7, 5, 4, 2, 0, 7, 5, 4, 5, 4, 2, 0, -1, 9, 7, 5, 7, 5, 4, 2, 4, 0, 2, 4, 5, 7, -1, 4, -1],
    bass: [0, -1, 4, -1, 5, -1, 4, -1, 0, -1, 2, -1, 5, 4, 0, -1],
    hats: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 1, 0, 0, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0],
    leadWave: "square",
    bassWave: "triangle",
    filter: 2400,
    gain: 0.24,
  },
  6: {
    name: "Снежный вальс мозгов",
    bpm: 100,
    swing: 0.14,
    root: NOTE.E3,
    scale: [0, 2, 3, 5, 7, 8, 10, 12],
    melody: [7, -1, 5, -1, 3, 5, 7, 8, 7, 5, 3, -1, 2, 0, 2, 3, 5, -1, 7, 5, 3, 2, 0, -1, 3, 5, 7, -1, 5, 3, 0, -1],
    bass: [0, -1, -1, 0, -1, -1, 5, -1, 3, -1, -1, 3, -1, 2, 0, -1],
    hats: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1],
    kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
    snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
    leadWave: "triangle",
    bassWave: "sine",
    filter: 1200,
    gain: 0.21,
    sparkle: true,
  },
  7: {
    name: "Вишнёвый бум",
    bpm: 132,
    swing: 0.04,
    root: NOTE.C4,
    scale: [0, 1, 4, 5, 7, 8, 11, 12],
    melody: [0, 4, 7, 4, 0, 4, 7, 12, 11, 8, 7, 5, 4, 1, 0, -1, 7, 8, 11, 8, 7, 4, 0, 4, 5, 7, 8, 7, 4, -1, 0, -1],
    bass: [0, 0, -1, 0, 5, 5, -1, 5, 4, -1, 4, -1, 0, 1, 0, -1],
    hats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    kick: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0],
    leadWave: "sawtooth",
    bassWave: "square",
    filter: 2600,
    gain: 0.25,
  },
  8: {
    name: "Ночной пожиратель",
    bpm: 116,
    swing: 0.09,
    root: NOTE.A2,
    scale: [0, 3, 5, 6, 7, 10, 12, 15],
    melody: [5, -1, 6, 7, 10, 7, 6, 5, 3, 0, 3, 5, -1, 6, 5, -1, 7, 10, 12, 10, 7, 6, 5, 3, 0, 3, 5, 6, 7, -1, 5, -1],
    bass: [0, -1, -1, 0, 3, -1, -1, 3, 5, -1, 5, 3, 0, -1, 6, -1],
    hats: [1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1, 0],
    kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 1],
    leadWave: "sawtooth",
    bassWave: "square",
    filter: 1100,
    gain: 0.22,
  },
  9: {
    name: "Халапеньо-диско",
    bpm: 138,
    swing: 0.03,
    root: NOTE.E4,
    scale: [0, 2, 4, 5, 7, 9, 11, 12],
    melody: [0, 2, 4, 5, 7, 5, 4, 2, 7, 9, 7, 5, 4, 2, 0, -1, 4, 5, 7, 9, 11, 9, 7, 5, 4, 2, 0, 2, 4, -1, 0, 7],
    bass: [0, -1, 0, 4, 5, -1, 5, 4, 0, -1, 2, 0, 5, 4, 0, -1],
    hats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    kick: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1],
    snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
    leadWave: "square",
    bassWave: "sawtooth",
    filter: 2800,
    gain: 0.25,
  },
  10: {
    name: "Финальная волна",
    bpm: 144,
    swing: 0.02,
    root: NOTE.G3,
    scale: [0, 2, 3, 5, 7, 8, 10, 12, 14, 15],
    melody: [7, 8, 10, 12, 10, 8, 7, 5, 3, 5, 7, 8, 10, -1, 7, -1, 12, 10, 8, 10, 12, 14, 12, 10, 8, 7, 5, 7, 8, 10, 7, 0],
    bass: [0, 0, 3, 0, 5, 5, 3, 5, 0, 2, 3, 0, 7, 5, 3, 0],
    hats: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    kick: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0],
    snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1],
    leadWave: "sawtooth",
    bassWave: "square",
    filter: 3000,
    gain: 0.26,
    fanfare: true,
  },
};

const CUSTOM_TRACKS = [2, 3, 5, 7, 9];

class MusicPlayer {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.filter = null;
    this.muted = localStorage.getItem(MUTE_KEY) === "1";
    this.playing = false;
    this.paused = false;
    this.trackId = null;
    this.track = null;
    this.timer = null;
    this.step = 0;
    this.nextNoteTime = 0;
    this.scheduleAhead = 0.12;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) fn(this.getState());
  }

  getState() {
    return {
      muted: this.muted,
      playing: this.playing && !this.paused,
      trackId: this.trackId,
      trackName: this.track?.name || "",
    };
  }

  async ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = "lowpass";
      this.filter.frequency.value = 2000;
      this.filter.connect(this.master);
      this.master.connect(this.ctx.destination);
      this.master.gain.value = this.muted ? 0 : 0.7;
    }
    if (this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  setMuted(muted) {
    this.muted = muted;
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    if (this.master) {
      const g = this.master.gain;
      const now = this.ctx.currentTime;
      g.cancelScheduledValues(now);
      g.setTargetAtTime(muted ? 0 : 0.7, now, 0.04);
    }
    this._emit();
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }

  async playTrack(trackId) {
    await this.ensure();
    const track = TRACKS[trackId] || TRACKS[1];
    if (this.playing && this.trackId === trackId && !this.paused) return;

    this.stopScheduler();
    this.trackId = trackId;
    this.track = track;
    this.step = 0;
    this.paused = false;
    this.playing = true;
    this.filter.frequency.setTargetAtTime(track.filter || 2000, this.ctx.currentTime, 0.05);
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduler();
    this._emit();
  }

  async playForLevel(level, campaignIndex = null) {
    let id;
    if (level?.custom) {
      id = CUSTOM_TRACKS[Math.abs(hashStr(level.id || level.name)) % CUSTOM_TRACKS.length];
    } else if (campaignIndex != null) {
      id = campaignIndex + 1;
    } else if (level?.id && TRACKS[level.id]) {
      id = level.id;
    } else {
      id = 1;
    }
    await this.playTrack(id);
  }

  async playMenu() {
    await this.playTrack("menu");
  }

  pause() {
    if (!this.playing || this.paused) return;
    this.paused = true;
    this.stopScheduler();
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
    }
    this._emit();
  }

  async resume() {
    if (!this.playing || !this.paused || !this.track) return;
    await this.ensure();
    this.paused = false;
    if (this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.04);
    }
    this.nextNoteTime = this.ctx.currentTime + 0.05;
    this.scheduler();
    this._emit();
  }

  stop() {
    this.stopScheduler();
    this.playing = false;
    this.paused = false;
    this.trackId = null;
    this.track = null;
    this._emit();
  }

  stopScheduler() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  scheduler() {
    if (!this.playing || this.paused || !this.track) return;
    const track = this.track;
    const stepDur = 60 / track.bpm / 4;

    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAhead) {
      this.scheduleStep(this.step, this.nextNoteTime);
      const isOff = this.step % 2 === 1;
      const dur = isOff
        ? stepDur * (1 - (track.swing || 0))
        : stepDur * (1 + (track.swing || 0));
      this.nextNoteTime += dur;
      this.step++;
    }
    this.timer = setTimeout(() => this.scheduler(), 25);
  }

  scheduleStep(step, time) {
    const t = this.track;
    const melLen = t.melody.length;
    const bassLen = t.bass.length;
    const hatLen = t.hats.length;
    const iMel = step % melLen;
    const iBass = step % bassLen;
    const iHat = step % hatLen;
    const iKick = step % t.kick.length;
    const iSnare = step % t.snare.length;

    const scaleHz = scaleNotes(t.root, t.scale);
    const melDeg = t.melody[iMel];
    if (melDeg >= 0) {
      const hz = scaleHz[melDeg % scaleHz.length] * (melDeg >= scaleHz.length ? 2 : 1);
      this.playTone(hz, time, 0.14, t.leadWave, (t.gain || 0.22) * 0.55, true);
    }

    const bassDeg = t.bass[iBass];
    if (bassDeg >= 0) {
      const hz = scaleHz[bassDeg % scaleHz.length] / 2;
      this.playTone(hz, time, 0.18, t.bassWave, (t.gain || 0.22) * 0.5, false);
    }

    if (t.hats[iHat]) this.playHat(time, 0.04);
    if (t.kick[iKick]) this.playKick(time);
    if (t.snare[iSnare]) this.playSnare(time);

    if (t.sparkle && step % 16 === 12) {
      this.playTone(scaleHz[7] * 2, time, 0.2, "sine", 0.08, true);
    }
    if (t.fanfare && step % 32 === 0) {
      this.playTone(scaleHz[4] * 2, time, 0.25, "square", 0.1, true);
      this.playTone(scaleHz[7] * 2, time + 0.08, 0.25, "square", 0.08, true);
    }
  }

  playTone(freq, time, dur, type, gain, plucky) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type || "square";
    osc.frequency.setValueAtTime(freq, time);
    if (plucky) {
      osc.frequency.exponentialRampToValueAtTime(freq * 0.98, time + dur);
    }
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(Math.max(0.001, gain), time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(g);
    g.connect(this.filter);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  playKick(time) {
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12);
    g.gain.setValueAtTime(0.35, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.15);
    osc.connect(g);
    g.connect(this.master);
    osc.start(time);
    osc.stop(time + 0.16);
  }

  playSnare(time) {
    const dur = 0.1;
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const bp = this.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.18, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    noise.connect(bp);
    bp.connect(g);
    g.connect(this.master);
    noise.start(time);
    noise.stop(time + dur);
  }

  playHat(time, dur) {
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const hp = this.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 7000;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.05, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    noise.connect(hp);
    hp.connect(g);
    g.connect(this.master);
    noise.start(time);
    noise.stop(time + dur);
  }

  /** Short victory sting */
  async playVictory() {
    await this.ensure();
    const now = this.ctx.currentTime;
    const notes = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C5 * 2];
    notes.forEach((hz, i) => {
      this.playTone(hz, now + i * 0.1, 0.28, "square", 0.12, true);
    });
  }
}

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

export const music = new MusicPlayer();

export function trackNameForLevelId(id) {
  return TRACKS[id]?.name || "";
}
