import Phaser from "phaser";
import { TILE_SIZE, GAME_WIDTH, GAME_HEIGHT } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { audio } from "../systems/audio";
import { animateBrazier, paintMap, placeLamp } from "../systems/worldRender";
import { buildRaidRoom } from "../maps/maps";
import { Fighter, attachHpBar } from "../entities/Fighter";
import { NpcActor } from "../entities/World";
import { playerLook } from "../data/shop";
import { getHouse } from "../data/houses";
import { CombatAI } from "../systems/ai";
import { bodyStyleFor } from "../systems/assets";
import { resolveHits } from "../systems/combat";
import { playerCombatStats, addDenarii, addXp } from "../systems/progression";
import { returnFromRaid } from "../systems/playFlow";
import { ArenaBeast } from "../entities/Beast";
import { palBrought, palCombatStats, palKind } from "../data/pal";
import { CombatInput } from "../systems/input";
import {
  camp,
  clearRoomGuards,
  getRaidProgress,
  isRoomCleared,
  markHouseFreed,
  markRoomCleared,
  activeMarchBuff,
  mealBuffStats,
} from "../data/camp";
import { companionCombatStats, companionWeapon, getCompanionDef } from "../data/companions";
import type { CompanionId, ObjectiveId, RaidHouseId, VolunteerId } from "../types";
import { refugeesForHouse } from "../data/refugees";
import {
  getVolunteerDef,
  unlockHouseVolunteers,
  volunteerBriefingLine,
  volunteerUnlockLabel,
} from "../data/volunteers";
import {
  getLiberation,
  getRaid,
  getRaidBriefing,
  getRaidRoom,
  liberationChainFlag,
  liberationFlag,
  nextUnlockedRaidHouse,
  bossRaidReward,
  RAID_HOUSE_ORDER,
  type RaidDef,
  type RaidGuardDef,
  type RaidRoomDef,
  type RaidFacing,
  type RaidPuzzle,
} from "../data/raid";

type AllyPack = { fighter: Fighter; ai: CombatAI; id: CompanionId };
type VolunteerPack = { fighter: Fighter; ai: CombatAI; id: VolunteerId; houseId: RaidHouseId };
type EnemyPack = { fighter: Fighter; ai: CombatAI; isBoss?: boolean };

const AGGRO_RADIUS = 110;
const AMBUSH_AGGRO = 52;
const ALERT_RIPPLE = 140;
const ROAR_RIPPLE = 200;
const MUD_SLOW = 0.65;
const DARK_SLOW = 0.78;
const RUBBLE_TICK_MS = 420;
const RUBBLE_DMG = 4;

const PROP_TEX: Record<string, string> = {
  hay: "prop-hay",
  brazier: "prop-brazier",
  rack: "prop-rack",
  shieldstand: "prop-shieldstand",
  "pit-tusk": "prop-pit-tusk",
  "pit-skull": "prop-pit-skull",
  "pit-horn": "prop-pit-horn",
  "pit-log": "prop-pit-log",
  "pit-ivory": "prop-pit-ivory",
  vine: "prop-pit-vine",
  fence: "tile-fence",
  lamp: "prop-lamp",
};

const FACE_NEXT: Record<RaidFacing, RaidFacing> = { up: "right", right: "down", down: "left", left: "up" };
const FACE_ANGLE: Record<RaidFacing, number> = { right: 0, down: 90, left: 180, up: -90 };
const STATUE_TEX: Record<string, string> = { serpent: "beast-serpent", wolf: "beast-wolf", boar: "beast-boar" };
const STATUE_TINT: Record<string, number> = { serpent: 0x8ecf6a, wolf: 0xb8c0c8, boar: 0xc4a070 };

type HazardZone = {
  kind: "mud" | "dark" | "rubble" | "stampede";
  x: number;
  y: number;
  w: number;
  h: number;
  periodMs?: number;
  axis?: "x" | "y";
  sweep?: Phaser.GameObjects.Rectangle;
  nextTickAt?: number;
  lastStampedeWarn?: number;
};

type PuzzleStatue = {
  x: number;
  y: number;
  facing: RaidFacing;
  vis: Phaser.GameObjects.Image;
  base: Phaser.GameObjects.Image;
};
type PuzzleStep = {
  col: number;
  row: number;
  x: number;
  y: number;
  safe: boolean;
  goal: boolean;
  img: Phaser.GameObjects.Image;
};
type PuzzleBrazier = { x: number; y: number; index: number; lit: boolean; img: Phaser.GameObjects.Image };
type PuzzlePlate = { x: number; y: number; index: number; down: boolean; until: number; img: Phaser.GameObjects.Image };

/**
 * Act 4 room-based night raid. Party of you + 2 allies. Ally KO lasts until next room.
 * Player death → Freed Camp (current room guards respawn; cleared rooms stay).
 */
export class RaidScene extends Phaser.Scene {
  private player!: Fighter;
  private allies: AllyPack[] = [];
  private volunteer?: VolunteerPack;
  private volunteerHouse: RaidHouseId | null = null;
  private lupusPackToastShown = false;
  private leoVolunteerRoared = false;
  private enemies: EnemyPack[] = [];
  private pal?: ArenaBeast;
  private combat!: CombatInput;
  private blockingHeld = false;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private room!: RaidRoomDef;
  private raid!: RaidDef;
  private houseId = "serpens";
  private interactables: { kind: string; x: number; y: number; id?: string; to?: string }[] = [];
  private nearestHint?: Phaser.GameObjects.Text;
  private ended = false;
  private roomHud?: Phaser.GameObjects.Text;
  private combatHeld = true;
  private clearAnnounced = false;
  private transitioning = false;
  private doorGlow?: Phaser.GameObjects.Rectangle;
  private hazardZones: HazardZone[] = [];
  private baseMoveSpeed = 140;
  private liberationPlaying = false;
  private liberationDone?: () => void;
  private liberationTimers: Phaser.Time.TimerEvent[] = [];
  private liberationCaptives: { npc: NpcActor; chains: Phaser.GameObjects.Image[] }[] = [];
  private liberationSkipAt = 0;
  private liberationSawAttackUp = true;
  private raidZoom = 1;
  private liberationFx: Phaser.GameObjects.GameObject[] = [];
  private puzzleLocked = false;
  private puzzleStatues: PuzzleStatue[] = [];
  private puzzleSteps: PuzzleStep[] = [];
  private puzzleStepPit?: { x: number; y: number; w: number; h: number };
  private puzzleLastSafe = { x: 0, y: 0 };
  private puzzleLastCell = "";
  private puzzleBraziers: PuzzleBrazier[] = [];
  private puzzleBrazierNext = 0;
  private puzzlePlates: PuzzlePlate[] = [];
  private puzzlePlateNext = 0;
  private puzzleGoal?: { x: number; y: number; img: Phaser.GameObjects.Image };

  constructor() {
    super("RaidScene");
  }

  init(): void {
    this.allies = [];
    this.volunteer = undefined;
    this.volunteerHouse = null;
    this.lupusPackToastShown = false;
    this.leoVolunteerRoared = false;
    this.enemies = [];
    this.pal = undefined;
    this.interactables = [];
    this.ended = false;
    this.blockingHeld = false;
    this.combatHeld = true;
    this.clearAnnounced = false;
    this.transitioning = false;
    this.doorGlow = undefined;
    this.hazardZones = [];
    this.liberationPlaying = false;
    this.liberationDone = undefined;
    this.liberationTimers = [];
    this.liberationCaptives = [];
    this.liberationSkipAt = 0;
    this.liberationSawAttackUp = true;
    this.raidZoom = 1;
    this.liberationFx = [];
    this.puzzleLocked = false;
    this.puzzleStatues = [];
    this.puzzleSteps = [];
    this.puzzleStepPit = undefined;
    this.puzzleLastCell = "";
    this.puzzleBraziers = [];
    this.puzzleBrazierNext = 0;
    this.puzzlePlates = [];
    this.puzzlePlateNext = 0;
    this.puzzleGoal = undefined;
    this.houseId = gameState.pendingRaidHouse ?? "serpens";
  }

  create(): void {
    const raid = getRaid(this.houseId);
    if (!raid) {
      returnFromRaid(this.game, { death: false });
      return;
    }
    this.raid = raid;
    const roomId = gameState.pendingRaidRoom ?? raid.startRoom;
    const room = getRaidRoom(this.houseId, roomId);
    if (!room) {
      returnFromRaid(this.game, { death: false });
      return;
    }
    this.room = room;
    gameState.pendingRaidRoom = room.id;

    const floor =
      room.floorTex ??
      (room.kind === "puzzle" ? "tile-stone" : room.kind === "boss" ? "tile-sand-coil" : "tile-sand");
    const built = buildRaidRoom(room.cols, room.rows, floor, {
      torchTint: raid.torchTint,
      extraProps: room.props,
    });
    this.solids = paintMap(this, built, "raid");
    this.fitRaidCamera(built.cols, built.rows);
    if (raid.nightTint) this.cameras.main.setBackgroundColor(raid.nightTint);
    audio.setMusicMood(room.kind === "boss" ? "arena" : "night");

    for (const p of built.props) {
      if (p.kind === "lamp") placeLamp(this, p.x, p.y, true);
      else this.placeDressingProp(p.kind, p.x, p.y);
    }

    for (const h of room.hazards ?? []) {
      if (h.kind === "mud") {
        this.hazardZones.push({ kind: "mud", x: h.x, y: h.y, w: h.w, h: h.h });
        this.add.ellipse(h.x, h.y, h.w, h.h, 0x3a2818, 0.45).setDepth(3);
        this.add.ellipse(h.x, h.y, h.w * 0.7, h.h * 0.7, 0x2a1c10, 0.35).setDepth(3);
      } else if (h.kind === "dark") {
        this.hazardZones.push({ kind: "dark", x: h.x, y: h.y, w: h.w, h: h.h });
        this.add.ellipse(h.x, h.y, h.w, h.h, 0x0a1020, 0.55).setDepth(3);
        this.add.ellipse(h.x, h.y, h.w * 0.75, h.h * 0.75, 0x040810, 0.4).setDepth(3);
      } else if (h.kind === "rubble") {
        this.hazardZones.push({ kind: "rubble", x: h.x, y: h.y, w: h.w, h: h.h, nextTickAt: 0 });
        this.add.rectangle(h.x, h.y, h.w, h.h, 0x5a4030, 0.35).setStrokeStyle(2, 0x8a6040, 0.5).setDepth(3);
        this.add.rectangle(h.x, h.y, h.w * 0.7, h.h * 0.55, 0x3a2818, 0.4).setDepth(3);
      } else if (h.kind === "stampede") {
        const zone: HazardZone = {
          kind: "stampede",
          x: h.x,
          y: h.y,
          w: h.w,
          h: h.h,
          periodMs: h.periodMs ?? 3200,
          axis: h.axis ?? "x",
        };
        this.add.rectangle(h.x, h.y, h.w, h.h, 0x6a5040, 0.18).setStrokeStyle(1, 0xc4a878, 0.35).setDepth(2);
        const sweepW = zone.axis === "x" ? 36 : h.w;
        const sweepH = zone.axis === "y" ? 36 : h.h;
        zone.sweep = this.add.rectangle(h.x - h.w / 2, h.y, sweepW, sweepH, 0xc45a1a, 0.45).setDepth(4);
        this.hazardZones.push(zone);
      }
    }

    const meal = activeMarchBuff();
    const hpBonus = gameState.raidTempHpBonus;
    const look = playerLook();
    const base = playerCombatStats();
    this.player = new Fighter(this, room.spawn.x, room.spawn.y, {
      key: "player-raid",
      tunic: look.tunic,
      accent: look.accent,
      style: look.style,
      cape: look.cape,
      scar: look.scar,
      crest: look.crest,
      stats: {
        ...base,
        maxHealth: base.maxHealth + meal.hp + hpBonus,
        maxStamina: base.maxStamina + meal.stamina,
        attack: base.attack + meal.attack,
      },
      weapon: gameState.save.equippedWeapon ?? "gladius",
      team: "player",
    });
    this.player.health = Math.min(this.player.stats.maxHealth, Math.max(1, gameState.save.health));
    this.player.stamina = this.player.stats.maxStamina;
    this.baseMoveSpeed = this.player.moveSpeed;
    this.physics.add.collider(this.player, this.solids);
    attachHpBar(this, this.player, gameState.save.playerName, this.raidHud("player"));

    this.spawnAllies(room);
    this.spawnVolunteer(room);
    this.spawnThreats(room);
    this.spawnPal(room);
    this.spawnRoomProps(room);
    this.spawnPuzzle(room);

    this.combat = new CombatInput(this);
    if (this.pal) bus.emit("pal-hp-show");
    bus.on("player-attack", this.doAttack, this);
    bus.on("player-special", this.doSpecial, this);
    this.events.once("shutdown", () => {
      bus.emit("pal-hp-hide");
      bus.emit("combat-hud", { show: false });
      bus.off("player-attack", this.doAttack, this);
      bus.off("player-special", this.doSpecial, this);
      this.pal?.destroy();
      this.pal = undefined;
    });

    this.nearestHint = this.add
      .text(0, 0, "", { fontFamily: "Georgia", fontSize: "14px", color: "#d4a84b", stroke: "#1a1210", strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(9000)
      .setVisible(false);

    this.roomHud = this.add
      .text(12, 8, room.name, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "18px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setScrollFactor(0)
      .setDepth(8000)
      .setScale(1 / this.raidZoom);

    this.beginRoomBreath();
    bus.emit("combat-hud", { show: true });
  }

  private raidBusy(): boolean {
    return gameState.paused || gameState.inMenu || gameState.inDialogue || this.combatHeld || this.transitioning || this.ended;
  }

  private doAttack = (kind: unknown = "light"): void => {
    if (this.raidBusy() || !this.player) return;
    this.player.tryAttack(kind === "heavy" ? "heavy" : "light");
  };

  private doSpecial = (): void => {
    if (this.raidBusy() || !this.player) return;
    this.player.trySpecial();
  };

  private placeDressingProp(kind: string, x: number, y: number): void {
    const tex = PROP_TEX[kind];
    if (!tex || !this.textures.exists(tex)) return;
    this.add.image(x, y, tex).setDepth(y);
    if (kind === "brazier") animateBrazier(this, x, y);
  }

  /** Zoom so the full raid room is visible — never magnify past 1:1. */
  private fitRaidCamera(cols: number, rows: number): void {
    const worldW = cols * TILE_SIZE;
    const worldH = rows * TILE_SIZE;
    const fit = Math.min(GAME_WIDTH / worldW, GAME_HEIGHT / worldH) * 0.96;
    this.raidZoom = Math.min(1, fit);
    const cam = this.cameras.main;
    cam.stopFollow();
    cam.setZoom(this.raidZoom);
    this.scrollRaidCamera(worldW, worldH);
  }

  private scrollRaidCamera(worldW: number, worldH: number): void {
    const cam = this.cameras.main;
    const viewW = GAME_WIDTH / this.raidZoom;
    const viewH = GAME_HEIGHT / this.raidZoom;
    if (viewW <= worldW && viewH <= worldH) {
      cam.setBounds(0, 0, worldW, worldH);
      cam.centerOn(worldW / 2, worldH / 2);
    } else {
      cam.removeBounds();
      cam.setScroll((worldW - viewW) / 2, (worldH - viewH) / 2);
    }
  }

  private centerRaidCamera(): void {
    const worldW = this.room.cols * TILE_SIZE;
    const worldH = this.room.rows * TILE_SIZE;
    this.scrollRaidCamera(worldW, worldH);
  }

  private beginRoomBreath(): void {
    this.combatHeld = true;
    const briefing = getRaidBriefing(this.houseId, this.room.id);
    const volunteerLine = volunteerBriefingLine(this.houseId);
    bus.emit("raid-title", {
      title: briefing.title,
      subtitle: briefing.subtitle,
      holdMs: 1200,
      onDone: () => {
        if (briefing.dialogue) {
          const lines = [...briefing.dialogue.lines];
          if (volunteerLine) lines.push(volunteerLine);
          bus.emit("dialogue", {
            name: briefing.dialogue.name,
            lines,
            onDone: () => this.unlockCombat(),
          });
        } else if (volunteerLine) {
          bus.emit("dialogue", {
            name: "Cassian",
            lines: [volunteerLine],
            onDone: () => this.unlockCombat(),
          });
        } else {
          this.unlockCombat();
        }
      },
    });
  }

  private unlockCombat(): void {
    this.combatHeld = false;
    if (
      this.volunteerHouse === "leo" &&
      this.volunteer?.fighter.alive &&
      !this.leoVolunteerRoared &&
      this.raid.alertMode !== "pack"
    ) {
      this.leoVolunteerRoared = true;
      this.alertNearby(this.volunteer.fighter, ROAR_RIPPLE);
      const vName = getVolunteerDef(this.volunteer.id)?.name ?? "House ally";
      bus.emit("toast", `${vName} roars — nearby guards stir.`);
    }
    if (this.room.kind === "boss") {
      for (const e of this.enemies) e.ai.alert();
    }
  }

  private spawnPal(room: RaidRoomDef): void {
    if (!palBrought()) return;
    const stats = palCombatStats();
    this.pal = new ArenaBeast(this, room.spawn.x - 40, room.spawn.y + 10, palKind(), "player", {
      label: stats.label,
      maxHp: stats.maxHp,
      bite: stats.bite,
      knock: stats.knock,
      speed: stats.speed,
      lungeSpd: stats.lungeSpd,
      visScale: stats.visScale,
      tint: stats.tint,
      nameColor: "#8ecf6a",
    });
    this.physics.add.collider(this.pal, this.solids);
    this.physics.add.collider(this.pal, this.player);
    for (const a of this.allies) this.physics.add.collider(this.pal, a.fighter);
    if (this.volunteer) this.physics.add.collider(this.pal, this.volunteer.fighter);
    for (const e of this.enemies) this.physics.add.collider(this.pal, e.fighter);
  }

  private spawnAllies(room: RaidRoomDef): void {
    const party = camp().party.slice(0, 2) as CompanionId[];
    const meal = activeMarchBuff();
    party.forEach((id, i) => {
      const def = getCompanionDef(id);
      const spawn = room.allySpawns[i] ?? { x: room.spawn.x - 24, y: room.spawn.y + (i === 0 ? -28 : 28) };
      const stats = companionCombatStats(id);
      const fighter = new Fighter(this, spawn.x, spawn.y, {
        key: `raid-ally-${id}`,
        tunic: def.color,
        accent: def.accent,
        scale: def.scale,
        stats: {
          ...stats,
          maxHealth: stats.maxHealth + meal.hp,
          maxStamina: stats.maxStamina + meal.stamina,
          attack: stats.attack + meal.attack,
        },
        weapon: companionWeapon(id),
        team: "ally",
        style: id === "cassian" ? "lanista" : bodyStyleFor(id),
      });
      attachHpBar(this, fighter, def.name, this.raidHud("ally"));
      this.physics.add.collider(fighter, this.solids);
      this.physics.add.collider(this.player, fighter);
      fighter.revive(true);
      this.allies.push({ fighter, ai: new CombatAI(fighter, def.aiStyle), id });
    });
  }

  private spawnVolunteer(room: RaidRoomDef): void {
    if (gameState.raidDownedVolunteer) return;
    const vid = camp().houseVolunteer;
    if (!vid || !camp().volunteersUnlocked.includes(vid)) return;
    const def = getVolunteerDef(vid);
    if (!def) return;
    this.volunteerHouse = def.houseId;
    const meal = activeMarchBuff();
    const spawn = room.allySpawns[2] ?? { x: room.spawn.x - 48, y: room.spawn.y + 48 };
    const stats = {
      ...def.stats,
      maxHealth: def.stats.maxHealth + meal.hp,
      maxStamina: def.stats.maxStamina + meal.stamina,
      attack: def.stats.attack + meal.attack,
    };
    const fighter = new Fighter(this, spawn.x, spawn.y, {
      key: `raid-vol-${def.id}`,
      tunic: def.tunic,
      accent: def.accent,
      scale: def.scale,
      stats,
      weapon: def.weapon,
      team: "ally",
      style: bodyStyleFor(def.id),
    });
    if (def.armor) fighter.knockResist = 0.55;
    attachHpBar(this, fighter, def.name, this.raidHud("ally"));
    this.physics.add.collider(fighter, this.solids);
    this.physics.add.collider(this.player, fighter);
    for (const a of this.allies) this.physics.add.collider(fighter, a.fighter);
    fighter.revive(true);
    const ai = new CombatAI(fighter, def.aiStyle, {
      ambush: def.ambush === true,
      tuskCharge: def.hornCharge === true,
      hornCharge: def.hornCharge === true,
    });
    this.volunteer = { fighter, ai, id: def.id, houseId: def.houseId };
  }

  private spawnThreats(room: RaidRoomDef): void {
    const cleared = isRoomCleared(this.houseId, room.id);
    if (cleared && room.kind !== "boss") return;
    if (room.kind === "boss" && getRaidProgress(this.houseId).bossBeaten) return;

    const list: { g: RaidGuardDef; isBoss: boolean }[] = [];
    if (room.boss) list.push({ g: room.boss, isBoss: true });
    for (const g of room.guards) list.push({ g, isBoss: false });

    list.forEach(({ g, isBoss }, i) => {
      const gx =
        g.x ??
        Math.min(room.spawn.x + 140 + (i % 2) * 50 + Math.floor(i / 2) * 36, (room.cols - 2) * TILE_SIZE - 20);
      const gy =
        g.y ?? Math.min(Math.max(room.spawn.y - 36 + (i % 3) * 36, TILE_SIZE * 2), (room.rows - 2) * TILE_SIZE - 20);
      const fighter = new Fighter(this, gx, gy, {
        key: `raid-foe-${g.id}`,
        tunic: g.color,
        accent: 0xe8d4a0,
        scale: g.scale,
        stats: { ...g.stats },
        weapon: g.weapon,
        team: "enemy",
        style: bodyStyleFor(g.id),
        speed: 120 + g.stats.agility * 4,
      });
      attachHpBar(this, fighter, g.name, this.raidHud("enemy"));
      this.physics.add.collider(fighter, this.solids);
      this.physics.add.collider(this.player, fighter);
      for (const a of this.allies) this.physics.add.collider(fighter, a.fighter);
      if (this.volunteer) this.physics.add.collider(fighter, this.volunteer.fighter);
      if (g.armor) fighter.knockResist = 0.55;
      const aggro = g.ambush ? AMBUSH_AGGRO : isBoss ? Math.floor(AGGRO_RADIUS * 0.55) : AGGRO_RADIUS;
      const roarHook =
        g.roarPulse && this.raid.alertMode !== "pack"
          ? (src: Fighter) => {
              this.alertNearby(src, ROAR_RIPPLE);
              bus.emit("toast", "A roar wakes the hall!");
            }
          : undefined;
      const ai = new CombatAI(fighter, g.aiStyle, {
        startUnaware: true,
        aggroRadius: aggro,
        ambush: g.ambush === true,
        tuskCharge: g.tuskCharge === true,
        hornCharge: g.hornCharge === true,
        roarPulse: g.roarPulse === true,
        onFirstAlert: roarHook,
        telegraphRadiusMult: this.volunteerHouse === "taurus" && g.hornCharge ? 1.65 : 1,
      });
      this.enemies.push({ fighter, ai, isBoss });
    });
  }

  private spawnRoomProps(room: RaidRoomDef): void {
    for (const d of room.doors) {
      const frame = this.add.rectangle(d.x, d.y, 28, 40, 0x3a2818).setStrokeStyle(2, 0xd4a84b).setDepth(d.y);
      if (d.requiresClear) this.doorGlow = frame;
      this.add
        .text(d.x, d.y - 28, d.label, {
          fontFamily: "Georgia",
          fontSize: "12px",
          color: "#e8dcc8",
          stroke: "#1a1210",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(d.y + 1);
      this.interactables.push({ kind: "door", x: d.x, y: d.y, to: d.to, id: d.requiresClear ? "locked" : undefined });
    }
    if (room.rest) {
      this.add.circle(room.rest.x, room.rest.y, 16, 0xc45a1a, 0.5).setDepth(2);
      this.interactables.push({ kind: "rest", x: room.rest.x, y: room.rest.y });
    }
    const retreat = { x: TILE_SIZE * 2 + TILE_SIZE / 2, y: TILE_SIZE * 2 + TILE_SIZE / 2 };
    this.interactables.push({ kind: "retreat", x: retreat.x, y: retreat.y });
    this.add
      .text(retreat.x, retreat.y - 24, "Retreat", {
        fontFamily: "Georgia",
        fontSize: "11px",
        color: "#c07060",
        stroke: "#1a1210",
        strokeThickness: 2,
      })
      .setOrigin(0.5)
      .setDepth(3);
  }

  private livingEnemies(): Fighter[] {
    return this.enemies.map((e) => e.fighter).filter((f) => f.alive);
  }

  private livingAllies(): Fighter[] {
    const list = this.allies.map((a) => a.fighter).filter((f) => f.alive);
    if (this.volunteer?.fighter.alive) list.push(this.volunteer.fighter);
    return list;
  }

  private friendlies(): Fighter[] {
    return [this.player, ...this.livingAllies()];
  }

  private friendMarks(): Array<Fighter | ArenaBeast> {
    const list: Array<Fighter | ArenaBeast> = this.friendlies();
    if (this.pal?.alive) list.push(this.pal);
    return list;
  }

  private foes(): Fighter[] {
    return this.livingEnemies();
  }

  private palPrey(): Fighter {
    const live = this.foes();
    if (!live.length || !this.pal) return this.player;
    let best = live[0];
    let bestD = Phaser.Math.Distance.Between(this.pal.x, this.pal.y, best.x, best.y);
    for (const f of live) {
      const d = Phaser.Math.Distance.Between(this.pal.x, this.pal.y, f.x, f.y);
      if (d < bestD) {
        best = f;
        bestD = d;
      }
    }
    return best;
  }

  private roomSecure(): boolean {
    if (this.room.kind === "puzzle") {
      return Boolean(getRaidProgress(this.houseId).rooms[this.room.id]?.puzzleSolved);
    }
    return this.livingEnemies().length === 0;
  }

  private alertNearby(source: Fighter, radius = ALERT_RIPPLE): void {
    const ripple = this.volunteerHouse === "serpens" ? radius * 1.1 : radius;
    if (this.raid.alertMode === "pack") {
      if (this.volunteerHouse === "lupus" && !this.lupusPackToastShown) {
        this.lupusPackToastShown = true;
        bus.emit("toast", "The pack answers as one — every wolf wakes.");
      }
      for (const e of this.enemies) {
        if (e.fighter.alive && !e.ai.isAware) e.ai.alert();
      }
      return;
    }
    for (const e of this.enemies) {
      if (!e.fighter.alive || e.ai.isAware) continue;
      const d = Phaser.Math.Distance.Between(source.x, source.y, e.fighter.x, e.fighter.y);
      if (d <= ripple) e.ai.alert();
    }
  }

  private inHazard(kind: HazardZone["kind"], x: number, y: number): boolean {
    for (const z of this.hazardZones) {
      if (z.kind !== kind) continue;
      if (Math.abs(x - z.x) <= z.w / 2 && Math.abs(y - z.y) <= z.h / 2) return true;
    }
    return false;
  }

  private inMud(x: number, y: number): boolean {
    return this.inHazard("mud", x, y);
  }

  private inDark(x: number, y: number): boolean {
    return this.inHazard("dark", x, y);
  }

  private hazardMoveMult(x: number, y: number, who?: Fighter): number {
    if (this.inMud(x, y)) return this.mudMult(x, y);
    if (this.inDark(x, y)) {
      if (who && this.volunteer?.fighter === who && this.volunteerHouse === "tigris") return 1;
      return DARK_SLOW;
    }
    return 1;
  }

  private mudMult(x: number, y: number): number {
    if (this.volunteerHouse !== "aper" || !this.volunteer?.fighter.alive) return MUD_SLOW;
    const v = this.volunteer.fighter;
    const nearVolunteer = Phaser.Math.Distance.Between(x, y, v.x, v.y) <= 88;
    const nearPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) <= 88;
    if (!nearVolunteer && !nearPlayer) return MUD_SLOW;
    return 1 - (1 - MUD_SLOW) * 0.85;
  }

  private rubbleDamage(): number {
    if (this.volunteerHouse === "ursus" && this.volunteer?.fighter.alive) {
      return Math.max(1, Math.round(RUBBLE_DMG * 0.7));
    }
    return RUBBLE_DMG;
  }

  private tickHazards(now: number): void {
    for (const z of this.hazardZones) {
      if (z.kind === "stampede" && z.sweep && z.periodMs) {
        const t = (now % z.periodMs) / z.periodMs;
        if (z.axis === "y") {
          z.sweep.y = z.y - z.h / 2 + t * z.h;
          z.sweep.x = z.x;
        } else {
          z.sweep.x = z.x - z.w / 2 + t * z.w;
          z.sweep.y = z.y;
        }
        const sx = z.sweep.x;
        const sy = z.sweep.y;
        const hw = (z.sweep.width ?? 36) / 2;
        const hh = (z.sweep.height ?? 36) / 2;
        const hit = (f: Fighter) => {
          if (!f.alive) return;
          if (Math.abs(f.x - sx) <= hw + 10 && Math.abs(f.y - sy) <= hh + 10) {
            if (now < f.invulnUntil) return;
            f.takeDamage(6, new Phaser.Math.Vector2(z.axis === "x" ? 1 : 0, z.axis === "y" ? 1 : 0), 28);
          }
        };
        hit(this.player);
        for (const a of this.allies) hit(a.fighter);
        if (this.volunteer) hit(this.volunteer.fighter);
        for (const e of this.enemies) hit(e.fighter);
        if (this.volunteerHouse === "elephas") {
          const warnDist = 72;
          const distPlayer = Phaser.Math.Distance.Between(sx, sy, this.player.x, this.player.y);
          const distVol = this.volunteer
            ? Phaser.Math.Distance.Between(sx, sy, this.volunteer.fighter.x, this.volunteer.fighter.y)
            : 999;
          if (
            (distPlayer < warnDist || distVol < warnDist) &&
            now - (z.lastStampedeWarn ?? 0) > (z.periodMs ?? 3200) * 0.55
          ) {
            z.lastStampedeWarn = now;
            bus.emit("toast", "Stampede sweep — move!");
          }
        }
      }
      if (z.kind === "rubble") {
        const dmg = this.rubbleDamage();
        const crush = (f: Fighter) => {
          if (!f.alive) return;
          if (Math.abs(f.x - z.x) > z.w / 2 || Math.abs(f.y - z.y) > z.h / 2) return;
          if (now < (z.nextTickAt ?? 0)) return;
          z.nextTickAt = now + RUBBLE_TICK_MS;
          f.takeDamage(dmg, new Phaser.Math.Vector2(0, 1), 12);
        };
        crush(this.player);
        for (const a of this.allies) crush(a.fighter);
        if (this.volunteer) crush(this.volunteer.fighter);
        for (const e of this.enemies) crush(e.fighter);
      }
    }
  }

  private objectiveAfterFree(): ObjectiveId {
    const next = nextUnlockedRaidHouse(camp().freedPads);
    if (!next) return "freed_camp";
    if (next === "lupus") return "raid_lupus";
    if (next === "aper") return "raid_aper";
    if (next === "taurus") return "raid_taurus";
    if (next === "tigris") return "raid_tigris";
    if (next === "leo") return "raid_leo";
    if (next === "ursus") return "raid_ursus";
    if (next === "rhinoceros") return "raid_rhinoceros";
    if (next === "elephas") return "raid_elephas";
    return "freed_camp";
  }

  private emitVictoryResult(reward: { denarii: number; xp: number }, rematch: boolean, leveled: boolean): void {
    const allNine = camp().freedPads.length >= RAID_HOUSE_ORDER.length;
    let body = this.raid.victory.body;
    body += `\n\n+${reward.denarii} denarii   +${reward.xp} XP`;
    if (leveled) body += "\nYou grow stronger.";
    if (rematch) body += "\n\nRematch — half payout.";
    if (allNine && this.houseId === "elephas") {
      body += "\n\nAll nine houses stand free. Farm, rematch, and rest.";
    }
    bus.emit("result", {
      title: this.raid.victory.title,
      body,
      action: "Return to camp",
    });
  }

  private liberationAfter(ms: number, fn: () => void): void {
    const t = this.time.delayedCall(ms, () => {
      if (!this.liberationPlaying) return;
      fn();
    });
    this.liberationTimers.push(t);
  }

  private finishLiberation(): void {
    if (!this.liberationPlaying) return;
    this.liberationPlaying = false;
    for (const t of this.liberationTimers) t.remove(false);
    this.liberationTimers = [];
    for (const g of this.liberationFx) g.destroy();
    this.liberationFx = [];
    this.cameras.main.setZoom(this.raidZoom);
    this.centerRaidCamera();
    if (this.roomHud) {
      this.roomHud.setVisible(true).setScale(1 / this.raidZoom);
    }
    const done = this.liberationDone;
    this.liberationDone = undefined;
    done?.();
  }

  private walkPlayerTo(x: number, y: number, ms: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) body.enable = false;
    this.player.facing.set(x - this.player.x, y - this.player.y).normalize();
    this.tweens.add({
      targets: this.player,
      x,
      y,
      duration: ms,
      ease: "Sine.easeInOut",
      onUpdate: () => this.player.syncVisuals(this.time.now),
    });
  }

  private shatterChains(chains: Phaser.GameObjects.Image[]): void {
    for (const c of chains) {
      this.tweens.add({
        targets: c,
        alpha: 0,
        x: c.x + Phaser.Math.Between(-18, 18),
        y: c.y + 12,
        angle: Phaser.Math.Between(-40, 40),
        duration: 280,
        onComplete: () => c.destroy(),
      });
    }
  }

  private playLiberationBeat(done: () => void): void {
    this.liberationPlaying = true;
    this.liberationDone = done;
    this.liberationTimers = [];
    this.liberationCaptives = [];
    this.liberationFx = [];
    this.combatHeld = true;
    this.liberationSkipAt = this.time.now + 900;
    this.liberationSawAttackUp = !this.combat.isDown("attack");
    this.player.stamina = this.player.stats.maxStamina;
    this.player.setVelocity(0, 0);
    this.player.setBlocking(false);
    for (const a of this.allies) a.fighter.setVelocity(0, 0);
    if (this.roomHud) this.roomHud.setVisible(false);

    const px = this.player.x;
    const py = this.player.y;
    const focusX = px - 48;
    const focusY = py;
    this.cameras.main.stopFollow();
    const cutZoom = Math.max(this.raidZoom * 1.25, this.raidZoom + 0.2);
    this.cameras.main.setZoom(cutZoom);
    this.cameras.main.centerOn(focusX, focusY);

    const skipHint = this.add
      .text(focusX, focusY + 132, "Space / E skip", {
        fontFamily: "Georgia",
        fontSize: "13px",
        color: "#8a7a68",
        stroke: "#1a1210",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(4600)
      .setAlpha(0);
    this.liberationFx.push(skipHint);
    this.liberationAfter(900, () => skipHint.setAlpha(1));

    const defs = refugeesForHouse(this.houseId).slice(0, 2);
    const spots = [
      { x: px - 78, y: py - 26 },
      { x: px - 78, y: py + 26 },
    ];
    defs.forEach((def, i) => {
      const spot = spots[i] ?? spots[0];
      const npc = new NpcActor(this, spot.x, spot.y, def.id, def.name, def.tunic, def.accent, def.scale, `npc-lib-${def.id}`);
      if (npc.body) npc.body.enable = false;
      npc.label.setVisible(false);
      npc.prompt?.setVisible(false);
      npc.kneel();
      const nameTag = this.add
        .text(spot.x, spot.y - 44, def.name, {
          fontFamily: "Georgia",
          fontSize: "13px",
          color: "#c9c0b0",
          stroke: "#1a1210",
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(spot.y + 5)
        .setAlpha(0.85);
      this.liberationFx.push(nameTag);
      const chains: Phaser.GameObjects.Image[] = [];
      if (this.textures.exists("prop-raid-chains")) {
        chains.push(
          this.add.image(spot.x - 8, spot.y + 8, "prop-raid-chains").setDepth(spot.y + 3).setScale(1.35),
          this.add.image(spot.x + 10, spot.y + 10, "prop-raid-chains").setDepth(spot.y + 3).setFlipX(true).setScale(1.35),
        );
      }
      this.liberationCaptives.push({ npc, chains });
    });

    const first = this.liberationCaptives[0];
    const second = this.liberationCaptives[1] ?? first;
    if (!first) {
      this.liberationAfter(400, () => this.showLiberationLine(focusX, focusY, getLiberation(this.houseId).line));
      this.liberationAfter(2200, () => this.finishLiberation());
      return;
    }

    this.liberationAfter(360, () => this.walkPlayerTo(first.npc.x + 28, first.npc.y, 480));
    this.liberationAfter(900, () => {
      this.player.poseReady();
      this.player.stamina = this.player.stats.maxStamina;
      this.player.facing.set(first.npc.x - this.player.x, first.npc.y - this.player.y).normalize();
      this.player.tryAttack("light");
    });
    this.liberationAfter(1120, () => {
      this.shatterChains(first.chains);
      first.npc.stand();
    });
    this.liberationAfter(1580, () => this.walkPlayerTo(second.npc.x + 28, second.npc.y, 440));
    this.liberationAfter(2080, () => {
      this.player.poseReady();
      this.player.stamina = this.player.stats.maxStamina;
      this.player.facing.set(second.npc.x - this.player.x, second.npc.y - this.player.y).normalize();
      this.player.tryAttack("light");
    });
    this.liberationAfter(2300, () => {
      this.shatterChains(second.chains);
      second.npc.stand();
    });
    this.liberationAfter(2780, () => {
      this.liberationCaptives.forEach((c, i) => {
        this.tweens.add({
          targets: c.npc,
          x: this.player.x - 22,
          y: this.player.y + (i === 0 ? -16 : 16),
          duration: 520,
          ease: "Sine.easeOut",
          onUpdate: () => c.npc.place(c.npc.x, c.npc.y),
        });
      });
    });
    this.liberationAfter(3400, () => {
      this.showLiberationLine(this.player.x - 10, this.player.y - 8, getLiberation(this.houseId).line);
    });
    this.liberationAfter(5000, () => this.finishLiberation());
  }

  private showLiberationLine(x: number, y: number, text: string): void {
    const t = this.add
      .text(x, y - 40, text, {
        fontFamily: "Georgia",
        fontSize: "20px",
        color: "#e8dcc8",
        stroke: "#1a1210",
        strokeThickness: 6,
        wordWrap: { width: 360 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(5000)
      .setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: y - 52, duration: 280, ease: "Back.easeOut" });
    this.liberationFx.push(t);
  }

  private tryClearRoom(): void {
    if (!this.roomSecure()) return;
    if (!isRoomCleared(this.houseId, this.room.id)) {
      markRoomCleared(this.houseId, this.room.id);
      if (this.room.kind === "boss") {
        const rematch = camp().freedPads.includes(this.houseId);
        if (!rematch) {
          const cookNew = markHouseFreed(this.houseId);
          if (unlockHouseVolunteers(this.houseId)) {
            bus.emit("toast", volunteerUnlockLabel(this.houseId));
          }
          if (cookNew) {
            bus.emit("toast", "Therio the cook joins the commons fire.");
          }
        }
        const reward = bossRaidReward(this.houseId, rematch);
        addDenarii(reward.denarii);
        const { leveled } = addXp(reward.xp);
        gameState.persist();
        this.ended = true;
        bus.once("result-closed", () => {
          if (!rematch) {
            gameState.save.currentObjective = this.objectiveAfterFree();
            gameState.persist();
          }
          returnFromRaid(this.game, { death: false, tentHouseId: this.houseId });
        });
        const freeFlag = liberationFlag(this.houseId);
        const chainFlag = liberationChainFlag(this.houseId);
        const finish = (): void => {
          if (!rematch) {
            gameState.save.storyFlags[freeFlag] = true;
            gameState.save.storyFlags[chainFlag] = true;
            gameState.persist();
          }
          if (camp().freedPads.length >= RAID_HOUSE_ORDER.length) {
            bus.emit("toast", "All nine houses freed. The night raids are done.");
          }
          this.emitVictoryResult(reward, rematch, leveled);
        };
        if (rematch || gameState.save.storyFlags[chainFlag]) {
          finish();
        } else {
          this.playLiberationBeat(finish);
        }
        return;
      }
      gameState.persist();
      if (!this.clearAnnounced) {
        this.clearAnnounced = true;
        this.combatHeld = true;
        bus.emit("raid-title", {
          title: "Room secure",
          subtitle: "The way ahead is open",
          holdMs: 1000,
          onDone: () => {
            this.combatHeld = false;
            this.pulseSecureDoor();
          },
        });
      }
    }
  }

  private pulseSecureDoor(): void {
    if (!this.doorGlow) return;
    this.doorGlow.setStrokeStyle(3, 0x8ecf6a);
    this.tweens.add({
      targets: this.doorGlow,
      alpha: { from: 1, to: 0.55 },
      duration: 500,
      yoyo: true,
      repeat: 2,
    });
  }

  private nearest() {
    let best: (typeof this.interactables)[0] | null = null;
    let bestD = 52;
    for (const it of this.interactables) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  private tryInteract(): void {
    if (this.transitioning || this.combatHeld) return;
    const n = this.nearest();
    if (!n) return;
    if (n.kind === "retreat") {
      this.ended = true;
      bus.emit("result", {
        title: "Fall Back",
        body: "You pull out to the Freed Camp. Cleared rooms stay cleared.",
        action: "Return to camp",
      });
      bus.once("result-closed", () => returnFromRaid(this.game, { death: false }));
      return;
    }
    if (n.kind === "rest") {
      this.player.health = this.player.stats.maxHealth;
      this.player.stamina = this.player.stats.maxStamina;
      for (const a of this.allies) {
        if (a.fighter.alive) {
          a.fighter.health = a.fighter.stats.maxHealth;
          a.fighter.stamina = a.fighter.stats.maxStamina;
        }
      }
      if (this.volunteer?.fighter.alive) {
        this.volunteer.fighter.health = this.volunteer.fighter.stats.maxHealth;
        this.volunteer.fighter.stamina = this.volunteer.fighter.stats.maxStamina;
      }
      if (gameState.save.unguent < 3) gameState.save.unguent = Math.min(3, gameState.save.unguent + 1);
      bus.emit("toast", "Camp rest — wounds ease. Unguent topped.");
      return;
    }
    if (n.kind === "statue") {
      this.turnStatue(n);
      return;
    }
    if (n.kind === "brazier") {
      this.lightBrazier(n);
      return;
    }
    if (n.kind === "plaque") {
      const p = this.room.puzzle;
      if (p && "plaque" in p) bus.emit("toast", p.plaque);
      return;
    }
    if (n.kind === "door" && n.to) {
      const door = this.room.doors.find((d) => d.to === n.to);
      if (door?.requiresClear && !this.roomSecure() && !isRoomCleared(this.houseId, this.room.id)) {
        bus.emit("toast", "Clear this room first.");
        return;
      }
      this.transitioning = true;
      this.combatHeld = true;
      gameState.raidDownedAllies = [];
      gameState.raidDownedVolunteer = false;
      gameState.save.health = this.player.health;
      gameState.save.stamina = this.player.stamina;
      gameState.pendingRaidRoom = n.to;
      gameState.persist();
      this.cameras.main.fadeOut(380, 4, 8, 16);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.restart();
      });
    }
  }

  private raidHud(team: "player" | "ally" | "enemy"): { nameColor: string; fill: number; stroke: number } {
    const accent = getHouse(this.houseId)?.colors.accent ?? 0xd4a84b;
    if (team === "enemy") return { nameColor: "#e07060", fill: 0xb33a2b, stroke: accent };
    if (team === "ally") return { nameColor: "#8ecf6a", fill: 0x6aa84f, stroke: 0x8ecf6a };
    return { nameColor: "#e8c96a", fill: 0x6aa84f, stroke: 0xd4a84b };
  }

  private spawnPuzzle(room: RaidRoomDef): void {
    const p = room.puzzle;
    if (!p) return;
    const solved = Boolean(getRaidProgress(this.houseId).rooms[room.id]?.puzzleSolved);
    this.puzzleLocked = solved;
    this.puzzleLastSafe = { x: room.spawn.x, y: room.spawn.y };
    this.add
      .text(room.cols * TILE_SIZE * 0.5, TILE_SIZE * 1.4, p.plaque, {
        fontFamily: "Georgia",
        fontSize: "13px",
        color: "#e8dcc8",
        stroke: "#1a1210",
        strokeThickness: 3,
        wordWrap: { width: 420 },
        align: "center",
      })
      .setOrigin(0.5)
      .setDepth(8);
    this.interactables.push({ kind: "plaque", x: room.cols * TILE_SIZE * 0.5, y: TILE_SIZE * 1.6 });

    if (p.kind === "statues") this.spawnStatuePuzzle(p, solved);
    else if (p.kind === "step_path") this.spawnStepPuzzle(p, solved);
    else if (p.kind === "braziers") this.spawnBrazierPuzzle(p, solved);
    else this.spawnTimingPuzzle(p, solved);
  }

  private spawnStatuePuzzle(p: Extract<RaidPuzzle, { kind: "statues" }>, solved: boolean): void {
    const tex = STATUE_TEX[p.beast] ?? "beast-serpent";
    const tint = STATUE_TINT[p.beast] ?? 0x8ecf6a;
    for (const s of p.statues) {
      const facing = solved ? p.target : s.facing;
      const base = this.add.image(s.x, s.y + 6, "prop-statue-base").setDepth(s.y);
      const vis = this.add
        .image(s.x, s.y - 8, tex)
        .setScale(p.beast === "serpent" ? 0.7 : 0.52)
        .setTint(tint)
        .setAngle(FACE_ANGLE[facing])
        .setDepth(s.y + 2);
      this.puzzleStatues.push({ x: s.x, y: s.y, facing, vis, base });
      this.interactables.push({ kind: "statue", x: s.x, y: s.y });
    }
  }

  private spawnStepPuzzle(p: Extract<RaidPuzzle, { kind: "step_path" }>, solved: boolean): void {
    const w = p.cols * TILE_SIZE;
    const h = p.rows * TILE_SIZE;
    const x = p.originTx * TILE_SIZE + w / 2;
    const y = p.originTy * TILE_SIZE + h / 2;
    this.puzzleStepPit = { x, y, w, h };
    this.add.rectangle(x, y, w + 8, h + 8, 0x1a1210, 0.82).setDepth(2);
    const safeSet = new Set(p.safe.map(([c, r]) => `${c},${r}`));
    const goalKey = `${p.goal[0]},${p.goal[1]}`;
    const showSafe = !p.memory || solved;
    for (let row = 0; row < p.rows; row++) {
      for (let col = 0; col < p.cols; col++) {
        const key = `${col},${row}`;
        const safe = safeSet.has(key);
        const goal = key === goalKey;
        const tx = (p.originTx + col) * TILE_SIZE + TILE_SIZE / 2;
        const ty = (p.originTy + row) * TILE_SIZE + TILE_SIZE / 2;
        const tex = goal ? "tile-step-goal" : showSafe && safe ? "tile-step-safe" : "tile-step";
        const img = this.add.image(tx, ty, tex).setDepth(3);
        this.puzzleSteps.push({ col, row, x: tx, y: ty, safe, goal, img });
      }
    }
    if (p.memory && !solved) {
      for (const t of this.puzzleSteps) {
        if (t.safe && !t.goal) t.img.setTexture("tile-step-safe");
      }
      this.time.delayedCall(2200, () => {
        if (!this.sys.isActive() || this.puzzleLocked) return;
        for (const t of this.puzzleSteps) {
          if (!t.goal) t.img.setTexture("tile-step");
        }
        bus.emit("toast", "The path goes dark.");
      });
    }
  }

  private spawnBrazierPuzzle(p: Extract<RaidPuzzle, { kind: "braziers" }>, solved: boolean): void {
    p.order.forEach((pos, index) => {
      const img = this.add.image(pos.x, pos.y, "prop-brazier").setDepth(pos.y);
      if (!solved) img.setTint(0x4a4038);
      else animateBrazier(this, pos.x, pos.y);
      this.puzzleBraziers.push({ x: pos.x, y: pos.y, index, lit: solved, img });
      this.interactables.push({ kind: "brazier", x: pos.x, y: pos.y, id: String(index) });
    });
    this.puzzleBrazierNext = solved ? p.order.length : 0;
  }

  private spawnTimingPuzzle(p: Extract<RaidPuzzle, { kind: "timing_gate" }>, solved: boolean): void {
    if (p.plates) {
      p.plates.forEach((pos, index) => {
        const img = this.add.image(pos.x, pos.y, solved ? "prop-pressure-down" : "prop-pressure-plate").setDepth(4);
        this.puzzlePlates.push({ x: pos.x, y: pos.y, index, down: solved, until: 0, img });
      });
    }
    if (p.goal) {
      const img = this.add.image(p.goal.x, p.goal.y, "tile-step-goal").setDepth(4);
      this.puzzleGoal = { x: p.goal.x, y: p.goal.y, img };
    }
  }

  private turnStatue(n: { x: number; y: number }): void {
    if (this.puzzleLocked) {
      bus.emit("toast", "The statues already face the door.");
      return;
    }
    const s = this.puzzleStatues.find((st) => Math.abs(st.x - n.x) < 4 && Math.abs(st.y - n.y) < 4);
    if (!s) return;
    s.facing = FACE_NEXT[s.facing];
    s.vis.setAngle(FACE_ANGLE[s.facing]);
    const p = this.room.puzzle;
    if (p?.kind !== "statues") return;
    if (this.puzzleStatues.every((st) => st.facing === p.target)) this.solvePuzzle("The statues face the door. The way ahead is clear.");
  }

  private lightBrazier(n: { x: number; y: number; id?: string }): void {
    if (this.puzzleLocked) {
      bus.emit("toast", "The hearths already burn.");
      return;
    }
    const idx = Number(n.id);
    const b = this.puzzleBraziers.find((row) => row.index === idx);
    if (!b || b.lit) return;
    if (b.index !== this.puzzleBrazierNext) {
      for (const row of this.puzzleBraziers) {
        row.lit = false;
        row.img.setTint(0x4a4038);
      }
      this.puzzleBrazierNext = 0;
      this.player.takeDamage(8, new Phaser.Math.Vector2(0, 1), 18);
      bus.emit("toast", "Wrong order. The pride snuffs the fire.");
      return;
    }
    b.lit = true;
    b.img.clearTint();
    animateBrazier(this, b.x, b.y);
    this.puzzleBrazierNext += 1;
    if (this.puzzleBrazierNext >= this.puzzleBraziers.length) this.solvePuzzle("The pride hearths burn. The way ahead is clear.");
  }

  private tickPuzzle(now: number): void {
    if (this.puzzleLocked || !this.room.puzzle) return;
    const p = this.room.puzzle;
    if (p.kind === "step_path") this.tickStepPath();
    if (p.kind === "timing_gate") this.tickTiming(now, p);
  }

  private tickStepPath(): void {
    const pit = this.puzzleStepPit;
    if (!pit) return;
    const f = this.player;
    if (Math.abs(f.x - pit.x) > pit.w / 2 + 6 || Math.abs(f.y - pit.y) > pit.h / 2 + 6) {
      if (Math.abs(f.x - pit.x) > pit.w / 2 + 18 || Math.abs(f.y - pit.y) > pit.h / 2 + 18) {
        this.puzzleLastSafe = { x: f.x, y: f.y };
      }
      return;
    }
    const tile = this.puzzleSteps.reduce<PuzzleStep | null>((best, t) => {
      const d = Phaser.Math.Distance.Between(f.x, f.y, t.x, t.y);
      if (d > 18) return best;
      if (!best || d < Phaser.Math.Distance.Between(f.x, f.y, best.x, best.y)) return t;
      return best;
    }, null);
    if (!tile) {
      this.punishStep();
      return;
    }
    const key = `${tile.col},${tile.row}`;
    if (tile.goal) {
      this.solvePuzzle("The far stone holds. The way ahead is clear.");
      return;
    }
    if (tile.safe) {
      this.puzzleLastSafe = { x: tile.x, y: tile.y };
      this.puzzleLastCell = key;
      return;
    }
    if (this.puzzleLastCell === key) return;
    this.puzzleLastCell = key;
    this.punishStep();
  }

  private punishStep(): void {
    this.fireArrowVolley(this.player.x, this.player.y);
    this.player.takeDamage(10, new Phaser.Math.Vector2(-1, 0), 36);
    this.player.setPosition(this.puzzleLastSafe.x, this.puzzleLastSafe.y);
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) body.reset(this.puzzleLastSafe.x, this.puzzleLastSafe.y);
    bus.emit("toast", "Arrows from the walls!");
  }

  private fireArrowVolley(x: number, y: number): void {
    const shots = [
      { sx: 24, sy: y, angle: 0 },
      { sx: this.room.cols * TILE_SIZE - 24, sy: y, angle: 180 },
      { sx: x, sy: 24, angle: 90 },
    ];
    for (const s of shots) {
      const arrow = this.add.image(s.sx, s.sy, "fx-raid-arrow").setAngle(s.angle).setDepth(5000);
      this.tweens.add({
        targets: arrow,
        x,
        y,
        duration: 220,
        ease: "Quad.easeIn",
        onComplete: () => arrow.destroy(),
      });
    }
  }

  private tickTiming(now: number, p: Extract<RaidPuzzle, { kind: "timing_gate" }>): void {
    if (p.variant === "pressure") {
      const f = this.player;
      const on = this.puzzlePlates.find((pl) => Phaser.Math.Distance.Between(f.x, f.y, pl.x, pl.y) < 16);
      if (on && !on.down) {
        if (on.index !== this.puzzlePlateNext) {
          this.resetPlates();
          this.player.takeDamage(6, new Phaser.Math.Vector2(0, 1), 16);
          bus.emit("toast", "The earth shrugs you off. West to east.");
        } else {
          on.down = true;
          on.until = now + (p.holdMs ?? 2800);
          on.img.setTexture("prop-pressure-down");
          this.puzzlePlateNext += 1;
          if (this.puzzlePlateNext >= this.puzzlePlates.length) {
            this.solvePuzzle("The earth holds. The way ahead is clear.");
            return;
          }
        }
      }
      if (this.puzzlePlateNext > 0) {
        const last = this.puzzlePlates[this.puzzlePlateNext - 1];
        if (last?.down && now > last.until) {
          this.resetPlates();
          bus.emit("toast", "The plates rise. Again.");
        }
      }
    }
    if (this.puzzleGoal && Phaser.Math.Distance.Between(this.player.x, this.player.y, this.puzzleGoal.x, this.puzzleGoal.y) < 18) {
      this.solvePuzzle("You reach the far pad. The way ahead is clear.");
    }
  }

  private resetPlates(): void {
    this.puzzlePlateNext = 0;
    for (const pl of this.puzzlePlates) {
      pl.down = false;
      pl.until = 0;
      pl.img.setTexture("prop-pressure-plate");
    }
  }

  private solvePuzzle(message: string): void {
    if (this.puzzleLocked) return;
    this.puzzleLocked = true;
    const prog = getRaidProgress(this.houseId);
    prog.rooms[this.room.id] = { ...prog.rooms[this.room.id], puzzleSolved: true };
    gameState.persist();
    bus.emit("toast", message);
    this.tryClearRoom();
  }

  private onPlayerDeath(): void {
    if (this.ended) return;
    this.ended = true;
    clearRoomGuards(this.houseId, this.room.id);
    gameState.persist();
    bus.emit("result", {
      title: "Cut Down",
      body: "You fall in the raid. Allies drag what they can back to camp.\nThis room's guards return. Cleared rooms ahead stay clear.",
      action: "Wake at camp",
    });
    bus.once("result-closed", () => returnFromRaid(this.game, { death: true }));
  }

  update(_t: number, delta: number): void {
    if (!this.player) return;
    const now = this.time.now;
    if (this.liberationPlaying) {
      this.player.setVelocity(0, 0);
      this.player.syncVisuals(now);
      this.pal?.setVelocity(0, 0);
      this.pal?.syncVisuals(now);
      if (!this.liberationSawAttackUp && this.combat.justReleased("attack")) this.liberationSawAttackUp = true;
      const skipReady = now >= this.liberationSkipAt && this.liberationSawAttackUp;
      if (skipReady && (this.combat.justPressed("interact") || this.combat.justPressed("attack"))) {
        this.finishLiberation();
      }
      return;
    }
    if (this.ended) return;

    if (gameState.paused || gameState.inMenu || gameState.inDialogue || this.combatHeld || this.transitioning) {
      this.player.setVelocity(0, 0);
      for (const a of this.allies) a.fighter.setVelocity(0, 0);
      this.volunteer?.fighter.setVelocity(0, 0);
      for (const e of this.enemies) e.fighter.setVelocity(0, 0);
      this.pal?.setVelocity(0, 0);
      this.player.syncVisuals(now);
      for (const a of this.allies) a.fighter.syncVisuals(now);
      for (const e of this.enemies) e.fighter.syncVisuals(now);
      this.pal?.syncVisuals(now);
      return;
    }

    const mud = this.inMud(this.player.x, this.player.y);
    void mud;
    this.player.moveSpeed = this.baseMoveSpeed * this.hazardMoveMult(this.player.x, this.player.y, this.player);
    this.tickHazards(now);
    this.tickPuzzle(now);

    const move = this.combat.moveVector();
    this.player.tryMove(move.x * this.player.moveSpeed, move.y * this.player.moveSpeed);
    if (this.combat.justPressed("attack")) this.player.tryAttack("light");
    if (this.combat.justPressed("heavy")) this.player.tryAttack("heavy");
    if (this.combat.justPressed("dodge")) this.player.tryDodge();
    if (this.combat.justPressed("special")) this.player.trySpecial();
    if (this.combat.justPressed("parry")) this.player.tryParry();
    if (this.combat.justPressed("unguent")) this.player.tryUnguent();
    if (this.combat.justPressed("interact")) this.tryInteract();

    const block = this.combat.pollBlock();
    if (block === "start") {
      this.blockingHeld = true;
      this.player.setBlocking(true);
    } else if (block === "end") {
      this.blockingHeld = false;
      this.player.setBlocking(false);
    }
    if (this.blockingHeld) this.player.setBlocking(true);

    const parkParty = this.room.kind === "puzzle";
    for (const a of this.allies) {
      if (!a.fighter.alive || parkParty) {
        a.fighter.setVelocity(0, 0);
        a.fighter.syncVisuals(now);
        continue;
      }
      const base = 120 + a.fighter.stats.agility * 4;
      a.fighter.moveSpeed = base * this.hazardMoveMult(a.fighter.x, a.fighter.y, a.fighter);
      const foes = this.foes();
      const target =
        [...foes].sort(
          (x, y) =>
            Phaser.Math.Distance.Between(a.fighter.x, a.fighter.y, x.x, x.y) -
            Phaser.Math.Distance.Between(a.fighter.x, a.fighter.y, y.x, y.y),
        )[0] ?? this.player;
      a.ai.update(target, now);
      if (a.fighter.hitboxActive) resolveHits(a.fighter, this.foes());
      a.fighter.updateNet(this.foes(), delta);
      a.fighter.syncVisuals(now);
    }

    if (this.volunteer?.fighter.alive && !parkParty) {
      const v = this.volunteer;
      const base = 120 + v.fighter.stats.agility * 4;
      v.fighter.moveSpeed = base * this.hazardMoveMult(v.fighter.x, v.fighter.y, v.fighter);
      const foes = this.foes();
      const target =
        [...foes].sort(
          (x, y) =>
            Phaser.Math.Distance.Between(v.fighter.x, v.fighter.y, x.x, x.y) -
            Phaser.Math.Distance.Between(v.fighter.x, v.fighter.y, y.x, y.y),
        )[0] ?? this.player;
      v.ai.update(target, now);
      if (v.fighter.hitboxActive) resolveHits(v.fighter, this.foes());
      v.fighter.updateNet(this.foes(), delta);
      v.fighter.syncVisuals(now);
    } else if (this.volunteer) {
      this.volunteer.fighter.setVelocity(0, 0);
      this.volunteer.fighter.syncVisuals(now);
    }

    const friends = this.friendlies();
    const marks = this.friendMarks();
    for (const e of this.enemies) {
      if (!e.fighter.alive) {
        e.fighter.setVelocity(0, 0);
        e.fighter.syncVisuals(now);
        continue;
      }
      const wasAware = e.ai.isAware;
      if (e.ai.tickUnaware(friends, now)) {
        e.fighter.syncVisuals(now);
        e.ai.syncAmbushVisual();
        continue;
      }
      if (!wasAware && e.ai.isAware) this.alertNearby(e.fighter);

      const base = 120 + e.fighter.stats.agility * 4;
      e.fighter.moveSpeed = base * this.hazardMoveMult(e.fighter.x, e.fighter.y, e.fighter);

      const target =
        [...friends].sort(
          (x, y) =>
            Phaser.Math.Distance.Between(e.fighter.x, e.fighter.y, x.x, x.y) -
            Phaser.Math.Distance.Between(e.fighter.x, e.fighter.y, y.x, y.y),
        )[0] ?? this.player;
      e.ai.update(target, now);
      if (e.fighter.hitboxActive) resolveHits(e.fighter, marks);
      e.fighter.updateNet(marks, delta);
      e.fighter.syncVisuals(now);
    }

    if (this.pal?.alive && !parkParty) {
      const prey = this.palPrey();
      this.pal.updateAi(prey, now);
      this.pal.tryBite(prey);
      this.pal.syncVisuals(now);
      bus.emit("pal-hp", this.pal.health / this.pal.maxHealth);
    } else if (this.pal) {
      this.pal.setVelocity(0, 0);
      this.pal.syncVisuals(now);
      bus.emit("pal-hp", this.pal.alive ? this.pal.health / this.pal.maxHealth : 0);
    }

    if (this.player.hitboxActive) resolveHits(this.player, this.foes());
    this.player.updateNet(this.foes(), delta);
    this.player.syncVisuals(now);
    this.player.regen(delta);

    for (const a of this.allies) {
      if (!a.fighter.alive && !gameState.raidDownedAllies.includes(a.id)) {
        gameState.raidDownedAllies.push(a.id);
        bus.emit("toast", `${getCompanionDef(a.id).name} is down until the next room.`);
      }
    }
    if (this.volunteer && !this.volunteer.fighter.alive && !gameState.raidDownedVolunteer) {
      gameState.raidDownedVolunteer = true;
      const vName = getVolunteerDef(this.volunteer.id)?.name ?? "House ally";
      bus.emit("toast", `${vName} is down until the next room.`);
    }

    if (!this.player.alive) {
      this.onPlayerDeath();
      return;
    }

    this.tryClearRoom();

    const n = this.nearest();
    if (n) {
      const labels: Record<string, string> = {
        door: "E  Door",
        rest: "E  Rest",
        statue: "E  Turn",
        brazier: "E  Light",
        plaque: "E  Read",
        retreat: "E  Retreat",
      };
      this.nearestHint!.setVisible(true).setText(labels[n.kind] ?? "E").setPosition(this.player.x, this.player.y + 28);
    } else this.nearestHint!.setVisible(false);

    void this.roomHud;
  }
}
