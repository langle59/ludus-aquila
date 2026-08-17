import Phaser from "phaser";
import { TILE_SIZE, HUD_CAM_PAD, GAME_WIDTH, GAME_HEIGHT } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { audio } from "../systems/audio";
import { paintMap, labelMap, animateBrazier, placeLamp } from "../systems/worldRender";
import { arenaMetaFor, buildArena } from "../maps/maps";
import { Fighter, attachHpBar } from "../entities/Fighter";
import { WorldProp } from "../entities/World";
import { ArenaBeast, type BeastKind } from "../entities/Beast";
import { playerLook } from "../data/shop";
import { CombatAI } from "../systems/ai";
import { bodyStyleFor } from "../systems/assets";
import { burst, floatNumber, resolveHits } from "../systems/combat";
import { getRival, houseCrowdTint, isTournamentId } from "../data/houses";
import { applyArenaVictory, applyArenaDefeat, applySchoolBout, nextHouseAfter, nextUnlockedOpponent, playerCombatStats, wantsFeast } from "../systems/progression";
import { returnFromArena } from "../systems/playFlow";
import { getWeapon } from "../data/weapons";
import { palBrought, palCombatStats, palKind } from "../data/pal";
import { CombatInput } from "../systems/input";
import { arenaWeapon, clearNightEntry } from "../systems/nights";
import { getNpc } from "../data/gladiators";
import { schoolCombatStats } from "../data/school";

type Spectator = {
  img: Phaser.GameObjects.Image;
  baseY: number;
  phase: number;
  idle: string;
  cheer: string;
  raisedUntil: number;
  nextGesture: number;
  side: "north" | "south";
  baseTint: number;
};

type TossKind = "flower" | "fruit" | "cup" | "rock";

const CROWD_MISSIO = 70;
const CROWD_IUGULA = 40;

export class ArenaScene extends Phaser.Scene {
  private player!: Fighter;
  private enemy!: Fighter;
  private beast?: ArenaBeast;
  private pal?: ArenaBeast;
  private ai!: CombatAI;
  private studentAi?: CombatAI;
  private watching = false;
  private schoolNpcId = "";
  private watchSpeed = 1;
  private watchStartedAt = 0;
  private watchHud: Phaser.GameObjects.GameObject[] = [];
  private coachUsed = new Set<"steel" | "hold" | "roar">();
  private coachAtkUntil = 0;
  private coachBaseAtk = 0;
  private combat!: CombatInput;
  private blockingHeld = false;
  private ended = false;
  private resolving = false;
  private awaitingJudgment = false;
  private crowdMissio = false;
  private opponentId = "";
  private spectators: Spectator[] = [];
  private cheerUntil = 0;
  private nextTossAt = 0;
  private sand = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private favor = 50;
  private houseTint = 0xffffff;
  private firstBlood = false;
  private beastSeenAlive = false;
  private campMs = 0;
  private turtleMs = 0;
  private pressMs = 0;
  private fromNight = false;

  constructor() {
    super("ArenaScene");
  }

  init(): void {
    this.ended = false;
    this.resolving = false;
    this.awaitingJudgment = false;
    this.blockingHeld = false;
    this.beast = undefined;
    this.pal = undefined;
    this.spectators = [];
    this.watching = false;
    this.schoolNpcId = "";
    this.studentAi = undefined;
    this.watchSpeed = 1;
    this.watchStartedAt = 0;
    this.watchHud = [];
    this.coachUsed.clear();
    this.coachAtkUntil = 0;
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;
  }

  create(): void {
    this.ended = false;
    this.resolving = false;
    this.awaitingJudgment = false;
    this.crowdMissio = false;
    this.beast = undefined;
    this.spectators = [];
    this.cheerUntil = 0;
    this.favor = palBrought() ? 50 : 45;
    if (gameState.save.activePrayer === "nemesis") this.favor = Math.max(this.favor, 60);
    this.houseTint = 0xffffff;
    this.firstBlood = false;
    this.beastSeenAlive = false;
    this.campMs = 0;
    this.turtleMs = 0;
    this.pressMs = 0;
    this.fromNight = gameState.pendingNight;
    this.opponentId = gameState.pendingArenaOpponent ?? "serp_1";
    const school = gameState.pendingSchoolBout;
    this.watching = Boolean(school);
    this.schoolNpcId = school?.npcId ?? "";
    const found = getRival(this.opponentId);
    if (!found) {
      this.leave(false);
      return;
    }
    const { house, fighter } = found;
    const built = buildArena(house.id);
    const solids = paintMap(this, built, "arena");
    labelMap(this, arenaMetaFor(house.id).labels);
    this.cameras.main.setBounds(0, -HUD_CAM_PAD, built.cols * TILE_SIZE, built.rows * TILE_SIZE + HUD_CAM_PAD);
    const pad = house.id === "serpens" ? 5 : 4;
    this.sand = {
      x0: pad * TILE_SIZE,
      y0: pad * TILE_SIZE,
      x1: (built.cols - pad) * TILE_SIZE,
      y1: (built.rows - pad) * TILE_SIZE,
    };
    const houseTint = houseCrowdTint(house.id);
    this.houseTint = houseTint;
    this.seatCrowd(built.cols * TILE_SIZE, built.rows * TILE_SIZE, houseTint);

    const look = playerLook();
    if (this.watching) {
      const npc = getNpc(this.schoolNpcId);
      this.player = new Fighter(this, built.spawns.player.x, built.spawns.player.y, {
        key: `school-${npc.id}`,
        tunic: npc.color,
        accent: npc.accent,
        scale: npc.scale,
        stats: { ...schoolCombatStats(npc.id) },
        weapon: npc.weapon,
        team: "ally",
        style: bodyStyleFor(npc.id),
      });
      attachHpBar(this, this.player, npc.name);
      this.studentAi = new CombatAI(this.player, npc.aiStyle);
    } else {
      this.player = new Fighter(this, built.spawns.player.x, built.spawns.player.y, {
        key: "player-arena",
        tunic: look.tunic,
        accent: look.accent,
        style: look.style,
        cape: look.cape,
        scar: look.scar,
        crest: look.crest,
        stats: { ...playerCombatStats() },
        weapon: arenaWeapon() ?? "gladius",
        team: "player",
      });
    }
    this.player.revive(true);

    this.enemy = new Fighter(this, built.spawns.enemy.x, built.spawns.enemy.y, {
      key: `enemy-${fighter.id}`,
      tunic: fighter.color,
      accent: house.colors.accent,
      scale: fighter.scale,
      stats: { ...fighter.stats },
      weapon: fighter.weapon,
      team: "enemy",
      speed: 130 + fighter.stats.agility * 5,
      style: bodyStyleFor(fighter.id),
    });
    attachHpBar(this, this.enemy, fighter.isChampion ? undefined : fighter.name);
    this.ai = new CombatAI(this.enemy, fighter.aiStyle);

    this.physics.add.collider(this.player, solids);
    this.physics.add.collider(this.enemy, solids);
    this.physics.add.collider(this.player, this.enemy);

    const beastKind = this.watching ? null : this.championBeastKind(found.house.beastKind, fighter.isChampion);
    if (beastKind) {
      const spawnPad =
        beastKind === "elephant"
          ? 96
          : beastKind === "bear" || beastKind === "bull" || beastKind === "rhino"
            ? 88
            : beastKind === "boar" || beastKind === "wolf" || beastKind === "lion" || beastKind === "tiger"
              ? 72
              : beastKind === "serpent"
                ? 70
                : 56;
      const margin = beastKind === "elephant" ? 56 : 44;
      const bx = Phaser.Math.Clamp(this.enemy.x + spawnPad, this.sand.x0 + margin, this.sand.x1 - margin);
      const by = Phaser.Math.Clamp(this.enemy.y + 10, this.sand.y0 + margin, this.sand.y1 - margin);
      this.beast = new ArenaBeast(this, bx, by, beastKind);
      this.beastSeenAlive = true;
      this.physics.add.collider(this.beast, solids);
      this.physics.add.collider(this.beast, this.player);
      this.physics.add.collider(this.beast, this.enemy);
    }

    if (!this.watching && palBrought()) {
      const stats = palCombatStats();
      this.pal = new ArenaBeast(this, this.player.x - 48, this.player.y + 8, palKind(), "player", {
        label: stats.label,
        maxHp: stats.maxHp,
        bite: stats.bite,
        knock: stats.knock,
        speed: stats.speed,
        lungeSpd: stats.lungeSpd,
        visScale: stats.visScale,
        tint: stats.tint,
      });
      this.physics.add.collider(this.pal, solids);
      this.physics.add.collider(this.pal, this.enemy);
      if (this.beast) this.physics.add.collider(this.pal, this.beast);
    }

    const propTex: Record<string, string> = {
      crate: "prop-crate",
      barrel: "prop-barrel",
      brazier: "prop-brazier",
      hay: "prop-hay",
      lamp: "prop-lamp",
      vine: "prop-pit-vine",
      "pit-ring": "prop-pit-ring",
      "pit-skull": "prop-pit-skull",
      "pit-tusk": "prop-pit-tusk",
      "pit-horn": "prop-pit-horn",
      "pit-log": "prop-pit-log",
      "pit-ivory": "prop-pit-ivory",
    };
    const soft = new Set(["hay", "vine", "lamp"]);
    for (const p of built.props) {
      const tex = propTex[p.kind];
      if (!tex) continue;
      if (soft.has(p.kind)) {
        if (p.kind === "lamp") placeLamp(this, p.x, p.y);
        else this.add.image(p.x, p.y, tex).setDepth(p.y);
        continue;
      }
      const prop = new WorldProp(this, p.x, p.y, p.kind, tex, true);
      if (house.id === "leo") prop.setTint(0xd4a84b);
      this.physics.add.collider(this.player, prop);
      this.physics.add.collider(this.enemy, prop);
      if (this.beast) this.physics.add.collider(this.beast, prop);
      if (this.pal) this.physics.add.collider(this.pal, prop);
      if (p.kind === "brazier") animateBrazier(this, p.x, p.y);
    }

    this.combat = new CombatInput(this);
    this.input.keyboard?.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    this.game.canvas.focus();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    if (this.watching) bus.emit("boss", getNpc(this.schoolNpcId).name);
    else if (fighter.isChampion) bus.emit("boss", fighter.name);
    bus.emit("favor-show", { them: houseTint });
    bus.emit("favor", this.favor);
    if (this.pal) bus.emit("pal-hp-show");
    audio.setMusicMood("arena");
    audio.setCrowd(true);
    audio.roar("hit");
    bus.emit("combat-hud", { show: !this.watching });
    bus.on("player-attack", this.doAttack, this);
    bus.on("player-special", this.doSpecial, this);
    bus.on("skills-changed", this.onSkillsChanged, this);
    bus.on("cosmetics-changed", this.onCosmeticsChanged, this);
    bus.on("player-snared", this.onPlayerSnared, this);
    bus.on("judgment-pick", this.onJudgmentPick, this);
    bus.on("unstuck", this.onUnstuck, this);
    this.nextTossAt = this.time.now + 1800;

    bus.emit("dialogue", {
      name: this.watching ? getNpc(this.schoolNpcId).name : fighter.name,
      lines: this.watching
        ? [
            "You taught them. Now you watch from the stands.",
            ...fighter.intro,
          ]
        : fighter.intro,
      onDone: () => {
        gameState.paused = false;
        if (this.watching) this.showWatchHud();
      },
    });

    this.events.on("shutdown", () => {
      bus.emit("boss-hide");
      bus.emit("favor-hide");
      bus.emit("pal-hp-hide");
      bus.emit("judgment-hide");
      this.clearWatchHud();
      this.time.timeScale = 1;
      this.physics.world.timeScale = 1;
      this.ai?.destroy();
      this.studentAi?.destroy();
      this.beast?.destroy();
      this.pal?.destroy();
      bus.off("player-attack", this.doAttack, this);
      bus.off("player-special", this.doSpecial, this);
      bus.off("skills-changed", this.onSkillsChanged, this);
      bus.off("cosmetics-changed", this.onCosmeticsChanged, this);
      bus.off("player-snared", this.onPlayerSnared, this);
      bus.off("judgment-pick", this.onJudgmentPick, this);
      bus.off("unstuck", this.onUnstuck, this);
      audio.setCrowd(false);
      audio.setMusicMood("yard");
      bus.emit("combat-hud", { show: false });
    });
  }

  private showWatchHud(): void {
    this.clearWatchHud();
    this.watchStartedAt = this.time.now;
    this.coachUsed.clear();
    const banner = this.add
      .text(GAME_WIDTH / 2, 52, "YOUR STUDENT — coach from the stands (once each)", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "15px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(5000);
    const mkCoach = (x: number, label: string, kind: "steel" | "hold" | "roar") => {
      const btn = this.add
        .text(x, GAME_HEIGHT - 78, label, {
          fontFamily: "Cinzel, Georgia",
          fontSize: "15px",
          color: "#e8dcc8",
          backgroundColor: "#1a1210cc",
          padding: { x: 10, y: 6 },
        })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(5000)
        .setInteractive({ useHandCursor: true });
      btn.on("pointerdown", () => {
        if (this.coachUsed.has(kind)) return;
        this.coachCall(kind);
        btn.setColor("#6a5a4a").disableInteractive();
      });
      return btn;
    };
    const steel = mkCoach(GAME_WIDTH / 2 - 140, "Steel", "steel");
    const hold = mkCoach(GAME_WIDTH / 2, "Hold", "hold");
    const roar = mkCoach(GAME_WIDTH / 2 + 140, "Roar", "roar");
    const speedBtn = this.add
      .text(GAME_WIDTH / 2 - 90, GAME_HEIGHT - 32, "Speed 1x", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "15px",
        color: "#e8dcc8",
        backgroundColor: "#1a1210cc",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(5000)
      .setInteractive({ useHandCursor: true });
    speedBtn.on("pointerdown", () => {
      this.watchSpeed = this.watchSpeed >= 2 ? 1 : 2;
      this.time.timeScale = this.watchSpeed;
      this.physics.world.timeScale = this.watchSpeed;
      speedBtn.setText(`Speed ${this.watchSpeed}x`);
    });
    const skipBtn = this.add
      .text(GAME_WIDTH / 2 + 90, GAME_HEIGHT - 32, "Skip result", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "15px",
        color: "#e8c96a",
        backgroundColor: "#1a1210cc",
        padding: { x: 12, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(5000)
      .setInteractive({ useHandCursor: true });
    skipBtn.on("pointerdown", () => this.skipWatchBout());
    this.watchHud = [banner, steel, hold, roar, speedBtn, skipBtn];
  }

  private coachCall(kind: "steel" | "hold" | "roar"): void {
    if (!this.watching || this.ended || this.resolving || this.coachUsed.has(kind)) return;
    this.coachUsed.add(kind);
    if (kind === "steel") {
      this.coachBaseAtk = this.player.stats.attack;
      this.player.stats.attack = this.coachBaseAtk + 4;
      this.coachAtkUntil = this.time.now + 4500;
      bus.emit("toast", "Steel — strike harder.");
    } else if (kind === "hold") {
      this.player.stamina = Math.min(this.player.stats.maxStamina, this.player.stamina + 28);
      this.player.health = Math.min(this.player.stats.maxHealth, this.player.health + 12);
      bus.emit("toast", "Hold — breath and guard.");
    } else {
      this.addFavor(12);
      this.swellCrowd(900, "north");
      bus.emit("toast", "Roar — the stands lean your way.");
    }
    audio.sfx("ui");
  }


  private clearWatchHud(): void {
    for (const g of this.watchHud) g.destroy();
    this.watchHud = [];
  }

  private skipWatchBout(): void {
    if (!this.watching || this.ended || this.resolving) return;
    const elapsed = this.time.now - this.watchStartedAt;
    if (!this.firstBlood && elapsed < 8000) {
      bus.emit("toast", "Wait for first blood, or a few moments.");
      return;
    }
    const won = this.player.health >= this.enemy.health;
    this.clearWatchHud();
    this.beginTableau(won);
  }

  private championBeastKind(kind: BeastKind | undefined, isChampion: boolean): BeastKind | null {
    if (!isChampion || isTournamentId(this.opponentId)) return null;
    return kind ?? null;
  }

  private seatCrowd(worldW: number, worldH: number, houseTint: number): void {
    const north = [
      { y: 16, n: 26, stagger: 0 },
      { y: 26, n: 25, stagger: 9 },
      { y: 36, n: 26, stagger: 0 },
      { y: 46, n: 25, stagger: 9 },
    ];
    const south = [
      { y: worldH - 16, n: 26, stagger: 0 },
      { y: worldH - 26, n: 25, stagger: 9 },
      { y: worldH - 36, n: 26, stagger: 0 },
      { y: worldH - 46, n: 25, stagger: 9 },
    ];
    let i = 0;
    const addRow = (row: { y: number; n: number; stagger: number }, side: "north" | "south") => {
      const margin = 38;
      const span = worldW - margin * 2;
      for (let s = 0; s < row.n; s++) {
        const x = margin + (span / Math.max(1, row.n - 1)) * s + row.stagger;
        const v = i % 8;
        const idle = `crowd-${v}`;
        const cheer = `crowd-${v}-arm`;
        const houseWash = side === "south" ? (i % 3 === 0 ? houseTint : 0xe8dcc8) : i % 5 === 0 ? 0xe8c96a : 0xffffff;
        const img = this.add.image(x, row.y, idle).setDepth(4).setTint(houseWash);
        this.spectators.push({
          img,
          baseY: row.y,
          phase: i * 0.73,
          idle,
          cheer,
          raisedUntil: 0,
          nextGesture: this.time.now + Phaser.Math.Between(400, 2400),
          side,
          baseTint: houseWash,
        });
        i += 1;
      }
    };
    for (const row of north) addRow(row, "north");
    for (const row of south) addRow(row, "south");
  }

  private swellCrowd(ms = 700, side?: "north" | "south"): void {
    const now = this.time.now;
    this.cheerUntil = Math.max(this.cheerUntil, now + ms);
    audio.roar(ms >= 1400 ? "big" : ms >= 700 ? "hit" : "chip");
    const chance = 0.28 + this.favor / 240;
    for (const s of this.spectators) {
      if (side && s.side !== side) continue;
      if (Math.random() < chance) s.raisedUntil = now + Phaser.Math.Between(280, 640);
    }
  }

  private addFavor(delta: number): void {
    const prev = this.favor;
    const next = Phaser.Math.Clamp(this.favor + delta, 0, 100);
    if (next === this.favor) return;
    this.favor = next;
    bus.emit("favor", this.favor);
    if (Math.abs(delta) >= 4) {
      this.swellCrowd(560, delta > 0 ? "north" : "south");
      const mid = this.player ? { x: this.player.x, y: this.player.y - 48 } : { x: 400, y: 200 };
      floatNumber(this, mid.x, mid.y, delta > 0 ? "+FAVOR" : "THEY BOO", delta > 0 ? "#e8c96a" : "#e07060");
    }
    if (prev < CROWD_MISSIO && this.favor >= CROWD_MISSIO) bus.emit("crowd-call", "missio");
    if (prev > CROWD_IUGULA && this.favor <= CROWD_IUGULA) bus.emit("crowd-call", "iugula");
  }

  private onPlayerSnared = (): void => {
    if (this.busy()) return;
    this.addFavor(-8);
  };

  private updateCrowd(now: number): void {
    const cheering = now < this.cheerUntil;
    for (const s of this.spectators) {
      const hot = s.side === "north" ? this.favor >= 55 : this.favor <= 45;
      const amp = (cheering || hot ? 3.4 : 1.1) + (s.side === "north" ? this.favor : 100 - this.favor) / 80;
      const gestureGap = hot ? 520 : 1500;
      if (now >= s.nextGesture) {
        s.raisedUntil = now + Phaser.Math.Between(260, 520);
        s.nextGesture = now + Phaser.Math.Between(gestureGap, gestureGap + 1400);
      }
      s.img.y = s.baseY + Math.sin(now / 180 + s.phase) * amp;
      s.img.setTexture(now < s.raisedUntil ? s.cheer : s.idle);
      if (hot) s.img.setTint(s.side === "north" ? 0xe8c96a : this.houseTint);
      else s.img.setTint(s.baseTint);
    }
  }

  private pickTossKind(): TossKind {
    const r = Math.random();
    if (this.favor >= 65) {
      if (r < 0.06) return "cup";
      return r < 0.55 ? "flower" : "fruit";
    }
    if (this.favor <= 35) {
      if (r < 0.28) return r < 0.14 ? "cup" : "rock";
      return r < 0.64 ? "flower" : "fruit";
    }
    if (r < 1 / 8) return Math.random() < 0.5 ? "cup" : "rock";
    return r < 0.56 ? "flower" : "fruit";
  }

  private updateToss(now: number): void {
    if (this.ended || this.busy() || now < this.nextTossAt || this.spectators.length === 0) return;
    this.nextTossAt = now + Phaser.Math.Between(1500, 3000);
    const from = Phaser.Utils.Array.GetRandom(this.spectators);
    const kind = this.pickTossKind();
    const tex = `fx-${kind}`;
    let tx: number;
    let ty: number;
    if (Math.random() < 0.4) {
      const aim = this.randomCombatant();
      tx = Phaser.Math.Clamp(aim.x + Phaser.Math.Between(-36, 36), this.sand.x0, this.sand.x1);
      ty = Phaser.Math.Clamp(aim.y + Phaser.Math.Between(-36, 36), this.sand.y0, this.sand.y1);
    } else {
      tx = Phaser.Math.Between(this.sand.x0, this.sand.x1);
      ty = Phaser.Math.Between(this.sand.y0, this.sand.y1);
    }
    const sx = from.img.x;
    const sy = from.img.y;
    const proj = this.add.image(sx, sy, tex).setDepth(80).setScale(kind === "rock" ? 1.1 : 1);
    this.tweens.add({
      targets: proj,
      x: tx,
      duration: Phaser.Math.Between(620, 820),
      ease: "Sine.easeIn",
      onUpdate: (tw) => {
        const t = tw.progress;
        proj.y = sy + (ty - sy) * t - Math.sin(t * Math.PI) * 86;
        proj.angle += kind === "flower" ? 4 : 8;
        proj.setDepth(80);
      },
      onComplete: () => this.landToss(proj, kind, tx, ty),
    });
  }

  private landToss(proj: Phaser.GameObjects.Image, kind: TossKind, x: number, y: number): void {
    proj.destroy();
    const puff = this.add.image(x, y, "fx-dust").setDepth(y).setAlpha(0.7).setScale(0.7);
    this.tweens.add({
      targets: puff,
      alpha: 0,
      scale: 1.4,
      y: y - 8,
      duration: 280,
      onComplete: () => puff.destroy(),
    });
    if (kind !== "cup" && kind !== "rock") return;
    if (this.ended || this.busy()) return;
    const from = new Phaser.Math.Vector2(0, 1);
    for (const t of this.combatants()) {
      if (!t.alive) continue;
      if (Phaser.Math.Distance.Between(x, y, t.x, t.y) > 18) continue;
      from.set(t.x - x, t.y - y);
      if (from.lengthSq() < 1) from.set(0, 1);
      else from.normalize();
      const result = t.takeDamage(6, from, 18);
      if (result === "miss") continue;
      if (t === this.player && (kind === "cup" || kind === "rock") && result === "hit") this.addFavor(-4);
      if (result === "perfect") {
        floatNumber(this, t.x, t.y - 18, "PERFECT", "#ffe08a");
        continue;
      }
      if (result === "parry") continue;
      const shown = Math.max(1, Math.round(t.lastDamage));
      floatNumber(this, t.x, t.y - 20, String(shown), result === "block" ? "#7ab8e8" : "#e07060");
      burst(this, t.x, t.y, result === "block" ? 0x88aacc : 0xc2a36b);
    }
  }

  private combatants(): Array<Fighter | ArenaBeast> {
    const list: Array<Fighter | ArenaBeast> = [this.player, this.enemy];
    if (this.beast) list.push(this.beast);
    return list;
  }

  private randomCombatant(): Fighter | ArenaBeast {
    const live = this.combatants().filter((c) => c.alive);
    return live.length ? Phaser.Utils.Array.GetRandom(live) : this.player;
  }

  private onUnstuck = (): void => {
    if (!this.sys.isActive() || this.ended) return;
    const x = (this.sand.x0 + this.sand.x1) / 2;
    const y = this.sand.y1 - 40;
    this.player.setPosition(x, y);
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) {
      body.enable = true;
      body.reset(x, y);
      body.setVelocity(0, 0);
    }
  };

  private onCosmeticsChanged = (): void => {
    if (this.watching) return;
    const look = playerLook();
    this.player.applyLook(look.tunic, look.accent, look.style, look.cape, look.scar, look.crest);
  };

  private onSkillsChanged = (): void => {
    if (this.watching) return;
    this.player.refreshSkills();
    this.player.health = Math.min(this.player.health, this.player.stats.maxHealth);
  };

  private doAttack = (kind: unknown = "light"): void => {
    if (this.watching || this.busy()) return;
    this.player.tryAttack(kind === "heavy" ? "heavy" : "light");
  };

  private doSpecial = (): void => {
    if (this.watching || this.busy()) return;
    this.player.trySpecial();
  };

  private busy(): boolean {
    return gameState.paused || gameState.inDialogue || gameState.inMenu || this.ended || this.resolving;
  }

  private foes(): Array<Fighter | ArenaBeast> {
    const list: Array<Fighter | ArenaBeast> = [this.enemy];
    if (this.beast) list.push(this.beast);
    return list;
  }

  private palPrey(): Fighter | ArenaBeast {
    const live = this.foes().filter((f) => f.alive);
    if (!live.length || !this.pal) return this.enemy;
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

  private beastPrey(): Fighter | ArenaBeast {
    if (!this.beast) return this.player;
    if (!this.pal?.alive) return this.player;
    const toPlayer = Phaser.Math.Distance.Between(this.beast.x, this.beast.y, this.player.x, this.player.y);
    const toPal = Phaser.Math.Distance.Between(this.beast.x, this.beast.y, this.pal.x, this.pal.y);
    return toPal < toPlayer * 0.82 ? this.pal : this.player;
  }

  private onFoeHit = (attacker: Fighter, target: { x: number; y: number }, kind: "hit" | "block" | "perfect" | "parry" | "miss"): void => {
    this.swellCrowd(kind === "hit" ? 820 : 480, attacker === this.player ? "north" : "south");
    const onYou = target === this.player;
    if (kind === "perfect" || kind === "parry") {
      this.addFavor(onYou ? -2 : 6);
      return;
    }
    if (attacker === this.player && kind === "hit") {
      this.addFavor(this.player.attackKind === "special" ? 10 : this.player.attackKind === "heavy" ? 7 : 4);
      if (!this.firstBlood) {
        this.firstBlood = true;
        this.addFavor(12);
        audio.roar("big");
      }
    }
    if (attacker === this.enemy && onYou && kind === "hit") this.addFavor(-8);
    if (attacker === this.enemy && onYou && kind === "block") this.addFavor(-2);
  };

  private updateHabits(delta: number): void {
    if (!this.player.alive || !this.enemy.alive) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
    if (dist > 150) {
      this.campMs += delta;
      this.pressMs = 0;
      if (this.campMs > 1600) {
        this.campMs = 0;
        this.addFavor(-5);
      }
    } else {
      this.campMs = 0;
      if (dist < 80) {
        this.pressMs += delta;
        if (this.pressMs > 1800) {
          this.pressMs = 0;
          this.addFavor(2);
        }
      } else this.pressMs = 0;
    }
    if (this.blockingHeld && this.player.combat === "block") {
      this.turtleMs += delta;
      if (this.turtleMs > 1400) {
        this.turtleMs = 0;
        this.addFavor(-4);
      }
    } else this.turtleMs = 0;
  }

  update(_t: number, delta: number): void {
    if (!this.player) return;
    const now = this.time.now;
    this.updateCrowd(now);
    if (this.ended) return;

    if (this.resolving) {
      this.player.setVelocity(0, 0);
      this.enemy?.setVelocity(0, 0);
      this.beast?.setVelocity(0, 0);
      this.pal?.setVelocity(0, 0);
      this.player.syncVisuals(now);
      this.enemy?.syncVisuals(now);
      this.beast?.syncVisuals(now);
      this.pal?.syncVisuals(now);
      return;
    }

    if (this.busy()) {
      this.player.setVelocity(0, 0);
      this.enemy?.setVelocity(0, 0);
      this.beast?.setVelocity(0, 0);
      this.pal?.setVelocity(0, 0);
      this.player.syncVisuals(now);
      this.enemy?.syncVisuals(now);
      this.beast?.syncVisuals(now);
      this.pal?.syncVisuals(now);
      return;
    }

    this.updateToss(now);

    if (this.watching) {
      if (this.coachAtkUntil && now >= this.coachAtkUntil) {
        this.player.stats.attack = this.coachBaseAtk || this.player.stats.attack;
        this.coachAtkUntil = 0;
      }
      if (this.combat.justPressed("interact")) this.skipWatchBout();
      this.studentAi?.update(this.enemy, now);
      if (this.enemy.alive) this.ai.update(this.player, now);
      else this.enemy.setVelocity(0, 0);
      if (this.player.hitboxActive) resolveHits(this.player, this.foes(), (t, kind) => this.onFoeHit(this.player, t, kind));
      if (this.enemy.hitboxActive) resolveHits(this.enemy, [this.player], (t, kind) => this.onFoeHit(this.enemy, t, kind));
      this.player.updateNet(this.foes(), delta);
      this.enemy.updateNet([this.player], delta);
      this.player.syncVisuals(now);
      this.enemy.syncVisuals(now);
      bus.emit("boss-hp", this.enemy.health / this.enemy.stats.maxHealth);
      if (!this.player.alive) this.beginTableau(false);
      else if (!this.enemy.alive) this.beginTableau(true);
      return;
    }

    const move = this.combat.moveVector();
    this.player.tryMove(move.x * this.player.moveSpeed, move.y * this.player.moveSpeed);
    if (this.combat.justPressed("attack")) this.doAttack("light");
    if (this.combat.justPressed("heavy")) this.doAttack("heavy");
    if (this.combat.justPressed("dodge")) this.player.tryDodge();
    if (this.combat.justPressed("special")) this.player.trySpecial();
    if (this.combat.justPressed("parry")) this.player.tryParry();
    if (this.combat.justPressed("unguent")) this.player.tryUnguent();
    const block = this.combat.pollBlock();
    if (block === "start") {
      this.blockingHeld = true;
      this.player.setBlocking(true);
    } else if (block === "end") {
      this.blockingHeld = false;
      this.player.setBlocking(false);
    }
    if (this.blockingHeld) this.player.setBlocking(true);
    this.player.regen(delta);
    this.updateHabits(delta);
    if (this.enemy.alive) this.ai.update(this.player, now);
    else this.enemy.setVelocity(0, 0);
    const beastPrey = this.beastPrey();
    this.beast?.updateAi(beastPrey, now);
    this.pal?.updateAi(this.palPrey(), now);

    if (this.player.hitboxActive) resolveHits(this.player, this.foes(), (t, kind) => this.onFoeHit(this.player, t, kind));
    if (this.enemy.hitboxActive) {
      const marks = this.pal?.alive ? [this.player, this.pal] : [this.player];
      resolveHits(this.enemy, marks, (t, kind) => this.onFoeHit(this.enemy, t, kind));
    }
    if (this.beast?.tryBite(beastPrey)) this.swellCrowd(500);
    if (this.pal?.tryBite(this.palPrey())) this.addFavor(3);

    this.player.updateNet(this.foes(), delta);
    this.enemy.updateNet(this.pal?.alive ? [this.player, this.pal] : [this.player], delta);

    if (this.beastSeenAlive && this.beast && !this.beast.alive) {
      this.beastSeenAlive = false;
      this.addFavor(10);
    }

    this.player.syncVisuals(now);
    this.enemy.syncVisuals(now);
    this.beast?.syncVisuals(now);
    this.pal?.syncVisuals(now);
    gameState.save.health = this.player.health;
    gameState.save.stamina = this.player.stamina;
    bus.emit("boss-hp", this.enemy.health / this.enemy.stats.maxHealth);
    if (this.pal) bus.emit("pal-hp", this.pal.alive ? this.pal.health / this.pal.maxHealth : 0);

    if (!this.player.alive) this.beginTableau(false);
    else if (!this.enemy.alive && (!this.beast || !this.beast.alive)) this.beginTableau(true);
  }

  private beginTableau(won: boolean): void {
    if (this.resolving || this.ended) return;
    this.resolving = true;
    this.clearWatchHud();
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;
    this.player.setVelocity(0, 0);
    this.enemy.setVelocity(0, 0);
    this.beast?.setVelocity(0, 0);
    this.pal?.setVelocity(0, 0);
    this.player.freeze(8000);
    this.enemy.freeze(8000);
    this.pal?.freeze(8000);

    const dx = this.enemy.x - this.player.x;
    const dy = this.enemy.y - this.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    this.player.facing.set(dx / dist, dy / dist);
    this.enemy.facing.set(-dx / dist, -dy / dist);

    this.cameras.main.stopFollow();
    this.cameras.main.pan((this.player.x + this.enemy.x) / 2, (this.player.y + this.enemy.y) / 2, 280);
    this.haltBodies();
    this.swellCrowd(1800);

    this.crowdMissio = this.favor >= CROWD_MISSIO;
    if (this.watching) {
      this.crowdMissio = true;
      if (!won) {
        this.playVerdict(false, true, true);
        return;
      }
      this.player.poseReady();
      this.enemy.poseKneel();
      this.time.delayedCall(900, () => {
        if (!this.ended) this.playVerdict(true, true, true);
      });
      return;
    }
    if (!won) {
      this.playVerdict(false, this.crowdMissio, true);
      return;
    }

    // Editor nights: skip missio/iugula (purse fight, not a house spectacle)
    if (this.fromNight) {
      this.player.poseReady();
      this.enemy.poseKneel();
      this.time.delayedCall(700, () => {
        if (!this.ended) this.playVerdict(true, true, true);
      });
      return;
    }

    this.player.poseReady();
    this.enemy.poseKneel();
    this.awaitingJudgment = true;
    bus.emit("crowd-call", this.crowdMissio ? "missio" : "iugula");
    bus.emit("judgment-show", { crowd: this.crowdMissio ? "missio" : "iugula" });
  }

  private onJudgmentPick = (payload: { follow: boolean }): void => {
    if (!this.awaitingJudgment || this.ended) return;
    this.awaitingJudgment = false;
    bus.emit("judgment-hide");
    const missio = payload.follow ? this.crowdMissio : !this.crowdMissio;
    this.playVerdict(true, missio, payload.follow);
  };

  private haltBodies(): void {
    const stop = (obj?: Phaser.Physics.Arcade.Sprite) => {
      if (!obj) return;
      obj.setVelocity(0, 0);
      const body = obj.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) body.enable = false;
    };
    stop(this.player);
    stop(this.enemy);
    stop(this.beast);
    stop(this.pal);
  }

  private resetCamera(): void {
    try {
      this.tweens.killTweensOf(this.cameras.main);
      this.cameras.main.resetFX();
      this.cameras.main.setZoom(1);
    } catch {
      /* camera already tearing down */
    }
  }

  private playVerdict(won: boolean, missio: boolean, followed: boolean): void {
    const winner = won ? this.player : this.enemy;
    const loser = won ? this.enemy : this.player;
    this.haltBodies();

    const dx = this.enemy.x - this.player.x;
    const dy = this.enemy.y - this.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / dist;
    const ny = dy / dist;

    if (missio) {
      this.playMercy(won, winner, loser, nx, ny, followed);
      return;
    }

    this.playSlaughter(won, winner, loser, nx, ny, followed);
  }

  /** Spare them: kneel stays living, winner steps back with blade lowered. */
  private playMercy(
    won: boolean,
    winner: Fighter,
    loser: Fighter,
    nx: number,
    ny: number,
    followed: boolean,
  ): void {
    loser.poseKneel();
    winner.poseMercy();
    this.verdictFlash(true);
    this.verdictBanner("MISSIO", "MERCY — LIFE", "#ffe08a");

    const back = won ? -1 : 1;
    this.tweens.add({
      targets: winner,
      x: winner.x + nx * 34 * back,
      y: winner.y + ny * 22 * back,
      duration: 560,
      ease: "Sine.easeOut",
    });
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 0.94,
      duration: 480,
      ease: "Sine.easeOut",
      yoyo: true,
      hold: 400,
    });

    this.sandStain(loser.x, loser.y, 0xd4b06a, 0xffe08a);
    for (let i = 0; i < 8; i++) {
      const px = loser.x + Phaser.Math.Between(-18, 18);
      const py = loser.y + Phaser.Math.Between(-8, 12);
      const mote = this.add.image(px, py, "spark").setTint(0xffe08a).setDepth(8).setScale(0.45).setAlpha(0.9);
      this.tweens.add({
        targets: mote,
        y: py - Phaser.Math.Between(28, 48),
        alpha: 0,
        scale: 0.1,
        duration: 900 + i * 40,
        ease: "Sine.easeOut",
        onComplete: () => mote.destroy(),
      });
    }
    audio.sfx("missio");
    this.swellCrowd(1400);
    this.time.delayedCall(1700, () => this.finish(won, true, followed));
  }

  private playSlaughter(
    won: boolean,
    winner: Fighter,
    loser: Fighter,
    nx: number,
    ny: number,
    followed: boolean,
  ): void {
    loser.poseKneel();
    winner.poseFlourish();
    this.haltBodies();

    const wash = this.add
      .rectangle(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, 0xb33a2b, 0.1)
      .setDepth(40)
      .setScrollFactor(0);
    this.tweens.add({
      targets: wash,
      alpha: 0.32,
      duration: 280,
      yoyo: true,
      hold: 420,
    });

    const thrust = won ? 1 : -1;
    this.tweens.add({
      targets: winner,
      x: winner.x + nx * 28 * thrust,
      y: winner.y + ny * 16 * thrust,
      duration: 420,
      ease: "Quad.easeIn",
    });
    this.tweens.add({
      targets: this.cameras.main,
      zoom: 1.12,
      duration: 400,
      ease: "Quad.easeIn",
    });

    this.time.delayedCall(400, () => {
      if (this.ended) return;
      loser.poseSteel();
      winner.poseFlourish();
      this.verdictFlash(false);
      this.verdictBanner("IUGULA", "STEEL — DEATH", "#e07060");
      const midX = (winner.x + loser.x) / 2;
      const midY = (winner.y + loser.y) / 2;
      burst(this, midX, midY, 0xc43a2b, true);
      this.sandStain(loser.x, loser.y, 0x6a2020, 0xb33a2b);
      if (gameState.settings.screenShake) this.cameras.main.shake(220, 0.008);
      this.tweens.add({
        targets: this.cameras.main,
        zoom: 1,
        duration: 520,
        ease: "Sine.easeOut",
      });
      audio.sfx(won ? "win" : "lose");
      audio.sfx("crowd");
      this.swellCrowd(1600);
    });
    this.time.delayedCall(1900, () => {
      if (wash.active) wash.destroy();
      this.finish(won, false, followed);
    });
  }

  private verdictFlash(mercy: boolean): void {
    const wash = this.add
      .rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        mercy ? 0xffe08a : 0xb33a2b,
        mercy ? 0.16 : 0.18,
      )
      .setDepth(45)
      .setScrollFactor(0);
    this.tweens.add({
      targets: wash,
      alpha: 0,
      duration: mercy ? 700 : 560,
      onComplete: () => wash.destroy(),
    });
  }

  private verdictBanner(latin: string, plain: string, color: string): void {
    const cx = (this.player.x + this.enemy.x) / 2;
    const cy = Math.min(this.player.y, this.enemy.y) - 56;
    const title = this.add
      .text(cx, cy, latin, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "40px",
        color,
        stroke: "#1a1210",
        strokeThickness: 8,
      })
      .setOrigin(0.5)
      .setDepth(5000)
      .setAlpha(0)
      .setScale(0.75);
    const sub = this.add
      .text(cx, cy + 34, plain, {
        fontFamily: "Georgia",
        fontSize: "18px",
        color: "#e8dcc8",
        stroke: "#1a1210",
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(5000)
      .setAlpha(0);
    this.tweens.add({
      targets: title,
      alpha: 1,
      scale: 1,
      duration: 240,
      ease: "Back.easeOut",
    });
    this.tweens.add({
      targets: sub,
      alpha: 1,
      duration: 280,
      delay: 80,
    });
    this.tweens.add({
      targets: [title, sub],
      y: "-=28",
      alpha: 0,
      delay: 980,
      duration: 520,
      onComplete: () => {
        title.destroy();
        sub.destroy();
      },
    });
  }

  private sandStain(x: number, y: number, dustTint = 0x6a4a28, ringTint = 0xc2a36b): void {
    const stain = this.add.image(x, y + 10, "fx-dust").setDepth(2).setAlpha(0.75).setScale(1.5).setTint(dustTint);
    this.tweens.add({
      targets: stain,
      alpha: 0,
      scale: 2.3,
      duration: 1500,
      onComplete: () => stain.destroy(),
    });
    const ring = this.add.image(x, y, "fx-ring").setTint(ringTint).setAlpha(0.6).setScale(0.35).setDepth(3);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.35,
      duration: 580,
      onComplete: () => ring.destroy(),
    });
  }

  private finish(won: boolean, missio = false, followed = true): void {
    if (this.ended) return;
    this.ended = true;
    this.awaitingJudgment = false;
    this.resetCamera();
    this.time.timeScale = 1;
    this.physics.world.timeScale = 1;
    bus.emit("judgment-hide");
    const found = getRival(this.opponentId);
    if (!found) {
      this.leave(won);
      return;
    }
    const fighter = found.fighter;

    // Night bouts: skip result modal (it was freezing returns) — toast and go home
    if (this.fromNight && !this.watching) {
      if (won) {
        const r = applyArenaVictory(this.opponentId);
        bus.emit(
          "toast",
          r.nightNote
            ? `${r.nightNote} +${r.denarii} denarii.`
            : `Night won. +${r.denarii} denarii  ·  +${r.xp} XP`,
        );
      } else {
        applyArenaDefeat(missio);
        bus.emit("toast", "The night marked you. Rest in Quarters, or drink unguent.");
      }
      this.leave(won);
      return;
    }

    if (this.watching) {
      const npc = getNpc(this.schoolNpcId);
      const r = applySchoolBout(this.schoolNpcId, this.opponentId, won);
      let extra = "";
      if (r.glory) extra += `\n\nGlory. Act goal done for ${npc.name}.`;
      if (r.allGlory) extra += "\n\nTeacher of the Sand. Speak with Marcellus.";
      const theirs = npc.id === "aelia" ? "Hers" : "His";
      bus.emit("result", {
        title: r.glory ? "Glory" : won ? "The stands roar" : "The body remembers",
        body: won
          ? `You watch from the stands.\n${npc.name} stands.\n\n+${r.denarii} denarii${extra}`
          : `You watch from the stands.\nThe body remembers. ${theirs}, this time.\n${npc.name} will need rest — first recovery this visit is free.`,
        action: "Return to the ludus",
      });
      bus.once("result-closed", () => this.leave(won));
      return;
    }
    if (won) {
      const r = applyArenaVictory(this.opponentId);
      let extra = "";
      if (this.opponentId === "tourney_3") {
        extra = "\n\nThe rudis is yours. You are free.\nSpeak with Marcellus. The school is next.\nTitle unlocked: the Free Man.";
      } else if (isTournamentId(this.opponentId)) {
        extra = "\n\nThe next bout waits. Do not leave the sand.";
      } else if (fighter.isChampion) {
        const nxt = nextHouseAfter(found.house.id);
        extra = nxt
          ? `\n\n${found.house.latinName} is beaten. ${nxt.latinName} is open.`
          : "\n\nThe other houses are beaten. The Rudis waits at the gate.";
        if (r.unlocked) extra += `\nUnlocked: ${getWeapon(r.unlocked).name}`;
      } else if (r.unlocked) extra = `\nUnlocked: ${getWeapon(r.unlocked).name}`;
      if (r.palNote) extra += `\n\n${r.palNote}`;
      if (r.nightNote) extra += `\n\n${r.nightNote}`;
      const missioLine = missio
        ? followed
          ? "The crowd called missio. You stepped off. They live.\n\n"
          : "The stands wanted blood. You showed mercy anyway.\n\n"
        : followed
          ? "The crowd called iugula. Steel. The stands roar.\n\n"
          : "They begged missio. You put steel in anyway.\n\n";
      const chain = won && isTournamentId(this.opponentId) && this.opponentId !== "tourney_3" && !gameState.save.freedomWon;
      const feast = wantsFeast(this.opponentId, this.fromNight) && !chain;
      if (feast) extra += "\n\nThe house waits in the feast.";
      bus.emit("result", {
        title: missio ? "Missio" : "Iugula",
        body: `${missioLine}${fighter.victory.join("\n")}\n\n+${r.denarii} denarii   +${r.xp} XP${r.leveled ? "\nYou grow stronger." : ""}${extra}`,
        action: chain ? "Next bout" : feast ? "Join the feast" : "Return to the ludus",
      });
    } else {
      applyArenaDefeat(missio);
      bus.emit("result", {
        title: missio ? "Spared" : "Defeat",
        body: missio
          ? `${fighter.defeat.join("\n")}\n\nThe crowd wants you back. Marcellus' men drag you from the sand.\nYou wake in the ludus. Nothing you earned is lost.`
          : `${fighter.defeat.join("\n")}\n\nYou fall. The stands go quiet.\nYou wake in the ludus. A few denarii are lost. The fall left a mark — equip scars in Quarters.`,
        action: "Return to the ludus",
      });
    }
    bus.once("result-closed", () => this.leave(won));
  }

  private leave(won: boolean): void {
    bus.emit("boss-hide");
    bus.emit("favor-hide");
    bus.emit("pal-hp-hide");
    bus.emit("judgment-hide");
    gameState.paused = false;
    gameState.inMenu = false;
    gameState.inDialogue = false;

    if (this.watching) {
      gameState.pendingArenaOpponent = null;
      gameState.pendingSchoolBout = null;
      clearNightEntry();
      gameState.restoreVitals();
      gameState.persist();
      returnFromArena(this.game);
      return;
    }
    if (won && isTournamentId(this.opponentId) && !gameState.save.freedomWon) {
      const next = nextUnlockedOpponent();
      if (next && isTournamentId(next)) {
        gameState.pendingArenaOpponent = next;
        this.scene.restart();
        return;
      }
    }
    gameState.pendingArenaOpponent = null;
    clearNightEntry();
    if (won && wantsFeast(this.opponentId, this.fromNight)) gameState.beginFeast();
    else gameState.restoreVitals();
    gameState.persist();
    returnFromArena(this.game);
  }
}
