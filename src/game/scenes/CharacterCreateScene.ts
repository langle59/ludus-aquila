import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../config";
import { gameState } from "../state/GameState";
import type { TunicColor } from "../types";
import { audio } from "../systems/audio";
import { makeBodyTexture } from "../systems/assets";
import { TUNIC_HEX } from "../entities/World";
import { HOUSES, houseCreateTunics } from "../data/houses";
import { generateHouseName } from "../data/names";

const TUNIC_SWATCH_LABEL: Record<TunicColor, string> = {
  crimson: "crimson",
  white: "linen",
  bronze: "bronze",
  midnight: "dusk",
  sea: "sea",
  fox: "fox",
  ivory: "ivory",
  obsidian: "black",
  sand: "sand",
  wine: "wine",
  bear: "umber",
  wolf: "grey",
  serpent: "coil",
  lion: "gold",
  bull: "blood",
  boar: "hide",
  raven: "night",
};

export class CharacterCreateScene extends Phaser.Scene {
  private nameValue = "Valens";
  private tunic: TunicColor = "fox";
  private houseId = HOUSES[0]?.id ?? "vulpes";
  private palette: TunicColor[] = houseCreateTunics(HOUSES[0]?.id ?? "vulpes");
  private nameText!: Phaser.GameObjects.Text;
  private preview!: Phaser.GameObjects.Image;
  private selectedRing!: Phaser.GameObjects.Rectangle;
  private houseRing!: Phaser.GameObjects.Rectangle;
  private swatches: Phaser.GameObjects.Rectangle[] = [];
  private swatchLabels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super("CharacterCreateScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.uiDark);
    const g = this.add.graphics();
    g.fillGradientStyle(0x1a1210, 0x1a1210, 0x3a281c, 0x4a3020, 1, 1, 1, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.image(90, 360, "prop-column").setScale(1.3).setAlpha(0.55);
    this.add.image(GAME_WIDTH - 90, 360, "prop-column").setScale(1.3).setAlpha(0.55);
    this.add.image(GAME_WIDTH / 2, 42, "menu-eagle").setScale(0.4).setAlpha(0.9);

    this.add
      .text(GAME_WIDTH / 2, 82, "Name your gladiator", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "30px",
        color: "#e8c96a",
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 114, `File ${gameState.activeSlot}  ·  Type a name in the box. Choose a tunic and a house.`, {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5);

    this.add.rectangle(GAME_WIDTH / 2, 158, 420, 48, 0x2a1c16).setStrokeStyle(2, COLORS.gold);
    this.nameText = this.add
      .text(GAME_WIDTH / 2, 158, this.nameValue, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "26px",
        color: "#f4ead8",
      })
      .setOrigin(0.5);

    const nickBtn = this.add
      .rectangle(GAME_WIDTH / 2 + 340, 158, 200, 48, 0x2a1c16)
      .setStrokeStyle(2, COLORS.gold)
      .setInteractive({ useHandCursor: true });
    const nickLabel = this.add
      .text(GAME_WIDTH / 2 + 340, 158, "House nickname", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "15px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5);
    nickBtn.on("pointerover", () => {
      nickBtn.setFillStyle(0x4a3020);
      nickLabel.setColor("#f4e2b0");
    });
    nickBtn.on("pointerout", () => {
      nickBtn.setFillStyle(0x2a1c16);
      nickLabel.setColor("#e8dcc8");
    });
    nickBtn.on("pointerdown", () => this.rollHouseName());

    this.add.image(220, 330, "char-shadow").setScale(2.4).setAlpha(0.8);
    makeBodyTexture(this, "preview-body", TUNIC_HEX[this.tunic], COLORS.gold, 1.3, "gladiator");
    this.preview = this.add.image(220, 300, "preview-body").setScale(1.9);
    this.tweens.add({
      targets: this.preview,
      y: 294,
      duration: 1400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.add
      .text(220, 392, "House dyes", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "16px",
        color: "#e8c96a",
      })
      .setOrigin(0.5);

    this.selectedRing = this.add.rectangle(148, 430, 52, 52, 0x000000, 0).setStrokeStyle(3, COLORS.gold);
    this.palette.forEach((c, i) => {
      const x = 148 + i * 72;
      const sw = this.add.rectangle(x, 430, 46, 46, TUNIC_HEX[c]).setStrokeStyle(2, 0x1a1210).setInteractive({ useHandCursor: true });
      const label = this.add
        .text(x, 466, TUNIC_SWATCH_LABEL[c], { fontFamily: "Georgia", fontSize: "13px", color: "#e8dcc8" })
        .setOrigin(0.5);
      sw.on("pointerdown", () => this.pickTunic(i));
      this.swatches.push(sw);
      this.swatchLabels.push(label);
    });

    this.add
      .text(780, 200, "Pledge a house", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "20px",
        color: "#e8c96a",
      })
      .setOrigin(0.5);

    const houseHint = this.add
      .text(780, 226, HOUSES[0]?.philosophy ?? "", {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#c4b8a4",
        wordWrap: { width: 520 },
        align: "center",
      })
      .setOrigin(0.5);

    this.houseRing = this.add.rectangle(0, 0, 248, 58, 0x000000, 0).setStrokeStyle(2, COLORS.gold);
    HOUSES.forEach((h, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 640 + col * 270;
      const y = 268 + row * 68;
      if (i === 0) this.houseRing.setPosition(x, y);
      const btn = this.add.rectangle(x, y, 240, 52, 0x2a1c16).setStrokeStyle(2, h.colors.primary).setInteractive({ useHandCursor: true });
      this.add.rectangle(x - 98, y, 18, 32, h.colors.primary).setStrokeStyle(1, h.colors.accent);
      this.add
        .text(x + 10, y - 8, h.name, { fontFamily: "Cinzel, Georgia", fontSize: "15px", color: "#f4ead8" })
        .setOrigin(0.5);
      this.add
        .text(x + 10, y + 12, h.latinName, { fontFamily: "Georgia", fontSize: "12px", color: "#b8a890" })
        .setOrigin(0.5);
      btn.on("pointerdown", () => {
        this.houseId = h.id;
        this.houseRing.setPosition(x, y);
        this.houseRing.setDepth(40);
        houseHint.setText(h.philosophy);
        this.applyHouseDyes(h.id);
        audio.sfx("ui");
      });
    });
    this.houseRing.setDepth(40);

    const go = this.add
      .rectangle(GAME_WIDTH / 2, 670, 300, 50, 0x2a1c16)
      .setStrokeStyle(2, COLORS.gold)
      .setInteractive({ useHandCursor: true });
    const goText = this.add
      .text(GAME_WIDTH / 2, 670, "Enter the ludus", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "22px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5);
    go.on("pointerover", () => {
      go.setFillStyle(0x4a3020);
      goText.setColor("#f4e2b0");
    });
    go.on("pointerout", () => {
      go.setFillStyle(0x2a1c16);
      goText.setColor("#e8dcc8");
    });
    go.on("pointerdown", () => this.begin());

    const back = this.add
      .text(GAME_WIDTH / 2, 708, "Esc  ·  back to title", {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#9a8a78",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on("pointerdown", () => this.scene.start("MenuScene"));

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.scene.start("MenuScene");
        return;
      }
      if (e.key === "Enter") {
        this.begin();
        return;
      }
      if (e.key === "Backspace") {
        this.nameValue = this.nameValue.slice(0, -1);
      } else if (e.key.length === 1 && this.nameValue.length < 18 && /[\w \-]/.test(e.key)) {
        this.nameValue += e.key;
      }
      this.nameText.setText(this.nameValue || "_");
    });
    void GAME_HEIGHT;
    this.cameras.main.fadeIn(400, 16, 10, 8);
  }

  private rollHouseName(): void {
    audio.sfx("ui");
    this.nameValue = generateHouseName(this.houseId, this.nameValue);
    this.nameText.setText(this.nameValue);
  }

  private applyHouseDyes(houseId: string): void {
    this.palette = houseCreateTunics(houseId);
    this.palette.forEach((c, i) => {
      this.swatches[i]?.setFillStyle(TUNIC_HEX[c]);
      this.swatchLabels[i]?.setText(TUNIC_SWATCH_LABEL[c]);
    });
    this.pickTunic(0, false);
  }

  private pickTunic(index: number, playSound = true): void {
    const c = this.palette[index];
    if (!c) return;
    this.tunic = c;
    this.selectedRing.setPosition(148 + index * 72, 430);
    makeBodyTexture(this, "preview-body", TUNIC_HEX[c], COLORS.gold, 1.3, "gladiator");
    this.preview.setTexture("preview-body");
    if (playSound) audio.sfx("ui");
  }

  private begin(): void {
    audio.sfx("ui");
    gameState.startNew(this.nameValue || "Valens", this.tunic, this.houseId);
    this.scene.launch("UIScene");
    this.scene.start("LudusScene");
  }
}
