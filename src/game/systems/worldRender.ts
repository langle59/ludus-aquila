import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "../config";
import type { BuiltMap } from "../maps/maps";

const VARIANT_BASES = new Set([
  "tile-sand",
  "tile-dirt",
  "tile-stone",
  "tile-wood",
  "tile-wood-pale",
  "tile-yard",
  "tile-wall",
]);

function variantTex(scene: Phaser.Scene, tex: string, x: number, y: number): string {
  if (!VARIANT_BASES.has(tex)) return tex;
  const n = ((x * 13 + y * 31) >>> 0) % 4;
  if (n === 0) return tex;
  const key = `${tex}-${n}`;
  return scene.textures.exists(key) ? key : tex;
}

export function paintMap(
  scene: Phaser.Scene,
  built: BuiltMap,
  mood: "ludus" | "arena" = "ludus",
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

function paintDecor(scene: Phaser.Scene, built: BuiltMap, mood: "ludus" | "arena"): void {
  for (const t of built.tiles) {
    if (t.tex === "tile-column") {
      scene.add
        .image(t.x + TILE_SIZE / 2, t.y + 4, "prop-column")
        .setOrigin(0.5, 1)
        .setDepth(t.y + 40);
    }
  }

  if (mood === "ludus") {
    const ringX = 24 * TILE_SIZE;
    const ringY = 18 * TILE_SIZE;
    const g = scene.add.graphics().setDepth(2);
    g.lineStyle(3, 0xc4a66e, 0.55);
    g.strokeCircle(ringX + 16, ringY + 8, 78);
    g.lineStyle(2, 0x6b4a28, 0.35);
    g.strokeCircle(ringX + 16, ringY + 8, 72);

    const torches = [
      { x: 4, y: 2 },
      { x: 43, y: 2 },
      { x: 3, y: 6 },
      { x: 8, y: 6 },
      { x: 39, y: 6 },
      { x: 44, y: 6 },
      { x: 12, y: 14 },
      { x: 35, y: 14 },
      { x: 12, y: 24 },
      { x: 35, y: 24 },
      { x: 21, y: 31 },
      { x: 26, y: 31 },
    ];
    for (const t of torches) {
      placeTorch(scene, t.x * TILE_SIZE + 16, t.y * TILE_SIZE + 10);
    }
    scene.add.image(10 * TILE_SIZE + 16, 8 * TILE_SIZE + 22, "prop-lintel").setDepth(8 * TILE_SIZE + 6);
    scene.add.image(37 * TILE_SIZE + 16, 8 * TILE_SIZE + 22, "prop-lintel").setDepth(8 * TILE_SIZE + 6);
    placeLamp(scene, 5 * TILE_SIZE + 8, 6 * TILE_SIZE + 18);
    placeLamp(scene, 42 * TILE_SIZE + 16, 6 * TILE_SIZE + 18);
  } else {
    const torches = [
      { x: 4, y: 3 },
      { x: 27, y: 3 },
      { x: 4, y: 18 },
      { x: 27, y: 18 },
    ];
    for (const t of torches) {
      placeTorch(scene, t.x * TILE_SIZE + 16, t.y * TILE_SIZE + 8);
    }
  }
}

function placeTorch(scene: Phaser.Scene, x: number, y: number): void {
  scene.add.image(x, y, "prop-torch").setDepth(y + 8);
  const glow = scene.add.image(x, y - 6, "fx-glow").setDepth(y + 7).setAlpha(0.55).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.35, to: 0.7 },
    scale: { from: 0.85, to: 1.15 },
    duration: 420 + Math.random() * 200,
    yoyo: true,
    repeat: -1,
  });
}

function placeLamp(scene: Phaser.Scene, x: number, y: number): void {
  scene.add.image(x, y, "prop-lamp").setDepth(y + 6);
  const glow = scene.add.image(x, y - 8, "fx-glow").setDepth(y + 5).setAlpha(0.4).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.22, to: 0.5 },
    scale: { from: 0.55, to: 0.8 },
    duration: 640 + Math.random() * 180,
    yoyo: true,
    repeat: -1,
  });
}

export function paintAtmosphere(scene: Phaser.Scene, built: BuiltMap, mood: "ludus" | "arena"): void {
  const w = built.cols * TILE_SIZE;
  const h = built.rows * TILE_SIZE;

  const wash = scene.add.rectangle(w / 2, h / 2, w, h, mood === "arena" ? 0xc45a1a : 0xd4a84b, mood === "arena" ? 0.08 : 0.06);
  wash.setDepth(4);
  wash.setBlendMode(Phaser.BlendModes.ADD);

  const vg = scene.add.graphics().setScrollFactor(0).setDepth(2500);
  vg.fillStyle(0x1a1008, 0.55);
  vg.fillRect(0, 0, GAME_WIDTH, 28);
  vg.fillRect(0, GAME_HEIGHT - 22, GAME_WIDTH, 22);
  vg.fillRect(0, 0, 18, GAME_HEIGHT);
  vg.fillRect(GAME_WIDTH - 18, 0, 18, GAME_HEIGHT);
  vg.fillStyle(0x1a1008, 0.22);
  vg.fillRect(0, 0, GAME_WIDTH, 56);
  vg.fillRect(0, GAME_HEIGHT - 48, GAME_WIDTH, 48);

  const motes = 28;
  for (let i = 0; i < motes; i++) {
    const m = scene.add
      .image(Math.random() * w, Math.random() * h, "fx-mote")
      .setDepth(6)
      .setAlpha(0.15 + Math.random() * 0.25)
      .setScale(0.6 + Math.random() * 0.8);
    scene.tweens.add({
      targets: m,
      y: m.y - (40 + Math.random() * 80),
      x: m.x + Phaser.Math.Between(-24, 24),
      alpha: 0,
      duration: 5000 + Math.random() * 4000,
      repeat: -1,
      onRepeat: () => {
        m.setPosition(Math.random() * w, Math.random() * h);
        m.setAlpha(0.2 + Math.random() * 0.25);
      },
    });
  }

  scene.cameras.main.fadeIn(700, 18, 10, 6);
  scene.cameras.main.setBackgroundColor(mood === "arena" ? 0x3a2414 : 0x4a3824);
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

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Rectangle {
  const r = scene.add.rectangle(x, y, w, h, COLORS.uiPanel, 0.94).setStrokeStyle(3, COLORS.gold).setScrollFactor(0).setDepth(5000);
  return r;
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
