import Phaser from "phaser";
import { COLORS } from "../config";
import type { BeastKind } from "../types";
import type { HitResult } from "../systems/combat";
import { burst, floatNumber } from "../systems/combat";
import { audio } from "../systems/audio";

export type { BeastKind };

type BeastAi = "circle" | "telegraph" | "lunge" | "backoff" | "recover";

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
  },
  bull: {
    tex: "beast-bull",
    label: "Bull",
    maxHp: 72,
    bite: 15,
    knock: 70,
    speed: 62,
    lungeSpd: 230,
    lungeMs: 280,
    telegraphMs: 640,
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
  },
  boar: {
    tex: "beast-boar",
    label: "Boar",
    maxHp: 80,
    bite: 16,
    knock: 58,
    speed: 70,
    lungeSpd: 220,
    lungeMs: 260,
    telegraphMs: 600,
    recoverMs: 400,
    backoffMs: 160,
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
  },
  raven: {
    tex: "beast-raven",
    label: "Raven",
    maxHp: 38,
    bite: 11,
    knock: 32,
    speed: 120,
    lungeSpd: 280,
    lungeMs: 180,
    telegraphMs: 420,
    recoverMs: 520,
    backoffMs: 260,
    biteRange: 12,
    lungeHitRange: 14,
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
  },
  eagle: {
    tex: "beast-eagle",
    label: "Eagle",
    maxHp: 36,
    bite: 8,
    knock: 32,
    speed: 118,
    lungeSpd: 260,
    lungeMs: 200,
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
      this.setVelocity(0, 0);
      if (this.telegraph) this.telegraph.setPosition(this.x, this.y - p.markY);
      if (now >= this.stateUntil) this.beginLunge(nx, ny, now);
      return;
    }

    if (this.aiState === "lunge") {
      this.setVelocity(this.lungeVx, this.lungeVy);
      this.hitboxActive = dist < p.lungeHitRange;
      if (now >= this.stateUntil) {
        this.hitboxActive = false;
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
      if (dist < reach && Math.random() < chance) this.beginTelegraph(now);
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

  private beginTelegraph(now: number): void {
    const p = this.profile;
    this.aiState = "telegraph";
    this.stateUntil = now + p.telegraphMs;
    this.setVelocity(0, 0);
    this.telegraph?.destroy();
    const color = this.kind === "fox" ? COLORS.gold : this.kind === "serpent" ? 0x6ecf8a : this.kind === "bear" ? 0xc4a070 : 0xb8c0c8;
    this.telegraph = this.scene.add.circle(this.x, this.y - p.markY, p.markR, color, 0.88).setDepth(4000);
    this.scene.tweens.add({
      targets: this.telegraph,
      alpha: 0.2,
      yoyo: true,
      duration: 140,
      repeat: 3,
    });
  }

  private beginLunge(nx: number, ny: number, now: number): void {
    const p = this.profile;
    this.telegraph?.destroy();
    this.telegraph = undefined;
    this.aiState = "lunge";
    this.stateUntil = now + p.lungeMs;
    this.lungeVx = nx * p.lungeSpd;
    this.lungeVy = ny * p.lungeSpd;
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
