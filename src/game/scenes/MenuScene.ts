import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH, COLORS } from "../config";
import { gameState, type SaveSlotId, type SaveSlotSummary } from "../state/GameState";
import { audio } from "../systems/audio";
import { controlsHelpText } from "../systems/input";

export class MenuScene extends Phaser.Scene {
  private overlay: "none" | "settings" | "controls" | "files" | "confirm" = "none";
  private extras: Phaser.GameObjects.GameObject[] = [];
  private filesMode: "new" | "load" = "load";

  constructor() {
    super("MenuScene");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.uiDark);
    const g = this.add.graphics();
    g.fillGradientStyle(0x241410, 0x241410, 0x6a3a22, 0x8a4a28, 1, 1, 1, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    g.fillStyle(0x3a2a1c, 1);
    g.fillRect(0, 520, GAME_WIDTH, 200);
    for (let i = 0; i < 40; i++) {
      const x = (i % 20) * 64;
      const y = 520 + Math.floor(i / 20) * 32;
      g.fillStyle(i % 3 === 0 ? 0x8a3a2a : i % 3 === 1 ? 0xd4a84b : 0x6a6458, 0.35);
      g.fillRect(x, y, 30, 14);
    }

    this.add.rectangle(GAME_WIDTH / 2, 560, GAME_WIDTH, 80, 0x000000, 0.25);

    for (let i = 0; i < 6; i++) {
      const x = 70 + i * 226;
      this.add.image(x, 430, "prop-column").setScale(1.4).setAlpha(0.9);
    }

    for (let i = 0; i < 10; i++) {
      const b = this.add.image(80 + i * 120, 40, "menu-banner").setOrigin(0.5, 0);
      this.tweens.add({
        targets: b,
        angle: i % 2 ? 2.5 : -2.5,
        duration: 1600 + i * 80,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    this.add.image(GAME_WIDTH / 2, 118, "menu-eagle").setScale(1.15);
    this.add.image(GAME_WIDTH / 2, 118, "fx-glow").setScale(3.2).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);

    this.add
      .text(GAME_WIDTH / 2, 210, "LUDUS AQUILA", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "62px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 10,
      })
      .setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 268, "House of the Eagle", {
        fontFamily: "Georgia",
        fontSize: "22px",
        color: "#e8dcc8",
        fontStyle: "italic",
      })
      .setOrigin(0.5);

    const line = this.add.rectangle(GAME_WIDTH / 2, 292, 280, 2, COLORS.gold, 0.8);
    this.tweens.add({ targets: line, scaleX: 1.15, alpha: 0.5, duration: 1800, yoyo: true, repeat: -1 });

    const hasSave = gameState.hasSave();
    this.button(GAME_WIDTH / 2, 350, "New Game", () => {
      audio.sfx("ui");
      this.showFiles("new");
    });
    this.button(
      GAME_WIDTH / 2,
      418,
      hasSave ? "Continue" : "Continue  (no save)",
      () => {
        if (!hasSave) return;
        audio.sfx("ui");
        this.showFiles("load");
      },
      !hasSave,
    );
    this.button(GAME_WIDTH / 2, 486, "Settings", () => {
      audio.sfx("ui");
      this.showSettings();
    });
    this.button(GAME_WIDTH / 2, 554, "Controls", () => {
      audio.sfx("ui");
      this.showControls();
    });

    this.addMuteChip(GAME_WIDTH - 130, 42);

    this.add
      .text(GAME_WIDTH / 2, 690, "A top-down gladiator action-adventure", {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#9a8a78",
      })
      .setOrigin(0.5);

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.overlay === "confirm") {
        this.showFiles(this.filesMode);
        return;
      }
      if (this.overlay === "files") this.clearExtras();
    });

    this.cameras.main.fadeIn(500, 16, 10, 8);
  }

  private button(x: number, y: number, label: string, fn: () => void, disabled = false): void {
    const bg = this.add
      .rectangle(x, y, 340, 54, disabled ? 0x3a3028 : 0x2a1c16)
      .setStrokeStyle(2, COLORS.gold)
      .setInteractive({ useHandCursor: !disabled });
    const inner = this.add.rectangle(x, y, 328, 42, 0x000000, 0.15);
    const t = this.add
      .text(x, y, label, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "20px",
        color: disabled ? "#6a5a4a" : "#e8dcc8",
      })
      .setOrigin(0.5);
    if (!disabled) {
      bg.on("pointerover", () => {
        bg.setFillStyle(0x4a3020);
        t.setColor("#f4e2b0");
      });
      bg.on("pointerout", () => {
        bg.setFillStyle(0x2a1c16);
        t.setColor("#e8dcc8");
      });
      bg.on("pointerdown", fn);
    }
    void inner;
  }

  private addMuteChip(x: number, y: number): void {
    const bg = this.add
      .rectangle(x, y, 220, 40, 0x2a1c16)
      .setStrokeStyle(2, COLORS.gold)
      .setInteractive({ useHandCursor: true });
    const t = this.add
      .text(x, y, audio.musicMuteLabel(), {
        fontFamily: "Cinzel, Georgia",
        fontSize: "16px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5);
    bg.on("pointerover", () => {
      bg.setFillStyle(0x4a3020);
      t.setColor("#f4e2b0");
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x2a1c16);
      t.setColor("#e8dcc8");
    });
    bg.on("pointerdown", () => {
      audio.toggleMusicMute();
      t.setText(audio.musicMuteLabel());
      audio.sfx("ui");
    });
  }

  private clearExtras(): void {
    this.extras.forEach((o) => o.destroy());
    this.extras = [];
    this.overlay = "none";
  }

  private showControls(): void {
    this.clearExtras();
    this.overlay = "controls";
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55);
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 580, 580, 0x2a1c16, 0.98).setStrokeStyle(3, COLORS.gold);
    const t = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10, "CONTROLS\n\n" + controlsHelpText(), {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#e8dcc8",
        align: "center",
      })
      .setOrigin(0.5);
    const close = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 240, "Click to close", { fontFamily: "Georgia", fontSize: "16px", color: "#d4a84b" })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.clearExtras());
    this.extras.push(dim, bg, t, close);
  }

  private showSettings(): void {
    this.clearExtras();
    this.overlay = "settings";
    const s = gameState.settings;
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55);
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 560, 420, 0x2a1c16, 0.98).setStrokeStyle(3, COLORS.gold);
    const t = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 40,
        this.settingsBody(),
        { fontFamily: "Georgia", fontSize: "20px", color: "#e8dcc8", align: "center" },
      )
      .setOrigin(0.5);
    this.extras.push(dim, bg, t);
    const keys = this.input.keyboard!;
    const onKey = (ev: KeyboardEvent) => {
      if (this.overlay !== "settings") return;
      if (ev.key === "=" || ev.key === "+") s.musicVolume = Math.min(1, s.musicVolume + 0.1);
      if (ev.key === "-") s.musicVolume = Math.max(0, s.musicVolume - 0.1);
      if (ev.key === "]") s.sfxVolume = Math.min(1, s.sfxVolume + 0.1);
      if (ev.key === "[") s.sfxVolume = Math.max(0, s.sfxVolume - 0.1);
      if (ev.key.toLowerCase() === "n") audio.toggleMusicMute();
      if (ev.key.toLowerCase() === "s") s.screenShake = !s.screenShake;
      if (ev.key.toLowerCase() === "f") {
        s.fullscreen = !s.fullscreen;
        if (s.fullscreen) void this.scale.startFullscreen();
        else void this.scale.stopFullscreen();
      }
      if (ev.key === "Escape") {
        window.removeEventListener("keydown", onKey);
        gameState.persistSettings();
        this.clearExtras();
        return;
      }
      gameState.persistSettings();
      t.setText(this.settingsBody());
    };
    window.addEventListener("keydown", onKey);
    void keys;
  }

  private settingsBody(): string {
    const s = gameState.settings;
    return `SETTINGS\n\nMusic  [ - ]  ${Math.round(s.musicVolume * 100)}%  [ + ]\nMusic muted: ${s.musicMuted ? "Yes" : "No"}  (press N)\nSound  [ [ ]  ${Math.round(s.sfxVolume * 100)}%  [ ] ]\nScreen shake: ${s.screenShake ? "On" : "Off"}  (press S)\nFullscreen: ${s.fullscreen ? "On" : "Off"}  (press F)\n\nEsc to close`;
  }

  private showFiles(mode: "new" | "load"): void {
    this.clearExtras();
    this.overlay = "files";
    this.filesMode = mode;
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55);
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 640, 560, 0x2a1c16, 0.98).setStrokeStyle(3, COLORS.gold);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 236, mode === "new" ? "Choose a file" : "Load a file", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "28px",
        color: "#e8c96a",
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 200,
        mode === "new" ? "Empty files start a new career. Occupied files can be overwritten." : "Pick a career to continue.",
        { fontFamily: "Georgia", fontSize: "15px", color: "#c4b8a4" },
      )
      .setOrigin(0.5);
    this.extras.push(dim, bg, title, hint);

    const summaries = gameState.slotSummaries();
    summaries.forEach((summary, i) => {
      const slot = (i + 1) as SaveSlotId;
      this.addFileCard(slot, summary, GAME_HEIGHT / 2 - 118 + i * 132);
    });

    const close = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 246, "Esc to close", {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#d4a84b",
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    close.on("pointerdown", () => this.clearExtras());
    this.extras.push(close);
  }

  private addFileCard(slot: SaveSlotId, summary: SaveSlotSummary | null, y: number): void {
    const x = GAME_WIDTH / 2;
    const occupied = Boolean(summary);
    const card = this.add
      .rectangle(x, y, 560, 112, occupied ? 0x241810 : 0x1c1612)
      .setStrokeStyle(2, occupied ? COLORS.gold : 0x6a5a4a)
      .setInteractive({ useHandCursor: true });
    const badge = this.add
      .text(x - 250, y - 34, `FILE ${slot}`, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "13px",
        color: "#d4a84b",
      })
      .setOrigin(0, 0.5);
    const name = this.add
      .text(x - 250, y - 8, summary?.playerName ?? "Empty", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "22px",
        color: occupied ? "#f4ead8" : "#8a7a68",
      })
      .setOrigin(0, 0.5);
    const detail = this.add
      .text(
        x - 250,
        y + 24,
        occupied
          ? `${summary!.houseName}  ·  Lv ${summary!.level}  ·  ${summary!.progress}`
          : "Start a new career in Ludus Aquila",
        { fontFamily: "Georgia", fontSize: "15px", color: "#c4b8a4" },
      )
      .setOrigin(0, 0.5);
    const action = this.add
      .text(
        x + 250,
        y,
        occupied ? (this.filesMode === "new" ? "Overwrite" : "Continue") : "New Game",
        { fontFamily: "Georgia", fontSize: "15px", color: "#e8c96a" },
      )
      .setOrigin(1, 0.5);
    card.on("pointerover", () => {
      card.setFillStyle(0x3a281c);
      name.setColor("#f4e2b0");
    });
    card.on("pointerout", () => {
      card.setFillStyle(occupied ? 0x241810 : 0x1c1612);
      name.setColor(occupied ? "#f4ead8" : "#8a7a68");
    });
    card.on("pointerdown", () => {
      audio.sfx("ui");
      this.onFileChosen(slot, summary);
    });
    this.extras.push(card, badge, name, detail, action);
  }

  private onFileChosen(slot: SaveSlotId, summary: SaveSlotSummary | null): void {
    if (!summary) {
      this.startCreate(slot);
      return;
    }
    if (this.filesMode === "load") {
      this.continueSlot(slot);
      return;
    }
    this.showOverwriteConfirm(slot, summary.playerName);
  }

  private showOverwriteConfirm(slot: SaveSlotId, name: string): void {
    this.clearExtras();
    this.overlay = "confirm";
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6);
    const bg = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 520, 280, 0x2a1c16, 0.98).setStrokeStyle(3, COLORS.gold);
    const t = this.add
      .text(
        GAME_WIDTH / 2,
        GAME_HEIGHT / 2 - 48,
        `This will erase ${name}'s career.\nStart a new game on file ${slot}?`,
        { fontFamily: "Georgia", fontSize: "20px", color: "#e8dcc8", align: "center" },
      )
      .setOrigin(0.5);
    this.extras.push(dim, bg, t);
    this.confirmButton(GAME_WIDTH / 2 - 110, GAME_HEIGHT / 2 + 70, "Erase file", () => this.startCreate(slot));
    this.confirmButton(GAME_WIDTH / 2 + 110, GAME_HEIGHT / 2 + 70, "Cancel", () => this.showFiles(this.filesMode));
  }

  private confirmButton(x: number, y: number, label: string, fn: () => void): void {
    const bg = this.add
      .rectangle(x, y, 180, 48, 0x2a1c16)
      .setStrokeStyle(2, COLORS.gold)
      .setInteractive({ useHandCursor: true });
    const t = this.add
      .text(x, y, label, { fontFamily: "Cinzel, Georgia", fontSize: "18px", color: "#e8dcc8" })
      .setOrigin(0.5);
    bg.on("pointerover", () => {
      bg.setFillStyle(0x4a3020);
      t.setColor("#f4e2b0");
    });
    bg.on("pointerout", () => {
      bg.setFillStyle(0x2a1c16);
      t.setColor("#e8dcc8");
    });
    bg.on("pointerdown", fn);
    this.extras.push(bg, t);
  }

  private startCreate(slot: SaveSlotId): void {
    gameState.setActiveSlot(slot);
    this.scene.start("CharacterCreateScene");
  }

  private continueSlot(slot: SaveSlotId): void {
    if (!gameState.loadSlot(slot)) return;
    this.scene.launch("UIScene");
    this.scene.start("LudusScene");
  }
}
