import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, REST_COST, UNGUENT_COST, UNGUENT_MAX } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { currentObjectiveText, actHudPrefix, currentAct, ACT_META, type ActId } from "../systems/objectives";
import { WEAPON_ORDER, getWeapon, masteryHint, masteryLevel, weaponIconKey } from "../data/weapons";
import { getHouse, houseTitleColor, isTournamentId, getRival } from "../data/houses";
import { TOURNAMENT_HOUSE } from "../data/tournament";
import { isOpponentUnlocked, canUnlockSkill, unlockSkill, hasSkill, buyCosmetic, buyUnguent, isHouseUnlocked, houseLockHint, rivalHouses, tournamentUnlocked, restInjury, restSchoolInjury, playerCombatStats } from "../systems/progression";
import { currentNight, enterNight, ensureNight, arenaWeapon, nightEditorLine } from "../systems/nights";
import { TABLE_BETS, TABLE_GAMES, takeTableBet, settleTakenBet, rollAleaDice, aleaOutcome, freshDeck, drawCard, handTotal, isNatural, dealerShouldHit, blackjackCompare, cardTex, type AleaResult, type Card, type BlackjackOutcome } from "../systems/gambling";
import { audio } from "../systems/audio";
import { makeBodyTexture } from "../systems/assets";
import { SKILL_BRANCHES, skillsInBranch, type SkillDef } from "../data/skills";
import { SHOP_ITEMS, SHOP_TABS, TUNIC_HEX, PLUME_HEX, CAPE_HEX, ownsCosmetic, shopUnlocked, shopLockHint, equippedId, displayTitle, lookWithItem, previewTitle, shopItemLabel, type ShopKind } from "../data/shop";
import { palAnimalName, palBondHint, palBondProgress, palBrought, palCombatStats, palDisplayName, palNextHint, palSkillsInBranch, palTexture, palTier, palTintColor, palTintId, palTitle, palUnlocked, canUnlockPalSkill, hasPalSkill, unlockPalSkill, PAL_SKILL_BRANCHES, PAL_TINTS, rollPalName, setPalTint, togglePalBrought, type PalSkillDef } from "../data/pal";
import { PATRONS, getPatron, patronUnlocked, patronLockHint, prayTo, prayerHudLine } from "../data/patrons";
import {
  grantLanista,
  chamberItemEquipped,
  getSchoolRecord,
  schoolReadyForUndercard,
  schoolReadyForChampion,
  schoolReadinessLabel,
  schoolPowerCompare,
  schoolWinChance,
  schoolWinChanceColor,
  schoolNextFoeId,
  schoolReadyChecklist,
  schoolGloryCount,
  schoolStudentUnlocked,
  schoolUnlockHint,
  schoolReadyNeeds,
  schoolBoutLocked,
  meterBar,
  SCHOOL_FOCUS,
  SCHOOL_IDS,
  isSchoolNpc,
} from "../data/school";
import { getStudentCircuit, schoolCircuitRungLabel } from "../data/schoolCircuit";
import type { SchoolNpcId } from "../types";
import {
  CHAMBER_ITEMS,
  CHAMBER_TABS,
  chamberBedTex,
  chamberExtraTex,
  chamberFloorTex,
  chamberHangingTex,
  chamberHangingTint,
  chamberRugTex,
  chamberSlotFromId,
  chamberThumbTex,
  chamberWithPreview,
  lastTrophyHouse,
  type ChamberSlot,
} from "../data/chamber";
import { getNpc, HOUSE_GLADIATORS } from "../data/gladiators";
import { generateHouseName } from "../data/names";
import { ACTION_LABELS, controlsHelpText, eventToKeyName, mergedKeybinds, prettyKey, trySetBind, type CombatAction } from "../systems/input";
import { enterMenu, returnFromArena } from "../systems/playFlow";
import {
  camp,
  buyNextPlot,
  buyLivestockPen,
  buyPenAnimal,
  plantPlot,
  harvestPlot,
  FARM_CROPS,
  PLOT_BUY_COST,
  PEN_BUY_COST,
  setParty,
  COMPANION_IDS,
  cropPlotIds,
  stablePlotIds,
  penCapacity,
  penOccupancy,
  penAnimalPlots,
  isCropUnlocked,
  animalUnlockHint,
  cropUnlockHint,
  penUnlocked,
} from "../data/camp";
import { COOK_QUEST_DEFS, cookQuestProgress, visibleCookQuests, isRecipeQuestLocked, recipeLockHint } from "../data/cookQuests";
import { marchableRaidHouses, nextUnlockedRaidHouse, raidHouseShortName } from "../data/raid";
import type { CompanionId, CookRecipeId, FarmCropId, MealBuff, RaidHouseId, WeaponId } from "../types";
import {
  getCompanionDef,
  companionNodeCost,
  unlockCompanionNode,
  setCompanionWeapon,
  companionHasNode,
} from "../data/companions";
import {
  getVolunteerDef,
  setHouseVolunteer,
  volunteerDisplayLine,
  volunteerHouseId,
  volunteersGroupedByHouse,
} from "../data/volunteers";
import {
  assignCampBuffFromStock,
  campRecipes,
  canCraft,
  cookedCount,
  craftRecipe,
  formatRecipeInputs,
  getRecipe,
  ingredientShortfallHint,
  kitchenStockSummary,
  marchRecipes,
  pantryCount,
  rawCropLabel,
  sellCooked,
  sellRaw,
  RAW_SELL_PRICES,
} from "../data/kitchen";

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
  private prayerLabel!: Phaser.GameObjects.Text;
  private objectivePanel?: Phaser.GameObjects.Container;
  private objectiveBg?: Phaser.GameObjects.Rectangle;
  private objectiveTitle?: Phaser.GameObjects.Text;
  private objectiveBody?: Phaser.GameObjects.Text;
  private objectivePrayer?: Phaser.GameObjects.Text;
  private objectiveToggle?: Phaser.GameObjects.Text;
  private objectiveMinimized = false;
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
  private raidTitleBox: Phaser.GameObjects.Container | null = null;
  private raidTitleDone?: () => void;
  private raidTitleTimer?: Phaser.Time.TimerEvent;
  private campLoadoutId: CompanionId | "player" = "titus";
  private cipherPicks: string[] = [];
  private farmMode: "crops" | "stables" = "crops";
  private partyVolTab: RaidHouseId | null = null;
  private campMarchTab: "meals" | "targets" = "targets";
  private campMarchHousePage = 0;
  private campKitchenTab: "march" | "broth" | "sell" | "quests" = "march";
  private pausePage: MenuPage = "root";
  private sparBg!: Phaser.GameObjects.Arc;
  private sparLabel!: Phaser.GameObjects.Text;
  private sparHint!: Phaser.GameObjects.Text;
  private sparYield = false;
  private lightBg!: Phaser.GameObjects.Arc;
  private lightLabel!: Phaser.GameObjects.Text;
  private lightHint!: Phaser.GameObjects.Text;
  private heavyBg!: Phaser.GameObjects.Arc;
  private heavyLabel!: Phaser.GameObjects.Text;
  private heavyHint!: Phaser.GameObjects.Text;
  private netBg!: Phaser.GameObjects.Arc;
  private netLabel!: Phaser.GameObjects.Text;
  private netHint!: Phaser.GameObjects.Text;
  /** LIGHT/HEAVY/NET only while combat is actually available. */
  private combatButtonsWanted = false;
  private talkBg!: Phaser.GameObjects.Arc;
  private talkLabel!: Phaser.GameObjects.Text;
  private talkHint!: Phaser.GameObjects.Text;
  private dimmer: Phaser.GameObjects.Rectangle | null = null;
  private resultClosing = false;
  private boundWindowEsc: ((e: KeyboardEvent) => void) | null = null;
  private escaping = false;
  private returningLudus = false;
  private resultAutoTimer: ReturnType<typeof setTimeout> | null = null;
  private resultPending = false;
  private comboLabel!: Phaser.GameObjects.Text;
  private comboHideAt = 0;
  private perfectFlash?: Phaser.GameObjects.Rectangle;
  private perfectText?: Phaser.GameObjects.Text;
  private gateHouse: string | null = null;
  private waitingBind: CombatAction | null = null;
  private shopTab: ShopKind = "tunic";
  private roostTab: "care" | "looks" = "care";
  private gateTab: "steel" | "school" = "steel";
  private schoolNpc: string | null = null;
  private schoolHouse: string | null = null;
  private shopPreviewId: string | null = null;
  private chamberTab: ChamberSlot = "floor";
  private minimapWrap?: Phaser.GameObjects.Container;
  private minimapGfx?: Phaser.GameObjects.Graphics;
  private minimapLabel?: Phaser.GameObjects.Text;
  private minimapScene = "none";
  private renameValue = "";
  private renameLabel?: Phaser.GameObjects.Text;
  private musicMuteText?: Phaser.GameObjects.Text;
  private judgmentOpen = false;
  private judgmentWrap: Phaser.GameObjects.GameObject[] = [];
  private actCardOpen = false;
  private actCardAct: ActId | null = null;
  private pendingActCard: ActId | null = null;
  private actCardWrap: Phaser.GameObjects.GameObject[] = [];
  private drillHudWrap: Phaser.GameObjects.GameObject[] = [];
  private drillHudScore?: Phaser.GameObjects.Text;
  private drillHudTime?: Phaser.GameObjects.Text;
  private drillHudPrompt?: Phaser.GameObjects.Text;
  private drillHowtoWrap: Phaser.GameObjects.GameObject[] = [];
  private drillHowtoId: string | null = null;

  constructor() {
    super("UIScene");
  }

  init(): void {
    this.overlay = null;
    this.dimmer = null;
    this.dialogueBox = null;
    this.dialogueLines = [];
    this.dialogueIndex = 0;
    this.dialogueDone = undefined;
    this.resultPending = false;
    this.judgmentOpen = false;
    this.judgmentWrap = [];
    this.actCardOpen = false;
    this.actCardAct = null;
    this.pendingActCard = null;
    this.actCardWrap = [];
    this.drillHudWrap = [];
    this.drillHudScore = undefined;
    this.drillHudTime = undefined;
    this.drillHudPrompt = undefined;
    this.drillHowtoWrap = [];
    this.drillHowtoId = null;
    this.bossWrap = [];
    this.favorWrap = [];
    this.gateHouse = null;
    this.waitingBind = null;
    this.pausePage = "root";
    this.aleaBusy = false;
    this.aleaPending = null;
    this.bjBusy = false;
    this.bj = null;
    this.resultClosing = false;
    this.returningLudus = false;
    if (this.resultAutoTimer != null) {
      clearTimeout(this.resultAutoTimer);
      this.resultAutoTimer = null;
    }
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

    this.weaponLabel = this.add
      .text(198, GAME_HEIGHT - 36, "", {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#d4a84b",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(100);
    this.addAttackButton();
    this.addHeavyButton();
    this.addNetButton();
    this.addSparButton();
    this.addTalkButton();
    this.addMusicMuteButton();
    this.refreshCombatButtons();

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

    this.buildObjectivePanel();
    this.objectiveLabel = this.objectiveBody!;
    this.prayerLabel = this.objectivePrayer!;

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
    bus.on("locker", this.openLocker, this);
    bus.on("result", this.openResult, this);
    bus.on("boss", this.showBoss, this);
    bus.on("boss-hide", this.hideBoss, this);
    bus.on("favor-show", this.showFavor, this);
    bus.on("favor-hide", this.hideFavor, this);
    bus.on("crowd-call", this.onCrowdCall, this);
    bus.on("judgment-show", this.showJudgment, this);
    bus.on("judgment-hide", this.hideJudgment, this);
    bus.on("return-ludus", this.returnLudus, this);
    bus.on("ludus-resumed", this.onLudusResumed, this);
    bus.on("pal-hp-show", this.showPalHp, this);
    bus.on("pal-hp", this.onPalHp, this);
    bus.on("pal-hp-hide", this.hidePalHp, this);
    bus.on("toast", this.toast, this);
    bus.on("spar-available", this.setSparButton, this);
    bus.on("talk-available", this.setTalkButton, this);
    bus.on("combat-hud", this.setCombatHud, this);
    bus.on("shop", this.openShop, this);
    bus.on("chamber", this.openChamber, this);
    bus.on("lanista-offer", this.openLanistaOffer, this);
    bus.on("shrine", this.openShrine, this);
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
    bus.on("act-card", this.showActCard, this);
    bus.on("drill-show", this.showDrillHud, this);
    bus.on("drill-hide", this.hideDrillHud, this);
    bus.on("drill-score", this.onDrillScore, this);
    bus.on("drill-howto", this.showDrillHowto, this);
    bus.on("camp-farm", this.openCampFarm, this);
    bus.on("camp-party", this.openCampParty, this);
    bus.on("camp-march", this.openCampMarch, this);
    bus.on("camp-loadout", this.openCampLoadout, this);
    bus.on("camp-kitchen", this.openCampKitchen, this);
    bus.on("camp-refresh", () => undefined, this);
    bus.on("raid-cipher", this.openRaidCipher, this);
    bus.on("raid-title", this.openRaidTitle, this);

    this.input.keyboard?.on("keydown-ESC", () => {
      this.onEscapeKey();
    });
    // Backup if Phaser keyboard is dead mid-freeze — browser Escape still works
    this.boundWindowEsc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      this.onEscapeKey();
    };
    window.addEventListener("keydown", this.boundWindowEsc, true);
    this.input.keyboard?.on("keydown-TAB", (e: KeyboardEvent) => {
      e.preventDefault();
      if (this.judgmentOpen) return;
      if (this.pausePage === "rename") return;
      if (this.resultPending || gameState.inDialogue) return;
      if (this.overlay) this.closeOverlay();
      else this.openArmory();
    });
    this.input.keyboard?.on("keydown-SPACE", () => {
      if (this.actCardOpen) {
        this.dismissActCard();
        return;
      }
      if (this.judgmentOpen) {
        this.pickJudgment(true);
        return;
      }
      if (this.pausePage === "rename") return;
      if (this.resultPending) {
        this.finishResult();
        return;
      }
      if (this.raidTitleBox) {
        this.dismissRaidTitle();
        return;
      }
      if (this.dialogueBox) {
        this.advanceDialogue();
        return;
      }
      if (gameState.inDialogue || gameState.inMenu || gameState.paused || this.overlay) return;
    });
    this.input.keyboard?.on("keydown-ENTER", () => {
      if (this.actCardOpen) {
        this.dismissActCard();
        return;
      }
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
      if (this.actCardOpen) return;
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
      else this.minimapWrap?.setVisible(true);
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
      if (this.actCardOpen) {
        this.dismissActCard();
        return;
      }
      if (this.judgmentOpen) {
        this.pickJudgment(true);
        return;
      }
      if (this.pausePage === "rename") return;
      if (this.resultPending) {
        this.finishResult();
        return;
      }
      if (this.raidTitleBox) {
        this.dismissRaidTitle();
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
      bus.off("locker", this.openLocker, this);
      bus.off("result", this.openResult, this);
      bus.off("boss", this.showBoss, this);
      bus.off("boss-hide", this.hideBoss, this);
      bus.off("favor-show", this.showFavor, this);
      bus.off("favor-hide", this.hideFavor, this);
      bus.off("crowd-call", this.onCrowdCall, this);
      bus.off("judgment-show", this.showJudgment, this);
      bus.off("judgment-hide", this.hideJudgment, this);
      bus.off("return-ludus", this.returnLudus, this);
      bus.off("ludus-resumed", this.onLudusResumed, this);
      bus.off("pal-hp-show", this.showPalHp, this);
      bus.off("pal-hp", this.onPalHp, this);
      bus.off("pal-hp-hide", this.hidePalHp, this);
      bus.off("toast", this.toast, this);
      bus.off("spar-available", this.setSparButton, this);
      bus.off("talk-available", this.setTalkButton, this);
      bus.off("combat-hud", this.setCombatHud, this);
      bus.off("shop", this.openShop, this);
      bus.off("chamber", this.openChamber, this);
      bus.off("lanista-offer", this.openLanistaOffer, this);
      bus.off("shrine", this.openShrine, this);
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
      bus.off("act-card", this.showActCard, this);
      bus.off("drill-show", this.showDrillHud, this);
      bus.off("drill-hide", this.hideDrillHud, this);
      bus.off("drill-score", this.onDrillScore, this);
      bus.off("drill-howto", this.showDrillHowto, this);
      bus.off("camp-farm", this.openCampFarm, this);
      bus.off("camp-party", this.openCampParty, this);
      bus.off("camp-march", this.openCampMarch, this);
      bus.off("camp-loadout", this.openCampLoadout, this);
      bus.off("camp-kitchen", this.openCampKitchen, this);
      bus.off("raid-cipher", this.openRaidCipher, this);
      bus.off("raid-title", this.openRaidTitle, this);
      this.hideFavor();
      this.hideDrillHud();
      this.hideDrillHowto();
      this.dismissActCard(true);
      if (this.boundWindowEsc) {
        window.removeEventListener("keydown", this.boundWindowEsc, true);
        this.boundWindowEsc = null;
      }
    });
  }

  update(): void {
    const s = gameState.save;
    const live = playerCombatStats();
    const hpW = 180 * Phaser.Math.Clamp(s.health / Math.max(1, live.maxHealth), 0, 1);
    const stW = 180 * Phaser.Math.Clamp(s.stamina / Math.max(1, live.maxStamina), 0, 1);
    this.hpFill.width = hpW;
    this.stamFill.width = stW;
    this.unguentFill.width = 180 * Phaser.Math.Clamp((s.unguent ?? 0) / UNGUENT_MAX, 0, 1);
    this.xpFill.width = 180 * Phaser.Math.Clamp(s.xp / Math.max(1, s.xpToNext), 0, 1);
    const pts = s.statPoints > 0 ? `  ·  ${s.statPoints} skill` : "";
    this.levelLabel.setText(`Lv ${s.level}   ${Math.floor(s.xp)}/${s.xpToNext} XP${pts}`);
    const vialKey = prettyKey(mergedKeybinds().unguent);
    const equipped = arenaWeapon();
    this.weaponLabel.setText(
      equipped ? `${getWeapon(equipped).name}  ·  ${vialKey} unguent  ${s.unguent ?? 0}/${UNGUENT_MAX}` : `Unarmed  ·  equip in the armory`,
    );
    if (gameState.pendingSchoolBout) this.weaponLabel.setText("You watch from the stands.");
    this.refreshCombatButtons();
    this.denariiLabel.setText(`${s.denarii} denarii`);
    this.titleLabel.setText(displayTitle());
    this.refreshObjectivePanel();
    this.musicMuteText?.setText(audio.musicMuteLabel());
    if (this.comboLabel.visible && this.time.now > this.comboHideAt) {
      this.comboLabel.setAlpha(Math.max(0, this.comboLabel.alpha - 0.08));
      if (this.comboLabel.alpha <= 0) this.comboLabel.setVisible(false);
    }
  }

  private buildObjectivePanel(): void {
    const panelW = 520;
    this.objectivePanel = this.add.container(GAME_WIDTH / 2, 10).setScrollFactor(0).setDepth(110);
    this.objectiveBg = this.add
      .rectangle(0, 0, panelW, 64, 0x1a1210, 0.9)
      .setStrokeStyle(2, COLORS.gold)
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });
    this.objectiveTitle = this.add
      .text(0, 8, "", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "13px",
        color: "#d4a84b",
      })
      .setOrigin(0.5, 0);
    this.objectiveBody = this.add
      .text(0, 28, "", {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#f0e6d2",
        align: "center",
        wordWrap: { width: panelW - 56 },
      })
      .setOrigin(0.5, 0);
    this.objectivePrayer = this.add
      .text(0, 48, "", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "12px",
        color: "#e8c96a",
        align: "center",
        wordWrap: { width: panelW - 56 },
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.objectiveToggle = this.add
      .text(panelW / 2 - 18, 6, "—", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "16px",
        color: "#d4a84b",
      })
      .setOrigin(0.5, 0)
      .setInteractive({ useHandCursor: true });

    this.objectivePanel.add([this.objectiveBg, this.objectiveTitle, this.objectiveBody, this.objectivePrayer, this.objectiveToggle]);

    const toggle = () => {
      this.objectiveMinimized = !this.objectiveMinimized;
      this.refreshObjectivePanel();
    };
    this.objectiveBg.on("pointerdown", toggle);
    this.objectiveToggle.on("pointerdown", (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      toggle();
    });
  }

  private refreshObjectivePanel(): void {
    if (!this.objectivePanel || !this.objectiveBg || !this.objectiveTitle || !this.objectiveBody || !this.objectiveToggle) return;
    const meta = ACT_META[currentAct()];
    const prefix = actHudPrefix();
    const full = currentObjectiveText();
    const body = full.startsWith(prefix) ? full.slice(prefix.length) : full;
    const prayer = prayerHudLine();

    this.objectiveTitle.setText(`Act ${meta.roman} — ${meta.title}`);
    this.objectiveBody.setText(body);
    this.objectivePrayer!.setText(prayer).setVisible(Boolean(prayer) && !this.objectiveMinimized);
    this.objectiveToggle.setText(this.objectiveMinimized ? "+" : "—");

    if (this.objectiveMinimized) {
      this.objectiveBody.setVisible(false);
      this.objectivePrayer!.setVisible(false);
      this.objectiveBg.setSize(280, 28);
      this.objectiveTitle.setY(6);
      this.objectiveToggle.setPosition(122, 4);
    } else {
      this.objectiveBody.setVisible(true);
      this.objectiveBody.setY(28);
      const bodyH = Math.max(18, this.objectiveBody.height);
      let h = 36 + bodyH;
      if (prayer) {
        this.objectivePrayer!.setY(32 + bodyH);
        h += this.objectivePrayer!.height + 8;
      }
      this.objectiveBg.setSize(520, h + 10);
      this.objectiveTitle.setY(8);
      this.objectiveToggle.setPosition(242, 6);
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
    this.flushActCard();
  }

  /** Never swallow Escape — judgment used to `return` and trap the player. */
  private onEscapeKey(): void {
    if (this.escaping) return;
    this.escaping = true;
    try {
      if (this.drillHowtoId) {
        this.hideDrillHowto();
        return;
      }
      if (this.actCardOpen) {
        this.dismissActCard();
        return;
      }
      if (this.judgmentOpen) {
        this.hideJudgment();
        bus.emit("judgment-pick", { follow: true });
        return;
      }
      if (this.pausePage === "rename" && this.overlay) {
        this.pausePage = "stats";
        this.renderPause();
        return;
      }
      if (this.resultPending || this.resultClosing) {
        this.finishResult();
        return;
      }
      if (this.raidTitleBox) {
        this.dismissRaidTitle();
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
      // Soft-lock recovery: clear flags / orphaned blockers, then pause
      this.forceUnlockUi();
      this.openPause();
    } finally {
      window.setTimeout(() => {
        this.escaping = false;
      }, 120);
    }
  }

  /** Strip every UI lock and orphaned fullscreen blocker. */
  private forceUnlockUi(): void {
    this.resultClosing = false;
    this.resultPending = false;
    this.judgmentOpen = false;
    this.judgmentWrap.forEach((o) => {
      try {
        o.destroy();
      } catch {
        /* ignore */
      }
    });
    this.judgmentWrap = [];
    if (this.actCardOpen) this.dismissActCard(true);
    this.pendingActCard = null;
    this.dimmer?.destroy();
    this.dimmer = null;
    this.overlay?.destroy();
    this.overlay = null;
    this.dialogueBox?.destroy();
    this.dialogueBox = null;
    this.hideDrillHowto();
    gameState.paused = false;
    gameState.inMenu = false;
    gameState.inDialogue = false;
    this.lock(false);
  }

  private finishResult(): void {
    if (this.resultClosing) return;
    this.resultClosing = true;
    if (this.resultAutoTimer != null) {
      clearTimeout(this.resultAutoTimer);
      this.resultAutoTimer = null;
    }

    this.forceUnlockUi();
    bus.emit("result-closed");

    // If leave() didn't bring us home (and this isn't a tournament chain), force it
    window.setTimeout(() => {
      this.resultClosing = false;
      const next = gameState.pendingArenaOpponent;
      const tourneyChain =
        Boolean(next) && isTournamentId(next!) && !gameState.save.freedomWon && this.scene.isActive("ArenaScene");
      if (tourneyChain) return;
      if (!this.scene.isActive("LudusScene")) this.returnLudus();
    }, 200);
  }

  private onLudusResumed = (): void => {
    this.forceUnlockUi();
  };

  private returnLudus = (): void => {
    if (this.returningLudus) return;
    this.returningLudus = true;
    this.forceUnlockUi();
    if (this.resultAutoTimer != null) {
      clearTimeout(this.resultAutoTimer);
      this.resultAutoTimer = null;
    }
    returnFromArena(this.game);
    window.setTimeout(() => {
      this.forceUnlockUi();
      this.returningLudus = false;
    }, 250);
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
  }

  /** Keep camp overlays inside the 720px viewport. */
  private overlayMaxHeight(preferred: number): number {
    return Math.min(preferred, GAME_HEIGHT - 48);
  }

  private addTabBtn(
    c: Phaser.GameObjects.Container,
    x: number,
    y: number,
    label: string,
    active: boolean,
    fn: () => void,
    w = 150,
  ): void {
    const bg = this.add
      .rectangle(x, y, w, 34, active ? 0x3a281c : 0x1a1210)
      .setStrokeStyle(1, active ? COLORS.gold : 0x6a5a3a)
      .setInteractive({ useHandCursor: true });
    const t = this.add
      .text(x, y, label, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "14px",
        color: active ? "#e8c96a" : "#c4b8a4",
      })
      .setOrigin(0.5);
    if (!active) {
      bg.on("pointerover", () => bg.setFillStyle(0x2a2018));
      bg.on("pointerout", () => bg.setFillStyle(0x1a1210));
    }
    bg.on("pointerdown", () => {
      audio.sfx("ui");
      fn();
    });
    c.add([bg, t]);
  }

  private marchMealSummary(): string {
    const c = camp();
    if (c.selectedMarchRecipe) return getRecipe(c.selectedMarchRecipe).name;
    if (c.farm.selectedPantryCrop) return `${FARM_CROPS[c.farm.selectedPantryCrop].name} (raw)`;
    if (c.farm.selectedMeal === "hp") return "Barley mash (raw)";
    if (c.farm.selectedMeal === "stamina") return "Olive oil (raw)";
    if (c.farm.selectedMeal === "damage") return "Goat meat (raw)";
    return "None";
  }

  openPause(): void {
    this.pausePage = "root";
    this.renderPause();
  }

  private unstuck(): void {
    bus.emit("unstuck");
    this.toast("Moved to open ground.");
    this.closeOverlay();
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
    const c = this.box(520, this.pausePage === "settings" || this.pausePage === "controls" || this.pausePage === "stats" ? 680 : this.pausePage === "root" ? 600 : 560, "PAUSED");
    if (this.pausePage === "root") {
      const items: [string, () => void][] = [
        ["Resume", () => this.closeOverlay()],
        ["Unstuck", () => this.unstuck()],
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
      items.forEach((it, i) => this.addBtn(c, 0, -210 + i * 42, it[0], it[1]));
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
          `${s.playerName}  ·  Lv ${s.level}  ·  ${s.reputation}\nXP ${Math.floor(s.xp)} / ${s.xpToNext}\nSkill points: ${s.statPoints}${hurt}\n\nHealth ${Math.round(live.maxHealth)}\nStamina ${Math.round(live.maxStamina)}\nUnguent vials ${s.unguent ?? 0} / 3\nAttack ${live.attack.toFixed(1)}\nDefense ${live.defense.toFixed(1)}\nAgility ${live.agility.toFixed(1)}${s.activePrayer ? `\nPrayer  ${getPatron(s.activePrayer)?.name ?? s.activePrayer}` : ""}${palLine}`,
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
        .text(0, -292, points > 0 ? `${points} skill point${points === 1 ? "" : "s"} — they go to this tree. Click a glowing node.` : "Earn XP to level up. Points go to the skill tree.", {
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
    if (payload?.first) this.toast(`Parry! They stagger. Tap ${prettyKey(mergedKeybinds().parry)} into a swing.`);
  };

  openShop = (): void => {
    if (this.resultPending) return;
    const c = this.box(1180, 640, this.shopTab === "chamber" ? "CHAMBER" : "QUARTERS");
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
      this.shopPreviewId =
        this.shopTab === "chamber"
          ? items.find((it) => chamberItemEquipped(it.id))?.id ?? items[0]?.id ?? null
          : equippedId(this.shopTab);
    }
    const selected = items.find((it) => it.id === this.shopPreviewId) ?? items[0];
    const look = lookWithItem(selected?.id ?? null);
    makeBodyTexture(this, "shop-preview", look.tunic, look.accent, 1.2, look.style, look.cape, look.scar, look.crest);
    c.add(this.add.image(-530, -78, "shop-preview").setScale(1.45));
    c.add(this.add.text(-530, 36, previewTitle(selected?.id ?? null), { fontFamily: "Cinzel, Georgia", fontSize: "15px", color: "#d4a84b" }).setOrigin(0.5));

    if (selected) {
      const owned = ownsCosmetic(selected.id);
      const equipped = selected.kind === "chamber" ? chamberItemEquipped(selected.id) : equippedId(selected.kind) === selected.id;
      const locked = !shopUnlocked(selected);
      const canBuy = !owned && !locked && gameState.save.denarii >= selected.cost;
      c.add(
        this.add
          .text(-530, 60, shopItemLabel(selected), {
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
          ? selected.kind === "chamber"
            ? "Placed"
            : "Wearing"
          : owned
            ? selected.kind === "chamber"
              ? "Place"
              : "Equip"
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
            this.toast(selected.kind === "chamber" ? "Already placed." : "Already wearing that.");
            return;
          }
          const result = buyCosmetic(selected.id);
          if (result === "poor") this.toast("Not enough denarii.");
          else if (result === "locked") this.toast("That is still locked.");
          else if (result === "bought") this.toast(`Bought ${shopItemLabel(selected)}.`);
          else this.toast(`Equipped ${shopItemLabel(selected)}.`);
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
        "Rest  ·  " + REST_COST + " denarii",
        () => {
          const result = restInjury();
          if (result === "ok") this.toast("You rest. The ache leaves you.");
          else if (result === "poor") this.toast("Not enough denarii.");
          else this.toast("You are not injured.");
          this.openShop();
        },
        220,
      );
    }

    const tabs = SHOP_TABS.filter((entry) => entry.kind !== "chamber");
    if (this.shopTab === "chamber") this.shopTab = "tunic";
    const tab = tabs.find((t) => t.kind === this.shopTab) ?? tabs[0];
    const tabY = -218;
    const showChamber = Boolean(gameState.save.lanistaUnlocked);
    const tabCount = tabs.length + (showChamber ? 1 : 0);
    const pitch = tabCount > 6 ? 102 : 118;
    const start = tabCount > 6 ? -310 : -205;
    c.add(this.add.rectangle(90, tabY, 760, 46, 0x1a1210, 0.72).setStrokeStyle(1, 0x8a6a3a, 0.55));
    tabs.forEach((entry, i) => {
      this.addShopTab(c, start + i * pitch, tabY, entry.label, entry.kind === this.shopTab, () => {
        this.shopTab = entry.kind;
        this.shopPreviewId = null;
        this.openShop();
      });
    });
    if (showChamber) {
      this.addShopTab(c, start + tabs.length * pitch, tabY, "Chamber", false, () => this.openChamberDecor());
    }
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
      const equipped = item.kind === "chamber" ? chamberItemEquipped(item.id) : equippedId(item.kind) === item.id;
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
        .text(x - cardW / 2 + 34, y - 10, shopItemLabel(item), {
          fontFamily: "Georgia",
          fontSize: "14px",
          color: locked ? "#6a5a4a" : "#e8dcc8",
        })
        .setOrigin(0, 0.5);
      const status = locked
        ? item.requiresFlag === "freedomWon"
          ? "Locked — win the Rudis"
          : item.requiresFlag === "lanistaUnlocked"
            ? "Locked — take the school"
          : item.requiresFlag
            ? "Locked — lose an arena fight without being spared"
            : shopLockHint(item)
        : previewing
          ? equipped
            ? item.kind === "chamber"
              ? "Preview  ·  placed"
              : "Preview  ·  wearing"
            : "Preview"
          : equipped
            ? item.kind === "chamber"
              ? "Placed"
              : "Wearing"
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

  openChamber = (): void => {
    this.openChamberDecor();
  };

  openChamberDecor = (): void => {
    if (this.resultPending) return;
    if (!gameState.save.lanistaUnlocked) {
      this.toast("Take the school from Marcellus first.");
      return;
    }
    const items = CHAMBER_ITEMS.filter((it) => chamberSlotFromId(it.id) === this.chamberTab);
    if (!this.shopPreviewId || !items.some((it) => it.id === this.shopPreviewId)) {
      this.shopPreviewId = items.find((it) => chamberItemEquipped(it.id))?.id ?? items[0]?.id ?? null;
    }
    const selected = items.find((it) => it.id === this.shopPreviewId) ?? items[0];
    const shopItem = selected ? SHOP_ITEMS.find((it) => it.id === selected.id) : undefined;
    const c = this.box(1180, 660, "CHAMBER");
    c.add(this.add.rectangle(0, -288, 1120, 8, COLORS.crimson, 0.85));
    c.add(
      this.add
        .text(0, -268, `${gameState.save.denarii} denarii  ·  furnish the loft`, {
          fontFamily: "Georgia",
          fontSize: "15px",
          color: "#e8dcc8",
        })
        .setOrigin(0.5),
    );

    CHAMBER_TABS.forEach((entry, i) => {
      this.addShopTab(c, -360 + i * 108, -228, entry.label, entry.slot === this.chamberTab, () => {
        this.chamberTab = entry.slot;
        this.shopPreviewId = null;
        this.openChamberDecor();
      });
    });

    this.drawChamberMini(c, -430, -150, this.shopPreviewId);
    const thumb = chamberThumbTex(selected?.id ?? "floor-pale");
    if (this.textures.exists(thumb)) {
      c.add(this.add.image(-430, 70, thumb).setScale(selected && chamberSlotFromId(selected.id) === "bed" ? 2.2 : 2.4));
    }
    if (selected) {
      c.add(this.add.text(-430, 118, selected.name, { fontFamily: "Cinzel, Georgia", fontSize: "16px", color: "#e8dcc8" }).setOrigin(0.5));
      c.add(
        this.add
          .text(-430, 142, selected.description, {
            fontFamily: "Georgia",
            fontSize: "13px",
            color: "#c4b49a",
            wordWrap: { width: 240 },
            align: "center",
          })
          .setOrigin(0.5, 0),
      );
      const owned = ownsCosmetic(selected.id);
      const equipped = chamberItemEquipped(selected.id);
      const locked = shopItem ? !shopUnlocked(shopItem) : false;
      const canBuy = !owned && !locked && gameState.save.denarii >= selected.cost;
      const actionLabel = locked
        ? "Locked"
        : equipped
          ? "Placed"
          : owned
            ? "Place"
            : canBuy
              ? `Buy  ·  ${selected.cost} denarii`
              : `Need ${selected.cost} denarii`;
      this.addBtn(
        c,
        -430,
        220,
        actionLabel,
        () => {
          if (!shopItem) return;
          if (locked) {
            this.toast(shopLockHint(shopItem));
            return;
          }
          if (equipped) {
            this.toast("Already placed.");
            return;
          }
          const result = buyCosmetic(selected.id);
          if (result === "poor") this.toast("Not enough denarii.");
          else if (result === "locked") this.toast("That is still locked.");
          else if (result === "bought") this.toast(`Bought ${selected.name}.`);
          else this.toast(`Placed ${selected.name}.`);
          audio.sfx("ui");
          this.openChamberDecor();
        },
        220,
      );
    }

    items.forEach((item, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 80 + col * 300;
      const y = -160 + row * 70;
      const shopIt = SHOP_ITEMS.find((it) => it.id === item.id)!;
      const owned = ownsCosmetic(item.id);
      const equipped = chamberItemEquipped(item.id);
      const locked = !shopUnlocked(shopIt);
      const previewing = item.id === selected?.id;
      const card = this.add
        .rectangle(x, y, 280, 60, previewing ? 0x3a281c : 0x1a1210, 0.96)
        .setStrokeStyle(previewing ? 2 : 1, previewing ? COLORS.gold : equipped ? 0x8ecf6a : 0x5a4a38)
        .setInteractive({ useHandCursor: true });
      const thumbTex = chamberThumbTex(item.id);
      const chip = this.textures.exists(thumbTex)
        ? this.add.image(x - 118, y, thumbTex).setDisplaySize(28, 28)
        : this.add.rectangle(x - 118, y, 22, 22, COLORS.gold);
      const name = this.add.text(x - 96, y - 12, item.name, { fontFamily: "Georgia", fontSize: "15px", color: locked ? "#6a5a4a" : "#e8dcc8" }).setOrigin(0, 0.5);
      const status = locked
        ? shopLockHint(shopIt)
        : equipped
          ? "Placed"
          : owned
            ? "Owned"
            : `${item.cost} denarii`;
      const detail = this.add
        .text(x - 96, y + 12, status, {
          fontFamily: "Georgia",
          fontSize: "12px",
          color: equipped ? "#8ecf6a" : owned || (!locked && gameState.save.denarii >= item.cost) ? "#d4a84b" : "#6a5a4a",
        })
        .setOrigin(0, 0.5);
      card.on("pointerover", () => card.setFillStyle(previewing ? 0x4a3424 : 0x3a281c));
      card.on("pointerout", () => card.setFillStyle(previewing ? 0x3a281c : 0x1a1210));
      card.on("pointerdown", () => {
        audio.sfx("ui");
        this.shopPreviewId = item.id;
        this.openChamberDecor();
      });
      c.add([card, chip, name, detail]);
    });

    this.addBtn(c, 80, 280, "Quarters", () => {
      this.shopTab = "tunic";
      this.openShop();
    }, 180);
    this.addBtn(c, 280, 280, "Close", () => this.closeOverlay(), 180);
  };

  private drawChamberMini(c: Phaser.GameObjects.Container, ox: number, oy: number, previewId: string | null): void {
    const ts = 18;
    const cols = 13;
    const rows = 5;
    const decor = chamberWithPreview(previewId);
    c.add(this.add.rectangle(ox, oy + 8, cols * ts + 12, rows * ts + 12, 0x1a1210, 0.95).setStrokeStyle(2, COLORS.gold));
    const tile = (tx: number, ty: number, tex: string, depth = 0) => {
      if (!this.textures.exists(tex)) return;
      const img = this.add.image(ox - (cols * ts) / 2 + tx * ts + ts / 2, oy - (rows * ts) / 2 + ty * ts + ts / 2, tex);
      img.setDisplaySize(ts, ts);
      c.add(img);
    };
    const floor = chamberFloorTex(decor.floor);
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        if (ty === 4 && tx !== 5 && tx !== 6) tile(tx, ty, "tile-wall");
        else tile(tx, ty, floor);
      }
    }
    const rug = chamberRugTex(decor.rug);
    if (rug) {
      for (let ty = 1; ty <= 2; ty++) {
        for (let tx = 2; tx <= 10; tx++) tile(tx, ty, rug);
      }
    }
    const prop = (tx: number, ty: number, tex: string, scale = 0.55, tint?: number) => {
      if (!this.textures.exists(tex)) return;
      const img = this.add.image(ox - (cols * ts) / 2 + tx * ts + ts / 2, oy - (rows * ts) / 2 + ty * ts + ts / 2, tex);
      img.setScale(scale);
      if (tint != null) img.setTint(tint);
      c.add(img);
    };
    const hang = chamberHangingTex(decor.banner);
    if (hang) {
      const tint = chamberHangingTint(decor.banner);
      prop(4, 0, hang, 0.42, tint);
      prop(6, 0, hang, 0.42, tint);
      prop(8, 0, hang, 0.42, tint);
    }
    if (decor.light === "light-lamps") {
      prop(1, 0, "prop-lamp", 0.7);
      prop(12, 0, "prop-lamp", 0.7);
    } else if (decor.light === "light-brazier") {
      prop(1, 2, "prop-brazier", 0.5);
    }
    if (decor.trophy === "trophy-empty" || decor.trophy === "trophy-eagle" || decor.trophy === "trophy-last") {
      prop(2, 0, "prop-trophy-empty", 0.7);
      if (decor.trophy === "trophy-eagle") prop(2, 0, "trophy-skel-eagle", 0.7);
      if (decor.trophy === "trophy-last") {
        const house = lastTrophyHouse();
        const tex = `trophy-skel-${house?.beastKind ?? "eagle"}`;
        if (this.textures.exists(tex)) prop(2, 0, tex, 0.7);
      }
    }
    const extra = chamberExtraTex(decor.extra);
    if (extra) prop(2, 2, extra, 0.55);
    const bed = chamberBedTex(decor.bed);
    if (bed) prop(11, 1, bed, 0.55);
    prop(9, 2, "prop-desk", 0.55);
    c.add(this.add.text(ox, oy + rows * ts * 0.5 + 18, "Preview", { fontFamily: "Georgia", fontSize: "12px", color: "#d4a84b" }).setOrigin(0.5));
  }

  openLanistaOffer = (): void => {
    if (gameState.save.lanistaUnlocked) return;
    const c = this.box(560, 360, "THE SCHOOL");
    c.add(
      this.add
        .text(0, -90, "Marcellus offers the book of the school.\nThe loft, the Drill Yard east of the ring,\nand a second gate for the four.", {
          fontFamily: "Georgia",
          fontSize: "16px",
          color: "#e8dcc8",
          align: "center",
          wordWrap: { width: 460 },
        })
        .setOrigin(0.5),
    );
    this.addBtn(c, 0, 20, "Take the school", () => {
      if (grantLanista()) {
        this.toast("The loft is yours. Title: Lanista of Aquila.");
      }
      this.closeOverlay();
    }, 240);
    this.addBtn(c, 0, 80, "Not yet", () => this.closeOverlay(), 240);
  };

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
        .text(0, -140, gameState.save.freedomWon ? "Free men play. Rufus leans on the rail." : "Free men play. Pick a game.", {
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
    audio.sfx("dice");
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
    audio.sfx("card");
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
    audio.sfx("card");
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

  openShrine(): void {
    const c = this.box(720, 640, "SHRINE");
    const active = getPatron(gameState.save.activePrayer);
    c.add(
      this.add
        .text(0, -268, active ? `${active.name} walks with you.` : "No prayer. One blessing, until you fall.", {
          fontFamily: "Georgia",
          fontSize: "15px",
          color: "#d4a84b",
        })
        .setOrigin(0.5),
    );
    PATRONS.forEach((p, i) => {
      const y = -220 + i * 46;
      const unlocked = patronUnlocked(p.id);
      const selected = gameState.save.activePrayer === p.id;
      const card = this.add
        .rectangle(0, y, 620, 42, selected ? 0x3a281c : 0x1a1210, 0.96)
        .setStrokeStyle(selected ? 2 : 1, selected ? COLORS.gold : unlocked ? 0x6a5a3a : 0x3a3028);
      const name = this.add
        .text(-292, y - 8, p.name, {
          fontFamily: "Cinzel, Georgia",
          fontSize: "16px",
          color: unlocked ? "#e8dcc8" : "#6a5a4a",
        })
        .setOrigin(0, 0.5);
      const detail = this.add
        .text(-292, y + 10, unlocked ? p.blessing : patronLockHint(p), {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: selected ? "#8ecf6a" : unlocked ? "#d4a84b" : "#6a5a4a",
        })
        .setOrigin(0, 0.5);
      c.add([card, name, detail]);
      if (unlocked) {
        card.setInteractive({ useHandCursor: true });
        card.on("pointerover", () => card.setFillStyle(0x4a3424));
        card.on("pointerout", () => card.setFillStyle(selected ? 0x3a281c : 0x1a1210));
        card.on("pointerdown", () => {
          prayTo(p.id);
          this.closeOverlay();
        });
      }
    });
    this.addBtn(c, 0, 280, "Close", () => this.closeOverlay(), 180);
  }

  openArmory(): void {
    const c = this.box(980, 600, "ARMORY");
    c.add(this.add.rectangle(0, -258, 920, 8, 0x6a2420, 0.9));
    c.add(this.add.rectangle(-310, 8, 280, 430, 0x241810, 0.72).setStrokeStyle(1, 0x8a6a3a, 0.5));
    const s = gameState.save;
    const cur = s.equippedWeapon ? getWeapon(s.equippedWeapon) : null;
    if (cur) {
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
    } else {
      c.add(
        this.add
          .text(-310, -40, "Empty hands", {
            fontFamily: "Cinzel, Georgia",
            fontSize: "22px",
            color: "#e8c96a",
          })
          .setOrigin(0.5),
      );
      c.add(
        this.add
          .text(-310, 20, "Take a gladius from the rack.\nThe yard waits for steel.", {
            fontFamily: "Georgia",
            fontSize: "15px",
            color: "#c4b49a",
            align: "center",
            wordWrap: { width: 250 },
          })
          .setOrigin(0.5, 0),
      );
    }

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
    if (gameState.save.lanistaUnlocked && this.gateTab === "school") {
      this.renderSchoolGate();
      return;
    }
    const rivals = rivalHouses();
    const showTourney = tournamentUnlocked() || gameState.save.freedomWon;
    const lanista = Boolean(gameState.save.lanistaUnlocked);
    const tabShift = lanista ? 44 : 0;
    if (!this.gateHouse) {
      if (gameState.save.freedomWon) ensureNight();
      const night = currentNight();
      const c = this.box(720, lanista ? 760 : 700, "ARENA GATE");
      if (lanista) this.addGateTabs(c, lanista ? 760 : 700);
      if (night) {
        c.add(
          this.add
            .text(0, -268 + tabShift, nightEditorLine(night), { fontFamily: "Cinzel, Georgia", fontSize: "15px", color: "#e8c96a" })
            .setOrigin(0.5),
        );
        c.add(
          this.add
            .text(0, -246 + tabShift, `${night.fighterName} of ${night.houseName}  ·  ${night.kind === "weapon" ? night.weaponName + "  ·  " : ""}+${night.bonusDenarii} denarii`, {
              fontFamily: "Georgia",
              fontSize: "14px",
              color: "#e8dcc8",
            })
            .setOrigin(0.5),
        );
        this.addBtn(c, 0, -210 + tabShift, "Enter tonight", () => {
          const ok = enterNight();
          if (ok === "locked") {
            this.toast("The armory still lacks that steel.");
            return;
          }
          if (ok !== "ok") {
            this.toast("The editor has no bout tonight.");
            return;
          }
          this.gateHouse = null;
          this.closeOverlay();
          bus.emit("enter-arena", night.opponentId);
        }, 220);
        c.add(
          this.add
            .text(0, -168 + tabShift, "Or rematch a house", { fontFamily: "Georgia", fontSize: "14px", color: "#c4b49a" })
            .setOrigin(0.5),
        );
      } else {
        c.add(this.add.text(0, -250 + tabShift, "Choose a house", { fontFamily: "Georgia", fontSize: "18px", color: "#e8dcc8" }).setOrigin(0.5));
      }
      const startY = (night ? -124 : -214) + tabShift;
      const pitch = 76;
      const btnOff = 34;
      rivals.forEach((h, i) => {
        const unlocked = isHouseUnlocked(h.id);
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? -188 : 188;
        const y = startY + row * pitch;
        const beaten = gameState.save.defeatedHouses.includes(h.id);
        c.add(this.add.text(x, y, `${h.latinName}${beaten ? "  (beaten)" : ""}`, { fontFamily: "Georgia", fontSize: "15px", color: unlocked ? "#e8dcc8" : "#6a5a4a" }).setOrigin(0.5));
        this.addBtn(c, x, y + btnOff, unlocked ? (beaten ? "Rematches" : "Enter") : "Locked", () => {
          if (!unlocked) {
            this.toast(houseLockHint(h.id));
            return;
          }
          this.gateHouse = h.id;
          this.openGate();
        }, 160);
      });
      const rows = Math.max(1, Math.ceil(rivals.length / 2));
      const lastBtnY = startY + (rows - 1) * pitch + btnOff;
      const rudisY = lastBtnY + 70;
      const stayY = showTourney ? rudisY + 52 : lastBtnY + 70;
      if (showTourney) {
        this.addBtn(c, 0, rudisY, gameState.save.freedomWon ? "The Rudis (rematch)" : "The Rudis", () => {
          this.gateHouse = TOURNAMENT_HOUSE.id;
          this.openGate();
        }, 180);
      }
      this.addBtn(c, 0, stayY, "Stay at the ludus", () => {
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
      if (!open) {
        const prev = house.fighters[i - 1];
        const hint = i <= 0 ? "Beat the previous house first." : `Beat ${prev?.name ?? "the previous fighter"} first.`;
        c.add(this.add.text(0, y + 22, hint, { fontFamily: "Georgia", fontSize: "13px", color: "#6a5a4a" }).setOrigin(0.5));
      }
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

  private addGateTabs(c: Phaser.GameObjects.Container, boxH: number): void {
    const y = -boxH / 2 + 64;
    this.addShopTab(c, -90, y, "Your steel", this.gateTab === "steel", () => {
      this.gateTab = "steel";
      this.gateHouse = null;
      this.schoolNpc = null;
      this.schoolHouse = null;
      this.openGate();
    });
    this.addShopTab(c, 90, y, "The School", this.gateTab === "school", () => {
      this.gateTab = "school";
      this.gateHouse = null;
      this.openGate();
    });
  }

  private renderSchoolGate(): void {
    if (!this.schoolNpc) {
      const c = this.box(760, 700, "ARENA GATE");
      this.addGateTabs(c, 700);
      c.add(
        this.add
          .text(0, -250, `Glory ${schoolGloryCount()}/${SCHOOL_IDS.length} · Order: Titus → Brom → Aelia → Rufus`, {
            fontFamily: "Georgia",
            fontSize: "15px",
            color: "#e8dcc8",
          })
          .setOrigin(0.5),
      );
      HOUSE_GLADIATORS.forEach((npc, i) => {
        const rec = getSchoolRecord(npc.id);
        const unlocked = schoolStudentUnlocked(npc.id);
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = col === 0 ? -190 : 190;
        const y = -170 + row * 168;
        const record = `${rec.wins}–${rec.losses}`;
        const readyChamp = schoolReadyForChampion(npc.id);
        const readyUnder = schoolReadyForUndercard(npc.id);
        const status = schoolReadinessLabel(npc.id);
        const need = schoolReadyNeeds(npc.id);
        const train = unlocked
          ? `Train ${rec.training}/${need.prideTraining} · Spec ${rec.specialty ?? 0}/3 · Lessons ${rec.lessons ?? 0}/${need.prideLessons}`
          : schoolUnlockHint(npc.id);
        const nameColor = rec.glory ? "#8ecf6a" : unlocked ? "#e8c96a" : "#6a5a4a";
        c.add(
          this.add
            .text(x, y, unlocked || rec.glory ? `${npc.name}` : `${npc.name}`, {
              fontFamily: "Cinzel, Georgia",
              fontSize: "18px",
              color: nameColor,
            })
            .setOrigin(0.5),
        );
        if (rec.glory) {
          c.add(this.add.text(x, y + 18, "DONE", { fontFamily: "Cinzel, Georgia", fontSize: "12px", color: "#8ecf6a" }).setOrigin(0.5));
        } else if (!unlocked) {
          c.add(this.add.text(x, y + 18, "LOCKED", { fontFamily: "Cinzel, Georgia", fontSize: "12px", color: "#6a5a4a" }).setOrigin(0.5));
        }
        c.add(
          this.add
            .text(x, y + (rec.glory || !unlocked ? 36 : 22), `${npc.title}  ·  ${getWeapon(npc.weapon).shortName}`, {
              fontFamily: "Georgia",
              fontSize: "14px",
              color: unlocked ? "#e8dcc8" : "#6a5a4a",
            })
            .setOrigin(0.5),
        );
        const statusY = rec.glory || !unlocked ? 56 : 42;
        c.add(
          this.add
            .text(x, statusY, rec.glory ? `Record ${record}` : `Record ${record}  ·  ${status}`, {
              fontFamily: "Georgia",
              fontSize: "13px",
              color: !unlocked ? "#6a5a4a" : rec.injured ? "#c07060" : readyChamp || rec.glory ? "#8ecf6a" : readyUnder ? "#e8c96a" : "#b8a890",
            })
            .setOrigin(0.5),
        );
        c.add(
          this.add
            .text(x, statusY + 18, rec.glory ? `Path 3/3` : train, {
              fontFamily: "Georgia",
              fontSize: "12px",
              color: unlocked ? "#b8a890" : "#6a5a4a",
              wordWrap: { width: 300 },
              align: "center",
            })
            .setOrigin(0.5),
        );
        if (!unlocked) {
          /* locked — no book */
        } else if (rec.injured) {
          const free = gameState.schoolFreeRestAvailable;
          this.addBtn(c, x, y + 92, free ? "Rest  ·  free" : `Rest  ·  ${REST_COST} denarii`, () => {
            const result = restSchoolInjury(npc.id);
            if (result === "ok" || result === "free") {
              this.toast(result === "free" ? `${npc.name} rests — first recovery is on the house.` : `${npc.name} rests. The limp leaves them.`);
            } else if (result === "poor") this.toast("Not enough denarii.");
            else this.toast("They are not injured.");
            this.openGate();
          }, 200);
        } else if (rec.glory) {
          this.addBtn(c, x, y + 92, "Exhibition", () => {
            this.schoolNpc = npc.id;
            this.schoolHouse = null;
            this.openGate();
          }, 160);
        } else {
          this.addBtn(c, x, y + 92, "Book fight", () => {
            this.schoolNpc = npc.id;
            this.schoolHouse = null;
            this.openGate();
          }, 160);
        }
      });
      this.addBtn(c, 0, 300, "Stay at the ludus", () => {
        this.schoolNpc = null;
        this.schoolHouse = null;
        this.closeOverlay();
      });
      return;
    }
    const student = getNpc(this.schoolNpc);
    const studentRec = getSchoolRecord(student.id);
    const circuit = getStudentCircuit(student.id);
    const foes = circuit?.fighters ?? [];
    const c = this.box(640, 620, "THE SCHOOL");
    c.add(
      this.add
        .text(0, -250, student.name, {
          fontFamily: "Cinzel, Georgia",
          fontSize: "22px",
          color: studentRec.glory ? "#8ecf6a" : "#e8c96a",
        })
        .setOrigin(0.5),
    );
    if (studentRec.glory) {
      c.add(this.add.text(0, -222, "DONE", { fontFamily: "Cinzel, Georgia", fontSize: "14px", color: "#8ecf6a" }).setOrigin(0.5));
    }
    c.add(
      this.add
        .text(0, studentRec.glory ? -198 : -218, circuit ? `${circuit.label} · Bout ${Math.min(3, studentRec.rung + 1)}/3` : "School path", {
          fontFamily: "Georgia",
          fontSize: "14px",
          color: "#b8a890",
        })
        .setOrigin(0.5),
    );
    if (!foes.length) {
      c.add(this.add.text(0, -40, "No school path for this student.", { fontFamily: "Georgia", fontSize: "16px", color: "#c4b49a" }).setOrigin(0.5));
    }
    foes.forEach((f, i) => {
      const y = -168 + i * 98;
      const cleared = studentRec.rung > i || studentRec.glory;
      const gate = schoolBoutLocked(student.id, i);
      const exhibition = studentRec.glory;
      const locked = exhibition ? false : gate.locked;
      const compare = schoolPowerCompare(student.id, f.id);
      const chanceColor = locked ? "#6a5a4a" : schoolWinChanceColor(compare.chance);
      const step = schoolCircuitRungLabel(i);
      c.add(
        this.add
          .text(0, y, `${i + 1}. ${step}  ·  ${f.name}${cleared && !exhibition ? "  ✓" : ""}`, {
            fontFamily: "Georgia",
            fontSize: "15px",
            color: locked ? "#6a5a4a" : cleared && !exhibition ? "#8ecf6a" : "#e8dcc8",
          })
          .setOrigin(0.5),
      );
      c.add(
        this.add
          .text(0, y + 16, `Them HP ${compare.foe.maxHealth} / ATK ${compare.foe.attack}`, {
            fontFamily: "Georgia",
            fontSize: "12px",
            color: locked ? "#6a5a4a" : "#b8a890",
          })
          .setOrigin(0.5),
      );
      if (locked) {
        c.add(
          this.add
            .text(0, y + 34, gate.reason, {
              fontFamily: "Georgia",
              fontSize: "12px",
              color: "#6a5a4a",
            })
            .setOrigin(0.5),
        );
      } else if (cleared && !exhibition) {
        c.add(this.add.text(0, y + 34, "Cleared", { fontFamily: "Georgia", fontSize: "12px", color: "#8ecf6a" }).setOrigin(0.5));
      } else {
        c.add(
          this.add
            .text(0, y + 34, `~${compare.chance}% to win  ·  ${compare.match}`, {
              fontFamily: "Georgia",
              fontSize: "13px",
              color: chanceColor,
            })
            .setOrigin(0.5),
        );
        this.addBtn(c, 0, y + 58, exhibition ? "Exhibition" : i === 2 ? "Send — pride" : "Send", () => {
          gameState.pendingSchoolBout = { npcId: student.id, opponentId: f.id };
          gameState.pendingArenaOpponent = f.id;
          this.gateHouse = null;
          this.schoolNpc = null;
          this.schoolHouse = null;
          this.closeOverlay();
          bus.emit("enter-arena", f.id);
        }, 200);
      }
    });

    if (!studentRec.glory && schoolStudentUnlocked(student.id) && !studentRec.injured) {
      ensureNight();
      const night = currentNight();
      if (night && schoolReadyForUndercard(student.id)) {
        const nightChance = schoolWinChance(student.id, night.opponentId);
        c.add(
          this.add
            .text(0, 168, `Night  ·  ~${nightChance}% to win`, {
              fontFamily: "Georgia",
              fontSize: "12px",
              color: schoolWinChanceColor(nightChance),
            })
            .setOrigin(0.5),
        );
        this.addBtn(c, 0, 198, "Send to night", () => {
          gameState.pendingSchoolBout = { npcId: student.id, opponentId: night.opponentId };
          const r = enterNight();
          if (r !== "ok") {
            gameState.pendingSchoolBout = null;
            this.toast(r === "locked" ? "Night is locked." : "No night bout.");
            return;
          }
          this.gateHouse = null;
          this.schoolNpc = null;
          this.schoolHouse = null;
          this.closeOverlay();
          bus.emit("enter-arena", night.opponentId);
        }, 200);
      }
    }

    this.addBtn(c, -120, 262, "Students", () => {
      this.schoolNpc = null;
      this.schoolHouse = null;
      this.openGate();
    }, 180);
    this.addBtn(c, 120, 262, "Stay at the ludus", () => {
      this.schoolNpc = null;
      this.schoolHouse = null;
      this.closeOverlay();
    }, 200);
  }

  openLocker = (id: unknown): void => {
    if (typeof id !== "string" || !isSchoolNpc(id)) return;
    const npc = getNpc(id);
    const rec = getSchoolRecord(id);
    const focus = SCHOOL_FOCUS[id as SchoolNpcId];
    const foeId = schoolNextFoeId(id);
    const unlocked = schoolStudentUnlocked(id);
    const need = schoolReadyNeeds(id);
    const c = this.box(600, 580, "LOCKER");
    c.add(this.add.text(0, -245, npc.name, { fontFamily: "Cinzel, Georgia", fontSize: "26px", color: unlocked || rec.glory ? "#e8c96a" : "#6a5a4a" }).setOrigin(0.5));
    if (rec.glory) {
      c.add(this.add.text(0, -214, "DONE", { fontFamily: "Cinzel, Georgia", fontSize: "16px", color: "#8ecf6a" }).setOrigin(0.5));
      c.add(
        this.add
          .text(0, -188, `Act goal complete · Glory ${schoolGloryCount()}/${SCHOOL_IDS.length}`, {
            fontFamily: "Georgia",
            fontSize: "14px",
            color: "#8ecf6a",
          })
          .setOrigin(0.5),
      );
      schoolReadyChecklist(id).forEach((item, i) => {
        c.add(
          this.add
            .text(0, -150 + i * 24, `${item.ok ? "✓" : "○"}  ${item.label}`, {
              fontFamily: "Georgia",
              fontSize: "13px",
              color: item.ok ? "#8ecf6a" : "#b8a890",
            })
            .setOrigin(0.5),
        );
      });
      c.add(this.add.text(0, 20, "Exhibition bouts only.", { fontFamily: "Georgia", fontSize: "14px", color: "#b8a890" }).setOrigin(0.5));
      this.addBtn(c, 0, 90, "Exhibition", () => {
        this.gateTab = "school";
        this.schoolNpc = id;
        this.schoolHouse = null;
        this.openGate();
      }, 180);
      this.addBtn(c, 0, 160, "Close", () => this.closeOverlay(), 160);
      return;
    }

    c.add(this.add.text(0, -214, focus.specialty, { fontFamily: "Georgia", fontSize: "15px", color: "#e8dcc8" }).setOrigin(0.5));
    c.add(this.add.text(0, -190, focus.line, { fontFamily: "Georgia", fontSize: "13px", color: "#b8a890" }).setOrigin(0.5));
    c.add(
      this.add
        .text(0, -160, `Training  ${meterBar(rec.training, 6)}  ${rec.training}/${need.prideTraining}`, {
          fontFamily: "Georgia",
          fontSize: "14px",
          color: "#e8dcc8",
        })
        .setOrigin(0.5),
    );
    c.add(
      this.add
        .text(0, -138, `Lessons  ${rec.lessons ?? 0}/${need.prideLessons}  ·  Path ${Math.min(3, rec.rung)}/3  ·  ${rec.wins}–${rec.losses}`, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#b8a890",
        })
        .setOrigin(0.5),
    );

    const readyLabel = schoolReadinessLabel(id);
    const readyColor = !unlocked ? "#6a5a4a" : schoolReadyForChampion(id) ? "#8ecf6a" : schoolReadyForUndercard(id) ? "#e8c96a" : "#c07060";
    c.add(this.add.text(0, -108, readyLabel, { fontFamily: "Cinzel, Georgia", fontSize: "16px", color: readyColor }).setOrigin(0.5));
    if (unlocked) {
      c.add(this.add.text(0, -84, "SPAR adds Training · Teach adds Lessons", { fontFamily: "Georgia", fontSize: "12px", color: "#9a8a78" }).setOrigin(0.5));
    }
    schoolReadyChecklist(id).forEach((item, i) => {
      c.add(
        this.add
          .text(0, -55 + i * 20, `${item.ok ? "✓" : "○"}  ${item.label}`, {
            fontFamily: "Georgia",
            fontSize: "13px",
            color: item.ok ? "#8ecf6a" : "#b8a890",
          })
          .setOrigin(0.5),
      );
    });

    if (!unlocked) {
      c.add(
        this.add
          .text(0, 50, schoolUnlockHint(id), {
            fontFamily: "Georgia",
            fontSize: "14px",
            color: "#c07060",
            align: "center",
            wordWrap: { width: 480 },
          })
          .setOrigin(0.5),
      );
    } else if (rec.injured) {
      c.add(this.add.text(0, 40, "Injured — rest them before booking.", { fontFamily: "Georgia", fontSize: "14px", color: "#c07060" }).setOrigin(0.5));
    } else if (foeId) {
      const rival = schoolPowerCompare(id, foeId);
      const foe = getRival(foeId)?.fighter;
      const step = schoolCircuitRungLabel(Math.min(2, rec.rung));
      c.add(
        this.add
          .text(0, 38, foe ? `Next: ${step} · ${foe.name}` : "Next school foe", {
            fontFamily: "Georgia",
            fontSize: "14px",
            color: "#e8c96a",
          })
          .setOrigin(0.5),
      );
      c.add(
        this.add
          .text(0, 58, `Them HP ${rival.foe.maxHealth} / ATK ${rival.foe.attack}  ·  ${rival.match}`, {
            fontFamily: "Georgia",
            fontSize: "13px",
            color: "#b8a890",
          })
          .setOrigin(0.5),
      );
      c.add(
        this.add
          .text(0, 78, `~${rival.chance}% to win  ·  more lessons and training raise this`, {
            fontFamily: "Georgia",
            fontSize: "13px",
            color: schoolWinChanceColor(rival.chance),
          })
          .setOrigin(0.5),
      );
    }

    if (rec.injured && unlocked) {
      const free = gameState.schoolFreeRestAvailable;
      this.addBtn(c, 0, 130, free ? "Rest  ·  free" : `Rest  ·  ${REST_COST} denarii`, () => {
        const result = restSchoolInjury(id);
        if (result === "ok" || result === "free") this.toast(result === "free" ? `${npc.name} rests — on the house.` : `${npc.name} rests.`);
        else if (result === "poor") this.toast("Not enough denarii.");
        this.openLocker(id);
      }, 220);
    } else if (unlocked) {
      this.addBtn(c, -140, 155, "Teach", () => {
        this.closeOverlay();
        bus.emit("teach-start", id);
      }, 160);
      this.addBtn(c, 140, 155, "Book fight", () => {
        this.gateTab = "school";
        this.schoolNpc = id;
        this.schoolHouse = null;
        this.openGate();
      }, 160);
    }
    this.addBtn(c, 0, 215, "Close", () => this.closeOverlay(), 160);
  };


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

  openRaidTitle = (payload: { title: string; subtitle?: string; holdMs?: number; onDone?: () => void }): void => {
    this.dismissRaidTitle(true);
    this.raidTitleDone = payload.onDone;
    gameState.paused = true;
    const c = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20).setDepth(3200).setScrollFactor(0);
    const veil = this.add.rectangle(0, 20, GAME_WIDTH, GAME_HEIGHT, 0x040810, 0.45).setScrollFactor(0);
    const plate = this.add.rectangle(0, 0, 520, 110, 0x121820, 0.94).setStrokeStyle(2, 0x7ab8a4);
    const title = this.add
      .text(0, -18, payload.title, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "28px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 5,
      })
      .setOrigin(0.5);
    const sub = this.add
      .text(0, 22, payload.subtitle ?? "", {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#9ab8c8",
      })
      .setOrigin(0.5);
    const hint = this.add
      .text(0, 48, "Space / E", {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: "#6a7a88",
      })
      .setOrigin(0.5)
      .setAlpha(payload.holdMs && payload.holdMs < 900 ? 0 : 0.85);
    c.add([veil, plate, title, sub, hint]);
    c.setAlpha(0);
    this.raidTitleBox = c;
    this.tweens.add({ targets: c, alpha: 1, duration: 220 });
    const hold = payload.holdMs ?? 1200;
    this.raidTitleTimer = this.time.delayedCall(hold, () => this.dismissRaidTitle());
  };

  private dismissRaidTitle = (silent = false): void => {
    if (this.raidTitleTimer) {
      this.raidTitleTimer.remove(false);
      this.raidTitleTimer = undefined;
    }
    if (!this.raidTitleBox && !this.raidTitleDone) return;
    this.raidTitleBox?.destroy();
    this.raidTitleBox = null;
    if (!silent) {
      gameState.paused = false;
      const done = this.raidTitleDone;
      this.raidTitleDone = undefined;
      done?.();
    } else {
      this.raidTitleDone = undefined;
    }
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
      this.flushActCard();
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

    const wrapW = 540;
    const probe = this.add
      .text(-9999, -9999, payload.body, {
        fontFamily: "Georgia",
        fontSize: "17px",
        wordWrap: { width: wrapW },
        align: "center",
      })
      .setOrigin(0.5, 0);
    const measured = probe.height;
    probe.destroy();

    const header = 72;
    const footer = 76;
    const gap = 20;
    const tall = Math.min(GAME_HEIGHT - 48, Math.max(340, header + measured + gap + footer));
    const c = this.box(660, tall, payload.title);
    this.resultPending = true;
    gameState.paused = true;
    gameState.inMenu = true;

    const bodyTop = -tall / 2 + header;
    const btnY = tall / 2 - 42;
    const maxBodyH = Math.max(80, btnY - 28 - bodyTop);

    let fontSize = 17;
    const body = this.add
      .text(0, bodyTop, payload.body, {
        fontFamily: "Georgia",
        fontSize: `${fontSize}px`,
        color: "#e8dcc8",
        wordWrap: { width: wrapW },
        align: "center",
      })
      .setOrigin(0.5, 0);
    while (body.height > maxBodyH && fontSize > 13) {
      fontSize -= 1;
      body.setStyle({ fontSize: `${fontSize}px` });
    }
    if (body.height > maxBodyH) {
      body.setCrop(0, 0, Math.ceil(body.width), Math.floor(maxBodyH));
    }
    c.add(body);
    const action = payload.action ?? "Continue";
    this.addBtn(c, 0, btnY, action, () => this.finishResult(), 280);
    c.add(
      this.add
        .text(0, btnY + 36, "Returns on its own in a moment — or click / Space", {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#9a8a78",
        })
        .setOrigin(0.5),
    );
    this.dimmer?.setDepth(1998);
    this.dimmer?.on("pointerdown", () => this.finishResult());
    if (this.resultAutoTimer != null) clearTimeout(this.resultAutoTimer);
    this.resultAutoTimer = setTimeout(() => this.finishResult(), 2400);
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
    const callSub = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 68, missio ? "MERCY" : "STEEL", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "22px",
        color: missio ? "#e8dcc8" : "#e8b0a8",
        stroke: "#1a1210",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3501);
    audio.sfx(missio ? "missio" : "crowd");
    this.tweens.add({
      targets: [this.perfectFlash, this.perfectText, callSub],
      alpha: 0,
      delay: 280,
      duration: 900,
      onComplete: () => {
        this.perfectFlash?.destroy();
        this.perfectText?.destroy();
        callSub.destroy();
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
    const followMercy = followAct === "Mercy";
    const defyMercy = defyAct === "Mercy";
    const y = GAME_HEIGHT / 2 + 92;
    const header = this.add
      .text(GAME_WIDTH / 2, y - 64, crowdMissio ? "THE CROWD CALLS MISSIO" : "THE CROWD CALLS IUGULA", {
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
      .text(GAME_WIDTH / 2, y - 34, crowdMissio ? "They beg for life — follow, or defy." : "They demand death — follow, or defy.", {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#e8dcc8",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3600);
    const followBg = this.add
      .rectangle(GAME_WIDTH / 2 - 150, y + 34, 236, 88, followMercy ? 0x3a2e18 : 0x3a1814, 0.96)
      .setStrokeStyle(3, followMercy ? COLORS.gold : 0xe07060)
      .setScrollFactor(0)
      .setDepth(3600)
      .setInteractive({ useHandCursor: true });
    const followLabel = this.add
      .text(GAME_WIDTH / 2 - 150, y + 12, followAct.toUpperCase(), {
        fontFamily: "Cinzel, Georgia",
        fontSize: "26px",
        color: followMercy ? "#ffe08a" : "#e07060",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    const followHint = this.add
      .text(GAME_WIDTH / 2 - 150, y + 40, followMercy ? "Spare them" : "Finish them", {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    const followKey = this.add
      .text(GAME_WIDTH / 2 - 150, y + 60, "Follow the crowd  ·  E", {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: "#b8a890",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    const defyBg = this.add
      .rectangle(GAME_WIDTH / 2 + 150, y + 34, 236, 88, defyMercy ? 0x3a2e18 : 0x3a1814, 0.96)
      .setStrokeStyle(3, defyMercy ? COLORS.gold : 0xe07060)
      .setScrollFactor(0)
      .setDepth(3600)
      .setInteractive({ useHandCursor: true });
    const defyLabel = this.add
      .text(GAME_WIDTH / 2 + 150, y + 12, defyAct.toUpperCase(), {
        fontFamily: "Cinzel, Georgia",
        fontSize: "26px",
        color: defyMercy ? "#ffe08a" : "#e07060",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    const defyHint = this.add
      .text(GAME_WIDTH / 2 + 150, y + 40, defyMercy ? "Spare them" : "Finish them", {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    const defyKey = this.add
      .text(GAME_WIDTH / 2 + 150, y + 60, "Defy the crowd  ·  Q", {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: "#b8a890",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3601);
    followBg.on("pointerover", () => followBg.setFillStyle(followMercy ? 0x4a3a20 : 0x5a2420));
    followBg.on("pointerout", () => followBg.setFillStyle(followMercy ? 0x3a2e18 : 0x3a1814));
    followBg.on("pointerdown", () => this.pickJudgment(true));
    defyBg.on("pointerover", () => defyBg.setFillStyle(defyMercy ? 0x4a3a20 : 0x5a2420));
    defyBg.on("pointerout", () => defyBg.setFillStyle(defyMercy ? 0x3a2e18 : 0x3a1814));
    defyBg.on("pointerdown", () => this.pickJudgment(false));
    this.judgmentWrap = [header, sub, followBg, followLabel, followHint, followKey, defyBg, defyLabel, defyHint, defyKey];
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
    if (scene !== "ludus" && scene !== "freedcamp") this.minimapWrap?.setVisible(false);
  };

  private onMinimap = (payload: {
    show: boolean;
    cols: number;
    rows: number;
    playerX: number;
    playerY: number;
    area?: string;
    marks: { x: number; y: number; color: number; kind: string }[];
  }): void => {
    if (
      (this.minimapScene !== "ludus" && this.minimapScene !== "freedcamp") ||
      !gameState.settings.showMinimap ||
      !payload.show
    ) {
      this.minimapWrap?.setVisible(false);
      return;
    }
    const w = 168;
    const h = 126;
    const areaText = `${(payload.area ?? "Ludus").toUpperCase()}  ·  M`;
    if (!this.minimapWrap) {
      this.minimapWrap = this.add.container(16, GAME_HEIGHT - h - 14).setScrollFactor(0).setDepth(140);
      const bg = this.add.rectangle(w / 2, h / 2, w, h, 0x1a1210, 0.9).setStrokeStyle(2, COLORS.gold);
      this.minimapGfx = this.add.graphics();
      this.minimapLabel = this.add
        .text(w / 2, 8, areaText, { fontFamily: "Cinzel, Georgia", fontSize: "11px", color: "#d4a84b" })
        .setOrigin(0.5, 0);
      this.minimapWrap.add([bg, this.minimapGfx, this.minimapLabel]);
    } else {
      this.minimapLabel?.setText(areaText);
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
    // Mid-screen toasts bury result/dialogue copy — pin them high during arena or overlays
    const arenaUp =
      this.scene.isActive("ArenaScene") || this.scene.isPaused("ArenaScene") || this.scene.isSleeping("ArenaScene");
    const pinTop = this.resultPending || Boolean(this.overlay) || arenaUp || gameState.paused || gameState.inMenu;
    const y = pinTop ? 56 : GAME_HEIGHT / 2 - 80;
    const t = this.add
      .text(GAME_WIDTH / 2, y, msg, {
        fontFamily: "Georgia",
        fontSize: "18px",
        color: "#e8c96a",
        backgroundColor: "#1a1210ee",
        padding: { x: 16, y: 10 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(5000);
    this.tweens.add({ targets: t, alpha: 0, y: t.y - 24, delay: 1100, duration: 400, onComplete: () => t.destroy() });
  };

  showDrillHowto = (payload: {
    id: string;
    title: string;
    student: string;
    teaching: string;
    goal: string;
    steps: string[];
  }): void => {
    this.hideDrillHowto();
    this.lock(true);
    this.drillHowtoId = payload.id;
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0806, 0.72).setScrollFactor(0).setDepth(3500);
    const panel = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, 640, 460, 0x1a1210, 0.96)
      .setStrokeStyle(2, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(3501);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 195, payload.title, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "28px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3502);
    const role = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 160, `You are the teacher · ${payload.student} learns by watching`, {
        fontFamily: "Georgia",
        fontSize: "15px",
        color: "#e8c96a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3502);
    const teaching = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 118, payload.teaching, {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#c4b49a",
        align: "center",
        wordWrap: { width: 560 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3502);
    const goalLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 68, "WHAT TO DO", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "13px",
        color: "#9a8a78",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3502);
    const goal = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 42, payload.goal, {
        fontFamily: "Georgia",
        fontSize: "20px",
        color: "#fff4d8",
        align: "center",
        wordWrap: { width: 540 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3502);
    const steps: Phaser.GameObjects.GameObject[] = [];
    payload.steps.forEach((line, i) => {
      steps.push(
        this.add
          .text(GAME_WIDTH / 2 - 260, GAME_HEIGHT / 2 + 5 + i * 36, `${i + 1}.  ${line}`, {
            fontFamily: "Georgia",
            fontSize: "15px",
            color: "#e8dcc8",
            wordWrap: { width: 520 },
          })
          .setOrigin(0, 0)
          .setScrollFactor(0)
          .setDepth(3502),
      );
    });
    const beginBg = this.add
      .rectangle(GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2 + 165, 180, 44, 0x3a2a18, 1)
      .setStrokeStyle(2, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(3502)
      .setInteractive({ useHandCursor: true });
    const beginTxt = this.add
      .text(GAME_WIDTH / 2 - 100, GAME_HEIGHT / 2 + 165, "Show them", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "18px",
        color: "#e8c96a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3503);
    const cancelBg = this.add
      .rectangle(GAME_WIDTH / 2 + 100, GAME_HEIGHT / 2 + 165, 160, 44, 0x2a2018, 1)
      .setStrokeStyle(2, 0x6a5a48)
      .setScrollFactor(0)
      .setDepth(3502)
      .setInteractive({ useHandCursor: true });
    const cancelTxt = this.add
      .text(GAME_WIDTH / 2 + 100, GAME_HEIGHT / 2 + 165, "Cancel", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "18px",
        color: "#c4b49a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(3503);
    beginBg.on("pointerdown", () => {
      const id = this.drillHowtoId;
      this.hideDrillHowto();
      if (id) bus.emit("drill-begin", id);
    });
    cancelBg.on("pointerdown", () => this.hideDrillHowto());
    this.drillHowtoWrap = [
      dim,
      panel,
      title,
      role,
      teaching,
      goalLabel,
      goal,
      ...steps,
      beginBg,
      beginTxt,
      cancelBg,
      cancelTxt,
    ];
  };

  hideDrillHowto = (): void => {
    this.drillHowtoWrap.forEach((o) => o.destroy());
    this.drillHowtoWrap = [];
    this.drillHowtoId = null;
    if (!this.overlay && !this.dialogueBox && !this.actCardOpen && !this.judgmentOpen) this.lock(false);
  };

  showDrillHud = (payload: {
    title: string;
    sub: string;
    score: string;
    time: number;
    prompt?: string;
    demo?: boolean;
  }): void => {
    this.hideDrillHud();
    const y = 64;
    const bg = this.add
      .rectangle(GAME_WIDTH / 2, y + 48, 720, 118, 0x1a1210, 0.94)
      .setStrokeStyle(2, payload.demo ? 0x7ab8e8 : COLORS.gold)
      .setScrollFactor(0)
      .setDepth(2800);
    const title = this.add
      .text(GAME_WIDTH / 2, y, payload.title, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "22px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2801);
    const sub = this.add
      .text(GAME_WIDTH / 2, y + 26, payload.sub, {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#e8dcc8",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2801);
    this.drillHudPrompt = this.add
      .text(GAME_WIDTH / 2, y + 54, payload.prompt ?? "", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "22px",
        color: payload.demo ? "#9ec8f0" : "#fff4d8",
        stroke: "#1a1210",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2801);
    this.drillHudScore = this.add
      .text(GAME_WIDTH / 2, y + 86, `Shown  ${payload.score}`, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "16px",
        color: "#8ecf6a",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2801);
    const hint = this.add
      .text(GAME_WIDTH / 2, y + 104, "No timer — the circle waits for you · E cancels", {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: "#9a8a78",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(2801);
    this.drillHudWrap = [bg, title, sub, this.drillHudPrompt, this.drillHudScore, hint];
    this.drillHudTime = undefined;
  };

  hideDrillHud = (): void => {
    this.drillHudWrap.forEach((o) => o.destroy());
    this.drillHudWrap = [];
    this.drillHudScore = undefined;
    this.drillHudTime = undefined;
    this.drillHudPrompt = undefined;
  };

  onDrillScore = (payload: { score: string; time: number; prompt?: string }): void => {
    this.drillHudScore?.setText(`Shown  ${payload.score}`);
    if (payload.prompt != null) this.drillHudPrompt?.setText(payload.prompt);
  };

  showActCard = (act: ActId): void => {
    if (this.actCardOpen) return;
    if (this.overlay || this.resultPending || gameState.inDialogue || this.judgmentOpen || this.dialogueBox) {
      this.pendingActCard = act;
      return;
    }
    this.renderActCard(act);
  };

  private flushActCard(): void {
    if (this.pendingActCard == null) return;
    if (this.overlay || this.resultPending || gameState.inDialogue || this.judgmentOpen || this.dialogueBox || this.actCardOpen) {
      return;
    }
    const act = this.pendingActCard;
    this.pendingActCard = null;
    this.renderActCard(act);
  }

  private renderActCard(act: ActId): void {
    const meta = ACT_META[act];
    this.actCardOpen = true;
    this.actCardAct = act;
    this.lock(true);
    audio.sfx("ui");

    const dim = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0806, 0.82)
      .setScrollFactor(0)
      .setDepth(4500)
      .setAlpha(0)
      .setInteractive();
    const ruleTop = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 78, 280, 2, COLORS.gold, 0.85)
      .setScrollFactor(0)
      .setDepth(4501)
      .setAlpha(0);
    const ruleBot = this.add
      .rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 78, 280, 2, COLORS.gold, 0.85)
      .setScrollFactor(0)
      .setDepth(4501)
      .setAlpha(0);
    const actLabel = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 48, `ACT ${meta.roman}`, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "22px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(4502)
      .setAlpha(0);
    const title = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 4, meta.title.toUpperCase(), {
        fontFamily: "Cinzel, Georgia",
        fontSize: "48px",
        color: "#f0e6d2",
        stroke: "#1a1210",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(4502)
      .setAlpha(0)
      .setScale(0.92);
    const blurb = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 58, meta.blurb, {
        fontFamily: "Georgia",
        fontSize: "18px",
        color: "#c4b49a",
        stroke: "#1a1210",
        strokeThickness: 4,
        align: "center",
        wordWrap: { width: 520 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(4502)
      .setAlpha(0);
    const hint = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 118, "Continue  ·  Space / E", {
        fontFamily: "Georgia",
        fontSize: "14px",
        color: "#9a8a78",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(4502)
      .setAlpha(0);

    this.actCardWrap = [dim, ruleTop, ruleBot, actLabel, title, blurb, hint];
    dim.on("pointerdown", () => this.dismissActCard());

    this.tweens.add({ targets: dim, alpha: 0.82, duration: 320 });
    this.tweens.add({ targets: [ruleTop, ruleBot, actLabel], alpha: 1, duration: 420, delay: 120 });
    this.tweens.add({ targets: title, alpha: 1, scale: 1, duration: 480, delay: 200, ease: "Back.easeOut" });
    this.tweens.add({ targets: [blurb, hint], alpha: 1, duration: 400, delay: 360 });
  }

  private dismissActCard(silent = false): void {
    if (!this.actCardOpen && this.actCardWrap.length === 0) return;
    const act = this.actCardAct;
    this.actCardOpen = false;
    this.actCardAct = null;
    this.actCardWrap.forEach((o) => o.destroy());
    this.actCardWrap = [];
    if (!silent) {
      this.lock(false);
      gameState.paused = false;
      gameState.inMenu = false;
      if (act != null) bus.emit("act-card-done", act);
      this.flushActCard();
    }
  }

  private addAttackButton(): void {
    const x = GAME_WIDTH - 96;
    const y = GAME_HEIGHT - 96;
    this.lightBg = this.add
      .circle(x, y, 58, COLORS.crimson, 0.95)
      .setStrokeStyle(4, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(160)
      .setInteractive({ useHandCursor: true });
    this.lightLabel = this.add
      .text(x, y - 4, "LIGHT", {
        fontFamily: "Georgia",
        fontSize: "20px",
        color: "#e8dcc8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161);
    this.lightHint = this.add
      .text(x, y + 18, "or Space", {
        fontFamily: "Georgia",
        fontSize: "13px",
        color: "#d4a84b",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161);

    this.lightBg.on("pointerover", () => this.lightBg.setFillStyle(0xc44a38));
    this.lightBg.on("pointerout", () => this.lightBg.setFillStyle(COLORS.crimson));
    this.lightBg.on("pointerdown", () => {
      if (this.overlay || this.resultPending || this.judgmentOpen) return;
      if (this.raidTitleBox) {
        this.dismissRaidTitle();
        return;
      }
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
    this.heavyBg = this.add
      .circle(x, y, 44, 0x6a2a22, 0.95)
      .setStrokeStyle(3, COLORS.gold)
      .setScrollFactor(0)
      .setDepth(160)
      .setInteractive({ useHandCursor: true });
    this.heavyLabel = this.add
      .text(x, y - 4, "HEAVY", {
        fontFamily: "Georgia",
        fontSize: "16px",
        color: "#e8dcc8",
        fontStyle: "bold",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161);
    this.heavyHint = this.add
      .text(x, y + 16, `or ${prettyKey(mergedKeybinds().heavy)}`, {
        fontFamily: "Georgia",
        fontSize: "12px",
        color: "#d4a84b",
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(161);

    this.heavyBg.on("pointerover", () => this.heavyBg.setFillStyle(0x8a3a2c));
    this.heavyBg.on("pointerout", () => this.heavyBg.setFillStyle(0x6a2a22));
    this.heavyBg.on("pointerdown", () => {
      if (this.overlay || this.resultPending || this.judgmentOpen) return;
      if (this.raidTitleBox) {
        this.dismissRaidTitle();
        return;
      }
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
      if (this.raidTitleBox) {
        this.dismissRaidTitle();
        return;
      }
      if (this.dialogueBox) {
        this.advanceDialogue();
        return;
      }
      if (gameState.inDialogue || gameState.inMenu || gameState.paused) return;
      if (gameState.save.equippedWeapon !== "trident_net") return;
      bus.emit("player-special");
    });
  }

  private setCombatHud = (payload: { show: boolean }): void => {
    this.setCombatButtonsWanted(Boolean(payload?.show));
  };

  private setCombatButtonsWanted(show: boolean): void {
    if (this.combatButtonsWanted === show) return;
    this.combatButtonsWanted = show;
    this.refreshCombatButtons();
  }

  private refreshCombatButtons(): void {
    const show = this.combatButtonsWanted;
    this.lightBg?.setVisible(show);
    this.lightLabel?.setVisible(show);
    this.lightHint?.setVisible(show);
    this.heavyBg?.setVisible(show);
    this.heavyLabel?.setVisible(show);
    this.heavyHint?.setVisible(show);
    if (this.lightBg) {
      if (show) this.lightBg.setInteractive({ useHandCursor: true });
      else this.lightBg.disableInteractive();
    }
    if (this.heavyBg) {
      if (show) this.heavyBg.setInteractive({ useHandCursor: true });
      else this.heavyBg.disableInteractive();
    }
    this.setNetButton(show && arenaWeapon() === "trident_net");
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

  private openCampFarm = (mode: unknown = "crops"): void => {
    this.farmMode = mode === "stables" ? "stables" : "crops";
    const c = camp();
    const ids = this.farmMode === "stables" ? stablePlotIds() : cropPlotIds();
    const plots = c.farm.plots.filter((p) => ids.includes(p.id));
    const title = this.farmMode === "stables" ? "LIVESTOCK YARD" : "FARM PLOTS";
    const boxH = this.overlayMaxHeight(this.farmMode === "stables" ? 580 : 560);
    const half = boxH / 2;
    const box = this.box(680, boxH, title);

    if (this.farmMode === "stables" && !penUnlocked()) {
      box.add(
        this.add
          .text(0, -40, "Build a fenced corral by the farm. Animals roam freely inside.", {
            fontFamily: "Georgia",
            fontSize: "14px",
            color: "#b8a890",
            wordWrap: { width: 520 },
            align: "center",
          })
          .setOrigin(0.5),
      );
      this.addBtn(box, 0, 20, `Build pen (${PEN_BUY_COST}d)`, () => {
        const r = buyLivestockPen();
        if (r === "poor") this.toast("Not enough denarii.");
        else if (r === "owned") this.toast("Pen already built.");
        else {
          gameState.persist();
          bus.emit("denarii-changed");
          bus.emit("camp-refresh");
          this.toast("Livestock pen ready — visit the feed trough inside.");
          this.openCampFarm(this.farmMode);
        }
      }, 200);
      this.addBtn(box, 0, half - 36, "Close", () => this.closeOverlay(), 160);
      return;
    }

    if (this.farmMode === "stables") {
      const animals = (Object.keys(FARM_CROPS) as FarmCropId[]).filter((id) => FARM_CROPS[id].kind === "animal");
      const occupied = penOccupancy();
      const capacity = penCapacity();
      const raising = penAnimalPlots().filter((p) => p.state === "growing");
      const ready = penAnimalPlots().filter((p) => p.state === "ready");
      const canExpand = stablePlotIds().some((id) => !c.farm.plots.find((p) => p.id === id)?.unlocked);

      box.add(
        this.add
          .text(0, -half + 48, `Pen: ${occupied}/${capacity} animals · ready after one raid`, {
            fontFamily: "Georgia",
            fontSize: "13px",
            color: "#b8a890",
          })
          .setOrigin(0.5),
      );
      box.add(
        this.add
          .text(0, -half + 72, "Buy at the trough — they wander the yard on their own.", {
            fontFamily: "Georgia",
            fontSize: "12px",
            color: "#8a7a68",
          })
          .setOrigin(0.5),
      );

      let y = -half + 100;
      box.add(
        this.add.text(-280, y, "Buy animals", { fontFamily: "Cinzel, Georgia", fontSize: "14px", color: "#e8c96a" }).setOrigin(0, 0.5),
      );
      y += 28;
      animals.forEach((cropId, i) => {
        const def = FARM_CROPS[cropId];
        const unlocked = isCropUnlocked(cropId);
        const lockHint = animalUnlockHint(cropId) || cropUnlockHint(cropId);
        const col = i % 2;
        const row = Math.floor(i / 2);
        const bx = -120 + col * 240;
        const by = y + row * 38;
        this.addBtn(box, bx, by, unlocked ? `${def.name} ${def.cost}d` : `${def.name} 🔒`, () => {
          if (!unlocked) {
            this.toast(lockHint || "Not unlocked yet.");
            return;
          }
          const r = buyPenAnimal(cropId);
          if (r === "poor") this.toast("Not enough denarii.");
          else if (r === "full") this.toast("Pen full — expand or harvest first.");
          else if (r === "need_pen") this.toast("Build the pen first.");
          else if (r !== "ok") this.toast("Cannot buy.");
          else {
            gameState.persist();
            bus.emit("denarii-changed");
            bus.emit("camp-refresh");
            this.toast(`${def.name} joins the yard — ready after one raid.`);
            this.openCampFarm(this.farmMode);
          }
        }, 150);
      });
      y += Math.ceil(animals.length / 2) * 38 + 16;

      if (ready.length > 0) {
        box.add(
          this.add.text(-280, y, "Ready to harvest", { fontFamily: "Cinzel, Georgia", fontSize: "14px", color: "#8ecf6a" }).setOrigin(0, 0.5),
        );
        y += 28;
        ready.forEach((plot, i) => {
          const name = FARM_CROPS[plot.cropId!].name;
          this.addBtn(box, 0, y + i * 36, `Harvest ${name}`, () => {
            harvestPlot(plot.id);
            gameState.persist();
            bus.emit("camp-refresh");
            this.toast(`${name} added to pantry.`);
            this.openCampFarm(this.farmMode);
          }, 200);
        });
        y += ready.length * 36 + 12;
      }

      if (raising.length > 0) {
        box.add(
          this.add
            .text(-280, y, `Raising: ${raising.map((p) => FARM_CROPS[p.cropId!].name).join(", ")}`, {
              fontFamily: "Georgia",
              fontSize: "13px",
              color: "#e8c96a",
            })
            .setOrigin(0, 0.5),
        );
        y += 24;
      }

      if (canExpand) {
        this.addBtn(box, 0, half - 72, `Expand pen (+1 slot, ${PLOT_BUY_COST}d)`, () => {
          const r = buyNextPlot("stables");
          if (r === "poor") this.toast("Not enough denarii.");
          else if (r === "max") this.toast("Pen at max size.");
          else {
            gameState.persist();
            bus.emit("denarii-changed");
            bus.emit("camp-refresh");
            this.toast("Pen expanded.");
            this.openCampFarm(this.farmMode);
          }
        }, 260);
      }

      const pantryLine =
        c.farm.pantry.length === 0
          ? "Pantry empty"
          : c.farm.pantry.map((p) => `${FARM_CROPS[p.cropId].name}×${p.count}`).join("  ·  ");
      box.add(
        this.add
          .text(0, half - 40, pantryLine, { fontFamily: "Georgia", fontSize: "13px", color: "#8ecf6a", wordWrap: { width: 620 } })
          .setOrigin(0.5),
      );
      this.addBtn(box, 0, half - 8, "Close", () => this.closeOverlay(), 160);
      return;
    }

    const hint = "Plant crops → march once → harvest. Honey and grapes unlock with more freed houses.";
    const crops = (Object.keys(FARM_CROPS) as FarmCropId[]).filter((id) => FARM_CROPS[id].kind === "crop");
    box.add(
      this.add
        .text(0, -half + 48, hint, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#b8a890",
          wordWrap: { width: 520 },
          align: "center",
        })
        .setOrigin(0.5),
    );
    const rowH = 100;
    const startY = -half + 88;
    plots.forEach((plot, i) => {
      const y = startY + i * rowH;
      if (y + rowH / 2 > half - 80) return;
      const label = `Plot ${i + 1}`;
      const status = !plot.unlocked
        ? "Locked"
        : plot.state === "empty"
          ? "Empty"
          : plot.state === "growing"
            ? `Growing ${FARM_CROPS[plot.cropId!].name}`
            : `Ready ${FARM_CROPS[plot.cropId!].name}`;
      box.add(
        this.add
          .text(-220, y, `${label}  ·  ${status}`, {
            fontFamily: "Georgia",
            fontSize: "14px",
            color: plot.unlocked ? "#e8dcc8" : "#6a5a4a",
          })
          .setOrigin(0, 0.5),
      );
      if (!plot.unlocked) {
        this.addBtn(box, 160, y, `Buy ${PLOT_BUY_COST}d`, () => {
          const r = buyNextPlot("crops");
          if (r === "poor") this.toast("Not enough denarii.");
          else if (r === "max") this.toast("All plots owned.");
          else {
            gameState.persist();
            bus.emit("denarii-changed");
            bus.emit("camp-refresh");
            this.openCampFarm(this.farmMode);
          }
        }, 140);
      } else if (plot.state === "empty") {
        crops.forEach((cropId, ci) => {
          const def = FARM_CROPS[cropId];
          const unlocked = isCropUnlocked(cropId);
          const lockHint = animalUnlockHint(cropId) || cropUnlockHint(cropId);
          const cols = Math.min(crops.length, 4);
          const colW = 150;
          const row = Math.floor(ci / cols);
          const col = ci % cols;
          const bx = -80 + col * colW - ((cols - 1) * colW) / 2;
          const by = y + 28 + row * 34;
          this.addBtn(box, bx, by, unlocked ? `${def.name} ${def.cost}d` : `${def.name} 🔒`, () => {
            if (!unlocked) {
              this.toast(lockHint || "Not unlocked yet.");
              return;
            }
            const r = plantPlot(plot.id, cropId);
            if (r === "poor") this.toast("Not enough denarii.");
            else if (r === "wrong") this.toast("Crops only on farm beds.");
            else if (r !== "ok") this.toast("Cannot plant.");
            else {
              gameState.persist();
              bus.emit("denarii-changed");
              bus.emit("camp-refresh");
              this.toast(`${def.name} started — ready after one raid.`);
              this.openCampFarm(this.farmMode);
            }
          }, 138);
        });
      } else if (plot.state === "ready") {
        this.addBtn(box, 160, y, "Harvest", () => {
          harvestPlot(plot.id);
          gameState.persist();
          bus.emit("camp-refresh");
          this.toast("Added to pantry.");
          this.openCampFarm(this.farmMode);
        }, 120);
      } else {
        box.add(
          this.add.text(160, y, "After next raid", { fontFamily: "Georgia", fontSize: "13px", color: "#e8c96a" }).setOrigin(0.5),
        );
      }
    });
    const pantryLine =
      c.farm.pantry.length === 0
        ? "Pantry empty"
        : c.farm.pantry.map((p) => `${FARM_CROPS[p.cropId].name}×${p.count}`).join("  ·  ");
    box.add(
      this.add
        .text(0, half - 72, pantryLine, { fontFamily: "Georgia", fontSize: "13px", color: "#8ecf6a", wordWrap: { width: 620 } })
        .setOrigin(0.5),
    );
    this.addBtn(box, 0, half - 36, "Close", () => this.closeOverlay(), 160);
  };

  private openCampParty = (): void => {
    const c = camp();
    const volGroups = volunteersGroupedByHouse();
    const volCount = c.volunteersUnlocked.length;
    const split = volCount > 0;
    const boxW = split ? 920 : 680;
    const boxH = 620;
    const box = this.box(boxW, boxH, "PARTY");
    const cx = split ? -250 : 0;
    const closeY = boxH / 2 - 36;

    box.add(
      this.add
        .text(cx, -270, "Pick two allies for the march.", {
          fontFamily: "Georgia",
          fontSize: "14px",
          color: "#b8a890",
        })
        .setOrigin(split ? 0 : 0.5, 0.5),
    );

    const selected = [...c.party] as CompanionId[];
    COMPANION_IDS.forEach((id, i) => {
      const def = getCompanionDef(id);
      const on = selected.includes(id);
      const y = -235 + i * 40;
      box.add(
        this.add
          .text(cx - (split ? 0 : 220), y, `${def.name}  ·  ${def.title}`, {
            fontFamily: "Georgia",
            fontSize: "15px",
            color: on ? "#e8c96a" : "#e8dcc8",
          })
          .setOrigin(0, 0.5),
      );
      this.addBtn(box, cx + (split ? 200 : 180), y, on ? "Selected" : "Select", () => {
        if (on) {
          if (selected.length <= 1) {
            this.toast("Need two allies.");
            return;
          }
          const next = selected.filter((x) => x !== id);
          while (next.length < 2) {
            const fill = COMPANION_IDS.find((x) => !next.includes(x));
            if (!fill) break;
            next.push(fill);
          }
          setParty(next[0], next[1]);
        } else {
          if (selected.length >= 2) selected.shift();
          selected.push(id);
          setParty(selected[0], selected[1]);
        }
        gameState.persist();
        bus.emit("camp-refresh");
        this.openCampParty();
      }, 130);
    });

    box.add(
      this.add
        .text(cx + (split ? 100 : 0), -30, `Marching: ${c.party.map((id) => getCompanionDef(id).name).join(" + ")}`, {
          fontFamily: "Cinzel, Georgia",
          fontSize: "15px",
          color: "#8ecf6a",
        })
        .setOrigin(split ? 0 : 0.5, 0.5),
    );

    if (palUnlocked()) {
      const animal = palAnimalName();
      box.add(
        this.add
          .text(
            cx + (split ? 100 : 0),
            0,
            palBrought()
              ? `${palDisplayName()} (${animal}) marches.`
              : `${palDisplayName()} (${animal}) at roost.`,
            {
              fontFamily: "Georgia",
              fontSize: "13px",
              color: "#c4b49a",
            },
          )
          .setOrigin(split ? 0 : 0.5, 0.5),
      );
      this.addBtn(
        box,
        cx + (split ? 100 : 0),
        36,
        palBrought() ? "Leave pal at roost" : "Bring pal",
        () => {
          togglePalBrought();
          bus.emit("camp-refresh");
          this.openCampParty();
        },
        split ? 180 : 240,
      );
    } else {
      box.add(
        this.add
          .text(cx + (split ? 100 : 0), 8, "No house pal yet.", {
            fontFamily: "Georgia",
            fontSize: "12px",
            color: "#8a7a68",
          })
          .setOrigin(split ? 0 : 0.5, 0.5),
      );
    }

    if (split) {
      const rx = 250;
      box.add(this.add.rectangle(rx - 10, 0, 2, boxH - 80, 0x5a4a38, 0.55).setOrigin(0.5, 0.5));
      box.add(
        this.add
          .text(rx, -270, "House ally (optional)", {
            fontFamily: "Cinzel, Georgia",
            fontSize: "15px",
            color: "#b8a890",
          })
          .setOrigin(0.5, 0.5),
      );
      box.add(
        this.add
          .text(rx, -240, `Selected: ${volunteerDisplayLine(c.houseVolunteer)}`, {
            fontFamily: "Georgia",
            fontSize: "13px",
            color: "#8ecf6a",
          })
          .setOrigin(0.5, 0.5),
      );
      this.addBtn(box, rx, -205, c.houseVolunteer ? "Clear ally" : "None", () => {
        setHouseVolunteer(null);
        gameState.persist();
        bus.emit("camp-refresh");
        this.openCampParty();
      }, 140);

      let tabHouse = this.partyVolTab;
      if (c.houseVolunteer) {
        const fromSel = volunteerHouseId(c.houseVolunteer);
        if (fromSel) tabHouse = fromSel;
      }
      if (!tabHouse || !volGroups.some((g) => g.houseId === tabHouse)) {
        tabHouse = volGroups[0]?.houseId ?? null;
      }
      this.partyVolTab = tabHouse;

      box.add(
        this.add
          .text(rx, -170, "Choose by house:", {
            fontFamily: "Georgia",
            fontSize: "12px",
            color: "#8a7a68",
          })
          .setOrigin(0.5, 0.5),
      );
      volGroups.forEach((group, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const short = raidHouseShortName(group.houseId);
        const active = tabHouse === group.houseId;
        this.addBtn(box, rx - 80 + col * 80, -140 + row * 36, active ? `● ${short}` : short, () => {
          this.partyVolTab = group.houseId;
          this.openCampParty();
        }, 72);
      });

      const activeGroup = volGroups.find((g) => g.houseId === tabHouse);
      if (activeGroup) {
        box.add(
          this.add
            .text(rx, -20, raidHouseShortName(activeGroup.houseId), {
              fontFamily: "Cinzel, Georgia",
              fontSize: "14px",
              color: "#e8dcc8",
            })
            .setOrigin(0.5, 0.5),
        );
        activeGroup.ids.forEach((vid, i) => {
          const def = getVolunteerDef(vid);
          if (!def) return;
          const on = c.houseVolunteer === vid;
          this.addBtn(box, rx, 18 + i * 44, on ? `● ${def.name}` : def.name, () => {
            setHouseVolunteer(on ? null : vid);
            gameState.persist();
            bus.emit("camp-refresh");
            this.openCampParty();
          }, 200);
        });
      }
    }

    this.addBtn(box, 0, closeY, "Close", () => this.closeOverlay(), 160);
  };

  private openCampLoadout = (): void => {
    const tabs: (CompanionId | "player")[] = ["player", ...COMPANION_IDS];
    const isPlayer = this.campLoadoutId === "player";
    const box = this.box(720, isPlayer ? 520 : 640, isPlayer ? "ARMORY" : "LOADOUT");
    tabs.forEach((cid, i) => {
      const label = cid === "player" ? "You" : getCompanionDef(cid).name.split(" ")[0];
      const active = this.campLoadoutId === cid;
      this.addBtn(box, -300 + i * 100, -270, active ? `● ${label}` : label, () => {
        this.campLoadoutId = cid;
        this.openCampLoadout();
      }, 88);
    });

    if (isPlayer) {
      const s = gameState.save;
      const cur = s.equippedWeapon ? getWeapon(s.equippedWeapon) : null;
      box.add(
        this.add
          .text(0, -220, cur ? `${cur.name}` : "Empty hands", {
            fontFamily: "Cinzel, Georgia",
            fontSize: "20px",
            color: "#e8c96a",
          })
          .setOrigin(0.5),
      );
      if (cur) {
        box.add(
          this.add
            .text(0, -188, `Light  ${cur.light.name}  ·  Heavy  ${cur.heavy.name}`, {
              fontFamily: "Georgia",
              fontSize: "14px",
              color: "#e8dcc8",
            })
            .setOrigin(0.5),
        );
      }
      WEAPON_ORDER.forEach((id, i) => {
        const w = getWeapon(id);
        const unlocked = s.unlockedWeapons.includes(id);
        const equipped = s.equippedWeapon === id;
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = -200 + col * 200;
        const y = -130 + row * 52;
        if (!unlocked || !w.playable) return;
        this.addBtn(box, x, y, equipped ? `● ${w.shortName}` : w.shortName, () => {
          s.equippedWeapon = id;
          gameState.persist();
          bus.emit("weapon-changed", id);
          this.openCampLoadout();
        }, 160);
      });
    } else {
      const id = this.campLoadoutId as CompanionId;
      const def = getCompanionDef(id);
      const load = camp().companions[id];
      box.add(
        this.add
          .text(0, -220, `${def.name} — ${def.title}`, { fontFamily: "Cinzel, Georgia", fontSize: "20px", color: "#e8c96a" })
          .setOrigin(0.5),
      );
      box.add(
        this.add
          .text(0, -188, `Weapon: ${getWeapon(load.weapon).name}`, { fontFamily: "Georgia", fontSize: "14px", color: "#e8dcc8" })
          .setOrigin(0.5),
      );
      const unlocked = gameState.save.unlockedWeapons;
      unlocked.forEach((w, i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        this.addBtn(box, -200 + col * 200, -140 + row * 48, getWeapon(w).shortName, () => {
          setCompanionWeapon(id, w as WeaponId);
          gameState.persist();
          bus.emit("camp-refresh");
          this.openCampLoadout();
        }, 160);
      });
      box.add(this.add.text(0, 40, "Tech tree (3 nodes)", { fontFamily: "Georgia", fontSize: "14px", color: "#b8a890" }).setOrigin(0.5));
      def.tree.forEach((node, i) => {
        const owned = companionHasNode(id, node.id);
        const cost = companionNodeCost(id, node.id);
        const y = 80 + i * 52;
        box.add(
          this.add
            .text(-260, y, `${node.name} — ${node.desc}`, {
              fontFamily: "Georgia",
              fontSize: "13px",
              color: owned ? "#8ecf6a" : "#e8dcc8",
            })
            .setOrigin(0, 0.5),
        );
        if (!owned) {
          this.addBtn(box, 220, y, `${cost}d`, () => {
            const r = unlockCompanionNode(id, node.id);
            if (r === "poor") this.toast("Not enough denarii.");
            else if (r === "order") this.toast("Unlock the prior node first.");
            else if (r === "ok") {
              gameState.persist();
              bus.emit("denarii-changed");
              this.openCampLoadout();
            }
          }, 100);
        } else {
          box.add(this.add.text(220, y, "Owned", { fontFamily: "Georgia", fontSize: "13px", color: "#8ecf6a" }).setOrigin(0.5));
        }
      });
    }
    this.addBtn(box, 0, isPlayer ? 220 : 280, "Close", () => this.closeOverlay(), 160);
  };

  private openCampMarch = (): void => {
    const c = camp();
    const houses = marchableRaidHouses(c.freedPads);
    const next = nextUnlockedRaidHouse(c.freedPads);
    const titleHouse = next ?? houses[houses.length - 1] ?? "serpens";
    const blurb =
      houses.length > 1
        ? "Freed houses can be rematched. The next house waits on the east road."
        : titleHouse === "lupus"
          ? "Strike while the pack sleeps. Wake one — wake all."
          : titleHouse === "aper"
            ? "Strike the sty by night. Mind the mud. Heavies will charge."
            : "Strike while the coil sleeps. Torches only.";
    const boxH = this.overlayMaxHeight(600);
    const half = boxH / 2;
    const box = this.box(680, boxH, `NIGHT RAID — ${raidHouseShortName(titleHouse).toUpperCase()}`);

    const headerY = -half + 52;
    box.add(
      this.add
        .text(0, headerY, `Allies: ${c.party.map((id) => getCompanionDef(id).name).join(" + ")}`, {
          fontFamily: "Georgia",
          fontSize: "15px",
          color: "#e8dcc8",
        })
        .setOrigin(0.5),
    );
    box.add(
      this.add
        .text(0, headerY + 22, blurb, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#7ab8a4",
          wordWrap: { width: 560 },
          align: "center",
        })
        .setOrigin(0.5),
    );
    box.add(
      this.add
        .text(0, headerY + 48, `Provisions: ${this.marchMealSummary()}`, {
          fontFamily: "Georgia",
          fontSize: "12px",
          color: "#e8c96a",
        })
        .setOrigin(0.5),
    );

    const tabY = -half + 92;
    this.addTabBtn(
      box,
      -92,
      tabY,
      "Provisions",
      this.campMarchTab === "meals",
      () => {
        this.campMarchTab = "meals";
        this.openCampMarch();
      },
      168,
    );
    this.addTabBtn(
      box,
      92,
      tabY,
      "Raid targets",
      this.campMarchTab === "targets",
      () => {
        this.campMarchTab = "targets";
        this.openCampMarch();
      },
      168,
    );

    const contentTop = -half + 124;
    const footerY = half - 32;
    const rowH = 36;
    const maxRows = Math.max(1, Math.floor((footerY - 14 - contentTop) / rowH));

    if (this.campMarchTab === "meals") {
      let y = contentTop;
      if (c.cookUnlocked) {
        const stockTotal = c.cookedStock.reduce((n, r) => n + r.count, 0);
        box.add(
          this.add
            .text(0, y, stockTotal > 0 ? "Cooked (preferred)" : "Cook at the farm kitchen first.", {
              fontFamily: "Georgia",
              fontSize: "12px",
              color: "#b8a890",
            })
            .setOrigin(0.5),
        );
        y += 22;
        for (const recipe of marchRecipes()) {
          if (y + rowH / 2 > footerY - 14) break;
          const count = cookedCount(recipe.id);
          const selected = c.selectedMarchRecipe === recipe.id;
          this.addBtn(
            box,
            0,
            y,
            `${selected ? "● " : ""}${recipe.name} (${count}) — ${recipe.desc}`,
            () => {
              if (count <= 0) {
                this.toast("None cooked. Visit the kitchen.");
                return;
              }
              c.selectedMarchRecipe = selected ? null : recipe.id;
              c.farm.selectedMeal = null;
              c.farm.selectedPantryCrop = null;
              gameState.persist();
              this.openCampMarch();
            },
            440,
          );
          y += rowH;
        }
        y += 8;
        box.add(
          this.add
            .text(0, y, "Raw pantry (by crop)", { fontFamily: "Georgia", fontSize: "12px", color: "#8a7a68" })
            .setOrigin(0.5),
        );
        y += 20;
      } else {
        box.add(
          this.add
            .text(0, y, "Optional meal from the pantry", {
              fontFamily: "Georgia",
              fontSize: "12px",
              color: "#b8a890",
            })
            .setOrigin(0.5),
        );
        y += 22;
      }
      const pantryRows = c.farm.pantry.filter((p) => p.count > 0);
      if (pantryRows.length === 0 && y + rowH / 2 <= footerY - 14) {
        box.add(
          this.add.text(0, y, "Pantry empty — harvest after a raid.", {
            fontFamily: "Georgia",
            fontSize: "13px",
            color: "#8a7a68",
          }).setOrigin(0.5),
        );
      }
      for (const row of pantryRows) {
        if (y + rowH / 2 > footerY - 14) break;
        const def = FARM_CROPS[row.cropId];
        const selected = c.farm.selectedPantryCrop === row.cropId;
        const stats = def.marchStats ?? { hp: def.meal === "hp" ? 20 : 0, stamina: def.meal === "stamina" ? 18 : 0, attack: def.meal === "damage" ? 3 : 0 };
        const buff = [
          stats.hp ? `+${stats.hp} HP` : "",
          stats.stamina ? `+${stats.stamina} Stam` : "",
          stats.attack ? `+${stats.attack} Atk` : "",
        ]
          .filter(Boolean)
          .join(", ");
        this.addBtn(box, 0, y, `${selected ? "● " : ""}${def.name} (${row.count}) — ${buff}`, () => {
          c.farm.selectedPantryCrop = selected ? null : row.cropId;
          c.farm.selectedMeal = null;
          c.selectedMarchRecipe = null;
          gameState.persist();
          this.openCampMarch();
        }, 440);
        y += rowH;
      }
    } else {
      const needsPager = houses.length > maxRows;
      const pageSize = needsPager ? maxRows - 1 : maxRows;
      const totalPages = Math.max(1, Math.ceil(houses.length / pageSize));
      if (this.campMarchHousePage >= totalPages) this.campMarchHousePage = 0;
      const pageHouses = houses.slice(this.campMarchHousePage * pageSize, this.campMarchHousePage * pageSize + pageSize);
      let y = contentTop;
      for (const id of pageHouses) {
        const short = raidHouseShortName(id);
        const rematch = c.freedPads.includes(id);
        const isNext = id === next;
        this.addBtn(
          box,
          0,
          y,
          `${isNext ? "▸ " : ""}${rematch ? `Rematch ${short}` : `Raid ${short} by night`}`,
          () => {
            this.closeOverlay();
            bus.emit("enter-raid", id);
          },
          320,
        );
        y += rowH;
      }
      if (needsPager) {
        this.addBtn(
          box,
          -90,
          y,
          "◀ Prev",
          () => {
            this.campMarchHousePage = (this.campMarchHousePage - 1 + totalPages) % totalPages;
            this.openCampMarch();
          },
          120,
        );
        box.add(
          this.add
            .text(0, y, `${this.campMarchHousePage + 1} / ${totalPages}`, {
              fontFamily: "Georgia",
              fontSize: "13px",
              color: "#c4b8a4",
            })
            .setOrigin(0.5),
        );
        this.addBtn(
          box,
          90,
          y,
          "Next ▶",
          () => {
            this.campMarchHousePage = (this.campMarchHousePage + 1) % totalPages;
            this.openCampMarch();
          },
          120,
        );
      }
    }

    this.addBtn(box, 0, footerY, "Stay", () => this.closeOverlay(), 160);
  };

  private openCampKitchen = (): void => {
    const c = camp();
    if (!c.cookUnlocked) {
      this.toast("The cook arrives after three houses are free.");
      return;
    }
    const march = marchRecipes();
    const broth = campRecipes();
    const boxH = this.overlayMaxHeight(580);
    const half = boxH / 2;
    const box = this.box(680, boxH, "KITCHEN");

    const pantryLine = kitchenStockSummary();
    const stockLine =
      c.cookedStock.length === 0
        ? "Stock empty"
        : c.cookedStock.map((p) => `${getRecipe(p.recipeId).name}×${p.count}`).join("  ·  ");
    box.add(
      this.add
        .text(0, -half + 52, `Pantry: ${pantryLine}`, {
          fontFamily: "Georgia",
          fontSize: "12px",
          color: "#8ecf6a",
          wordWrap: { width: 620 },
          align: "center",
        })
        .setOrigin(0.5),
    );
    box.add(
      this.add
        .text(0, -half + 72, `Stock: ${stockLine}`, {
          fontFamily: "Georgia",
          fontSize: "12px",
          color: "#7ab8a4",
          wordWrap: { width: 620 },
          align: "center",
        })
        .setOrigin(0.5),
    );
    if (c.activeCampBuff) {
      box.add(
        this.add
          .text(0, -half + 92, `Fire buff ready: ${c.activeCampBuff === "camp_broth" ? "Camp broth" : "Hearty stew"}`, {
            fontFamily: "Georgia",
            fontSize: "12px",
            color: "#e8c96a",
          })
          .setOrigin(0.5),
      );
    }

    const tabY = -half + (c.activeCampBuff ? 118 : 100);
    this.addTabBtn(
      box,
      -195,
      tabY,
      "March meals",
      this.campKitchenTab === "march",
      () => {
        this.campKitchenTab = "march";
        this.openCampKitchen();
      },
      108,
    );
    this.addTabBtn(box, -65, tabY, "Fire broth", this.campKitchenTab === "broth", () => {
      this.campKitchenTab = "broth";
      this.openCampKitchen();
    }, 108);
    this.addTabBtn(box, 65, tabY, "Sell", this.campKitchenTab === "sell", () => {
      this.campKitchenTab = "sell";
      this.openCampKitchen();
    }, 108);
    this.addTabBtn(box, 195, tabY, "Quests", this.campKitchenTab === "quests", () => {
      this.campKitchenTab = "quests";
      this.openCampKitchen();
    }, 108);

    const contentTop = tabY + 34;
    const footerY = half - 32;
    const rowH = 44;

    if (this.campKitchenTab === "quests") {
      let y = contentTop;
      const quests = visibleCookQuests();
      if (quests.length === 0) {
        box.add(
          this.add
            .text(0, y + 20, "No active cook quests — free more houses or check back later.", {
              fontFamily: "Georgia",
              fontSize: "14px",
              color: "#8a7a68",
              wordWrap: { width: 560 },
              align: "center",
            })
            .setOrigin(0.5),
        );
      }
      for (const q of quests) {
        const def = COOK_QUEST_DEFS[q.id];
        box.add(
          this.add
            .text(-280, y - 8, def.label, { fontFamily: "Georgia", fontSize: "14px", color: "#e8dcc8" })
            .setOrigin(0, 0.5),
        );
        box.add(
          this.add
            .text(-280, y + 12, `${q.progress}/${def.goal}  ·  ${def.rewardLabel}`, {
              fontFamily: "Georgia",
              fontSize: "11px",
              color: "#8a7a68",
            })
            .setOrigin(0, 0.5),
        );
        y += rowH + 16;
      }
      const done = (["olive_harvests", "mutton_stews"] as const).filter((id) => cookQuestProgress(id).done);
      if (done.length > 0) {
        box.add(
          this.add
            .text(0, y + 8, `Completed: ${done.map((id) => COOK_QUEST_DEFS[id].rewardLabel).join(" · ")}`, {
              fontFamily: "Georgia",
              fontSize: "12px",
              color: "#8ecf6a",
              wordWrap: { width: 560 },
              align: "center",
            })
            .setOrigin(0.5),
        );
      }
    } else if (this.campKitchenTab === "march") {
      let y = contentTop;
      for (const recipe of march) {
        if (y + rowH / 2 > footerY - 14) break;
        const locked = isRecipeQuestLocked(recipe.id);
        const inputs = formatRecipeInputs(recipe.id);
        box.add(
          this.add
            .text(-280, y - 8, locked ? `${recipe.name} 🔒` : recipe.name, {
              fontFamily: "Georgia",
              fontSize: "14px",
              color: !locked && canCraft(recipe.id) ? "#e8dcc8" : "#8a7a68",
            })
            .setOrigin(0, 0.5),
        );
        box.add(
          this.add
            .text(-280, y + 10, locked ? recipeLockHint(recipe.id) : `${inputs} — ${recipe.desc}`, {
              fontFamily: "Georgia",
              fontSize: "11px",
              color: "#8a7a68",
            })
            .setOrigin(0, 0.5),
        );
        this.addBtn(box, 240, y, "Cook", () => {
          const r = craftRecipe(recipe.id);
          if (r === "quest") this.toast(recipeLockHint(recipe.id));
          else if (r === "missing") this.toast(ingredientShortfallHint(recipe.id));
          else if (r === "locked") this.toast("Kitchen locked.");
          else {
            gameState.persist();
            bus.emit("camp-refresh");
            this.toast(`${recipe.name} ready.`);
            this.openCampKitchen();
          }
        }, 90);
        y += rowH;
      }
    } else if (this.campKitchenTab === "broth") {
      let y = contentTop;
      for (const recipe of broth) {
        if (y + rowH / 2 > footerY - 14) break;
        const inputs = formatRecipeInputs(recipe.id);
        const count = cookedCount(recipe.id);
        box.add(
          this.add
            .text(-280, y - 8, `${recipe.name} (${count} ready)`, {
              fontFamily: "Georgia",
              fontSize: "14px",
              color: "#e8dcc8",
            })
            .setOrigin(0, 0.5),
        );
        box.add(
          this.add
            .text(-280, y + 10, `${inputs} — ${recipe.desc}`, {
              fontFamily: "Georgia",
              fontSize: "11px",
              color: "#8a7a68",
            })
            .setOrigin(0, 0.5),
        );
        this.addBtn(box, 180, y - 6, "Cook", () => {
          const r = craftRecipe(recipe.id);
          if (r === "missing") this.toast(ingredientShortfallHint(recipe.id));
          else if (r === "locked") this.toast("Kitchen locked.");
          else {
            gameState.persist();
            bus.emit("camp-refresh");
            this.toast(`${recipe.name} ready.`);
            this.openCampKitchen();
          }
        }, 90);
        this.addBtn(box, 280, y - 6, "Set for fire", () => {
          const r = assignCampBuffFromStock(recipe.id);
          if (r === "empty") this.toast("Cook one first.");
          else if (r === "wrong") this.toast("Not a fire recipe.");
          else {
            gameState.persist();
            this.toast("Broth ready at the fire.");
            this.openCampKitchen();
          }
        }, 120);
        y += rowH + 12;
      }
    } else {
      let y = contentTop;
      let any = false;
      (Object.keys(FARM_CROPS) as FarmCropId[]).forEach((cropId) => {
        const count = pantryCount(cropId);
        if (count <= 0) return;
        if (y + rowH / 2 > footerY - 14) return;
        any = true;
        this.addBtn(box, 0, y, `Sell ${rawCropLabel(cropId)} ×${count} (${RAW_SELL_PRICES[cropId]}d each)`, () => {
          const r = sellRaw(cropId);
          if (r === "empty") this.toast("Nothing to sell.");
          else {
            gameState.persist();
            bus.emit("denarii-changed");
            this.openCampKitchen();
          }
        }, 380);
        y += rowH;
      });
      c.cookedStock.forEach((row) => {
        if (y + rowH / 2 > footerY - 14) return;
        any = true;
        const def = getRecipe(row.recipeId);
        this.addBtn(box, 0, y, `Sell ${def.name} ×${row.count} (${def.sellPrice}d each)`, () => {
          const r = sellCooked(row.recipeId);
          if (r === "empty") this.toast("None left.");
          else {
            gameState.persist();
            bus.emit("denarii-changed");
            this.openCampKitchen();
          }
        }, 380);
        y += rowH;
      });
      if (!any) {
        box.add(
          this.add
            .text(0, contentTop + 20, "Nothing to sell — harvest or cook first.", {
              fontFamily: "Georgia",
              fontSize: "14px",
              color: "#8a7a68",
            })
            .setOrigin(0.5),
        );
      }
    }

    this.addBtn(box, 0, footerY, "Close", () => this.closeOverlay(), 160);
  };

  private openRaidCipher = (payload: unknown): void => {
    const data = payload as { prompt: string; options: string[]; answer: string[] };
    if (!data?.options) return;
    this.cipherPicks = [];
    const render = (): void => {
      const box = this.box(620, 480, "CIPHER");
      box.add(
        this.add
          .text(0, -180, data.prompt, {
            fontFamily: "Georgia",
            fontSize: "15px",
            color: "#e8dcc8",
            wordWrap: { width: 520 },
            align: "center",
          })
          .setOrigin(0.5),
      );
      box.add(
        this.add
          .text(0, -120, `Order: ${this.cipherPicks.join(" → ") || "—"}`, {
            fontFamily: "Cinzel, Georgia",
            fontSize: "16px",
            color: "#7ab8a4",
          })
          .setOrigin(0.5),
      );
      data.options.forEach((opt, i) => {
        this.addBtn(box, -160 + i * 160, -40, opt, () => {
          if (this.cipherPicks.length >= data.answer.length) this.cipherPicks = [];
          this.cipherPicks.push(opt);
          render();
        }, 140);
      });
      this.addBtn(box, -100, 80, "Clear", () => {
        this.cipherPicks = [];
        render();
      }, 140);
      this.addBtn(box, 100, 80, "Submit", () => {
        this.closeOverlay();
        const raid = this.scene.get("RaidScene") as { applyCipher?: (order: string[]) => void };
        raid?.applyCipher?.(this.cipherPicks);
      }, 140);
      this.addBtn(box, 0, 150, "Leave", () => this.closeOverlay(), 140);
    };
    render();
  };

  private toMenu(): void {
    this.hideJudgment();
    this.closeOverlay();
    enterMenu(this, true);
  }
}
