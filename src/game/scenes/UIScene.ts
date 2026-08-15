import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, UNGUENT_COST, UNGUENT_MAX } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { currentObjectiveText } from "../systems/objectives";
import { WEAPON_ORDER, getWeapon, weaponIconKey } from "../data/weapons";
import { getHouse, houseTitleColor, isTournamentId } from "../data/houses";
import { TOURNAMENT_HOUSE } from "../data/tournament";
import { isOpponentUnlocked, canUnlockSkill, unlockSkill, hasSkill, buyCosmetic, buyUnguent, isHouseUnlocked, houseLockHint, rivalHouses, tournamentUnlocked } from "../systems/progression";
import { audio } from "../systems/audio";
import { makeBodyTexture } from "../systems/assets";
import { SKILL_BRANCHES, skillsInBranch, type SkillDef } from "../data/skills";
import { SHOP_ITEMS, SHOP_TABS, TUNIC_HEX, PLUME_HEX, CAPE_HEX, ownsCosmetic, shopUnlocked, shopLockHint, equippedId, displayTitle, lookWithItem, previewTitle, type ShopKind } from "../data/shop";
import { palBrought, palNextHint, palTier, palTitle, palUnlocked, togglePalBrought } from "../data/pal";
import { generateHouseName } from "../data/names";
import { ACTION_LABELS, controlsHelpText, eventToKeyName, mergedKeybinds, prettyKey, trySetBind, type CombatAction } from "../systems/input";

type MenuPage = "root" | "stats" | "skills" | "equipment" | "objectives" | "controls" | "settings" | "keybinds" | "rename";

export class UIScene extends Phaser.Scene {
  private hpFill!: Phaser.GameObjects.Rectangle;
  private stamFill!: Phaser.GameObjects.Rectangle;
  private unguentFill!: Phaser.GameObjects.Rectangle;
  private xpFill!: Phaser.GameObjects.Rectangle;
  private levelLabel!: Phaser.GameObjects.Text;
  private weaponLabel!: Phaser.GameObjects.Text;
  private denariiLabel!: Phaser.GameObjects.Text;
  private titleLabel!: Phaser.GameObjects.Text;
  private objectiveLabel!: Phaser.GameObjects.Text;
  private bossWrap: Phaser.GameObjects.GameObject[] = [];
  private favorWrap: Phaser.GameObjects.GameObject[] = [];
  private overlay: Phaser.GameObjects.Container | null = null;
  private dialogueBox: Phaser.GameObjects.Container | null = null;
  private dialogueLines: string[] = [];
  private dialogueIndex = 0;
  private dialogueName = "";
  private dialogueDone?: () => void;
  private pausePage: MenuPage = "root";
  private sparBg!: Phaser.GameObjects.Arc;
  private sparLabel!: Phaser.GameObjects.Text;
  private sparHint!: Phaser.GameObjects.Text;
  private sparYield = false;
  private netBg!: Phaser.GameObjects.Arc;
  private netLabel!: Phaser.GameObjects.Text;
  private netHint!: Phaser.GameObjects.Text;
  private talkBg!: Phaser.GameObjects.Arc;
  private talkLabel!: Phaser.GameObjects.Text;
  private talkHint!: Phaser.GameObjects.Text;
  private dimmer: Phaser.GameObjects.Rectangle | null = null;
  private resultPending = false;
  private comboLabel!: Phaser.GameObjects.Text;
  private comboHideAt = 0;
  private perfectFlash?: Phaser.GameObjects.Rectangle;
  private perfectText?: Phaser.GameObjects.Text;
  private gateHouse: string | null = null;
  private waitingBind: CombatAction | null = null;
  private shopTab: ShopKind = "tunic";
  private shopPreviewId: string | null = null;
  private minimapWrap?: Phaser.GameObjects.Container;
  private minimapGfx?: Phaser.GameObjects.Graphics;
  private minimapScene = "none";
  private renameValue = "";
  private renameLabel?: Phaser.GameObjects.Text;

  constructor() {
    super("UIScene");
  }

  create(): void {
    this.add.image(28, 18, "ui-bar-wood").setOrigin(0, 0).setScrollFactor(0).setDepth(99).setDisplaySize(220, 100);
    this.add.image(34, 22, "ui-heart").setOrigin(0, 0).setScrollFactor(0).setDepth(101);
    this.add.rectangle(56, 24, 180, 16, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(99);
    this.hpFill = this.add.rectangle(56, 24, 180, 16, COLORS.hp).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.add.rectangle(56, 44, 180, 10, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(99);
    this.stamFill = this.add.rectangle(56, 44, 180, 10, COLORS.stamina).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.add.image(34, 56, "ui-vial").setOrigin(0, 0).setScrollFactor(0).setDepth(101).setScale(0.9);
    this.add.rectangle(56, 58, 180, 10, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(99);
    this.unguentFill = this.add.rectangle(56, 58, 180, 10, COLORS.unguent).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.add.rectangle(56, 72, 180, 7, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(99);
    this.xpFill = this.add.rectangle(56, 72, 180, 7, COLORS.xp).setOrigin(0, 0).setScrollFactor(0).setDepth(100);
    this.add.text(56, 8, "Health", { fontFamily: "Cinzel, Georgia", fontSize: "11px", color: "#e8dcc8" }).setScrollFactor(0).setDepth(100);
    this.add.text(148, 8, "Stamina", { fontFamily: "Cinzel, Georgia", fontSize: "11px", color: "#e8dcc8" }).setScrollFactor(0).setDepth(100);
    this.levelLabel = this.add
      .text(28, 104, "", { fontFamily: "Cinzel, Georgia", fontSize: "13px", color: "#8ecf6a", stroke: "#1a1210", strokeThickness: 3 })
      .setScrollFactor(0)
      .setDepth(100);

    this.weaponLabel = this.add.text(28, GAME_HEIGHT - 40, "", { fontFamily: "Georgia", fontSize: "16px", color: "#d4a84b", stroke: "#1a1210", strokeThickness: 4 }).setScrollFactor(0).setDepth(100);
    this.addAttackButton();
    this.addHeavyButton();
    this.addNetButton();
    this.addSparButton();
    this.addTalkButton();

    const coinX = GAME_WIDTH - 132;
    const coinBg = this.add.rectangle(coinX, 40, 236, 56, 0x2a1c16, 0.92).setStrokeStyle(2, COLORS.gold).setScrollFactor(0).setDepth(99).setInteractive({ useHandCursor: true });
    this.add.image(GAME_WIDTH - 228, 32, "ui-coin").setScrollFactor(0).setDepth(101).setScale(1.15);
    this.denariiLabel = this.add
      .text(GAME_WIDTH - 208, 22, "", { fontFamily: "Cinzel, Georgia", fontSize: "22px", color: "#e8c96a", stroke: "#1a1210", strokeThickness: 4 })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);
    this.titleLabel = this.add
      .text(GAME_WIDTH - 208, 48, "", { fontFamily: "Georgia", fontSize: "13px", color: "#e8dcc8" })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(100);
    coinBg.on("pointerdown", () => {
      if (this.resultPending || gameState.inDialogue) return;
      this.openShop();
    });
    coinBg.on("pointerover", () => coinBg.setFillStyle(0x3a281c));
    coinBg.on("pointerout", () => coinBg.setFillStyle(0x2a1c16));

    this.objectiveLabel = this.add
      .text(GAME_WIDTH / 2, 18, "", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "15px",
        color: "#f0e6d2",
        backgroundColor: "#1a1210cc",
        padding: { x: 14, y: 6 },
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(100);

    this.comboLabel = this.add
      .text(GAME_WIDTH / 2, 118, "", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "28px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 5,
      })
      .setOrigin(0.5, 0)
      .setScrollFactor(0)
      .setDepth(130)
      .setVisible(false);

    this.input.on("pointerdown", () => {
      this.game.canvas.focus();
    });
    bus.on("dialogue", this.openDialogue, this);
    bus.on("armory", this.openArmory, this);
    bus.on("gate", this.openGate, this);
    bus.on("result", this.openResult, this);
    bus.on("boss", this.showBoss, this);
    bus.on("boss-hide", this.hideBoss, this);
    bus.on("favor-show", this.showFavor, this);
    bus.on("favor-hide", this.hideFavor, this);
    bus.on("toast", this.toast, this);
    bus.on("spar-available", this.setSparButton, this);
    bus.on("talk-available", this.setTalkButton, this);
    bus.on("shop", this.openShop, this);
    bus.on("denarii-changed", this.pulseDenarii, this);
    bus.on("combo", this.onCombo, this);
    bus.on("perfect-dodge", this.onPerfectDodge, this);
    bus.on("level-up", this.pulseLevel, this);
    bus.on("parry", this.onParry, this);
    bus.on("minimap", this.onMinimap, this);
    bus.on("minimap-scene", this.onMinimapScene, this);

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.pausePage === "rename" && this.overlay) {
        this.pausePage = "stats";
        this.renderPause();
        return;
      }
      if (this.resultPending) {
        this.finishResult();
        return;
      }
      if (this.dialogueBox) {
        this.advanceDialogue();
        return;
      }
      if (this.overlay) {
        this.closeOverlay();
        return;
      }
      this.openPause();
    });
    this.input.keyboard?.on("keydown-TAB", (e: KeyboardEvent) => {
      e.preventDefault();
      if (this.pausePage === "rename") return;
      if (this.resultPending || gameState.inDialogue) return;
      if (this.overlay) this.closeOverlay();
      else this.openArmory();
    });
    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.pausePage === "rename") return;
      if (this.resultPending) {
        this.finishResult();
        return;
      }
      if (this.dialogueBox) {
        this.advanceDialogue();
        return;
      }
      if (gameState.inDialogue || gameState.inMenu || gameState.paused || this.overlay) return;
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.pausePage === "rename") {
        this.commitRename();
        return;
      }
      if (this.resultPending) this.finishResult();
    });
    this.input.keyboard?.on("keydown-C", () => {
      if (this.pausePage === "rename") return;
      if (this.resultPending || gameState.inDialogue) return;
      if (this.overlay) {
        this.closeOverlay();
        return;
      }
      this.openShop();
    });
    this.input.keyboard?.on("keydown-M", () => {
      if (this.pausePage === "rename") return;
      if (this.resultPending || gameState.inDialogue || this.overlay) return;
      gameState.settings.showMinimap = !gameState.settings.showMinimap;
      gameState.persistSettings();
      if (!gameState.settings.showMinimap) this.minimapWrap?.setVisible(false);
    });
    this.input.keyboard?.on("keydown-K", () => {
      if (this.pausePage === "rename") return;
      if (this.resultPending || gameState.inDialogue) return;
      if (this.overlay && this.pausePage === "skills") {
        this.closeOverlay();
        return;
      }
      if (this.overlay) this.closeOverlay();
      this.pausePage = "skills";
      this.renderPause();
    });
    this.input.keyboard?.on("keydown-E", () => {
      if (this.pausePage === "rename") return;
      if (this.resultPending) {
        this.finishResult();
        return;
      }
      if (this.dialogueBox) {
        this.advanceDialogue();
        return;
      }
    });
    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (this.pausePage !== "rename" || !this.overlay) return;
      if (e.key === "Enter" || e.key === "Escape" || e.key === "Tab") return;
      if (e.key === "Backspace") {
        this.renameValue = this.renameValue.slice(0, -1);
      } else if (e.key.length === 1 && this.renameValue.length < 18 && /[\w \-]/.test(e.key)) {
        this.renameValue += e.key;
      }
      this.renameLabel?.setText(this.renameValue || "_");
    });

    this.events.on("shutdown", () => {
      bus.off("dialogue", this.openDialogue, this);
      bus.off("armory", this.openArmory, this);
      bus.off("gate", this.openGate, this);
      bus.off("result", this.openResult, this);
      bus.off("boss", this.showBoss, this);
      bus.off("boss-hide", this.hideBoss, this);
      bus.off("favor-show", this.showFavor, this);
      bus.off("favor-hide", this.hideFavor, this);
      bus.off("toast", this.toast, this);
      bus.off("spar-available", this.setSparButton, this);
      bus.off("talk-available", this.setTalkButton, this);
      bus.off("shop", this.openShop, this);
      bus.off("denarii-changed", this.pulseDenarii, this);
      bus.off("combo", this.onCombo, this);
      bus.off("perfect-dodge", this.onPerfectDodge, this);
      bus.off("level-up", this.pulseLevel, this);
      bus.off("parry", this.onParry, this);
      bus.off("minimap", this.onMinimap, this);
      bus.off("minimap-scene", this.onMinimapScene, this);
      this.hideFavor();
    });
  }

  update(): void {
    const s = gameState.save;
    const hpW = 180 * Phaser.Math.Clamp(s.health / Math.max(1, s.stats.maxHealth), 0, 1);
    const stW = 180 * Phaser.Math.Clamp(s.stamina / Math.max(1, s.stats.maxStamina), 0, 1);
    this.hpFill.width = hpW;
    this.stamFill.width = stW;
    this.unguentFill.width = 180 * Phaser.Math.Clamp((s.unguent ?? 0) / UNGUENT_MAX, 0, 1);
    this.xpFill.width = 180 * Phaser.Math.Clamp(s.xp / Math.max(1, s.xpToNext), 0, 1);
    const pts = s.statPoints > 0 ? `  ·  ${s.statPoints} skill` : "";
    this.levelLabel.setText(`Lv ${s.level}   ${Math.floor(s.xp)}/${s.xpToNext} XP${pts}`);
    const vialKey = prettyKey(mergedKeybinds().unguent);
    this.weaponLabel.setText(`${getWeapon(s.equippedWeapon).name}  ·  ${vialKey} unguent  ${s.unguent ?? 0}/${UNGUENT_MAX}`);
    this.setNetButton(s.equippedWeapon === "trident_net");
    this.denariiLabel.setText(`${s.denarii} denarii`);
    this.titleLabel.setText(displayTitle());
    this.objectiveLabel.setText(currentObjectiveText());
    if (this.comboLabel.visible && this.time.now > this.comboHideAt) {
      this.comboLabel.setAlpha(Math.max(0, this.comboLabel.alpha - 0.08));
      if (this.comboLabel.alpha <= 0) this.comboLabel.setVisible(false);
    }
  }

  private lock(on: boolean): void {
    gameState.inMenu = on;
    gameState.paused = on;
  }

  private closeOverlay(): void {
    this.dimmer?.destroy();
    this.dimmer = null;
    this.overlay?.destroy();
    this.overlay = null;
    this.resultPending = false;
    this.gateHouse = null;
    this.waitingBind = null;
    this.renameLabel = undefined;
    this.lock(false);
    gameState.paused = false;
    gameState.inMenu = false;
  }

  private finishResult(): void {
    if (!this.overlay && !this.resultPending) return;
    this.closeOverlay();
    bus.emit("result-closed");
  }

  private box(w: number, h: number, title: string): Phaser.GameObjects.Container {
    this.closeOverlay();
    this.lock(true);
    this.dimmer = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.55)
      .setScrollFactor(0)
      .setDepth(1999)
      .setInteractive();
    const c = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2).setDepth(2000).setScrollFactor(0);
    const bg = this.add.rectangle(0, 0, w, h, 0x2a1c16, 0.97).setStrokeStyle(3, COLORS.gold);
    const inner = this.add.rectangle(0, 0, w - 14, h - 14, 0x000000, 0).setStrokeStyle(1, 0x8a6a3a, 0.7);
    const t = this.add.text(0, -h / 2 + 28, title, { fontFamily: "Cinzel, Georgia", fontSize: "26px", color: "#e8c96a" }).setOrigin(0.5);
    c.add([bg, inner, t]);
    this.overlay = c;
    return c;
  }

  private addBtn(c: Phaser.GameObjects.Container, x: number, y: number, label: string, fn: () => void, w = 240): void {
    const bg = this.add.rectangle(x, y, w, 40, 0x1a1210).setStrokeStyle(1, COLORS.gold).setInteractive({ useHandCursor: true });
    const t = this.add.text(x, y, label, { fontFamily: "Georgia", fontSize: "16px", color: "#e8dcc8" }).setOrigin(0.5);
    bg.on("pointerover", () => bg.setFillStyle(0x3a281c));
    bg.on("pointerout", () => bg.setFillStyle(0x1a1210));
    bg.on("pointerdown", () => {
      audio.sfx("ui");
      fn();
    });
    c.add([bg, t]);
    bg.setScrollFactor(0);
    t.setScrollFactor(0);
  }

  openPause(): void {
    this.pausePage = "root";
    this.renderPause();
  }

  private renderPause(): void {
    if (this.pausePage === "skills") {
      this.renderSkillTree();
      return;
    }
    if (this.pausePage === "keybinds") {
      this.renderKeybinds();
      return;
    }
    if (this.pausePage === "rename") {
      this.renderRename();
      return;
    }
    const c = this.box(520, this.pausePage === "settings" || this.pausePage === "controls" || this.pausePage === "stats" ? 620 : 560, "PAUSED");
    if (this.pausePage === "root") {
      const items: [string, () => void][] = [
        ["Resume", () => this.closeOverlay()],
        ["Skill Tree", () => ((this.pausePage = "skills"), this.renderPause())],
        ["Customize", () => this.openShop()],
        ["Gladiator Stats", () => ((this.pausePage = "stats"), this.renderPause())],
        ["Equipment", () => this.openArmory()],
        ["Objectives", () => ((this.pausePage = "objectives"), this.renderPause())],
        ["Controls", () => ((this.pausePage = "controls"), this.renderPause())],
        ["Settings", () => ((this.pausePage = "settings"), this.renderPause())],
        ["Save Game", () => { gameState.persist(); this.toast(`Game saved (file ${gameState.activeSlot}).`); this.closeOverlay(); }],
        ["Return to Main Menu", () => this.toMenu()],
      ];
      items.forEach((it, i) => this.addBtn(c, 0, -190 + i * 44, it[0], it[1]));
      return;
    }
    if (this.pausePage === "stats") {
      const s = gameState.save;
      const palLine = palUnlocked()
        ? `\n\nEagle  ·  ${palTitle(palTier())}\n${palBrought() ? "Comes with you into the arena." : "Waiting at the roost."}\n${palNextHint()}`
        : "\n\nEagle  ·  locked\nBeat a house champion to earn the bird of Aquila.";
      const body = this.add
        .text(
          0,
          -10,
          `${s.playerName}  ·  Lv ${s.level}  ·  ${s.reputation}\nXP ${Math.floor(s.xp)} / ${s.xpToNext}\nSkill points: ${s.statPoints}\n\nHealth ${Math.round(s.stats.maxHealth)}\nStamina ${Math.round(s.stats.maxStamina)}\nUnguent vials ${s.unguent ?? 0} / 3\nAttack ${s.stats.attack.toFixed(1)}\nDefense ${s.stats.defense.toFixed(1)}\nAgility ${s.stats.agility.toFixed(1)}${palLine}`,
          { fontFamily: "Georgia", fontSize: "16px", color: "#e8dcc8", align: "center" },
        )
        .setOrigin(0.5);
      c.add(body);
      if (palUnlocked()) {
        this.addBtn(
          c,
          0,
          148,
          palBrought() ? "Leave eagle at roost" : "Bring eagle to the arena",
          () => {
            togglePalBrought();
            this.renderPause();
          },
          280,
        );
      }
      this.addBtn(c, -120, 200, "Rename", () => {
        this.renameValue = gameState.save.playerName;
        this.pausePage = "rename";
        this.renderPause();
      }, 180);
      this.addBtn(c, 120, 200, "Skill Tree", () => ((this.pausePage = "skills"), this.renderPause()), 180);
      this.addBtn(c, 0, 250, "Back", () => ((this.pausePage = "root"), this.renderPause()), 180);
      return;
    }
    if (this.pausePage === "objectives") {
      c.add(this.add.text(0, 20, currentObjectiveText(), { fontFamily: "Georgia", fontSize: "20px", color: "#e8dcc8", wordWrap: { width: 420 }, align: "center" }).setOrigin(0.5));
      this.addBtn(c, 0, 200, "Back", () => ((this.pausePage = "root"), this.renderPause()));
    }
    if (this.pausePage === "controls") {
      c.add(this.add.text(0, -10, controlsHelpText(), { fontFamily: "Georgia", fontSize: "16px", color: "#e8dcc8", align: "left" }).setOrigin(0.5));
      this.addBtn(c, 0, 250, "Back", () => ((this.pausePage = "root"), this.renderPause()));
    }
    if (this.pausePage === "settings") {
      const s = gameState.settings;
      const t = this.add
        .text(0, -20, `Music ${Math.round(s.musicVolume * 100)}%   Sound ${Math.round(s.sfxVolume * 100)}%\nShake ${s.screenShake ? "On" : "Off"}   Fullscreen ${s.fullscreen ? "On" : "Off"}`, {
          fontFamily: "Georgia",
          fontSize: "18px",
          color: "#e8dcc8",
          align: "center",
        })
        .setOrigin(0.5);
      c.add(t);
      this.addBtn(c, -120, 70, "Music -", () => { s.musicVolume = Math.max(0, s.musicVolume - 0.1); gameState.persistSettings(); this.renderPause(); }, 140);
      this.addBtn(c, 120, 70, "Music +", () => { s.musicVolume = Math.min(1, s.musicVolume + 0.1); gameState.persistSettings(); this.renderPause(); }, 140);
      this.addBtn(c, -120, 120, "Sound -", () => { s.sfxVolume = Math.max(0, s.sfxVolume - 0.1); gameState.persistSettings(); this.renderPause(); }, 140);
      this.addBtn(c, 120, 120, "Sound +", () => { s.sfxVolume = Math.min(1, s.sfxVolume + 0.1); gameState.persistSettings(); this.renderPause(); }, 140);
      this.addBtn(c, 0, 170, "Toggle shake", () => { s.screenShake = !s.screenShake; gameState.persistSettings(); this.renderPause(); });
      this.addBtn(c, 0, 220, "Toggle fullscreen", () => {
        s.fullscreen = !s.fullscreen;
        if (s.fullscreen) void this.scale.startFullscreen();
        else void this.scale.stopFullscreen();
        gameState.persistSettings();
        this.renderPause();
      });
      this.addBtn(c, 0, 270, "Rebind keys", () => ((this.pausePage = "keybinds"), this.renderPause()));
      this.addBtn(c, 0, 320, "Back", () => ((this.pausePage = "root"), this.renderPause()));
    }
  }

  private renderRename(): void {
    const c = this.box(520, 400, "RENAME");
    c.add(
      this.add
        .text(0, -90, "Type a new name for your gladiator.", {
          fontFamily: "Georgia",
          fontSize: "16px",
          color: "#c4b8a4",
        })
        .setOrigin(0.5),
    );
    c.add(this.add.rectangle(0, -20, 360, 52, 0x1a1210).setStrokeStyle(2, COLORS.gold));
    this.renameLabel = this.add
      .text(0, -20, this.renameValue || "_", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "26px",
        color: "#f4ead8",
      })
      .setOrigin(0.5);
    c.add(this.renameLabel);
    c.add(
      this.add
        .text(0, 36, "Letters, spaces, and hyphens  ·  18 characters", {
          fontFamily: "Georgia",
          fontSize: "14px",
          color: "#9a8a78",
        })
        .setOrigin(0.5),
    );
    this.addBtn(c, 0, 80, "House nickname", () => {
      this.renameValue = generateHouseName(gameState.save.playerHouse, this.renameValue);
      this.renameLabel?.setText(this.renameValue);
    }, 240);
    this.addBtn(c, -110, 130, "Keep name", () => this.commitRename(), 180);
    this.addBtn(c, 110, 130, "Cancel", () => {
      this.pausePage = "stats";
      this.renderPause();
    }, 180);
  }

  private commitRename(): void {
    const name = this.renameValue.trim() || gameState.save.playerName;
    gameState.save.playerName = name.slice(0, 18);
    gameState.persist();
    this.toast(`Now known as ${gameState.save.playerName}.`);
    this.pausePage = "stats";
    this.renderPause();
  }

  private renderKeybinds(): void {
    const c = this.box(560, 620, "REBIND KEYS");
    const binds = mergedKeybinds();
    const actions = Object.keys(ACTION_LABELS) as CombatAction[];
    c.add(
      this.add
        .text(0, -268, this.waitingBind ? `Press a key for ${ACTION_LABELS[this.waitingBind]}` : "Click an action, then press a key. Esc/Tab/K/C/M stay reserved.", {
          fontFamily: "Georgia",
          fontSize: "15px",
          color: "#d4a84b",
          wordWrap: { width: 500 },
          align: "center",
        })
        .setOrigin(0.5),
    );
    actions.forEach((action, i) => {
      const y = -214 + i * 44;
      this.addBtn(c, 0, y, `${ACTION_LABELS[action]}  ·  ${prettyKey(binds[action])}`, () => {
        this.waitingBind = action;
        this.renderKeybinds();
        this.input.keyboard?.once("keydown", (ev: KeyboardEvent) => {
          const name = eventToKeyName(ev);
          this.waitingBind = null;
          if (!name || name === "ESC") {
            this.renderKeybinds();
            return;
          }
          const result = trySetBind(action, name);
          if (result === "reserved") this.toast("That key is reserved.");
          else if (result === "taken") this.toast("That key is already used.");
          else this.toast(`${ACTION_LABELS[action]} set to ${prettyKey(name)}.`);
          this.renderKeybinds();
        });
      }, 360);
    });
    this.addBtn(c, 0, 270, "Back", () => {
      this.waitingBind = null;
      this.pausePage = "settings";
      this.renderPause();
    });
  }

  private renderSkillTree(): void {
    const c = this.box(1080, 640, "SKILL TREE");
    const points = gameState.save.statPoints;
    c.add(
      this.add
        .text(0, -292, points > 0 ? `${points} skill point${points === 1 ? "" : "s"} to spend  ·  click a glowing node` : "Earn XP to level up and unlock skills", {
          fontFamily: "Georgia",
          fontSize: "16px",
          color: "#e8dcc8",
        })
        .setOrigin(0.5),
    );

    const detail = this.add
      .text(0, 252, "Hover a skill. Training dummies, spars, and arena fights all grant XP.", {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#d4a84b",
        wordWrap: { width: 900 },
        align: "center",
      })
      .setOrigin(0.5);
    c.add(detail);

    const colX = [-340, 0, 340];
    const tierY = [-210, -110, -10, 90, 190];
    const lines = this.add.graphics();
    c.add(lines);

    SKILL_BRANCHES.forEach((branch, bi) => {
      const x = colX[bi];
      c.add(
        this.add
          .text(x, -248, branch.title, {
            fontFamily: "Cinzel, Georgia",
            fontSize: "18px",
            color: bi === 0 ? "#e07060" : bi === 1 ? "#e8c96a" : "#7ab8a4",
          })
          .setOrigin(0.5),
      );
      const list = skillsInBranch(branch.id);
      list.forEach((skill, ti) => {
        const y = tierY[ti];
        if (ti > 0) {
          const owned = hasSkill(skill.id);
          const prevOwned = hasSkill(list[ti - 1].id);
          lines.lineStyle(3, owned ? branch.color : prevOwned ? 0x8a6a3a : 0x3a3028, owned ? 0.95 : 0.45);
          lines.lineBetween(x, tierY[ti - 1] + 24, x, y - 24);
        }
        this.addSkillNode(c, x, y, skill, branch.color, detail);
      });
    });

    this.addBtn(c, 0, 292, "Back", () => ((this.pausePage = "root"), this.renderPause()), 200);
  }

  private addSkillNode(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    skill: SkillDef,
    color: number,
    detail: Phaser.GameObjects.Text,
  ): void {
    const owned = hasSkill(skill.id);
    const available = canUnlockSkill(skill.id);
    const fill = owned ? color : available ? 0x3a281c : 0x1a1410;
    const stroke = owned || available ? COLORS.gold : 0x5a4a3a;
    const node = this.add.circle(x, y, 24, fill, 1).setStrokeStyle(3, stroke).setInteractive({ useHandCursor: available || owned });
    const label = this.add
      .text(x, y, skill.name, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "12px",
        color: owned || available ? "#f0e6d2" : "#6a5a4a",
        align: "center",
        wordWrap: { width: 88 },
      })
      .setOrigin(0.5);
    const show = () => {
      const state = owned ? "Learned" : available ? "Click to learn (1 point)" : skill.requires ? "Requires the skill above" : "Need a skill point";
      detail.setText(`${skill.name}  —  ${state}\n${skill.description}`);
    };
    node.on("pointerover", () => {
      show();
      if (available) node.setFillStyle(0x5a3828);
    });
    node.on("pointerout", () => node.setFillStyle(fill));
    node.on("pointerdown", () => {
      if (owned) {
        show();
        return;
      }
      if (!available) {
        this.toast(skill.requires ? "Learn the skill above first." : "Earn a skill point by leveling up.");
        return;
      }
      if (unlockSkill(skill.id)) {
        audio.sfx("ui");
        this.toast(`${skill.name} learned.`);
        this.renderSkillTree();
      }
    });
    c.add([node, label]);
  }

  private pulseDenarii = (): void => {
    this.tweens.add({
      targets: this.denariiLabel,
      scale: 1.12,
      duration: 120,
      yoyo: true,
    });
  };

  private pulseLevel = (): void => {
    this.tweens.add({
      targets: this.levelLabel,
      scale: 1.18,
      duration: 180,
      yoyo: true,
    });
    this.levelLabel.setColor("#e8c96a");
    this.time.delayedCall(900, () => this.levelLabel.setColor("#8ecf6a"));
  };

  private onCombo = (count: number): void => {
    if (count < 2) return;
    this.comboLabel.setText(`${count} HIT`);
    this.comboLabel.setVisible(true);
    this.comboLabel.setAlpha(1);
    this.comboHideAt = this.time.now + 1000;
  };

  private onPerfectDodge = (payload: { first?: boolean }): void => {
    this.perfectFlash?.destroy();
    this.perfectText?.destroy();
    this.perfectFlash = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffe08a, 0.22)
      .setScrollFactor(0)
      .setDepth(3500);
    this.perfectText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "PERFECT DODGE", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "36px",
        color: "#ffe08a",
        stroke: "#1a1210",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3501);
    this.tweens.add({
      targets: [this.perfectFlash, this.perfectText],
      alpha: 0,
      duration: 420,
      onComplete: () => {
        this.perfectFlash?.destroy();
        this.perfectText?.destroy();
        this.perfectFlash = undefined;
        this.perfectText = undefined;
      },
    });
    if (payload?.first) this.toast("Perfect dodge! Stamina returned. Your next hit hits harder.");
  };

  private onParry = (payload: { first?: boolean }): void => {
    this.perfectFlash?.destroy();
    this.perfectText?.destroy();
    this.perfectFlash = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xc9d8e8, 0.2)
      .setScrollFactor(0)
      .setDepth(3500);
    this.perfectText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, "PARRY", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "36px",
        color: "#c9d8e8",
        stroke: "#1a1210",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3501);
    this.tweens.add({
      targets: [this.perfectFlash, this.perfectText],
      alpha: 0,
      duration: 400,
      onComplete: () => {
        this.perfectFlash?.destroy();
        this.perfectText?.destroy();
        this.perfectFlash = undefined;
        this.perfectText = undefined;
      },
    });
    if (payload?.first) this.toast("Parry! They stagger. Tap F into a swing.");
  };

  openShop = (): void => {
    if (this.resultPending) return;
    const c = this.box(1180, 640, "QUARTERS");
    c.add(this.add.rectangle(0, -278, 1120, 8, COLORS.crimson, 0.85));
    c.add(this.add.rectangle(-400, 8, 220, 470, 0x3a281c, 0.55).setStrokeStyle(1, 0x8a6a3a, 0.45));
    c.add(
      this.add
        .text(0, -262, `${gameState.save.denarii} denarii  ·  cloth, dye, titles, and unguent`, {
          fontFamily: "Georgia",
          fontSize: "15px",
          color: "#e8dcc8",
        })
        .setOrigin(0.5),
    );

    const items = SHOP_ITEMS.filter((it) => it.kind === this.shopTab);
    if (!this.shopPreviewId || !items.some((it) => it.id === this.shopPreviewId)) {
      this.shopPreviewId = equippedId(this.shopTab);
    }
    const selected = items.find((it) => it.id === this.shopPreviewId) ?? items[0];
    const look = lookWithItem(selected?.id ?? null);
    makeBodyTexture(this, "shop-preview", look.tunic, look.accent, 1.2, look.style, look.cape, look.scar, look.crest);
    c.add(this.add.image(-530, -78, "shop-preview").setScale(1.45));
    c.add(this.add.text(-530, 36, previewTitle(selected?.id ?? null), { fontFamily: "Cinzel, Georgia", fontSize: "15px", color: "#d4a84b" }).setOrigin(0.5));

    if (selected) {
      const owned = ownsCosmetic(selected.id);
      const equipped = equippedId(selected.kind) === selected.id;
      const locked = !shopUnlocked(selected);
      const canBuy = !owned && !locked && gameState.save.denarii >= selected.cost;
      c.add(
        this.add
          .text(-530, 60, selected.name, {
            fontFamily: "Cinzel, Georgia",
            fontSize: "16px",
            color: "#e8dcc8",
          })
          .setOrigin(0.5),
      );
      c.add(
        this.add
          .text(-530, 86, selected.description, {
            fontFamily: "Georgia",
            fontSize: "13px",
            color: "#c4b49a",
            wordWrap: { width: 220 },
            align: "center",
          })
          .setOrigin(0.5, 0),
      );
      const actionLabel = locked
        ? "Locked"
        : equipped
          ? "Wearing"
          : owned
            ? "Equip"
            : canBuy
              ? `Buy  ·  ${selected.cost} denarii`
              : `Need ${selected.cost} denarii`;
      this.addBtn(
        c,
        -530,
        148,
        actionLabel,
        () => {
          if (locked) {
            this.toast(shopLockHint(selected));
            return;
          }
          if (equipped) {
            this.toast("Already wearing that.");
            return;
          }
          const result = buyCosmetic(selected.id);
          if (result === "poor") this.toast("Not enough denarii.");
          else if (result === "locked") this.toast("That is still locked.");
          else if (result === "bought") this.toast(`Bought ${selected.name}.`);
          else this.toast(`Equipped ${selected.name}.`);
          audio.sfx("ui");
          this.openShop();
        },
        220,
      );
    }

    const vials = gameState.save.unguent ?? 0;
    c.add(
      this.add
        .text(-530, 196, `Unguent  ${vials}/${UNGUENT_MAX}\nDrink with ${prettyKey(mergedKeybinds().unguent)} in a fight.`, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#c8dca0",
          align: "center",
        })
        .setOrigin(0.5),
    );
    const buyLabel = vials >= UNGUENT_MAX ? "Vials full" : `Buy vial  ·  ${UNGUENT_COST} denarii`;
    this.addBtn(
      c,
      -530,
      248,
      buyLabel,
      () => {
        const result = buyUnguent();
        if (result === "poor") this.toast("Not enough denarii.");
        else if (result === "full") this.toast("You already carry three vials.");
        else this.toast("Unguent bought. Drink it in a fight.");
        audio.sfx("ui");
        this.openShop();
      },
      220,
    );

    const tab = SHOP_TABS.find((t) => t.kind === this.shopTab) ?? SHOP_TABS[0];
    const tabY = -218;
    c.add(this.add.rectangle(90, tabY, 760, 46, 0x1a1210, 0.72).setStrokeStyle(1, 0x8a6a3a, 0.55));
    SHOP_TABS.forEach((entry, i) => {
      this.addShopTab(c, -205 + i * 118, tabY, entry.label, entry.kind === this.shopTab, () => {
        this.shopTab = entry.kind;
        this.shopPreviewId = null;
        this.openShop();
      });
    });
    c.add(
      this.add
        .text(90, -178, `${tab.hint}  ·  Click an item to preview.`, {
          fontFamily: "Georgia",
          fontSize: "14px",
          color: "#d4a84b",
        })
        .setOrigin(0.5),
    );

    const cols = items.length > 8 ? 3 : 2;
    const colW = cols === 3 ? 286 : 400;
    const startX = cols === 3 ? -250 : -160;
    const rowH = 64;
    items.forEach((item, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * colW;
      const y = -136 + row * rowH;
      const owned = ownsCosmetic(item.id);
      const equipped = equippedId(item.kind) === item.id;
      const locked = !shopUnlocked(item);
      const canBuy = !owned && !locked && gameState.save.denarii >= item.cost;
      const previewing = item.id === selected?.id;
      const swatch =
        item.kind === "tunic"
          ? TUNIC_HEX[item.id.replace("tunic-", "")]
          : item.kind === "plume"
            ? PLUME_HEX[item.id.replace("plume-", "")]
            : item.kind === "cape"
              ? CAPE_HEX[item.id.replace("cape-", "")] || 0x3a3028
              : item.kind === "scar"
                ? 0x6a3030
                : COLORS.gold;
      const cardW = cols === 3 ? 268 : 370;
      const card = this.add
        .rectangle(x, y, cardW, 56, previewing ? 0x3a281c : 0x1a1210, 0.96)
        .setStrokeStyle(previewing ? 2 : 1, previewing ? COLORS.gold : equipped ? 0x8ecf6a : 0x5a4a38)
        .setInteractive({ useHandCursor: true });
      const chip = this.add.rectangle(x - cardW / 2 + 18, y, 18, 18, locked ? 0x3a3028 : swatch).setStrokeStyle(1, previewing ? COLORS.gold : 0x1a1210);
      const name = this.add
        .text(x - cardW / 2 + 34, y - 10, item.name, {
          fontFamily: "Georgia",
          fontSize: "14px",
          color: locked ? "#6a5a4a" : "#e8dcc8",
        })
        .setOrigin(0, 0.5);
      const status = locked
        ? item.requiresFlag === "freedomWon"
          ? "Locked — win the Rudis"
          : item.requiresFlag
            ? "Locked — steel has to mark you"
            : "Locked — win that house first"
        : previewing
          ? equipped
            ? "Preview  ·  wearing"
            : "Preview"
          : equipped
            ? "Wearing"
            : owned
              ? "Owned"
              : `${item.cost} denarii`;
      const detail = this.add
        .text(x - cardW / 2 + 34, y + 10, status, {
          fontFamily: "Georgia",
          fontSize: "12px",
          color: equipped ? "#8ecf6a" : canBuy || owned ? "#d4a84b" : "#6a5a4a",
          wordWrap: { width: cardW - 48 },
        })
        .setOrigin(0, 0.5);
      card.on("pointerover", () => card.setFillStyle(previewing ? 0x4a3424 : 0x3a281c));
      card.on("pointerout", () => card.setFillStyle(previewing ? 0x3a281c : 0x1a1210));
      card.on("pointerdown", () => {
        audio.sfx("ui");
        this.shopPreviewId = item.id;
        this.openShop();
      });
      c.add([card, chip, name, detail]);
    });
    this.addBtn(c, 90, 292, "Close", () => this.closeOverlay(), 200);
  };

  private addShopTab(c: Phaser.GameObjects.Container, x: number, y: number, label: string, active: boolean, fn: () => void): void {
    const bg = this.add
      .rectangle(x, y, 108, 32, active ? 0x3a281c : 0x14100e)
      .setStrokeStyle(active ? 2 : 1, active ? COLORS.gold : 0x6a5a3a)
      .setInteractive({ useHandCursor: true });
    const t = this.add
      .text(x, y, label, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "14px",
        color: active ? "#e8c96a" : "#c4b49a",
      })
      .setOrigin(0.5);
    bg.on("pointerover", () => {
      if (!active) bg.setFillStyle(0x2a1c16);
    });
    bg.on("pointerout", () => bg.setFillStyle(active ? 0x3a281c : 0x14100e));
    bg.on("pointerdown", () => {
      audio.sfx("ui");
      fn();
    });
    c.add([bg, t]);
  }

  openArmory(): void {
    const c = this.box(980, 600, "ARMORY");
    c.add(this.add.rectangle(0, -258, 920, 8, 0x6a2420, 0.9));
    c.add(this.add.rectangle(-310, 8, 280, 430, 0x241810, 0.72).setStrokeStyle(1, 0x8a6a3a, 0.5));
    const s = gameState.save;
    const cur = getWeapon(s.equippedWeapon);
    this.textures.get(weaponIconKey(cur.id))?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const icon = this.add.image(-310, -150, weaponIconKey(cur.id)).setScale(3.2);
    icon.setTint(0xffffff);
    c.add(icon);
    c.add(
      this.add
        .text(-310, -88, cur.name, {
          fontFamily: "Cinzel, Georgia",
          fontSize: "20px",
          color: "#e8c96a",
          wordWrap: { width: 250 },
          align: "center",
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(-310, -20, `Light  ${cur.light.name}\nHeavy  ${cur.heavy.name}\nSpecial  ${cur.specialName}`, {
          fontFamily: "Georgia",
          fontSize: "15px",
          color: "#e8dcc8",
          align: "center",
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(-310, 70, cur.specialDescription, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#c4b49a",
          wordWrap: { width: 250 },
          align: "center",
        })
        .setOrigin(0.5, 0),
    );
    c.add(
      this.add
        .text(-310, 150, cur.description, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#d4a84b",
          wordWrap: { width: 250 },
          align: "center",
        })
        .setOrigin(0.5, 0),
    );

    WEAPON_ORDER.forEach((id, i) => {
      const w = getWeapon(id);
      const unlocked = s.unlockedWeapons.includes(id);
      const equipped = s.equippedWeapon === id;
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = col === 0 ? 80 : 330;
      const y = -200 + row * 92;
      const card = this.add
        .rectangle(x, y, 230, 78, equipped ? 0x3a281c : 0x1a1210, 0.96)
        .setStrokeStyle(equipped ? 2 : 1, equipped ? COLORS.gold : unlocked ? 0x6a5a3a : 0x3a3028);
      const blade = this.add.image(x - 78, y - 4, weaponIconKey(id)).setScale(1.35);
      if (!unlocked) blade.setTint(0x5a4a40);
      const label = this.add
        .text(x + 18, y - 14, w.shortName, {
          fontFamily: "Cinzel, Georgia",
          fontSize: "16px",
          color: unlocked ? "#e8dcc8" : "#6a5a4a",
        })
        .setOrigin(0.5);
      const status = this.add
        .text(x + 18, y + 10, equipped ? "Equipped" : unlocked ? "Ready" : "Locked", {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: equipped ? "#8ecf6a" : unlocked ? "#d4a84b" : "#6a5a4a",
        })
        .setOrigin(0.5);
      c.add([card, blade, label, status]);
      if (unlocked && w.playable) {
        card.setInteractive({ useHandCursor: true });
        card.on("pointerover", () => card.setFillStyle(0x4a3424));
        card.on("pointerout", () => card.setFillStyle(equipped ? 0x3a281c : 0x1a1210));
        card.on("pointerdown", () => {
          s.equippedWeapon = id;
          gameState.persist();
          bus.emit("weapon-changed", id);
          audio.sfx("ui");
          this.openArmory();
        });
      }
    });
    this.addBtn(c, 200, 250, "Close", () => this.closeOverlay(), 180);
  }

  openGate(): void {
    const rivals = rivalHouses();
    const showTourney = tournamentUnlocked() || gameState.save.freedomWon;
    if (!this.gateHouse) {
      const c = this.box(720, 600, "ARENA GATE");
      c.add(this.add.text(0, -250, "Choose a house", { fontFamily: "Georgia", fontSize: "18px", color: "#e8dcc8" }).setOrigin(0.5));
      rivals.forEach((h, i) => {
        const unlocked = isHouseUnlocked(h.id);
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? -170 : 170;
        const y = -200 + row * 72;
        const beaten = gameState.save.defeatedHouses.includes(h.id);
        c.add(this.add.text(x, y, `${h.latinName}${beaten ? "  (beaten)" : ""}`, { fontFamily: "Georgia", fontSize: "15px", color: unlocked ? "#e8dcc8" : "#6a5a4a" }).setOrigin(0.5));
        this.addBtn(c, x, y + 24, unlocked ? (beaten ? "Rematches" : "Enter") : "Locked", () => {
          if (!unlocked) {
            this.toast(houseLockHint(h.id));
            return;
          }
          this.gateHouse = h.id;
          this.openGate();
        }, 160);
      });
      if (showTourney) {
        this.addBtn(c, 0, 130, gameState.save.freedomWon ? "The Rudis (done)" : "The Rudis", () => {
          if (gameState.save.freedomWon) {
            this.toast("The wooden sword is already yours.");
            return;
          }
          this.gateHouse = TOURNAMENT_HOUSE.id;
          this.openGate();
        }, 220);
      }
      this.addBtn(c, 0, 250, "Stay at the ludus", () => {
        this.gateHouse = null;
        this.closeOverlay();
      });
      return;
    }
    const house = getHouse(this.gateHouse)!;
    const c = this.box(640, 560, this.gateHouse === "rudis" ? "THE RUDIS" : "ARENA GATE");
    const titleColor = houseTitleColor(house.id);
    c.add(this.add.text(0, -230, `${house.latinName} — ${house.name}`, { fontFamily: "Georgia", fontSize: "18px", color: titleColor }).setOrigin(0.5));
    house.fighters.forEach((f, i) => {
      const open = isOpponentUnlocked(f.id);
      const beaten = gameState.save.defeatedOpponents.includes(f.id);
      const y = -175 + i * 70;
      const status = !open ? "Locked" : beaten ? "Rematch" : f.isChampion || isTournamentId(f.id) ? "FIGHT" : "Fight";
      c.add(this.add.text(0, y, `${f.name}  ·  ${f.title}  ·  ${getWeapon(f.weapon).shortName}`, { fontFamily: "Georgia", fontSize: "16px", color: open ? "#e8dcc8" : "#6a5a4a" }).setOrigin(0.5));
      if (open) {
        this.addBtn(c, 0, y + 26, status, () => {
          gameState.pendingArenaOpponent = f.id;
          this.gateHouse = null;
          this.closeOverlay();
          bus.emit("enter-arena", f.id);
        }, 180);
      }
    });
    this.addBtn(c, -120, 230, "Houses", () => {
      this.gateHouse = null;
      this.openGate();
    }, 180);
    this.addBtn(c, 120, 230, "Stay at the ludus", () => {
      this.gateHouse = null;
      this.closeOverlay();
    }, 200);
  }

  openDialogue = (payload: { name: string; lines: string[]; onDone?: () => void }): void => {
    this.closeOverlay();
    gameState.inDialogue = true;
    gameState.paused = true;
    this.dialogueLines = payload.lines;
    this.dialogueIndex = 0;
    this.dialogueName = payload.name;
    this.dialogueDone = payload.onDone;
    this.renderDialogue();
  };

  private renderDialogue(): void {
    this.dialogueBox?.destroy();
    const c = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT - 110).setDepth(3000).setScrollFactor(0);
    const bg = this.add.rectangle(0, 0, 920, 148, 0x241810, 0.96).setStrokeStyle(3, COLORS.gold);
    const inner = this.add.rectangle(0, 0, 904, 132, 0x000000, 0).setStrokeStyle(1, 0x8a6a3a, 0.65);
    const accent = this.add.rectangle(-448, 0, 8, 132, COLORS.crimson, 0.95);
    const namePlate = this.add.rectangle(-300, -52, 220, 28, 0x1a1210, 0.9).setStrokeStyle(1, COLORS.gold);
    const name = this.add.text(-300, -52, this.dialogueName, { fontFamily: "Cinzel, Georgia", fontSize: "16px", color: "#e8c96a" }).setOrigin(0.5);
    const body = this.add.text(-420, -18, this.dialogueLines[this.dialogueIndex] ?? "", {
      fontFamily: "Georgia",
      fontSize: "20px",
      color: "#f0e6d2",
      wordWrap: { width: 820 },
    });
    const hint = this.add.text(430, 52, "Space / E", { fontFamily: "Georgia", fontSize: "13px", color: "#9a8a78" }).setOrigin(1, 0.5);
    c.add([bg, inner, accent, namePlate, name, body, hint]);
    this.dialogueBox = c;
  }

  private advanceDialogue(): void {
    this.dialogueIndex += 1;
    if (this.dialogueIndex >= this.dialogueLines.length) {
      this.dialogueBox?.destroy();
      this.dialogueBox = null;
      gameState.inDialogue = false;
      gameState.paused = false;
      const done = this.dialogueDone;
      this.dialogueDone = undefined;
      done?.();
      return;
    }
    this.renderDialogue();
  }

  openResult = (payload: { title: string; body: string; action?: string }): void => {
    const c = this.box(620, 360, payload.title);
    this.resultPending = true;
    c.add(
      this.add
        .text(0, 20, payload.body, {
          fontFamily: "Georgia",
          fontSize: "18px",
          color: "#e8dcc8",
          wordWrap: { width: 520 },
          align: "center",
        })
        .setOrigin(0.5),
    );
    this.addBtn(c, 0, 130, payload.action ?? "Continue", () => this.finishResult(), 280);
    this.dimmer?.on("pointerdown", () => this.finishResult());
  };

  showBoss = (name: string): void => {
    this.hideBoss();
    const bg = this.add.rectangle(GAME_WIDTH / 2, 64, 640, 22, 0x1a1210).setScrollFactor(0).setDepth(120);
    const fill = this.add.rectangle(GAME_WIDTH / 2 - 316, 64, 632, 16, COLORS.foxOrange).setOrigin(0, 0.5).setScrollFactor(0).setDepth(121);
    const label = this.add.text(GAME_WIDTH / 2, 42, name, { fontFamily: "Cinzel, Georgia", fontSize: "16px", color: "#e8dcc8" }).setOrigin(0.5).setScrollFactor(0).setDepth(122);
    this.bossWrap = [bg, fill, label];
    bus.on("boss-hp", (ratio: number) => {
      fill.width = 632 * Phaser.Math.Clamp(ratio, 0, 1);
    });
  };

  hideBoss = (): void => {
    this.bossWrap.forEach((o) => o.destroy());
    this.bossWrap = [];
  };

  showFavor = (): void => {
    this.hideFavor();
    const y = 88;
    const bg = this.add.rectangle(GAME_WIDTH / 2, y, 280, 12, 0x1a1210).setScrollFactor(0).setDepth(120);
    const fill = this.add.rectangle(GAME_WIDTH / 2 - 136, y, 272, 8, COLORS.gold).setOrigin(0, 0.5).setScrollFactor(0).setDepth(121);
    const label = this.add
      .text(GAME_WIDTH / 2, y - 16, "FAVOR", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "12px",
        color: "#d4a84b",
        stroke: "#1a1210",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(122);
    this.favorWrap = [bg, fill, label];
    bus.on("favor", this.onFavor);
  };

  hideFavor = (): void => {
    bus.off("favor", this.onFavor);
    this.favorWrap.forEach((o) => o.destroy());
    this.favorWrap = [];
  };

  private onFavor = (value: number): void => {
    const fill = this.favorWrap[1] as Phaser.GameObjects.Rectangle | undefined;
    if (!fill) return;
    const t = Phaser.Math.Clamp(value / 100, 0, 1);
    fill.width = 272 * t;
    fill.setFillStyle(t < 0.35 ? COLORS.crimson : t < 0.55 ? 0xc48a48 : COLORS.gold);
  };

  private onMinimapScene = (scene: string): void => {
    this.minimapScene = scene;
    if (scene !== "ludus") this.minimapWrap?.setVisible(false);
  };

  private onMinimap = (payload: {
    show: boolean;
    cols: number;
    rows: number;
    playerX: number;
    playerY: number;
    marks: { x: number; y: number; color: number; kind: string }[];
  }): void => {
    if (this.minimapScene !== "ludus" || !gameState.settings.showMinimap || !payload.show) {
      this.minimapWrap?.setVisible(false);
      return;
    }
    const w = 168;
    const h = 126;
    if (!this.minimapWrap) {
      this.minimapWrap = this.add.container(18, GAME_HEIGHT - h - 18).setScrollFactor(0).setDepth(140);
      const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x1a1210, 0.82).setStrokeStyle(2, COLORS.gold);
      this.minimapGfx = this.add.graphics();
      const label = this.add.text(w / 2, 8, "YARD  ·  M", { fontFamily: "Cinzel, Georgia", fontSize: "11px", color: "#d4a84b" }).setOrigin(0.5, 0);
      this.minimapWrap.add([bg, this.minimapGfx, label]);
    }
    this.minimapWrap.setVisible(true);
    const g = this.minimapGfx!;
    g.clear();
    const pad = 16;
    const mw = w - pad * 2;
    const mh = h - pad * 2 - 6;
    const sx = mw / payload.cols;
    const sy = mh / payload.rows;
    g.fillStyle(0x3a3028, 0.9);
    g.fillRect(pad, pad + 8, mw, mh);
    payload.marks.forEach((m) => {
      const x = pad + (m.x / 32) * sx;
      const y = pad + 8 + (m.y / 32) * sy;
      g.fillStyle(m.color, 1);
      g.fillCircle(x, y, m.kind === "gate" ? 3.5 : 2.5);
    });
    const px = pad + (payload.playerX / 32) * sx;
    const py = pad + 8 + (payload.playerY / 32) * sy;
    g.fillStyle(0xf0e6d2, 1);
    g.fillCircle(px, py, 4);
    g.lineStyle(1, COLORS.gold, 1);
    g.strokeCircle(px, py, 5);
  };

  toast = (msg: string): void => {
    const t = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, msg, {
        fontFamily: "Georgia",
        fontSize: "20px",
        color: "#e8c96a",
        backgroundColor: "#1a1210ee",
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(4000);
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 30, delay: 900, duration: 400, onComplete: () => t.destroy() });
  };

  private addAttackButton(): void {
    const x = GAME_WIDTH - 96;
    const y = GAME_HEIGHT - 96;
    const bg = this.add
      .circle(x, y, 58, COLORS.crimson, 0.95)
      .setStrokeStyle(4, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(160)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y - 4, "LIGHT", {
        fontFamily: "Georgia",
        fontSize: "20px",
        color: "#e8dcc8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161);
    this.add
      .text(x, y + 18, "or Space", {
        fontFamily: "Georgia",
        fontSize: "13px",
        color: "#d4a84b",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161);

    bg.on("pointerover", () => bg.setFillStyle(0xc44a38));
    bg.on("pointerout", () => bg.setFillStyle(COLORS.crimson));
    bg.on("pointerdown", () => {
      if (this.overlay || this.resultPending) return;
      if (this.dialogueBox) {
        this.advanceDialogue();
        return;
      }
      if (gameState.inDialogue || gameState.inMenu || gameState.paused) return;
      bus.emit("player-attack", "light");
    });
  }

  private addHeavyButton(): void {
    const x = GAME_WIDTH - 96;
    const y = GAME_HEIGHT - 222;
    const bg = this.add
      .circle(x, y, 44, 0x6a2a22, 0.95)
      .setStrokeStyle(3, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(160)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y - 4, "HEAVY", {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#e8dcc8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161);
    this.add
      .text(x, y + 16, "or G", {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: "#d4a84b",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161);

    bg.on("pointerover", () => bg.setFillStyle(0x8a3a2c));
    bg.on("pointerout", () => bg.setFillStyle(0x6a2a22));
    bg.on("pointerdown", () => {
      if (this.overlay || this.resultPending) return;
      if (this.dialogueBox) {
        this.advanceDialogue();
        return;
      }
      if (gameState.inDialogue || gameState.inMenu || gameState.paused) return;
      bus.emit("player-attack", "heavy");
    });
  }

  private addNetButton(): void {
    const x = GAME_WIDTH - 220;
    const y = GAME_HEIGHT - 222;
    this.netBg = this.add
      .circle(x, y, 44, 0x2a5a62, 0.95)
      .setStrokeStyle(3, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(160)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.netLabel = this.add
      .text(x, y - 4, "NET", {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#e8dcc8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161)
      .setVisible(false);
    this.netHint = this.add
      .text(x, y + 16, "or R", {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: "#d4a84b",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161)
      .setVisible(false);

    this.netBg.on("pointerover", () => this.netBg.setFillStyle(0x3a7a84));
    this.netBg.on("pointerout", () => this.netBg.setFillStyle(0x2a5a62));
    this.netBg.on("pointerdown", () => {
      if (this.overlay || this.resultPending) return;
      if (this.dialogueBox) {
        this.advanceDialogue();
        return;
      }
      if (gameState.inDialogue || gameState.inMenu || gameState.paused) return;
      if (gameState.save.equippedWeapon !== "trident_net") return;
      bus.emit("player-special");
    });
  }

  private setNetButton(show: boolean): void {
    this.netBg?.setVisible(show);
    this.netLabel?.setVisible(show);
    this.netHint?.setVisible(show);
    if (!this.netBg) return;
    if (show) {
      this.netHint.setText(`or ${prettyKey(mergedKeybinds().special)}`);
      this.netBg.setInteractive({ useHandCursor: true });
    } else {
      this.netBg.disableInteractive();
    }
  }

  private addSparButton(): void {
    const x = GAME_WIDTH - 220;
    const y = GAME_HEIGHT - 96;
    this.sparBg = this.add
      .circle(x, y, 50, 0xb08a3a, 0.95)
      .setStrokeStyle(4, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(160)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.sparLabel = this.add
      .text(x, y - 4, "SPAR", {
        fontFamily: "Georgia",
        fontSize: "18px",
        color: "#1a1210",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161)
      .setVisible(false);
    this.sparHint = this.add
      .text(x, y + 18, "click here", {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161)
      .setVisible(false);

    this.sparBg.on("pointerover", () => this.sparBg.setFillStyle(0xd4a84b));
    this.sparBg.on("pointerout", () => this.sparBg.setFillStyle(this.sparYield ? 0x6a3a2a : 0xb08a3a));
    this.sparBg.on("pointerdown", () => {
      if (this.overlay || this.resultPending || gameState.inDialogue || gameState.inMenu) return;
      if (this.sparYield) bus.emit("player-yield");
      else bus.emit("player-spar");
    });
  }

  private addTalkButton(): void {
    const x = GAME_WIDTH - 340;
    const y = GAME_HEIGHT - 96;
    this.talkBg = this.add
      .circle(x, y, 50, 0x3a4a6a, 0.95)
      .setStrokeStyle(4, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(160)
      .setInteractive({ useHandCursor: true })
      .setVisible(false);
    this.talkLabel = this.add
      .text(x, y - 4, "TALK", {
        fontFamily: "Georgia",
        fontSize: "18px",
        color: "#e8dcc8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161)
      .setVisible(false);
    this.talkHint = this.add
      .text(x, y + 18, "or E", {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: "#d4a84b",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161)
      .setVisible(false);

    this.talkBg.on("pointerover", () => this.talkBg.setFillStyle(0x4a5a7a));
    this.talkBg.on("pointerout", () => this.talkBg.setFillStyle(0x3a4a6a));
    this.talkBg.on("pointerdown", () => {
      if (this.overlay || this.resultPending || gameState.inDialogue || gameState.inMenu || gameState.paused) return;
      bus.emit("player-interact");
    });
  }

  private setSparButton = (payload: { show: boolean; yield?: boolean }): void => {
    this.sparYield = Boolean(payload.yield);
    const show = payload.show;
    this.sparBg.setVisible(show);
    this.sparLabel.setVisible(show);
    this.sparHint.setVisible(show);
    if (!show) return;
    this.sparLabel.setText(this.sparYield ? "YIELD" : "SPAR");
    this.sparHint.setText(this.sparYield ? "end match" : "click here");
    this.sparBg.setFillStyle(this.sparYield ? 0x6a3a2a : 0xb08a3a);
  };

  private setTalkButton = (payload: { show: boolean; label?: string }): void => {
    const show = payload.show;
    this.talkBg.setVisible(show);
    this.talkLabel.setVisible(show);
    this.talkHint.setVisible(show);
    if (!show) return;
    this.talkLabel.setText(payload.label ?? "TALK");
  };

  private toMenu(): void {
    gameState.persist();
    this.closeOverlay();
    this.scene.stop("LudusScene");
    this.scene.stop("ArenaScene");
    this.scene.start("MenuScene");
    this.scene.stop();
  }
}
