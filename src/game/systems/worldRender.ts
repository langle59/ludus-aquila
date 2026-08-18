import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "../config";
import type { BuiltMap } from "../maps/maps";

const VARIANT_BASES = new Set([
  "tile-sand",
  "tile-sand-coil",
  "tile-sand-mud",
  "tile-sand-stripe",
  "tile-sand-stone",
  "tile-sand-ivory",
  "tile-sand-earth",
  "tile-dirt",
  "tile-stone",
  "tile-shrine",
  "tile-wood",
  "tile-wood-pale",
  "tile-wood-dark",
  "tile-yard",
  "tile-wall",
]);

function variantTex(scene: Phaser.Scene, tex: string, x: number, y: number): string {
  if (!VARIANT_BASES.has(tex)) return tex;
  const n = ((x * 13 + y * 31) >>> 0) % 6;
  if (n === 0) return tex;
  const key = `${tex}-${n}`;
  return scene.textures.exists(key) ? key : tex;
}

export function paintMap(
  scene: Phaser.Scene,
  built: BuiltMap,
  mood: "ludus" | "arena" | "freedcamp" | "raid" = "ludus",
): Phaser.Physics.Arcade.StaticGroup {
  const solids = scene.physics.add.staticGroup();
  const wallSet = new Set<string>();
  for (const s of built.solids) {
    wallSet.add(`${Math.floor(s.x / TILE_SIZE)},${Math.floor(s.y / TILE_SIZE)}`);
  }

  for (const t of built.tiles) {
    const key = variantTex(scene, t.tex, t.x, t.y);
    scene.add.image(t.x, t.y, key).setOrigin(0).setDepth(0);
  }

  for (const t of built.tiles) {
    if (!t.tex.startsWith("tile-wall") && t.tex !== "tile-column" && t.tex !== "tile-fence") continue;
    const tx = t.x / TILE_SIZE;
    const ty = t.y / TILE_SIZE;
    const below = `${tx},${ty + 1}`;
    if (!wallSet.has(below)) {
      scene.add.image(t.x, t.y + TILE_SIZE - 2, "tile-wall-shadow").setOrigin(0).setDepth(1).setAlpha(0.85);
    }
  }

  for (const s of built.solids) {
    const block = solids.create(s.x, s.y, "tile-wall") as Phaser.Physics.Arcade.Sprite;
    block.setVisible(false);
    block.setDisplaySize(TILE_SIZE, TILE_SIZE);
    block.refreshBody();
  }
  scene.physics.world.setBounds(0, 0, built.cols * TILE_SIZE, built.rows * TILE_SIZE);

  paintDecor(scene, built, mood);
  paintAtmosphere(scene, built, mood);
  return solids;
}

const LUDUS_MIRROR_X = 47;

function wallKeysFromBuilt(built: BuiltMap): Set<string> {
  const walls = new Set<string>();
  for (const t of built.tiles) {
    if (t.tex.startsWith("tile-wall") || t.tex === "tile-fence" || t.tex.includes("banner")) {
      walls.add(`${t.x / TILE_SIZE},${t.y / TILE_SIZE}`);
    }
  }
  return walls;
}

/** Curated mounts — only kept if that cell is actually a wall/fence/banner. */
function ludusWallTorches(walls: Set<string>): { x: number; y: number }[] {
  const candidates: { x: number; y: number }[] = [
    // Outer north rim
    { x: 4, y: 0 },
    { x: 18, y: 0 },
    { x: 30, y: 0 },
    { x: 42, y: 0 },
    { x: 54, y: 0 },
    // Lanista office
    { x: 16, y: 5 },
    { x: 24, y: 5 },
    { x: 26, y: 2 },
    // Armory
    { x: 10, y: 7 },
    { x: 10, y: 11 },
    { x: 3, y: 12 },
    { x: 7, y: 12 },
    // Hall walls
    { x: 26, y: 7 },
    { x: 26, y: 11 },
    { x: 29, y: 12 },
    { x: 34, y: 12 },
    { x: 40, y: 12 },
    { x: 45, y: 12 },
    { x: 47, y: 3 },
    { x: 47, y: 7 },
    { x: 47, y: 11 },
    // Quarters / chamber shell
    { x: 49, y: 7 },
    { x: 49, y: 11 },
    { x: 54, y: 6 },
    { x: 60, y: 8 },
    // Roost
    { x: 1, y: 14 },
    { x: 6, y: 14 },
    { x: 12, y: 16 },
    { x: 12, y: 19 },
    { x: 6, y: 21 },
    // Shrine
    { x: 2, y: 22 },
    { x: 13, y: 22 },
    { x: 15, y: 25 },
    { x: 3, y: 29 },
    { x: 12, y: 29 },
    // Training yard fence posts
    { x: 16, y: 13 },
    { x: 16, y: 24 },
    { x: 28, y: 13 },
    { x: 28, y: 24 },
    { x: 42, y: 13 },
    { x: 47, y: 13 },
    { x: 47, y: 24 },
    { x: 16, y: 20 },
    { x: 47, y: 20 },
    // Feast
    { x: 48, y: 26 },
    { x: 54, y: 26 },
    { x: 60, y: 26 },
    { x: 48, y: 33 },
    { x: 60, y: 33 },
    { x: 48, y: 29 },
    // Drill compound (when present)
    { x: 48, y: 13 },
    { x: 54, y: 13 },
    { x: 60, y: 13 },
    { x: 48, y: 25 },
    { x: 60, y: 25 },
    // Arena gate row
    { x: 3, y: 30 },
    { x: 14, y: 30 },
    { x: 28, y: 30 },
    { x: 44, y: 30 },
    // Map edge
    { x: 0, y: 8 },
    { x: 0, y: 18 },
    { x: 0, y: 28 },
  ];

  const placed: { x: number; y: number }[] = [];
  const seen = new Set<string>();
  const add = (tx: number, ty: number) => {
    const key = `${tx},${ty}`;
    if (seen.has(key) || !walls.has(key)) return;
    seen.add(key);
    placed.push({ x: tx, y: ty });
  };

  for (const t of candidates) {
    add(t.x, t.y);
    const mx = LUDUS_MIRROR_X - t.x;
    if (mx !== t.x) add(mx, t.y);
  }
  return placed;
}

function arenaWallTorches(cols: number, rows: number): { x: number; y: number }[] {
  const right = cols - 1;
  const bottom = rows - 1;
  const left = [
    { x: 4, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 5 },
    { x: 0, y: 16 },
    { x: 4, y: bottom },
    { x: 10, y: bottom },
  ];
  const placed: { x: number; y: number }[] = [];
  for (const t of left) {
    placed.push(t);
    const mx = right - t.x;
    if (mx !== t.x) placed.push({ x: mx, y: t.y });
  }
  return placed;
}

function paintDecor(scene: Phaser.Scene, built: BuiltMap, mood: "ludus" | "arena" | "freedcamp" | "raid"): void {
  for (const t of built.tiles) {
    if (t.tex === "tile-column") {
      scene.add
        .image(t.x + TILE_SIZE / 2, t.y + 4, "prop-column")
        .setOrigin(0.5, 1)
        .setDepth(t.y + 40);
    }
  }

  if (mood === "ludus") {
    const ring = built.spawns.dummy ?? { x: 32 * TILE_SIZE, y: 19 * TILE_SIZE };
    const ringX = ring.x;
    const ringY = ring.y;
    const g = scene.add.graphics().setDepth(2);
    g.lineStyle(5, 0xc4a66e, 0.7);
    g.strokeCircle(ringX, ringY, 118);
    g.lineStyle(3, 0x6b4a28, 0.5);
    g.strokeCircle(ringX, ringY, 108);
    g.lineStyle(1, 0xe8c96a, 0.35);
    g.strokeCircle(ringX, ringY, 36);
    g.lineStyle(1, 0x8a6a44, 0.28);
    g.strokeCircle(ringX, ringY, 68);

    const walls = wallKeysFromBuilt(built);
    for (const t of ludusWallTorches(walls)) {
      placeTorch(scene, t.x * TILE_SIZE + 16, t.y * TILE_SIZE + 10);
    }
    placeHangBanners(scene, built, COLORS.crimson);
  } else {
    for (const t of arenaWallTorches(built.cols, built.rows)) {
      placeTorch(scene, t.x * TILE_SIZE + 16, t.y * TILE_SIZE + 8, built.torchTint);
    }
    if (mood === "arena") placeHangBanners(scene, built, built.torchTint ?? COLORS.crimson);
  }
}

function placeHangBanners(scene: Phaser.Scene, built: BuiltMap, tint: number): void {
  let n = 0;
  for (const t of built.tiles) {
    if (!t.tex.startsWith("tile-banner") && t.tex !== "tile-wall") continue;
    const tx = t.x / TILE_SIZE;
    const ty = t.y / TILE_SIZE;
    if (ty > 2 && t.tex !== "tile-banner-red" && !t.tex.startsWith("tile-banner")) continue;
    if (((tx * 7 + ty * 13) >>> 0) % 5 !== 0) continue;
    if (n >= 14) break;
    n += 1;
    const hang = scene.add
      .image(t.x + TILE_SIZE / 2, t.y + 6, "prop-hang-banner")
      .setOrigin(0.5, 0)
      .setDepth(t.y + 18)
      .setTint(tint);
    scene.tweens.add({
      targets: hang,
      angle: n % 2 ? 3 : -3,
      duration: 1400 + n * 70,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }
}

function placeTorch(scene: Phaser.Scene, x: number, y: number, tint?: number): void {
  scene.add.image(x, y, "prop-torch").setDepth(y + 8);
  const glow = scene.add.image(x, y - 6, "fx-glow").setDepth(y + 7).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
  if (tint) glow.setTint(tint);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.35, to: 0.7 },
    scale: { from: 0.85, to: 1.15 },
    duration: 420 + Math.random() * 200,
    yoyo: true,
    repeat: -1,
  });
  addFloorPool(scene, x, y + 10, tint);
}

function addFloorPool(scene: Phaser.Scene, x: number, y: number, tint?: number, scale = 2.15): void {
  const pool = scene.add
    .image(x, y, "fx-glow")
    .setDepth(2)
    .setAlpha(0.22)
    .setScale(scale)
    .setBlendMode(Phaser.BlendModes.ADD);
  if (tint) pool.setTint(tint);
  scene.tweens.add({
    targets: pool,
    alpha: { from: 0.14, to: 0.28 },
    scale: { from: scale * 0.92, to: scale * 1.08 },
    duration: 520 + Math.random() * 180,
    yoyo: true,
    repeat: -1,
  });
}

export function animateBrazier(scene: Phaser.Scene, x: number, y: number): void {
  const glow = scene.add.image(x, y - 10, "fx-glow").setDepth(y + 4).setAlpha(0.5).setScale(0.85).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.28, to: 0.7 },
    scale: { from: 0.7, to: 1.15 },
    duration: 380 + Math.random() * 160,
    yoyo: true,
    repeat: -1,
  });
  addFloorPool(scene, x, y + 8, 0xffc070, 2.4);
  for (let i = 0; i < 3; i++) {
    const mote = scene.add.image(x + (i - 1) * 5, y - 8, "fx-mote").setDepth(y + 5).setTint(0xffc070).setAlpha(0.7);
    scene.tweens.add({
      targets: mote,
      y: y - 22 - i * 4,
      alpha: 0,
      duration: 900 + i * 180,
      repeat: -1,
      delay: i * 120,
    });
  }
}

export function placeLamp(scene: Phaser.Scene, x: number, y: number, night = false): void {
  scene.add.image(x, y, "prop-lamp").setDepth(y + 6);
  const baseA = night ? 0.55 : 0.4;
  const scale = night ? 1.05 : 0.7;
  const glow = scene.add
    .image(x, y - 8, "fx-glow")
    .setDepth(y + 5)
    .setAlpha(baseA)
    .setScale(scale)
    .setTint(night ? 0xffb060 : 0xffffff)
    .setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: glow,
    alpha: { from: night ? 0.35 : 0.22, to: night ? 0.7 : 0.5 },
    scale: { from: night ? 0.85 : 0.55, to: night ? 1.2 : 0.8 },
    duration: 640 + Math.random() * 180,
    yoyo: true,
    repeat: -1,
  });
  addFloorPool(scene, x, y + 6, night ? 0xffb060 : 0xffe08a, night ? 2.3 : 1.7);
}

export function paintAtmosphere(scene: Phaser.Scene, built: BuiltMap, mood: "ludus" | "arena" | "freedcamp" | "raid"): void {
  const w = built.cols * TILE_SIZE;
  const h = built.rows * TILE_SIZE;
  const night = mood === "raid";

  const washColor = night
    ? 0x243858
    : mood === "arena"
      ? built.torchTint ?? 0xc45a1a
      : mood === "freedcamp"
        ? 0x3a6a48
        : 0xd4a84b;
  const washAlpha = night ? 0.16 : mood === "arena" ? 0.12 : mood === "freedcamp" ? 0.1 : 0.07;
  const wash = scene.add.rectangle(w / 2, h / 2, w, h, washColor, washAlpha);
  wash.setDepth(4);
  wash.setBlendMode(Phaser.BlendModes.ADD);

  if (night) {
    scene.add.rectangle(w / 2, h / 2, w, h, 0x0a1830, 0.18).setDepth(4.5);
    for (let i = 0; i < 3; i++) {
      const sx = w * (0.22 + i * 0.28);
      scene.add
        .image(sx, h * 0.18, "fx-shaft")
        .setDepth(5)
        .setAlpha(0.18)
        .setScale(1.4 + i * 0.15, 1.6)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAngle(-6 + i * 5);
    }
  }

  const vg = scene.add
    .image(GAME_WIDTH / 2, GAME_HEIGHT / 2, "fx-vignette")
    .setScrollFactor(0)
    .setDepth(2500)
    .setDisplaySize(GAME_WIDTH, GAME_HEIGHT)
    .setAlpha(night ? 1 : mood === "freedcamp" ? 0.85 : 0.78);
  if (night) vg.setTint(0x6a88b0);
  else if (mood === "freedcamp") vg.setTint(0x3a6a48);
  else if (mood === "arena") vg.setTint(built.torchTint ?? 0xc45a1a);

  const motes = night ? 14 : mood === "arena" ? 22 : 32;
  for (let i = 0; i < motes; i++) {
    const m = scene.add
      .image(Math.random() * w, Math.random() * h, "fx-mote")
      .setDepth(6)
      .setAlpha(night ? 0.07 + Math.random() * 0.12 : 0.16 + Math.random() * 0.28)
      .setScale(0.5 + Math.random() * 1.1);
    if (mood === "freedcamp") m.setTint(0xa8d090);
    if (night) m.setTint(0x6a8ab0);
    if (mood === "arena") m.setTint(0xffe08a);
    scene.tweens.add({
      targets: m,
      y: m.y - (40 + Math.random() * 90),
      x: m.x + Phaser.Math.Between(-28, 28),
      alpha: 0,
      duration: 4800 + Math.random() * 4200,
      repeat: -1,
      onRepeat: () => {
        m.setPosition(Math.random() * w, Math.random() * h);
        m.setAlpha(night ? 0.07 + Math.random() * 0.12 : 0.18 + Math.random() * 0.28);
      },
    });
  }

  if (mood === "arena") {
    for (let i = 0; i < 4; i++) {
      const haze = scene.add
        .image(w * (0.2 + i * 0.2), h * 0.45, "fx-glow")
        .setDepth(5)
        .setAlpha(0.08)
        .setScale(3.4, 1.15)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(0xffc070);
      scene.tweens.add({
        targets: haze,
        y: haze.y - 18,
        alpha: { from: 0.05, to: 0.12 },
        duration: 2200 + i * 180,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  if (night) scene.cameras.main.fadeIn(900, 4, 8, 16);
  else scene.cameras.main.fadeIn(700, 18, 10, 6);
  scene.cameras.main.setBackgroundColor(
    night ? 0x0a1018 : mood === "arena" ? 0x3a2414 : mood === "freedcamp" ? 0x1a2a1c : 0x4a3824,
  );
}

export function labelMap(scene: Phaser.Scene, labels: { x: number; y: number; text: string }[]): void {
  for (const l of labels) {
    scene.add
      .text(l.x * TILE_SIZE, l.y * TILE_SIZE, l.text, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "13px",
        color: "#e8d4a4",
        stroke: "#1a1210",
        strokeThickness: 5,
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(5)
      .setAlpha(0.82);
  }
}

export const PANEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: "Georgia, Times New Roman, serif",
  fontSize: "18px",
  color: "#e8dcc8",
};

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.GameObject {
  if (typeof (scene.add as Phaser.GameObjects.GameObjectFactory & { nineslice?: Function }).nineslice === "function") {
    return scene.add.nineslice(x, y, "ui-panel", undefined, w, h, 16, 16, 16, 16).setScrollFactor(0).setDepth(5000);
  }
  return scene.add.rectangle(x, y, w, h, COLORS.uiPanel, 0.94).setStrokeStyle(3, COLORS.gold).setScrollFactor(0).setDepth(5000);
}

export function animateCampFire(scene: Phaser.Scene, x: number, y: number): void {
  scene.add.image(x, y + 4, "prop-brazier").setDepth(y).setScale(1.25);
  const glow = scene.add.image(x, y - 12, "fx-glow").setDepth(y + 6).setAlpha(0.7).setScale(1.6).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.45, to: 0.9 },
    scale: { from: 1.35, to: 1.9 },
    duration: 340 + Math.random() * 120,
    yoyo: true,
    repeat: -1,
  });
  addFloorPool(scene, x, y + 10, 0xff8a30, 3.2);
  for (let i = 0; i < 5; i++) {
    const mote = scene.add.image(x + (i - 2) * 4, y - 10, "fx-mote").setDepth(y + 7).setTint(0xffc070).setAlpha(0.8);
    scene.tweens.add({
      targets: mote,
      y: y - 36 - i * 5,
      x: x + Phaser.Math.Between(-10, 10),
      alpha: 0,
      duration: 800 + i * 140,
      repeat: -1,
      delay: i * 90,
    });
  }
}

export function animateFountain(scene: Phaser.Scene, x: number, y: number): void {
  scene.time.addEvent({
    delay: 280,
    loop: true,
    callback: () => {
      const drop = scene.add.image(x + Phaser.Math.Between(-6, 6), y - 10, "fx-water").setDepth(y + 4).setAlpha(0.7).setScale(0.7);
      scene.tweens.add({
        targets: drop,
        y: y + 6,
        alpha: 0,
        duration: 420,
        onComplete: () => drop.destroy(),
      });
    },
  });
}

export function animateTrough(scene: Phaser.Scene, x: number, y: number): void {
  scene.time.addEvent({
    delay: 520,
    loop: true,
    callback: () => {
      const drop = scene.add
        .image(x + Phaser.Math.Between(-5, 5), y - 8, "fx-water")
        .setDepth(y + 4)
        .setAlpha(0.55)
        .setScale(0.55)
        .setTint(0x8ab4c4);
      scene.tweens.add({
        targets: drop,
        y: y + 4,
        alpha: 0,
        duration: 380,
        onComplete: () => drop.destroy(),
      });
    },
  });
}

export type ChampionFireRing = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

export function spawnChampionFireRing(
  scene: Phaser.Scene,
  sand: { x0: number; y0: number; x1: number; y1: number },
): ChampionFireRing {
  const cx = (sand.x0 + sand.x1) / 2;
  const cy = (sand.y0 + sand.y1) / 2;
  const rx = Math.max(80, (sand.x1 - sand.x0) / 2 - 28);
  const ry = Math.max(64, (sand.y1 - sand.y0) / 2 - 28);
  const g = scene.add.graphics().setDepth(3);
  g.lineStyle(10, 0x6a1808, 0.85);
  g.strokeEllipse(cx, cy, rx * 2, ry * 2);
  g.lineStyle(6, 0xc42810, 0.9);
  g.strokeEllipse(cx, cy, rx * 2, ry * 2);
  g.lineStyle(3, 0xff7a20, 0.7);
  g.strokeEllipse(cx, cy, rx * 2, ry * 2);
  const count = 28;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const x = cx + Math.cos(a) * rx;
    const y = cy + Math.sin(a) * ry;
    addFloorPool(scene, x, y + 4, 0xff5018, 2.4);
    const glow = scene.add
      .image(x, y - 10, "fx-glow")
      .setDepth(y + 2)
      .setAlpha(0.85)
      .setScale(1.35)
      .setTint(0xff6020)
      .setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({
      targets: glow,
      alpha: { from: 0.55, to: 1 },
      scale: { from: 1.15, to: 1.7 },
      duration: 240 + Math.random() * 160,
      yoyo: true,
      repeat: -1,
    });
    const flame = scene.add
      .image(x, y - 8, "fx-flame")
      .setOrigin(0.5, 1)
      .setDepth(y + 4)
      .setScale(1.15 + Math.random() * 0.25);
    scene.tweens.add({
      targets: flame,
      scaleX: { from: 0.95, to: 1.25 },
      scaleY: { from: 1.05, to: 1.55 },
      duration: 180 + Math.random() * 120,
      yoyo: true,
      repeat: -1,
    });
    for (let m = 0; m < 3; m++) {
      const mote = scene.add
        .image(x + (m - 1) * 5, y - 10, "fx-mote")
        .setDepth(y + 5)
        .setTint(m === 1 ? 0xfff0a8 : 0xff7030)
        .setAlpha(0.95)
        .setScale(1.4);
      scene.tweens.add({
        targets: mote,
        y: y - 32 - m * 8,
        x: x + Phaser.Math.Between(-8, 8),
        alpha: 0,
        duration: 480 + m * 120 + Math.random() * 100,
        repeat: -1,
        delay: i * 16 + m * 70,
        onRepeat: () => {
          mote.x = x + (m - 1) * 5;
          mote.y = y - 10;
          mote.setAlpha(0.95);
        },
      });
    }
  }
  return { cx, cy, rx: rx - 22, ry: ry - 18 };
}

export function outsideFireRing(x: number, y: number, ring: ChampionFireRing): boolean {
  const nx = (x - ring.cx) / ring.rx;
  const ny = (y - ring.cy) / ring.ry;
  return nx * nx + ny * ny > 1;
}
