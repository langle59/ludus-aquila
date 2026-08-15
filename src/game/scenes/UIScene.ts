import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, UNGUENT_COST, UNGUENT_MAX } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { currentObjectiveText } from "../systems/objectives";
import { WEAPON_ORDER, getWeapon, masteryHint, masteryLevel, weaponIconKey } from "../data/weapons";
import { getHouse, houseTitleColor, isTournamentId } from "../data/houses";
import { TOURNAMENT_HOUSE } from "../data/tournament";
import { isOpponentUnlocked, canUnlockSkill, unlockSkill, hasSkill, buyCosmetic, buyUnguent, isHouseUnlocked, houseLockHint, rivalHouses, tournamentUnlocked, clearInjury, playerCombatStats } from "../systems/progression";
import { TABLE_BETS, TABLE_GAMES, takeTableBet, settleTakenBet, rollAleaDice, aleaOutcome, freshDeck, drawCard, handTotal, isNatural, dealerShouldHit, blackjackCompare, cardTex, type AleaResult, type Card, type BlackjackOutcome } from "../systems/gambling";
import { audio } from "../systems/audio";
import { makeBodyTexture } from "../systems/assets";
import { SKILL_BRANCHES, skillsInBranch, type SkillDef } from "../data/skills";
import { SHOP_ITEMS, SHOP_TABS, TUNIC_HEX, PLUME_HEX, CAPE_HEX, ownsCosmetic, shopUnlocked, shopLockHint, equippedId, displayTitle, lookWithItem, previewTitle, type ShopKind } from "../data/shop";
import { palAnimalName, palBondHint, palBondProgress, palBrought, palCombatStats, palDisplayName, palNextHint, palSkillsInBranch, palTexture, palTier, palTintColor, palTintId, palTitle, palUnlocked, canUnlockPalSkill, hasPalSkill, unlockPalSkill, PAL_SKILL_BRANCHES, PAL_TINTS, rollPalName, setPalTint, togglePalBrought, type PalSkillDef } from "../data/pal";
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
  private favorMarker?: Phaser.GameObjects.Rectangle;
  private favorYouFill?: Phaser.GameObjects.Rectangle;
  private palHpBg?: Phaser.GameObjects.Rectangle;
  private palHpFill?: Phaser.GameObjects.Rectangle;
  private palHpLabel?: Phaser.GameObjects.Text;
  private overlay: Phaser.GameObjects.Container | null = null;
  private aleaLast: AleaResult | null = null;
  private aleaBusy = false;
  private aleaPending: { bet: number; player: [number, number]; house: [number, number] } | null = null;
  private aleaDice: Phaser.GameObjects.Image[] = [];
  private aleaYou?: Phaser.GameObjects.Text;
  private aleaHouse?: Phaser.GameObjects.Text;
  private aleaStatus?: Phaser.GameObjects.Text;
  private aleaPurse?: Phaser.GameObjects.Text;
  private bjBusy = false;
  private bj: {
    bet: number;
    deck: Card[];
    player: Card[];
    house: Card[];
    holeHidden: boolean;
    phase: "bet" | "dealing" | "play" | "done";
    message: string;
  } | null = null;
  private bjHouseCards: Phaser.GameObjects.Image[] = [];
  private bjPlayerCards: Phaser.GameObjects.Image[] = [];
  private bjHouseTotal?: Phaser.GameObjects.Text;
  private bjPlayerTotal?: Phaser.GameObjects.Text;
  private bjStatus?: Phaser.GameObjects.Text;
  private bjPurse?: Phaser.GameObjects.Text;
  private bjDeck?: Phaser.GameObjects.Image;
  private bjBtnWrap?: Phaser.GameObjects.Container;
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
  private roostTab: "care" | "looks" = "care";
  private shopPreviewId: string | null = null;
  private minimapWrap?: Phaser.GameObjects.Container;
  private minimapGfx?: Phaser.GameObjects.Graphics;
  private minimapScene = "none";
  private renameValue = "";
  private renameLabel?: Phaser.GameObjects.Text;
  private musicMuteText?: Phaser.GameObjects.Text;
  private judgmentOpen = false;
  private judgmentWrap: Phaser.GameObjects.GameObject[] = [];

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
    this.palHpBg = this.add.rectangle(56, 124, 180, 8, 0x000000, 0.7).setOrigin(0, 0).setScrollFactor(0).setDepth(99).setVisible(false);
    this.palHpFill = this.add.rectangle(56, 124, 180, 8, 0x6aa84f).setOrigin(0, 0).setScrollFactor(0).setDepth(100).setVisible(false);
    this.palHpLabel = this.add
      .text(56, 116, "Pal", { fontFamily: "Cinzel, Georgia", fontSize: "10px", color: "#e8c96a" })
      .setScrollFactor(0)
      .setDepth(100)
      .setVisible(false);

    this.weaponLabel = this.add.text(28, GAME_HEIGHT - 40, "", { fontFamily: "Georgia", fontSize: "16px", color: "#d4a84b", stroke: "#1a1210", strokeThickness: 4 }).setScrollFactor(0).setDepth(100);
    this.addAttackButton();
    this.addHeavyButton();
    this.addNetButton();
    this.addSparButton();
    this.addTalkButton();
    this.addMusicMuteButton();

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
      if (this.resultPending || gameState.inDialogue || this.judgmentOpen) return;
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
    bus.on("crowd-call", this.onCrowdCall, this);
    bus.on("judgment-show", this.showJudgment, this);
    bus.on("judgment-hide", this.hideJudgment, this);
    bus.on("return-ludus", this.returnLudus, this);
    bus.on("pal-hp-show", this.showPalHp, this);
    bus.on("pal-hp", this.onPalHp, this);
    bus.on("pal-hp-hide", this.hidePalHp, this);
    bus.on("toast", this.toast, this);
    bus.on("spar-available", this.setSparButton, this);
    bus.on("talk-available", this.setTalkButton, this);
    bus.on("shop", this.openShop, this);
    bus.on("roost", this.openRoost, this);
    bus.on("dice", this.openTable, this);
    bus.on("table", this.openTable, this);
    bus.on("denarii-changed", this.pulseDenarii, this);
    bus.on("combo", this.onCombo, this);
    bus.on("perfect-dodge", this.onPerfectDodge, this);
    bus.on("level-up", this.pulseLevel, this);
    bus.on("parry", this.onParry, this);
    bus.on("minimap", this.onMinimap, this);
    bus.on("minimap-scene", this.onMinimapScene, this);

    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.judgmentOpen) return;
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
      if (this.judgmentOpen) return;
      if (this.pausePage === "rename") return;
      if (this.resultPending || gameState.inDialogue) return;
      if (this.overlay) this.closeOverlay();
      else this.openArmory();
    });
    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.judgmentOpen) {
        this.pickJudgment(true);
        return;
      }
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
      if (this.judgmentOpen) {
        this.pickJudgment(true);
        return;
      }
      if (this.pausePage === "rename") {
        this.commitRename();
        return;
      }
      if (this.resultPending) this.finishResult();
    });
    this.input.keyboard?.on("keydown-C", () => {
      if (this.judgmentOpen) return;
      if (this.pausePage === "rename") return;
      if (this.resultPending || gameState.inDialogue) return;
      if (this.overlay) {
        this.closeOverlay();
        return;
      }
      this.openShop();
    });
    this.input.keyboard?.on("keydown-M", () => {
      if (this.judgmentOpen) return;
      if (this.pausePage === "rename") return;
      if (this.resultPending || gameState.inDialogue || this.overlay) return;
      gameState.settings.showMinimap = !gameState.settings.showMinimap;
      gameState.persistSettings();
      if (!gameState.settings.showMinimap) this.minimapWrap?.setVisible(false);
    });
    this.input.keyboard?.on("keydown-K", () => {
      if (this.judgmentOpen) return;
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
      if (this.judgmentOpen) {
        this.pickJudgment(true);
        return;
      }
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
    this.input.keyboard?.on("keydown-Q", () => {
      if (this.judgmentOpen) this.pickJudgment(false);
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
      bus.off("crowd-call", this.onCrowdCall, this);
      bus.off("judgment-show", this.showJudgment, this);
      bus.off("judgment-hide", this.hideJudgment, this);
      bus.off("return-ludus", this.returnLudus, this);
      bus.off("pal-hp-show", this.showPalHp, this);
      bus.off("pal-hp", this.onPalHp, this);
      bus.off("pal-hp-hide", this.hidePalHp, this);
      bus.off("toast", this.toast, this);
      bus.off("spar-available", this.setSparButton, this);
      bus.off("talk-available", this.setTalkButton, this);
      bus.off("shop", this.openShop, this);
      bus.off("roost", this.openRoost, this);
      bus.off("dice", this.openTable, this);
      bus.off("table", this.openTable, this);
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
    this.musicMuteText?.setText(audio.musicMuteLabel());
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
    if (this.aleaPending) {
      const p = this.aleaPending;
      const outcome = aleaOutcome(p.player[0] + p.player[1], p.house[0] + p.house[1]);
      settleTakenBet(p.bet, outcome);
      this.aleaLast = {
        bet: p.bet,
        player: p.player[0] + p.player[1],
        house: p.house[0] + p.house[1],
        playerDice: p.player,
        houseDice: p.house,
        outcome,
      };
      this.aleaPending = null;
      this.aleaBusy = false;
    }
    this.aleaDice = [];
    this.aleaYou = undefined;
    this.aleaHouse = undefined;
    this.aleaStatus = undefined;
    this.aleaPurse = undefined;
    this.bjBusy = false;
    this.bjHouseCards = [];
    this.bjPlayerCards = [];
    this.bjHouseTotal = undefined;
    this.bjPlayerTotal = undefined;
    this.bjStatus = undefined;
    this.bjPurse = undefined;
    this.bjDeck = undefined;
    this.bjBtnWrap = undefined;
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

  private returnLudus = (): void => {
    gameState.paused = false;
    gameState.inMenu = false;
    gameState.inDialogue = false;
    this.hideJudgment();
    this.resultPending = false;
    if (this.scene.isActive("ArenaScene") || this.scene.isSleeping("ArenaScene") || this.scene.isPaused("ArenaScene")) {
      this.scene.stop("ArenaScene");
    }
    this.time.delayedCall(30, () => {
      if (this.scene.isSleeping("LudusScene")) this.scene.wake("LudusScene");
      else if (!this.scene.isActive("LudusScene")) this.scene.launch("LudusScene");
    });
  };

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
    const c = this.box(520, this.pausePage === "settings" || this.pausePage === "controls" || this.pausePage === "stats" ? 680 : 560, "PAUSED");
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
      const animal = palAnimalName();
      const live = playerCombatStats();
      const hurt = s.injured ? "\nInjured — drink unguent or rest in Quarters." : "";
      const palLine = palUnlocked()
        ? `\n\n${animal}  ·  ${palDisplayName()}\n${palBrought() ? "Comes with you into the arena. XP ×0.9" : "Waiting at the roost. XP ×1.15"}\n${palNextHint()}`
        : `\n\n${animal}  ·  locked\nBeat a house champion to earn a pal from your pledged house.`;
      const body = this.add
        .text(
          0,
          -10,
          `${s.playerName}  ·  Lv ${s.level}  ·  ${s.reputation}\nXP ${Math.floor(s.xp)} / ${s.xpToNext}\nSkill points: ${s.statPoints}${hurt}\n\nHealth ${Math.round(live.maxHealth)}\nStamina ${Math.round(live.maxStamina)}\nUnguent vials ${s.unguent ?? 0} / 3\nAttack ${live.attack.toFixed(1)}\nDefense ${live.defense.toFixed(1)}\nAgility ${live.agility.toFixed(1)}${palLine}`,
          { fontFamily: "Georgia", fontSize: "16px", color: "#e8dcc8", align: "center" },
        )
        .setOrigin(0.5);
      c.add(body);
      if (palUnlocked()) {
        this.addBtn(
          c,
          0,
          148,
          palBrought() ? "Leave pal at roost" : "Bring pal to the arena",
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
        .text(0, -40, `Music ${s.musicMuted ? "muted" : `${Math.round(s.musicVolume * 100)}%`}   Sound ${Math.round(s.sfxVolume * 100)}%\nShake ${s.screenShake ? "On" : "Off"}   Fullscreen ${s.fullscreen ? "On" : "Off"}`, {
          fontFamily: "Georgia",
          fontSize: "18px",
          color: "#e8dcc8",
          align: "center",
        })
        .setOrigin(0.5);
      c.add(t);
      this.addBtn(c, -120, 50, "Music -", () => { s.musicVolume = Math.max(0, s.musicVolume - 0.1); gameState.persistSettings(); this.renderPause(); }, 140);
      this.addBtn(c, 120, 50, "Music +", () => { s.musicVolume = Math.min(1, s.musicVolume + 0.1); gameState.persistSettings(); this.renderPause(); }, 140);
      this.addBtn(c, 0, 100, audio.musicMuteLabel(), () => { audio.toggleMusicMute(); this.renderPause(); });
      this.addBtn(c, -120, 150, "Sound -", () => { s.sfxVolume = Math.max(0, s.sfxVolume - 0.1); gameState.persistSettings(); this.renderPause(); }, 140);
      this.addBtn(c, 120, 150, "Sound +", () => { s.sfxVolume = Math.min(1, s.sfxVolume + 0.1); gameState.persistSettings(); this.renderPause(); }, 140);
      this.addBtn(c, 0, 200, "Toggle shake", () => { s.screenShake = !s.screenShake; gameState.persistSettings(); this.renderPause(); });
      this.addBtn(c, 0, 250, "Toggle fullscreen", () => {
        s.fullscreen = !s.fullscreen;
        if (s.fullscreen) void this.scale.startFullscreen();
        else void this.scale.stopFullscreen();
        gameState.persistSettings();
        this.renderPause();
      });
      this.addBtn(c, 0, 300, "Rebind keys", () => ((this.pausePage = "keybinds"), this.renderPause()));
      this.addBtn(c, 0, 350, "Back", () => ((this.pausePage = "root"), this.renderPause()));
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

    const colX = [-350, 0, 350];
    const tierY = [-210, -110, -10, 90, 190];
    const cardH = 52;
    const lines = this.add.graphics();
    c.add(lines);

    SKILL_BRANCHES.forEach((branch, bi) => {
      const x = colX[bi];
      c.add(
        this.add
          .text(x, -252, branch.title, {
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
          lines.lineBetween(x, tierY[ti - 1] + cardH / 2, x, y - cardH / 2);
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
    const fill = owned ? 0x3a281c : available ? 0x241810 : 0x14100e;
    const stroke = owned ? color : available ? COLORS.gold : 0x5a4a3a;
    const cardW = 210;
    const cardH = 52;
    const card = this.add
      .rectangle(x, y, cardW, cardH, fill, 0.96)
      .setStrokeStyle(owned || available ? 2 : 1, stroke)
      .setInteractive({ useHandCursor: available || owned });
    const gem = this.add.circle(x - cardW / 2 + 22, y, 11, owned ? color : available ? 0x5a3828 : 0x2a2018).setStrokeStyle(2, stroke);
    const name = this.add
      .text(x - cardW / 2 + 40, y - 9, skill.name, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "15px",
        color: owned || available ? "#f0e6d2" : "#6a5a4a",
      })
      .setOrigin(0, 0.5);
    const state = owned ? "Learned" : available ? "Click  ·  1 skill point" : skill.requires ? "Locked  ·  skill above" : "Locked  ·  need a point";
    const status = this.add
      .text(x - cardW / 2 + 40, y + 11, state, {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: owned ? "#8ecf6a" : available ? "#d4a84b" : "#6a5a4a",
      })
      .setOrigin(0, 0.5);
    const show = () => {
      detail.setText(`${skill.name}  —  ${state}\n${skill.description}`);
    };
    card.on("pointerover", () => {
      show();
      if (available) card.setFillStyle(0x4a3424);
    });
    card.on("pointerout", () => card.setFillStyle(fill));
    card.on("pointerdown", () => {
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
    c.add([card, gem, name, status]);
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
    if (gameState.save.injured) {
      this.addBtn(
        c,
        -530,
        292,
        "Rest  ·  clear injury",
        () => {
          if (clearInjury()) this.toast("You rest. The ache leaves you.");
          else this.toast("You are not injured.");
          this.openShop();
        },
        220,
      );
    }

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
            ? "Locked — lose an arena fight without being spared"
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

  openRoost = (): void => {
    if (this.resultPending) return;
    const c = this.box(1180, 660, "ROOST");
    c.add(this.add.rectangle(0, -288, 1120, 8, 0x6a2420, 0.9));
    if (!palUnlocked()) {
      c.add(
        this.add
          .text(0, -20, "Beat a house champion first.\nA pledged beast will take this perch.", {
            fontFamily: "Georgia",
            fontSize: "20px",
            color: "#e8dcc8",
            align: "center",
            wordWrap: { width: 520 },
          })
          .setOrigin(0.5),
      );
      this.addBtn(c, 0, 160, "Close", () => this.closeOverlay(), 200);
      return;
    }

    const stats = palCombatStats();
    const animal = palAnimalName();
    this.textures.get(palTexture())?.setFilter(Phaser.Textures.FilterMode.NEAREST);
    const preview = this.add.image(-460, -90, palTexture()).setScale(1.7 * Math.min(1, stats.visScale / 0.7));
    if (stats.tint) preview.setTint(stats.tint);
    c.add(preview);
    c.add(
      this.add
        .text(-460, 28, palDisplayName(), {
          fontFamily: "Cinzel, Georgia",
          fontSize: "18px",
          color: "#e8c96a",
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(-460, 54, `${palTitle(palTier())}  ·  ${animal}`, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#c4b49a",
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(-460, 88, `HP ${stats.maxHp}  Bite ${stats.bite}  Spd ${stats.speed}`, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#e8dcc8",
        })
        .setOrigin(0.5),
    );
    const bond = palBondProgress();
    const barW = 196;
    c.add(this.add.rectangle(-460, 118, barW + 6, 16, 0x000000, 0.7));
    c.add(this.add.rectangle(-460 - barW / 2, 118, Math.max(0, barW * bond.ratio), 10, 0x8ecf6a).setOrigin(0, 0.5));
    c.add(
      this.add
        .text(-460, 136, `Bond  ${bond.xp} / ${bond.toNext}`, {
          fontFamily: "Georgia",
          fontSize: "12px",
          color: "#8ecf6a",
        })
        .setOrigin(0.5),
    );
    c.add(this.add.rectangle(-460, 158, barW + 6, 12, 0x000000, 0.7));
    c.add(this.add.rectangle(-460 - barW / 2, 158, Math.max(0, barW * bond.treeRatio), 8, COLORS.gold).setOrigin(0, 0.5));
    c.add(
      this.add
        .text(-460, 176, `Tree  ${bond.skills} / ${bond.skillMax}  ·  ${bond.points} pal point${bond.points === 1 ? "" : "s"}`, {
          fontFamily: "Georgia",
          fontSize: "12px",
          color: "#e8c96a",
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(-460, 198, bond.hint, {
          fontFamily: "Georgia",
          fontSize: "11px",
          color: "#c4b49a",
          wordWrap: { width: 220 },
          align: "center",
        })
        .setOrigin(0.5),
    );

    this.addShopTab(c, 20, -248, "Care", this.roostTab === "care", () => {
      this.roostTab = "care";
      this.openRoost();
    });
    this.addShopTab(c, 140, -248, "Looks", this.roostTab === "looks", () => {
      this.roostTab = "looks";
      this.openRoost();
    });

    if (this.roostTab === "care") {
      const detail = this.add
        .text(90, 168, palBondHint(), {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#d4a84b",
          wordWrap: { width: 680 },
          align: "center",
        })
        .setOrigin(0.5);
      c.add(detail);
      c.add(
        this.add
          .text(90, -208, `${gameState.save.palPoints ?? 0} pal points  ·  ${gameState.save.denarii} denarii  ·  ${palNextHint()}`, {
            fontFamily: "Georgia",
            fontSize: "14px",
            color: "#e8c96a",
          })
          .setOrigin(0.5),
      );
      const colX = [0, 220, 440];
      const tierY = [-138, -36, 66];
      const cardH = 56;
      const lines = this.add.graphics();
      c.add(lines);
      PAL_SKILL_BRANCHES.forEach((branch, bi) => {
        const x = colX[bi];
        c.add(
          this.add
            .text(x, -176, branch.title, {
              fontFamily: "Cinzel, Georgia",
              fontSize: "15px",
              color: "#e8dcc8",
            })
            .setOrigin(0.5),
        );
        palSkillsInBranch(branch.id).forEach((skill, ti) => {
          const y = tierY[ti];
          if (ti > 0) {
            const owned = hasPalSkill(skill.id);
            const prev = palSkillsInBranch(branch.id)[ti - 1];
            const prevOwned = hasPalSkill(prev.id);
            lines.lineStyle(3, owned ? branch.color : prevOwned ? 0x8a6a3a : 0x3a3028, owned ? 0.95 : 0.45);
            lines.lineBetween(x, tierY[ti - 1] + cardH / 2, x, y - cardH / 2);
          }
          this.addPalNode(c, x, y, skill, branch.color, detail);
        });
      });
      this.addBtn(
        c,
        90,
        214,
        palBrought() ? "Leave pal at roost" : "Bring pal to the arena",
        () => {
          togglePalBrought();
          this.openRoost();
        },
        280,
      );
    } else {
      c.add(
        this.add
          .text(140, -150, "A name the yard can shout, and a wash of dye.", {
            fontFamily: "Georgia",
            fontSize: "15px",
            color: "#d4a84b",
          })
          .setOrigin(0.5),
      );
      c.add(
        this.add
          .text(140, -110, palDisplayName(), {
            fontFamily: "Cinzel, Georgia",
            fontSize: "22px",
            color: "#e8dcc8",
          })
          .setOrigin(0.5),
      );
      this.addBtn(
        c,
        140,
        -60,
        "Roll a name",
        () => {
          rollPalName();
          this.openRoost();
        },
        220,
      );
      PAL_TINTS.forEach((tint, i) => {
        const x = -20 + i * 160;
        const y = 70;
        const active = palTintId() === tint.id;
        const swatch = tint.id === "ivory" ? 0xf4ead8 : tint.id === "night" ? 0x5a5478 : palTintColor() ?? COLORS.gold;
        const card = this.add
          .rectangle(x, y, 140, 88, active ? 0x3a281c : 0x1a1210, 0.96)
          .setStrokeStyle(active ? 2 : 1, active ? COLORS.gold : 0x6a5a3a)
          .setInteractive({ useHandCursor: true });
        const chip = this.add.rectangle(x, y - 18, 28, 28, swatch).setStrokeStyle(1, 0x1a1210);
        const name = this.add
          .text(x, y + 18, tint.name, {
            fontFamily: "Georgia",
            fontSize: "14px",
            color: "#e8dcc8",
          })
          .setOrigin(0.5);
        card.on("pointerdown", () => {
          audio.sfx("ui");
          setPalTint(tint.id);
          this.openRoost();
        });
        c.add([card, chip, name]);
      });
    }

    if (this.roostTab !== "care") {
      c.add(
        this.add
          .text(0, 230, `${gameState.save.denarii} denarii`, {
            fontFamily: "Georgia",
            fontSize: "14px",
            color: "#d4a84b",
          })
          .setOrigin(0.5),
      );
    }
    this.addBtn(c, 0, 292, "Close", () => this.closeOverlay(), 180);
  };

  openTable = (): void => {
    if (this.resultPending) return;
    if (!gameState.save.freedomWon) return;
    this.bj = null;
    const c = this.box(520, 420, "TABLE");
    c.add(this.add.rectangle(0, -178, 460, 8, 0x6a2420, 0.9));
    c.add(
      this.add
        .text(0, -140, "Free men play. Pick a game.", {
          fontFamily: "Georgia",
          fontSize: "16px",
          color: "#e8dcc8",
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(0, -108, `${gameState.save.denarii} denarii`, {
          fontFamily: "Georgia",
          fontSize: "18px",
          color: "#d4a84b",
        })
        .setOrigin(0.5),
    );
    TABLE_GAMES.forEach((game, i) => {
      const y = -40 + i * 56;
      if (!game.available) {
        const bg = this.add.rectangle(0, y, 240, 40, 0x14100e).setStrokeStyle(1, 0x6a5a3a);
        const t = this.add.text(0, y, "Soon", { fontFamily: "Georgia", fontSize: "16px", color: "#6a5a4a" }).setOrigin(0.5);
        c.add([bg, t]);
        return;
      }
      this.addBtn(c, 0, y, game.name, () => {
        if (game.id === "alea") this.openAlea();
        else if (game.id === "blackjack") this.openBlackjack();
      }, 240);
    });
    this.addBtn(c, 0, 178, "Leave", () => this.closeOverlay(), 180);
  };

  private tableAlive(): boolean {
    return Boolean(this.overlay?.active);
  }

  openAlea = (): void => {
    if (this.resultPending) return;
    if (!gameState.save.freedomWon) return;
    const c = this.box(640, 560, "ALEA");
    c.add(this.add.rectangle(0, -248, 580, 8, 0x6a2420, 0.9));
    this.aleaPurse = this.add
      .text(0, -214, `${gameState.save.denarii} denarii`, {
        fontFamily: "Georgia",
        fontSize: "18px",
        color: "#d4a84b",
      })
      .setOrigin(0.5);
    c.add(this.aleaPurse);
    c.add(
      this.add
        .text(0, -186, "Even money. Dump the dice into the dish.", {
          fontFamily: "Georgia",
          fontSize: "15px",
          color: "#e8dcc8",
        })
        .setOrigin(0.5),
    );
    this.aleaYou = this.add
      .text(-200, -148, this.aleaLast ? `YOU  ${this.aleaLast.player}` : "YOU  —", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "18px",
        color: "#e8c96a",
      })
      .setOrigin(0.5);
    this.aleaHouse = this.add
      .text(200, -148, this.aleaLast ? `HOUSE  ${this.aleaLast.house}` : "HOUSE  —", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "18px",
        color: "#e8c96a",
      })
      .setOrigin(0.5);
    c.add([this.aleaYou, this.aleaHouse]);
    c.add(this.add.image(0, -40, "prop-dice-bowl").setScale(2.1));

    const last = this.aleaLast;
    const resultText = last
      ? last.outcome === "win"
        ? `You ${last.player}. House ${last.house}. You take ${last.bet} denarii.`
        : last.outcome === "lose"
          ? `You ${last.player}. House ${last.house}. The house takes ${last.bet} denarii.`
          : `You ${last.player}. House ${last.house}. The stakes stand.`
      : "Stake denarii. Watch the dish.";
    this.aleaStatus = this.add
      .text(0, 50, resultText, {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: last?.outcome === "win" ? "#8ecf6a" : last?.outcome === "lose" ? "#e07060" : "#c4b49a",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5);
    c.add(this.aleaStatus);

    TABLE_BETS.forEach((bet, i) => {
      const x = -180 + i * 180;
      const poor = gameState.save.denarii < bet;
      this.addBtn(c, x, 110, poor ? `${bet}  —  short` : `Bet ${bet}`, () => this.startAleaRoll(bet), 160);
    });
    this.addBtn(c, -110, 220, "Back", () => {
      if (this.aleaBusy) return;
      this.openTable();
    }, 180);
    this.addBtn(c, 110, 220, "Leave", () => this.closeOverlay(), 180);
  };

  private startAleaRoll(bet: number): void {
    if (this.aleaBusy) return;
    const taken = takeTableBet(bet);
    if (taken === "locked") {
      this.toast("Free men gamble. You are not free.");
      return;
    }
    if (taken === "poor") {
      this.toast("Not enough denarii.");
      return;
    }
    const roll = rollAleaDice();
    this.aleaBusy = true;
    this.aleaPending = { bet, player: roll.player, house: roll.house };
    this.aleaYou?.setText("YOU  —");
    this.aleaHouse?.setText("HOUSE  —");
    this.aleaPurse?.setText(`${gameState.save.denarii} denarii`);
    this.aleaStatus?.setColor("#c4b49a").setText("You throw...");
    this.dumpBowl(roll.player, () => {
      if (!this.aleaPending || !this.tableAlive()) return;
      this.aleaYou?.setText(`YOU  ${roll.player[0] + roll.player[1]}`);
      this.time.delayedCall(450, () => {
        if (!this.aleaPending || !this.tableAlive()) return;
        this.fadeBowlDice(() => {
          if (!this.aleaPending || !this.tableAlive()) return;
          this.aleaStatus?.setText("The house throws...");
          this.dumpBowl(roll.house, () => {
            if (!this.aleaPending || !this.tableAlive()) return;
            const player = roll.player[0] + roll.player[1];
            const houseSum = roll.house[0] + roll.house[1];
            const outcome = aleaOutcome(player, houseSum);
            settleTakenBet(bet, outcome);
            this.aleaPending = null;
            this.aleaBusy = false;
            this.aleaLast = { bet, player, house: houseSum, playerDice: roll.player, houseDice: roll.house, outcome };
            this.aleaHouse?.setText(`HOUSE  ${houseSum}`);
            this.aleaPurse?.setText(`${gameState.save.denarii} denarii`);
            const msg =
              outcome === "win"
                ? `You ${player}. House ${houseSum}. You take ${bet} denarii.`
                : outcome === "lose"
                  ? `You ${player}. House ${houseSum}. The house takes ${bet} denarii.`
                  : `You ${player}. House ${houseSum}. The stakes stand.`;
            this.aleaStatus
              ?.setColor(outcome === "win" ? "#8ecf6a" : outcome === "lose" ? "#e07060" : "#c4b49a")
              .setText(msg);
            if (outcome === "win") this.toast(`You take ${bet} denarii.`);
            else if (outcome === "lose") this.toast(`The house takes ${bet} denarii.`);
            else this.toast("The stakes stand.");
            this.time.delayedCall(700, () => {
              if (!this.tableAlive()) return;
              this.fadeBowlDice(() => undefined);
            });
          });
        });
      });
    });
  }

  private dumpBowl(faces: [number, number], onLanded: () => void): void {
    const c = this.overlay;
    if (!c) return;
    audio.sfx("ui");
    this.aleaDice.forEach((d) => d.destroy());
    const rest = [
      { x: -16, y: -36 },
      { x: 18, y: -32 },
    ];
    const dice = [
      this.add.image(-36, -200, "dice-face-1").setScale(1.7),
      this.add.image(36, -210, "dice-face-2").setScale(1.7),
    ];
    c.add(dice);
    this.aleaDice = dice;
    dice.forEach((die, i) => {
      this.tweens.add({
        targets: die,
        x: rest[i]!.x,
        y: rest[i]!.y,
        angle: 280 + Math.random() * 80,
        duration: 420,
        ease: "Cubic.easeIn",
      });
    });
    const flicker = this.time.addEvent({
      delay: 45,
      loop: true,
      callback: () => {
        dice.forEach((die, i) => {
          if (!die.active) return;
          die.setTexture(`dice-face-${1 + Math.floor(Math.random() * 6)}`);
          const r = rest[i]!;
          if (this.tweens.isTweening(die)) return;
          die.x = r.x + Phaser.Math.Between(-5, 5);
          die.y = r.y + Phaser.Math.Between(-4, 4);
          die.angle += Phaser.Math.Between(-24, 24);
        });
      },
    });
    this.time.delayedCall(1220, () => {
      flicker.remove(false);
      if (!this.tableAlive()) return;
      dice.forEach((die, i) => {
        if (!die.active) return;
        die.setTexture(`dice-face-${faces[i] ?? 1}`);
        die.setAngle(i === 0 ? -10 : 14);
        die.setPosition(rest[i]!.x, rest[i]!.y);
        die.setScale(1.7);
      });
      onLanded();
    });
  }

  private fadeBowlDice(onDone: () => void): void {
    const dice = this.aleaDice.filter((d) => d.active);
    if (!dice.length) {
      onDone();
      return;
    }
    this.tweens.add({
      targets: dice,
      alpha: 0,
      duration: 260,
      onComplete: () => {
        dice.forEach((d) => d.destroy());
        this.aleaDice = [];
        onDone();
      },
    });
  }

  openBlackjack = (): void => {
    if (this.resultPending) return;
    if (!gameState.save.freedomWon) return;
    if (this.bj && (this.bj.phase === "dealing" || this.bj.phase === "play") && this.tableAlive()) return;
    const c = this.box(720, 580, "BLACKJACK");
    c.add(this.add.rectangle(0, -258, 660, 8, 0x6a2420, 0.9));
    if (!this.bj || this.bj.phase === "bet") {
      c.add(
        this.add
          .text(0, -216, `${gameState.save.denarii} denarii`, {
            fontFamily: "Georgia",
            fontSize: "16px",
            color: "#d4a84b",
          })
          .setOrigin(0.5),
      );
      c.add(
        this.add
          .text(0, -80, "Hit 21. House stands on 17. Naturals pay 3:2.", {
            fontFamily: "Georgia",
            fontSize: "16px",
            color: "#e8dcc8",
            align: "center",
            wordWrap: { width: 560 },
          })
          .setOrigin(0.5),
      );
      TABLE_BETS.forEach((bet, i) => {
        const x = -180 + i * 180;
        const poor = gameState.save.denarii < bet;
        this.addBtn(c, x, 40, poor ? `${bet}  —  short` : `Deal ${bet}`, () => this.dealBlackjack(bet), 160);
      });
      this.addBtn(c, 0, 220, "Back", () => this.openTable(), 180);
      return;
    }
    this.mountBlackjackTable(c);
  };

  private mountBlackjackTable(c: Phaser.GameObjects.Container): void {
    this.bjHouseCards = [];
    this.bjPlayerCards = [];
    this.bjPurse = this.add
      .text(0, -226, `${gameState.save.denarii} denarii`, {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#d4a84b",
      })
      .setOrigin(0.5);
    c.add(this.bjPurse);
    c.add(this.add.text(0, -188, "HOUSE", { fontFamily: "Cinzel, Georgia", fontSize: "14px", color: "#e8c96a" }).setOrigin(0.5));
    this.bjHouseTotal = this.add
      .text(0, -78, "—", { fontFamily: "Georgia", fontSize: "14px", color: "#c4b49a" })
      .setOrigin(0.5);
    c.add(this.bjHouseTotal);
    c.add(this.add.text(0, -42, "YOU", { fontFamily: "Cinzel, Georgia", fontSize: "14px", color: "#e8c96a" }).setOrigin(0.5));
    this.bjPlayerTotal = this.add
      .text(0, 78, "—", { fontFamily: "Georgia", fontSize: "14px", color: "#e8dcc8" })
      .setOrigin(0.5);
    c.add(this.bjPlayerTotal);
    this.bjStatus = this.add
      .text(0, 112, this.bj?.message ?? "Dealing...", {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#c4b49a",
        align: "center",
        wordWrap: { width: 640 },
      })
      .setOrigin(0.5);
    c.add(this.bjStatus);
    this.bjDeck = this.add.image(268, -20, "card-back").setScale(1.35);
    c.add(this.bjDeck);
    c.add(
      this.add
        .text(268, 28, "DECK", { fontFamily: "Cinzel, Georgia", fontSize: "11px", color: "#8a7a68" })
        .setOrigin(0.5),
    );
    this.refreshBjButtons();
  }

  private refreshBjButtons(): void {
    this.bjBtnWrap?.destroy();
    const c = this.overlay;
    if (!c || !this.bj) return;
    const wrap = this.add.container(0, 168);
    c.add(wrap);
    this.bjBtnWrap = wrap;
    if (this.bjBusy || this.bj.phase === "dealing") {
      this.addBtn(wrap, 0, 70, "Leave", () => this.closeOverlay(), 180);
      return;
    }
    if (this.bj.phase === "play") {
      this.addBtn(wrap, -110, 0, "Hit", () => this.hitBlackjack(), 180);
      this.addBtn(wrap, 110, 0, "Stand", () => this.standBlackjack(), 180);
    } else if (this.bj.phase === "done") {
      this.addBtn(wrap, -110, 0, "Deal again", () => {
        this.bj = null;
        this.openBlackjack();
      }, 180);
      this.addBtn(wrap, 110, 0, "Back", () => this.openTable(), 180);
    }
    this.addBtn(wrap, 0, 70, "Leave", () => this.closeOverlay(), 180);
  }

  private bjCardSlot(count: number, index: number): number {
    const gap = 40;
    return -((count - 1) * gap) / 2 + index * gap;
  }

  private layoutBjHand(imgs: Phaser.GameObjects.Image[], y: number): void {
    imgs.forEach((img, i) => {
      this.tweens.add({
        targets: img,
        x: this.bjCardSlot(imgs.length, i),
        y,
        duration: 220,
        ease: "Cubic.easeOut",
      });
    });
  }

  private slideBjCard(
    card: Card,
    row: "player" | "house",
    faceDown: boolean,
    onDone: () => void,
  ): void {
    const c = this.overlay;
    if (!c || !this.bjDeck) {
      onDone();
      return;
    }
    audio.sfx("ui");
    const img = this.add.image(this.bjDeck.x, this.bjDeck.y, faceDown ? "card-back" : cardTex(card)).setScale(1.35);
    c.add(img);
    const list = row === "player" ? this.bjPlayerCards : this.bjHouseCards;
    list.push(img);
    const y = row === "player" ? 16 : -130;
    this.layoutBjHand(list, y);
    this.time.delayedCall(240, () => {
      if (!this.tableAlive()) return;
      this.updateBjTotals();
      onDone();
    });
  }

  private updateBjTotals(): void {
    const s = this.bj;
    if (!s) return;
    if (s.player.length) this.bjPlayerTotal?.setText(`${handTotal(s.player)}`);
    else this.bjPlayerTotal?.setText("—");
    if (!s.house.length) this.bjHouseTotal?.setText("—");
    else if (s.holeHidden && s.house.length >= 1) {
      this.bjHouseTotal?.setText(`${handTotal(s.house.slice(0, 1))} + ?`);
    } else this.bjHouseTotal?.setText(`${handTotal(s.house)}`);
  }

  private flipBjHole(onDone: () => void): void {
    const s = this.bj;
    const hole = this.bjHouseCards[1];
    if (!s || !hole || !s.house[1]) {
      onDone();
      return;
    }
    s.holeHidden = false;
    this.tweens.add({
      targets: hole,
      scaleX: 0,
      duration: 110,
      onComplete: () => {
        if (!hole.active) {
          onDone();
          return;
        }
        hole.setTexture(cardTex(s.house[1]!));
        this.tweens.add({
          targets: hole,
          scaleX: 1.35,
          duration: 110,
          onComplete: () => {
            this.updateBjTotals();
            onDone();
          },
        });
      },
    });
  }

  private finishBj(outcome: BlackjackOutcome): void {
    const s = this.bj;
    if (!s) return;
    if (s.phase !== "done") settleTakenBet(s.bet, outcome);
    s.phase = "done";
    s.message = this.blackjackMessage(outcome, s.bet);
    this.bjBusy = false;
    this.bjStatus
      ?.setColor(outcome === "win" || outcome === "blackjack" ? "#8ecf6a" : outcome === "lose" ? "#e07060" : "#c4b49a")
      .setText(s.message);
    this.bjPurse?.setText(`${gameState.save.denarii} denarii`);
    this.toastBlackjack(outcome, s.bet);
    this.refreshBjButtons();
  }

  private dealBlackjack(bet: number): void {
    if (this.bjBusy) return;
    const taken = takeTableBet(bet);
    if (taken === "locked") {
      this.toast("Free men gamble. You are not free.");
      return;
    }
    if (taken === "poor") {
      this.toast("Not enough denarii.");
      return;
    }
    this.bj = {
      bet,
      deck: freshDeck(),
      player: [],
      house: [],
      holeHidden: true,
      phase: "dealing",
      message: "Dealing...",
    };
    const c = this.box(720, 580, "BLACKJACK");
    c.add(this.add.rectangle(0, -258, 660, 8, 0x6a2420, 0.9));
    this.mountBlackjackTable(c);
    this.bjBusy = true;
    this.refreshBjButtons();
    const order: Array<{ row: "player" | "house"; down: boolean }> = [
      { row: "player", down: false },
      { row: "house", down: false },
      { row: "player", down: false },
      { row: "house", down: true },
    ];
    const step = (i: number): void => {
      const s = this.bj;
      if (!s || !this.tableAlive()) return;
      if (i >= order.length) {
        this.afterBjDeal();
        return;
      }
      const next = order[i]!;
      const card = drawCard(s.deck);
      if (next.row === "player") s.player.push(card);
      else s.house.push(card);
      this.slideBjCard(card, next.row, next.down, () => this.time.delayedCall(140, () => step(i + 1)));
    };
    step(0);
  }

  private afterBjDeal(): void {
    const s = this.bj;
    if (!s || !this.tableAlive()) return;
    if (isNatural(s.player) || isNatural(s.house)) {
      this.flipBjHole(() => {
        if (!this.bj) return;
        this.finishBj(blackjackCompare(this.bj.player, this.bj.house));
      });
      return;
    }
    s.phase = "play";
    s.message = "Hit or stand.";
    this.bjBusy = false;
    this.bjStatus?.setText(s.message);
    this.refreshBjButtons();
  }

  private hitBlackjack(): void {
    const s = this.bj;
    if (!s || s.phase !== "play" || this.bjBusy) return;
    this.bjBusy = true;
    this.refreshBjButtons();
    const card = drawCard(s.deck);
    s.player.push(card);
    this.slideBjCard(card, "player", false, () => {
      if (!this.bj || !this.tableAlive()) return;
      if (handTotal(this.bj.player) > 21) {
        this.flipBjHole(() => this.finishBj("lose"));
        return;
      }
      this.bjBusy = false;
      this.refreshBjButtons();
    });
  }

  private standBlackjack(): void {
    const s = this.bj;
    if (!s || s.phase !== "play" || this.bjBusy) return;
    this.bjBusy = true;
    this.refreshBjButtons();
    this.flipBjHole(() => this.drawHouseToSeventeen());
  }

  private drawHouseToSeventeen(): void {
    const s = this.bj;
    if (!s || !this.tableAlive()) return;
    if (!dealerShouldHit(s.house)) {
      this.finishBj(blackjackCompare(s.player, s.house));
      return;
    }
    const card = drawCard(s.deck);
    s.house.push(card);
    this.slideBjCard(card, "house", false, () => {
      this.time.delayedCall(180, () => this.drawHouseToSeventeen());
    });
  }

  private blackjackMessage(outcome: BlackjackOutcome, bet: number): string {
    if (outcome === "blackjack") return `Blackjack. You take ${Math.floor(bet * 1.5)} denarii.`;
    if (outcome === "win") return `You win ${bet} denarii.`;
    if (outcome === "lose") return `You lose ${bet} denarii.`;
    return "Push. The stakes stand.";
  }

  private toastBlackjack(outcome: BlackjackOutcome, bet: number): void {
    this.toast(this.blackjackMessage(outcome, bet));
  }

  private addPalNode(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    skill: PalSkillDef,
    color: number,
    detail: Phaser.GameObjects.Text,
  ): void {
    const owned = hasPalSkill(skill.id);
    const available = canUnlockPalSkill(skill.id);
    const fill = owned ? 0x3a281c : available ? 0x241810 : 0x14100e;
    const stroke = owned ? color : available ? COLORS.gold : 0x5a4a3a;
    const cardW = 204;
    const cardH = 56;
    const card = this.add
      .rectangle(x, y, cardW, cardH, fill, 0.96)
      .setStrokeStyle(owned || available ? 2 : 1, stroke)
      .setInteractive({ useHandCursor: available || owned });
    const gem = this.add.circle(x - cardW / 2 + 20, y, 10, owned ? color : available ? 0x5a3828 : 0x2a2018).setStrokeStyle(2, stroke);
    const name = this.add
      .text(x - cardW / 2 + 38, y - 10, skill.name, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "15px",
        color: owned || available ? "#f0e6d2" : "#6a5a4a",
      })
      .setOrigin(0, 0.5);
    const state = owned
      ? "Learned"
      : available
        ? `Click  ·  1 pt + ${skill.cost}`
        : skill.requires
          ? "Locked  ·  skill above"
          : "Locked";
    const status = this.add
      .text(x - cardW / 2 + 38, y + 12, state, {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: owned ? "#8ecf6a" : available ? "#d4a84b" : "#6a5a4a",
      })
      .setOrigin(0, 0.5);
    const show = () => {
      const line = owned
        ? "Learned"
        : available
          ? `Click — 1 pal point + ${skill.cost} denarii`
          : skill.requires
            ? "Requires the skill above"
            : "Need a pal point and denarii";
      detail.setText(`${skill.name}  —  ${line}\n${skill.description}`);
    };
    card.on("pointerover", () => {
      show();
      if (available) card.setFillStyle(0x4a3424);
    });
    card.on("pointerout", () => card.setFillStyle(fill));
    card.on("pointerdown", () => {
      if (owned) {
        show();
        return;
      }
      const result = unlockPalSkill(skill.id);
      if (result === "poor") this.toast("Not enough denarii.");
      else if (result === "points") this.toast("Need a pal point. Beat a house champion with the pal.");
      else if (result === "locked") this.toast("That branch is still closed.");
      else if (result === "ok") {
        audio.sfx("ui");
        this.toast(`${skill.name} is learned.`);
        this.openRoost();
      }
    });
    c.add([card, gem, name, status]);
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
    const lv = masteryLevel(cur.id);
    c.add(
      this.add
        .text(-310, 210, `Mastery  ${lv === 2 ? "II" : lv === 1 ? "I" : "—"}\n${masteryHint(cur.id)}`, {
          fontFamily: "Georgia",
          fontSize: "12px",
          color: "#8ecf6a",
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
        .text(x + 18, y + 10, equipped ? `Equipped  ·  ${masteryLevel(id) ? `M${masteryLevel(id)}` : "form"}` : unlocked ? masteryHint(id).split("—")[0].trim() : "Locked", {
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
    this.hideJudgment();
    this.perfectFlash?.destroy();
    this.perfectText?.destroy();
    this.perfectFlash = undefined;
    this.perfectText = undefined;
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

  showFavor = (payload?: { them?: number }): void => {
    this.hideFavor();
    const y = 52;
    const w = 360;
    const them = payload?.them ?? COLORS.crimson;
    const bg = this.add.rectangle(GAME_WIDTH / 2, y, w + 8, 16, 0x1a1210).setScrollFactor(0).setDepth(120);
    const youFill = this.add.rectangle(GAME_WIDTH / 2 - w / 2, y, w * 0.5, 10, COLORS.gold).setOrigin(0, 0.5).setScrollFactor(0).setDepth(121);
    const themFill = this.add.rectangle(GAME_WIDTH / 2 + w / 2, y, w * 0.5, 10, them).setOrigin(1, 0.5).setScrollFactor(0).setDepth(121);
    const tick = this.add.rectangle(GAME_WIDTH / 2 - w / 2 + w * 0.7, y, 3, 18, 0xf0e6d2).setScrollFactor(0).setDepth(122);
    const marker = this.add.rectangle(GAME_WIDTH / 2, y, 6, 20, 0xfff4d0).setStrokeStyle(1, 0x1a1210).setScrollFactor(0).setDepth(123);
    const you = this.add.text(GAME_WIDTH / 2 - w / 2 - 8, y, "YOU", { fontFamily: "Cinzel, Georgia", fontSize: "11px", color: "#e8c96a", stroke: "#1a1210", strokeThickness: 3 }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(122);
    const themLbl = this.add.text(GAME_WIDTH / 2 + w / 2 + 8, y, "THEM", { fontFamily: "Cinzel, Georgia", fontSize: "11px", color: "#e07060", stroke: "#1a1210", strokeThickness: 3 }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(122);
    const missio = this.add.text(GAME_WIDTH / 2 - w / 2 + w * 0.7, y - 16, "missio", { fontFamily: "Georgia", fontSize: "10px", color: "#d4a84b", stroke: "#1a1210", strokeThickness: 3 }).setOrigin(0.5).setScrollFactor(0).setDepth(122);
    this.favorYouFill = youFill;
    this.favorMarker = marker;
    this.favorWrap = [bg, youFill, themFill, tick, marker, you, themLbl, missio];
    bus.on("favor", this.onFavor);
    this.onFavor(50);
  };

  hideFavor = (): void => {
    bus.off("favor", this.onFavor);
    this.favorWrap.forEach((o) => o.destroy());
    this.favorWrap = [];
    this.favorYouFill = undefined;
    this.favorMarker = undefined;
  };

  private onFavor = (value: number): void => {
    const w = 360;
    const t = Phaser.Math.Clamp(value / 100, 0, 1);
    if (this.favorYouFill) this.favorYouFill.width = Math.max(4, w * t);
    const themFill = this.favorWrap[2] as Phaser.GameObjects.Rectangle | undefined;
    if (themFill) themFill.width = Math.max(4, w * (1 - t));
    if (this.favorMarker) this.favorMarker.x = GAME_WIDTH / 2 - w / 2 + w * t;
    this.tweens.add({ targets: this.favorMarker, scaleY: 1.35, yoyo: true, duration: 90 });
  };

  showPalHp = (): void => {
    this.palHpBg?.setVisible(true);
    this.palHpFill?.setVisible(true);
    this.palHpLabel?.setVisible(true);
  };

  hidePalHp = (): void => {
    this.palHpBg?.setVisible(false);
    this.palHpFill?.setVisible(false);
    this.palHpLabel?.setVisible(false);
  };

  private onPalHp = (ratio: number): void => {
    if (!this.palHpFill) return;
    this.palHpFill.width = 180 * Phaser.Math.Clamp(ratio, 0, 1);
  };

  private onCrowdCall = (kind: "missio" | "iugula"): void => {
    this.perfectFlash?.destroy();
    this.perfectText?.destroy();
    const missio = kind === "missio";
    this.perfectFlash = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, missio ? 0xffe08a : 0xb33a2b, missio ? 0.2 : 0.18)
      .setScrollFactor(0)
      .setDepth(3500);
    this.perfectText = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 110, missio ? "MISSIO" : "IUGULA", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "44px",
        color: missio ? "#ffe08a" : "#e07060",
        stroke: "#1a1210",
        strokeThickness: 7,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3501);
    audio.sfx(missio ? "missio" : "crowd");
    this.tweens.add({
      targets: [this.perfectFlash, this.perfectText],
      alpha: 0,
      delay: 280,
      duration: 900,
      onComplete: () => {
        this.perfectFlash?.destroy();
        this.perfectText?.destroy();
        this.perfectFlash = undefined;
        this.perfectText = undefined;
      },
    });
  };

  private showJudgment = (payload: { crowd: "missio" | "iugula" }): void => {
    this.hideJudgment();
    this.judgmentOpen = true;
    const crowdMissio = payload.crowd === "missio";
    const followAct = crowdMissio ? "Mercy" : "Steel";
    const defyAct = crowdMissio ? "Steel" : "Mercy";
    const y = GAME_HEIGHT / 2 + 92;
    const header = this.add
      .text(GAME_WIDTH / 2, y - 58, crowdMissio ? "THE CROWD CALLS MISSIO" : "THE CROWD CALLS IUGULA", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "22px",
        color: crowdMissio ? "#ffe08a" : "#e07060",
        stroke: "#1a1210",
        strokeThickness: 6,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3600);
    const sub = this.add
      .text(GAME_WIDTH / 2, y - 28, "Follow the stands, or go against them.", {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#e8dcc8",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3600);
    const followBg = this.add
      .rectangle(GAME_WIDTH / 2 - 150, y + 28, 220, 72, 0x3a281c, 0.96)
      .setStrokeStyle(3, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(3600)
      .setInteractive({ useHandCursor: true });
    const followLabel = this.add
      .text(GAME_WIDTH / 2 - 150, y + 16, "FOLLOW", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "20px",
        color: "#e8c96a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    const followHint = this.add
      .text(GAME_WIDTH / 2 - 150, y + 40, `${followAct}  ·  E`, {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    const defyBg = this.add
      .rectangle(GAME_WIDTH / 2 + 150, y + 28, 220, 72, 0x3a1814, 0.96)
      .setStrokeStyle(3, 0xe07060)
      .setScrollFactor(0)
      .setDepth(3600)
      .setInteractive({ useHandCursor: true });
    const defyLabel = this.add
      .text(GAME_WIDTH / 2 + 150, y + 16, "DEFY", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "20px",
        color: "#e07060",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    const defyHint = this.add
      .text(GAME_WIDTH / 2 + 150, y + 40, `${defyAct}  ·  Q`, {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    followBg.on("pointerover", () => followBg.setFillStyle(0x4a3424));
    followBg.on("pointerout", () => followBg.setFillStyle(0x3a281c));
    followBg.on("pointerdown", () => this.pickJudgment(true));
    defyBg.on("pointerover", () => defyBg.setFillStyle(0x5a2420));
    defyBg.on("pointerout", () => defyBg.setFillStyle(0x3a1814));
    defyBg.on("pointerdown", () => this.pickJudgment(false));
    this.judgmentWrap = [header, sub, followBg, followLabel, followHint, defyBg, defyLabel, defyHint];
  };

  private hideJudgment = (): void => {
    this.judgmentOpen = false;
    this.judgmentWrap.forEach((o) => o.destroy());
    this.judgmentWrap = [];
  };

  private pickJudgment(follow: boolean): void {
    if (!this.judgmentOpen) return;
    this.hideJudgment();
    this.perfectFlash?.destroy();
    this.perfectText?.destroy();
    this.perfectFlash = undefined;
    this.perfectText = undefined;
    audio.sfx("ui");
    bus.emit("judgment-pick", { follow });
  }

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
      if (this.overlay || this.resultPending || this.judgmentOpen) return;
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
      if (this.overlay || this.resultPending || this.judgmentOpen) return;
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
      if (this.overlay || this.resultPending || this.judgmentOpen) return;
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
      if (this.overlay || this.resultPending || this.judgmentOpen || gameState.inDialogue || gameState.inMenu) return;
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
      if (this.overlay || this.resultPending || this.judgmentOpen || gameState.inDialogue || gameState.inMenu || gameState.paused) return;
      bus.emit("player-interact");
    });
  }

  private addMusicMuteButton(): void {
    const x = GAME_WIDTH - 132;
    const y = 92;
    const bg = this.add
      .rectangle(x, y, 236, 32, 0x2a1c16, 0.92)
      .setStrokeStyle(2, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(99)
      .setInteractive({ useHandCursor: true });
    this.musicMuteText = this.add
      .text(x, y, audio.musicMuteLabel(), {
        fontFamily: "Cinzel, Georgia",
        fontSize: "15px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100);
    bg.on("pointerover", () => bg.setFillStyle(0x3a281c));
    bg.on("pointerout", () => bg.setFillStyle(0x2a1c16));
    bg.on("pointerdown", () => {
      audio.toggleMusicMute();
      this.musicMuteText?.setText(audio.musicMuteLabel());
      audio.sfx("ui");
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
    this.hideJudgment();
    this.closeOverlay();
    this.scene.stop("LudusScene");
    this.scene.stop("ArenaScene");
    this.scene.start("MenuScene");
    this.scene.stop();
  }
}
