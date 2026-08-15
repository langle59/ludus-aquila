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
  | "missio";

class AudioSystem {
  private ctx: AudioContext | null = null;
  private musicTimer: number | null = null;
  private musicOn = false;
  private stepCooldown = 0;

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

  sfx(name: SfxName): void {
    const ctx = this.ensure();
    if (!ctx) return;
    const vol = gameState.settings.sfxVolume;
    if (vol <= 0.01) return;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);

    const blip = (type: OscillatorType, freq: number, dur: number, peak: number) => {
      o.type = type;
      o.frequency.setValueAtTime(freq, now);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(peak * vol, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      o.start(now);
      o.stop(now + dur + 0.02);
    };

    switch (name) {
      case "hit":
        blip("square", 180, 0.08, 0.12);
        break;
      case "block":
        blip("triangle", 320, 0.1, 0.1);
        break;
      case "swing":
        blip("sawtooth", 140, 0.06, 0.05);
        break;
      case "hurt":
        blip("sawtooth", 90, 0.16, 0.14);
        break;
      case "dodge":
        blip("sine", 420, 0.08, 0.07);
        break;
      case "win":
        blip("triangle", 523, 0.25, 0.12);
        break;
      case "lose":
        blip("sine", 110, 0.35, 0.1);
        break;
      case "ui":
        blip("square", 660, 0.05, 0.06);
        break;
      case "step":
        blip("sine", 70, 0.04, 0.03);
        break;
      case "special":
        blip("square", 240, 0.14, 0.12);
        break;
      case "crowd":
        blip("sawtooth", 200, 0.2, 0.04);
        break;
      case "missio":
        blip("triangle", 392, 0.32, 0.11);
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

  startMusic(): void {
    if (this.musicOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    this.musicOn = true;
    const notes = [196, 233, 262, 196, 175, 196, 233, 294];
    let i = 0;
    const tick = () => {
      if (!this.musicOn || !this.ctx) return;
      const vol = gameState.settings.musicVolume;
      if (vol > 0.01 && !gameState.settings.musicMuted) {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = "triangle";
        o.frequency.value = notes[i % notes.length];
        g.gain.value = 0.04 * vol;
        o.connect(g);
        g.connect(this.ctx.destination);
        o.start();
        o.stop(this.ctx.currentTime + 0.35);
      }
      i += 1;
      this.musicTimer = window.setTimeout(tick, 420);
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
