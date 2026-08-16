import Phaser from "phaser";
import { COLORS } from "../config";
import type { BeastKind } from "../types";
import type { HitResult } from "../systems/combat";
import { burst, floatNumber } from "../systems/combat";
import { audio } from "../systems/audio";

export type { BeastKind };

type BeastAi = "circle" | "telegraph" | "lunge" | "backoff" | "recover";
type BeastTrick = "feint" | "sideslip" | "double" | "flyby" | "slam" | "roar" | "charge" | "frenzy";

type BeastProfile = {
  tex: string;
  label: string;
  maxHp: number;
  bite: number;
  knock: number;
  speed: number;
  lungeSpd: number;
  lungeMs: number;
  telegraphMs: number;
  recoverMs: number;
  backoffMs: number;
  biteRange: number;
  lungeHitRange: number;
  dmgTaken: number;
  knockTaken: number;
  invulnMs: number;
  parryStun: number;
  visScale: number;
  shadowScale: number;
  bodyW: number;
  bodyH: number;
  bodyOx: number;
  bodyOy: number;
  hudY: number;
  markY: number;
  markR: number;
  visY: number;
  pressIn: boolean;
  trick: BeastTrick;
};

const PROFILES: Record<BeastKind, BeastProfile> = {
  fox: {
    tex: "beast-fox",
    label: "Fox",
    maxHp: 32,
    bite: 8,
    knock: 36,
    speed: 100,
    lungeSpd: 240,
    lungeMs: 200,
    telegraphMs: 560,
    recoverMs: 760,
    backoffMs: 380,
    biteRange: 16,
    lungeHitRange: 18,
    dmgTaken: 0.92,
    knockTaken: 1,
    invulnMs: 160,
    parryStun: 280,
    visScale: 1,
    shadowScale: 0.9,
    bodyW: 14,
    bodyH: 10,
    bodyOx: 6,
    bodyOy: 4,
    hudY: 28,
    markY: 22,
    markR: 6,
    visY: 10,
    pressIn: false,
    trick: "feint",
  },
  serpent: {
    tex: "beast-serpent",
    label: "Serpent",
    maxHp: 32,
    bite: 8,
    knock: 36,
    speed: 86,
    lungeSpd: 240,
    lungeMs: 200,
    telegraphMs: 560,
    recoverMs: 760,
    backoffMs: 380,
    biteRange: 18,
    lungeHitRange: 20,
    dmgTaken: 0.92,
    knockTaken: 1,
    invulnMs: 160,
    parryStun: 280,
    visScale: 1,
    shadowScale: 1.1,
    bodyW: 20,
    bodyH: 10,
    bodyOx: 6,
    bodyOy: 4,
    hudY: 32,
    markY: 26,
    markR: 7,
    visY: 10,
    pressIn: false,
    trick: "sideslip",
  },
  wolf: {
    tex: "beast-wolf",
    label: "Wolf",
    maxHp: 42,
    bite: 11,
    knock: 42,
    speed: 128,
    lungeSpd: 270,
    lungeMs: 190,
    telegraphMs: 480,
    recoverMs: 620,
    backoffMs: 300,
    biteRange: 20,
    lungeHitRange: 22,
    dmgTaken: 0.88,
    knockTaken: 0.9,
    invulnMs: 140,
    parryStun: 240,
    visScale: 1,
    shadowScale: 1.25,
    bodyW: 22,
    bodyH: 12,
    bodyOx: 4,
    bodyOy: 4,
    hudY: 30,
    markY: 24,
    markR: 7,
    visY: 10,
    pressIn: false,
    trick: "double",
  },
  bear: {
    tex: "beast-bear",
    label: "Grizzly",
    maxHp: 88,
    bite: 16,
    knock: 62,
    speed: 54,
    lungeSpd: 205,
    lungeMs: 300,
    telegraphMs: 680,
    recoverMs: 420,
    backoffMs: 200,
    biteRange: 28,
    lungeHitRange: 32,
    dmgTaken: 0.58,
    knockTaken: 0.28,
    invulnMs: 250,
    parryStun: 120,
    visScale: 1,
    shadowScale: 1.75,
    bodyW: 26,
    bodyH: 16,
    bodyOx: 2,
    bodyOy: 2,
    hudY: 42,
    markY: 34,
    markR: 10,
    visY: 14,
    pressIn: true,
    trick: "slam",
  },
  lion: {
    tex: "beast-lion",
    label: "Lion",
    maxHp: 56,
    bite: 13,
    knock: 48,
    speed: 92,
    lungeSpd: 250,
    lungeMs: 240,
    telegraphMs: 520,
    recoverMs: 640,
    backoffMs: 300,
    biteRange: 22,
    lungeHitRange: 24,
    dmgTaken: 0.82,
    knockTaken: 0.75,
    invulnMs: 170,
    parryStun: 220,
    visScale: 1,
    shadowScale: 1.35,
    bodyW: 18,
    bodyH: 14,
    bodyOx: 4,
    bodyOy: 4,
    hudY: 34,
    markY: 28,
    markR: 8,
    visY: 12,
    pressIn: true,
    trick: "roar",
  },
  bull: {
    tex: "beast-bull",
    label: "Bull",
    maxHp: 72,
    bite: 15,
    knock: 70,
    speed: 62,
    lungeSpd: 280,
    lungeMs: 380,
    telegraphMs: 720,
    recoverMs: 480,
    backoffMs: 180,
    biteRange: 24,
    lungeHitRange: 28,
    dmgTaken: 0.62,
    knockTaken: 0.32,
    invulnMs: 220,
    parryStun: 140,
    visScale: 1,
    shadowScale: 1.7,
    bodyW: 20,
    bodyH: 16,
    bodyOx: 2,
    bodyOy: 2,
    hudY: 50,
    markY: 42,
    markR: 10,
    visY: 16,
    pressIn: true,
    trick: "charge",
  },
  boar: {
    tex: "beast-boar",
    label: "Boar",
    maxHp: 80,
    bite: 16,
    knock: 58,
    speed: 70,
    lungeSpd: 220,
    lungeMs: 160,
    telegraphMs: 480,
    recoverMs: 400,
    backoffMs: 120,
    biteRange: 22,
    lungeHitRange: 24,
    dmgTaken: 0.52,
    knockTaken: 0.3,
    invulnMs: 230,
    parryStun: 130,
    visScale: 1,
    shadowScale: 1.25,
    bodyW: 20,
    bodyH: 12,
    bodyOx: 4,
    bodyOy: 4,
    hudY: 30,
    markY: 24,
    markR: 8,
    visY: 10,
    pressIn: true,
    trick: "frenzy",
  },
  raven: {
    tex: "beast-raven",
    label: "Raven",
    maxHp: 38,
    bite: 11,
    knock: 32,
    speed: 120,
    lungeSpd: 340,
    lungeMs: 260,
    telegraphMs: 360,
    recoverMs: 520,
    backoffMs: 260,
    biteRange: 12,
    lungeHitRange: 16,
    dmgTaken: 0.95,
    knockTaken: 1.1,
    invulnMs: 120,
    parryStun: 260,
    visScale: 1,
    shadowScale: 0.65,
    bodyW: 10,
    bodyH: 8,
    bodyOx: 4,
    bodyOy: 4,
    hudY: 22,
    markY: 18,
    markR: 5,
    visY: 8,
    pressIn: false,
    trick: "flyby",
  },
  tiger: {
    tex: "beast-tiger",
    label: "Tiger",
    maxHp: 52,
    bite: 14,
    knock: 44,
    speed: 132,
    lungeSpd: 290,
    lungeMs: 180,
    telegraphMs: 420,
    recoverMs: 560,
    backoffMs: 240,
    biteRange: 20,
    lungeHitRange: 22,
    dmgTaken: 0.86,
    knockTaken: 0.85,
    invulnMs: 140,
    parryStun: 230,
    visScale: 1,
    shadowScale: 1.45,
    bodyW: 28,
    bodyH: 14,
    bodyOx: 2,
    bodyOy: 4,
    hudY: 38,
    markY: 30,
    markR: 8,
    visY: 14,
    pressIn: false,
    trick: "feint",
  },
  eagle: {
    tex: "beast-eagle",
    label: "Eagle",
    maxHp: 36,
    bite: 8,
    knock: 32,
    speed: 118,
    lungeSpd: 300,
    lungeMs: 240,
    telegraphMs: 400,
    recoverMs: 540,
    backoffMs: 240,
    biteRange: 16,
    lungeHitRange: 18,
    dmgTaken: 0.9,
    knockTaken: 1,
    invulnMs: 140,
    parryStun: 240,
    visScale: 1,
    shadowScale: 0.8,
    bodyW: 16,
    bodyH: 10,
    bodyOx: 4,
    bodyOy: 4,
    hudY: 26,
    markY: 22,
    markR: 6,
    visY: 12,
    pressIn: false,
    trick: "flyby",
  },
};

export type BeastTeam = "player" | "enemy";

export class ArenaBeast extends Phaser.Physics.Arcade.Sprite {
  readonly kind: BeastKind;
  readonly team: BeastTeam;
  health: number;
  readonly maxHealth: number;
  lastDamage = 0;
  facing = new Phaser.Math.Vector2(-1, 0);
  hitboxActive = false;

  private readonly profile: BeastProfile;
  private readonly allyTint?: number;
  private vis!: Phaser.GameObjects.Image;
  private shadow!: Phaser.GameObjects.Image;
  private nameTag!: Phaser.GameObjects.Text;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBarFg!: Phaser.GameObjects.Rectangle;
  private telegraph?: Phaser.GameObjects.Arc;
  private aiState: BeastAi = "circle";
  private stateUntil = 0;
  private nextThink = 0;
  private circleDir = 1;
  private invulnUntil = 0;
  private flashUntil = 0;
  private frozenUntil = 0;
  private snaredUntil = 0;
  private snareFx?: Phaser.GameObjects.Image;
  private down = false;
  private lungeVx = 0;
  private lungeVy = 0;
  private chainLeft = 0;
  private feint = false;
  private usedFeint = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    kind: BeastKind,
    team: BeastTeam = "enemy",
    extras?: Partial<Pick<BeastProfile, "maxHp" | "bite" | "knock" | "speed" | "lungeSpd" | "visScale" | "label">> & { tint?: number },
  ) {
    super(scene, x, y, "char-shadow");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false);
    const { tint, ...rest } = extras ?? {};
    const p = { ...PROFILES[kind], ...rest };
    this.profile = p;
    this.kind = kind;
    this.team = team;
    this.allyTint = tint;
    this.maxHealth = p.maxHp;
    this.health = p.maxHp;
    this.setSize(p.bodyW, p.bodyH);
    (this.body as Phaser.Physics.Arcade.Body).setOffset(p.bodyOx, p.bodyOy);
    this.setCollideWorldBounds(true);

    this.shadow = scene.add.image(x, y + 8, "char-shadow").setDepth(1).setScale(p.shadowScale);
    this.vis = scene.add.image(x, y, p.tex).setDepth(y).setScale(p.visScale);
    if (this.allyTint) this.vis.setTint(this.allyTint);
    const bar = team === "player" ? 0x6aa84f : 0xb33a2b;
    this.hpBarBg = scene.add.rectangle(x, y - p.hudY, 36, 5, 0x1a1210).setStrokeStyle(1, 0xd4a84b, 0.7).setDepth(2000);
    this.hpBarFg = scene.add.rectangle(x, y - p.hudY, 36, 5, bar).setDepth(2001);
    this.nameTag = scene.add
      .text(x, y - p.hudY - 10, p.label, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "11px",
        color: team === "player" ? "#e8c96a" : "#f0e6d2",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(2002);
  }

  get alive(): boolean {
    return !this.down && this.health > 0;
  }

  isFrozen(): boolean {
    return this.scene.time.now < this.frozenUntil;
  }

  freeze(ms: number): void {
    this.frozenUntil = this.scene.time.now + ms;
    this.setVelocity(0, 0);
  }

  snare(ms: number): void {
    this.snaredUntil = this.scene.time.now + ms;
    this.setVelocity(0, 0);
    this.hitboxActive = false;
    this.snareFx?.destroy();
    this.snareFx = this.scene.add.image(this.x, this.y - 6, "fx-net").setDepth(this.y + 6).setAlpha(0.95).setScale(1.45);
  }

  takeDamage(amount: number, from: Phaser.Math.Vector2, knock: number, _special = false): HitResult {
    if (!this.alive) return "miss";
    const now = this.scene.time.now;
    if (now < this.invulnUntil) return "miss";
    const dmg = Math.max(2, amount * this.profile.dmgTaken);
    this.lastDamage = dmg;
    this.health = Math.max(0, this.health - dmg);
    this.flashUntil = now + 120;
    this.invulnUntil = now + this.profile.invulnMs;
    const angle = Math.atan2(from.y, from.x);
    const k = knock * this.profile.knockTaken;
    this.setVelocity(Math.cos(angle) * k, Math.sin(angle) * k);
    this.hitboxActive = false;
    audio.sfx("hurt");
    if (this.health <= 0) this.die();
    return "hit";
  }

  updateAi(target: { x: number; y: number; alive: boolean }, now: number): void {
    if (!this.alive) {
      this.setVelocity(0, 0);
      return;
    }
    if (this.isFrozen() || now < this.snaredUntil) {
      this.setVelocity(0, 0);
      return;
    }
    if (!target.alive) {
      this.setVelocity(0, 0);
      return;
    }

    const p = this.profile;
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / dist;
    const ny = dy / dist;
    this.facing.set(nx, ny);

    if (this.aiState === "telegraph") {
      if (p.trick === "sideslip") {
        this.setVelocity(-ny * p.speed * 1.15, nx * p.speed * 1.15);
      } else {
        this.setVelocity(0, 0);
      }
      if (this.telegraph) this.telegraph.setPosition(this.x, this.y - p.markY);
      if (now >= this.stateUntil) this.beginLunge(nx, ny, now);
      return;
    }

    if (this.aiState === "lunge") {
      this.setVelocity(this.lungeVx, this.lungeVy);
      const hitR = p.trick === "slam" ? p.lungeHitRange * 1.35 : p.lungeHitRange;
      this.hitboxActive = !this.feint && dist < hitR;
      if (now >= this.stateUntil) {
        this.hitboxActive = false;
        if (this.feint) {
          this.feint = false;
          this.beginTelegraph(now, target);
          return;
        }
        if (this.chainLeft > 0) {
          this.chainLeft -= 1;
          this.beginLunge(nx, ny, now);
          return;
        }
        this.aiState = "backoff";
        this.stateUntil = now + p.backoffMs;
      }
      return;
    }

    if (this.aiState === "backoff") {
      this.setVelocity(-nx * (p.pressIn ? 70 : 110), -ny * (p.pressIn ? 70 : 110));
      if (now >= this.stateUntil) {
        this.aiState = "recover";
        this.stateUntil = now + p.recoverMs;
      }
      return;
    }

    if (this.aiState === "recover") {
      this.setVelocity(-nx * (p.pressIn ? 22 : 40), -ny * (p.pressIn ? 22 : 40));
      if (now >= this.stateUntil) {
        this.aiState = "circle";
        this.nextThink = now + 200;
      }
      return;
    }

    if (p.pressIn) {
      if (dist > 64) this.setVelocity(nx * p.speed, ny * p.speed);
      else this.setVelocity(nx * p.speed * 0.45 + ny * this.circleDir * 16, ny * p.speed * 0.45 - nx * this.circleDir * 16);
    } else if (dist > 88) {
      this.setVelocity(nx * p.speed, ny * p.speed);
    } else {
      this.setVelocity(ny * p.speed * 0.8 * this.circleDir + nx * 12, -nx * p.speed * 0.8 * this.circleDir + ny * 12);
    }

    if (now >= this.nextThink) {
      this.nextThink = now + Phaser.Math.Between(p.pressIn ? 480 : 700, p.pressIn ? 880 : 1200);
      if (Math.random() < 0.45) this.circleDir *= -1;
      const reach = p.pressIn ? 118 : 92;
      const chance = p.pressIn ? 0.86 : 0.72;
      if (dist < reach && Math.random() < chance) {
        this.usedFeint = false;
        this.chainLeft = 0;
        this.beginTelegraph(now, target);
      }
    }
  }

  tryBite(target: {
    alive: boolean;
    x: number;
    y: number;
    lastDamage: number;
    takeDamage: (amount: number, from: Phaser.Math.Vector2, knock: number) => HitResult;
  }): boolean {
    if (!this.alive || !this.hitboxActive || !target.alive) return false;
    const dist = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    if (dist > this.profile.biteRange) return false;
    const from = new Phaser.Math.Vector2(this.facing.x, this.facing.y);
    const result = target.takeDamage(this.profile.bite, from, this.profile.knock);
    this.hitboxActive = false;
    if (result === "miss") return false;
    if (result === "perfect") {
      burst(this.scene, target.x, target.y, 0xffe08a);
      floatNumber(this.scene, target.x, target.y - 18, "PERFECT", "#ffe08a");
      return false;
    }
    if (result === "parry") {
      burst(this.scene, target.x, target.y, 0xc9d8e8);
      floatNumber(this.scene, target.x, target.y - 18, "PARRY", "#c9d8e8");
      this.freeze(this.profile.parryStun);
      this.aiState = "recover";
      this.stateUntil = this.scene.time.now + this.profile.recoverMs;
      return false;
    }
    const shown = Math.max(1, Math.round(target.lastDamage));
    burst(this.scene, target.x, target.y, result === "block" ? 0x88aacc : 0xe8dcc8);
    floatNumber(
      this.scene,
      target.x + Phaser.Math.Between(-8, 8),
      target.y - 22,
      String(shown),
      result === "block" ? "#7ab8e8" : "#e07060",
    );
    audio.sfx(result === "block" ? "block" : "hit");
    if (result === "hit" && this.kind === "serpent") {
      this.scene.time.delayedCall(420, () => {
        if (!target.alive) return;
        const venom = target.takeDamage(Math.max(2, this.profile.bite * 0.35), from, 8);
        if (venom === "hit") {
          floatNumber(this.scene, target.x, target.y - 28, "VENOM", "#6ecf8a");
        }
      });
    }
    return result === "hit";
  }

  syncVisuals(now: number): void {
    const p = this.profile;
    const bob = this.alive ? Math.sin(now / (this.kind === "bear" ? 240 : 140)) * (this.kind === "bear" ? 0.7 : 1.2) : 0;
    this.shadow.setPosition(this.x, this.y + (this.kind === "bear" ? 16 : 8));
    if (this.snareFx) {
      if (now >= this.snaredUntil || !this.alive) {
        this.snareFx.destroy();
        this.snareFx = undefined;
      } else {
        this.snareFx.setPosition(this.x, this.y - 6);
        this.snareFx.setDepth(this.y + 6);
        this.snareFx.setAlpha(0.55 + 0.4 * Math.sin(now / 90));
      }
    }
    this.vis.setPosition(this.x, this.y - p.visY + bob);
    this.vis.setFlipX(this.facing.x < 0);
    this.vis.setDepth(this.y);
    this.setDepth(this.y);
    if (now < this.flashUntil) this.vis.setTint(0xffffff);
    else if (this.allyTint) this.vis.setTint(this.allyTint);
    else this.vis.clearTint();
    if (!this.alive) {
      this.vis.setAngle(this.kind === "serpent" ? 18 : 90);
      this.vis.setAlpha(0.7);
    } else if (this.kind === "eagle") {
      const dive = this.aiState === "lunge" ? 22 : this.aiState === "telegraph" ? -10 : Math.sin(now / 160) * 8;
      this.vis.setAngle(this.facing.x < 0 ? dive : -dive);
    } else if (this.kind === "serpent") {
      const reared = this.aiState === "telegraph" ? -14 : 0;
      this.vis.setAngle(reared + Math.sin(now / 150) * 9);
    } else if (this.kind === "bear" && this.aiState === "telegraph") {
      this.vis.setAngle(this.facing.x < 0 ? -8 : 8);
    } else {
      this.vis.setAngle(0);
    }

    const show = this.alive;
    this.hpBarBg.setVisible(show);
    this.hpBarFg.setVisible(show);
    this.nameTag.setVisible(show);
    if (show) {
      const w = 36 * (this.health / this.maxHealth);
      this.hpBarBg.setPosition(this.x, this.y - p.hudY);
      this.hpBarFg.setPosition(this.x - 18 + w / 2, this.y - p.hudY);
      this.hpBarFg.width = Math.max(1, w);
      this.nameTag.setPosition(this.x, this.y - p.hudY - 10);
    }
  }

  destroy(fromScene?: boolean): void {
    this.snareFx?.destroy();
    this.telegraph?.destroy();
    this.vis?.destroy();
    this.shadow?.destroy();
    this.nameTag?.destroy();
    this.hpBarBg?.destroy();
    this.hpBarFg?.destroy();
    super.destroy(fromScene);
  }

  private beginTelegraph(now: number, target?: { x: number; y: number; freeze?: (ms: number) => void }): void {
    const p = this.profile;
    this.aiState = "telegraph";
    const short = p.trick === "feint" && !this.feint;
    this.stateUntil = now + (short ? Math.min(280, p.telegraphMs * 0.5) : p.trick === "roar" ? p.telegraphMs + 180 : p.telegraphMs);
    this.setVelocity(0, 0);
    this.telegraph?.destroy();
    const color = short
      ? 0xc4b49a
      : this.kind === "fox"
        ? COLORS.foxOrange
        : this.kind === "serpent"
          ? COLORS.serpentGreen
          : this.kind === "wolf"
            ? COLORS.wolfGrey
            : this.kind === "bear"
              ? COLORS.bearBrown
              : this.kind === "lion"
                ? COLORS.lionGold
                : this.kind === "bull"
                  ? COLORS.bullRed
                  : this.kind === "boar"
                    ? COLORS.boarHide
                    : this.kind === "raven"
                      ? COLORS.ravenBlack
                      : this.kind === "tiger"
                        ? COLORS.tigerOrange
                        : COLORS.gold;
    this.telegraph = this.scene.add.circle(this.x, this.y - p.markY, p.markR * (p.trick === "roar" ? 1.6 : 1), color, 0.88).setDepth(4000);
    this.scene.tweens.add({
      targets: this.telegraph,
      alpha: 0.2,
      yoyo: true,
      duration: p.trick === "roar" ? 90 : 140,
      repeat: p.trick === "roar" ? 6 : 3,
    });
    if (p.trick === "roar" && target && Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y) < 90) {
      target.freeze?.(220);
    }
  }

  private beginLunge(nx: number, ny: number, now: number): void {
    const p = this.profile;
    this.telegraph?.destroy();
    this.telegraph = undefined;
    this.aiState = "lunge";
    this.feint = p.trick === "feint" && !this.usedFeint;
    if (this.feint) {
      this.usedFeint = true;
      this.stateUntil = now + 90;
      this.lungeVx = nx * p.lungeSpd * 0.45;
      this.lungeVy = ny * p.lungeSpd * 0.45;
      this.hitboxActive = false;
      return;
    }
    if (p.trick === "double") this.chainLeft = Math.max(this.chainLeft, 1);
    if (p.trick === "frenzy") this.chainLeft = Math.max(this.chainLeft, 2);
    const spd = p.trick === "charge" || p.trick === "flyby" ? p.lungeSpd : p.lungeSpd;
    this.stateUntil = now + p.lungeMs;
    this.lungeVx = nx * spd;
    this.lungeVy = ny * spd;
    this.hitboxActive = true;
  }

  private die(): void {
    this.down = true;
    this.health = 0;
    this.hitboxActive = false;
    this.setVelocity(0, 0);
    this.telegraph?.destroy();
    this.telegraph = undefined;
    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) body.enable = false;
  }
}
