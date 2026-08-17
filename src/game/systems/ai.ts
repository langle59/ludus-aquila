import Phaser from "phaser";
import type { AiStyle } from "../types";
import { Fighter } from "../entities/Fighter";

export type CombatAIOpts = {
  /** Start idle until aggro radius / damage / alert(). Default false (arena allies). */
  startUnaware?: boolean;
  /** Distance at which a friendly wakes this foe. */
  aggroRadius?: number;
  /** On first aggro from range, force a telegraphed special (Aper tusk charge). */
  tuskCharge?: boolean;
  /** Stronger charge: longer windup, engages from farther (Taurus / Rhinoceros). */
  hornCharge?: boolean;
  /** Short aggro until close (Tigris stalkers). */
  ambush?: boolean;
  /** On first aggro, notify RaidScene to wake nearby foes (Leo). */
  roarPulse?: boolean;
  /** Called once when this foe first becomes aware (roar / alert hooks). */
  onFirstAlert?: (self: Fighter) => void;
  /** Wider charge telegraph ring (Taurus house volunteer perk). */
  telegraphRadiusMult?: number;
};

export class CombatAI {
  private nextThink = 0;
  private state: "approach" | "circle" | "attack" | "defend" | "retreat" | "dodge" | "recover" | "special" = "approach";
  private circleDir = 1;
  private telegraph?: Phaser.GameObjects.Arc;
  private aware = true;
  private aggroRadius = 110;
  private maxHpSeen = 0;
  private alertMark?: Phaser.GameObjects.Text;
  private tuskCharge = false;
  private hornCharge = false;
  private roarPulse = false;
  private ambush = false;
  private pendingCharge = false;
  private chargeCooldownUntil = 0;
  private telegraphRadiusMult = 1;
  private onFirstAlert?: (self: Fighter) => void;
  private firstAlertFired = false;
  private stalkTint = false;

  constructor(
    private self: Fighter,
    private style: AiStyle,
    opts?: CombatAIOpts,
  ) {
    this.circleDir = Math.random() < 0.5 ? -1 : 1;
    if (opts?.startUnaware) {
      this.aware = false;
      this.aggroRadius = opts.aggroRadius ?? 110;
    }
    this.tuskCharge = opts?.tuskCharge === true;
    this.hornCharge = opts?.hornCharge === true;
    this.roarPulse = opts?.roarPulse === true;
    this.ambush = opts?.ambush === true;
    this.onFirstAlert = opts?.onFirstAlert;
    this.telegraphRadiusMult = opts?.telegraphRadiusMult ?? 1;
    this.maxHpSeen = self.stats.maxHealth;
  }

  get isAware(): boolean {
    return this.aware;
  }

  get hasRoarPulse(): boolean {
    return this.roarPulse;
  }

  /** Force engagement (boss briefing end, alert ripple, etc.). */
  alert(): void {
    if (this.aware) return;
    this.clearStalkTint();
    this.aware = true;
    this.state = "approach";
    if (this.tuskCharge || this.hornCharge) this.pendingCharge = true;
    this.showAlertMark();
    if (!this.firstAlertFired) {
      this.firstAlertFired = true;
      this.onFirstAlert?.(this.self);
    }
  }

  /**
   * Unaware foes: idle until a friendly is close or HP drops.
   * Returns true if still idle (caller should skip combat act).
   */
  tickUnaware(friendlies: Fighter[], now: number): boolean {
    if (this.aware) return false;
    if (!this.self.alive) return true;
    if (this.self.health < this.maxHpSeen) {
      this.alert();
      return false;
    }
    for (const f of friendlies) {
      if (!f.alive) continue;
      const d = Phaser.Math.Distance.Between(this.self.x, this.self.y, f.x, f.y);
      if (d <= this.aggroRadius) {
        this.clearStalkTint();
        this.alert();
        return false;
      }
    }
    if (this.ambush) this.stalkTint = true;
    this.self.setVelocity(0, 0);
    void now;
    return true;
  }

  /** Re-apply after Fighter.syncVisuals — stalk tint must win over default alpha. */
  syncAmbushVisual(): void {
    if (!this.aware && this.ambush && this.self.alive) {
      this.self.bodyVisual.setAlpha(0.52);
    }
  }

  private clearStalkTint(): void {
    this.stalkTint = false;
  }

  update(target: Fighter, now: number): void {
    if (!this.self.alive || !target.alive) {
      this.self.setVelocity(0, 0);
      return;
    }
    if (!this.aware) {
      this.self.setVelocity(0, 0);
      return;
    }
    if (this.self.isFrozen()) {
      this.self.setVelocity(0, 0);
      return;
    }
    if (this.self.combat === "hurt" || this.self.combat === "stagger" || this.self.combat === "dodge" || this.self.combat === "parry") return;

    if (this.pendingCharge) {
      const dist = Phaser.Math.Distance.Between(this.self.x, this.self.y, target.x, target.y);
      this.pendingCharge = false;
      const engageRange = this.hornCharge ? this.self.weapon.range + 36 : this.self.weapon.range - 4;
      if (dist > engageRange - 40) {
        this.state = "special";
        this.nextThink = now + (this.hornCharge ? 900 : 600);
        this.act(target, now);
        this.self.regen(this.self.scene.game.loop.delta);
        return;
      }
    }

    if (this.self.stamina < 18) this.state = "recover";
    else if (now >= this.nextThink) this.pick(target, now);

    this.act(target, now);
    this.self.regen(this.self.scene.game.loop.delta);
  }

  destroy(): void {
    this.clearStalkTint();
    this.telegraph?.destroy();
    this.alertMark?.destroy();
  }

  private showAlertMark(): void {
    this.alertMark?.destroy();
    this.alertMark = this.self.scene.add
      .text(this.self.x, this.self.y - 36, "!", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "18px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(5000);
    this.self.scene.tweens.add({
      targets: this.alertMark,
      y: this.self.y - 48,
      alpha: 0,
      duration: 700,
      onComplete: () => {
        this.alertMark?.destroy();
        this.alertMark = undefined;
      },
    });
  }

  private pick(target: Fighter, now: number): void {
    const dist = Phaser.Math.Distance.Between(this.self.x, this.self.y, target.x, target.y);
    const roll = Math.random();
    const w = this.self.weapon;

    if ((this.tuskCharge || this.hornCharge) && now >= this.chargeCooldownUntil) {
      const engageRange = this.hornCharge ? this.self.weapon.range + 36 : this.self.weapon.range - 4;
      if (dist > engageRange - 20 && roll < 0.24) {
        this.state = "special";
        this.chargeCooldownUntil = now + (this.hornCharge ? 3200 : 2600);
        this.nextThink = now + 400;
        return;
      }
    }

    switch (this.style) {
      case "aggressive":
        if (dist > w.range + 10) this.state = "approach";
        else if (roll < 0.32) this.state = "attack";
        else if (roll < 0.4) this.state = "dodge";
        else if (roll < 0.55) this.state = "defend";
        else this.state = "circle";
        this.nextThink = now + Phaser.Math.Between(320, 560);
        break;
      case "spear":
        if (dist < w.range - 24) this.state = "retreat";
        else if (dist > w.range + 20) this.state = "approach";
        else if (roll < 0.28) this.state = "attack";
        else if (roll < 0.36) this.state = "special";
        else if (roll < 0.7) this.state = "defend";
        else this.state = "circle";
        this.nextThink = now + Phaser.Math.Between(380, 640);
        break;
      case "heavy":
        if (dist > 70) this.state = "approach";
        else if (roll < 0.24) this.state = "attack";
        else if (roll < 0.55) this.state = "defend";
        else this.state = "circle";
        this.nextThink = now + Phaser.Math.Between(520, 820);
        break;
      case "defensive":
        if (dist > 60) this.state = "approach";
        else if (target.combat === "attack") this.state = "defend";
        else if (roll < 0.26) this.state = "attack";
        else this.state = "circle";
        this.nextThink = now + Phaser.Math.Between(360, 620);
        break;
      case "elite":
        if (dist > 80) this.state = "approach";
        else if (roll < 0.14) this.state = "dodge";
        else if (roll < 0.38) this.state = "attack";
        else if (roll < 0.7) this.state = "circle";
        else this.state = "retreat";
        this.nextThink = now + Phaser.Math.Between(280, 500);
        break;
      case "champion":
        if (dist > 90) this.state = "approach";
        else if (roll < 0.12) this.state = "special";
        else if (roll < 0.36) this.state = "attack";
        else if (roll < 0.48) this.state = "dodge";
        else if (roll < 0.78) this.state = "circle";
        else this.state = "retreat";
        this.nextThink = now + Phaser.Math.Between(240, 440);
        break;
      default:
        this.state = dist > 50 ? "approach" : roll < 0.35 ? "attack" : "circle";
        this.nextThink = now + 420;
    }
  }

  private act(target: Fighter, now: number): void {
    const dx = target.x - this.self.x;
    const dy = target.y - this.self.y;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const nx = dx / dist;
    const ny = dy / dist;
    this.self.facing.set(nx, ny);
    const speed =
      this.self.moveSpeed *
      (this.style === "heavy" ? 0.62 : this.style === "champion" ? 0.98 : this.style === "elite" ? 0.92 : 0.86) *
      (this.hornCharge && this.state === "approach" ? 1.15 : 1);

    if (this.state === "recover") {
      this.self.setBlocking(this.self.weapon.blockStrength > 0.2);
      this.self.setVelocity(-nx * speed * 0.3, -ny * speed * 0.3);
      if (this.self.stamina > 40) this.self.setBlocking(false);
      return;
    }

    if (this.state === "defend") {
      this.self.setBlocking(true);
      this.self.setVelocity(this.self.body?.velocity.x ? this.self.body.velocity.x * 0.9 : 0, 0);
      this.self.tryMove(ny * speed * 0.25 * this.circleDir, -nx * speed * 0.25 * this.circleDir);
      return;
    }
    this.self.setBlocking(false);

    if (this.state === "approach") this.self.tryMove(nx * speed, ny * speed);
    else if (this.state === "retreat") this.self.tryMove(-nx * speed * 0.9, -ny * speed * 0.9);
    else if (this.state === "circle") {
      this.self.tryMove(ny * speed * 0.85 * this.circleDir + nx * 20, -nx * speed * 0.85 * this.circleDir + ny * 20);
    } else if (this.state === "dodge") {
      this.self.facing.set(-nx, -ny);
      this.self.tryDodge();
      this.state = "circle";
    } else if (this.state === "attack") {
      this.self.setVelocity(0, 0);
      if (Math.random() < 0.22) {
        this.state = "circle";
        return;
      }
      const useHeavy =
        Math.random() < (this.style === "heavy" ? 0.5 : this.style === "champion" ? 0.34 : this.style === "aggressive" ? 0.28 : 0.2);
      this.windupThen(
        () => this.self.tryAttack(useHeavy ? "heavy" : "light"),
        (this.style === "champion" ? 420 : 340) + (useHeavy ? 160 : 0),
      );
      this.state = "circle";
    } else if (this.state === "special") {
      this.self.setVelocity(0, 0);
      const wind = this.hornCharge ? 720 : this.style === "champion" ? 560 : 400;
      this.windupThen(() => this.self.trySpecial(), wind);
      this.state = "retreat";
    }
    void now;
  }

  private windupThen(fn: () => void, ms: number): void {
    this.showTelegraph(ms);
    this.self.scene.time.delayedCall(ms, () => {
      this.telegraph?.destroy();
      this.telegraph = undefined;
      fn();
    });
  }

  private showTelegraph(ms: number): void {
    this.telegraph?.destroy();
    this.telegraph = this.self.scene.add
      .circle(this.self.x, this.self.y - 26, (this.hornCharge ? 10 : 7) * this.telegraphRadiusMult, this.hornCharge ? 0xff8844 : 0xff5533, 0.85)
      .setDepth(4000);
    this.self.scene.tweens.add({
      targets: this.telegraph,
      alpha: 0.2,
      yoyo: true,
      duration: Math.max(80, ms / 3),
      repeat: 2,
    });
  }
}
