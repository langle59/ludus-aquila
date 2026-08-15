import Phaser from "phaser";
import { TILE_SIZE } from "../config";
import type { AttackKind, FighterStats, WeaponDef, WeaponId } from "../types";
import { getWeapon, isHeavyWeapon, weaponMove } from "../data/weapons";
import { makeBodyTexture, bodyStyleFor, type BodyStyle } from "../systems/assets";
import { audio } from "../systems/audio";
import { getSkillMods } from "../systems/progression";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";

export type CombatState = "idle" | "walk" | "attack" | "special" | "block" | "dodge" | "parry" | "hurt" | "down" | "stagger";
export type TableauPose = "none" | "kneel" | "flourish" | "steel";

export interface FighterConfig {
  key: string;
  tunic: number;
  accent: number;
  scale?: number;
  stats: FighterStats;
  weapon: WeaponId;
  speed?: number;
  team: "player" | "enemy" | "ally";
  style?: BodyStyle;
  cape?: number;
  scar?: string;
  crest?: string;
}

function bladeTexture(id: WeaponId): string {
  if (id === "spear") return "wep-spear";
  if (id === "dual_blades") return "wep-blade";
  if (id === "securis") return "wep-axe";
  if (id === "malleus") return "wep-hammer";
  if (id === "trident_net") return "wep-trident";
  return "wep-gladius";
}

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t));
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInCubic(t: number): number {
  return t * t * t;
}

export class Fighter extends Phaser.Physics.Arcade.Sprite {
  stats: FighterStats;
  health: number;
  stamina: number;
  weaponId: WeaponId;
  team: "player" | "enemy" | "ally";
  facing = new Phaser.Math.Vector2(0, 1);
  combat: CombatState = "idle";
  blocking = false;
  invulnUntil = 0;
  nextAttackAt = 0;
  nextSpecialAt = 0;
  staminaDelayUntil = 0;
  hitboxActive = false;
  attackKind: AttackKind = "light";
  specialHitsLeft = 0;
  flurryTimer = 0;
  bodyVisual!: Phaser.GameObjects.Image;
  shadow!: Phaser.GameObjects.Image;
  blade!: Phaser.GameObjects.Image;
  blade2!: Phaser.GameObjects.Image;
  shield!: Phaser.GameObjects.Image;
  nameTag?: Phaser.GameObjects.Text;
  hpBarBg?: Phaser.GameObjects.Rectangle;
  hpBarFg?: Phaser.GameObjects.Rectangle;
  flashUntil = 0;
  perfectFlashUntil = 0;
  lastDamage = 0;
  nextHitBonus = 1;
  comboCount = 0;
  comboUntil = 0;
  frozenUntil = 0;
  dodgeStartedAt = 0;
  lastDodgeCost = 0;
  parryStartedAt = 0;
  snaredUntil = 0;
  nextUnguentAt = 0;
  unguentFlashUntil = 0;
  tableau: TableauPose = "none";
  netShot?: { img: Phaser.GameObjects.Image; vx: number; vy: number; until: number };
  private snareFx?: Phaser.GameObjects.Image;
  private perfectDodgedThisRoll = false;
  private parriedThisWindow = false;
  moveSpeed: number;
  private visKey: string;
  private animStart = 0;
  private animDuration = 1;
  private slashSide = 1;
  private fxSpawned = false;
  private bodyScale: number;
  private lastDust = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: FighterConfig) {
    super(scene, x, y, "char-shadow");
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setVisible(false);
    this.setSize(16, 12);
    (this.body as Phaser.Physics.Arcade.Body).setOffset(8, 14);
    this.setCollideWorldBounds(true);
    this.setDepth(y);

    this.stats = { ...cfg.stats };
    this.health = cfg.stats.maxHealth;
    this.stamina = cfg.stats.maxStamina;
    this.weaponId = cfg.weapon;
    this.team = cfg.team;
    this.bodyScale = cfg.scale ?? 1;
    this.moveSpeed = cfg.speed ?? 140 + cfg.stats.agility * 6;
    if (this.team === "player") this.moveSpeed += getSkillMods().moveSpeed;
    this.visKey = `body-${cfg.key}`;
    makeBodyTexture(scene, this.visKey, cfg.tunic, cfg.accent, this.bodyScale, cfg.style ?? bodyStyleFor(cfg.key), cfg.cape ?? 0, cfg.scar ?? "none", cfg.crest ?? "");

    this.shadow = scene.add.image(x, y + 10, "char-shadow").setDepth(1);
    this.bodyVisual = scene.add.image(x, y, this.visKey).setDepth(y);
    this.blade = scene.add.image(x, y, bladeTexture(cfg.weapon)).setDepth(y + 2).setOrigin(0.12, 0.5);
    this.blade2 = scene.add.image(x, y, "wep-blade").setDepth(y + 2).setOrigin(0.12, 0.5);
    this.shield = scene.add.image(x, y, "wep-shield").setDepth(y + 1).setOrigin(0.5, 0.5);
    this.applyWeaponVisuals();
  }

  applyLook(tunic: number, accent: number, style: BodyStyle, cape = 0, scar = "none", crest = ""): void {
    makeBodyTexture(this.scene, this.visKey, tunic, accent, this.bodyScale, style, cape, scar, crest);
    this.bodyVisual.setTexture(this.visKey);
  }

  get weapon(): WeaponDef {
    return getWeapon(this.weaponId);
  }

  get alive(): boolean {
    return this.combat !== "down" && this.health > 0;
  }

  setWeapon(id: WeaponId): void {
    this.weaponId = id;
    this.blade.setTexture(bladeTexture(id));
    this.applyWeaponVisuals();
  }

  private applyWeaponVisuals(): void {
    const id = this.weaponId;
    this.blade2.setVisible(id === "dual_blades");
    this.shield.setVisible(id === "gladius" || id === "spear");
    this.blade.setScale(id === "securis" ? 1.12 : id === "malleus" ? 1.08 : id === "spear" || id === "trident_net" ? 1 : 0.95);
  }

  canAct(): boolean {
    return this.alive && !this.isFrozen() && !this.isSnared() && !["attack", "special", "dodge", "parry", "hurt", "down", "stagger"].includes(this.combat);
  }

  isFrozen(): boolean {
    return this.scene.time.now < this.frozenUntil;
  }

  isSnared(): boolean {
    return this.scene.time.now < this.snaredUntil;
  }

  snare(ms: number): void {
    this.snaredUntil = this.scene.time.now + ms;
    this.stagger(ms);
    if (this.team === "player") bus.emit("player-snared");
    this.snareFx?.destroy();
    this.snareFx = this.scene.add.image(this.x, this.y - 6, "fx-net").setDepth(this.y + 6).setAlpha(0.95).setScale(1.45);
    this.setVelocity(0, 0);
  }

  freeze(ms: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const vx = body?.velocity.x ?? 0;
    const vy = body?.velocity.y ?? 0;
    this.frozenUntil = this.scene.time.now + ms;
    this.setVelocity(0, 0);
    this.scene.time.delayedCall(ms, () => {
      if (!this.alive) return;
      if (this.combat === "hurt" || this.combat === "attack" || this.combat === "special") {
        this.setVelocity(vx, vy);
      }
    });
  }

  consumeHitBonus(): number {
    const bonus = this.nextHitBonus;
    this.nextHitBonus = 1;
    return bonus;
  }

  registerCombo(): number {
    const now = this.scene.time.now;
    if (now > this.comboUntil) this.comboCount = 0;
    this.comboCount += 1;
    this.comboUntil = now + 900;
    if (this.team === "player") {
      const refund = getSkillMods().comboStamina;
      if (refund > 0 && this.comboCount > 1) {
        this.stamina = Math.min(this.stats.maxStamina, this.stamina + refund);
      }
      bus.emit("combo", this.comboCount);
    }
    return this.comboCount;
  }

  spendStamina(amount: number): boolean {
    if (this.stamina < amount) return false;
    this.stamina -= amount;
    this.staminaDelayUntil = this.scene.time.now + 550;
    return true;
  }

  tryMove(vx: number, vy: number): void {
    if (this.isFrozen() || this.isSnared()) {
      this.setVelocity(0, 0);
      return;
    }
    if (this.combat === "dodge" || this.combat === "hurt" || this.combat === "parry") return;
    if (!this.canAct()) {
      this.setVelocity(0, 0);
      return;
    }
    if (this.blocking) {
      this.setVelocity(vx * 0.35, vy * 0.35);
      return;
    }
    this.setVelocity(vx, vy);
    if (vx || vy) {
      this.facing.set(vx, vy).normalize();
      if (this.combat !== "attack") this.combat = "walk";
    } else if (this.combat === "walk") this.combat = "idle";
  }

  tryAttack(kind: "light" | "heavy" = "light"): boolean {
    if (!this.canAct()) return false;
    if (this.scene.time.now < this.nextAttackAt) return false;
    const w = this.weapon;
    const move = weaponMove(w, kind);
    const cost = Math.max(
      4,
      Math.round(w.staminaCost * move.staminaMult) + (this.team === "player" ? getSkillMods().attackStamina : 0),
    );
    if (this.stamina < cost) return false;
    if (!this.spendStamina(cost)) return false;
    this.combat = "attack";
    this.attackKind = kind;
    this.hitboxActive = false;
    this.slashSide *= -1;
    this.fxSpawned = false;
    this.animStart = this.scene.time.now;
    const windup = Math.round(w.windup * move.windupMult);
    const recover = Math.round(w.recover * move.recoverMult);
    const hitMs = kind === "heavy" ? 120 : 90;
    this.animDuration = windup + hitMs + recover;
    this.nextAttackAt = this.scene.time.now + Math.round(w.attackSpeed * move.speedMult);
    audio.sfx(kind === "heavy" ? "special" : "swing");
    if (move.lunge) {
      this.setVelocity(this.facing.x * move.lunge, this.facing.y * move.lunge);
      this.scene.time.delayedCall(90, () => this.setVelocity(0, 0));
    }
    this.scene.time.delayedCall(windup, () => {
      if (!this.alive) return;
      this.hitboxActive = true;
      this.spawnAttackFx();
      this.scene.time.delayedCall(hitMs, () => {
        this.hitboxActive = false;
      });
    });
    this.scene.time.delayedCall(this.animDuration, () => {
      if (this.combat === "attack") this.combat = "idle";
    });
    return true;
  }

  trySpecial(): boolean {
    if (!this.canAct()) return false;
    if (this.scene.time.now < this.nextSpecialAt) return false;
    const w = this.weapon;
    if (!this.spendStamina(w.specialStamina)) return false;
    this.combat = "special";
    this.attackKind = "special";
    this.fxSpawned = false;
    this.animStart = this.scene.time.now;
    this.nextSpecialAt = this.scene.time.now + w.specialCooldown;
    audio.sfx("special");

    if (w.id === "spear") {
      this.animDuration = 320;
      this.setVelocity(this.facing.x * 320, this.facing.y * 320);
      this.scene.time.delayedCall(140, () => this.setVelocity(0, 0));
    } else if (w.id === "dual_blades") {
      this.animDuration = 520;
      this.specialHitsLeft = 4;
      this.flurryTimer = 0;
    } else if (w.id === "gladius") {
      this.animDuration = 300;
    } else if (w.id === "securis" || w.id === "malleus") {
      this.animDuration = w.id === "malleus" ? 520 : 480;
    } else if (w.id === "trident_net") {
      this.animDuration = 400;
      this.scene.time.delayedCall(80, () => this.launchNet());
    } else {
      this.animDuration = 420;
    }

    if (w.id !== "dual_blades" && w.id !== "trident_net") {
      this.hitboxActive = false;
      this.scene.time.delayedCall(Math.max(40, w.windup * 0.6), () => {
        this.hitboxActive = true;
        this.spawnAttackFx();
        this.scene.time.delayedCall(90, () => (this.hitboxActive = false));
      });
    }
    this.scene.time.delayedCall(this.animDuration, () => {
      if (this.combat === "special") this.combat = "idle";
      this.specialHitsLeft = 0;
    });
    return true;
  }

  tryUnguent(): boolean {
    if (this.team !== "player") return false;
    if (!this.alive) return false;
    if (this.combat === "down" || this.combat === "dodge" || this.combat === "parry") return false;
    const now = this.scene.time.now;
    if (now < this.nextUnguentAt) return false;
    const s = gameState.save;
    if ((s.unguent ?? 0) <= 0) {
      bus.emit("toast", "No unguent. Buy a vial at the quartermaster (C).");
      this.nextUnguentAt = now + 800;
      return false;
    }
    s.unguent -= 1;
    this.health = Math.min(this.stats.maxHealth, this.health + 26);
    this.stamina = Math.min(this.stats.maxStamina, this.stamina + 32);
    this.nextUnguentAt = now + 900;
    this.unguentFlashUntil = now + 220;
    s.health = this.health;
    s.stamina = this.stamina;
    gameState.persist();
    audio.sfx("ui");
    bus.emit("unguent-changed", s.unguent);
    this.puffDust(3);
    return true;
  }

  tryDodge(): boolean {
    if (!this.canAct()) return false;
    const mods = this.team === "player" ? getSkillMods() : null;
    const cost = Math.max(6, 16 + (mods?.dodgeCost ?? 0));
    if (!this.spendStamina(cost)) return false;
    this.combat = "dodge";
    this.dodgeStartedAt = this.scene.time.now;
    this.lastDodgeCost = cost;
    this.perfectDodgedThisRoll = false;
    this.invulnUntil = this.scene.time.now + 280 + (mods?.dodgeIframes ?? 0);
    const dx = this.facing.x || 0;
    const dy = this.facing.y || 1;
    this.setVelocity(dx * (340 + (mods?.dodgeSpeed ?? 0)), dy * (340 + (mods?.dodgeSpeed ?? 0)));
    audio.sfx("dodge");
    this.puffDust(6);
    this.scene.time.delayedCall(180, () => {
      this.setVelocity(0, 0);
      if (this.combat === "dodge") this.combat = "idle";
    });
    return true;
  }

  tryParry(): boolean {
    if (!this.canAct()) return false;
    if (!this.spendStamina(10)) return false;
    this.combat = "parry";
    this.parryStartedAt = this.scene.time.now;
    this.parriedThisWindow = false;
    this.setVelocity(0, 0);
    audio.sfx("block");
    this.scene.time.delayedCall(240, () => {
      if (this.combat === "parry") this.combat = "idle";
    });
    return true;
  }

  launchNet(): void {
    this.netShot?.img.destroy();
    const img = this.scene.add
      .image(this.x + this.facing.x * 18, this.y + this.facing.y * 18, "fx-net")
      .setDepth(this.y + 8)
      .setScale(1.15)
      .setAngle(Phaser.Math.RadToDeg(Math.atan2(this.facing.y, this.facing.x)));
    this.netShot = {
      img,
      vx: this.facing.x * 380,
      vy: this.facing.y * 380,
      until: this.scene.time.now + 720,
    };
  }

  updateNet(targets: Array<{ alive: boolean; x: number; y: number; snare: (ms: number) => void }>, delta: number): void {
    const shot = this.netShot;
    if (!shot) return;
    shot.img.x += (shot.vx * delta) / 1000;
    shot.img.y += (shot.vy * delta) / 1000;
    shot.img.setDepth(shot.img.y + 8);
    if (this.scene.time.now > shot.until) {
      shot.img.destroy();
      this.netShot = undefined;
      return;
    }
    for (const t of targets) {
      if (!t.alive || t === this) continue;
      if (Phaser.Math.Distance.Between(shot.img.x, shot.img.y, t.x, t.y) < 36) {
        t.snare(2400);
        shot.img.destroy();
        this.netShot = undefined;
        const label = this.scene.add
          .text(t.x, t.y - 24, "CAUGHT", {
            fontFamily: "Cinzel, Georgia",
            fontSize: "16px",
            color: "#e8dcc8",
            stroke: "#1a1210",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(4000);
        this.scene.tweens.add({
          targets: label,
          y: t.y - 48,
          alpha: 0,
          duration: 700,
          onComplete: () => label.destroy(),
        });
        return;
      }
    }
  }

  setBlocking(on: boolean): void {
    if (!this.alive) return;
    if (on && !this.canAct() && this.combat !== "block") return;
    if (on && this.weapon.blockStrength < 0.2) return;
    this.blocking = on;
    if (on) this.combat = "block";
    else if (this.combat === "block") this.combat = "idle";
  }

  stagger(ms: number): void {
    if (!this.alive) return;
    this.combat = "stagger";
    this.blocking = false;
    this.hitboxActive = false;
    this.setVelocity(0, 0);
    this.scene.time.delayedCall(ms, () => {
      if (this.combat === "stagger") this.combat = "idle";
    });
  }

  takeDamage(amount: number, from: Phaser.Math.Vector2, knock: number, special = false): "hit" | "block" | "miss" | "perfect" | "parry" {
    if (!this.alive) return "miss";
    const now = this.scene.time.now;

    if (this.combat === "dodge") {
      const windowMs = 90 + (this.team === "player" ? getSkillMods().perfectDodgeWindow : 0);
      if (!this.perfectDodgedThisRoll && now - this.dodgeStartedAt <= windowMs) {
        this.perfectDodgedThisRoll = true;
        this.stamina = Math.min(this.stats.maxStamina, this.stamina + this.lastDodgeCost);
        this.nextHitBonus = 1.35;
        this.perfectFlashUntil = now + 220;
        this.lastDamage = 0;
        const first = this.team === "player" && !gameState.save.tutorialFlags.perfectDodge;
        if (this.team === "player") {
          gameState.setFlag("perfectDodge");
          if (first) gameState.persist();
          bus.emit("perfect-dodge", { first });
        }
        audio.sfx("dodge");
        return "perfect";
      }
      return "miss";
    }

    if (this.combat === "parry") {
      if (!this.parriedThisWindow && now - this.parryStartedAt <= 110) {
        this.parriedThisWindow = true;
        this.invulnUntil = now + 240;
        this.perfectFlashUntil = now + 200;
        this.lastDamage = 0;
        const first = this.team === "player" && !gameState.save.tutorialFlags.parried;
        if (this.team === "player") {
          gameState.setFlag("parried");
          if (first) gameState.persist();
          bus.emit("parry", { first });
        }
        audio.sfx("block");
        return "parry";
      }
    }

    if (now < this.invulnUntil) return "miss";

    if (this.blocking && this.weapon.blockStrength > 0.15) {
      const block = Math.min(0.92, this.weapon.blockStrength + (this.team === "player" ? getSkillMods().blockBonus : 0));
      const reduced = amount * (1 - block);
      const chip = 0.25 * (this.team === "player" ? getSkillMods().blockChip : 1);
      this.lastDamage = reduced * chip;
      this.health = Math.max(1, this.health - this.lastDamage);
      this.stamina = Math.max(0, this.stamina - 8);
      this.invulnUntil = now + 120;
      const angle = Math.atan2(from.y, from.x);
      this.setVelocity(Math.cos(angle) * knock * 0.25, Math.sin(angle) * knock * 0.25);
      audio.sfx("block");
      if (this.stamina <= 0) this.stagger(400);
      return "block";
    }

    const def = 1 - Math.min(0.55, this.stats.defense / 28);
    const dmg = Math.max(2, amount * def);
    this.lastDamage = dmg;
    this.health = Math.max(0, this.health - dmg);
    this.combat = "hurt";
    this.flashUntil = now + 120;
    this.invulnUntil = now + (this.team === "player" ? 420 : 180);
    const angle = Math.atan2(from.y, from.x);
    this.setVelocity(Math.cos(angle) * knock, Math.sin(angle) * knock);
    audio.sfx("hurt");
    if (special && this.weaponId) this.stagger(500);
    if (this.health <= 0) {
      this.health = 0;
      this.die();
    } else {
      this.scene.time.delayedCall(160, () => {
        if (this.combat === "hurt") this.combat = "idle";
        this.setVelocity(0, 0);
      });
    }
    return "hit";
  }

  die(): void {
    this.combat = "down";
    this.blocking = false;
    this.hitboxActive = false;
    this.setVelocity(0, 0);
    if (this.tableau === "none") {
      this.bodyVisual.setAngle(90);
      this.bodyVisual.setAlpha(0.7);
    }
  }

  poseKneel(): void {
    this.tableau = "kneel";
    this.combat = "down";
    this.blocking = false;
    this.hitboxActive = false;
    this.setVelocity(0, 0);
    this.bodyVisual.setAlpha(1);
  }

  poseSteel(): void {
    this.tableau = "steel";
    this.combat = "down";
    this.blocking = false;
    this.hitboxActive = false;
    this.setVelocity(0, 0);
    this.bodyVisual.setAngle(90);
    this.bodyVisual.setAlpha(0.7);
  }

  poseFlourish(): void {
    this.tableau = "flourish";
    this.combat = "idle";
    this.blocking = false;
    this.hitboxActive = false;
    this.setVelocity(0, 0);
    this.bodyVisual.setAngle(0);
    this.bodyVisual.setAlpha(1);
  }

  refreshSkills(): void {
    if (this.team !== "player") return;
    this.stats = { ...gameState.save.stats };
    this.moveSpeed = 140 + this.stats.agility * 6 + getSkillMods().moveSpeed;
    this.health = Math.min(this.health, this.stats.maxHealth);
    this.stamina = Math.min(this.stamina, this.stats.maxStamina);
  }

  revive(full = true): void {
    this.combat = "idle";
    this.tableau = "none";
    this.health = full ? this.stats.maxHealth : Math.max(1, this.health);
    this.stamina = this.stats.maxStamina;
    this.bodyVisual.setAngle(0);
    this.bodyVisual.setAlpha(1);
    this.setVelocity(0, 0);
  }

  attackCenter(): Phaser.Math.Vector2 {
    const w = this.weapon;
    let extra = 0;
    if (this.attackKind === "special") {
      extra = w.id === "spear" ? 28 : w.id === "gladius" ? 8 : 0;
    } else {
      extra = weaponMove(w, this.attackKind).rangeBonus;
    }
    const reach = w.range + extra;
    return new Phaser.Math.Vector2(this.x + this.facing.x * reach, this.y + this.facing.y * reach);
  }

  attackRadius(): number {
    const w = this.weapon;
    if (this.attackKind === "special" && isHeavyWeapon(w.id)) return w.id === "malleus" ? 58 : 52;
    if (this.attackKind === "special" && w.id === "gladius") return 28;
    const bonus = this.attackKind === "special" ? 0 : weaponMove(w, this.attackKind).radiusBonus;
    return 20 + (w.id === "spear" ? 6 : 0) + bonus;
  }

  private spawnAttackFx(): void {
    if (this.fxSpawned && this.weaponId !== "dual_blades") return;
    this.fxSpawned = true;
    const facing = Phaser.Math.RadToDeg(Math.atan2(this.facing.y, this.facing.x));
    const shape = this.attackKind === "special"
      ? this.weaponId === "spear" || this.weaponId === "trident_net" || this.weaponId === "gladius"
        ? "thrust"
        : isHeavyWeapon(this.weaponId)
          ? "slam"
          : "slash"
      : weaponMove(this.weapon, this.attackKind).shape;
    const thrust = shape === "thrust";
    const heavy = this.attackKind === "heavy" || this.attackKind === "special";
    const key = thrust ? "fx-thrust" : "fx-slash";
    const dist = thrust ? 28 : 18;
    const fx = this.scene.add
      .image(this.x + this.facing.x * dist, this.y + this.facing.y * dist, key)
      .setAngle(facing + (thrust ? 0 : this.slashSide * 15))
      .setDepth(this.y + 8)
      .setAlpha(0.95)
      .setScale((thrust ? 1.15 : 0.95) * (heavy ? 1.2 : 1));
    this.scene.tweens.add({
      targets: fx,
      alpha: 0,
      scale: (thrust ? 1.55 : 1.2) * (heavy ? 1.15 : 1),
      x: fx.x + this.facing.x * 12,
      y: fx.y + this.facing.y * 12,
      duration: thrust ? 180 : 140,
      ease: "Quad.easeOut",
      onComplete: () => fx.destroy(),
    });
  }

  private animT(now: number): number {
    return clamp01((now - this.animStart) / Math.max(1, this.animDuration));
  }

  syncVisuals(now: number): void {
    this.shadow.setPosition(this.x, this.y + 12);
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
    const t = this.animT(now);
    const attacking = this.combat === "attack" || this.combat === "special";
    const facingAng = Phaser.Math.RadToDeg(Math.atan2(this.facing.y, this.facing.x));
    const right = new Phaser.Math.Vector2(-this.facing.y, this.facing.x);

    let lunge = 0;
    let bodyRot = 0;
    let bob = this.combat === "walk" ? Math.sin(now / 80) * 1.8 : Math.sin(now / 420) * 0.7;
    if (attacking) {
      lunge = 6 + easeOutCubic(Math.min(1, t * 2)) * 8;
      bodyRot = this.slashSide * 12 * Math.sin(t * Math.PI);
      bob = 0;
    }
    if (this.combat === "block") lunge = 2;
    if (this.combat === "parry") lunge = 4;
    if (this.combat === "dodge") lunge = 10;

    if (this.tableau === "kneel") {
      lunge = 2;
      bodyRot = 28;
      bob = 8;
    } else if (this.tableau === "flourish") {
      lunge = 14;
      bodyRot = 8;
      bob = 0;
    } else if (this.tableau === "steel" || this.combat === "down") {
      lunge = 0;
      bodyRot = 90;
      bob = 0;
    }

    this.bodyVisual.setPosition(this.x + this.facing.x * lunge, this.y - 10 + bob + this.facing.y * lunge);
    this.bodyVisual.setAngle(bodyRot);
    this.bodyVisual.setFlipX(this.facing.x < 0);
    this.bodyVisual.setDepth(this.y);
    this.setDepth(this.y);
    if (now < this.perfectFlashUntil) this.bodyVisual.setTint(0xffe08a);
    else if (now < this.unguentFlashUntil) this.bodyVisual.setTint(0xa8d878);
    else if (now < this.flashUntil) this.bodyVisual.setTint(0xffffff);
    else this.bodyVisual.clearTint();
    if (this.combat === "block") this.bodyVisual.setTint(0x88aacc);
    if (this.combat === "parry") this.bodyVisual.setTint(0xffe08a);
    if (this.combat === "dodge") this.bodyVisual.setAlpha(0.55);
    else if (this.tableau === "kneel" || this.tableau === "flourish") this.bodyVisual.setAlpha(1);
    else if (this.tableau === "steel" || this.combat === "down") this.bodyVisual.setAlpha(0.7);
    else if (this.alive) this.bodyVisual.setAlpha(1);

    if (this.combat === "walk" && now - this.lastDust > 160) {
      this.lastDust = now;
      this.puffDust(1);
    }

    this.poseWeapons(now, t, facingAng, right, attacking);

    if (this.hpBarBg && this.hpBarFg) {
      const show = this.team !== "player" && this.alive;
      this.hpBarBg.setVisible(show);
      this.hpBarFg.setVisible(show);
      this.hpBarBg.setPosition(this.x, this.y - 32);
      this.hpBarFg.setPosition(this.x - 20 + (40 * (this.health / this.stats.maxHealth)) / 2, this.y - 32);
      this.hpBarFg.width = Math.max(1, 40 * (this.health / this.stats.maxHealth));
    }
    if (this.nameTag) this.nameTag.setPosition(this.x, this.y - 42);

    if (!this.isFrozen() && this.combat === "special" && this.weaponId === "dual_blades" && this.specialHitsLeft > 0) {
      this.flurryTimer += this.scene.game.loop.delta;
      if (this.flurryTimer > 90) {
        this.flurryTimer = 0;
        this.hitboxActive = true;
        this.specialHitsLeft -= 1;
        this.slashSide *= -1;
        this.spawnAttackFx();
        this.scene.time.delayedCall(40, () => (this.hitboxActive = false));
      }
    }
  }

  private poseWeapons(now: number, t: number, facingAng: number, right: Phaser.Math.Vector2, attacking: boolean): void {
    const id = this.weaponId;
    const hx = this.x;
    const hy = this.y - 4;
    let reach = 12;
    let ang = facingAng + 20;
    let ang2 = facingAng - 160;
    let shieldX = hx - right.x * 10 + this.facing.x * 4;
    let shieldY = hy - right.y * 10 + this.facing.y * 4;

    if (this.combat === "block" || this.combat === "parry") {
      reach = 8;
      ang = facingAng + 100;
      shieldX = hx + this.facing.x * 14;
      shieldY = hy + this.facing.y * 14;
    } else if (this.tableau === "flourish") {
      if (id === "spear" || id === "trident_net") {
        reach = 28;
        ang = facingAng;
      } else if (id === "dual_blades") {
        reach = 16;
        ang = facingAng - 55;
        ang2 = facingAng + 55;
      } else if (id === "securis" || id === "malleus") {
        reach = 18;
        ang = facingAng + 85;
      } else {
        reach = 22;
        ang = facingAng;
      }
    } else if (this.tableau === "kneel") {
      reach = 6;
      ang = facingAng + 70;
    } else if (this.combat === "hurt" || this.combat === "stagger") {
      reach = 8;
      ang = facingAng + 50;
    } else if (attacking) {
      const wind = clamp01(t / 0.28);
      const active = clamp01((t - 0.28) / 0.32);
      const rec = clamp01((t - 0.6) / 0.4);
      const basicShape = this.attackKind === "special" ? null : weaponMove(this.weapon, this.attackKind).shape;
      const thrustPose =
        basicShape === "thrust" || (this.attackKind === "special" && (id === "spear" || id === "trident_net"));
      const slamPose =
        basicShape === "slam" || (this.attackKind === "special" && (id === "securis" || id === "malleus"));

      if (thrustPose) {
        const pull = easeInCubic(wind);
        const stab = easeOutCubic(active);
        reach = 6 + (1 - pull) * 4 + stab * 26 - rec * 10;
        ang = facingAng;
        if (this.attackKind === "special") reach += 10;
        if (this.attackKind === "heavy") reach += 6;
        shieldX = hx - right.x * 12;
        shieldY = hy - right.y * 12;
      } else if (id === "dual_blades") {
        const sweep = this.combat === "special" ? 0.5 + 0.5 * Math.sin(now / 40) : easeOutCubic(active);
        const arc = (this.attackKind === "heavy" ? 155 : 130) * this.slashSide;
        ang = facingAng - arc * 0.7 + arc * sweep;
        ang2 = facingAng + arc * 0.7 - arc * sweep;
        reach = 10 + sweep * (this.attackKind === "heavy" ? 12 : 8);
      } else if (slamPose) {
        const slam = easeOutCubic(Math.max(active, rec * 0.2));
        ang = facingAng - (this.attackKind === "heavy" ? 155 : 140) + (this.attackKind === "heavy" ? 190 : 170) * slam;
        reach = 10 + slam * (this.attackKind === "heavy" ? 14 : 10);
      } else {
        const slash = easeOutCubic(active);
        const start = facingAng - 120 * this.slashSide;
        const end = facingAng + 90 * this.slashSide;
        ang = start + (end - start) * slash;
        reach = 10 + slash * (this.attackKind === "heavy" ? 16 : 10);
        if (this.attackKind === "special") {
          shieldX = hx + this.facing.x * (10 + slash * 16);
          shieldY = hy + this.facing.y * (10 + slash * 16);
          ang = facingAng + 80;
          reach = 6;
        } else {
          shieldX = hx - right.x * 10;
          shieldY = hy - right.y * 10;
        }
      }
    } else {
      reach = 11 + Math.sin(now / 220) * 0.6;
    }

    const bx = hx + this.facing.x * reach + right.x * 6;
    const by = hy + this.facing.y * reach + right.y * 6;
    this.blade.setPosition(bx, by);
    this.blade.setAngle(ang);
    this.blade.setDepth(this.y + 3);

    if (id === "dual_blades") {
      this.blade2.setVisible(true);
      this.blade2.setPosition(hx - right.x * 6 + this.facing.x * reach * 0.85, hy - right.y * 6 + this.facing.y * reach * 0.85);
      this.blade2.setAngle(ang2);
      this.blade2.setDepth(this.y + 3);
    }

    if (this.shield.visible) {
      this.shield.setPosition(shieldX, shieldY);
      this.shield.setAngle(facingAng + (this.combat === "block" ? 0 : -20));
      this.shield.setDepth(this.y + (this.combat === "block" ? 4 : 1));
      const bash = attacking && this.attackKind === "special" && id === "gladius";
      this.shield.setScale(bash ? 1.15 : 1);
    }
  }

  private puffDust(count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.scene.add
        .image(this.x + Phaser.Math.Between(-8, 8), this.y + 8, "fx-dust")
        .setDepth(this.y - 1)
        .setAlpha(0.55)
        .setScale(0.6 + Math.random() * 0.5);
      this.scene.tweens.add({
        targets: p,
        y: p.y - 6,
        alpha: 0,
        scale: 1.2,
        duration: 280,
        onComplete: () => p.destroy(),
      });
    }
  }

  regen(delta: number): void {
    if (!this.alive) return;
    if (this.scene.time.now < this.staminaDelayUntil) return;
    if (this.combat === "attack" || this.combat === "special" || this.combat === "dodge" || this.combat === "parry") return;
    const extra = this.team === "player" ? getSkillMods().regen : 0;
    const rate = 22 + this.stats.agility * 0.4 + extra;
    this.stamina = Math.min(this.stats.maxStamina, this.stamina + (rate * delta) / 1000);
  }

  destroy(fromScene?: boolean): void {
    this.netShot?.img.destroy();
    this.snareFx?.destroy();
    this.bodyVisual?.destroy();
    this.shadow?.destroy();
    this.blade?.destroy();
    this.blade2?.destroy();
    this.shield?.destroy();
    this.nameTag?.destroy();
    this.hpBarBg?.destroy();
    this.hpBarFg?.destroy();
    super.destroy(fromScene);
  }
}

export function attachHpBar(scene: Phaser.Scene, f: Fighter, name?: string): void {
  f.hpBarBg = scene.add.rectangle(f.x, f.y - 32, 40, 6, 0x1a1210).setStrokeStyle(1, 0xd4a84b, 0.7).setDepth(2000);
  f.hpBarFg = scene.add.rectangle(f.x, f.y - 32, 40, 6, 0xb33a2b).setDepth(2001);
  if (name) {
    f.nameTag = scene.add
      .text(f.x, f.y - 42, name, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "11px",
        color: "#f0e6d2",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(2002);
  }
}

export const TILE = TILE_SIZE;
