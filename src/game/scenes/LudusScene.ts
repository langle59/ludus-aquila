import Phaser from "phaser";
import { TILE_SIZE, HUD_CAM_PAD, COLORS } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { audio } from "../systems/audio";
import { paintMap, animateFountain, animateTrough, animateBrazier } from "../systems/worldRender";
import { buildLudus, inChamberTiles, inDrillYardTiles, inFeastTiles, inShrineTiles, ludusAreaName } from "../maps/maps";
import { Fighter, attachHpBar } from "../entities/Fighter";
import { NpcActor, TrainingDummy, WorldProp } from "../entities/World";
import { playerLook } from "../data/shop";
import { CombatAI } from "../systems/ai";
import { resolveHits, dummyStrikeFeedback } from "../systems/combat";
import { DIALOGUE } from "../data/dialogue";
import { getNpc, HOUSE_GLADIATORS, LANISTA } from "../data/gladiators";
import { markTutorial, skipTutorial, currentBoutNpc, allHouseBoutsWon, BOUT_FLAGS, queueActIntro, currentAct, actIntroFlag } from "../systems/objectives";
import type { ObjectiveId } from "../types";
import { applySparReward, applyDummyXp, pledgedHouse, playerCombatStats, rivalHouses, drinkFeast } from "../systems/progression";
import {
  applyCoachingLesson,
  getSchoolRecord,
  isSchoolNpc,
  schoolCombatStats,
  schoolStudentUnlocked,
  schoolUnlockHint,
} from "../data/school";
import type { SchoolNpcId } from "../types";
import {
  applyDrillReward,
  clampDrillPosition,
  createDrillState,
  drillPlayBounds,
  drillYardCenter,
  getDrillDef,
  isDrillId,
  shiftDrillTimers,
  tickDrill,
  type DrillId,
  type DrillState,
} from "../systems/drills";
import {
  applyLessonEvent,
  createLessonRuntime,
  lessonIntroLines,
  lessonPrompt,
  type LessonRuntime,
} from "../systems/lessons";
import { SHRINE_NICHES, patronUnlocked } from "../data/patrons";
import { palCombatStats, palDisplayName, palTexture, palUnlocked } from "../data/pal";
import { getHouse } from "../data/houses";
import {
  chamberBedTex,
  chamberExtraTex,
  chamberFloorTex,
  chamberHangingTex,
  chamberHangingTint,
  chamberRugTex,
  lastTrophyHouse,
} from "../data/chamber";
import { bodyStyleFor } from "../systems/assets";
import { CombatInput } from "../systems/input";
import { ensureNight, rufusAtTable } from "../systems/nights";

function mixTint(a: number, b: number, t: number): number {
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

const TEACHING_OBJECTIVES: ObjectiveId[] = [
  "attack_dummy",
  "learn_stamina",
  "learn_heavy",
  "learn_dodge",
  "learn_block",
  "learn_parry",
];

function isTeachingLesson(id = gameState.save.currentObjective): boolean {
  return TEACHING_OBJECTIVES.includes(id);
}

export class LudusScene extends Phaser.Scene {
  private player!: Fighter;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private npcs: NpcActor[] = [];
  private dummies: TrainingDummy[] = [];
  private combat!: CombatInput;
  private blockingHeld = false;
  private interactables: { kind: string; x: number; y: number; id?: string }[] = [];
  private palSprite?: Phaser.GameObjects.Image;
  private palNameTag?: Phaser.GameObjects.Text;
  private palShadow?: Phaser.GameObjects.Image;
  private roostGfx: Phaser.GameObjects.GameObject[] = [];
  private palHome = { x: 0, y: 0 };
  private roostIdleArmed = false;
  private nearestHint?: Phaser.GameObjects.Text;
  private sparring: { enemy: Fighter; ai: CombatAI; npcId: string; coaching: boolean } | null = null;
  private lessonState: LessonRuntime | null = null;
  private hiddenNpc?: NpcActor;
  private awaitingSpar: string | null = null;
  private dummyCapTold = false;
  private built = buildLudus();
  private trophyGfx: Phaser.GameObjects.GameObject[] = [];
  private shrineGfx: Phaser.GameObjects.GameObject[] = [];
  private chamberGfx: Phaser.GameObjects.GameObject[] = [];
  private chamberFloor: Phaser.GameObjects.GameObject[] = [];
  private chamberOpened = false;
  private tableLocks: Phaser.GameObjects.Image[] = [];
  private drilling: DrillState | null = null;
  private drillGfx: Phaser.GameObjects.GameObject[] = [];
  private lessonsDoneThisVisit = new Set<string>();
  private drillMarkers: Phaser.GameObjects.GameObject[] = [];
  private drillDemo: { id: DrillId; startedAt: number; endsAt: number } | null = null;
  private drillLaneGfx: Phaser.GameObjects.GameObject[] = [];
  private drillReturnPos: { x: number; y: number } | null = null;
  private drillLastNow = 0;
  private drillPendingLight = false;
  private drillPendingHeavy = false;

  constructor() {
    super("LudusScene");
  }

  init(): void {
    this.npcs = [];
    this.dummies = [];
    this.interactables = [];
    this.roostGfx = [];
    this.trophyGfx = [];
    this.shrineGfx = [];
    this.sparring = null;
    this.hiddenNpc = undefined;
    this.awaitingSpar = null;
    this.tableLocks = [];
    this.palSprite = undefined;
    this.palNameTag = undefined;
    this.palShadow = undefined;
    this.nearestHint = undefined;
    this.blockingHeld = false;
    this.dummyCapTold = false;
    this.roostIdleArmed = false;
    this.built = buildLudus();
    this.chamberOpened = Boolean(gameState.save.lanistaUnlocked);
    this.drilling = null;
    this.drillGfx = [];
    this.drillMarkers = [];
    this.drillDemo = null;
    this.drillLaneGfx = [];
    this.drillReturnPos = null;
    this.lessonsDoneThisVisit = new Set();
    gameState.schoolFreeRestAvailable = true;
  }

  create(): void {
    this.solids = paintMap(this, this.built, "ludus");
    this.cameras.main.setBounds(0, -HUD_CAM_PAD, this.built.cols * TILE_SIZE, this.built.rows * TILE_SIZE + HUD_CAM_PAD);
    this.cameras.main.setZoom(1);
    audio.setMusicMood("yard");

    const spawn = gameState.save.position.x
      ? { x: gameState.save.position.x, y: gameState.save.position.y }
      : this.built.spawns.player;

    const look = playerLook();
    this.player = new Fighter(this, spawn.x, spawn.y, {
      key: "player",
      tunic: look.tunic,
      accent: look.accent,
      style: look.style,
      cape: look.cape,
      scar: look.scar,
      crest: look.crest,
      stats: { ...playerCombatStats() },
      weapon: gameState.save.equippedWeapon,
      team: "player",
    });
    this.player.health = gameState.save.health;
    this.player.stamina = gameState.save.stamina;
    this.physics.add.collider(this.player, this.solids);

    this.spawnNpcs();
    this.spawnProps();
    this.refreshRoost();
    this.refreshHall();
    this.refreshShrine();
    this.refreshChamber();
    if (gameState.save.freedomWon) ensureNight();
    if (isTeachingLesson()) this.placeForTeachingLesson();

    this.nearestHint = this.add
      .text(0, 0, "", { fontFamily: "Georgia", fontSize: "14px", color: "#d4a84b", stroke: "#1a1210", strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(3000)
      .setVisible(false);

    const kb = this.input.keyboard!;
    this.combat = new CombatInput(this);
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    this.game.canvas.focus();

    this.time.delayedCall(450, () => this.tryActIntro());

    this.events.on("wake", () => {
      gameState.paused = false;
      gameState.inMenu = false;
      gameState.inDialogue = false;
      this.physics.world.resume();
      this.time.timeScale = 1;
      this.physics.world.timeScale = 1;
      const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) {
        body.enable = true;
        body.setVelocity(0, 0);
      }
      this.player.setWeapon(gameState.save.equippedWeapon);
      this.player.stats = { ...playerCombatStats() };
      this.player.revive(true);
      if (gameState.pendingFeast) {
        const p = gameState.save.position;
        this.player.setPosition(p.x, p.y);
        body?.reset(p.x, p.y);
        this.player.health = gameState.save.health;
        this.player.stamina = gameState.save.stamina;
      } else {
        gameState.restoreVitals();
      }
      this.seatHouse();
      this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
      bus.emit("minimap-scene", "ludus");
      audio.setMusicMood("yard");
      this.refreshHall();
      this.refreshRoost();
      this.refreshShrine();
      this.refreshChamber();
      if (gameState.save.freedomWon) ensureNight();
      this.lessonsDoneThisVisit = new Set();
      gameState.schoolFreeRestAvailable = true;
      // Clear locks again after refreshes (safety)
      gameState.paused = false;
      gameState.inMenu = false;
      gameState.inDialogue = false;
      bus.emit("ludus-resumed");
      bus.emit("unstuck");
      this.time.delayedCall(450, () => this.tryActIntro());
      if (isTeachingLesson()) this.placeForTeachingLesson();
    });

    bus.on("weapon-changed", this.onWeapon, this);
    bus.on("enter-arena", this.goArena, this);
    bus.on("result-closed", this.afterResult, this);
    bus.on("player-attack", this.doAttack, this);
    bus.on("player-special", this.doSpecial, this);
    bus.on("player-interact", this.tryInteract, this);
    bus.on("player-spar", this.onSparRequest, this);
    bus.on("player-yield", this.onYield, this);
    bus.on("skills-changed", this.onSkillsChanged, this);
    bus.on("cosmetics-changed", this.onCosmeticsChanged, this);
    bus.on("roost-changed", this.onRoostChanged, this);
    bus.on("lanista-unlocked", this.onLanistaUnlocked, this);
    bus.on("unstuck", this.onUnstuck, this);
    bus.on("act-card-done", this.onActCardDone, this);
    bus.on("drill-begin", this.onDrillBegin, this);
    bus.on("teach-start", this.onTeachStart, this);

    this.events.on("shutdown", () => {
      bus.off("weapon-changed", this.onWeapon, this);
      bus.off("enter-arena", this.goArena, this);
      bus.off("result-closed", this.afterResult, this);
      bus.off("player-attack", this.doAttack, this);
      bus.off("player-special", this.doSpecial, this);
      bus.off("player-interact", this.tryInteract, this);
      bus.off("player-spar", this.onSparRequest, this);
      bus.off("player-yield", this.onYield, this);
      bus.off("skills-changed", this.onSkillsChanged, this);
      bus.off("cosmetics-changed", this.onCosmeticsChanged, this);
      bus.off("roost-changed", this.onRoostChanged, this);
      bus.off("lanista-unlocked", this.onLanistaUnlocked, this);
      bus.off("unstuck", this.onUnstuck, this);
      bus.off("act-card-done", this.onActCardDone, this);
      bus.off("drill-begin", this.onDrillBegin, this);
      bus.off("teach-start", this.onTeachStart, this);
      bus.emit("spar-available", { show: false });
      bus.emit("talk-available", { show: false });
      bus.emit("minimap-scene", "none");
      audio.setHall(false);
    });

    this.setupDebug();
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    if (!this.scene.isActive("UIScene")) this.scene.launch("UIScene");
    this.game.canvas.setAttribute("tabindex", "0");
    this.game.canvas.focus();
    bus.emit("minimap-scene", "ludus");
  }

  private doAttack = (kind: unknown = "light"): void => {
    if (this.blocked() || !this.sys.isActive()) return;
    if (!gameState.save.equippedWeapon) {
      bus.emit("toast", "Equip a weapon in the armory first.");
      return;
    }
    if (this.drilling) {
      if (kind === "heavy") this.drillPendingHeavy = true;
      else this.drillPendingLight = true;
    }
    const used = this.player.tryAttack(kind === "heavy" ? "heavy" : "light");
    if (used && kind === "heavy" && !gameState.save.tutorialComplete) markTutorial("hitHeavy");
    if (used && this.player.stamina < this.player.stats.maxStamina * 0.75) markTutorial("staminaDip");
  };

  private doSpecial = (): void => {
    if (this.blocked() || !this.sys.isActive()) return;
    this.player.trySpecial();
  };

  private blocked(): boolean {
    return gameState.paused || gameState.inDialogue || gameState.inMenu || Boolean(this.sparring && false);
  }

  private uiLocked(): boolean {
    return gameState.paused || gameState.inDialogue || gameState.inMenu;
  }

  private spawnNpcs(): void {
    const list = [LANISTA, ...HOUSE_GLADIATORS];
    const house = pledgedHouse();
    for (const def of list) {
      const pos = this.built.spawns[def.id];
      if (!pos) continue;
      const tunic =
        house && def.role === "friend"
          ? mixTint(def.color, house.colors.primary, 0.42)
          : def.color;
      const npc = new NpcActor(this, pos.x, pos.y, def.id, def.name, tunic, def.accent, def.scale);
      this.physics.add.collider(this.player, npc);
      this.npcs.push(npc);
      this.interactables.push({ kind: "npc", x: pos.x, y: pos.y, id: def.id });
    }
  }

  private spawnProps(): void {
    for (const p of this.built.props) {
      if (p.kind === "dummy") {
        const d = new TrainingDummy(this, p.x, p.y);
        this.dummies.push(d);
        this.physics.add.collider(this.player, d);
        this.interactables.push({ kind: "dummy", x: p.x, y: p.y });
      } else if (p.kind === "rack") {
        const rack = new WorldProp(this, p.x, p.y, "rack", "prop-rack", true);
        this.physics.add.collider(this.player, rack);
        this.interactables.push({ kind: "rack", x: p.x, y: p.y });
      } else if (p.kind === "gate") {
        const footY = p.y + TILE_SIZE / 2;
        const span = 64;
        for (const dx of [-span, span]) {
          const post = this.physics.add.staticImage(p.x + dx, footY, "prop-gate-post");
          post.setOrigin(0.5, 1);
          post.setDepth(footY);
          const body = post.body as Phaser.Physics.Arcade.StaticBody;
          body.setSize(18, 14);
          body.setOffset(9, 66);
          post.refreshBody();
          this.physics.add.collider(this.player, post);
        }
        this.add.image(p.x, footY - 62, "prop-gate-arch").setOrigin(0.5, 1).setDepth(footY + 80);
        this.interactables.push({ kind: "gate", x: p.x, y: p.y });
      } else if (p.kind === "fountain") {
        const f = new WorldProp(this, p.x, p.y, "fountain", "prop-fountain", true);
        this.physics.add.collider(this.player, f);
        animateFountain(this, p.x, p.y);
      } else if (p.kind === "lararium") {
        const altar = new WorldProp(this, p.x, p.y, "lararium", "prop-lararium", true);
        this.physics.add.collider(this.player, altar);
        this.interactables.push({ kind: "altar", x: p.x, y: p.y });
      } else if (p.kind === "altar") {
        this.add.image(p.x, p.y + 4, "prop-altar").setDepth(p.y);
      } else if (p.kind === "crate") {
        this.add.image(p.x, p.y, "prop-crate").setDepth(p.y);
      } else if (p.kind === "anvil") {
        const a = new WorldProp(this, p.x, p.y, "anvil", "prop-anvil", true);
        this.physics.add.collider(this.player, a);
      } else if (p.kind === "barrel") {
        this.add.image(p.x, p.y, "prop-barrel").setDepth(p.y);
      } else if (p.kind === "bed") {
        const bed = new WorldProp(this, p.x, p.y, "bed", "prop-bed", true);
        this.physics.add.collider(this.player, bed);
      } else if (p.kind === "chest") {
        const chest = new WorldProp(this, p.x, p.y, "chest", "prop-chest", true);
        this.physics.add.collider(this.player, chest);
      } else if (p.kind === "shieldstand") {
        this.add.image(p.x, p.y, "prop-shieldstand").setDepth(p.y);
      } else if (p.kind === "hay") {
        this.add.image(p.x, p.y, "prop-hay").setDepth(2);
      } else if (p.kind === "locker" && p.id && isSchoolNpc(p.id)) {
        const done = getSchoolRecord(p.id).glory;
        const pad = this.add
          .image(p.x, p.y, "fx-ring")
          .setTint(done ? 0x8ecf6a : 0xc2a36b)
          .setAlpha(done ? 0.72 : 0.5)
          .setScale(0.5)
          .setDepth(2);
        this.drillMarkers.push(pad);
        const plaque = this.add
          .text(p.x, p.y - 34, getNpc(p.id).name.toUpperCase(), {
            fontFamily: "Cinzel, Georgia",
            fontSize: "11px",
            color: done ? "#8ecf6a" : "#e8dcc8",
            stroke: "#1a1210",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(3);
        this.drillMarkers.push(plaque);
        if (done) {
          const badge = this.add
            .text(p.x, p.y - 20, "DONE", {
              fontFamily: "Cinzel, Georgia",
              fontSize: "9px",
              color: "#8ecf6a",
              stroke: "#1a1210",
              strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(3);
          this.drillMarkers.push(badge);
        }
        this.interactables.push({ kind: "locker", x: p.x, y: p.y, id: p.id });
      } else if (p.kind === "drill" && p.id && isDrillId(p.id)) {
        // Legacy pads — redirect to locker UX
        this.interactables.push({ kind: "locker", x: p.x, y: p.y, id: p.id });
      } else if (p.kind === "perch") {
        const perch = new WorldProp(this, p.x, p.y + 4, "perch", "prop-perch", true);
        this.physics.add.collider(this.player, perch);
      } else if (p.kind === "nest") {
        this.add.image(p.x, p.y + 6, "prop-nest").setDepth(2);
      } else if (p.kind === "bowl") {
        this.add.image(p.x, p.y + 4, "prop-feed-bowl").setDepth(p.y + 2);
      } else if (p.kind === "trough") {
        this.add.image(p.x, p.y, "prop-trough").setDepth(p.y);
        animateTrough(this, p.x, p.y);
      } else if (p.kind === "hook") {
        this.add.image(p.x, p.y - 8, "prop-collar-hook").setDepth(p.y);
      } else if (p.kind === "bench") {
        this.add.image(p.x, p.y, "prop-bench").setDepth(p.y);
      } else if (p.kind === "shop") {
        const stall = new WorldProp(this, p.x, p.y, "shop", "prop-stall", true);
        this.physics.add.collider(this.player, stall);
        this.interactables.push({ kind: "shop", x: p.x, y: p.y });
      } else if (p.kind === "chamber") {
        const desk = new WorldProp(this, p.x, p.y, "chamber", "prop-desk", true);
        this.physics.add.collider(this.player, desk);
        this.interactables.push({ kind: "chamber", x: p.x, y: p.y });
      } else if (p.kind === "dice") {
        const table = new WorldProp(this, p.x, p.y, "dice", "prop-dice-table", true);
        this.physics.add.collider(this.player, table);
        this.interactables.push({ kind: "dice", x: p.x, y: p.y });
        this.tableLocks.push(this.add.image(p.x, p.y - 6, "prop-dice-lock").setDepth(p.y + 1));
      } else if (p.kind === "feast-table") {
        const t = new WorldProp(this, p.x, p.y, "feast-table", "prop-feast-table", true);
        this.physics.add.collider(this.player, t);
      } else if (p.kind === "amphora") {
        this.add.image(p.x, p.y, "prop-amphora").setDepth(p.y);
      } else if (p.kind === "keg") {
        this.add.image(p.x, p.y, "prop-keg").setDepth(p.y);
      } else if (p.kind === "wine") {
        this.add.image(p.x, p.y, "prop-mug-wine").setDepth(p.y + 2);
        this.interactables.push({ kind: "wine", x: p.x, y: p.y });
      } else if (p.kind === "beer") {
        this.add.image(p.x, p.y, "prop-mug-beer").setDepth(p.y + 2);
        this.interactables.push({ kind: "beer", x: p.x, y: p.y });
      } else if (p.kind === "brazier") {
        this.add.image(p.x, p.y, "prop-brazier").setDepth(p.y);
        animateBrazier(this, p.x, p.y);
      } else if (p.kind === "platter") {
        this.add.image(p.x, p.y, "prop-platter").setDepth(2);
      } else if (p.kind === "column") {
        const c = new WorldProp(this, p.x, p.y, "column", "prop-column", true);
        this.physics.add.collider(this.player, c);
      }
    }
  }

  private hallSlotCols(count: number, southWall = false): number[] {
    // Shared columns — avoid centered south door at 36–38
    if (count >= 5) return [28, 31, 34, 40, 43];
    if (count === 4) return [28, 31, 40, 43];
    if (count === 3) return southWall ? [28, 34, 43] : [28, 37, 43];
    if (count === 2) return [31, 40];
    if (count === 1) return southWall ? [34] : [37];
    return [];
  }

  private refreshHall(): void {
    for (const g of this.trophyGfx) g.destroy();
    this.trophyGfx = [];
    this.interactables = this.interactables.filter((it) => it.kind !== "trophy");
    for (const lock of this.tableLocks) lock.setVisible(!gameState.save.freedomWon);
    this.seatHouse();

    const houses = rivalHouses();
    const north = houses.slice(0, 4);
    const south = houses.slice(4);
    const place = (houseList: typeof houses, cols: number[], row: number) => {
      houseList.forEach((house, i) => {
        const col = cols[i];
        if (col == null) return;
        const x = col * TILE_SIZE + TILE_SIZE / 2;
        const y = row * TILE_SIZE + TILE_SIZE / 2;
        const beaten = gameState.save.defeatedHouses.includes(house.id);
        const plaque = this.add.image(x, y - 2, "prop-trophy-empty").setDepth(y).setScale(1.15);
        this.trophyGfx.push(plaque);
        if (beaten) {
          const banner = this.add
            .image(x, y - 26, "prop-trophy-banner")
            .setDepth(y - 1)
            .setTint(house.colors.primary)
            .setScale(1.2);
          this.trophyGfx.push(banner);
          const kind = house.beastKind ?? "eagle";
          const tex = `trophy-skel-${kind}`;
          if (this.textures.exists(tex)) {
            const head = this.add.image(x, y - 10, tex).setDepth(y + 1).setScale(1.25);
            this.trophyGfx.push(head);
          }
          const tag = this.add
            .text(x, y + 18, house.animalName, {
              fontFamily: "Cinzel, Georgia",
              fontSize: "9px",
              color: "#e8c96a",
              stroke: "#1a1210",
              strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(y + 2);
          this.trophyGfx.push(tag);
        }
        this.interactables.push({ kind: "trophy", x, y, id: house.id });
      });
    };
    place(north, this.hallSlotCols(north.length), 2);
    place(south, this.hallSlotCols(south.length, true), 11);
  }

  private refreshShrine(): void {
    for (const g of this.shrineGfx) g.destroy();
    this.shrineGfx = [];
    for (const slot of SHRINE_NICHES) {
      const x = slot.tx * TILE_SIZE + TILE_SIZE / 2;
      const y = slot.ty * TILE_SIZE + TILE_SIZE / 2;
      const lit = patronUnlocked(slot.id);
      const niche = this.add.image(x, y - 6, lit ? "prop-niche-lit" : "prop-niche-empty").setDepth(y);
      this.shrineGfx.push(niche);
    }
  }

  private onLanistaUnlocked = (): void => {
    gameState.save.position = { x: this.player.x, y: this.player.y, scene: "ludus" };
    gameState.persist();
    this.scene.restart();
  };

  private refreshChamber(): void {
    for (const g of this.chamberGfx) g.destroy();
    this.chamberGfx = [];
    this.interactables = this.interactables.filter((it) => it.kind !== "chamber");
    if (!gameState.save.lanistaUnlocked) return;

    if (!this.chamberOpened) {
      this.openChamberDoor();
      this.chamberOpened = true;
    }

    const cell = (tx: number, ty: number) => ({
      x: tx * TILE_SIZE + TILE_SIZE / 2,
      y: ty * TILE_SIZE + TILE_SIZE / 2,
    });
    const addImg = (x: number, y: number, tex: string, depth = y, tint?: number) => {
      const img = this.add.image(x, y, tex).setDepth(depth);
      if (tint != null) img.setTint(tint);
      this.chamberGfx.push(img);
      return img;
    };
    const addProp = (x: number, y: number, kind: string, tex: string, solid = true) => {
      const prop = new WorldProp(this, x, y, kind, tex, solid);
      if (solid) this.physics.add.collider(this.player, prop);
      this.chamberGfx.push(prop);
      return prop;
    };

    const decor = gameState.save.chamber;
    const floorTex = chamberFloorTex(decor?.floor ?? "floor-pale");
    for (let ty = 1; ty <= 4; ty++) {
      for (let tx = 50; tx <= 59; tx++) {
        this.chamberGfx.push(this.add.image(tx * TILE_SIZE, ty * TILE_SIZE, floorTex).setOrigin(0).setDepth(0.6));
      }
    }
    this.chamberGfx.push(this.add.image(54 * TILE_SIZE, 5 * TILE_SIZE, floorTex).setOrigin(0).setDepth(0.6));
    this.chamberGfx.push(this.add.image(55 * TILE_SIZE, 5 * TILE_SIZE, floorTex).setOrigin(0).setDepth(0.6));

    const rugTex = chamberRugTex(decor?.rug ?? "rug-none");
    if (rugTex) {
      for (let ty = 2; ty <= 3; ty++) {
        for (let tx = 52; tx <= 57; tx++) {
          this.chamberGfx.push(this.add.image(tx * TILE_SIZE, ty * TILE_SIZE, rugTex).setOrigin(0).setDepth(1));
        }
      }
    }

    const hangTex = chamberHangingTex(decor?.banner ?? "banner-none");
    if (hangTex) {
      const tint = chamberHangingTint(decor.banner);
      for (const tx of [52, 54, 56]) {
        const pos = cell(tx, 1);
        addImg(pos.x, pos.y - 4, hangTex, pos.y + 8, tint);
      }
    }

    const light = decor?.light ?? "light-none";
    if (light === "light-lamps") {
      addImg(cell(50, 1).x, cell(50, 1).y - 6, "prop-lamp", cell(50, 1).y + 4);
      addImg(cell(59, 1).x, cell(59, 1).y - 6, "prop-lamp", cell(59, 1).y + 4);
    } else if (light === "light-brazier") {
      const pos = cell(50, 3);
      addProp(pos.x, pos.y, "brazier", "prop-brazier", true);
    }

    const trophy = decor?.trophy ?? "trophy-none";
    if (trophy === "trophy-empty" || trophy === "trophy-eagle" || trophy === "trophy-last") {
      const pos = cell(51, 1);
      addImg(pos.x, pos.y - 2, "prop-trophy-empty", pos.y);
      if (trophy === "trophy-eagle") {
        addImg(pos.x, pos.y - 8, "prop-trophy-banner", pos.y - 1, COLORS.crimson);
        if (this.textures.exists("trophy-skel-eagle")) addImg(pos.x, pos.y - 6, "trophy-skel-eagle", pos.y + 1);
      } else if (trophy === "trophy-last") {
        const house = lastTrophyHouse();
        if (house) {
          addImg(pos.x, pos.y - 8, "prop-trophy-banner", pos.y - 1, house.colors.primary);
          const tex = `trophy-skel-${house.beastKind ?? "eagle"}`;
          if (this.textures.exists(tex)) addImg(pos.x, pos.y - 6, tex, pos.y + 1);
        }
      }
    }

    const extraTex = chamberExtraTex(decor?.extra ?? "extra-none");
    if (extraTex) {
      const pos = cell(51, 3);
      const kind = decor.extra === "extra-keg" ? "keg" : decor.extra === "extra-amphora" ? "amphora" : "chest";
      addProp(pos.x, pos.y, kind, extraTex, true);
    }

    const bedTex = chamberBedTex(decor?.bed ?? "bed-none");
    if (bedTex) {
      const pos = cell(58, 2);
      addProp(pos.x, pos.y, "bed", bedTex, true);
    }

    const desk = cell(55, 3);
    addProp(desk.x, desk.y, "chamber", "prop-desk", true);
    this.built.spawns.chamber = desk;
    this.interactables.push({ kind: "chamber", x: desk.x, y: desk.y });

    const label = this.add
      .text(54.5 * TILE_SIZE, 0.85 * TILE_SIZE, "CHAMBER", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "11px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(5);
    this.chamberGfx.push(label);
  }

  private offerTeach(id: string): void {
    if (!gameState.save.lanistaUnlocked || !isSchoolNpc(id)) return;
    if (!schoolStudentUnlocked(id)) {
      bus.emit("toast", schoolUnlockHint(id));
      return;
    }
    if (!gameState.save.equippedWeapon) {
      bus.emit("toast", "Equip a weapon in the armory first.");
      return;
    }
    if (this.lessonsDoneThisVisit.has(id)) {
      bus.emit("toast", `${getNpc(id).name} already learned this visit. Spar (SPAR) adds Training — or book their fight.`);
      return;
    }
    if (this.drilling || this.drillDemo || this.sparring) return;
    const intro = lessonIntroLines(id as SchoolNpcId);
    bus.emit("dialogue", {
      name: intro.name,
      lines: intro.lines,
      onDone: () => this.startSpar(id, true),
    });
  }

  private onTeachStart = (id: unknown): void => {
    if (typeof id !== "string" || !isSchoolNpc(id)) return;
    if (!this.sys.isActive() || this.scene.isSleeping()) return;
    this.offerTeach(id);
  };

  private offerDrill(id: DrillId): void {
    if (!gameState.save.lanistaUnlocked) return;
    bus.emit("locker", id);
  }

  private onDrillBegin = (id: unknown): void => {
    if (typeof id !== "string" || !isDrillId(id)) return;
    if (!this.sys.isActive() || this.scene.isSleeping()) return;
    // Skip auto-demo — go straight to the practical lesson
    this.startDrill(id);
  };

  private placeInDrillYard(): void {
    const center = drillYardCenter();
    this.player.setPosition(center.x, center.y);
    this.player.facing.set(0, -1);
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    body?.reset(center.x, center.y);
    this.player.setVelocity(0, 0);
    this.player.stamina = this.player.stats.maxStamina;
    this.player.health = this.player.stats.maxHealth;
  }

  private startDrill(id: DrillId): void {
    if (this.drilling || this.sparring) return;
    this.drillReturnPos = { x: this.player.x, y: this.player.y };
    this.placeInDrillYard();
    const now = this.time.now;
    const state = createDrillState(id, now);
    this.drilling = state;
    this.drillDemo = null;
    this.drillLastNow = now;
    this.showDrillLane(id);
    const def = getDrillDef(id);
    bus.emit("drill-show", {
      title: def.lesson.toUpperCase(),
      sub: `Show ${def.studentName} · ${state.needed} clean demos`,
      score: `0/${state.needed}`,
      time: 0,
      prompt: state.prompt,
      demo: false,
    });
    audio.sfx("ui");
  }

  private showDrillLane(id: DrillId): void {
    this.clearDrillLane();
    const bounds = drillPlayBounds();
    const left = bounds.x0 * TILE_SIZE;
    const top = bounds.y0 * TILE_SIZE;
    const width = (bounds.x1 - bounds.x0 + 1) * TILE_SIZE;
    const height = (bounds.y1 - bounds.y0 + 1) * TILE_SIZE;
    const floor = this.add
      .rectangle(left + width / 2, top + height / 2, width, height, 0x2a1c12, 0.12)
      .setStrokeStyle(2, 0xc4a66e, 0.45)
      .setDepth(3);
    this.drillLaneGfx.push(floor);
    const center = drillYardCenter();
    const student = getNpc(id);
    // Student watches from the north edge — you're demonstrating for them
    const watchX = center.x;
    const watchY = top + 20;
    const tag = this.add
      .text(watchX, watchY, `${student.name.toUpperCase()} WATCHES`, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "15px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(9);
    this.drillLaneGfx.push(tag);
    const hint = this.add
      .text(watchX, watchY + 22, "You are the teacher — demonstrate the skill", {
        fontFamily: "Georgia",
        fontSize: "13px",
        color: "#c4b49a",
        stroke: "#1a1210",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(9);
    this.drillLaneGfx.push(hint);
  }

  private clearDrillLane(): void {
    for (const g of this.drillLaneGfx) g.destroy();
    this.drillLaneGfx = [];
  }

  private restoreDrillReturn(): void {
    if (!this.drillReturnPos) return;
    const p = this.drillReturnPos;
    this.drillReturnPos = null;
    this.player.setPosition(p.x, p.y);
    (this.player.body as Phaser.Physics.Arcade.Body | undefined)?.reset(p.x, p.y);
  }

  private endDrill(cancel = false): void {
    if (!this.drilling && !this.drillDemo) return;
    const state = this.drilling;
    this.drilling = null;
    this.drillDemo = null;
    this.clearDrillGfx();
    this.clearDrillLane();
    this.player.setBlocking(false);
    this.blockingHeld = false;
    bus.emit("drill-hide");
    this.restoreDrillReturn();
    if (cancel || !state) {
      bus.emit("toast", "Lesson cancelled.");
      return;
    }
    if (state.result === "pass") {
      this.lessonsDoneThisVisit.add(state.id);
      const reward = applyDrillReward(state.id);
      bus.emit("toast", reward.message);
      audio.sfx("missio");
    } else {
      bus.emit("toast", "They didn't learn enough. Demonstrate again.");
      audio.sfx("lose");
    }
  }

  private clearDrillGfx(): void {
    for (const g of this.drillGfx) g.destroy();
    this.drillGfx = [];
  }

  private syncDrillGfx(state: DrillState): void {
    this.clearDrillGfx();
    for (const t of state.telegraphs) {
      const tint =
        t.kind === "strike"
          ? 0xe07060
          : t.kind === "post"
            ? 0xe8c96a
            : t.kind === "marker"
              ? 0x7ab8e8
              : 0xe8d070;
      const scale = t.kind === "post" ? 1.05 : 0.95;
      const ring = this.add.image(t.x, t.y, "fx-ring").setTint(tint).setAlpha(0.9).setScale(scale).setDepth(8);
      this.drillGfx.push(ring);
      if (t.label) {
        const label = this.add
          .text(t.x, t.y - 40, t.label, {
            fontFamily: "Cinzel, Georgia",
            fontSize: "18px",
            color: "#fff4d8",
            stroke: "#1a1210",
            strokeThickness: 5,
          })
          .setOrigin(0.5)
          .setDepth(12);
        this.drillGfx.push(label);
      }
    }
  }

  private updateDrill(_delta: number): void {
    if (!this.drilling) return;
    const now = this.time.now;
    const state = this.drilling;

    // Tab-out / lag: don't let timers jump ahead and soft-lock the lesson
    if (this.drillLastNow > 0) {
      const gap = now - this.drillLastNow;
      if (gap > 400) shiftDrillTimers(state, gap);
    }
    this.drillLastNow = now;

    // Keep stamina full so attacks always register during teaching
    this.player.stamina = this.player.stats.maxStamina;

    const fromKeyLight = this.combat.justPressed("attack");
    const fromKeyHeavy = this.combat.justPressed("heavy");
    const light = fromKeyLight || this.drillPendingLight;
    const heavy = fromKeyHeavy || this.drillPendingHeavy;
    const dodge = this.combat.justPressed("dodge");
    this.drillPendingLight = false;
    this.drillPendingHeavy = false;
    // Raw key — fighter.setBlocking can silently fail on low-block weapons
    const blocking = this.combat.isDown("block");
    this.blockingHeld = blocking;
    if (blocking) {
      this.player.blocking = true;
      if (this.player.combat !== "attack" && this.player.combat !== "dodge") this.player.combat = "block";
    } else if (this.player.combat === "block") {
      this.player.blocking = false;
      this.player.combat = "idle";
    }

    // Keyboard visuals (UI buttons already called tryAttack via doAttack)
    if (fromKeyLight) this.player.tryAttack("light");
    if (fromKeyHeavy) this.player.tryAttack("heavy");
    if (dodge) this.player.tryDodge();

    const move = this.combat.moveVector();
    this.player.tryMove(move.x * this.player.moveSpeed * 0.9, move.y * this.player.moveSpeed * 0.9);
    const clamped = clampDrillPosition(state.id, this.player.x, this.player.y);
    if (clamped.x !== this.player.x || clamped.y !== this.player.y) {
      this.player.setPosition(clamped.x, clamped.y);
      (this.player.body as Phaser.Physics.Arcade.Body | undefined)?.reset(clamped.x, clamped.y);
    }
    this.player.syncVisuals(now);

    tickDrill(
      state,
      {
        light,
        heavy,
        dodge,
        blocking,
        playerX: this.player.x,
        playerY: this.player.y,
      },
      now,
    );
    this.syncDrillGfx(state);
    bus.emit("drill-score", {
      score: `${state.score}/${state.needed}`,
      time: 0,
      prompt: state.prompt,
    });

    if (this.combat.justPressed("interact")) {
      this.endDrill(true);
      return;
    }
    if (state.done) this.endDrill(false);
  }

  private tryActIntro(): void {
    const act = currentAct();
    const already = Boolean(gameState.save.storyFlags[actIntroFlag(act)]);
    queueActIntro();
    if (already) this.maybeFreedomSpeech();
  }

  private onActCardDone = (act: number): void => {
    if (act === 3) this.maybeFreedomSpeech();
  };

  private maybeFreedomSpeech(): void {
    if (!gameState.save.freedomWon || gameState.save.dialogueFlags.freedomSpeech || gameState.pendingFeast) return;
    if (gameState.inMenu || gameState.paused || gameState.inDialogue) return;
    gameState.save.dialogueFlags.freedomSpeech = true;
    gameState.persist();
    this.time.delayedCall(200, () => this.talkLanista());
  }

  private openChamberDoor(): void {
    for (const child of [...this.solids.getChildren()]) {
      const s = child as Phaser.Physics.Arcade.Sprite;
      const tx = Math.floor(s.x / TILE_SIZE);
      const ty = Math.floor(s.y / TILE_SIZE);
      if ((ty === 5 && (tx === 54 || tx === 55)) || (ty === 6 && (tx === 54 || tx === 55))) {
        this.solids.remove(s, true, true);
      }
    }
    for (let tx = 50; tx <= 59; tx++) {
      for (let ty = 1; ty <= 4; ty++) {
        this.chamberFloor.push(this.add.image(tx * TILE_SIZE, ty * TILE_SIZE, "tile-wood-pale").setOrigin(0).setDepth(0.5));
      }
    }
    this.chamberFloor.push(this.add.image(54 * TILE_SIZE, 5 * TILE_SIZE, "tile-wood-pale").setOrigin(0).setDepth(0.5));
    this.chamberFloor.push(this.add.image(55 * TILE_SIZE, 5 * TILE_SIZE, "tile-wood-pale").setOrigin(0).setDepth(0.5));
  }

  private talkLanista(): void {
    const offer = gameState.save.freedomWon && !gameState.save.lanistaUnlocked;
    bus.emit("dialogue", {
      name: LANISTA.name,
      lines: DIALOGUE.lanista(),
      onDone: () => {
        markTutorial("metLanista");
        if (allHouseBoutsWon() && !gameState.save.tutorialComplete) {
          markTutorial("readyForArena");
        }
        if (offer) bus.emit("lanista-offer");
      },
    });
  }

  private seatHouse(): void {
    if (gameState.pendingFeast) this.seatFeast();
    else this.returnYardSeats();
  }

  private returnYardSeats(): void {
    const posts: Record<string, string> = {
      titus: "titus",
      brom: "brom",
      aelia: "aelia",
      rufus: "rufus",
    };
    for (const [id, key] of Object.entries(posts)) {
      const npc = this.npcs.find((n) => n.npcId === id);
      const pos = this.built.spawns[key];
      if (!npc || !pos) continue;
      npc.place(pos.x, pos.y);
      const it = this.interactables.find((item) => item.kind === "npc" && item.id === id);
      if (it) {
        it.x = pos.x;
        it.y = pos.y;
      }
    }
    this.seatRufus();
  }

  private seatFeast(): void {
    const seats: Record<string, string> = {
      titus: "titusFeast",
      brom: "bromFeast",
      aelia: "aeliaFeast",
      rufus: "rufusFeast",
    };
    for (const [id, key] of Object.entries(seats)) {
      const npc = this.npcs.find((n) => n.npcId === id);
      const pos = this.built.spawns[key];
      if (!npc || !pos) continue;
      npc.place(pos.x, pos.y);
      const it = this.interactables.find((item) => item.kind === "npc" && item.id === id);
      if (it) {
        it.x = pos.x;
        it.y = pos.y;
      }
    }
  }

  private seatRufus(): void {
    const npc = this.npcs.find((n) => n.npcId === "rufus");
    const hall = this.built.spawns.rufusHall;
    const yard = this.built.spawns.rufus;
    if (!npc || !hall || !yard) return;
    const pos = rufusAtTable() ? hall : yard;
    npc.place(pos.x, pos.y);
    const it = this.interactables.find((item) => item.kind === "npc" && item.id === "rufus");
    if (it) {
      it.x = pos.x;
      it.y = pos.y;
    }
  }

  private npcCanSpar(id: string): boolean {
    if (gameState.pendingFeast) return false;
    if (id === "rufus" && rufusAtTable()) return false;
    if (!getNpc(id).canSpar) return false;
    if (!gameState.save.tutorialComplete) {
      const need = currentBoutNpc();
      return need === id;
    }
    return true;
  }

  private clearRoostGfx(): void {
    for (const g of this.roostGfx) g.destroy();
    this.roostGfx = [];
    this.palSprite = undefined;
    this.palNameTag = undefined;
    this.palShadow = undefined;
  }

  private refreshRoost(): void {
    const pos = this.built.spawns.pal;
    if (!pos) return;
    this.palHome = { x: pos.x, y: pos.y };
    this.clearRoostGfx();
    this.interactables = this.interactables.filter((it) => it.kind !== "pal");
    this.interactables.push({ kind: "pal", x: pos.x, y: pos.y });

    const home = palUnlocked();
    const stats = home ? palCombatStats() : null;

    const nestGlow = this.add.image(pos.x, pos.y - 4, "fx-glow").setDepth(3).setAlpha(0.22).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD);
    this.roostGfx.push(nestGlow);
    this.tweens.add({
      targets: nestGlow,
      alpha: { from: 0.12, to: 0.28 },
      scale: { from: 0.6, to: 0.85 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
    });

    if (home && stats) {
      const shadow = this.add.image(pos.x, pos.y + 10, "char-shadow").setDepth(1).setScale(0.85);
      this.palShadow = shadow;
      this.roostGfx.push(shadow);
      const img = this.add.image(pos.x, pos.y - 14, palTexture()).setDepth(pos.y).setScale(stats.visScale);
      if (stats.tint) img.setTint(stats.tint);
      this.palSprite = img;
      this.roostGfx.push(img);
      this.tweens.add({
        targets: img,
        y: pos.y - 20,
        duration: 980,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      const tag = this.add
        .text(pos.x, pos.y - 42, palDisplayName(), {
          fontFamily: "Cinzel, Georgia",
          fontSize: "11px",
          color: "#e8c96a",
          stroke: "#1a1210",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(pos.y + 2);
      this.palNameTag = tag;
      this.roostGfx.push(tag);
    } else {
      const tag = this.add
        .text(pos.x, pos.y - 28, "Empty perch", {
          fontFamily: "Cinzel, Georgia",
          fontSize: "11px",
          color: "#8a7a68",
          stroke: "#1a1210",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(pos.y + 2);
      this.palNameTag = tag;
      this.roostGfx.push(tag);
    }

    if (!this.roostIdleArmed) {
      this.roostIdleArmed = true;
      this.time.addEvent({
        delay: 2600,
        loop: true,
        callback: () => this.roostIdle(),
      });
    }
  }

  private roostIdle(): void {
    const pos = this.palHome;
    if (this.palSprite?.active) {
      const near = this.player && Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y) < 96;
      if (!near && Math.random() < 0.45) this.palSprite.setFlipX(!this.palSprite.flipX);
      if (Math.random() < 0.35) {
        const hop = this.palSprite;
        this.tweens.add({
          targets: hop,
          x: pos.x + Phaser.Math.Between(-6, 6),
          duration: 180,
          yoyo: true,
          ease: "Sine.easeOut",
        });
      }
    }
    for (let i = 0; i < 3; i++) {
      const bit = this.add
        .image(pos.x + Phaser.Math.Between(-18, 18), pos.y + Phaser.Math.Between(-4, 8), "fx-mote")
        .setDepth(pos.y + 3)
        .setTint(0xc4a66e)
        .setAlpha(0.55)
        .setScale(0.8);
      this.tweens.add({
        targets: bit,
        y: bit.y - 16,
        alpha: 0,
        duration: 520,
        onComplete: () => bit.destroy(),
      });
    }
  }

  private nearest(): { kind: string; x: number; y: number; id?: string; dist: number } | null {
    let best: { kind: string; x: number; y: number; id?: string; dist: number } | null = null;
    for (const it of this.interactables) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (dist < 70 && (!best || dist < best.dist)) best = { ...it, dist };
    }
    return best;
  }

  private tryInteract(): void {
    if (this.uiLocked()) return;
    if (this.sparring || this.drilling) return;
    const n = this.nearest();
    if (!n) return;
    if (n.kind === "locker" && n.id && isSchoolNpc(n.id)) {
      bus.emit("locker", n.id);
      return;
    }
    if (n.kind === "drill" && n.id && isDrillId(n.id)) {
      bus.emit("locker", n.id);
      return;
    }
    if (n.kind === "rack") {
      bus.emit("armory");
      return;
    }
    if (n.kind === "shop") {
      bus.emit("shop");
      return;
    }
    if (n.kind === "chamber") {
      bus.emit("chamber");
      return;
    }
    if (n.kind === "altar") {
      bus.emit("shrine");
      return;
    }
    if (n.kind === "pal") {
      bus.emit("roost");
      return;
    }
    if (n.kind === "trophy") {
      const house = n.id ? getHouse(n.id) : undefined;
      const animal = house?.animalName ?? "beast";
      const beaten = n.id ? gameState.save.defeatedHouses.includes(n.id) : false;
      if (beaten && house) {
        bus.emit("dialogue", {
          name: house.latinName,
          lines: [`The ${animal} hangs here. You took their champion.`],
        });
      } else {
        bus.emit("dialogue", {
          name: "Empty hook",
          lines: [`The hook waits. Beat the ${animal} champion.`],
        });
      }
      return;
    }
    if (n.kind === "dice") {
      if (!gameState.save.freedomWon) {
        bus.emit("dialogue", {
          name: "Gambling Table",
          lines: ["The lanista keeps this shut. Free men gamble. You are not free."],
        });
        return;
      }
      bus.emit("table");
      return;
    }
    if (n.kind === "wine" || n.kind === "beer") {
      this.drink(n.kind);
      return;
    }
    if (n.kind === "gate") {
      if (!gameState.save.tutorialComplete) {
        bus.emit("dialogue", {
          name: "Arena Gate",
          lines: [`The gate is barred until Marcellus names you Champion of the ${pledgedHouse()?.animalName ?? "Eagle"}.`],
        });
        return;
      }
      bus.emit("gate");
      return;
    }
    if (n.kind === "npc" && n.id) {
      if (n.id === "lanista") {
        this.talkLanista();
        return;
      }
      if (gameState.save.lanistaUnlocked && isSchoolNpc(n.id) && !this.lessonsDoneThisVisit.has(n.id)) {
        this.offerTeach(n.id);
        return;
      }
      const def = getNpc(n.id);
      const lines = DIALOGUE[n.id]?.() ?? [`${def.name} nods.`];
      bus.emit("dialogue", {
        name: def.name,
        lines,
        onDone: () => {
          if (n.id && this.npcCanSpar(n.id)) {
            this.awaitingSpar = n.id ?? null;
            bus.emit("toast", "Click SPAR to start a match");
            bus.emit("spar-available", { show: true, yield: false });
          }
        },
      });
    }
  }

  private drink(kind: "wine" | "beer"): void {
    if (!gameState.pendingFeast) {
      bus.emit("toast", "The house drinks after a champion falls.");
      return;
    }
    const result = drinkFeast(kind);
    if (result === "empty") {
      bus.emit(
        "toast",
        "The mug is empty until the next house falls.",
      );
      return;
    }
    this.player.stats = { ...playerCombatStats() };
    this.player.health = gameState.save.health;
    this.player.stamina = gameState.save.stamina;
    audio.sfx("ui");
    bus.emit(
      "toast",
      kind === "wine" ? "The wine is dark. The ache eases." : "Brom laughs. The beer is honest.",
    );
  }

  private onSparRequest = (): void => {
    if (this.uiLocked() || this.sparring || this.drilling) return;
    const n = this.nearest();
    if (n?.kind === "npc" && n.id && this.npcCanSpar(n.id)) {
      this.startSpar(n.id, false);
      return;
    }
    const nearby = this.npcs.find((npc) => {
      if (!this.npcCanSpar(npc.npcId)) return false;
      return Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y) < 90;
    });
    if (nearby) this.startSpar(nearby.npcId, false);
    else bus.emit("toast", "Stand next to Titus, Rufus, Brom, or Aelia first");
  };

  private onYield = (): void => {
    if (this.drilling || this.drillDemo) {
      this.endDrill(true);
      return;
    }
    if (this.sparring) this.endSpar(false);
  };

  private startSpar(id: string, coaching = false): void {
    if (!gameState.save.tutorialComplete) {
      const need = currentBoutNpc();
      if (!need) {
        bus.emit("toast", gameState.save.currentObjective === "return_lanista" ? "Return to Marcellus." : "Learn the yard first.");
        return;
      }
      if (id !== need) {
        bus.emit("toast", `${getNpc(need).name} first.`);
        return;
      }
    }
    if (coaching && this.lessonsDoneThisVisit.has(id)) {
      bus.emit("toast", `${getNpc(id).name} already learned this visit.`);
      return;
    }
    this.awaitingSpar = null;
    const def = getNpc(id);
    const npc = this.npcs.find((n) => n.npcId === id);
    if (npc) {
      npc.disableBody(true, false);
      npc.visual.setVisible(false);
      npc.label.setVisible(false);
      npc.setPrompt(false);
      this.hiddenNpc = npc;
    }
    const ring = this.built.spawns.dummy ?? this.built.spawns.sparRing;
    this.player.setPosition(ring.x, ring.y + 48);
    this.player.setVelocity(0, 0);
    this.player.facing.set(0, -1);
    const partnerStats = coaching && isSchoolNpc(id)
      ? { ...schoolCombatStats(id) }
      : { ...def.stats, maxHealth: Math.min(def.stats.maxHealth, 48), attack: Math.max(5, def.stats.attack - 2) };
    const enemy = new Fighter(this, ring.x, ring.y - 40, {
      key: `spar-${id}-${Date.now()}`,
      tunic: def.color,
      accent: def.accent,
      scale: def.scale,
      stats: partnerStats,
      weapon: def.weapon,
      team: "enemy",
      speed: 95 + def.stats.agility * 3,
      style: bodyStyleFor(id),
    });
    enemy.health = enemy.stats.maxHealth;
    enemy.facing.set(0, 1);
    enemy.setWeapon(def.weapon);
    this.physics.add.collider(enemy, this.solids);
    this.physics.add.collider(this.player, enemy);
    // Lessons that need presses: use aggressive AI so block/dodge beats can score
    const lessonPress = coaching && (id === "titus" || id === "brom" || id === "rufus");
    const aiStyle = lessonPress
      ? "aggressive"
      : def.aiStyle === "defensive"
        ? "sparring"
        : def.aiStyle;
    const ai = new CombatAI(enemy, aiStyle);
    attachHpBar(this, enemy, def.name);
    this.sparring = { enemy, ai, npcId: id, coaching };
    this.lessonState = coaching && isSchoolNpc(id) ? createLessonRuntime(id) : null;
    this.player.forceBlockOk = Boolean(coaching);
    bus.emit("spar-available", { show: true, yield: true });
    const bout = !gameState.save.tutorialComplete && currentBoutNpc() === id;
    if (coaching && this.lessonState) {
      bus.emit("toast", lessonPrompt(this.lessonState));
    } else {
      bus.emit("toast", bout ? `Bout vs ${def.name} — drop them. Yield does not count.` : `Sparring vs ${def.name} — attack until someone falls`);
    }
  }

  private noteLesson(ev: Parameters<typeof applyLessonEvent>[1]): void {
    if (!this.lessonState || !this.sparring?.coaching) return;
    const done = applyLessonEvent(this.lessonState, ev);
    bus.emit("toast", lessonPrompt(this.lessonState));
    if (done) this.endSpar(true);
  }

  private endSpar(playerWon: boolean): void {
    if (!this.sparring) return;
    const { enemy, ai, npcId, coaching } = this.sparring;
    const lesson = this.lessonState;
    this.sparring = null;
    this.lessonState = null;
    this.player.forceBlockOk = false;
    this.player.blocking = false;
    if (this.player.combat === "block") this.player.combat = "idle";
    ai.destroy();
    if (this.hiddenNpc) {
      const npc = this.hiddenNpc;
      this.hiddenNpc = undefined;
      try {
        npc.enableBody(true, npc.x, npc.y, true, false);
      } catch {
        npc.setActive(true);
        npc.setVisible(false);
      }
      npc.visual.setVisible(true);
      npc.label.setVisible(true);
      npc.setPrompt(false);
    }
    this.player.revive(true);
    gameState.restoreVitals();
    this.player.health = gameState.save.health;
    this.player.stamina = gameState.save.stamina;
    bus.emit("spar-available", { show: false });

    if (coaching) {
      const cleared = Boolean(lesson?.complete);
      if (playerWon && cleared) {
        this.lessonsDoneThisVisit.add(npcId);
        const reward = applyCoachingLesson(npcId);
        bus.emit("result", {
          title: "Lesson learned",
          body: `You taught the full lesson.\n\n${reward.message}\n\nCheck their locker, then book their circuit from The School.`,
        });
        audio.sfx("missio");
      } else {
        bus.emit("result", {
          title: "Lesson unfinished",
          body: `${getNpc(npcId).name} still watches.\nClear all three beats in the yard.\nYield does not count as a lesson.`,
        });
        audio.sfx("lose");
      }
      this.time.delayedCall(0, () => {
        if (enemy.active) enemy.destroy();
      });
      return;
    }

    const reward = applySparReward(npcId, playerWon);
    markTutorial("sparred");
    if (playerWon && !gameState.save.tutorialComplete) {
      const flag = BOUT_FLAGS[npcId as keyof typeof BOUT_FLAGS];
      if (flag) markTutorial(flag);
    }
    const named = playerWon && allHouseBoutsWon() && gameState.save.currentObjective === "return_lanista";
    bus.emit("result", {
      title: playerWon ? (named ? "The yard is yours" : "Spar won") : "Spar lost",
      body: playerWon
        ? named
          ? `${getNpc(npcId).name} yields.\n+${reward.xp} XP  ·  +${reward.denarii} denarii\nThe four are down. Return to Marcellus.`
          : `${getNpc(npcId).name} yields.\n+${reward.xp} XP  ·  +${reward.denarii} denarii\nNo one is hurt. That is the point of the yard.`
        : `${getNpc(npcId).name} stops the match.\nYou learn something anyway.\n+${reward.xp} XP`,
    });
    this.time.delayedCall(0, () => {
      if (enemy.active) enemy.destroy();
    });
  }

  private afterResult = (): void => {
    /* overlay closed */
  };

  private onCosmeticsChanged = (): void => {
    const look = playerLook();
    this.player.applyLook(look.tunic, look.accent, look.style, look.cape, look.scar, look.crest);
    this.refreshChamber();
  };

  private onRoostChanged = (): void => {
    this.refreshRoost();
  };

  private onUnstuck = (): void => {
    if (!this.sys.isActive() || this.scene.isSleeping()) return;
    const dummy = this.built.spawns.dummy;
    const yard = this.built.spawns.player;
    const pos = this.sparring && dummy ? { x: dummy.x, y: dummy.y + 48 } : yard;
    if (!pos) return;
    this.player.setPosition(pos.x, pos.y);
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      body.enable = true;
      body.reset(pos.x, pos.y);
      body.setVelocity(0, 0);
    }
    gameState.save.position = { x: pos.x, y: pos.y, scene: "ludus" };
  };

  private onSkillsChanged = (): void => {
    this.player.refreshSkills();
    this.player.health = gameState.save.health;
    this.player.stamina = gameState.save.stamina;
  };

  private onWeapon = (id: string): void => {
    this.player.setWeapon(id as typeof this.player.weaponId);
    markTutorial("equippedWeapon");
    if (isTeachingLesson()) this.placeForTeachingLesson();
  };

  /** Drop the player on the open ring for dummy teaching steps. */
  private placeForTeachingLesson(): void {
    if (this.sparring || this.drilling || this.drillDemo) return;
    const ring = this.built.spawns.sparRing ?? this.built.spawns.dummy;
    if (!ring) return;
    const x = ring.x;
    const y = ring.y + 8;
    this.player.setPosition(x, y);
    this.player.facing.set(-1, 0);
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      body.reset(x, y);
      body.setVelocity(0, 0);
    }
    gameState.save.position = { x, y, scene: "ludus" };
  }

  private goArena = (): void => {
    if (this.drilling || this.drillDemo) this.endDrill(true);
    if (this.sparring) this.endSpar(false);
    gameState.save.position = { x: this.player.x, y: this.player.y, scene: "ludus" };
    gameState.persist();
    bus.emit("minimap-scene", "none");
    audio.setHall(false);
    // Stop (don't sleep) — wake-from-sleep was freezing returns after arena
    this.scene.launch("ArenaScene");
    this.scene.stop();
  };

  update(_t: number, delta: number): void {
    if (!this.player) return;
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    audio.setHall(
      (tx >= 1 && tx <= 12 && ty >= 14 && ty <= 21) ||
        (tx >= 27 && tx <= 47 && ty >= 1 && ty <= 12) ||
        inFeastTiles(tx, ty) ||
        inShrineTiles(tx, ty) ||
        inChamberTiles(tx, ty) ||
        inDrillYardTiles(tx, ty),
    );
    if (gameState.pendingFeast && !inFeastTiles(tx, ty)) {
      gameState.endFeast();
      this.seatHouse();
      if (gameState.save.freedomWon && !gameState.save.dialogueFlags.freedomSpeech) {
        this.maybeFreedomSpeech();
      }
    }
    if (this.uiLocked()) {
      this.player.setVelocity(0, 0);
      this.player.syncVisuals(this.time.now);
      return;
    }
    if (this.drilling || this.drillDemo) {
      this.updateDrill(delta);
      return;
    }

    const move = this.combat.moveVector();
    const speed = this.player.moveSpeed;
    this.player.tryMove(move.x * speed, move.y * speed);
    if (this.combat.justPressed("attack")) this.doAttack("light");
    if (this.combat.justPressed("heavy")) this.doAttack("heavy");
    if (this.combat.justPressed("interact")) this.tryInteract();
    if (this.combat.justPressed("dodge")) {
      if (this.player.tryDodge()) markTutorial("dodged");
    }
    if (this.combat.justPressed("special")) this.player.trySpecial();
    if (this.combat.justPressed("parry")) {
      this.player.tryParry();
      if (!gameState.save.tutorialComplete) markTutorial("parried");
    }
    if (this.combat.justPressed("unguent")) this.player.tryUnguent();
    // Coaching lessons: hold-block works even on low-block weapons (same path as old drills)
    if (this.sparring?.coaching) {
      const holding = this.combat.isDown("block");
      this.blockingHeld = holding;
      if (holding) {
        this.player.blocking = true;
        if (this.player.combat !== "attack" && this.player.combat !== "dodge" && this.player.combat !== "parry") {
          this.player.combat = "block";
        }
        markTutorial("blocked");
      } else if (this.player.combat === "block") {
        this.player.blocking = false;
        this.player.combat = "idle";
      }
    } else {
      const block = this.combat.pollBlock();
      if (block === "start") {
        this.blockingHeld = true;
        this.player.setBlocking(true);
        if (this.player.blocking) markTutorial("blocked");
      } else if (block === "end") {
        this.blockingHeld = false;
        this.player.setBlocking(false);
      }
      if (this.blockingHeld) this.player.setBlocking(true);
    }
    this.player.regen(delta);
    audio.footstep(delta, Boolean(move.x || move.y));

    if (this.player.hitboxActive) {
      for (const d of this.dummies) {
        const c = this.player.attackCenter();
        if (Phaser.Math.Distance.Between(c.x, c.y, d.x, d.y) < this.player.attackRadius() + 12) {
          d.bonk();
          dummyStrikeFeedback(this, d.x, d.y);
          this.player.hitboxActive = false;
          this.player.registerCombo();
          markTutorial("hitDummy");
          if (gameState.save.tutorialFlags.dodged && !gameState.save.tutorialFlags.perfectDodgeHint) {
            gameState.setFlag("perfectDodgeHint");
            gameState.persist();
            bus.emit("toast", "Shift through a strike for a perfect dodge.");
          }
          const gained = applyDummyXp();
          if (gained.xp > 0) {
            this.dummyCapTold = false;
            const t = this.add
              .text(d.x, d.y - 28, `+${gained.xp} XP`, {
                fontFamily: "Cinzel, Georgia",
                fontSize: "14px",
                color: "#8ecf6a",
                stroke: "#1a1210",
                strokeThickness: 4,
              })
              .setOrigin(0.5)
              .setDepth(4000);
            this.tweens.add({
              targets: t,
              y: t.y - 22,
              alpha: 0,
              duration: 700,
              onComplete: () => t.destroy(),
            });
          } else if (!this.dummyCapTold) {
            this.dummyCapTold = true;
            bus.emit("toast", "The dummy has nothing more to teach until you grow stronger.");
          }
        }
      }
      if (this.sparring) {
        resolveHits(this.player, [this.sparring.enemy], (_t, kind) => {
          if (!this.sparring?.coaching) return;
          if (kind === "hit" || kind === "block") {
            const ak = this.player.attackKind;
            if (ak === "heavy") this.noteLesson({ type: "player_heavy" });
            else this.noteLesson({ type: "player_light" });
          }
        });
      }
    }

    this.player.updateNet(this.sparring ? [this.sparring.enemy] : [], delta);
    if (this.sparring) this.sparring.enemy.updateNet([this.player], delta);

    if (this.sparring) {
      this.sparring.ai.update(this.player, this.time.now);
      this.sparring.enemy.syncVisuals(this.time.now);
      if (this.sparring.enemy.hitboxActive) {
        resolveHits(this.sparring.enemy, [this.player], (_t, kind) => {
          if (!this.sparring?.coaching) return;
      if (kind === "block") this.noteLesson({ type: "player_block" });
          else if (kind === "perfect" || (kind === "miss" && this.player.combat === "dodge")) this.noteLesson({ type: "player_dodge" });
          else if (kind === "hit") this.noteLesson({ type: "player_hurt" });
        });
      }
      if (!this.player.alive) {
        this.endSpar(false);
        return;
      }
      if (!this.sparring.enemy.alive) {
        if (this.sparring.coaching && this.lessonState && !this.lessonState.complete) {
          this.sparring.enemy.revive(true);
          bus.emit("toast", "Stay with the lesson — " + lessonPrompt(this.lessonState));
        } else {
          this.endSpar(true);
          return;
        }
      }
    }

    this.player.syncVisuals(this.time.now);
    this.npcs.forEach((npc) => {
      if (npc.visual.visible) npc.visual.setFlipX(this.player.x < npc.x);
    });
    if (this.palSprite?.active) {
      const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.palHome.x, this.palHome.y) < 96;
      if (near) this.palSprite.setFlipX(this.player.x < this.palSprite.x);
    }
    gameState.save.health = this.player.health;
    gameState.save.stamina = this.player.stamina;
    const live = playerCombatStats();
    this.player.stats.maxHealth = live.maxHealth;
    this.player.stats.maxStamina = live.maxStamina;
    this.player.stats.attack = live.attack;
    this.player.stats.defense = live.defense;
    this.player.stats.agility = live.agility;
    this.emitMinimap();

    const n = this.nearest();
    if (gameState.paused || gameState.inMenu) {
      /* keep combat UI from covering result / pause screens */
    } else if (this.sparring) {
      bus.emit("spar-available", { show: true, yield: true });
      bus.emit("talk-available", { show: false });
    } else if (this.drilling || this.drillDemo) {
      bus.emit("spar-available", { show: true, yield: true });
      bus.emit("talk-available", { show: false });
    } else if (n?.kind === "npc" && n.id && this.npcCanSpar(n.id)) {
      bus.emit("spar-available", { show: true, yield: false });
    } else {
      bus.emit("spar-available", { show: false });
    }
    if (n && !this.sparring && !this.drilling && !this.drillDemo && !gameState.paused && !gameState.inMenu) {
      const talkLabel =
        n.kind === "rack"
          ? "ARMORY"
          : n.kind === "gate"
            ? "ARENA"
            : n.kind === "shop"
              ? "QUARTERS"
              : n.kind === "chamber"
                ? "CHAMBER"
                : n.kind === "locker" || n.kind === "drill"
                  ? n.id && isSchoolNpc(n.id) && getSchoolRecord(n.id).glory
                    ? "DONE"
                    : "LOCKER"
                  : n.kind === "pal"
                    ? "ROOST"
                    : n.kind === "trophy"
                      ? "MOUNT"
                      : n.kind === "dice"
                        ? gameState.save.freedomWon
                          ? "TABLE"
                          : "LOCKED"
                        : n.kind === "wine"
                          ? "WINE"
                          : n.kind === "beer"
                            ? "BEER"
                            : n.kind === "altar"
                              ? "PRAY"
                              : "TALK";
      bus.emit("talk-available", { show: true, label: talkLabel });
      this.nearestHint!.setVisible(true).setPosition(this.player.x, this.player.y + 28);
      const canSpar = n.kind === "npc" && n.id ? this.npcCanSpar(n.id) : false;
      const label =
        n.kind === "npc"
          ? canSpar
            ? gameState.save.lanistaUnlocked &&
              isSchoolNpc(n.id!) &&
              schoolStudentUnlocked(n.id!) &&
              !this.lessonsDoneThisVisit.has(n.id!)
              ? "E Teach · SPAR trains"
              : "E Talk   or click SPAR"
            : "E  Talk"
          : n.kind === "rack"
            ? "E  Armory"
            : n.kind === "gate"
              ? "E  Arena"
              : n.kind === "shop"
                ? "E  Quarters"
                : n.kind === "chamber"
                  ? "E  Chamber"
                  : n.kind === "locker" || n.kind === "drill"
                    ? n.id && isSchoolNpc(n.id) && getSchoolRecord(n.id).glory
                      ? "E  Done"
                      : "E  Locker"
                    : n.kind === "pal"
                      ? "E  Roost"
                      : n.kind === "trophy"
                        ? "E  Inspect"
                        : n.kind === "dice"
                      ? gameState.save.freedomWon
                        ? "E  Table"
                        : "E  Locked"
                      : n.kind === "wine"
                        ? "E  Wine"
                        : n.kind === "beer"
                          ? "E  Beer"
                          : n.kind === "altar"
                            ? "E  Pray"
                      : "";
      this.nearestHint!.setText(label);
      this.npcs.forEach((npc) => {
        const teach =
          gameState.save.lanistaUnlocked &&
          isSchoolNpc(npc.npcId) &&
          schoolStudentUnlocked(npc.npcId) &&
          !this.lessonsDoneThisVisit.has(npc.npcId);
        const locked =
          gameState.save.lanistaUnlocked && isSchoolNpc(npc.npcId) && !schoolStudentUnlocked(npc.npcId);
        npc.setPrompt(
          n.id === npc.npcId,
          teach ? "E Teach · SPAR trains" : locked ? "E  Locked" : this.npcCanSpar(npc.npcId) ? "SPAR / E" : "E  Talk",
        );
      });
    } else {
      if (!this.sparring && !this.drilling && (gameState.paused || gameState.inMenu || !n)) {
        bus.emit("talk-available", { show: false });
      }
      this.nearestHint!.setVisible(false);
      this.npcs.forEach((npc) => npc.setPrompt(false));
    }
  }

  private emitMinimap(): void {
    const marks: { x: number; y: number; color: number; kind: string }[] = [];
    const sp = this.built.spawns;
    if (sp.lanista) marks.push({ x: sp.lanista.x, y: sp.lanista.y, color: 0xd4a84b, kind: "lanista" });
    for (const npc of this.npcs) {
      if (npc.visual.visible) marks.push({ x: npc.x, y: npc.y, color: 0x7ab8a4, kind: "npc" });
    }
    for (const it of this.interactables) {
      if (it.kind === "rack") marks.push({ x: it.x, y: it.y, color: 0xe07060, kind: "armory" });
      if (it.kind === "shop") marks.push({ x: it.x, y: it.y, color: 0xe8c96a, kind: "shop" });
      if (it.kind === "chamber") marks.push({ x: it.x, y: it.y, color: 0xe8c96a, kind: "chamber" });
      if (it.kind === "drill" || it.kind === "locker") marks.push({ x: it.x, y: it.y, color: 0x7ab8e8, kind: "locker" });
      if (it.kind === "pal") marks.push({ x: it.x, y: it.y, color: 0xe8c96a, kind: "pal" });
      if (it.kind === "gate") marks.push({ x: it.x, y: it.y, color: 0xc45a1a, kind: "gate" });
      if (it.kind === "trophy") marks.push({ x: it.x, y: it.y, color: 0xc4a060, kind: "trophy" });
      if (it.kind === "dice") marks.push({ x: it.x, y: it.y, color: 0xd4a84b, kind: "dice" });
      if (it.kind === "wine" || it.kind === "beer") marks.push({ x: it.x, y: it.y, color: 0xa33b2b, kind: "feast" });
      if (it.kind === "altar") marks.push({ x: it.x, y: it.y, color: 0xe8c96a, kind: "shrine" });
    }
    if (gameState.save.lanistaUnlocked && sp.drillYard) {
      marks.push({ x: sp.drillYard.x, y: sp.drillYard.y, color: 0x7ab8e8, kind: "drillYard" });
    }
    bus.emit("minimap", {
      show: true,
      cols: this.built.cols,
      rows: this.built.rows,
      playerX: this.player.x,
      playerY: this.player.y,
      area: ludusAreaName(Math.floor(this.player.x / TILE_SIZE), Math.floor(this.player.y / TILE_SIZE)),
      marks,
    });
  }

  private setupDebug(): void {
    if (!this.registry.get("debug")) return;
    const kb = this.input.keyboard!;
    kb.on("keydown-F2", () => {
      this.player.revive(true);
      gameState.restoreVitals();
      bus.emit("toast", "Health restored");
    });
    kb.on("keydown-F3", () => {
      gameState.save.denarii += 100;
      bus.emit("toast", "+100 denarii");
    });
    kb.on("keydown-F4", () => {
      gameState.unlockWeapon("spear");
      gameState.unlockWeapon("dual_blades");
      gameState.unlockWeapon("securis");
      gameState.unlockWeapon("trident_net");
      gameState.unlockWeapon("malleus");
      bus.emit("toast", "Weapons unlocked");
    });
    kb.on("keydown-F5", () => {
      skipTutorial();
      bus.emit("toast", "Tutorial skipped");
    });
    kb.on("keydown-F6", () => {
      skipTutorial();
      gameState.pendingArenaOpponent = rivalHouses()[0]?.fighters[0]?.id ?? "serp_1";
      this.goArena();
    });
    kb.on("keydown-F7", () => {
      skipTutorial();
      const first = rivalHouses()[0];
      if (first) {
        gameState.save.defeatedHouses = [first.id];
        gameState.save.defeatedOpponents = first.fighters.map((f) => f.id);
        gameState.unlockWeapon("spear");
        gameState.unlockWeapon("dual_blades");
        gameState.unlockWeapon("securis");
        gameState.save.palUnlocked = true;
        gameState.save.palBrought = true;
        gameState.setObjective("next_house");
        gameState.persist();
        this.refreshRoost();
        this.refreshHall();
        this.refreshShrine();
        this.refreshChamber();
        bus.emit("toast", `${first.animalName} beaten — next house open`);
      }
    });
    kb.on("keydown-F8", () => {
      skipTutorial();
      const houses = rivalHouses();
      gameState.save.defeatedHouses = houses.map((h) => h.id);
      gameState.save.defeatedOpponents = houses.flatMap((h) => h.fighters.map((f) => f.id));
      gameState.unlockWeapon("spear");
      gameState.unlockWeapon("dual_blades");
      gameState.unlockWeapon("securis");
      gameState.unlockWeapon("trident_net");
      gameState.unlockWeapon("malleus");
      gameState.save.palUnlocked = true;
      gameState.save.palBrought = true;
      gameState.setObjective("tournament_1");
      gameState.persist();
      this.refreshRoost();
      this.refreshHall();
      this.refreshShrine();
      this.refreshChamber();
      bus.emit("toast", "Circuit beaten — Rudis open");
    });
    this.add
      .text(8, 80, "DEBUG F2 HP  F3 coin  F4 wep  F5 skip  F6 arena  F7 next house  F8 rudis", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#6a5a4a",
      })
      .setScrollFactor(0)
      .setDepth(50);
  }
}
