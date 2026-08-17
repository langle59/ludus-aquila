import { gameState } from "../state/GameState";

type SfxName =
  | "hit"
  | "block"
  | "swing"
  | "hurt"
  | "dodge"
  | "win"
  | "lose"
  | "ui"
  | "step"
  | "special"
  | "crowd"
  | "missio"
  | "dice"
  | "card";

export type RoarSize = "chip" | "hit" | "big";

class AudioSystem {
  private ctx: AudioContext | null = null;
  private musicTimer: number | null = null;
  private musicOn = false;
  private musicMood: "yard" | "arena" | "night" = "yard";
  private stepCooldown = 0;
  private hallOn = false;
  private hallSource: AudioBufferSourceNode | null = null;
  private hallGain: GainNode | null = null;
  private hallNoise: AudioBuffer | null = null;
  private steelBuf: AudioBuffer | null = null;
  private crowdBuf: AudioBuffer | null = null;
  private crowdOn = false;
  private crowdSource: AudioBufferSourceNode | null = null;
  private crowdGain: GainNode | null = null;
  private lastRoar = 0;

  private ensure(): AudioContext | null {
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.ctx) this.ctx = new AC();
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private vol(): number {
    return gameState.settings.sfxVolume;
  }

  private tone(
    ctx: AudioContext,
    type: OscillatorType,
    freq: number,
    dur: number,
    peak: number,
    when = 0,
    freqEnd?: number,
  ): void {
    const vol = this.vol();
    if (vol <= 0.01) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.connect(g);
    g.connect(ctx.destination);
    const t = ctx.currentTime + when;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd != null) o.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  private makeNoise(ctx: AudioContext, seconds: number, kind: "white" | "crowd"): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let brown = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === "white") {
        data[i] = white;
      } else {
        brown = (brown + 0.02 * white) / 1.02;
        data[i] = white * 0.45 + brown * 1.8;
      }
    }
    return buf;
  }

  private steelNoise(ctx: AudioContext): AudioBuffer {
    if (!this.steelBuf) this.steelBuf = this.makeNoise(ctx, 0.5, "white");
    return this.steelBuf;
  }

  private crowdNoise(ctx: AudioContext): AudioBuffer {
    if (!this.crowdBuf) this.crowdBuf = this.makeNoise(ctx, 2, "crowd");
    return this.crowdBuf;
  }

  private noiseBurst(
    ctx: AudioContext,
    buf: AudioBuffer,
    dur: number,
    peak: number,
    type: BiquadFilterType,
    freq: number,
    when = 0,
    q = 1,
  ): void {
    const vol = this.vol();
    if (vol <= 0.01) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime + when;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * vol), t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  private clang(kind: "hit" | "block"): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const buf = this.steelNoise(ctx);
    if (kind === "block") {
      this.noiseBurst(ctx, buf, 0.07, 0.22, "highpass", 1600, 0, 0.8);
      this.noiseBurst(ctx, buf, 0.05, 0.12, "highpass", 2400, 0.018, 0.9);
      this.tone(ctx, "triangle", 1680, 0.18, 0.09, 0, 320);
      this.tone(ctx, "sine", 2480, 0.1, 0.045, 0.01, 520);
      this.tone(ctx, "sine", 110, 0.08, 0.06);
    } else {
      this.noiseBurst(ctx, buf, 0.08, 0.26, "highpass", 900, 0, 0.7);
      this.noiseBurst(ctx, buf, 0.05, 0.1, "bandpass", 1800, 0.01, 1.2);
      this.tone(ctx, "triangle", 980, 0.2, 0.1, 0, 210);
      this.tone(ctx, "sine", 1540, 0.12, 0.04, 0.008, 380);
      this.tone(ctx, "sine", 80, 0.1, 0.09);
    }
  }

  roar(size: RoarSize = "hit"): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const vol = this.vol();
    if (vol <= 0.01) return;
    const now = performance.now();
    const wait = size === "big" ? 420 : size === "hit" ? 260 : 140;
    if (now - this.lastRoar < wait) return;
    this.lastRoar = now;
    const buf = this.crowdNoise(ctx);
    const dur = size === "big" ? 0.9 : size === "hit" ? 0.48 : 0.26;
    const peak = size === "big" ? 0.16 : size === "hit" ? 0.09 : 0.045;
    const freq = size === "big" ? 620 : size === "hit" ? 780 : 900;
    this.noiseBurst(ctx, buf, dur, peak, "bandpass", freq, 0, 0.7);
    this.noiseBurst(ctx, buf, dur * 0.85, peak * 0.65, "bandpass", freq * 1.35, 0.04, 0.85);
    if (size !== "chip") this.noiseBurst(ctx, buf, dur * 0.5, peak * 0.4, "lowpass", 340, 0.02, 0.5);
  }

  sfx(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const vol = this.vol();
    if (vol <= 0.01) return;

    switch (name) {
      case "hit":
        this.clang("hit");
        break;
      case "block":
        this.clang("block");
        break;
      case "swing":
        this.noiseBurst(ctx, this.steelNoise(ctx), 0.09, 0.035, "highpass", 700, 0, 0.6);
        this.tone(ctx, "sine", 220, 0.07, 0.02, 0, 90);
        break;
      case "hurt":
        this.noiseBurst(ctx, this.crowdNoise(ctx), 0.12, 0.08, "lowpass", 280);
        this.tone(ctx, "sine", 70, 0.14, 0.07, 0, 50);
        break;
      case "dodge":
        this.noiseBurst(ctx, this.steelNoise(ctx), 0.08, 0.03, "highpass", 1200);
        this.tone(ctx, "sine", 380, 0.07, 0.03, 0, 160);
        break;
      case "win":
        this.roar("big");
        this.tone(ctx, "triangle", 392, 0.22, 0.05, 0.05);
        this.tone(ctx, "triangle", 523, 0.28, 0.06, 0.12);
        break;
      case "lose":
        this.roar("hit");
        this.tone(ctx, "sine", 98, 0.32, 0.07, 0, 70);
        break;
      case "ui":
        this.tone(ctx, "square", 660, 0.05, 0.06);
        break;
      case "step":
        this.noiseBurst(ctx, this.crowdNoise(ctx), 0.04, 0.025, "lowpass", 180);
        break;
      case "special":
        this.noiseBurst(ctx, this.steelNoise(ctx), 0.14, 0.08, "highpass", 500);
        this.tone(ctx, "sawtooth", 180, 0.12, 0.04, 0, 70);
        break;
      case "crowd":
        this.roar("hit");
        break;
      case "missio":
        this.roar("big");
        this.tone(ctx, "triangle", 330, 0.28, 0.07);
        this.tone(ctx, "triangle", 392, 0.32, 0.06, 0.08);
        break;
      case "dice":
        this.tone(ctx, "triangle", 180, 0.08, 0.07);
        for (let i = 0; i < 7; i++) {
          const f = 420 + Math.random() * 900;
          this.tone(ctx, "square", f, 0.045, 0.035 + Math.random() * 0.03, 0.04 + i * 0.07, f * 0.55);
        }
        this.tone(ctx, "sine", 90, 0.12, 0.05, 0.42);
        break;
      case "card":
        this.tone(ctx, "square", 210, 0.045, 0.07);
        this.tone(ctx, "triangle", 140, 0.07, 0.05, 0.01, 90);
        break;
    }
  }

  footstep(delta: number, moving: boolean): void {
    if (!moving) return;
    this.stepCooldown -= delta;
    if (this.stepCooldown <= 0) {
      this.sfx("step");
      this.stepCooldown = 280;
    }
  }

  setHall(on: boolean): void {
    if (on) this.startHall();
    else this.stopHall();
  }

  setCrowd(on: boolean): void {
    if (on) this.startCrowd();
    else this.stopCrowd();
  }

  private noiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.hallNoise) return this.hallNoise;
    this.hallNoise = this.makeNoise(ctx, 2, "crowd");
    return this.hallNoise;
  }

  private startHall(): void {
    if (this.hallOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const vol = this.vol();
    if (vol <= 0.01) return;
    this.hallOn = true;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 280;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
    g.gain.exponentialRampToValueAtTime(0.028 * vol, ctx.currentTime + 0.4);
    this.hallSource = src;
    this.hallGain = g;
  }

  private stopHall(): void {
    if (!this.hallOn) return;
    this.hallOn = false;
    this.fadeStop(this.hallGain, this.hallSource);
    this.hallGain = null;
    this.hallSource = null;
  }

  private startCrowd(): void {
    if (this.crowdOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const vol = this.vol();
    if (vol <= 0.01) return;
    this.crowdOn = true;
    const src = ctx.createBufferSource();
    src.buffer = this.crowdNoise(ctx);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 720;
    filter.Q.value = 0.65;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start();
    g.gain.exponentialRampToValueAtTime(0.05 * vol, ctx.currentTime + 0.6);
    this.crowdSource = src;
    this.crowdGain = g;
  }

  private stopCrowd(): void {
    if (!this.crowdOn) return;
    this.crowdOn = false;
    this.fadeStop(this.crowdGain, this.crowdSource);
    this.crowdGain = null;
    this.crowdSource = null;
  }

  private fadeStop(g: GainNode | null, src: AudioBufferSourceNode | null): void {
    const ctx = this.ctx;
    if (ctx && g) {
      try {
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
      } catch {
        /* ignore */
      }
    }
    window.setTimeout(() => {
      try {
        src?.stop();
      } catch {
        /* ignore */
      }
    }, 300);
  }

  setMusicMood(mood: "yard" | "arena" | "night"): void {
    this.musicMood = mood;
  }

  startMusic(): void {
    if (this.musicOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    this.musicOn = true;
    const yardNotes = [175, 196, 220, 196, 165, 175, 196, 220];
    const arenaNotes = [196, 262, 330, 392, 330, 262, 196, 294];
    const nightNotes = [110, 130, 146, 130, 98, 110, 123, 146];
    let i = 0;
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      const vol = gameState.settings.musicVolume;
      const arena = this.musicMood === "arena";
      const night = this.musicMood === "night";
      if (vol > 0.01 && !gameState.settings.musicMuted) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = arena ? "square" : night ? "sine" : "triangle";
        const notes = arena ? arenaNotes : night ? nightNotes : yardNotes;
        o.frequency.value = notes[i % notes.length];
        g.gain.value = (arena ? 0.038 : night ? 0.016 : 0.022) * vol;
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + (arena ? 0.26 : night ? 0.7 : 0.5));
      }
      i += 1;
      this.musicTimer = window.setTimeout(tick, arena ? 300 : night ? 720 : 560);
    };
    tick();
  }

  stopMusic(): void {
    this.musicOn = false;
    if (this.musicTimer) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }

  toggleMusicMute(): boolean {
    gameState.settings.musicMuted = !gameState.settings.musicMuted;
    gameState.persistSettings();
    return gameState.settings.musicMuted;
  }

  musicMuteLabel(): string {
    return gameState.settings.musicMuted ? "Unmute music" : "Mute music";
  }
}

export const audio = new AudioSystem();
