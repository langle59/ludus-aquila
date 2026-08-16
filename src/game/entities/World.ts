import Phaser from "phaser";
import { bodyStyleFor, makeBodyTexture } from "../systems/assets";

export { TUNIC_HEX } from "../data/shop";

export class TrainingDummy extends Phaser.Physics.Arcade.Sprite {
  visual: Phaser.GameObjects.Image;
  hits = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, "prop-dummy");
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setVisible(false);
    this.setSize(18, 16);
    this.visual = scene.add.image(x, y - 8, "prop-dummy").setDepth(y);
    scene.add.image(x, y + 10, "char-shadow").setDepth(1).setAlpha(0.8);
  }

  bonk(): void {
    this.hits += 1;
    this.visual.setTint(0xffffff);
    this.scene.tweens.add({
      targets: this.visual,
      angle: Phaser.Math.Between(-8, 8),
      x: this.x + 5,
      duration: 55,
      yoyo: true,
      onComplete: () => {
        this.visual.clearTint();
        this.visual.setAngle(0);
      },
    });
  }

  destroy(fromScene?: boolean): void {
    this.visual?.destroy();
    super.destroy(fromScene);
  }
}

export class WorldProp extends Phaser.Physics.Arcade.Image {
  kind: string;
  constructor(scene: Phaser.Scene, x: number, y: number, kind: string, tex: string, solid = true) {
    super(scene, x, y, tex);
    this.kind = kind;
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setDepth(y);
    if (kind === "column") {
      this.setOrigin(0.5, 1);
      this.setSize(18, 14);
      this.setOffset(9, 58);
    }
    if (kind === "rack") this.setSize(30, 16);
    if (kind === "crate") this.setSize(22, 16);
    if (kind === "fountain") this.setSize(28, 20);
    if (kind === "bench") this.setSize(32, 12);
    if (kind === "shop") this.setSize(36, 16);
    if (kind === "anvil") this.setSize(24, 14);
    if (kind === "barrel") this.setSize(16, 14);
    if (kind === "bed") this.setSize(36, 16);
    if (kind === "chest") this.setSize(22, 12);
    if (kind === "shieldstand") this.setSize(24, 12);
    if (kind === "dice") this.setSize(56, 18);
    if (kind === "trough") this.setSize(28, 14);
    if (kind === "perch") this.setSize(18, 12);
    if (kind === "feast-table") this.setSize(64, 16);
    if (kind === "amphora") this.setSize(14, 16);
    if (kind === "jug" || kind === "wine") this.setSize(12, 12);
    if (kind === "keg" || kind === "beer") this.setSize(20, 16);
    if (kind === "brazier") this.setSize(22, 14);
    if (kind === "pit-ring") this.setSize(16, 12);
    if (kind === "pit-skull") this.setSize(14, 12);
    if (kind === "pit-tusk") this.setSize(18, 12);
    if (kind === "pit-horn") this.setSize(18, 12);
    if (kind === "pit-log") this.setSize(26, 12);
    if (kind === "pit-ivory") {
      this.setOrigin(0.5, 1);
      this.setSize(12, 12);
      this.setOffset(3, 28);
    }
    if (solid) this.refreshBody();
    if (!solid) this.disableBody();
  }
}

export class NpcActor extends Phaser.Physics.Arcade.Sprite {
  npcId: string;
  visual: Phaser.GameObjects.Image;
  label: Phaser.GameObjects.Text;
  prompt?: Phaser.GameObjects.Text;
  private shadow: Phaser.GameObjects.Image;
  private bobFrom = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, npcId: string, name: string, tunic: number, accent: number, scale: number) {
    super(scene, x, y, "char-shadow");
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.npcId = npcId;
    this.setVisible(false);
    this.setSize(18, 16);
    const key = `npc-${npcId}`;
    makeBodyTexture(scene, key, tunic, accent, scale, bodyStyleFor(npcId));
    this.shadow = scene.add.image(x, y + 10, "char-shadow").setDepth(1);
    this.visual = scene.add.image(x, y - 10, key).setDepth(y);
    this.bobFrom = y;
    this.startBob();
    this.label = scene.add
      .text(x, y - 40, name, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "12px",
        color: "#f0e6d2",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(y + 2);
    this.prompt = scene.add
      .text(x, y + 18, "E  Talk", {
        fontFamily: "Georgia",
        fontSize: "11px",
        color: "#d4a84b",
        stroke: "#1a1210",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(y + 2)
      .setVisible(false);
  }

  place(x: number, y: number): void {
    this.setPosition(x, y);
    const body = this.body as Phaser.Physics.Arcade.StaticBody | undefined;
    body?.updateFromGameObject();
    this.refreshBody();
    this.shadow.setPosition(x, y + 10);
    this.visual.setPosition(x, y - 10).setDepth(y);
    this.label.setPosition(x, y - 40).setDepth(y + 2);
    this.prompt?.setPosition(x, y + 18).setDepth(y + 2);
    this.bobFrom = y;
    this.startBob();
  }

  private startBob(): void {
    this.scene.tweens.killTweensOf(this.visual);
    this.visual.y = this.bobFrom - 10;
    this.scene.tweens.add({
      targets: this.visual,
      y: this.bobFrom - 12,
      duration: 1400 + Math.random() * 400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  setPrompt(show: boolean, text = "E  Talk"): void {
    this.prompt?.setText(text);
    this.prompt?.setVisible(show);
  }

  destroy(fromScene?: boolean): void {
    this.visual?.destroy();
    this.label?.destroy();
    this.prompt?.destroy();
    this.shadow?.destroy();
    super.destroy(fromScene);
  }
}
