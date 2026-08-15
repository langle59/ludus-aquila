import Phaser from "phaser";
import type { AiStyle } from "../types";
import { Fighter } from "../entities/Fighter";

export class CombatAI {
  private nextThink = 0;
  private state: "approach" | "circle" | "attack" | "defend" | "retreat" | "dodge" | "recover" | "special" = "approach";
  private circleDir = 1;
  private telegraph?: Phaser.GameObjects.Arc;

  constructor(
    private self: Fighter,
    private style: AiStyle,
  ) {
    this.circleDir = Math.random() < 0.5 ? -1 : 1;
  }

  update(target: Fighter, now: number): void {
    if (!this.self.alive || !target.alive) {
      this.self.setVelocity(0, 0);
      return;
    }
    if (this.self.isFrozen()) {
      this.self.setVelocity(0, 0);
      return;
    }
    if (this.self.combat === "hurt" || this.self.combat === "stagger" || this.self.combat === "dodge" || this.self.combat === "parry") return;

    if (this.self.stamina < 18) this.state = "recover";
    else if (now >= this.nextThink) this.pick(target, now);

    this.act(target, now);
    this.self.regen(this.self.scene.game.loop.delta);
  }

  destroy(): void {
    this.telegraph?.destroy();
  }

  private pick(target: Fighter, now: number): void {
    const dist = Phaser.Math.Distance.Between(this.self.x, this.self.y, target.x, target.y);
    const roll = Math.random();
    const w = this.self.weapon;

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
      (this.style === "heavy" ? 0.62 : this.style === "champion" ? 0.98 : this.style === "elite" ? 0.92 : 0.86);

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
      this.windupThen(() => this.self.trySpecial(), this.style === "champion" ? 560 : 400);
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
      .circle(this.self.x, this.self.y - 26, 7, 0xff5533, 0.85)
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
