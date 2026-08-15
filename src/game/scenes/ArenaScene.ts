import Phaser from "phaser";
import { TILE_SIZE } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { audio } from "../systems/audio";
import { paintMap, labelMap } from "../systems/worldRender";
import { arenaMetaFor, buildArena } from "../maps/maps";
import { Fighter, attachHpBar } from "../entities/Fighter";
import { ArenaBeast, type BeastKind } from "../entities/Beast";
import { playerLook } from "../data/shop";
import { CombatAI } from "../systems/ai";
import { bodyStyleFor } from "../systems/assets";
import { burst, floatNumber, resolveHits } from "../systems/combat";
import { getRival, houseCrowdTint, isTournamentId } from "../data/houses";
import { applyArenaVictory, applyArenaDefeat, nextHouseAfter, nextUnlockedOpponent } from "../systems/progression";
import { getWeapon } from "../data/weapons";
import { palBrought, palStats, palTier, palTitle } from "../data/pal";
import { CombatInput } from "../systems/input";

type Spectator = {
  img: Phaser.GameObjects.Image;
  baseY: number;
  phase: number;
  idle: string;
  cheer: string;
  raisedUntil: number;
  nextGesture: number;
};

type TossKind = "flower" | "fruit" | "cup" | "rock";

export class ArenaScene extends Phaser.Scene {
  private player!: Fighter;
  private enemy!: Fighter;
  private beast?: ArenaBeast;
  private pal?: ArenaBeast;
  private ai!: CombatAI;
  private combat!: CombatInput;
  private blockingHeld = false;
  private ended = false;
  private resolving = false;
  private opponentId = "";
  private spectators: Spectator[] = [];
  private cheerUntil = 0;
  private nextTossAt = 0;
  private sand = { x0: 0, y0: 0, x1: 0, y1: 0 };
  private favor = 45;
  private firstBlood = false;
  private beastSeenAlive = false;
  private campMs = 0;
  private turtleMs = 0;
  private pressMs = 0;

  constructor() {
    super("ArenaScene");
  }

  create(): void {
    this.ended = false;
    this.resolving = false;
    this.beast = undefined;
    this.spectators = [];
    this.cheerUntil = 0;
    this.favor = 45;
    this.firstBlood = false;
    this.beastSeenAlive = false;
    this.campMs = 0;
    this.turtleMs = 0;
    this.pressMs = 0;
    this.opponentId = gameState.pendingArenaOpponent ?? "fox_1";
    const found = getRival(this.opponentId);
    if (!found) {
      this.leave(false);
      return;
    }
    const { house, fighter } = found;
    const built = buildArena(house.id);
    const solids = paintMap(this, built, "arena");
    labelMap(this, arenaMetaFor(house.id).labels);
    this.cameras.main.setBounds(0, 0, built.cols * TILE_SIZE, built.rows * TILE_SIZE);
    this.sand = {
      x0: 4 * TILE_SIZE,
      y0: 4 * TILE_SIZE,
      x1: (built.cols - 4) * TILE_SIZE,
      y1: (built.rows - 4) * TILE_SIZE,
    };
    const houseTint = houseCrowdTint(house.id);
    this.seatCrowd(built.cols * TILE_SIZE, built.rows * TILE_SIZE, houseTint);

    const look = playerLook();
    this.player = new Fighter(this, built.spawns.player.x, built.spawns.player.y, {
      key: "player-arena",
      tunic: look.tunic,
      accent: look.accent,
      style: look.style,
      cape: look.cape,
      scar: look.scar,
      crest: look.crest,
      stats: { ...gameState.save.stats },
      weapon: gameState.save.equippedWeapon,
      team: "player",
    });
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

    const beastKind = this.championBeastKind(found.house.beastKind, fighter.isChampion);
    if (beastKind) {
      const spawnPad =
        beastKind === "bear" || beastKind === "bull"
          ? 88
          : beastKind === "boar" || beastKind === "wolf" || beastKind === "lion"
            ? 72
            : beastKind === "serpent"
              ? 70
              : 56;
      this.beast = new ArenaBeast(this, this.enemy.x + spawnPad, this.enemy.y + 10, beastKind);
      this.beastSeenAlive = true;
      this.physics.add.collider(this.beast, solids);
      this.physics.add.collider(this.beast, this.player);
      this.physics.add.collider(this.beast, this.enemy);
    }

    if (palBrought()) {
      const tier = palTier();
      const stats = palStats(tier);
      this.pal = new ArenaBeast(this, this.player.x - 48, this.player.y + 8, "eagle", "player", {
        label: palTitle(tier),
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

    this.combat = new CombatInput(this);
    this.input.keyboard?.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    this.game.canvas.focus();

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);
    if (fighter.isChampion) bus.emit("boss", fighter.name);
    bus.emit("favor-show");
    bus.emit("favor", this.favor);
    audio.sfx("crowd");
    bus.on("player-attack", this.doAttack, this);
    bus.on("player-special", this.doSpecial, this);
    bus.on("skills-changed", this.onSkillsChanged, this);
    bus.on("cosmetics-changed", this.onCosmeticsChanged, this);
    bus.on("player-snared", this.onPlayerSnared, this);
    this.nextTossAt = this.time.now + 1800;

    bus.emit("dialogue", {
      name: fighter.name,
      lines: fighter.intro,
      onDone: () => {
        gameState.paused = false;
      },
    });

    this.events.on("shutdown", () => {
      bus.emit("boss-hide");
      bus.emit("favor-hide");
      this.ai?.destroy();
      this.beast?.destroy();
      this.pal?.destroy();
      bus.off("player-attack", this.doAttack, this);
      bus.off("player-special", this.doSpecial, this);
      bus.off("skills-changed", this.onSkillsChanged, this);
      bus.off("cosmetics-changed", this.onCosmeticsChanged, this);
      bus.off("player-snared", this.onPlayerSnared, this);
    });
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
    for (const row of [...north, ...south]) {
      const margin = 38;
      const span = worldW - margin * 2;
      for (let s = 0; s < row.n; s++) {
        const x = margin + (span / Math.max(1, row.n - 1)) * s + row.stagger;
        const v = i % 8;
        const idle = `crowd-${v}`;
        const cheer = `crowd-${v}-arm`;
        const houseWash = i % 5 === 0 ? houseTint : i % 7 === 0 ? 0xe8dcc8 : 0xffffff;
        const img = this.add.image(x, row.y, idle).setDepth(4).setTint(houseWash);
        this.spectators.push({
          img,
          baseY: row.y,
          phase: i * 0.73,
          idle,
          cheer,
          raisedUntil: 0,
          nextGesture: this.time.now + Phaser.Math.Between(400, 2400),
        });
        i += 1;
      }
    }
  }

  private swellCrowd(ms = 700): void {
    const now = this.time.now;
    this.cheerUntil = Math.max(this.cheerUntil, now + ms);
    const chance = 0.22 + this.favor / 280;
    for (const s of this.spectators) {
      if (Math.random() < chance) s.raisedUntil = now + Phaser.Math.Between(280, 640);
    }
  }

  private addFavor(delta: number): void {
    const next = Phaser.Math.Clamp(this.favor + delta, 0, 100);
    if (next === this.favor) return;
    this.favor = next;
    bus.emit("favor", this.favor);
    if (delta >= 4) this.swellCrowd(500);
  }

  private onPlayerSnared = (): void => {
    if (this.busy()) return;
    this.addFavor(-5);
  };

  private updateCrowd(now: number): void {
    const cheering = now < this.cheerUntil;
    const amp = (cheering ? 3.2 : 1.1) + this.favor / 70;
    const gestureGap = this.favor >= 60 ? 700 : this.favor <= 35 ? 1600 : 1100;
    for (const s of this.spectators) {
      if (now >= s.nextGesture) {
        s.raisedUntil = now + Phaser.Math.Between(260, 520);
        s.nextGesture = now + Phaser.Math.Between(gestureGap, gestureGap + 1400);
      }
      s.img.y = s.baseY + Math.sin(now / 180 + s.phase) * amp;
      s.img.setTexture(now < s.raisedUntil ? s.cheer : s.idle);
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

  private onCosmeticsChanged = (): void => {
    const look = playerLook();
    this.player.applyLook(look.tunic, look.accent, look.style, look.cape, look.scar, look.crest);
  };

  private onSkillsChanged = (): void => {
    this.player.refreshSkills();
    this.player.health = Math.min(this.player.health, this.player.stats.maxHealth);
  };

  private doAttack = (kind: unknown = "light"): void => {
    if (this.busy()) return;
    this.player.tryAttack(kind === "heavy" ? "heavy" : "light");
  };

  private doSpecial = (): void => {
    if (this.busy()) return;
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
    this.swellCrowd(kind === "hit" ? 820 : 480);
    if (kind === "perfect" || kind === "parry") {
      if (target === this.player) this.addFavor(6);
      return;
    }
    if (attacker === this.player && kind === "hit") {
      this.addFavor(this.player.attackKind === "special" ? 5 : this.player.attackKind === "heavy" ? 3 : 2);
      if (!this.firstBlood) {
        this.firstBlood = true;
        this.addFavor(8);
      }
    }
  };

  private updateHabits(delta: number): void {
    if (!this.player.alive || !this.enemy.alive) return;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.enemy.x, this.enemy.y);
    if (dist > 150) {
      this.campMs += delta;
      this.pressMs = 0;
      if (this.campMs > 2200) {
        this.campMs = 0;
        this.addFavor(-3);
      }
    } else {
      this.campMs = 0;
      if (dist < 80) {
        this.pressMs += delta;
        if (this.pressMs > 2000) {
          this.pressMs = 0;
          this.addFavor(1);
        }
      } else this.pressMs = 0;
    }
    if (this.blockingHeld && this.player.combat === "block") {
      this.turtleMs += delta;
      if (this.turtleMs > 1800) {
        this.turtleMs = 0;
        this.addFavor(-2);
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
    if (this.pal?.tryBite(this.palPrey())) this.addFavor(1);

    this.player.updateNet(this.foes(), delta);
    this.enemy.updateNet(this.pal?.alive ? [this.player, this.pal] : [this.player], delta);

    if (this.beastSeenAlive && this.beast && !this.beast.alive) {
      this.beastSeenAlive = false;
      this.addFavor(6);
    }

    this.player.syncVisuals(now);
    this.enemy.syncVisuals(now);
    this.beast?.syncVisuals(now);
    this.pal?.syncVisuals(now);
    gameState.save.health = this.player.health;
    gameState.save.stamina = this.player.stamina;
    bus.emit("boss-hp", this.enemy.health / this.enemy.stats.maxHealth);

    if (!this.player.alive) this.beginTableau(false);
    else if (!this.enemy.alive && (!this.beast || !this.beast.alive)) this.beginTableau(true);
  }

  private beginTableau(won: boolean): void {
    if (this.resolving || this.ended) return;
    this.resolving = true;
    const missio = this.favor >= 55;
    this.player.setVelocity(0, 0);
    this.enemy.setVelocity(0, 0);
    this.beast?.setVelocity(0, 0);
    this.pal?.setVelocity(0, 0);
    this.player.freeze(1500);
    this.enemy.freeze(1500);
    this.pal?.freeze(1500);

    const dx = this.enemy.x - this.player.x;
    const dy = this.enemy.y - this.player.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    this.player.facing.set(dx / dist, dy / dist);
    this.enemy.facing.set(-dx / dist, -dy / dist);

    const winner = won ? this.player : this.enemy;
    const loser = won ? this.enemy : this.player;
    winner.poseFlourish();
    if (missio) loser.poseKneel();
    else loser.poseSteel();

    if (missio) {
      const sign = won ? -1 : 1;
      this.tweens.add({
        targets: winner,
        x: winner.x + (dx / dist) * 26 * sign,
        y: winner.y + (dy / dist) * 16 * sign,
        duration: 480,
        ease: "Sine.easeOut",
      });
    }

    this.cameras.main.stopFollow();
    this.cameras.main.pan((this.player.x + this.enemy.x) / 2, (this.player.y + this.enemy.y) / 2, 280);
    if (gameState.settings.screenShake) this.cameras.main.shake(missio ? 70 : 130, missio ? 0.002 : 0.005);
    this.swellCrowd(1600);
    this.sandStain(loser.x, loser.y);
    audio.sfx(missio ? "missio" : won ? "win" : "lose");

    this.time.delayedCall(1450, () => this.finish(won, missio));
  }

  private sandStain(x: number, y: number): void {
    const stain = this.add.image(x, y + 10, "fx-dust").setDepth(2).setAlpha(0.7).setScale(1.4).setTint(0x6a4a28);
    this.tweens.add({
      targets: stain,
      alpha: 0,
      scale: 2.1,
      duration: 1400,
      onComplete: () => stain.destroy(),
    });
    const ring = this.add.image(x, y, "fx-ring").setTint(0xc2a36b).setAlpha(0.55).setScale(0.4).setDepth(3);
    this.tweens.add({
      targets: ring,
      alpha: 0,
      scale: 1.15,
      duration: 520,
      onComplete: () => ring.destroy(),
    });
  }

  private finish(won: boolean, missio = false): void {
    if (this.ended) return;
    this.ended = true;
    const found = getRival(this.opponentId);
    const fighter = found!.fighter;
    if (won) {
      const r = applyArenaVictory(this.opponentId);
      let extra = "";
      if (this.opponentId === "tourney_3") {
        extra = "\n\nThe rudis is yours. Marcellus will put wood in your hand. You are free.\nTitle unlocked: the Free Man.";
      } else if (isTournamentId(this.opponentId)) {
        extra = "\n\nThe next bout waits. Do not leave the sand.";
      } else if (fighter.isChampion) {
        const nxt = nextHouseAfter(found!.house.id);
        extra = nxt
          ? `\n\n${found!.house.latinName} is beaten. ${nxt.latinName} is open.`
          : "\n\nThe other houses are beaten. The Rudis waits at the gate.";
        if (r.unlocked) extra += `\nUnlocked: ${getWeapon(r.unlocked).name}`;
      } else if (r.unlocked) extra = `\nUnlocked: ${getWeapon(r.unlocked).name}`;
      if (r.palNote) extra += `\n\n${r.palNote}`;
      const missioLine = missio
        ? "The crowd calls missio. You step off. They live. The bout is yours.\n\n"
        : "Steel. The stands roar.\n\n";
      const chain = won && isTournamentId(this.opponentId) && this.opponentId !== "tourney_3";
      bus.emit("result", {
        title: missio ? "Missio" : "Victory",
        body: `${missioLine}${fighter.victory.join("\n")}\n\n+${r.denarii} denarii   +${r.xp} XP${r.leveled ? "\nYou grow stronger." : ""}${extra}`,
        action: chain ? "Next bout" : "Return to the ludus",
      });
    } else {
      applyArenaDefeat(missio);
      bus.emit("result", {
        title: missio ? "Spared" : "Defeat",
        body: missio
          ? `${fighter.defeat.join("\n")}\n\nThe crowd wants you back. Marcellus' men drag you from the sand.\nYou wake in the ludus. Nothing you earned is lost.`
          : `${fighter.defeat.join("\n")}\n\nYou fall. The stands go quiet.\nYou wake in the ludus. A few denarii are lost. Your name is not.`,
        action: "Return to the ludus",
      });
    }
    bus.once("result-closed", () => this.leave(won));
  }

  private leave(won: boolean): void {
    bus.emit("boss-hide");
    bus.emit("favor-hide");
    if (won && isTournamentId(this.opponentId) && !gameState.save.freedomWon) {
      const next = nextUnlockedOpponent();
      if (next && isTournamentId(next)) {
        gameState.pendingArenaOpponent = next;
        this.scene.restart();
        return;
      }
    }
    gameState.pendingArenaOpponent = null;
    gameState.restoreVitals();
    gameState.persist();
    this.scene.stop();
    if (this.scene.isSleeping("LudusScene")) this.scene.wake("LudusScene");
    else this.scene.launch("LudusScene");
  }
}
