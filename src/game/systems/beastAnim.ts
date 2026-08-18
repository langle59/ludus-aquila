import Phaser from "phaser";
import type { BeastKind } from "../types";

export type BeastAnimClip = "idle" | "walk" | "telegraph" | "lunge" | "death";

export type BeastSheetClipDef = {
  frames: number;
  fps: number;
  repeat: number;
};

export type BeastAnimDef = {
  originX: number;
  originY: number;
  frameH: number;
  clips: Record<BeastAnimClip, BeastSheetClipDef>;
};

/** Beasts with sprite-sheet animation enabled (one at a time rollout). */
export const BEAST_ANIMATED_KINDS: BeastKind[] = [
  "wolf",
  "serpent",
  "eagle",
  "lion",
  "bull",
  "elephant",
  "boar",
  "tiger",
  "bear",
  "rhino",
];

export const BEAST_ANIM_ORDER: BeastKind[] = [
  "wolf",
  "serpent",
  "eagle",
  "lion",
  "bull",
  "boar",
  "tiger",
  "bear",
  "rhino",
  "elephant",
];

export const BEAST_ANIM_CONFIG: Partial<Record<BeastKind, BeastAnimDef>> = {
  wolf: {
    originX: 0.5,
    originY: 0.88,
    frameH: 56,
    clips: {
      idle: { frames: 4, fps: 6, repeat: -1 },
      walk: { frames: 6, fps: 8, repeat: -1 },
      telegraph: { frames: 3, fps: 6, repeat: 0 },
      lunge: { frames: 4, fps: 14, repeat: 0 },
      death: { frames: 3, fps: 6, repeat: 0 },
    },
  },
  serpent: {
    originX: 0.5,
    originY: 0.72,
    frameH: 32,
    clips: {
      idle: { frames: 4, fps: 5, repeat: -1 },
      walk: { frames: 6, fps: 7, repeat: -1 },
      telegraph: { frames: 3, fps: 5, repeat: 0 },
      lunge: { frames: 4, fps: 12, repeat: 0 },
      death: { frames: 3, fps: 5, repeat: 0 },
    },
  },
  eagle: {
    originX: 0.5,
    originY: 0.55,
    frameH: 40,
    clips: {
      idle: { frames: 4, fps: 6, repeat: -1 },
      walk: { frames: 6, fps: 9, repeat: -1 },
      telegraph: { frames: 3, fps: 6, repeat: 0 },
      lunge: { frames: 4, fps: 14, repeat: 0 },
      death: { frames: 3, fps: 6, repeat: 0 },
    },
  },
  lion: {
    originX: 0.5,
    originY: 0.88,
    frameH: 56,
    clips: {
      idle: { frames: 4, fps: 6, repeat: -1 },
      walk: { frames: 6, fps: 8, repeat: -1 },
      telegraph: { frames: 3, fps: 6, repeat: 0 },
      lunge: { frames: 4, fps: 14, repeat: 0 },
      death: { frames: 3, fps: 6, repeat: 0 },
    },
  },
  bull: {
    originX: 0.5,
    originY: 0.88,
    frameH: 58,
    clips: {
      idle: { frames: 4, fps: 5, repeat: -1 },
      walk: { frames: 6, fps: 7, repeat: -1 },
      telegraph: { frames: 3, fps: 5, repeat: 0 },
      lunge: { frames: 4, fps: 12, repeat: 0 },
      death: { frames: 3, fps: 5, repeat: 0 },
    },
  },
  elephant: {
    originX: 0.5,
    originY: 0.88,
    frameH: 72,
    clips: {
      idle: { frames: 4, fps: 4, repeat: -1 },
      walk: { frames: 6, fps: 6, repeat: -1 },
      telegraph: { frames: 3, fps: 4, repeat: 0 },
      lunge: { frames: 4, fps: 10, repeat: 0 },
      death: { frames: 3, fps: 4, repeat: 0 },
    },
  },
  boar: {
    originX: 0.5,
    originY: 0.88,
    frameH: 56,
    clips: {
      idle: { frames: 4, fps: 5, repeat: -1 },
      walk: { frames: 6, fps: 7, repeat: -1 },
      telegraph: { frames: 3, fps: 6, repeat: 0 },
      lunge: { frames: 4, fps: 14, repeat: 0 },
      death: { frames: 3, fps: 5, repeat: 0 },
    },
  },
  tiger: {
    originX: 0.5,
    originY: 0.88,
    frameH: 56,
    clips: {
      idle: { frames: 4, fps: 6, repeat: -1 },
      walk: { frames: 6, fps: 8, repeat: -1 },
      telegraph: { frames: 3, fps: 6, repeat: 0 },
      lunge: { frames: 4, fps: 14, repeat: 0 },
      death: { frames: 3, fps: 6, repeat: 0 },
    },
  },
  bear: {
    originX: 0.5,
    originY: 0.88,
    frameH: 64,
    clips: {
      idle: { frames: 4, fps: 4, repeat: -1 },
      walk: { frames: 6, fps: 6, repeat: -1 },
      telegraph: { frames: 3, fps: 5, repeat: 0 },
      lunge: { frames: 4, fps: 10, repeat: 0 },
      death: { frames: 3, fps: 5, repeat: 0 },
    },
  },
  rhino: {
    originX: 0.5,
    originY: 0.88,
    frameH: 62,
    clips: {
      idle: { frames: 4, fps: 4, repeat: -1 },
      walk: { frames: 6, fps: 6, repeat: -1 },
      telegraph: { frames: 3, fps: 5, repeat: 0 },
      lunge: { frames: 4, fps: 11, repeat: 0 },
      death: { frames: 3, fps: 5, repeat: 0 },
    },
  },
};

export function beastSheetSrcPath(kind: BeastKind, clip: BeastAnimClip): string {
  return `beasts/sheets/${kind}/${clip}.png`;
}

export function beastSheetSrcKey(kind: BeastKind, clip: BeastAnimClip): string {
  return `${kind}-sheet-${clip}-src`;
}

export function beastSheetTexKey(kind: BeastKind, clip: BeastAnimClip): string {
  return `${kind}-${clip}-sheet`;
}

export function beastAnimKey(kind: BeastKind, clip: BeastAnimClip): string {
  return `${kind}-${clip}`;
}

export function hasBeastAnims(scene: Phaser.Scene, kind: BeastKind): boolean {
  if (!BEAST_ANIMATED_KINDS.includes(kind)) return false;
  return scene.textures.exists(beastSheetTexKey(kind, "idle"));
}

export function preloadBeastSheets(scene: Phaser.Scene): void {
  for (const kind of BEAST_ANIMATED_KINDS) {
    const cfg = BEAST_ANIM_CONFIG[kind];
    if (!cfg) continue;
    for (const clip of Object.keys(cfg.clips) as BeastAnimClip[]) {
      scene.load.image(beastSheetSrcKey(kind, clip), beastSheetSrcPath(kind, clip));
    }
  }
}

function isKeyedPixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 20) return true;
  if (r > 150 && b > 150 && g < 150 && r + b > g * 2.2) return true;
  return g > 90 && g > r + 18 && g > b + 18;
}

function readSourceCanvas(scene: Phaser.Scene, key: string): { canvas: HTMLCanvasElement; w: number; h: number } | null {
  if (!scene.textures.exists(key)) return null;
  const img = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = img.width;
  const h = img.height;
  if (!w || !h) return null;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);
  return { canvas, w, h };
}

/** Chroma-key a horizontal strip and pack into a Phaser spritesheet texture. */
export function ingestBeastSheetStrip(
  scene: Phaser.Scene,
  srcKey: string,
  destSheetKey: string,
  frameCount: number,
  targetFrameH: number,
): boolean {
  const src = readSourceCanvas(scene, srcKey);
  if (!src) return false;
  const sctx = src.canvas.getContext("2d")!;
  const raw = sctx.getImageData(0, 0, src.w, src.h);
  const cellW = Math.floor(src.w / frameCount);
  if (cellW < 4) return false;

  const frameWs: number[] = [];
  const frameData: ImageData[] = [];

  for (let f = 0; f < frameCount; f++) {
    const x0 = f * cellW;
    let minX = cellW;
    let minY = src.h;
    let maxX = 0;
    let maxY = 0;
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < cellW; x++) {
        const sx = x0 + x;
        if (sx >= src.w) continue;
        const i = (y * src.w + sx) * 4;
        if (isKeyedPixel(raw.data[i], raw.data[i + 1], raw.data[i + 2], raw.data[i + 3])) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX) {
      minX = 0;
      minY = 0;
      maxX = cellW - 1;
      maxY = src.h - 1;
    }
    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const scale = targetFrameH / Math.max(1, bh);
    const fw = Math.max(1, Math.round(bw * scale));
    const out = sctx.createImageData(fw, targetFrameH);
    for (let oy = 0; oy < targetFrameH; oy++) {
      for (let ox = 0; ox < fw; ox++) {
        const sx = minX + Math.min(bw - 1, Math.floor(ox / scale));
        const sy = minY + Math.min(bh - 1, Math.floor(oy / scale));
        const si = (sy * src.w + x0 + sx) * 4;
        const di = (oy * fw + ox) * 4;
        if (isKeyedPixel(raw.data[si], raw.data[si + 1], raw.data[si + 2], raw.data[si + 3])) continue;
        out.data[di] = raw.data[si];
        out.data[di + 1] = raw.data[si + 1];
        out.data[di + 2] = raw.data[si + 2];
        out.data[di + 3] = 255;
      }
    }
    frameWs.push(fw);
    frameData.push(out);
  }

  const frameW = Math.max(...frameWs);
  const strip = document.createElement("canvas");
  strip.width = frameW * frameCount;
  strip.height = targetFrameH;
  const ctx = strip.getContext("2d")!;
  for (let f = 0; f < frameCount; f++) {
    const offX = f * frameW + Math.floor((frameW - frameWs[f]) / 2);
    const tmp = document.createElement("canvas");
    tmp.width = frameWs[f];
    tmp.height = targetFrameH;
    tmp.getContext("2d")!.putImageData(frameData[f], 0, 0);
    ctx.drawImage(tmp, offX, 0);
  }

  if (scene.textures.exists(destSheetKey)) scene.textures.remove(destSheetKey);
  scene.textures.addSpriteSheet(destSheetKey, strip as unknown as HTMLImageElement, { frameWidth: frameW, frameHeight: targetFrameH });
  scene.textures.get(destSheetKey)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return true;
}

type WobbleFn = (ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number) => void;

function pivot(ctx: CanvasRenderingContext2D, fw: number, fh: number): void {
  ctx.translate(fw / 2, fh * 0.88);
}

function unpivot(ctx: CanvasRenderingContext2D, fw: number, fh: number): void {
  ctx.translate(-fw / 2, -fh * 0.88);
}

function wobbleIdle(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const bob = Math.sin(t * Math.PI * 2) * 2;
  const breathe = 1 + Math.sin(t * Math.PI * 2) * 0.03;
  pivot(ctx, fw, fh);
  ctx.translate(0, bob);
  ctx.scale(breathe, 1 - (breathe - 1) * 0.45);
  unpivot(ctx, fw, fh);
}

function wobbleWalk(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const phase = t * Math.PI * 2;
  const bob = Math.sin(phase) * 4;
  const tilt = Math.sin(phase) * 0.05;
  const stride = 1 + Math.sin(phase) * 0.05;
  pivot(ctx, fw, fh);
  ctx.translate(0, bob);
  ctx.rotate(tilt);
  ctx.scale(stride, 1 - (stride - 1) * 0.35);
  unpivot(ctx, fw, fh);
}

function wobbleTelegraph(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  const lean = -0.06 - 0.05 * t;
  pivot(ctx, fw, fh);
  ctx.translate(0, 2 * t);
  ctx.rotate(lean);
  ctx.scale(1 - t * 0.06, 1 + t * 0.08);
  unpivot(ctx, fw, fh);
}

function wobbleLunge(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / Math.max(1, count - 1);
  pivot(ctx, fw, fh);
  ctx.translate(0, 1 - t * 3);
  ctx.rotate(0.05 + 0.08 * t);
  ctx.scale(1.04 + t * 0.12, 1 - t * 0.07);
  unpivot(ctx, fw, fh);
}

function wobbleDeath(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  pivot(ctx, fw, fh);
  ctx.rotate(0.55 * t);
  unpivot(ctx, fw, fh);
  ctx.translate(0, 8 * t);
  ctx.globalAlpha = 1 - t * 0.4;
}

function drawWalkPaws(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  if (Math.sin(t * Math.PI * 2) > 0.25) {
    ctx.fillStyle = "rgba(120, 90, 60, 0.45)";
    ctx.fillRect(fw * 0.58, fh * 0.91, 4, 2);
    ctx.fillRect(fw * 0.26, fh * 0.92, 4, 2);
  }
}

function serpentPivot(ctx: CanvasRenderingContext2D, fw: number, fh: number): void {
  ctx.translate(fw / 2, fh * 0.65);
}

function serpentUnpivot(ctx: CanvasRenderingContext2D, fw: number, fh: number): void {
  ctx.translate(-fw / 2, -fh * 0.65);
}

function serpentIdle(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const wave = Math.sin(t * Math.PI * 2);
  serpentPivot(ctx, fw, fh);
  ctx.rotate(wave * 0.04);
  ctx.translate(0, wave * 1.5);
  serpentUnpivot(ctx, fw, fh);
}

function serpentWalk(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const phase = t * Math.PI * 2;
  serpentPivot(ctx, fw, fh);
  ctx.translate(0, Math.sin(phase) * 3);
  ctx.rotate(Math.sin(phase) * 0.08);
  ctx.scale(1 + Math.sin(phase * 2) * 0.04, 1);
  serpentUnpivot(ctx, fw, fh);
}

function serpentTelegraph(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  serpentPivot(ctx, fw, fh);
  ctx.rotate(-0.1 - 0.1 * t);
  ctx.scale(1 - t * 0.04, 1 + t * 0.07);
  serpentUnpivot(ctx, fw, fh);
}

function serpentLunge(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / Math.max(1, count - 1);
  serpentPivot(ctx, fw, fh);
  ctx.rotate(0.04 + 0.06 * t);
  ctx.scale(1.05 + t * 0.16, 1 - t * 0.05);
  serpentUnpivot(ctx, fw, fh);
}

function serpentDeath(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  serpentPivot(ctx, fw, fh);
  ctx.rotate(0.35 * t);
  serpentUnpivot(ctx, fw, fh);
  ctx.translate(0, 5 * t);
  ctx.globalAlpha = 1 - t * 0.4;
}

function drawSlitherMarks(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  if (Math.sin(t * Math.PI * 2) > 0.2) {
    ctx.fillStyle = "rgba(90, 70, 45, 0.35)";
    ctx.fillRect(fw * 0.18, fh * 0.82, 6, 2);
    ctx.fillRect(fw * 0.52, fh * 0.84, 5, 2);
  }
}

const WOBBLE: Record<BeastAnimClip, WobbleFn> = {
  idle: wobbleIdle,
  walk: wobbleWalk,
  telegraph: wobbleTelegraph,
  lunge: wobbleLunge,
  death: wobbleDeath,
};

const SERPENT_WOBBLE: Record<BeastAnimClip, WobbleFn> = {
  idle: serpentIdle,
  walk: serpentWalk,
  telegraph: serpentTelegraph,
  lunge: serpentLunge,
  death: serpentDeath,
};

function eaglePivot(ctx: CanvasRenderingContext2D, fw: number, fh: number): void {
  ctx.translate(fw / 2, fh * 0.55);
}

function eagleUnpivot(ctx: CanvasRenderingContext2D, fw: number, fh: number): void {
  ctx.translate(-fw / 2, -fh * 0.55);
}

function eagleIdle(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const flap = Math.sin(t * Math.PI * 2);
  eaglePivot(ctx, fw, fh);
  ctx.translate(0, flap * 2);
  ctx.scale(1, 1 + flap * 0.06);
  ctx.rotate(flap * 0.03);
  eagleUnpivot(ctx, fw, fh);
}

function eagleWalk(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const phase = t * Math.PI * 2;
  eaglePivot(ctx, fw, fh);
  ctx.translate(0, Math.sin(phase) * 3);
  ctx.scale(1 + Math.sin(phase * 2) * 0.04, 1 + Math.sin(phase) * 0.08);
  ctx.rotate(Math.sin(phase) * 0.05);
  eagleUnpivot(ctx, fw, fh);
}

function eagleTelegraph(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  eaglePivot(ctx, fw, fh);
  ctx.translate(0, -4 * t);
  ctx.rotate(-0.08 - 0.06 * t);
  ctx.scale(1 - t * 0.05, 1 + t * 0.06);
  eagleUnpivot(ctx, fw, fh);
}

function eagleLunge(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / Math.max(1, count - 1);
  eaglePivot(ctx, fw, fh);
  ctx.translate(0, 2 + t * 4);
  ctx.rotate(0.1 + 0.12 * t);
  ctx.scale(1.08 + t * 0.12, 1 - t * 0.1);
  eagleUnpivot(ctx, fw, fh);
}

function eagleDeath(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  eaglePivot(ctx, fw, fh);
  ctx.rotate(0.4 * t);
  eagleUnpivot(ctx, fw, fh);
  ctx.translate(0, 6 * t);
  ctx.globalAlpha = 1 - t * 0.4;
}

const EAGLE_WOBBLE: Record<BeastAnimClip, WobbleFn> = {
  idle: eagleIdle,
  walk: eagleWalk,
  telegraph: eagleTelegraph,
  lunge: eagleLunge,
  death: eagleDeath,
};

function bullIdle(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const bob = Math.sin(t * Math.PI * 2) * 1.5;
  const breathe = 1 + Math.sin(t * Math.PI * 2) * 0.04;
  pivot(ctx, fw, fh);
  ctx.translate(0, bob);
  ctx.scale(breathe, 1 - (breathe - 1) * 0.35);
  unpivot(ctx, fw, fh);
}

function bullWalk(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const phase = t * Math.PI * 2;
  const bob = Math.sin(phase) * 5;
  const stride = 1 + Math.sin(phase) * 0.06;
  pivot(ctx, fw, fh);
  ctx.translate(0, bob);
  ctx.scale(stride, 1 - (stride - 1) * 0.3);
  unpivot(ctx, fw, fh);
}

function bullTelegraph(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  pivot(ctx, fw, fh);
  ctx.translate(0, 3 * t);
  ctx.rotate(-0.08 - 0.06 * t);
  ctx.scale(1 - t * 0.08, 1 + t * 0.1);
  unpivot(ctx, fw, fh);
}

function bullLunge(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / Math.max(1, count - 1);
  pivot(ctx, fw, fh);
  ctx.translate(0, 2 - t * 2);
  ctx.rotate(0.03 + 0.05 * t);
  ctx.scale(1.06 + t * 0.14, 1 - t * 0.05);
  unpivot(ctx, fw, fh);
}

function bullDeath(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  pivot(ctx, fw, fh);
  ctx.rotate(0.5 * t);
  unpivot(ctx, fw, fh);
  ctx.translate(0, 10 * t);
  ctx.globalAlpha = 1 - t * 0.4;
}

const BULL_WOBBLE: Record<BeastAnimClip, WobbleFn> = {
  idle: bullIdle,
  walk: bullWalk,
  telegraph: bullTelegraph,
  lunge: bullLunge,
  death: bullDeath,
};

function elephantIdle(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const bob = Math.sin(t * Math.PI * 2) * 1.2;
  const breathe = 1 + Math.sin(t * Math.PI * 2) * 0.035;
  pivot(ctx, fw, fh);
  ctx.translate(0, bob);
  ctx.scale(breathe, 1 - (breathe - 1) * 0.3);
  unpivot(ctx, fw, fh);
}

function elephantWalk(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / count;
  const phase = t * Math.PI * 2;
  const bob = Math.sin(phase) * 6;
  const stride = 1 + Math.sin(phase) * 0.05;
  pivot(ctx, fw, fh);
  ctx.translate(0, bob);
  ctx.scale(stride, 1 - (stride - 1) * 0.25);
  unpivot(ctx, fw, fh);
}

function elephantTelegraph(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  pivot(ctx, fw, fh);
  ctx.translate(0, 4 * t);
  ctx.rotate(-0.06 - 0.05 * t);
  ctx.scale(1 - t * 0.06, 1 + t * 0.12);
  unpivot(ctx, fw, fh);
}

function elephantLunge(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = f / Math.max(1, count - 1);
  pivot(ctx, fw, fh);
  ctx.translate(0, 3 - t * 3);
  ctx.rotate(0.02 + 0.04 * t);
  ctx.scale(1.04 + t * 0.12, 1 - t * 0.04);
  unpivot(ctx, fw, fh);
}

function elephantDeath(ctx: CanvasRenderingContext2D, f: number, count: number, fw: number, fh: number): void {
  const t = (f + 1) / count;
  pivot(ctx, fw, fh);
  ctx.rotate(0.45 * t);
  unpivot(ctx, fw, fh);
  ctx.translate(0, 12 * t);
  ctx.globalAlpha = 1 - t * 0.4;
}

const ELEPHANT_WOBBLE: Record<BeastAnimClip, WobbleFn> = {
  idle: elephantIdle,
  walk: elephantWalk,
  telegraph: elephantTelegraph,
  lunge: elephantLunge,
  death: elephantDeath,
};

function wobbleFor(kind: BeastKind, clip: BeastAnimClip): WobbleFn {
  if (kind === "serpent") return SERPENT_WOBBLE[clip];
  if (kind === "eagle") return EAGLE_WOBBLE[clip];
  if (kind === "bull" || kind === "boar" || kind === "bear" || kind === "rhino") return BULL_WOBBLE[clip];
  if (kind === "elephant") return ELEPHANT_WOBBLE[clip];
  return WOBBLE[clip];
}

/** Build placeholder animation strips from the static beast texture (dev / until AI sheets land). */
export function generateBeastPlaceholderSheet(
  scene: Phaser.Scene,
  kind: BeastKind,
  clip: BeastAnimClip,
  sourceTexKey: string,
): boolean {
  const cfg = BEAST_ANIM_CONFIG[kind];
  if (!cfg) return false;
  const clipDef = cfg.clips[clip];
  const destKey = beastSheetTexKey(kind, clip);
  const src = readSourceCanvas(scene, sourceTexKey);
  if (!src) return false;

  const targetH = cfg.frameH;
  const scale = targetH / src.h;
  const fw = Math.max(1, Math.round(src.w * scale));
  const fh = targetH;
  const count = clipDef.frames;
  const strip = document.createElement("canvas");
  strip.width = fw * count;
  strip.height = fh;
  const ctx = strip.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;

  for (let f = 0; f < count; f++) {
    ctx.save();
    ctx.translate(f * fw, 0);
    wobbleFor(kind, clip)(ctx, f, count, fw, fh);
    ctx.drawImage(src.canvas, 0, 0, src.w, src.h, 0, 0, fw, fh);
    if (clip === "walk") {
      if (kind === "serpent") drawSlitherMarks(ctx, f, count, fw, fh);
      else drawWalkPaws(ctx, f, count, fw, fh);
    }
    ctx.restore();
  }

  if (scene.textures.exists(destKey)) scene.textures.remove(destKey);
  scene.textures.addSpriteSheet(destKey, strip as unknown as HTMLImageElement, { frameWidth: fw, frameHeight: fh });
  scene.textures.get(destKey)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return true;
}

export function prepareBeastSheets(scene: Phaser.Scene): void {
  for (const kind of BEAST_ANIMATED_KINDS) {
    const cfg = BEAST_ANIM_CONFIG[kind];
    if (!cfg) continue;
    const staticKey = `beast-${kind}`;
    for (const clip of Object.keys(cfg.clips) as BeastAnimClip[]) {
      const srcKey = beastSheetSrcKey(kind, clip);
      const destKey = beastSheetTexKey(kind, clip);
      const clipDef = cfg.clips[clip];
      if (scene.textures.exists(srcKey)) {
        if (!ingestBeastSheetStrip(scene, srcKey, destKey, clipDef.frames, cfg.frameH)) {
          generateBeastPlaceholderSheet(scene, kind, clip, staticKey);
        }
        continue;
      }
      if (!scene.textures.exists(staticKey)) continue;
      generateBeastPlaceholderSheet(scene, kind, clip, staticKey);
    }
  }
}

export function registerBeastAnims(scene: Phaser.Scene): void {
  for (const kind of BEAST_ANIMATED_KINDS) {
    const cfg = BEAST_ANIM_CONFIG[kind];
    if (!cfg) continue;
    for (const clip of Object.keys(cfg.clips) as BeastAnimClip[]) {
      const sheetKey = beastSheetTexKey(kind, clip);
      const animKey = beastAnimKey(kind, clip);
      if (!scene.textures.exists(sheetKey)) continue;
      if (scene.anims.exists(animKey)) continue;
      const clipDef = cfg.clips[clip];
      const frameTotal = clipDef.frames - 1;
      scene.anims.create({
        key: animKey,
        frames: scene.anims.generateFrameNumbers(sheetKey, { start: 0, end: frameTotal }),
        frameRate: clipDef.fps,
        repeat: clipDef.repeat,
      });
    }
  }
}

export function pickBeastAnimClip(
  beast: {
    alive: boolean;
    aiState: string;
    body?: Phaser.Physics.Arcade.Body | null;
    preferWalk?: boolean;
  },
): BeastAnimClip {
  if (!beast.alive) return "death";
  if (beast.aiState === "telegraph") return "telegraph";
  if (beast.aiState === "lunge") return "lunge";
  const body = beast.body;
  const speed = body ? Math.hypot(body.velocity.x, body.velocity.y) : 0;
  const moving = beast.preferWalk ?? speed > 18;
  if (beast.aiState === "backoff" || beast.aiState === "recover") {
    return moving ? "walk" : "idle";
  }
  if (beast.aiState === "circle" && moving) return "walk";
  return "idle";
}
