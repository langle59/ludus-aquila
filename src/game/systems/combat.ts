import { Fighter } from "../entities/Fighter";
import { COLORS } from "../config";
import type { WeaponId } from "../types";
import { getWeapon, isHeavyWeapon, weaponMove } from "../data/weapons";
import { audio } from "./audio";
import { gameState } from "../state/GameState";
import { getSkillMods } from "./progression";

export type HitResult = "hit" | "block" | "miss" | "perfect" | "parry";

export interface CombatTarget {
  alive: boolean;
  team: "player" | "enemy" | "ally";
  x: number;
  y: number;
  lastDamage: number;
  takeDamage(amount: number, from: Phaser.Math.Vector2, knock: number, special?: boolean): HitResult;
  freeze(ms: number): void;
}

export function resolveHits(attacker: Fighter, targets: CombatTarget[], onHit?: (t: CombatTarget, kind: HitResult) => void): void {
  if (!attacker.hitboxActive || !attacker.alive) return;
  const center = attacker.attackCenter();
  const rad = attacker.attackRadius();
  const w = attacker.weapon;
  const move = attacker.attackKind === "special" ? null : weaponMove(w, attacker.attackKind);
  const specialMult =
    attacker.attackKind === "special"
      ? (w.id === "dual_blades" ? 0.7 : 1.45) * (attacker.team === "player" ? getSkillMods().specialMult : 1)
      : move?.damageMult ?? 1;
  const bonus = attacker.team === "player" ? attacker.nextHitBonus : 1;
  const dmg = (w.damage + attacker.stats.attack) * specialMult * bonus;
  const knock = w.knockback * (attacker.attackKind === "special" ? 1.3 : move?.knockMult ?? 1);
  const from = new Phaser.Math.Vector2(attacker.facing.x, attacker.facing.y);
  const staggerHit =
    (attacker.attackKind === "special" && (w.id === "gladius" || isHeavyWeapon(w.id))) ||
    Boolean(move?.stagger);

  for (const t of targets) {
    if (!t.alive || t === attacker) continue;
    if (t.team === attacker.team) continue;
    const dist = Phaser.Math.Distance.Between(center.x, center.y, t.x, t.y);
    if (dist > rad + 12) continue;
    const result = t.takeDamage(dmg, from, knock, staggerHit);
    if (result === "miss") continue;
    attacker.hitboxActive = attacker.attackKind === "special" && w.id === "dual_blades";
    if (result === "perfect") {
      burst(attacker.scene, t.x, t.y, 0xffe08a);
      floatNumber(attacker.scene, t.x, t.y - 18, "PERFECT", "#ffe08a");
      onHit?.(t, result);
      continue;
    }
    if (result === "parry") {
      burst(attacker.scene, t.x, t.y, 0xc9d8e8);
      floatNumber(attacker.scene, t.x, t.y - 18, "PARRY", "#c9d8e8");
      attacker.stagger(560);
      attacker.hitboxActive = false;
      onHit?.(t, result);
      continue;
    }
    if (attacker.team === "player") attacker.consumeHitBonus();
    audio.sfx(result === "block" ? "block" : "hit");
    const tint = result === "block" ? 0x88aacc : 0xe8dcc8;
    burst(attacker.scene, t.x, t.y, tint, result === "hit" && (attacker.attackKind !== "light" || isHeavyWeapon(w.id)));
    const shown = Math.max(1, Math.round(t.lastDamage));
    floatNumber(attacker.scene, t.x + Phaser.Math.Between(-8, 8), t.y - 22, String(shown), result === "block" ? "#7ab8e8" : "#e07060");
    if (result === "hit") {
      if (attacker.team === "player") attacker.registerCombo();
      const heavy = attacker.attackKind !== "light" || isHeavyWeapon(w.id);
      const stop = w.id === "dual_blades" && attacker.attackKind === "special" ? 32 : heavy ? 70 : 45;
      attacker.freeze(stop);
      t.freeze(stop);
      if (gameState.settings.screenShake) {
        attacker.scene.cameras.main.shake(heavy ? 90 : 42, heavy ? 0.005 : 0.0022);
      }
    } else if (gameState.settings.screenShake && attacker.attackKind !== "light") {
      attacker.scene.cameras.main.shake(50, 0.002);
    }
    onHit?.(t, result);
    if (w.id !== "dual_blades") break;
  }
}

export function burst(scene: Phaser.Scene, x: number, y: number, tint: number, heavy = false): void {
  const count = heavy ? 18 : 14;
  for (let i = 0; i < count; i++) {
    const p = scene.add.image(x, y, "spark").setTint(tint).setDepth(3000).setScale(0.8 + Math.random() * 0.8);
    scene.tweens.add({
      targets: p,
      x: x + Phaser.Math.Between(heavy ? -34 : -26, heavy ? 34 : 26),
      y: y + Phaser.Math.Between(heavy ? -34 : -26, heavy ? 34 : 26),
      alpha: 0,
      scale: 0.15,
      duration: heavy ? 320 : 260,
      onComplete: () => p.destroy(),
    });
  }
  const ring = scene.add.image(x, y, "fx-ring").setTint(tint).setAlpha(0.7).setScale(heavy ? 0.45 : 0.38).setDepth(2998);
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    scale: heavy ? 1.25 : 1.05,
    duration: heavy ? 220 : 180,
    onComplete: () => ring.destroy(),
  });
  const streak = scene.add.image(x, y, "fx-slash").setTint(tint).setAlpha(0.8).setScale(heavy ? 0.6 : 0.5).setDepth(2999).setAngle(Phaser.Math.Between(0, 180));
  scene.tweens.add({
    targets: streak,
    alpha: 0,
    scale: heavy ? 1.05 : 0.9,
    duration: 170,
    onComplete: () => streak.destroy(),
  });
}

export function floatNumber(scene: Phaser.Scene, x: number, y: number, text: string, color: string): void {
  const label = scene.add
    .text(x, y, text, {
      fontFamily: "Cinzel, Georgia",
      fontSize: text === "PERFECT" || text === "PARRY" ? "16px" : "18px",
      color,
      stroke: "#1a1210",
      strokeThickness: 4,
    })
    .setOrigin(0.5)
    .setDepth(4000);
  scene.tweens.add({
    targets: label,
    y: y - 28,
    alpha: 0,
    duration: text === "PERFECT" || text === "PARRY" ? 700 : 620,
    ease: "Quad.easeOut",
    onComplete: () => label.destroy(),
  });
}

export function dummyStrikeFeedback(scene: Phaser.Scene, x: number, y: number): void {
  burst(scene, x, y, COLORS.gold);
  audio.sfx("hit");
  floatNumber(scene, x, y - 18, "HIT", "#e07060");
}

export function describeWeapon(id: WeaponId): string {
  const w = getWeapon(id);
  return `${w.name}\nLight: ${w.light.name}  ·  Heavy: ${w.heavy.name}\nDamage ${w.damage}  Speed ${Math.round(1000 / w.attackSpeed)}  Range ${w.range}\nStamina ${w.staminaCost}  Block ${Math.round(w.blockStrength * 100)}%\nSpecial: ${w.specialName} — ${w.specialDescription}`;
}
