import Phaser from "phaser";
import { COLORS } from "../config";

export type BodyStyle = "gladiator" | "lanista" | "aelia" | "heavy" | "champion" | "fox";

type Ctx = CanvasRenderingContext2D;

function css(n: number, a = 1): string {
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
}

function mix(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

function shade(n: number, t: number): number {
  return t >= 0 ? mix(n, 0xffffff, t) : mix(n, 0x000000, -t);
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTex(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  draw(ctx);
  tex.refresh();
}

function stampKeyedSprite(scene: Phaser.Scene, srcKey: string, destKey: string, targetW: number): boolean {
  if (!scene.textures.exists(srcKey)) return false;
  const img = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = img.width;
  const h = img.height;
  if (!w || !h) return false;
  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext("2d", { willReadFrequently: true });
  if (!tctx) return false;
  tctx.drawImage(img, 0, 0);
  const src = tctx.getImageData(0, 0, w, h).data;
  const pix = w * h;
  const drop = new Uint8Array(pix);
  const magenta = (i: number): boolean => {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const a = src[i + 3];
    if (a < 20) return true;
    if (r > 150 && b > 150 && g < 150 && r + b > g * 2.2) return true;
    return g > 90 && g > r + 18 && g > b + 18;
  };
  const lightNeutral = (i: number): boolean => {
    const r = src[i];
    const g = src[i + 1];
    const b = src[i + 2];
    const maxc = Math.max(r, g, b);
    const minc = Math.min(r, g, b);
    return maxc - minc <= 32 && minc >= 140;
  };
  let magN = 0;
  let checkerN = 0;
  for (let p = 0; p < pix; p++) {
    const i = p * 4;
    if (magenta(i)) {
      drop[p] = 1;
      magN++;
      continue;
    }
    if (lightNeutral(i) && src[i + 3] < 220) {
      drop[p] = 1;
      checkerN++;
    }
  }
  if (checkerN > pix * 0.02 && magN > pix * 0.05) {
    const stack: number[] = [];
    const tryDrop = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const p = y * w + x;
      if (drop[p]) return;
      if (!lightNeutral(p * 4)) return;
      drop[p] = 1;
      stack.push(p);
    };
    for (let p = 0; p < pix; p++) {
      if (!drop[p]) continue;
      const x = p % w;
      const y = (p / w) | 0;
      tryDrop(x - 1, y);
      tryDrop(x + 1, y);
      tryDrop(x, y - 1);
      tryDrop(x, y + 1);
    }
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % w;
      const y = (p / w) | 0;
      tryDrop(x - 1, y);
      tryDrop(x + 1, y);
      tryDrop(x, y - 1);
      tryDrop(x, y + 1);
    }
  }
  const keyed = (i: number): boolean => drop[i >> 2] === 1;
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (keyed(i)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX) return false;
  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const scale = targetW / bw;
  const dw = Math.max(1, Math.round(bw * scale));
  const dh = Math.max(1, Math.round(bh * scale));
  canvasTex(scene, destKey, dw, dh, (ctx) => {
    const out = ctx.createImageData(dw, dh);
    for (let oy = 0; oy < dh; oy++) {
      for (let ox = 0; ox < dw; ox++) {
        const sx = minX + Math.min(bw - 1, Math.floor(ox / scale));
        const sy = minY + Math.min(bh - 1, Math.floor(oy / scale));
        const si = (sy * w + sx) * 4;
        if (keyed(si)) continue;
        const di = (oy * dw + ox) * 4;
        out.data[di] = src[si];
        out.data[di + 1] = src[si + 1];
        out.data[di + 2] = src[si + 2];
        out.data[di + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
  });
  scene.textures.get(destKey)?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  return true;
}

function px(ctx: Ctx, x: number, y: number, w: number, h: number, color: number, a = 1): void {
  ctx.fillStyle = css(color, a);
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

function circ(ctx: Ctx, x: number, y: number, r: number, color: number, a = 1): void {
  ctx.fillStyle = css(color, a);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: number, a = 1): void {
  ctx.fillStyle = css(color, a);
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function fillPoly(ctx: Ctx, pts: Array<[number, number]>, color: number, a = 1): void {
  if (pts.length < 3) return;
  ctx.fillStyle = css(color, a);
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}

function taperedRibbon(ctx: Ctx, spine: Array<{ x: number; y: number; w: number }>, color: number, a = 1): void {
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  for (let i = 0; i < spine.length; i++) {
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(spine.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const p = spine[i];
    left.push([p.x + nx * p.w, p.y + ny * p.w]);
    right.push([p.x - nx * p.w, p.y - ny * p.w]);
  }
  fillPoly(ctx, [...left, ...right.reverse()], color, a);
}

function speckles(ctx: Ctx, w: number, h: number, rand: () => number, color: number, count: number, alpha = 0.35): void {
  for (let i = 0; i < count; i++) {
    px(ctx, Math.floor(rand() * w), Math.floor(rand() * h), 1 + (rand() > 0.7 ? 1 : 0), 1, color, alpha);
  }
}

export function generatePlaceholderAssets(scene: Phaser.Scene): void {
  makeFloorFamily(scene, "tile-yard", 0xc4a66e, 0xa8884c, 0xd8c08a, "packed");
  makeFloorFamily(scene, "tile-sand", 0xd2b47a, 0xb89458, 0xe8d4a4, "sand");
  makeFloorFamily(scene, "tile-dirt", 0x9a7548, 0x7a5a32, 0xb89060, "dirt");
  makeFloorFamily(scene, "tile-stone", 0x8a8478, 0x6a6458, 0xa8a090, "flag");
  makeFloorFamily(scene, "tile-shrine", 0xc4bcb0, 0x9a9488, 0xe0d8cc, "flag");
  makeFloorFamily(scene, "tile-wood", 0x7a4e2c, 0x5a3418, 0x9a6a42, "plank");
  makeFloorFamily(scene, "tile-wood-pale", 0x8a6240, 0x6a4428, 0xb08a5a, "plank");
  makeFloorFamily(scene, "tile-wood-dark", 0x4a2c14, 0x2a180c, 0x6a3c20, "plank");
  makeFloorFamily(scene, "tile-sand-coil", 0x6a7a48, 0x4a5a30, 0x8a9a60, "sand");
  makeFloorFamily(scene, "tile-sand-mud", 0x8a6a40, 0x5a4018, 0xa88858, "dirt");
  makeFloorFamily(scene, "tile-sand-stripe", 0xc49a50, 0x8a6428, 0xe8c878, "sand");
  makeFloorFamily(scene, "tile-sand-stone", 0x9a9488, 0x6a6458, 0xb8b0a4, "flag");
  makeFloorFamily(scene, "tile-sand-ivory", 0xc8b898, 0xa09070, 0xe0d4b8, "sand");
  makeFloorFamily(scene, "tile-sand-earth", 0x6a4a28, 0x4a3018, 0x8a6240, "dirt");
  makeWallFamily(scene);
  makeBanner(scene, "tile-banner-red", COLORS.crimson);
  makeBanner(scene, "tile-banner-serpent", COLORS.serpentGreen);
  makeBanner(scene, "tile-banner-bear", COLORS.bearBrown);
  makeBanner(scene, "tile-banner-wolf", COLORS.wolfGrey);
  makeBanner(scene, "tile-banner-lion", COLORS.lionGold);
  makeBanner(scene, "tile-banner-bull", COLORS.bullRed);
  makeBanner(scene, "tile-banner-boar", COLORS.boarHide);
  makeBanner(scene, "tile-banner-tiger", COLORS.tigerOrange);
  makeBanner(scene, "tile-banner-rhino", COLORS.rhinoHide);
  makeBanner(scene, "tile-banner-elephant", COLORS.elephantGrey);
  makeFence(scene);
  makeColumnTile(scene);
  makeGateTile(scene);
  makeMosaic(scene);
  makeRack(scene);
  makeDummy(scene);
  makeFountain(scene);
  makeCrate(scene);
  makeInteriorProps(scene);
  makeTrophySkeletons(scene);
  makeTableGames(scene);
  makeShadow(scene);
  makeParticles(scene);
  makeUiPanel(scene);
  makeHeart(scene);
  makeVial(scene);
  makeCoin(scene);
  makeCrowd(scene);
  makeThrowables(scene);
  makeBeasts(scene);
  makeWeaponTextures(scene);
  makeDecor(scene);
  makeMenuArt(scene);
  makeHudFrames(scene);
}

function makeFloorFamily(
  scene: Phaser.Scene,
  key: string,
  base: number,
  dark: number,
  light: number,
  kind: "packed" | "sand" | "dirt" | "flag" | "plank",
): void {
  for (let v = 0; v < 4; v++) {
    const name = v === 0 ? key : `${key}-${v}`;
    canvasTex(scene, name, 32, 32, (ctx) => {
      const rand = rng(key.length * 97 + v * 131 + 17);
      px(ctx, 0, 0, 32, 32, base);
      px(ctx, 0, 0, 32, 1, shade(base, 0.08), 0.5);
      px(ctx, 0, 31, 32, 1, shade(base, -0.12), 0.45);
      if (kind === "flag") drawFlagstone(ctx, rand, base, dark, light);
      else if (kind === "plank") drawPlanks(ctx, rand, base, dark, light, v);
      else drawEarth(ctx, rand, base, dark, light, kind);
    });
  }
}

function drawEarth(ctx: Ctx, rand: () => number, base: number, dark: number, light: number, kind: string): void {
  speckles(ctx, 32, 32, rand, dark, kind === "sand" ? 48 : 36, 0.4);
  speckles(ctx, 32, 32, rand, light, 22, 0.3);
  if (kind === "sand") {
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(rand() * 22) + 2;
      const y = Math.floor(rand() * 22) + 4;
      px(ctx, x, y, 6 + Math.floor(rand() * 6), 1, shade(base, -0.08), 0.35);
    }
  }
  if (kind === "dirt") {
    for (let i = 0; i < 2; i++) {
      px(ctx, Math.floor(rand() * 24), Math.floor(rand() * 24), 3, 2, 0x5a3e22, 0.35);
    }
  }
  if (rand() > 0.55) {
    px(ctx, 4 + Math.floor(rand() * 20), 6 + Math.floor(rand() * 16), 2, 1, 0x6a5a40, 0.4);
  }
}

function drawFlagstone(ctx: Ctx, rand: () => number, base: number, dark: number, light: number): void {
  const mortar = 0x4a443c;
  px(ctx, 0, 10, 32, 1, mortar, 0.85);
  px(ctx, 0, 21, 32, 1, mortar, 0.85);
  px(ctx, 15, 0, 1, 10, mortar, 0.85);
  px(ctx, 10, 11, 1, 10, mortar, 0.85);
  px(ctx, 20, 22, 1, 10, mortar, 0.85);
  px(ctx, 1, 1, 13, 8, shade(base, 0.06 + rand() * 0.04));
  px(ctx, 17, 1, 14, 8, shade(base, -0.02));
  px(ctx, 1, 12, 8, 8, shade(base, 0.02));
  px(ctx, 12, 12, 19, 8, shade(base, 0.08));
  px(ctx, 1, 23, 18, 8, shade(base, -0.04));
  px(ctx, 22, 23, 9, 8, shade(base, 0.05));
  speckles(ctx, 32, 32, rand, dark, 18, 0.25);
  speckles(ctx, 32, 32, rand, light, 10, 0.2);
}

function drawPlanks(ctx: Ctx, rand: () => number, base: number, dark: number, light: number, v: number): void {
  const shift = v * 4;
  for (let i = 0; i < 4; i++) {
    const y = (i * 8 + shift) % 32;
    px(ctx, 0, y, 32, 8, shade(base, (i % 2 ? 0.04 : -0.03)));
    px(ctx, 0, y, 32, 1, dark, 0.55);
    px(ctx, 0, y + 1, 32, 1, light, 0.18);
    if (rand() > 0.4) px(ctx, 6 + Math.floor(rand() * 20), y + 3, 4, 1, shade(dark, 0.1), 0.4);
  }
  px(ctx, 10, 0, 1, 32, dark, 0.25);
  px(ctx, 22, 0, 1, 32, dark, 0.2);
}

function makeWallFamily(scene: Phaser.Scene): void {
  for (let v = 0; v < 4; v++) {
    const name = v === 0 ? "tile-wall" : `tile-wall-${v}`;
    canvasTex(scene, name, 32, 32, (ctx) => {
      const rand = rng(400 + v * 19);
      const adobe = 0x5a4a3c;
      px(ctx, 0, 0, 32, 32, adobe);
      px(ctx, 0, 0, 32, 7, shade(adobe, 0.18));
      px(ctx, 0, 7, 32, 1, shade(adobe, -0.25));
      px(ctx, 0, 8, 32, 24, shade(adobe, -0.04));
      const mortar = 0x3a322c;
      for (let row = 0; row < 3; row++) {
        const y = 10 + row * 7;
        px(ctx, 0, y, 32, 1, mortar, 0.7);
        const off = row % 2 === 0 ? 0 : 8;
        for (let x = off; x < 32; x += 16) {
          px(ctx, x, y, 1, 7, mortar, 0.65);
          px(ctx, x + 1, y + 1, 13, 2, shade(adobe, 0.1), 0.35);
        }
      }
      px(ctx, 0, 31, 32, 1, 0x2a221c, 0.8);
      px(ctx, 0, 0, 1, 32, shade(adobe, 0.12), 0.4);
      px(ctx, 31, 0, 1, 32, 0x2a221c, 0.45);
      speckles(ctx, 32, 32, rand, 0x3a3028, 12, 0.3);
    });
  }
  canvasTex(scene, "tile-wall-shadow", 32, 10, (ctx) => {
    for (let y = 0; y < 10; y++) {
      px(ctx, 0, y, 32, 1, 0x000000, 0.28 - y * 0.026);
    }
  });
}

function makeBanner(scene: Phaser.Scene, key: string, color: number): void {
  canvasTex(scene, key, 32, 32, (ctx) => {
    px(ctx, 0, 0, 32, 32, 0x6a6458);
    px(ctx, 0, 10, 32, 1, 0x4a443c, 0.8);
    px(ctx, 14, 0, 4, 32, 0x4a3a2c);
    px(ctx, 15, 0, 2, 32, 0x6a5238);
    px(ctx, 18, 3, 12, 3, color);
    px(ctx, 18, 6, 13, 8, shade(color, -0.08));
    px(ctx, 18, 14, 10, 4, shade(color, -0.18));
    px(ctx, 18, 18, 6, 3, shade(color, -0.28));
    px(ctx, 19, 7, 8, 2, shade(color, 0.2), 0.5);
    circ(ctx, 16, 2, 2, COLORS.gold);
  });
}

function makeFence(scene: Phaser.Scene): void {
  canvasTex(scene, "tile-fence", 32, 32, (ctx) => {
    px(ctx, 0, 18, 32, 3, 0x3a2818, 0.0);
    for (let x = 2; x < 32; x += 7) {
      px(ctx, x, 8, 4, 22, 0x5a3c22);
      px(ctx, x, 8, 1, 22, 0x7a5a38);
      px(ctx, x + 3, 8, 1, 22, 0x3a2414);
      px(ctx, x, 8, 4, 2, 0x3a2414);
    }
    px(ctx, 1, 14, 30, 3, 0x6b4a28);
    px(ctx, 1, 15, 30, 1, 0x8a6a44);
    px(ctx, 1, 22, 30, 2, 0x5a3c22);
  });
}

function makeColumnTile(scene: Phaser.Scene): void {
  canvasTex(scene, "tile-column", 32, 32, (ctx) => {
    px(ctx, 0, 24, 32, 8, 0x7a7368);
    px(ctx, 9, 4, 14, 24, 0x9a9488);
    px(ctx, 10, 4, 4, 24, 0xb8b0a4, 0.55);
    px(ctx, 20, 4, 2, 24, 0x6a6458, 0.5);
    px(ctx, 6, 0, 20, 6, 0xc4bcb0);
    px(ctx, 7, 1, 18, 2, 0xe0d8cc, 0.5);
    px(ctx, 6, 26, 20, 6, 0x8a8278);
    px(ctx, 5, 28, 22, 4, 0x6a6458);
    px(ctx, 12, 8, 2, 2, COLORS.gold, 0.7);
  });
}

function makeGateTile(scene: Phaser.Scene): void {
  canvasTex(scene, "tile-gate", 32, 32, (ctx) => {
    px(ctx, 0, 0, 32, 32, 0x6a6458);
    px(ctx, 0, 0, 32, 4, 0x8a8278);
    px(ctx, 0, 28, 32, 4, 0x4a4038);
    px(ctx, 2, 6, 28, 20, 0x5a544c);
    px(ctx, 4, 10, 24, 12, 0x7a6a48, 0.45);
    px(ctx, 0, 14, 32, 3, 0x3a322c, 0.55);
    px(ctx, 12, 8, 8, 2, COLORS.gold, 0.35);
  });
}

function makeMosaic(scene: Phaser.Scene): void {
  canvasTex(scene, "tile-mosaic", 32, 32, (ctx) => {
    px(ctx, 0, 0, 32, 32, 0x6a6458);
    const tiles = [0x8a3a2a, 0xd4a84b, 0xe8dcc8, 0x4a5c6e, 0x6a6458];
    for (let y = 0; y < 32; y += 4) {
      for (let x = 0; x < 32; x += 4) {
        const i = ((x / 4 + y / 4) | 0) % tiles.length;
        const cx = Math.abs(x - 14) + Math.abs(y - 14);
        const c = cx < 8 ? COLORS.gold : cx < 14 ? COLORS.crimson : tiles[i];
        px(ctx, x, y, 3, 3, c);
        px(ctx, x, y, 3, 1, shade(c, 0.15), 0.4);
      }
    }
  });
  canvasTex(scene, "tile-ring", 32, 32, (ctx) => {
    px(ctx, 0, 0, 32, 32, 0x8a6840);
    speckles(ctx, 32, 32, rng(9), 0x6a4a28, 24, 0.45);
    speckles(ctx, 32, 32, rng(3), 0xc4a66e, 10, 0.25);
    // Worn packed rim
    px(ctx, 0, 0, 32, 2, 0x5a3a18, 0.35);
    px(ctx, 0, 30, 32, 2, 0x5a3a18, 0.35);
    px(ctx, 0, 0, 2, 32, 0x5a3a18, 0.3);
    px(ctx, 30, 0, 2, 32, 0x5a3a18, 0.3);
    px(ctx, 0, 13, 32, 6, 0xb89458, 0.4);
    px(ctx, 0, 15, 32, 2, 0x6b4a28, 0.55);
    px(ctx, 4, 8, 3, 2, 0x4a3018, 0.35);
    px(ctx, 22, 22, 4, 2, 0x4a3018, 0.3);
  });
}

function makeRack(scene: Phaser.Scene): void {
  canvasTex(scene, "prop-rack", 56, 52, (ctx) => {
    px(ctx, 4, 42, 48, 10, 0x3a2410);
    px(ctx, 6, 42, 44, 3, 0x6b4a28);
    px(ctx, 8, 8, 6, 38, 0x5a3a1c);
    px(ctx, 42, 8, 6, 38, 0x5a3a1c);
    px(ctx, 8, 8, 40, 5, 0x7a5230);
    px(ctx, 10, 9, 36, 2, 0x9a6a42, 0.45);
    px(ctx, 10, 22, 36, 3, 0x6b4a28);
    px(ctx, 10, 34, 36, 3, 0x6b4a28);
    px(ctx, 18, 2, 4, 40, 0xd8d4c4);
    px(ctx, 18, 2, 4, 5, 0xf0ece0);
    px(ctx, 26, 4, 4, 38, 0xc9c4b4);
    px(ctx, 34, 3, 4, 39, 0xe8e4d4);
    px(ctx, 14, 24, 12, 10, COLORS.crimson);
    px(ctx, 16, 26, 8, 6, COLORS.gold);
    circ(ctx, 20, 29, 2, 0x3a1c14);
    px(ctx, 38, 24, 3, 18, 0x6b4a28);
    fillPoly(ctx, [[40, 12], [54, 18], [40, 24]], 0xe8e4d4);
    px(ctx, 6, 36, 8, 3, 0x4a4038);
    circ(ctx, 10, 37, 3, 0x6a6458);
  });
}

function makeDummy(scene: Phaser.Scene): void {
  canvasTex(scene, "prop-dummy", 40, 56, (ctx) => {
    // Stake + base
    px(ctx, 17, 30, 6, 24, 0x5a3a18);
    px(ctx, 18, 30, 2, 24, 0x7a5230, 0.45);
    px(ctx, 14, 50, 12, 4, 0x3a2410);
    px(ctx, 12, 52, 16, 3, 0x4a3018);
    px(ctx, 13, 52, 14, 1, 0x6b4a28, 0.4);
    // Scarred torso
    circ(ctx, 20, 16, 12, 0xc2a36b);
    px(ctx, 9, 16, 22, 18, 0xc2a36b);
    px(ctx, 10, 17, 20, 4, 0xd4b87a, 0.35);
    px(ctx, 10, 28, 20, 7, 0xa8884c);
    // Arms
    px(ctx, 6, 18, 5, 14, 0xb8925a);
    px(ctx, 29, 18, 5, 14, 0xb8925a);
    px(ctx, 6, 18, 5, 3, 0xd4b87a, 0.4);
    px(ctx, 29, 18, 5, 3, 0xd4b87a, 0.4);
    // Face / wear
    px(ctx, 13, 11, 14, 4, 0x3a2a18);
    px(ctx, 15, 17, 3, 3, 0x3a2a18);
    px(ctx, 23, 17, 3, 3, 0x3a2a18);
    px(ctx, 17, 23, 6, 2, 0x6b3a28, 0.65);
    // Slash scars
    px(ctx, 12, 20, 8, 1, 0x6a2420, 0.55);
    px(ctx, 22, 26, 6, 1, 0x5a3a18, 0.5);
    px(ctx, 14, 32, 12, 3, 0x6b4a28);
    px(ctx, 15, 33, 10, 1, COLORS.gold, 0.35);
  });
}

function makeFountain(scene: Phaser.Scene): void {
  canvasTex(scene, "prop-fountain", 48, 48, (ctx) => {
    circ(ctx, 24, 28, 18, 0x7a7368);
    circ(ctx, 24, 28, 16, 0x8a8478);
    circ(ctx, 24, 28, 12, 0x3a6a7a);
    circ(ctx, 24, 26, 9, 0x4a8a9a);
    circ(ctx, 24, 24, 5, 0x8ec8d8, 0.85);
    px(ctx, 22, 10, 4, 14, 0xb0aaa0);
    px(ctx, 20, 8, 8, 4, 0xc4bcb0);
    circ(ctx, 24, 12, 3, 0x8ec8d8, 0.7);
    px(ctx, 23, 14, 2, 10, 0xb8e0ec, 0.65);
  });
  canvasTex(scene, "fx-water", 8, 8, (ctx) => {
    circ(ctx, 4, 4, 3, 0xb8e0ec, 0.8);
  });
}

function makeCrate(scene: Phaser.Scene): void {
  canvasTex(scene, "prop-crate", 32, 28, (ctx) => {
    px(ctx, 4, 8, 24, 18, 0x6b4a2f);
    px(ctx, 4, 8, 24, 3, 0x8a6a44);
    px(ctx, 4, 8, 2, 18, 0x8a6a44);
    px(ctx, 26, 8, 2, 18, 0x3a2414);
    px(ctx, 4, 24, 24, 2, 0x3a2414);
    px(ctx, 4, 15, 24, 2, 0x3a2414);
    px(ctx, 15, 8, 2, 18, 0x3a2414);
    px(ctx, 6, 12, 3, 2, 0x8a8a94);
    px(ctx, 23, 20, 3, 2, 0x8a8a94);
  });
}

function makeShadow(scene: Phaser.Scene): void {
  canvasTex(scene, "char-shadow", 36, 16, (ctx) => {
    ctx.fillStyle = css(0x000000, 0.32);
    ctx.beginPath();
    ctx.ellipse(18, 8, 16, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css(0x000000, 0.18);
    ctx.beginPath();
    ctx.ellipse(18, 8, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

function makeParticles(scene: Phaser.Scene): void {
  canvasTex(scene, "spark", 8, 8, (ctx) => {
    circ(ctx, 4, 4, 3, 0xfff4c8);
    circ(ctx, 4, 4, 1, 0xffffff);
  });
  canvasTex(scene, "fx-dust", 12, 10, (ctx) => {
    circ(ctx, 6, 6, 5, 0xc2a36b, 0.45);
    circ(ctx, 4, 5, 3, 0xa8884c, 0.35);
  });
  canvasTex(scene, "fx-ring", 48, 48, (ctx) => {
    ctx.strokeStyle = css(0xfff4c8, 0.85);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(24, 24, 18, 0, Math.PI * 2);
    ctx.stroke();
  });
  canvasTex(scene, "fx-net", 32, 24, (ctx) => {
    ctx.strokeStyle = css(0xc9d2c0, 0.9);
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(2 + i * 7, 2);
      ctx.lineTo(2 + i * 6, 22);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(2, 6);
    ctx.lineTo(30, 8);
    ctx.moveTo(2, 12);
    ctx.lineTo(30, 13);
    ctx.moveTo(2, 18);
    ctx.lineTo(30, 17);
    ctx.stroke();
    ctx.strokeStyle = css(0x8a9a78, 0.8);
    ctx.strokeRect(1, 1, 30, 22);
  });
  canvasTex(scene, "fx-mote", 4, 4, (ctx) => {
    circ(ctx, 2, 2, 1.5, 0xe8dcc8, 0.7);
  });
  canvasTex(scene, "fx-glow", 64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, css(0xffc070, 0.55));
    g.addColorStop(0.4, css(0xd4a84b, 0.18));
    g.addColorStop(1, css(0xd4a84b, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  });
}

function makeUiPanel(scene: Phaser.Scene): void {
  canvasTex(scene, "ui-panel", 64, 64, (ctx) => {
    px(ctx, 0, 0, 64, 64, 0x1a1210, 0.92);
    ctx.strokeStyle = css(COLORS.gold);
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 60, 60);
  });
}

function makeHeart(scene: Phaser.Scene): void {
  canvasTex(scene, "ui-heart", 18, 16, (ctx) => {
    circ(ctx, 6, 6, 5, COLORS.hp);
    circ(ctx, 12, 6, 5, COLORS.hp);
    ctx.fillStyle = css(COLORS.hp);
    ctx.beginPath();
    ctx.moveTo(2, 8);
    ctx.lineTo(16, 8);
    ctx.lineTo(9, 16);
    ctx.fill();
    circ(ctx, 5, 5, 2, 0xe07060, 0.5);
  });
}

function makeVial(scene: Phaser.Scene): void {
  canvasTex(scene, "ui-vial", 14, 18, (ctx) => {
    px(ctx, 4, 0, 6, 3, 0xc4a070);
    px(ctx, 5, 2, 4, 2, 0x8a6a38);
    px(ctx, 3, 4, 8, 12, 0x4a6a38);
    px(ctx, 4, 6, 6, 8, COLORS.unguent);
    px(ctx, 5, 7, 2, 4, 0xc8e0a0, 0.55);
  });
}

function makeCoin(scene: Phaser.Scene): void {
  canvasTex(scene, "ui-coin", 22, 22, (ctx) => {
    circ(ctx, 11, 11, 10, COLORS.gold);
    circ(ctx, 11, 11, 8, shade(COLORS.gold, -0.12));
    circ(ctx, 11, 11, 6, shade(COLORS.gold, 0.2));
    px(ctx, 10, 6, 2, 10, 0x6a4a18);
    px(ctx, 8, 9, 6, 2, 0x6a4a18);
  });
}

type SpectatorPalette = {
  hair: number;
  skin: number;
  tunic: number;
  trim: number;
  plume?: number;
};

function drawSeatedSpectator(ctx: Ctx, p: SpectatorPalette, armUp: boolean): void {
  px(ctx, 7, 18, 14, 17, p.tunic);
  px(ctx, 5, 16, 18, 6, shade(p.tunic, -0.08));
  px(ctx, 8, 21, 12, 3, p.trim);
  px(ctx, 9, 28, 10, 6, shade(p.tunic, -0.18));
  circ(ctx, 14, 11, 6.5, p.skin);
  px(ctx, 8, 5, 12, 6, p.hair);
  px(ctx, 9, 4, 10, 3, shade(p.hair, 0.12));
  if (p.plume) {
    px(ctx, 12, 0, 3, 7, p.plume);
    px(ctx, 14, 1, 2, 5, shade(p.plume, 0.25));
  }
  if (!armUp) {
    px(ctx, 2, 18, 5, 10, p.skin);
    px(ctx, 21, 18, 5, 10, p.skin);
    px(ctx, 2, 26, 5, 3, p.tunic);
    px(ctx, 21, 26, 5, 3, p.tunic);
  } else {
    px(ctx, 2, 18, 5, 10, p.skin);
    px(ctx, 2, 26, 5, 3, p.tunic);
    px(ctx, 19, 2, 5, 16, p.skin);
    px(ctx, 20, 1, 4, 4, p.skin);
    px(ctx, 21, 16, 4, 4, p.tunic);
  }
}

function makeCrowd(scene: Phaser.Scene): void {
  const palettes: SpectatorPalette[] = [
    { hair: 0x3a2a22, skin: 0xe0c090, tunic: 0xd8c8a8, trim: 0xc4a070 },
    { hair: 0x2a1c16, skin: 0xd4b080, tunic: COLORS.crimson, trim: COLORS.gold, plume: COLORS.crimson },
    { hair: 0x4a3a28, skin: 0xc4a070, tunic: COLORS.foxOrange, trim: 0x1c1410 },
    { hair: 0x1c1814, skin: 0xd8b898, tunic: COLORS.serpentGreen, trim: 0xc9c070 },
    { hair: 0x5a4030, skin: 0xe8c8a0, tunic: 0x6a5440, trim: 0xb08a48 },
    { hair: 0x3a2818, skin: 0xc4a070, tunic: 0x4a3c34, trim: COLORS.gold, plume: COLORS.gold },
    { hair: 0x2a2018, skin: 0xf0d4b0, tunic: 0xe8dcc8, trim: COLORS.crimson },
    { hair: 0x4a3020, skin: 0xd4b080, tunic: 0x5a6a48, trim: 0x8a7a50 },
  ];
  palettes.forEach((p, i) => {
    canvasTex(scene, `crowd-${i}`, 28, 36, (ctx) => drawSeatedSpectator(ctx, p, false));
    canvasTex(scene, `crowd-${i}-arm`, 28, 36, (ctx) => drawSeatedSpectator(ctx, p, true));
  });
  canvasTex(scene, "crowd-dot", 28, 36, (ctx) => drawSeatedSpectator(ctx, palettes[0]!, false));
  canvasTex(scene, "crowd-dot-1", 28, 36, (ctx) => drawSeatedSpectator(ctx, palettes[1]!, false));
  canvasTex(scene, "crowd-dot-2", 28, 36, (ctx) => drawSeatedSpectator(ctx, palettes[2]!, false));
}

function makeThrowables(scene: Phaser.Scene): void {
  canvasTex(scene, "fx-flower", 12, 12, (ctx) => {
    circ(ctx, 6, 6, 2, 0xf0e6a8);
    for (const [dx, dy] of [
      [0, -3],
      [3, -1],
      [2, 3],
      [-2, 3],
      [-3, -1],
    ]) {
      circ(ctx, 6 + dx, 6 + dy, 2.2, 0xe07090);
    }
  });
  canvasTex(scene, "fx-fruit", 10, 11, (ctx) => {
    circ(ctx, 5, 6, 4, 0xc45a28);
    circ(ctx, 4, 5, 2, 0xe07040, 0.55);
    px(ctx, 4, 1, 2, 3, 0x3a6a28);
    px(ctx, 6, 2, 2, 2, 0x4a7a30);
  });
  canvasTex(scene, "fx-cup", 10, 12, (ctx) => {
    px(ctx, 2, 3, 6, 6, 0xc4a070);
    px(ctx, 3, 4, 4, 4, 0xe8d4a4);
    px(ctx, 1, 4, 2, 4, 0xb08a48);
    px(ctx, 8, 4, 2, 4, 0xb08a48);
    px(ctx, 3, 9, 4, 2, 0x8a6a38);
    circ(ctx, 5, 3, 2, 0xd4a84b, 0.7);
  });
  canvasTex(scene, "fx-rock", 10, 8, (ctx) => {
    px(ctx, 2, 2, 6, 5, 0x6a6458);
    px(ctx, 1, 3, 8, 3, 0x8a8478);
    px(ctx, 3, 1, 4, 2, 0x9a9488);
    px(ctx, 4, 4, 2, 2, 0x4a4438);
  });
}

function makeBeasts(scene: Phaser.Scene): void {
  if (!stampKeyedSprite(scene, "serpent-src", "beast-serpent", 58)) {
  canvasTex(scene, "beast-serpent", 72, 34, (ctx) => {
    const g = COLORS.serpentGreen;
    const dark = shade(g, -0.32);
    const mid = shade(g, -0.12);
    const light = shade(g, 0.22);
    const hood = shade(g, 0.08);
    const belly = 0xd8c070;
    const spine = [
      { x: 22, y: 18, w: 6.2 },
      { x: 30, y: 13, w: 5.6 },
      { x: 38, y: 11, w: 5.1 },
      { x: 46, y: 15, w: 4.4 },
      { x: 54, y: 21, w: 3.4 },
      { x: 62, y: 19, w: 2.3 },
      { x: 68, y: 14, w: 1.4 },
      { x: 71, y: 11, w: 0.7 },
    ];
    taperedRibbon(
      ctx,
      spine.map((p) => ({ x: p.x, y: p.y + 1.2, w: p.w * 0.55 })),
      belly,
    );
    taperedRibbon(ctx, spine, g);
    taperedRibbon(
      ctx,
      spine.map((p) => ({ x: p.x, y: p.y - p.w * 0.28, w: p.w * 0.38 })),
      light,
      0.55,
    );
    for (let i = 1; i < spine.length - 1; i++) {
      const p = spine[i];
      const n = spine[i + 1];
      fillPoly(
        ctx,
        [
          [p.x, p.y - p.w + 1],
          [(p.x + n.x) / 2, p.y + 0.5],
          [n.x, n.y - n.w + 1],
          [(p.x + n.x) / 2, p.y - 1.5],
        ],
        i % 2 === 0 ? dark : mid,
        0.85,
      );
    }
    fillPoly(ctx, [[71, 11], [68, 10], [69, 13]], dark);
    fillPoly(
      ctx,
      [
        [20, 4],
        [27, 11],
        [26, 18],
        [27, 25],
        [20, 31],
        [13, 24],
        [12, 18],
        [13, 10],
      ],
      dark,
    );
    fillPoly(
      ctx,
      [
        [20, 6],
        [25, 12],
        [24, 18],
        [25, 24],
        [20, 29],
        [15, 23],
        [14, 18],
        [15, 11],
      ],
      hood,
    );
    fillPoly(ctx, [[20, 10], [23, 18], [20, 26], [17, 18]], 0xc9c070, 0.55);
    fillPoly(ctx, [[20, 12], [22, 18], [20, 24], [18, 18]], dark, 0.45);
    fillPoly(
      ctx,
      [
        [2, 17],
        [8, 12],
        [16, 13],
        [18, 17],
        [16, 21],
        [8, 22],
      ],
      g,
    );
    fillPoly(ctx, [[2, 17], [8, 13], [14, 14], [15, 17], [8, 19]], light);
    fillPoly(ctx, [[4, 18], [10, 20], [15, 19], [10, 21], [5, 20]], belly);
    px(ctx, 2, 16, 3, 2, dark);
    px(ctx, 1, 17, 2, 1, 0xe8e4d4);
    px(ctx, 1, 19, 2, 1, 0xe8e4d4);
    px(ctx, 0, 17, 2, 1, 0xc45a4a);
    px(ctx, 0, 19, 2, 1, 0xc45a4a);
    circ(ctx, 9, 16, 2.1, 0xe8dcc8);
    circ(ctx, 9, 16, 1.35, 0xd4a84b);
    px(ctx, 9, 15, 1, 3, 0x1c1410);
    px(ctx, 8, 16, 1, 1, 0x1c1410);
  });
  }
  if (!stampKeyedSprite(scene, "bear-src", "beast-bear", 96)) {
  canvasTex(scene, "beast-bear", 108, 64, (ctx) => {
    const line = 0x1a120c;
    const fur = 0xb56a32;
    const hi = 0xd49454;
    const shadeC = 0x7a3e1c;
    const belly = 0x4a2814;
    const far = 0x3a2012;
    const near = 0x6e3818;
    const tan = 0xd4b07a;
    const gum = 0x8a3040;
    const tongue = 0x6a2030;
    const tooth = 0xf2ead8;
    const muzzle: Array<[number, number]> = [
      [76, 20],
      [88, 21],
      [94, 25],
      [92, 30],
      [80, 30],
      [72, 26],
    ];
    const jaw: Array<[number, number]> = [
      [74, 30],
      [88, 32],
      [90, 36],
      [82, 38],
      [72, 34],
    ];
    oval(ctx, 20, 48, 7, 13, line);
    oval(ctx, 34, 50, 8, 13, line);
    oval(ctx, 52, 48, 7, 13, line);
    oval(ctx, 66, 50, 8, 13, line);
    oval(ctx, 20, 58, 8, 4, line);
    oval(ctx, 34, 60, 9, 4, line);
    oval(ctx, 52, 58, 8, 4, line);
    oval(ctx, 66, 60, 9, 4, line);
    oval(ctx, 18, 34, 16, 15, line);
    oval(ctx, 42, 33, 34, 17, line);
    oval(ctx, 72, 24, 11, 11, line);
    fillPoly(ctx, muzzle, line);
    fillPoly(ctx, jaw, line);
    oval(ctx, 64, 13, 3.8, 5, line);
    oval(ctx, 72, 11, 3.6, 4.6, line);
    oval(ctx, 6, 34, 6, 5, line);
    oval(ctx, 20, 48, 5, 11, far);
    oval(ctx, 34, 50, 6, 11, near);
    oval(ctx, 52, 48, 5, 11, far);
    oval(ctx, 66, 50, 6, 11, near);
    oval(ctx, 20, 58, 6, 2.4, far);
    oval(ctx, 34, 60, 7, 2.4, near);
    oval(ctx, 52, 58, 6, 2.4, far);
    oval(ctx, 66, 60, 7, 2.4, near);
    oval(ctx, 18, 34, 14, 13, fur);
    oval(ctx, 42, 33, 32, 15, fur);
    oval(ctx, 72, 24, 9, 9, fur);
    fillPoly(
      ctx,
      [
        [77, 21],
        [88, 22],
        [92, 25],
        [90, 29],
        [80, 29],
        [74, 26],
      ],
      tan,
    );
    fillPoly(
      ctx,
      [
        [75, 31],
        [87, 32],
        [88, 35],
        [82, 36],
        [73, 33],
      ],
      fur,
    );
    oval(ctx, 64, 13, 2.3, 3.4, fur);
    oval(ctx, 72, 11, 2.2, 3, fur);
    oval(ctx, 64, 13, 0.8, 1.5, shadeC);
    oval(ctx, 72, 11, 0.8, 1.4, shadeC);
    oval(ctx, 6, 34, 4, 3.4, shadeC);
    oval(ctx, 36, 24, 18, 4, hi, 0.35);
    oval(ctx, 40, 40, 22, 7, belly);
    oval(ctx, 20, 38, 10, 6, belly);
    fillPoly(ctx, [[78, 29], [90, 29], [88, 34], [78, 33]], gum);
    fillPoly(ctx, [[80, 31], [88, 32], [86, 34], [80, 33]], tongue);
    px(ctx, 81, 29, 2, 4, tooth);
    px(ctx, 86, 29, 2, 3, tooth);
    px(ctx, 82, 33, 2, 3, tooth);
    oval(ctx, 91, 25, 3.6, 2.8, line);
    px(ctx, 84, 23, 5, 1, shadeC);
    px(ctx, 86, 24, 4, 1, shadeC);
    fillPoly(
      ctx,
      [
        [66, 18],
        [78, 19],
        [80, 23],
        [68, 23],
      ],
      shadeC,
    );
    oval(ctx, 76, 22, 2.4, 1.8, line);
    circ(ctx, 76.4, 22.2, 0.9, 0x1a1008);
    circ(ctx, 75.6, 21.6, 0.55, 0xf4ead8);
    px(ctx, 38, 58, 2, 4, line);
    px(ctx, 41, 59, 2, 4, line);
    px(ctx, 44, 58, 2, 3, line);
    px(ctx, 70, 58, 2, 4, line);
    px(ctx, 73, 59, 2, 4, line);
    px(ctx, 76, 58, 2, 3, line);
  });
  scene.textures.get("beast-bear")?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!stampKeyedSprite(scene, "wolf-src", "beast-wolf", 72)) {
    canvasTex(scene, "beast-wolf", 100, 56, (ctx) => {
    const line = 0x12141a;
    const fur = 0x6a6e78;
    const dark = 0x3a3e48;
    const hi = 0x9aa0a8;
    const white = 0xe8e4dc;
    const cream = 0xd4ccc4;
    const yellow = 0xf0c038;
    const snout: Array<[number, number]> = [
      [80, 20],
      [94, 23],
      [97, 26],
      [94, 29],
      [80, 27],
    ];
    oval(ctx, 20, 40, 4, 14, line);
    oval(ctx, 32, 42, 4.5, 14, line);
    oval(ctx, 56, 40, 4, 14, line);
    oval(ctx, 68, 42, 4.5, 14, line);
    oval(ctx, 20, 52, 5, 3, line);
    oval(ctx, 32, 54, 5.5, 3, line);
    oval(ctx, 56, 52, 5, 3, line);
    oval(ctx, 68, 54, 5.5, 3, line);
    oval(ctx, 22, 28, 13, 12, line);
    oval(ctx, 48, 27, 30, 12, line);
    oval(ctx, 76, 22, 8, 8, line);
    fillPoly(ctx, snout, line);
    fillPoly(ctx, [[68, 8], [74, 4], [76, 14], [70, 14]], line);
    fillPoly(ctx, [[76, 7], [82, 3], [83, 13], [77, 13]], line);
    fillPoly(ctx, [[4, 18], [16, 14], [22, 26], [8, 30], [2, 26]], line);
    oval(ctx, 20, 40, 2.6, 12, dark);
    oval(ctx, 32, 42, 3, 12, fur);
    oval(ctx, 56, 40, 2.6, 12, dark);
    oval(ctx, 68, 42, 3, 12, fur);
    oval(ctx, 22, 28, 11, 10, fur);
    oval(ctx, 48, 27, 28, 10, fur);
    oval(ctx, 76, 22, 6.2, 6.2, fur);
    fillPoly(
      ctx,
      [
        [81, 21],
        [93, 24],
        [95, 26],
        [93, 28],
        [80, 26],
      ],
      dark,
    );
    fillPoly(
      ctx,
      [
        [80, 24],
        [94, 26],
        [93, 28],
        [80, 27],
      ],
      white,
    );
    oval(ctx, 74, 24, 4, 3.5, white);
    oval(ctx, 44, 32, 22, 5, cream);
    oval(ctx, 28, 32, 10, 5, cream);
    oval(ctx, 68, 26, 6, 4, cream);
    fillPoly(ctx, [[70, 9], [74, 6], [75, 13], [71, 13]], white);
    fillPoly(ctx, [[78, 8], [81, 5], [82, 12], [78, 12]], white);
    fillPoly(ctx, [[6, 20], [15, 17], [20, 26], [8, 28]], dark);
    fillPoly(ctx, [[8, 24], [16, 22], [18, 28], [8, 28]], cream);
    oval(ctx, 48, 22, 16, 4, hi, 0.45);
    oval(ctx, 94, 25, 2.4, 1.8, line);
    px(ctx, 84, 27, 6, 1, line);
    px(ctx, 86, 26, 2, 2, 0xf0e8d8);
    circ(ctx, 80, 21, 2.2, line);
    circ(ctx, 80.3, 21, 1.35, yellow);
    circ(ctx, 80.6, 20.6, 0.55, 0xfff0c0);
    circ(ctx, 79.8, 21.2, 0.45, 0x1a1410);
    px(ctx, 34, 52, 2, 3, line);
    px(ctx, 70, 52, 2, 3, line);
  });
    scene.textures.get("beast-wolf")?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!stampKeyedSprite(scene, "lion-src", "beast-lion", 48)) {
    canvasTex(scene, "beast-lion", 96, 52, (ctx) => {
      const fur = COLORS.lionGold;
      const dark = 0x6a4a10;
      oval(ctx, 40, 30, 28, 14, fur);
      oval(ctx, 72, 22, 14, 12, fur);
      oval(ctx, 72, 22, 18, 16, shade(fur, -0.15), 0.7);
      circ(ctx, 86, 22, 6, shade(fur, 0.1));
      px(ctx, 90, 20, 8, 4, shade(fur, -0.2));
      circ(ctx, 80, 20, 2, 0x1c1410);
      oval(ctx, 18, 42, 5, 10, dark);
      oval(ctx, 32, 44, 5, 10, dark);
      oval(ctx, 50, 42, 5, 10, dark);
      oval(ctx, 64, 44, 5, 10, dark);
    });
    scene.textures.get("beast-lion")?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!stampKeyedSprite(scene, "bull-src", "beast-bull", 46)) {
    canvasTex(scene, "beast-bull", 110, 58, (ctx) => {
      const hide = 0x4a2818;
      oval(ctx, 48, 34, 34, 16, hide);
      oval(ctx, 86, 26, 16, 12, hide);
      px(ctx, 92, 8, 4, 16, 0xe8dcc8);
      px(ctx, 78, 8, 4, 16, 0xe8dcc8);
      circ(ctx, 96, 24, 3, 0x1c1410);
      oval(ctx, 22, 46, 6, 12, 0x2a1810);
      oval(ctx, 40, 48, 6, 12, 0x2a1810);
      oval(ctx, 62, 46, 6, 12, 0x2a1810);
      oval(ctx, 80, 48, 6, 12, 0x2a1810);
    });
    scene.textures.get("beast-bull")?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!stampKeyedSprite(scene, "boar-src", "beast-boar", 64)) {
    canvasTex(scene, "beast-boar", 88, 48, (ctx) => {
      const hide = COLORS.boarHide;
      oval(ctx, 40, 28, 26, 14, hide);
      oval(ctx, 70, 24, 12, 10, hide);
      px(ctx, 78, 22, 10, 3, 0xe8dcc8);
      px(ctx, 78, 28, 10, 3, 0xe8dcc8);
      circ(ctx, 74, 22, 2, 0x1c1410);
      oval(ctx, 18, 38, 5, 10, 0x2a1c14);
      oval(ctx, 32, 40, 5, 10, 0x2a1c14);
      oval(ctx, 50, 38, 5, 10, 0x2a1c14);
      oval(ctx, 64, 40, 5, 10, 0x2a1c14);
    });
    scene.textures.get("beast-boar")?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!stampKeyedSprite(scene, "rhino-src", "beast-rhino", 110)) {
    canvasTex(scene, "beast-rhino", 110, 52, (ctx) => {
      const hide = COLORS.rhinoHide;
      const dark = shade(hide, -0.28);
      const horn = 0xc4a070;
      oval(ctx, 48, 34, 34, 16, hide);
      oval(ctx, 86, 28, 16, 12, hide);
      fillPoly(ctx, [[92, 22], [110, 18], [96, 28]], horn);
      fillPoly(ctx, [[94, 20], [108, 18], [96, 26]], shade(horn, 0.18));
      circ(ctx, 96, 26, 2.4, 0x1c1410);
      oval(ctx, 22, 46, 6, 12, dark);
      oval(ctx, 40, 48, 6, 12, dark);
      oval(ctx, 62, 46, 6, 12, dark);
      oval(ctx, 80, 48, 6, 12, dark);
    });
    scene.textures.get("beast-rhino")?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!stampKeyedSprite(scene, "elephant-src", "beast-elephant", 124)) {
    canvasTex(scene, "beast-elephant", 124, 72, (ctx) => {
      const hide = COLORS.elephantGrey;
      const dark = shade(hide, -0.22);
      const ear = 0xd48aa0;
      const tusk = 0xf4ead8;
      oval(ctx, 52, 40, 38, 18, hide);
      oval(ctx, 92, 32, 18, 14, hide);
      oval(ctx, 78, 18, 14, 12, hide);
      oval(ctx, 78, 18, 10, 8, ear);
      px(ctx, 100, 36, 16, 3, tusk);
      px(ctx, 100, 42, 14, 3, tusk);
      circ(ctx, 102, 28, 2.2, 0x1c1410);
      oval(ctx, 24, 54, 7, 14, dark);
      oval(ctx, 44, 56, 7, 14, dark);
      oval(ctx, 70, 54, 7, 14, dark);
      oval(ctx, 90, 56, 7, 14, dark);
    });
    scene.textures.get("beast-elephant")?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!stampKeyedSprite(scene, "tiger-src", "beast-tiger", 96)) {
    canvasTex(scene, "beast-tiger", 92, 48, (ctx) => {
      const fur = COLORS.tigerOrange;
      const dark = 0x8a3a0c;
      const line = 0x1a1210;
      const white = 0xf4ead8;
      const cream = 0xe8d4b0;
      px(ctx, 18, 18, 42, 16, line);
      px(ctx, 20, 20, 38, 12, fur);
      px(ctx, 24, 28, 28, 6, cream);
      px(ctx, 58, 14, 18, 16, line);
      px(ctx, 60, 16, 14, 12, fur);
      px(ctx, 70, 18, 16, 10, line);
      px(ctx, 72, 20, 14, 7, white);
      px(ctx, 84, 22, 6, 4, white);
      px(ctx, 62, 8, 5, 8, line);
      px(ctx, 70, 7, 5, 8, line);
      px(ctx, 63, 9, 3, 5, white);
      px(ctx, 71, 8, 3, 5, white);
      px(ctx, 88, 24, 4, 3, line);
      px(ctx, 74, 26, 10, 2, line);
      px(ctx, 76, 25, 3, 2, 0xf0e8d8);
      circ(ctx, 78, 18, 1.6, 0xf0a020);
      circ(ctx, 78, 18, 0.6, line);
      px(ctx, 8, 6, 14, 5, line);
      px(ctx, 4, 10, 12, 5, fur);
      px(ctx, 10, 14, 12, 5, line);
      px(ctx, 12, 16, 10, 3, fur);
      px(ctx, 16, 20, 8, 4, fur);
      px(ctx, 6, 8, 8, 2, line);
      px(ctx, 5, 12, 7, 2, line);
      px(ctx, 12, 16, 7, 2, line);
      px(ctx, 28, 16, 3, 14, line);
      px(ctx, 36, 15, 3, 16, line);
      px(ctx, 44, 16, 3, 14, line);
      px(ctx, 52, 17, 2, 12, line);
      px(ctx, 22, 32, 5, 12, line);
      px(ctx, 32, 34, 5, 12, line);
      px(ctx, 50, 32, 5, 12, line);
      px(ctx, 62, 34, 5, 12, line);
      px(ctx, 23, 33, 3, 10, dark);
      px(ctx, 33, 35, 3, 10, fur);
      px(ctx, 51, 33, 3, 10, dark);
      px(ctx, 63, 35, 3, 10, fur);
      px(ctx, 22, 42, 6, 3, white);
      px(ctx, 32, 44, 6, 3, white);
      px(ctx, 50, 42, 6, 3, white);
      px(ctx, 62, 44, 6, 3, white);
      px(ctx, 34, 36, 2, 8, line);
      px(ctx, 64, 36, 2, 8, line);
    });
    scene.textures.get("beast-tiger")?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
  if (!stampKeyedSprite(scene, "eagle-src", "beast-eagle", 48)) {
    canvasTex(scene, "beast-eagle", 72, 48, (ctx) => {
      const brown = 0x5a3a18;
      const dark = 0x2a1c10;
      const white = 0xf0e6d2;
      const gold = COLORS.gold;
      fillPoly(ctx, [[8, 18], [28, 4], [36, 16], [18, 28]], brown);
      fillPoly(ctx, [[28, 6], [58, 10], [48, 22], [30, 18]], dark);
      oval(ctx, 40, 24, 16, 9, brown);
      oval(ctx, 56, 20, 10, 8, white);
      fillPoly(ctx, [[62, 18], [72, 22], [62, 24]], gold);
      circ(ctx, 60, 18, 2, 0x1a1210);
      fillPoly(ctx, [[44, 30], [52, 38], [46, 40], [40, 32]], gold);
      fillPoly(ctx, [[36, 32], [32, 42], [38, 40]], gold);
      px(ctx, 50, 38, 3, 2, 0x1a1210);
      px(ctx, 34, 42, 3, 2, 0x1a1210);
      fillPoly(ctx, [[18, 28], [8, 36], [22, 34]], 0x3a2818);
    });
    scene.textures.get("beast-eagle")?.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }
}

function makeWeaponTextures(scene: Phaser.Scene): void {
  canvasTex(scene, "wep-gladius", 46, 16, (ctx) => {
    px(ctx, 0, 5, 9, 6, 0x6b4a28);
    px(ctx, 1, 6, 7, 2, 0x8a6a44);
    px(ctx, 7, 3, 5, 10, COLORS.gold);
    px(ctx, 8, 4, 3, 8, shade(COLORS.gold, 0.25));
    px(ctx, 12, 5, 24, 6, 0xe8e4d4);
    px(ctx, 12, 6, 22, 2, 0xffffff, 0.45);
    ctx.fillStyle = css(0xe8e4d4);
    ctx.beginPath();
    ctx.moveTo(36, 4);
    ctx.lineTo(46, 8);
    ctx.lineTo(36, 12);
    ctx.fill();
  });
  canvasTex(scene, "wep-spear", 56, 14, (ctx) => {
    px(ctx, 0, 5, 38, 4, 0x6b4a28);
    px(ctx, 0, 6, 38, 1, 0x8a6a44);
    px(ctx, 10, 4, 3, 6, COLORS.gold);
    ctx.fillStyle = css(0xe8e4d4);
    ctx.beginPath();
    ctx.moveTo(36, 1);
    ctx.lineTo(56, 7);
    ctx.lineTo(36, 13);
    ctx.fill();
    ctx.fillStyle = css(0xc9c4b4);
    ctx.beginPath();
    ctx.moveTo(40, 4);
    ctx.lineTo(52, 7);
    ctx.lineTo(40, 10);
    ctx.fill();
  });
  canvasTex(scene, "wep-blade", 32, 14, (ctx) => {
    px(ctx, 0, 4, 7, 6, 0x4a3018);
    px(ctx, 6, 4, 16, 6, 0xf0ece0);
    px(ctx, 7, 5, 12, 2, 0xffffff, 0.45);
    ctx.fillStyle = css(0xf0ece0);
    ctx.beginPath();
    ctx.moveTo(22, 3);
    ctx.lineTo(32, 7);
    ctx.lineTo(22, 11);
    ctx.fill();
  });
  canvasTex(scene, "wep-shield", 26, 26, (ctx) => {
    circ(ctx, 13, 13, 12, COLORS.crimson);
    circ(ctx, 13, 13, 10, shade(COLORS.crimson, -0.1));
    circ(ctx, 13, 13, 4, COLORS.gold);
    circ(ctx, 13, 13, 2, shade(COLORS.gold, 0.3));
    ctx.strokeStyle = css(0x3a1c14);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(13, 13, 12, 0, Math.PI * 2);
    ctx.stroke();
    px(ctx, 12, 3, 2, 6, COLORS.gold, 0.7);
  });
  if (!stampKeyedSprite(scene, "axe-src", "wep-axe", 56)) canvasTex(scene, "wep-axe", 62, 44, (ctx) => {
    const ink = 0x1a1210;
    const steel = 0xb8c8d4;
    const steelH = 0xf0f6fc;
    const steelD = 0x6a7a88;
    const gold = 0xe0a034;
    const goldH = 0xf4d070;
    const goldD = 0x8a5418;
    const inlay = 0xc44a18;
    const inlayD = 0x7a2410;
    const wood = 0xb08a48;
    const wrap = 0x3a2410;

    const upper: Array<[number, number]> = [
      [40, 18],
      [36, 12],
      [38, 4],
      [46, 0],
      [54, 3],
      [55, 12],
      [50, 18],
    ];
    const lower: Array<[number, number]> = [
      [40, 26],
      [50, 26],
      [55, 32],
      [54, 41],
      [46, 44],
      [38, 40],
      [36, 32],
    ];
    fillPoly(ctx, upper, ink);
    fillPoly(ctx, lower, ink);
    fillPoly(
      ctx,
      [
        [41, 17],
        [38, 12],
        [39, 5],
        [46, 2],
        [52, 4],
        [53, 12],
        [49, 17],
      ],
      steelD,
    );
    fillPoly(
      ctx,
      [
        [41, 27],
        [49, 27],
        [53, 32],
        [52, 40],
        [46, 42],
        [39, 39],
        [38, 32],
      ],
      steelD,
    );
    fillPoly(
      ctx,
      [
        [42, 15],
        [40, 8],
        [44, 3],
        [50, 4],
        [53, 10],
        [49, 16],
      ],
      steel,
    );
    fillPoly(
      ctx,
      [
        [42, 29],
        [49, 28],
        [53, 34],
        [50, 40],
        [44, 41],
        [40, 36],
      ],
      steel,
    );
    fillPoly(ctx, [[42, 7], [48, 3], [52, 7], [48, 11], [42, 10]], steelH);
    fillPoly(ctx, [[42, 34], [48, 33], [52, 37], [48, 41], [42, 38]], steelH);
    fillPoly(ctx, [[44, 11], [49, 7], [52, 11], [48, 15], [44, 14]], inlayD);
    fillPoly(ctx, [[45, 11], [49, 9], [51, 11], [48, 14]], inlay);
    fillPoly(ctx, [[44, 30], [48, 29], [52, 33], [49, 37], [44, 33]], inlayD);
    fillPoly(ctx, [[45, 31], [49, 30], [51, 33], [48, 35]], inlay);

    px(ctx, 0, 16, 10, 12, ink);
    px(ctx, 1, 17, 8, 10, goldD);
    px(ctx, 2, 18, 6, 8, gold);
    px(ctx, 2, 18, 3, 4, goldH);
    px(ctx, 3, 21, 5, 2, wrap);
    px(ctx, 1, 20, 2, 4, 0x5a2018);

    px(ctx, 8, 17, 30, 10, ink);
    px(ctx, 9, 18, 28, 8, wood);
    px(ctx, 10, 19, 26, 2, shade(wood, 0.2));
    for (let i = 0; i < 7; i++) {
      const x = 11 + i * 4;
      px(ctx, x, 19, 3, 1, wrap);
      px(ctx, x + 1, 21, 3, 1, wrap);
      px(ctx, x, 23, 3, 1, wrap);
      px(ctx, x + 2, 20, 1, 4, wrap, 0.7);
    }

    px(ctx, 34, 15, 8, 14, ink);
    px(ctx, 35, 16, 6, 12, goldD);
    px(ctx, 36, 17, 4, 10, gold);
    px(ctx, 36, 17, 2, 4, goldH);

    px(ctx, 38, 14, 12, 16, ink);
    px(ctx, 39, 15, 10, 14, goldD);
    px(ctx, 40, 16, 8, 12, gold);
    px(ctx, 40, 16, 4, 5, goldH);
    px(ctx, 41, 20, 6, 2, goldD);

    px(ctx, 48, 18, 14, 8, ink);
    px(ctx, 49, 19, 11, 6, goldD);
    px(ctx, 50, 20, 8, 4, gold);
    px(ctx, 56, 20, 4, 4, 0x5a2018);
    px(ctx, 58, 21, 3, 2, 0x3a1010);
  });
  if (!stampKeyedSprite(scene, "hammer-src", "wep-hammer", 50)) canvasTex(scene, "wep-hammer", 44, 22, (ctx) => {
    px(ctx, 0, 9, 22, 4, 0x5a3a18);
    px(ctx, 1, 10, 20, 1, 0x8a6a44);
    px(ctx, 20, 2, 22, 18, 0x6a6a74);
    px(ctx, 22, 4, 18, 14, 0x9a9aa4);
    px(ctx, 24, 6, 14, 4, 0xc9c4b4, 0.7);
    px(ctx, 38, 2, 4, 18, 0x4a4a52);
  });
  canvasTex(scene, "wep-trident", 50, 20, (ctx) => {
    px(ctx, 0, 8, 28, 4, 0x5a3a18);
    px(ctx, 26, 2, 4, 16, 0xc9c4b4);
    px(ctx, 30, 0, 16, 3, 0xc9c4b4);
    px(ctx, 30, 8, 18, 4, 0xe8e4d4);
    px(ctx, 30, 17, 16, 3, 0xc9c4b4);
  });
  canvasTex(scene, "fx-slash", 64, 64, (ctx) => {
    ctx.strokeStyle = css(0xfff4c8, 0.95);
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(32, 32, 26, Phaser.Math.DegToRad(-70), Phaser.Math.DegToRad(70), false);
    ctx.stroke();
    ctx.strokeStyle = css(0xffffff, 0.75);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(32, 32, 22, Phaser.Math.DegToRad(-60), Phaser.Math.DegToRad(60), false);
    ctx.stroke();
  });
  canvasTex(scene, "fx-thrust", 44, 14, (ctx) => {
    px(ctx, 0, 4, 40, 6, 0xfff4c8, 0.9);
    px(ctx, 4, 6, 28, 2, 0xffffff, 0.6);
    ctx.fillStyle = css(0xfff4c8, 0.8);
    ctx.beginPath();
    ctx.moveTo(36, 2);
    ctx.lineTo(44, 7);
    ctx.lineTo(36, 12);
    ctx.fill();
  });
}

function makeDecor(scene: Phaser.Scene): void {
  canvasTex(scene, "prop-column", 36, 72, (ctx) => {
    px(ctx, 4, 62, 28, 10, 0x5a544c);
    px(ctx, 8, 10, 20, 54, 0x9a9488);
    px(ctx, 10, 10, 6, 54, 0xc4bcb0, 0.45);
    px(ctx, 24, 10, 3, 54, 0x6a6458, 0.4);
    px(ctx, 2, 4, 32, 10, 0xc4bcb0);
    px(ctx, 4, 6, 28, 3, 0xe8e0d4, 0.5);
    px(ctx, 6, 0, 24, 6, COLORS.gold, 0.85);
    px(ctx, 8, 1, 20, 2, shade(COLORS.gold, 0.3), 0.5);
  });
  canvasTex(scene, "prop-gate-post", 36, 80, (ctx) => {
    px(ctx, 4, 72, 28, 8, 0x4a4038);
    px(ctx, 6, 74, 24, 3, 0x2a2218, 0.5);
    px(ctx, 8, 12, 20, 62, 0x8a8278);
    px(ctx, 10, 12, 6, 62, 0xc4bcb0, 0.4);
    px(ctx, 24, 12, 3, 62, 0x5a544c, 0.45);
    px(ctx, 9, 28, 18, 3, 0x6a6458);
    px(ctx, 9, 48, 18, 3, 0x6a6458);
    px(ctx, 12, 38, 12, 3, COLORS.gold, 0.7);
    px(ctx, 2, 6, 32, 10, 0xb8b0a4);
    px(ctx, 4, 8, 28, 3, 0xe0d8cc, 0.45);
    px(ctx, 6, 0, 24, 8, 0xc4bcb0);
    px(ctx, 8, 2, 20, 3, COLORS.gold, 0.75);
  });
  canvasTex(scene, "prop-gate-arch", 176, 64, (ctx) => {
    ctx.beginPath();
    ctx.moveTo(6, 64);
    ctx.lineTo(6, 36);
    ctx.quadraticCurveTo(88, 0, 170, 36);
    ctx.lineTo(170, 64);
    ctx.lineTo(148, 64);
    ctx.lineTo(148, 40);
    ctx.quadraticCurveTo(88, 16, 28, 40);
    ctx.lineTo(28, 64);
    ctx.closePath();
    ctx.fillStyle = css(0x8a8278);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(10, 64);
    ctx.lineTo(10, 38);
    ctx.quadraticCurveTo(88, 6, 166, 38);
    ctx.strokeStyle = css(0xc4bcb0, 0.55);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(28, 42);
    ctx.quadraticCurveTo(88, 18, 148, 42);
    ctx.strokeStyle = css(COLORS.gold, 0.9);
    ctx.lineWidth = 2;
    ctx.stroke();
    px(ctx, 80, 6, 16, 22, 0x9a9488);
    px(ctx, 82, 8, 12, 8, 0xc4bcb0);
    px(ctx, 84, 10, 8, 4, COLORS.gold);
    px(ctx, 78, 26, 20, 16, COLORS.crimson);
    px(ctx, 80, 28, 16, 5, shade(COLORS.crimson, 0.12));
    px(ctx, 82, 40, 12, 4, shade(COLORS.crimson, -0.18));
    circ(ctx, 88, 34, 3, COLORS.gold);
    for (let i = 0; i < 9; i++) {
      px(ctx, 36 + i * 12, 38, 3, 14, 0x2a2218, 0.8);
      px(ctx, 36 + i * 12, 50, 3, 3, 0x1a1410, 0.9);
    }
    px(ctx, 34, 36, 108, 3, 0x3a322c, 0.85);
  });
  canvasTex(scene, "prop-torch", 16, 32, (ctx) => {
    px(ctx, 6, 12, 4, 18, 0x5a3a18);
    px(ctx, 5, 8, 6, 6, 0x4a4038);
    circ(ctx, 8, 7, 5, 0xffa030, 0.9);
    circ(ctx, 8, 5, 3, 0xffe080);
    circ(ctx, 8, 4, 1.5, 0xfff8d0);
  });
  canvasTex(scene, "prop-hay", 32, 16, (ctx) => {
    for (let i = 0; i < 18; i++) {
      const x = 2 + (i * 7) % 28;
      const y = 4 + (i % 3) * 3;
      px(ctx, x, y, 8, 1, i % 2 ? 0xc4a66e : 0xa8884c, 0.8);
    }
  });
  canvasTex(scene, "prop-bench", 40, 18, (ctx) => {
    px(ctx, 2, 8, 36, 5, 0x6b4a2f);
    px(ctx, 4, 8, 32, 2, 0x8a6a44);
    px(ctx, 6, 12, 4, 6, 0x5a3a18);
    px(ctx, 30, 12, 4, 6, 0x5a3a18);
  });
  canvasTex(scene, "prop-stall", 56, 52, (ctx) => {
    px(ctx, 6, 28, 44, 20, 0x5a3a18);
    px(ctx, 6, 28, 44, 4, 0x8a6a44);
    px(ctx, 8, 32, 5, 16, 0x4a2c10);
    px(ctx, 43, 32, 5, 16, 0x4a2c10);
    px(ctx, 2, 10, 52, 18, COLORS.crimson);
    px(ctx, 2, 10, 52, 5, shade(COLORS.crimson, 0.18));
    px(ctx, 2, 24, 52, 3, shade(COLORS.crimson, -0.2));
    px(ctx, 26, 0, 4, 14, 0x5a3a18);
    px(ctx, 8, 4, 16, 8, 0xe8dcc8);
    px(ctx, 32, 5, 14, 7, 0x3a2a58);
    circ(ctx, 28, 20, 5, COLORS.gold);
    px(ctx, 12, 34, 10, 8, 0xe8dcc8);
    px(ctx, 24, 36, 10, 8, COLORS.foxOrange);
    px(ctx, 36, 34, 10, 8, 0x2f6b62);
    px(ctx, 14, 36, 6, 2, 0xc4b49a, 0.5);
  });
  makeRug(scene, "tile-feast-rug", 0x6a2420, 0x3a1410, COLORS.gold);
  canvasTex(scene, "prop-feast-table", 84, 36, (ctx) => {
    px(ctx, 8, 26, 10, 10, 0x4a2c10);
    px(ctx, 66, 26, 10, 10, 0x4a2c10);
    px(ctx, 4, 10, 76, 18, 0x5a3a18);
    px(ctx, 6, 10, 72, 5, 0x8a6a44);
    px(ctx, 8, 14, 68, 2, 0x3a2414, 0.45);
    oval(ctx, 22, 16, 6, 4, 0xe8dcc8);
    oval(ctx, 22, 15, 4, 2, 0xc45a1a, 0.85);
    oval(ctx, 42, 17, 8, 4, 0xd8c08a);
    px(ctx, 38, 15, 10, 4, 0xc4a66e);
    oval(ctx, 62, 16, 5, 3, 0xe8dcc8);
    oval(ctx, 62, 15, 3, 2, 0x6a3e24, 0.9);
    px(ctx, 18, 20, 12, 2, 0xf0e6d2, 0.7);
    px(ctx, 50, 20, 14, 2, 0xe8dcc8, 0.55);
  });
  canvasTex(scene, "prop-amphora", 22, 36, (ctx) => {
    px(ctx, 8, 2, 6, 6, 0x6a3e24);
    px(ctx, 9, 0, 4, 4, 0x5a3018);
    oval(ctx, 11, 20, 9, 13, 0x8a4a28);
    oval(ctx, 11, 20, 7, 11, 0xa85a32);
    px(ctx, 4, 14, 4, 8, 0x6a3e24);
    px(ctx, 14, 14, 4, 8, 0x6a3e24);
    oval(ctx, 11, 12, 6, 4, 0x6a3e24);
    px(ctx, 8, 18, 6, 2, COLORS.gold, 0.55);
    oval(ctx, 11, 10, 3, 2, 0x3a2010, 0.5);
  });
  canvasTex(scene, "prop-jug", 18, 24, (ctx) => {
    px(ctx, 6, 2, 6, 4, 0x6a2420);
    oval(ctx, 9, 14, 7, 8, 0x8a3a2a);
    oval(ctx, 9, 14, 5, 6, 0xa84838);
    px(ctx, 13, 8, 4, 7, 0x6a2420);
    oval(ctx, 9, 8, 4, 3, 0x6a2420);
    px(ctx, 7, 12, 4, 2, COLORS.gold, 0.5);
    oval(ctx, 9, 7, 2, 1, 0xc45a1a, 0.8);
  });
  canvasTex(scene, "prop-keg", 30, 32, (ctx) => {
    oval(ctx, 15, 18, 13, 12, 0x5a3a18);
    oval(ctx, 15, 18, 11, 10, 0x7a5230);
    px(ctx, 3, 14, 24, 3, 0x3a2414);
    px(ctx, 3, 22, 24, 3, 0x3a2414);
    oval(ctx, 15, 8, 8, 5, 0x6b4a2f);
    circ(ctx, 15, 18, 3, 0x3a2414);
    circ(ctx, 15, 18, 1.5, 0xc4a66e);
    px(ctx, 14, 6, 2, 4, 0x4a2c10);
  });
  canvasTex(scene, "prop-brazier", 40, 36, (ctx) => {
    px(ctx, 8, 28, 6, 8, 0x3a3a42);
    px(ctx, 26, 28, 6, 8, 0x3a3a42);
    oval(ctx, 20, 22, 16, 8, 0x4a4a52);
    oval(ctx, 20, 20, 14, 6, 0x2a2a32);
    circ(ctx, 20, 16, 8, 0xc45a1a);
    circ(ctx, 20, 14, 5, 0xe07030);
    circ(ctx, 20, 12, 3, 0xffe080);
    px(ctx, 12, 18, 16, 2, 0x6a6458, 0.5);
  });
  canvasTex(scene, "prop-mug-wine", 28, 20, (ctx) => {
    px(ctx, 11, 8, 3, 7, 0x6a2420);
    oval(ctx, 6, 13, 6, 6, 0x6a2420);
    oval(ctx, 6, 13, 4, 4, 0x8a3a2a);
    oval(ctx, 6, 11, 4, 2, 0x4a1410);
    px(ctx, 23, 7, 4, 8, 0x6a2420);
    px(ctx, 25, 8, 2, 6, 0x8a3a2a);
    oval(ctx, 17, 12, 7, 7, 0x6a2420);
    oval(ctx, 17, 12, 5, 5, 0x8a3a2a);
    oval(ctx, 17, 10, 5, 3, 0x4a1410);
    oval(ctx, 17, 9, 4, 2, 0x6a1810, 0.85);
    px(ctx, 14, 11, 6, 2, COLORS.gold, 0.45);
  });
  canvasTex(scene, "prop-mug-beer", 28, 20, (ctx) => {
    px(ctx, 11, 8, 3, 7, 0x5a3a18);
    oval(ctx, 6, 13, 6, 6, 0x5a3a18);
    oval(ctx, 6, 13, 4, 4, 0x7a5230);
    oval(ctx, 6, 11, 4, 2, 0xe8dcc8);
    px(ctx, 23, 7, 4, 8, 0x5a3a18);
    px(ctx, 25, 8, 2, 6, 0x8a6a44);
    oval(ctx, 17, 12, 7, 7, 0x5a3a18);
    oval(ctx, 17, 12, 5, 5, 0x7a5230);
    oval(ctx, 17, 10, 5, 3, 0xc45a1a);
    oval(ctx, 17, 9, 4, 2, 0xe8dcc8);
    px(ctx, 15, 8, 4, 1, 0xf0e6d2, 0.8);
    px(ctx, 14, 11, 6, 2, 0xc4a66e, 0.5);
  });
  canvasTex(scene, "prop-platter", 28, 14, (ctx) => {
    oval(ctx, 14, 8, 12, 5, 0x8a8478);
    oval(ctx, 14, 7, 10, 4, 0xc4bcb0);
    oval(ctx, 14, 7, 6, 2, 0xe8dcc8, 0.7);
    px(ctx, 10, 6, 4, 2, 0xc45a1a, 0.65);
    px(ctx, 16, 6, 3, 2, 0xd8c08a, 0.8);
  });
  canvasTex(scene, "prop-pit-ring", 22, 18, (ctx) => {
    circ(ctx, 11, 10, 8, 0x6a5a28);
    circ(ctx, 11, 10, 6, 0xc4a66e);
    circ(ctx, 11, 10, 4, 0x3a2a10);
    px(ctx, 10, 2, 2, 4, 0x8a6a44);
  });
  canvasTex(scene, "prop-pit-skull", 20, 22, (ctx) => {
    oval(ctx, 10, 10, 8, 7, 0xe8dcc8);
    oval(ctx, 10, 10, 6, 5, 0xf0e6d2);
    circ(ctx, 7, 9, 2, 0x1a1210);
    circ(ctx, 13, 9, 2, 0x1a1210);
    px(ctx, 9, 14, 2, 3, 0x1a1210, 0.7);
    px(ctx, 6, 18, 8, 3, 0xd8c08a);
  });
  canvasTex(scene, "prop-pit-tusk", 24, 20, (ctx) => {
    px(ctx, 4, 14, 16, 4, 0x5a3a18);
    oval(ctx, 6, 10, 4, 8, 0xe8dcc8);
    oval(ctx, 18, 10, 4, 8, 0xe8dcc8);
    px(ctx, 5, 4, 3, 8, 0xf0e6d2);
    px(ctx, 17, 4, 3, 8, 0xf0e6d2);
  });
  canvasTex(scene, "prop-pit-horn", 24, 22, (ctx) => {
    px(ctx, 4, 16, 16, 4, 0x4a4038);
    px(ctx, 6, 6, 4, 12, 0xc4bcb0);
    px(ctx, 14, 4, 4, 14, 0xd8c08a);
    px(ctx, 7, 2, 3, 6, 0xe8dcc8);
    px(ctx, 15, 1, 3, 6, 0xf0e6d2);
  });
  canvasTex(scene, "prop-pit-vine", 18, 36, (ctx) => {
    px(ctx, 8, 0, 3, 36, 0x2f6b4a);
    px(ctx, 4, 8, 10, 2, 0x3a7a48);
    px(ctx, 2, 18, 8, 2, 0x2f6b4a);
    px(ctx, 10, 26, 6, 2, 0x4a8a50);
    circ(ctx, 5, 9, 2, 0xc45a1a, 0.7);
    circ(ctx, 14, 27, 2, 0xc45a1a, 0.6);
  });
  canvasTex(scene, "prop-pit-log", 32, 16, (ctx) => {
    oval(ctx, 16, 8, 14, 6, 0x5a3a18);
    oval(ctx, 16, 8, 12, 4, 0x7a5230);
    circ(ctx, 4, 8, 5, 0x8a6a44);
    circ(ctx, 4, 8, 3, 0x4a2c10);
    px(ctx, 10, 6, 16, 2, 0x3a2414, 0.45);
  });
  canvasTex(scene, "prop-pit-ivory", 18, 40, (ctx) => {
    px(ctx, 6, 8, 6, 28, 0xe8dcc8);
    px(ctx, 7, 8, 2, 28, 0xf0e6d2, 0.7);
    px(ctx, 4, 4, 10, 6, 0xd8c08a);
    px(ctx, 4, 34, 10, 6, 0xc4bcb0);
    px(ctx, 8, 0, 2, 6, COLORS.gold, 0.7);
  });
}

function makeInteriorProps(scene: Phaser.Scene): void {
  makeRug(scene, "tile-rug-armory", 0x6a2420, 0x3a1410, COLORS.gold);
  makeRug(scene, "tile-rug-quarters", 0x5a4a38, 0x3a3024, 0xe8dcc8);
  makeRug(scene, "tile-rug-crimson", COLORS.crimson, 0x4a1418, COLORS.gold);
  makeRug(scene, "tile-rug-ivory", 0xe8dcc8, 0xb8a888, 0x6a4a28);
  makeRug(scene, "tile-rug-eagle", 0x3a2418, 0x1a1210, COLORS.gold);
  canvasTex(scene, "tile-straw", 32, 32, (ctx) => {
    px(ctx, 0, 0, 32, 32, 0x6b4424);
    px(ctx, 0, 0, 32, 1, 0x8a6240, 0.35);
    for (let i = 0; i < 22; i++) {
      const x = (i * 11) % 30;
      const y = 3 + ((i * 7) % 26);
      px(ctx, x, y, 7 + (i % 3), 1, i % 2 ? 0xc4a66e : 0xa8884c, 0.72);
    }
    px(ctx, 8, 14, 10, 1, 0xd8c08a, 0.4);
    px(ctx, 18, 22, 8, 1, 0x8a6a44, 0.5);
  });
  canvasTex(scene, "prop-anvil", 36, 28, (ctx) => {
    px(ctx, 12, 18, 12, 10, 0x5a3a18);
    px(ctx, 10, 16, 16, 4, 0x6b4a28);
    px(ctx, 4, 8, 28, 10, 0x4a4a52);
    px(ctx, 6, 8, 24, 3, 0x7a7a84);
    px(ctx, 2, 10, 8, 6, 0x3a3a42);
    px(ctx, 26, 11, 8, 5, 0x3a3a42);
    px(ctx, 8, 12, 20, 2, 0x2a2a32, 0.5);
  });
  canvasTex(scene, "prop-barrel", 24, 28, (ctx) => {
    oval(ctx, 12, 16, 10, 11, 0x6b4a2f);
    oval(ctx, 12, 16, 8, 9, 0x8a6a44);
    px(ctx, 3, 12, 18, 2, 0x3a2414);
    px(ctx, 3, 18, 18, 2, 0x3a2414);
    oval(ctx, 12, 7, 8, 4, 0x5a3a18);
    oval(ctx, 12, 7, 5, 2, 0x2a1c10, 0.55);
  });
  canvasTex(scene, "prop-bed", 48, 32, (ctx) => {
    drawBed(ctx, 0xe8dcc8, COLORS.crimson);
  });
  canvasTex(scene, "prop-bed-crimson", 48, 32, (ctx) => {
    drawBed(ctx, COLORS.crimson, 0x6a2030);
  });
  canvasTex(scene, "prop-bed-ivory", 48, 32, (ctx) => {
    drawBed(ctx, 0xf0e6d2, 0xe8dcc8);
  });
  canvasTex(scene, "prop-hanging", 28, 48, (ctx) => {
    drawHanging(ctx, COLORS.crimson);
  });
  canvasTex(scene, "prop-hanging-crimson", 28, 48, (ctx) => {
    drawHanging(ctx, COLORS.crimson);
  });
  canvasTex(scene, "prop-hanging-ivory", 28, 48, (ctx) => {
    drawHanging(ctx, 0xe8dcc8);
  });
  canvasTex(scene, "prop-hanging-eagle", 28, 48, (ctx) => {
    drawHanging(ctx, 0x3a2418);
    px(ctx, 10, 16, 8, 2, COLORS.gold, 0.9);
    px(ctx, 12, 14, 4, 10, COLORS.gold, 0.85);
    px(ctx, 8, 18, 12, 2, COLORS.gold, 0.7);
    circ(ctx, 14, 13, 2, COLORS.gold);
  });
  canvasTex(scene, "prop-desk", 40, 28, (ctx) => {
    px(ctx, 4, 20, 8, 8, 0x4a2c10);
    px(ctx, 28, 20, 8, 8, 0x4a2c10);
    px(ctx, 2, 10, 36, 14, 0x6b4a2f);
    px(ctx, 4, 10, 32, 4, 0x8a6a44);
    px(ctx, 6, 16, 16, 4, 0xe8dcc8);
    px(ctx, 8, 17, 12, 1, 0x3a2414, 0.45);
    circ(ctx, 30, 18, 3, COLORS.gold, 0.8);
  });
  canvasTex(scene, "prop-chest", 32, 24, (ctx) => {
    px(ctx, 2, 8, 28, 14, 0x6b4a2f);
    px(ctx, 2, 8, 28, 4, 0x8a6a44);
    px(ctx, 2, 14, 28, 2, 0x3a2414);
    px(ctx, 4, 8, 2, 14, 0x8a6a44);
    px(ctx, 26, 8, 2, 14, 0x3a2414);
    px(ctx, 14, 8, 4, 14, COLORS.gold, 0.85);
    circ(ctx, 16, 15, 2, 0xe8c96a);
    px(ctx, 6, 20, 20, 2, 0x3a2414);
  });
  canvasTex(scene, "prop-shieldstand", 40, 32, (ctx) => {
    px(ctx, 6, 26, 28, 4, 0x4a3018);
    circ(ctx, 14, 16, 11, COLORS.crimson);
    circ(ctx, 14, 16, 8, shade(COLORS.crimson, -0.12));
    circ(ctx, 14, 16, 3, COLORS.gold);
    circ(ctx, 26, 18, 9, 0x4a5c6e);
    circ(ctx, 26, 18, 6, 0x6a7a8a);
    circ(ctx, 26, 18, 2, 0xe8dcc8);
  });
  canvasTex(scene, "prop-lamp", 18, 26, (ctx) => {
    px(ctx, 7, 14, 4, 10, 0x5a3a18);
    px(ctx, 4, 10, 10, 6, 0x4a4038);
    circ(ctx, 9, 8, 6, 0xffc070, 0.85);
    circ(ctx, 9, 6, 3, 0xffe8b0);
  });
  canvasTex(scene, "prop-lintel", 36, 18, (ctx) => {
    px(ctx, 0, 6, 36, 8, 0x5a3a18);
    px(ctx, 2, 6, 32, 3, 0x8a6a44);
    px(ctx, 0, 14, 8, 4, 0x4a3018);
    px(ctx, 28, 14, 8, 4, 0x4a3018);
    px(ctx, 12, 2, 12, 4, COLORS.gold, 0.7);
  });
  canvasTex(scene, "prop-perch", 40, 44, (ctx) => {
    px(ctx, 8, 18, 5, 24, 0x5a3a18);
    px(ctx, 27, 20, 5, 22, 0x4a2c10);
    px(ctx, 6, 40, 10, 4, 0x3a2414);
    px(ctx, 25, 40, 10, 4, 0x3a2414);
    px(ctx, 4, 16, 32, 5, 0x6b4a2f);
    px(ctx, 5, 16, 30, 2, 0x8a6a44);
    px(ctx, 10, 12, 20, 5, 0xc4a66e, 0.85);
    px(ctx, 12, 10, 16, 3, 0xd8c08a, 0.7);
    px(ctx, 14, 8, 4, 1, 0xa8884c, 0.8);
    px(ctx, 22, 9, 5, 1, 0xc4a66e, 0.75);
  });
  canvasTex(scene, "prop-trough", 40, 24, (ctx) => {
    px(ctx, 2, 10, 36, 12, 0x5a3a18);
    px(ctx, 2, 10, 36, 3, 0x8a6a44);
    px(ctx, 4, 12, 32, 8, 0x3a2a18);
    oval(ctx, 20, 16, 13, 5, 0x3a6a78);
    oval(ctx, 20, 15, 10, 3, 0x6a9aaa, 0.7);
    px(ctx, 4, 20, 4, 4, 0x4a2c10);
    px(ctx, 32, 20, 4, 4, 0x4a2c10);
  });
  canvasTex(scene, "prop-feed-bowl", 22, 14, (ctx) => {
    oval(ctx, 11, 8, 10, 5, 0x6a3e24);
    oval(ctx, 11, 7, 8, 3, 0x8a5a32);
    oval(ctx, 11, 7, 5, 2, 0xc4a66e, 0.8);
    px(ctx, 8, 6, 2, 1, 0xa8884c);
    px(ctx, 12, 6, 2, 1, 0xd8c08a);
  });
  canvasTex(scene, "prop-nest", 52, 26, (ctx) => {
    oval(ctx, 26, 16, 24, 9, 0x6b4a2f);
    oval(ctx, 26, 15, 20, 7, 0xc4a66e, 0.9);
    oval(ctx, 26, 14, 12, 4, 0x8a6240, 0.7);
    for (let i = 0; i < 10; i++) {
      px(ctx, 6 + i * 4, 10 + (i % 3), 6, 1, i % 2 ? 0xd8c08a : 0xa8884c, 0.75);
    }
  });
  canvasTex(scene, "prop-collar-hook", 16, 28, (ctx) => {
    px(ctx, 6, 2, 4, 6, 0x4a4038);
    circ(ctx, 8, 10, 4, 0x8a8478);
    circ(ctx, 8, 10, 2, 0x2a2218);
    px(ctx, 7, 14, 2, 10, 0x6a6458);
    circ(ctx, 8, 24, 3, 0x8a8478);
    px(ctx, 4, 22, 8, 2, COLORS.gold, 0.65);
  });
  canvasTex(scene, "prop-trophy-empty", 36, 44, (ctx) => {
    // Stone plinth
    px(ctx, 4, 28, 28, 14, 0x4a4038);
    px(ctx, 6, 28, 24, 3, 0x8a8478);
    px(ctx, 5, 40, 26, 3, 0x3a322c);
    px(ctx, 8, 41, 20, 2, COLORS.gold, 0.55);
    // Wooden niche
    px(ctx, 6, 6, 24, 24, 0x5a3a18);
    px(ctx, 6, 6, 24, 3, 0x8a6a44);
    px(ctx, 8, 9, 20, 18, 0x3a2414);
    px(ctx, 9, 10, 18, 2, 0x6a4a28, 0.45);
    // Mount pegs
    circ(ctx, 12, 14, 2, 0x8a8478);
    circ(ctx, 24, 14, 2, 0x8a8478);
    circ(ctx, 18, 22, 2, 0x6a6458);
    px(ctx, 17, 22, 2, 8, 0x6a6458);
  });
  canvasTex(scene, "prop-trophy-banner", 26, 40, (ctx) => {
    px(ctx, 2, 2, 22, 4, 0x4a4038);
    circ(ctx, 3, 4, 2, COLORS.gold);
    circ(ctx, 23, 4, 2, COLORS.gold);
    px(ctx, 4, 6, 18, 26, 0xe8dcc8);
    px(ctx, 4, 6, 18, 5, 0xffffff, 0.35);
    px(ctx, 4, 6, 18, 26, 0x1a1210, 0.08);
    px(ctx, 12, 6, 2, 24, 0x1a1210, 0.14);
    px(ctx, 4, 32, 6, 5, 0xe8dcc8);
    px(ctx, 16, 32, 6, 5, 0xe8dcc8);
    px(ctx, 5, 35, 4, 3, 0xe8dcc8);
    px(ctx, 17, 35, 4, 3, 0xe8dcc8);
  });
  canvasTex(scene, "prop-dice-table", 88, 48, (ctx) => {
    px(ctx, 18, 36, 8, 12, 0x4a2c10);
    px(ctx, 62, 36, 8, 12, 0x4a2c10);
    oval(ctx, 44, 22, 40, 18, 0x4a2c10);
    oval(ctx, 44, 20, 38, 16, 0x6b4a2f);
    oval(ctx, 44, 20, 32, 12, 0x3a5a38);
    oval(ctx, 44, 20, 30, 10, 0x2a4a28);
    px(ctx, 28, 18, 7, 7, 0xf0ece0);
    circ(ctx, 30, 20, 1, 0x1a1210);
    circ(ctx, 33, 23, 1, 0x1a1210);
    px(ctx, 38, 19, 7, 7, 0xf0ece0);
    circ(ctx, 41, 21, 1, 0x1a1210);
    circ(ctx, 40, 24, 1, 0x1a1210);
    circ(ctx, 44, 24, 1, 0x1a1210);
    oval(ctx, 58, 18, 7, 6, COLORS.crimson);
    px(ctx, 55, 12, 6, 5, 0x8a6a44);
    circ(ctx, 24, 26, 3, COLORS.gold);
    circ(ctx, 30, 28, 2, shade(COLORS.gold, -0.15));
  });
  canvasTex(scene, "prop-dice-lock", 88, 20, (ctx) => {
    oval(ctx, 44, 10, 36, 7, 0x3a322c);
    for (let i = 0; i < 11; i++) {
      circ(ctx, 12 + i * 6, 10, 3, 0x6a6458);
      circ(ctx, 12 + i * 6, 10, 1, 0x8a8478);
    }
  });
  canvasTex(scene, "prop-lararium", 40, 56, (ctx) => {
    px(ctx, 4, 48, 32, 8, 0x4a3018);
    px(ctx, 6, 48, 28, 3, 0x6b4a28);
    px(ctx, 8, 10, 24, 40, 0x5a3a18);
    px(ctx, 10, 12, 20, 36, 0x3a2414);
    px(ctx, 8, 10, 24, 4, 0x8a6a44);
    px(ctx, 12, 6, 16, 6, 0x6b4a28);
    px(ctx, 14, 2, 12, 6, COLORS.gold, 0.85);
    px(ctx, 16, 0, 8, 4, 0xe8c96a);
    circ(ctx, 20, 26, 7, 0xc4bcb0);
    circ(ctx, 20, 24, 5, 0xe8dcc8);
    px(ctx, 18, 22, 2, 2, 0x2a2218);
    px(ctx, 22, 22, 2, 2, 0x2a2218);
    px(ctx, 19, 28, 3, 2, 0x6a2420, 0.7);
    px(ctx, 12, 38, 6, 6, 0xc4a66e);
    px(ctx, 22, 38, 6, 6, 0xc4a66e);
    circ(ctx, 12, 16, 3, 0xffc070, 0.8);
    circ(ctx, 28, 16, 3, 0xffc070, 0.8);
    px(ctx, 10, 44, 20, 2, COLORS.gold, 0.55);
  });
  canvasTex(scene, "prop-altar", 44, 28, (ctx) => {
    px(ctx, 6, 18, 8, 10, 0x6a6458);
    px(ctx, 30, 18, 8, 10, 0x6a6458);
    px(ctx, 4, 8, 36, 14, 0x8a8478);
    px(ctx, 6, 8, 32, 4, 0xc4bcb0);
    px(ctx, 8, 12, 28, 2, COLORS.gold, 0.45);
    oval(ctx, 16, 14, 5, 3, 0x6a2420);
    oval(ctx, 28, 14, 4, 3, 0x4a5c6e);
    circ(ctx, 22, 6, 3, 0xffc070, 0.75);
  });
  canvasTex(scene, "prop-niche-empty", 28, 40, (ctx) => {
    px(ctx, 2, 4, 24, 34, 0x6a6458);
    px(ctx, 4, 6, 20, 30, 0x4a4038);
    px(ctx, 6, 8, 16, 24, 0x3a322c);
    px(ctx, 2, 4, 24, 3, 0x8a8478);
    px(ctx, 10, 34, 8, 4, 0x5a544c);
  });
  canvasTex(scene, "prop-niche-lit", 28, 40, (ctx) => {
    px(ctx, 2, 4, 24, 34, 0x6a6458);
    px(ctx, 4, 6, 20, 30, 0x4a4038);
    px(ctx, 6, 8, 16, 24, 0x2a2218);
    px(ctx, 2, 4, 24, 3, 0xc4a66e);
    circ(ctx, 14, 18, 6, 0xc4bcb0);
    circ(ctx, 14, 16, 4, 0xe8dcc8);
    px(ctx, 12, 14, 2, 2, 0x2a2218);
    px(ctx, 16, 14, 2, 2, 0x2a2218);
    px(ctx, 8, 28, 4, 4, COLORS.gold, 0.7);
    px(ctx, 16, 28, 4, 4, COLORS.gold, 0.7);
    circ(ctx, 8, 12, 2, 0xffc070, 0.75);
    circ(ctx, 20, 12, 2, 0xffc070, 0.75);
    px(ctx, 10, 34, 8, 4, 0x5a544c);
  });
}

const BONE = 0xe8dcc8;
const BONE_D = 0xb8a888;
const BONE_S = 0x8a7a62;
const BONE_H = 0x2a2218;

function boneSkull(ctx: Ctx, cx: number, cy: number, rx: number, ry: number): void {
  oval(ctx, cx, cy, rx, ry, BONE);
  oval(ctx, cx, cy + 1, rx - 2, ry - 2, BONE_D, 0.4);
  oval(ctx, cx - rx * 0.38, cy - 1, 3.5, 4.5, BONE_H);
  oval(ctx, cx + rx * 0.38, cy - 1, 3.5, 4.5, BONE_H);
  oval(ctx, cx, cy + ry * 0.28, 2.5, 2, BONE_H);
  px(ctx, cx - 3, cy + ry * 0.55, 6, 2, BONE_S, 0.7);
}

function boneJaw(ctx: Ctx, cx: number, cy: number, w: number): void {
  px(ctx, cx - w / 2, cy, w, 3, BONE);
  for (let i = 0; i < 4; i++) px(ctx, cx - w / 2 + 2 + i * 3, cy + 2, 1, 3, BONE);
}

function makeTrophySkeletons(scene: Phaser.Scene): void {
  canvasTex(scene, "trophy-skel-serpent", 40, 36, (ctx) => {
    boneSkull(ctx, 12, 10, 8, 7);
    boneJaw(ctx, 12, 16, 10);
    // Coiled vertebrae
    for (let i = 0; i < 6; i++) {
      const t = i / 5;
      const x = 18 + t * 16;
      const y = 14 + Math.sin(t * Math.PI * 2) * 6;
      circ(ctx, x, y, 3, i % 2 ? BONE : BONE_D);
      circ(ctx, x, y, 1, BONE_H, 0.5);
    }
    circ(ctx, 9, 9, 2, BONE_H);
    circ(ctx, 15, 9, 2, BONE_H);
    px(ctx, 8, 8, 2, 1, COLORS.gold, 0.4);
  });
  canvasTex(scene, "trophy-skel-bear", 40, 36, (ctx) => {
    circ(ctx, 8, 10, 5, BONE);
    circ(ctx, 32, 10, 5, BONE);
    circ(ctx, 8, 10, 2, BONE_H);
    circ(ctx, 32, 10, 2, BONE_H);
    boneSkull(ctx, 20, 16, 13, 11);
    boneJaw(ctx, 20, 26, 14);
    px(ctx, 14, 12, 3, 2, BONE_H, 0.35);
    px(ctx, 23, 12, 3, 2, BONE_H, 0.35);
  });
  canvasTex(scene, "trophy-skel-wolf", 40, 36, (ctx) => {
    // Ears
    fillPoly(ctx, [[12, 8], [10, 1], [16, 8]], BONE);
    fillPoly(ctx, [[24, 8], [30, 1], [28, 8]], BONE);
    px(ctx, 11, 3, 2, 4, BONE_D);
    px(ctx, 27, 3, 2, 4, BONE_D);
    boneSkull(ctx, 20, 14, 10, 9);
    // Long snout
    fillPoly(ctx, [[14, 16], [2, 20], [14, 24], [20, 18]], BONE);
    px(ctx, 4, 19, 10, 2, BONE_D);
    boneJaw(ctx, 10, 22, 12);
  });
  canvasTex(scene, "trophy-skel-lion", 40, 36, (ctx) => {
    // Mane ruff of bone plates
    for (const [x, y, r] of [
      [8, 10, 4],
      [32, 10, 4],
      [6, 18, 4],
      [34, 18, 4],
      [12, 6, 3],
      [28, 6, 3],
      [20, 4, 4],
      [10, 24, 3],
      [30, 24, 3],
    ] as const) {
      circ(ctx, x, y, r, BONE_D);
      circ(ctx, x, y, r - 1, BONE_S, 0.35);
    }
    boneSkull(ctx, 20, 16, 10, 9);
    boneJaw(ctx, 20, 24, 12);
  });
  canvasTex(scene, "trophy-skel-bull", 40, 36, (ctx) => {
    boneSkull(ctx, 20, 18, 11, 9);
    // Broad horns
    fillPoly(ctx, [[12, 12], [2, 2], [4, 6], [14, 14]], BONE);
    fillPoly(ctx, [[28, 12], [38, 2], [36, 6], [26, 14]], BONE);
    px(ctx, 1, 2, 5, 2, BONE_D);
    px(ctx, 34, 2, 5, 2, BONE_D);
    circ(ctx, 3, 3, 2, BONE_S);
    circ(ctx, 37, 3, 2, BONE_S);
    boneJaw(ctx, 20, 26, 12);
  });
  canvasTex(scene, "trophy-skel-boar", 40, 36, (ctx) => {
    circ(ctx, 9, 12, 4, BONE);
    circ(ctx, 31, 12, 4, BONE);
    boneSkull(ctx, 20, 16, 10, 9);
    // Tusks
    fillPoly(ctx, [[12, 20], [4, 28], [10, 22]], BONE);
    fillPoly(ctx, [[28, 20], [36, 28], [30, 22]], BONE);
    px(ctx, 4, 26, 6, 2, BONE_D);
    px(ctx, 30, 26, 6, 2, BONE_D);
    boneJaw(ctx, 20, 24, 10);
  });
  canvasTex(scene, "trophy-skel-rhino", 40, 36, (ctx) => {
    boneSkull(ctx, 18, 18, 11, 9);
    // Horn spike
    fillPoly(ctx, [[22, 12], [36, 2], [26, 14], [22, 16]], BONE);
    px(ctx, 30, 4, 6, 2, BONE_D);
    circ(ctx, 34, 4, 2, BONE_S);
    boneJaw(ctx, 18, 26, 12);
  });
  canvasTex(scene, "trophy-skel-elephant", 40, 36, (ctx) => {
    circ(ctx, 8, 12, 5, BONE);
    circ(ctx, 32, 12, 5, BONE);
    circ(ctx, 8, 12, 2, BONE_H);
    circ(ctx, 32, 12, 2, BONE_H);
    boneSkull(ctx, 20, 16, 11, 9);
    // Curved tusks
    fillPoly(ctx, [[12, 20], [2, 28], [6, 30], [14, 22]], BONE);
    fillPoly(ctx, [[28, 20], [38, 28], [34, 30], [26, 22]], BONE);
    px(ctx, 2, 27, 8, 2, BONE_D);
    px(ctx, 30, 27, 8, 2, BONE_D);
    boneJaw(ctx, 20, 24, 12);
  });
  canvasTex(scene, "trophy-skel-tiger", 40, 36, (ctx) => {
    fillPoly(ctx, [[12, 10], [10, 2], [16, 10]], BONE);
    fillPoly(ctx, [[24, 10], [30, 2], [28, 10]], BONE);
    px(ctx, 12, 4, 2, 5, BONE_D);
    px(ctx, 26, 4, 2, 5, BONE_D);
    boneSkull(ctx, 20, 15, 10, 9);
    // Fang snout + stripe marks
    fillPoly(ctx, [[14, 16], [4, 20], [14, 24], [20, 18]], BONE);
    px(ctx, 18, 8, 4, 8, BONE_D, 0.55);
    px(ctx, 6, 19, 8, 2, BONE_D);
    boneJaw(ctx, 12, 22, 12);
  });
  canvasTex(scene, "trophy-skel-eagle", 40, 36, (ctx) => {
    // Beak
    fillPoly(ctx, [[18, 14], [34, 12], [18, 20]], BONE);
    px(ctx, 28, 11, 6, 3, BONE_D);
    boneSkull(ctx, 16, 16, 9, 8);
    // Crest bones
    px(ctx, 10, 6, 4, 7, BONE);
    px(ctx, 14, 4, 3, 6, BONE_D);
    px(ctx, 8, 8, 3, 5, BONE_S);
    // Wing suggestion
    fillPoly(ctx, [[8, 18], [2, 28], [10, 24]], BONE_D);
    fillPoly(ctx, [[22, 20], [36, 26], [24, 24]], BONE_D);
    boneJaw(ctx, 16, 22, 8);
  });
}

function drawDieFace(ctx: Ctx, n: number): void {
  px(ctx, 0, 0, 20, 20, 0x4a4038);
  px(ctx, 1, 1, 18, 18, 0xf0ece0);
  px(ctx, 2, 2, 16, 2, 0xffffff, 0.45);
  const pip = (x: number, y: number) => circ(ctx, x, y, 1.6, 0x1a1210);
  const spots: Record<number, Array<[number, number]>> = {
    1: [[10, 10]],
    2: [[5, 5], [15, 15]],
    3: [[5, 5], [10, 10], [15, 15]],
    4: [[5, 5], [15, 5], [5, 15], [15, 15]],
    5: [[5, 5], [15, 5], [10, 10], [5, 15], [15, 15]],
    6: [[5, 5], [15, 5], [5, 10], [15, 10], [5, 15], [15, 15]],
  };
  for (const [x, y] of spots[n] ?? []) pip(x, y);
}

function drawSuit(ctx: Ctx, suit: string, x: number, y: number, color: number): void {
  if (suit === "hearts") {
    circ(ctx, x - 2, y, 2, color);
    circ(ctx, x + 2, y, 2, color);
    fillPoly(ctx, [[x - 4, y], [x, y + 5], [x + 4, y]], color);
  } else if (suit === "diamonds") {
    fillPoly(ctx, [[x, y - 4], [x + 3, y], [x, y + 4], [x - 3, y]], color);
  } else if (suit === "spades") {
    fillPoly(ctx, [[x, y - 4], [x + 4, y + 1], [x - 4, y + 1]], color);
    circ(ctx, x - 2, y + 1, 2, color);
    circ(ctx, x + 2, y + 1, 2, color);
    px(ctx, x - 1, y + 3, 2, 3, color);
  } else {
    circ(ctx, x, y - 2, 2, color);
    circ(ctx, x - 3, y + 2, 2, color);
    circ(ctx, x + 3, y + 2, 2, color);
    px(ctx, x - 1, y + 2, 2, 4, color);
  }
}

function makeTableGames(scene: Phaser.Scene): void {
  canvasTex(scene, "prop-dice-bowl", 110, 64, (ctx) => {
    oval(ctx, 55, 38, 50, 20, 0x4a3018);
    oval(ctx, 55, 34, 48, 18, 0x6b4a2f);
    oval(ctx, 55, 32, 42, 14, 0x3a2414);
    oval(ctx, 55, 30, 38, 11, 0x5a3a22);
    oval(ctx, 55, 28, 34, 9, 0x2a4a28);
    oval(ctx, 55, 27, 30, 7, 0x1a3a1c);
    px(ctx, 20, 20, 70, 3, 0x8a6a44, 0.45);
    circ(ctx, 40, 26, 2, COLORS.gold, 0.35);
    circ(ctx, 70, 28, 2, COLORS.gold, 0.25);
  });
  for (let n = 1; n <= 6; n++) {
    canvasTex(scene, `dice-face-${n}`, 20, 20, (ctx) => drawDieFace(ctx, n));
  }
  canvasTex(scene, "card-back", 28, 40, (ctx) => {
    px(ctx, 0, 0, 28, 40, 0x1a1210);
    px(ctx, 1, 1, 26, 38, COLORS.crimson);
    px(ctx, 3, 3, 22, 34, shade(COLORS.crimson, -0.15));
    px(ctx, 5, 5, 18, 30, COLORS.gold, 0.35);
    px(ctx, 8, 10, 12, 20, COLORS.crimson);
    circ(ctx, 14, 20, 4, COLORS.gold, 0.7);
  });
  const suits = ["hearts", "diamonds", "clubs", "spades"];
  const labels = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  for (const suit of suits) {
    const red = suit === "hearts" || suit === "diamonds";
    const color = red ? 0xb42c2c : 0x1a1210;
    for (let rank = 1; rank <= 13; rank++) {
      canvasTex(scene, `card-${suit}-${rank}`, 28, 40, (ctx) => {
        px(ctx, 0, 0, 28, 40, 0x3a322c);
        px(ctx, 1, 1, 26, 38, 0xf4ead8);
        ctx.fillStyle = css(color);
        ctx.font = "bold 8px Georgia, serif";
        ctx.fillText(labels[rank - 1] ?? "?", 3, 10);
        drawSuit(ctx, suit, 14, 22, color);
        ctx.fillText(labels[rank - 1] ?? "?", 16, 36);
      });
    }
  }
}

function makeRug(scene: Phaser.Scene, key: string, base: number, dark: number, stitch: number): void {
  canvasTex(scene, key, 32, 32, (ctx) => {
    px(ctx, 0, 0, 32, 32, base);
    px(ctx, 1, 1, 30, 30, shade(base, 0.08));
    px(ctx, 0, 0, 32, 2, dark);
    px(ctx, 0, 30, 32, 2, dark);
    px(ctx, 0, 0, 2, 32, dark);
    px(ctx, 30, 0, 2, 32, dark);
    px(ctx, 4, 4, 24, 1, stitch, 0.55);
    px(ctx, 4, 27, 24, 1, stitch, 0.55);
    for (let y = 8; y < 26; y += 4) px(ctx, 6, y, 20, 1, shade(base, -0.08), 0.35);
    px(ctx, 14, 14, 4, 4, stitch, 0.45);
  });
}

function drawBed(ctx: Ctx, linen: number, blanket: number): void {
  px(ctx, 2, 10, 44, 20, 0x5a3a18);
  px(ctx, 4, 12, 40, 16, 0x8a6a44);
  px(ctx, 6, 14, 36, 12, linen);
  px(ctx, 6, 18, 36, 8, blanket, 0.9);
  px(ctx, 8, 20, 20, 3, shade(blanket, 0.15), 0.45);
  px(ctx, 28, 12, 14, 8, shade(linen, 0.12));
  px(ctx, 30, 14, 10, 4, shade(linen, -0.08));
  px(ctx, 4, 28, 6, 4, 0x4a2c10);
  px(ctx, 38, 28, 6, 4, 0x4a2c10);
}

function drawHanging(ctx: Ctx, color: number): void {
  px(ctx, 2, 2, 24, 3, 0x4a3a2c);
  circ(ctx, 4, 3, 2, COLORS.gold);
  circ(ctx, 24, 3, 2, COLORS.gold);
  px(ctx, 4, 6, 20, 38, color);
  px(ctx, 5, 6, 18, 4, shade(color, 0.12));
  px(ctx, 6, 36, 16, 6, shade(color, -0.18));
  px(ctx, 8, 42, 4, 4, shade(color, -0.28));
  px(ctx, 16, 42, 4, 4, shade(color, -0.28));
}

function makeMenuArt(scene: Phaser.Scene): void {
  canvasTex(scene, "menu-eagle", 120, 96, (ctx) => {
    ctx.fillStyle = css(COLORS.gold);
    ctx.beginPath();
    ctx.moveTo(60, 12);
    ctx.lineTo(88, 40);
    ctx.lineTo(78, 42);
    ctx.lineTo(96, 70);
    ctx.lineTo(68, 52);
    ctx.lineTo(60, 86);
    ctx.lineTo(52, 52);
    ctx.lineTo(24, 70);
    ctx.lineTo(42, 42);
    ctx.lineTo(32, 40);
    ctx.closePath();
    ctx.fill();
    circ(ctx, 60, 22, 8, COLORS.gold);
    circ(ctx, 63, 20, 2, 0x1a1210);
    px(ctx, 66, 18, 8, 3, 0xe8dcc8);
    px(ctx, 56, 28, 8, 10, shade(COLORS.gold, -0.2));
  });
  canvasTex(scene, "menu-banner", 28, 80, (ctx) => {
    px(ctx, 12, 0, 4, 80, 0x4a3a2c);
    px(ctx, 16, 8, 12, 36, COLORS.crimson);
    px(ctx, 16, 12, 10, 8, shade(COLORS.crimson, 0.15), 0.5);
    px(ctx, 16, 44, 8, 8, shade(COLORS.crimson, -0.2));
    circ(ctx, 14, 4, 3, COLORS.gold);
  });
}

function makeHudFrames(scene: Phaser.Scene): void {
  canvasTex(scene, "ui-bar-wood", 200, 44, (ctx) => {
    px(ctx, 0, 0, 200, 44, 0x2a1c16, 0.92);
    ctx.strokeStyle = css(COLORS.gold, 0.85);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, 198, 42);
    px(ctx, 4, 4, 192, 1, shade(COLORS.gold, 0.2), 0.25);
  });
}

const SKIN = 0xe0c090;
const SKIN_D = 0xc4a070;
const METAL = 0xb8b0a0;
const METAL_D = 0x7a7368;
const LEATHER = 0x5a3a18;

export function bodyStyleFor(id: string): BodyStyle {
  if (id === "lanista") return "lanista";
  if (id === "aelia") return "aelia";
  if (id === "brom") return "heavy";
  if (id === "cotta" || id === "lupa" || id === "leo" || id === "taurus" || id === "aper" || id === "tigris" || id === "rhinoceros" || id === "elephas" || id === "tourney_3") return "champion";
  if (id.startsWith("serp") || id === "drusa" || id === "livia" || id === "kaeso" || id === "otho") return "aelia";
  if (id.startsWith("bear") || id === "hostus" || id === "gnaeus" || id === "mera") return "heavy";
  if (id.startsWith("wolf") || id === "acca" || id === "faustus" || id === "neria") return "fox";
  if (id.startsWith("lion") || id.startsWith("tiger") || id === "tourney_1") return "fox";
  if (id.startsWith("bull") || id.startsWith("boar") || id.startsWith("rhino") || id.startsWith("elephant") || id === "tourney_2") return "heavy";
  return "gladiator";
}

export function makeBodyTexture(
  scene: Phaser.Scene,
  key: string,
  tunic: number,
  accent: number,
  scale = 1,
  style: BodyStyle = "gladiator",
  cape = 0,
  scar = "none",
  crest = "",
): void {
  const w = Math.round(48 * scale);
  const h = Math.round(58 * scale);
  canvasTex(scene, key, w, h, (ctx) => {
    drawBody(ctx, w, h, tunic, accent, style, cape, scar, crest);
  });
}

function S(v: number, h: number, base = 58): number {
  return (v * h) / base;
}

function drawCrest(ctx: Ctx, cx: number, h: number, s: number, color: number, crest: string): void {
  const hi = shade(color, 0.28);
  const lo = shade(color, -0.28);
  const inner = mix(color, 0xf0e0c0, 0.45);

  if (crest === "fox") {
    fillPoly(
      ctx,
      [
        [cx - 13 * s, S(1, h)],
        [cx - 10 * s, S(9, h)],
        [cx - 5 * s, S(8, h)],
      ],
      color,
    );
    fillPoly(
      ctx,
      [
        [cx - 12 * s, S(2.2, h)],
        [cx - 9 * s, S(8, h)],
        [cx - 6.2 * s, S(7.4, h)],
      ],
      inner,
    );
    fillPoly(
      ctx,
      [
        [cx + 13 * s, S(1, h)],
        [cx + 5 * s, S(8, h)],
        [cx + 10 * s, S(9, h)],
      ],
      color,
    );
    fillPoly(
      ctx,
      [
        [cx + 12 * s, S(2.2, h)],
        [cx + 6.2 * s, S(7.4, h)],
        [cx + 9 * s, S(8, h)],
      ],
      inner,
    );
    oval(ctx, cx, S(12, h), 3.6 * s, 2 * s, color);
    oval(ctx, cx + 1.4 * s, S(12.4, h), 2.2 * s, 1.2 * s, inner);
    circ(ctx, cx + 3.4 * s, S(12.6, h), 0.65 * s, 0x1a1210);
    return;
  }

  if (crest === "wolf") {
    px(ctx, cx - 10 * s, S(4, h), 3.5 * s, 8 * s, color);
    px(ctx, cx - 9 * s, S(0, h), 2.2 * s, 6 * s, hi);
    px(ctx, cx - 8.4 * s, S(3, h), 1.2 * s, 5 * s, lo);
    px(ctx, cx + 6.5 * s, S(4, h), 3.5 * s, 8 * s, color);
    px(ctx, cx + 6.8 * s, S(0, h), 2.2 * s, 6 * s, hi);
    px(ctx, cx + 7.2 * s, S(3, h), 1.2 * s, 5 * s, lo);
    px(ctx, cx - 2 * s, S(1, h), 4 * s, 5 * s, color);
    px(ctx, cx - 1 * s, S(0, h), 2 * s, 2 * s, hi);
    return;
  }

  if (crest === "bear") {
    fillPoly(
      ctx,
      [
        [cx, S(0, h)],
        [cx + 5.5 * s, S(4.2, h)],
        [cx + 6.2 * s, S(7.4, h)],
        [cx - 6.2 * s, S(7.4, h)],
        [cx - 5.5 * s, S(4.2, h)],
      ],
      lo,
    );
    fillPoly(
      ctx,
      [
        [cx, S(0.6, h)],
        [cx + 4.2 * s, S(4.4, h)],
        [cx + 4.6 * s, S(7.2, h)],
        [cx - 4.6 * s, S(7.2, h)],
        [cx - 4.2 * s, S(4.4, h)],
      ],
      color,
    );
    px(ctx, cx - 1.1 * s, S(0, h), 2.2 * s, 2.4 * s, hi);
    oval(ctx, cx - 8.2 * s, S(3.2, h), 2.3 * s, 2.7 * s, color);
    oval(ctx, cx - 8.2 * s, S(3.5, h), 0.9 * s, 1.2 * s, lo);
    oval(ctx, cx + 8.2 * s, S(3.2, h), 2.3 * s, 2.7 * s, color);
    oval(ctx, cx + 8.2 * s, S(3.5, h), 0.9 * s, 1.2 * s, lo);
    px(ctx, cx - 6.5 * s, S(7.6, h), 13 * s, 2.6 * s, lo);
    fillPoly(
      ctx,
      [
        [cx - 4.5 * s, S(9.5, h)],
        [cx + 4.2 * s, S(9.5, h)],
        [cx + 6.8 * s, S(15.4, h)],
        [cx - 2.2 * s, S(16.2, h)],
      ],
      color,
    );
    fillPoly(
      ctx,
      [
        [cx - 1.4 * s, S(11.6, h)],
        [cx + 3.4 * s, S(11.4, h)],
        [cx + 5.4 * s, S(15.2, h)],
        [cx - 0.2 * s, S(15.6, h)],
      ],
      lo,
    );
    oval(ctx, cx + 4.6 * s, S(14.8, h), 1.6 * s, 1.15 * s, 0x1a1210);
    px(ctx, cx - 3.4 * s, S(9.4, h), 1.8 * s, 1.2 * s, 0x1a1210);
    px(ctx, cx + 1.2 * s, S(9.4, h), 1.8 * s, 1.2 * s, 0x1a1210);
    return;
  }

  if (crest === "serpent") {
    ctx.save();
    ctx.strokeStyle = css(lo);
    ctx.lineWidth = 3.6 * s;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx - 7 * s, S(10, h));
    ctx.bezierCurveTo(cx + 8 * s, S(8, h), cx - 10 * s, S(3, h), cx + 5 * s, S(2, h));
    ctx.stroke();
    ctx.strokeStyle = css(color);
    ctx.lineWidth = 2.6 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 7 * s, S(10, h));
    ctx.bezierCurveTo(cx + 8 * s, S(8, h), cx - 10 * s, S(3, h), cx + 5 * s, S(2, h));
    ctx.stroke();
    ctx.restore();
    fillPoly(
      ctx,
      [
        [cx + 3 * s, S(0.2, h)],
        [cx + 5.5 * s, S(4.2, h)],
        [cx + 12 * s, S(1.6, h)],
      ],
      hi,
    );
    circ(ctx, cx + 6.4 * s, S(1.6, h), 0.8 * s, 0x1a1210);
    px(ctx, cx + 11.5 * s, S(1.1, h), 3.2 * s, 0.8 * s, 0xc44a3a);
    px(ctx, cx + 13.4 * s, S(0.2, h), 0.9 * s, 1.1 * s, 0xc44a3a);
    px(ctx, cx + 13.4 * s, S(2.1, h), 0.9 * s, 1.1 * s, 0xc44a3a);
    return;
  }

  if (crest === "lion") {
    const hx = cx;
    const hy = S(11, h);
    const rimX = 8.4 * s;
    const rimY = 6.1 * s;
    ctx.save();
    ctx.strokeStyle = css(lo);
    ctx.lineWidth = 2.4 * s;
    ctx.beginPath();
    ctx.ellipse(hx, hy, rimX + 0.6 * s, rimY + 0.6 * s, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 - Math.PI / 2;
      const down = Math.sin(ang);
      const len = (down > 0.4 ? 3.1 : 5.8 + (i % 2) * 2.1) * s;
      const x1 = hx + Math.cos(ang) * rimX;
      const y1 = hy + Math.sin(ang) * rimY;
      const x2 = hx + Math.cos(ang) * (rimX + len);
      const y2 = hy + Math.sin(ang) * (rimY + len * 0.82);
      const nx = Math.cos(ang + Math.PI / 2) * 1.45 * s;
      const ny = Math.sin(ang + Math.PI / 2) * 1.45 * s;
      fillPoly(
        ctx,
        [
          [x1 + nx, y1 + ny],
          [x1 - nx, y1 - ny],
          [x2, y2],
        ],
        shade(color, i % 2 ? 0.2 : -0.18),
      );
    }
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2 - Math.PI / 2 + Math.PI / 18;
      const down = Math.sin(ang);
      if (down > 0.55) continue;
      const len = (3.4 + (i % 2) * 1.4) * s;
      const x1 = hx + Math.cos(ang) * (rimX - 0.4 * s);
      const y1 = hy + Math.sin(ang) * (rimY - 0.3 * s);
      const x2 = hx + Math.cos(ang) * (rimX + len);
      const y2 = hy + Math.sin(ang) * (rimY + len * 0.75);
      const nx = Math.cos(ang + Math.PI / 2) * 1.05 * s;
      const ny = Math.sin(ang + Math.PI / 2) * 1.05 * s;
      fillPoly(
        ctx,
        [
          [x1 + nx, y1 + ny],
          [x1 - nx, y1 - ny],
          [x2, y2],
        ],
        shade(hi, i % 2 ? 0.08 : -0.12),
      );
    }
    return;
  }

  if (crest === "bull") {
    px(ctx, cx - 12 * s, S(5, h), 7 * s, 2.4 * s, hi);
    px(ctx, cx - 15 * s, S(2, h), 5 * s, 2.4 * s, color);
    px(ctx, cx - 16 * s, S(0, h), 3.2 * s, 2.6 * s, lo);
    px(ctx, cx + 5 * s, S(5, h), 7 * s, 2.4 * s, hi);
    px(ctx, cx + 10 * s, S(2, h), 5 * s, 2.4 * s, color);
    px(ctx, cx + 13 * s, S(0, h), 3.2 * s, 2.6 * s, lo);
    px(ctx, cx - 3 * s, S(1, h), 6 * s, 5 * s, color);
    px(ctx, cx - 1.5 * s, S(0, h), 3 * s, 2 * s, hi);
    return;
  }

  if (crest === "boar") {
    for (let i = 0; i < 5; i++) {
      const x = cx - 5 * s + i * 2.5 * s;
      fillPoly(
        ctx,
        [
          [x, S(7, h)],
          [x + 2.2 * s, S(7, h)],
          [x + 1.1 * s, S(0, h)],
        ],
        shade(color, i % 2 ? 0.18 : -0.2),
      );
    }
    fillPoly(
      ctx,
      [
        [cx - 3 * s, S(10, h)],
        [cx + 3 * s, S(10, h)],
        [cx + 6 * s, S(14, h)],
        [cx - 1 * s, S(15.5, h)],
      ],
      color,
    );
    oval(ctx, cx + 4.2 * s, S(14.4, h), 1.6 * s, 1.1 * s, lo);
    fillPoly(
      ctx,
      [
        [cx - 6 * s, S(13, h)],
        [cx - 2 * s, S(14, h)],
        [cx - 8 * s, S(8, h)],
      ],
      0xe8dcc8,
    );
    fillPoly(
      ctx,
      [
        [cx + 2 * s, S(13, h)],
        [cx + 6 * s, S(14, h)],
        [cx + 9 * s, S(8, h)],
      ],
      0xe8dcc8,
    );
    circ(ctx, cx - 1.6 * s, S(11, h), 0.7 * s, 0x1a1210);
    circ(ctx, cx + 2.2 * s, S(11, h), 0.7 * s, 0x1a1210);
    return;
  }

  if (crest === "raven") {
    fillPoly(
      ctx,
      [
        [cx - 2 * s, S(7, h)],
        [cx + 4 * s, S(6, h)],
        [cx - 8 * s, S(0, h)],
      ],
      hi,
    );
    fillPoly(
      ctx,
      [
        [cx, S(7, h)],
        [cx + 6 * s, S(6, h)],
        [cx - 2 * s, S(0, h)],
      ],
      color,
    );
    fillPoly(
      ctx,
      [
        [cx + 3 * s, S(7, h)],
        [cx + 8 * s, S(8, h)],
        [cx + 4 * s, S(0.4, h)],
      ],
      lo,
    );
    fillPoly(
      ctx,
      [
        [cx + 5 * s, S(9, h)],
        [cx + 7 * s, S(13, h)],
        [cx + 16 * s, S(10, h)],
      ],
      color,
    );
    fillPoly(
      ctx,
      [
        [cx + 7 * s, S(10.2, h)],
        [cx + 8 * s, S(12.4, h)],
        [cx + 14.5 * s, S(10.4, h)],
      ],
      hi,
    );
    circ(ctx, cx + 6.2 * s, S(8.4, h), 0.85 * s, 0xe8dcc8);
    circ(ctx, cx + 6.4 * s, S(8.4, h), 0.45 * s, 0x1a1210);
    return;
  }

  if (crest === "tiger") {
    px(ctx, cx - 10 * s, S(4, h), 3.6 * s, 8 * s, color);
    px(ctx, cx - 9 * s, S(0, h), 2.2 * s, 6 * s, hi);
    px(ctx, cx - 8.6 * s, S(2, h), 1.1 * s, 6 * s, 0x1a1210);
    px(ctx, cx + 6.4 * s, S(4, h), 3.6 * s, 8 * s, color);
    px(ctx, cx + 6.8 * s, S(0, h), 2.2 * s, 6 * s, hi);
    px(ctx, cx + 7.4 * s, S(2, h), 1.1 * s, 6 * s, 0x1a1210);
    px(ctx, cx - 1.2 * s, S(0, h), 2.4 * s, 7 * s, 0x1a1210);
    px(ctx, cx - 2.4 * s, S(2, h), 4.8 * s, 4 * s, color);
    px(ctx, cx - 0.8 * s, S(1, h), 1.6 * s, 5 * s, 0x1a1210);
    return;
  }

  if (crest === "rhino") {
    fillPoly(
      ctx,
      [
        [cx - 1.2 * s, S(8, h)],
        [cx + 2.4 * s, S(8.4, h)],
        [cx + 12 * s, S(1.2, h)],
      ],
      hi,
    );
    fillPoly(
      ctx,
      [
        [cx - 0.4 * s, S(9.2, h)],
        [cx + 1.6 * s, S(9.4, h)],
        [cx + 10 * s, S(3.2, h)],
      ],
      color,
    );
    px(ctx, cx - 2.4 * s, S(6, h), 6 * s, 5 * s, lo);
    px(ctx, cx - 1.4 * s, S(5.2, h), 4 * s, 3 * s, color);
    return;
  }

  if (crest === "elephant") {
    oval(ctx, cx - 8.4 * s, S(6, h), 4.2 * s, 5.4 * s, color);
    oval(ctx, cx + 8.4 * s, S(6, h), 4.2 * s, 5.4 * s, color);
    oval(ctx, cx - 8.4 * s, S(6.4, h), 2.2 * s, 3.2 * s, 0xd48aa0);
    oval(ctx, cx + 8.4 * s, S(6.4, h), 2.2 * s, 3.2 * s, 0xd48aa0);
    px(ctx, cx - 3.2 * s, S(2, h), 6.4 * s, 6 * s, color);
    px(ctx, cx - 1.6 * s, S(1, h), 3.2 * s, 2.4 * s, hi);
    fillPoly(
      ctx,
      [
        [cx - 4 * s, S(10, h)],
        [cx - 1.2 * s, S(12, h)],
        [cx - 8 * s, S(16, h)],
      ],
      0xf4ead8,
    );
    fillPoly(
      ctx,
      [
        [cx + 1.2 * s, S(10, h)],
        [cx + 4 * s, S(12, h)],
        [cx + 8 * s, S(16, h)],
      ],
      0xf4ead8,
    );
    return;
  }

  const plume = color;
  for (let i = 0; i < 6; i++) {
    px(ctx, cx - 3 * s + i * s, S(1, h), 2 * s, 8 * s + (i % 2) * 2 * s, shade(plume, i % 2 ? 0.1 : -0.1));
  }
}

function drawBody(ctx: Ctx, w: number, h: number, tunic: number, accent: number, style: BodyStyle, cape = 0, scar = "none", crest = ""): void {
  const cx = w / 2;
  const s = h / 58;
  const skin = style === "heavy" ? mix(SKIN, 0x8a5a30, 0.15) : SKIN;
  const wide = style === "heavy" ? 1.18 : style === "lanista" ? 1.08 : style === "fox" ? 0.86 : 1;

  px(ctx, cx - 7 * s * wide, S(42, h), 5 * s, 12 * s, 0x3a2a18);
  px(ctx, cx + 2 * s * wide, S(42, h), 5 * s, 12 * s, 0x3a2a18);
  px(ctx, cx - 7 * s * wide, S(51, h), 5 * s, 3 * s, LEATHER);
  px(ctx, cx + 2 * s * wide, S(51, h), 5 * s, 3 * s, LEATHER);

  px(ctx, cx - 6 * s * wide, S(34, h), 4 * s, 10 * s, skin);
  px(ctx, cx + 2 * s * wide, S(34, h), 4 * s, 10 * s, skin);

  for (let i = 0; i < 5; i++) {
    const x = cx - 8 * s * wide + i * 3.4 * s * wide;
    px(ctx, x, S(32, h), 2 * s, 8 * s, shade(LEATHER, i % 2 ? 0.08 : -0.05));
  }

  const tw = 18 * s * wide;

  if (cape) {
    px(ctx, cx - tw / 2 - 5 * s, S(18, h), 7 * s, 28 * s, shade(cape, -0.12));
    px(ctx, cx + tw / 2 - 2 * s, S(18, h), 7 * s, 28 * s, shade(cape, 0.06));
    px(ctx, cx - tw / 2 - 4 * s, S(18, h), 5 * s, 3 * s, shade(cape, 0.18));
    px(ctx, cx + tw / 2 - 1 * s, S(18, h), 5 * s, 3 * s, shade(cape, 0.22));
  }

  px(ctx, cx - tw / 2, S(18, h), tw, 18 * s, tunic);
  px(ctx, cx - tw / 2, S(18, h), tw, 5 * s, shade(tunic, 0.16));
  px(ctx, cx - tw / 2 + 2 * s, S(22, h), 4 * s, 10 * s, shade(tunic, 0.22), 0.45);
  px(ctx, cx + tw / 2 - 3 * s, S(20, h), 2 * s, 14 * s, shade(tunic, -0.2), 0.45);

  px(ctx, cx - tw / 2, S(32, h), tw, 3 * s, accent);
  px(ctx, cx - tw / 2, S(32, h), tw, 1 * s, shade(accent, 0.3), 0.5);

  if (cape) {
    px(ctx, cx - 6 * s, S(17, h), 12 * s, 3 * s, shade(cape, 0.12));
  }

  if (style === "lanista") {
    px(ctx, cx - tw / 2 - 4 * s, S(20, h), 6 * s, 22 * s, mix(tunic, 0xe8dcc8, 0.35));
    px(ctx, cx + tw / 2 - 2 * s, S(20, h), 6 * s, 22 * s, mix(tunic, 0xffffff, 0.2));
  }

  px(ctx, cx - 12 * s * wide, S(20, h), 5 * s, 14 * s, skin);
  px(ctx, cx + 7 * s * wide, S(20, h), 5 * s, 14 * s, skin);
  px(ctx, cx - 12 * s * wide, S(18, h), 5 * s, 4 * s, tunic);
  px(ctx, cx + 7 * s * wide, S(18, h), 5 * s, 4 * s, tunic);

  const hy = S(12, h);
  circ(ctx, cx, hy, 7 * s, skin);
  circ(ctx, cx - 1 * s, hy - 1 * s, 3 * s, shade(skin, 0.2), 0.35);

  if (style === "lanista") {
    px(ctx, cx - 7 * s, S(6, h), 14 * s, 5 * s, 0xc8c0b0);
    px(ctx, cx - 8 * s, S(8, h), 4 * s, 4 * s, 0xc8c0b0);
    px(ctx, cx + 4 * s, S(8, h), 4 * s, 4 * s, 0xc8c0b0);
    for (let i = 0; i < 5; i++) circ(ctx, cx - 6 * s + i * 3 * s, S(5, h), 1.4 * s, COLORS.gold);
    px(ctx, cx - 2 * s, hy + 2 * s, 4 * s, 2 * s, 0x6a4a38, 0.5);
  } else if (style === "aelia") {
    px(ctx, cx - 7 * s, S(6, h), 14 * s, 6 * s, 0x2a221c);
    circ(ctx, cx + 6 * s, S(10, h), 4 * s, 0x2a221c);
    px(ctx, cx - 6 * s, S(8, h), 12 * s, 3 * s, METAL);
    circ(ctx, cx - 2.5 * s, hy, 1.2 * s, 0x1a1210);
    circ(ctx, cx + 2.5 * s, hy, 1.2 * s, 0x1a1210);
  } else {
    const helm = style === "champion" ? mix(METAL, accent, 0.15) : METAL;
    px(ctx, cx - 8 * s, S(6, h), 16 * s, 10 * s, helm);
    px(ctx, cx - 8 * s, S(6, h), 16 * s, 3 * s, shade(helm, 0.2));
    px(ctx, cx - 2 * s, S(10, h), 4 * s, 7 * s, shade(helm, -0.25));
    px(ctx, cx - 7 * s, S(14, h), 5 * s, 3 * s, shade(helm, -0.1));
    px(ctx, cx + 2 * s, S(14, h), 5 * s, 3 * s, shade(helm, -0.1));
    drawCrest(ctx, cx, h, s, accent, crest);
    if (style === "heavy") {
      px(ctx, cx - 3 * s, hy + 2 * s, 6 * s, 2 * s, 0x6a4a38, 0.45);
    }
  }

  if (scar === "sash") {
    px(ctx, cx - tw / 2 + 1 * s, S(24, h), tw - 2 * s, 3 * s, 0x4a2018, 0.75);
  }
  if (scar === "cheek") {
    px(ctx, cx + 2 * s, hy + 1 * s, 4 * s, 1.4 * s, 0x6a3030, 0.85);
    px(ctx, cx + 3 * s, hy + 2 * s, 3 * s, 1 * s, 0x8a4840, 0.55);
  }
  if (scar === "brow") {
    px(ctx, cx - 4 * s, hy - 3 * s, 8 * s, 1.5 * s, 0x5a2828, 0.8);
  }
  void SKIN_D;
  void METAL_D;
}
