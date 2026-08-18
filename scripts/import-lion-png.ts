/**
 * Import a lion PNG into public/beasts/lion.png (magenta keyed, cropped).
 * Usage: npm run import:lion -- path/to/lion.png [--flip]
 */
import { createCanvas, loadImage } from "canvas";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { dirname, isAbsolute, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outPath = join(root, "public", "beasts", "lion.png");
const args = process.argv.slice(2).filter((a) => a !== "--");
const flip = args.includes("--flip");
const srcArg = args.find((a) => !a.startsWith("--"));

function resolveSrc(): string | null {
  if (srcArg) {
    const direct = isAbsolute(srcArg) ? srcArg : join(process.cwd(), srcArg);
    if (existsSync(direct)) return direct;
  }
  const fallback = join(
    process.env.USERPROFILE ?? "",
    ".cursor",
    "projects",
    "c-Users-lukea-OneDrive-Desktop-Video-Games",
    "assets",
    "lion-original.png",
  );
  return existsSync(fallback) ? fallback : null;
}

function isMagenta(r: number, g: number, b: number, a: number): boolean {
  if (a < 16) return true;
  return r > 150 && b > 150 && g < 150 && r + b > g * 2.2;
}

function isBlackBg(r: number, g: number, b: number, a: number): boolean {
  if (a < 16) return true;
  return r < 28 && g < 28 && b < 28;
}

function floodBackground(data: Uint8ClampedArray, w: number, h: number, mode: "magenta" | "black"): void {
  const drop = new Uint8Array(w * h);
  const stack: number[] = [];
  const isBg = mode === "magenta" ? isMagenta : isBlackBg;
  const tryDrop = (x: number, y: number): void => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (drop[p]) return;
    const i = p * 4;
    if (!isBg(data[i], data[i + 1], data[i + 2], data[i + 3])) return;
    drop[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) {
    tryDrop(x, 0);
    tryDrop(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    tryDrop(0, y);
    tryDrop(w - 1, y);
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
  for (let p = 0; p < w * h; p++) {
    if (!drop[p]) continue;
    const i = p * 4;
    data[i + 3] = 0;
  }
}

async function main(): Promise<void> {
  const srcPath = resolveSrc();
  if (!srcPath) {
    console.error("Lion PNG not found. Pass path: npm run import:lion -- path/to/lion.png");
    process.exit(1);
  }

  const img = await loadImage(srcPath);
  const stage = createCanvas(img.width, img.height);
  const sctx = stage.getContext("2d")!;
  sctx.imageSmoothingEnabled = false;
  if (flip) {
    sctx.translate(img.width, 0);
    sctx.scale(-1, 1);
  }
  sctx.drawImage(img, 0, 0);

  const raw = sctx.getImageData(0, 0, img.width, img.height);
  const mode: "magenta" | "black" = isMagenta(raw.data[0], raw.data[1], raw.data[2], raw.data[3]) ? "magenta" : "black";
  floodBackground(raw.data, img.width, img.height, mode);
  sctx.putImageData(raw, 0, 0);

  let minX = img.width;
  let minY = img.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (raw.data[(y * img.width + x) * 4 + 3] < 16) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  const pad = 2;
  minX = Math.max(0, minX - pad);
  minY = Math.max(0, minY - pad);
  maxX = Math.min(img.width - 1, maxX + pad);
  maxY = Math.min(img.height - 1, maxY + pad);
  const cw = maxX - minX + 1;
  const ch = maxY - minY + 1;

  const out = createCanvas(cw, ch);
  const octx = out.getContext("2d")!;
  octx.imageSmoothingEnabled = false;
  octx.fillStyle = "#ff00ff";
  octx.fillRect(0, 0, cw, ch);
  octx.drawImage(stage, minX, minY, cw, ch, 0, 0, cw, ch);

  const outData = octx.getImageData(0, 0, cw, ch);
  for (let i = 0; i < outData.data.length; i += 4) {
    if (outData.data[i + 3] < 16 || isMagenta(outData.data[i], outData.data[i + 1], outData.data[i + 2], outData.data[i + 3])) {
      outData.data[i] = 255;
      outData.data[i + 1] = 0;
      outData.data[i + 2] = 255;
      outData.data[i + 3] = 255;
    }
  }
  octx.putImageData(outData, 0, 0);

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, out.toBuffer("image/png"));
  console.log(`Imported ${srcPath}`);
  console.log(`Wrote ${outPath} (${cw}x${ch})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
