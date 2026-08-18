import { Fighter } from "../entities/Fighter";
import { COLORS } from "../config";
import type { WeaponId, AttackKind } from "../types";
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
      ? (w.id === "dual_blades" ? 0.55 : 1.45) * (attacker.team === "player" ? getSkillMods().specialMult : 1)
      : move?.damageMult ?? 1;
  const bonus = attacker.team === "player" ? attacker.nextHitBonus : 1;
  const dmg = (w.damage + attacker.stats.attack) * specialMult * bonus;
  const knock = w.knockback * (attacker.attackKind === "special" ? 1.3 : move?.knockMult ?? 1);
  const from = new Phaser.Math.Vector2(attacker.facing.x, attacker.facing.y);
  const staggerHit =
    (attacker.attackKind === "special" && (w.id === "gladius" || isHeavyWeapon(w.id))) ||
    Boolean(move?.stagger);
  const thrust = move?.shape === "thrust" || (attacker.attackKind === "special" && (w.id === "spear" || w.id === "trident_net"));
  const slack = rad + 12;

  for (const t of targets) {
    if (!t.alive || t === attacker) continue;
    if (t.team === attacker.team) continue;
    const dist = thrust
      ? distToSegment(t.x, t.y, attacker.x, attacker.y, center.x, center.y)
      : Phaser.Math.Distance.Between(center.x, center.y, t.x, t.y);
    if (dist > slack) continue;
    const result = t.takeDamage(dmg, from, knock, staggerHit);
    if (result === "miss") continue;
    attacker.hitboxActive = attacker.attackKind === "special" && w.id === "dual_blades";
    if (result === "perfect") {
      burst(attacker.scene, t.x, t.y, 0xffe08a, false, hitAngle(attacker), w.id);
      floatNumber(attacker.scene, t.x, t.y - 18, "PERFECT", "#ffe08a");
      onHit?.(t, result);
      continue;
    }
    if (result === "parry") {
      burst(attacker.scene, t.x, t.y, 0xc9d8e8, false, hitAngle(attacker), w.id);
      floatNumber(attacker.scene, t.x, t.y - 18, "PARRY", "#c9d8e8");
      attacker.stagger(560);
      attacker.hitboxActive = false;
      onHit?.(t, result);
      continue;
    }
    if (attacker.team === "player") attacker.consumeHitBonus();
    audio.sfx(result === "block" ? "block" : "hit");
    const heavyFeel = attacker.attackKind !== "light";
    const tint = result === "block" ? 0x88aacc : weaponHitTint(w.id, attacker.attackKind);
    const angle = hitAngle(attacker);
    burst(attacker.scene, t.x, t.y, tint, result === "hit" && heavyFeel, angle, w.id, attacker.attackKind === "special");
    if (result === "hit" && heavyFeel) sandKick(attacker.scene, t.x, t.y + 8, angle);
    const shown = Math.max(1, Math.round(t.lastDamage));
    floatNumber(attacker.scene, t.x + Phaser.Math.Between(-8, 8), t.y - 22, String(shown), result === "block" ? "#7ab8e8" : "#e07060");
    if (result === "hit") {
      if (attacker.team === "player") attacker.registerCombo();
      const stop = w.id === "dual_blades" && attacker.attackKind === "special" ? 32 : heavyFeel ? 70 : 45;
      attacker.freeze(stop);
      t.freeze(stop);
      if (gameState.settings.screenShake) {
        attacker.scene.cameras.main.shake(heavyFeel ? 90 : 42, heavyFeel ? 0.005 : 0.0022);
      }
    } else if (gameState.settings.screenShake && attacker.attackKind !== "light") {
      attacker.scene.cameras.main.shake(50, 0.002);
    }
    onHit?.(t, result);
    if (!(w.id === "dual_blades" && attacker.attackKind === "special")) break;
  }
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const ab2 = abx * abx + aby * aby;
  const t = ab2 <= 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / ab2));
  return Phaser.Math.Distance.Between(px, py, ax + abx * t, ay + aby * t);
}

function hitAngle(attacker: Fighter): number {
  return Phaser.Math.RadToDeg(Math.atan2(attacker.facing.y, attacker.facing.x));
}

export function weaponHitTint(id: WeaponId, kind: AttackKind): number {
  const base: Record<WeaponId, number> = {
    gladius: 0xc8d0e8,
    spear: 0x9ab8d8,
    dual_blades: 0xffe08a,
    securis: 0xff8844,
    malleus: 0xb8b0d0,
    trident_net: 0x88ddaa,
  };
  const c = base[id];
  if (kind === "special") return Phaser.Display.Color.GetColor(
    Math.min(255, ((c >> 16) & 255) + 40),
    Math.min(255, ((c >> 8) & 255) + 40),
    Math.min(255, (c & 255) + 40),
  );
  if (kind === "heavy") return Phaser.Display.Color.GetColor(
    Math.min(255, ((c >> 16) & 255) + 24),
    Math.min(255, ((c >> 8) & 255) + 24),
    Math.min(255, (c & 255) + 24),
  );
  return c;
}

export function sandKick(scene: Phaser.Scene, x: number, y: number, angleDeg: number): void {
  const rad = Phaser.Math.DegToRad(angleDeg);
  const fx = Math.cos(rad);
  const fy = Math.sin(rad);
  for (let i = 0; i < 5; i++) {
    const p = scene.add
      .image(x + Phaser.Math.Between(-10, 10), y, "fx-dust")
      .setDepth(2997)
      .setAlpha(0.65)
      .setScale(0.7 + Math.random() * 0.6)
      .setTint(0xc4a36b);
    scene.tweens.add({
      targets: p,
      x: p.x + fx * Phaser.Math.Between(16, 36) + Phaser.Math.Between(-6, 6),
      y: p.y + fy * Phaser.Math.Between(8, 22) - Phaser.Math.Between(4, 14),
      alpha: 0,
      scale: 1.4,
      duration: 340 + i * 40,
      onComplete: () => p.destroy(),
    });
  }
}

export function burst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tint: number,
  heavy = false,
  angleDeg = 0,
  _weaponId?: WeaponId,
  special = false,
): void {
  const count = special ? 22 : heavy ? 20 : 14;
  const rad = Phaser.Math.DegToRad(angleDeg);
  const fx = Math.cos(rad);
  const fy = Math.sin(rad);
  for (let i = 0; i < count; i++) {
    const spread = heavy || special ? 34 : 26;
    const along = Phaser.Math.Between(-spread, spread);
    const aside = Phaser.Math.Between(-spread * 0.6, spread * 0.6);
    const p = scene.add.image(x, y, "spark").setTint(tint).setDepth(3000).setScale(0.8 + Math.random() * 0.8);
    scene.tweens.add({
      targets: p,
      x: x + fx * along - fy * aside,
      y: y + fy * along + fx * aside,
      alpha: 0,
      scale: 0.15,
      duration: special ? 360 : heavy ? 320 : 260,
      onComplete: () => p.destroy(),
    });
  }
  const ring = scene.add.image(x, y, "fx-ring").setTint(tint).setAlpha(heavy || special ? 0.85 : 0.7).setScale(heavy || special ? 0.5 : 0.38).setDepth(2998);
  scene.tweens.add({
    targets: ring,
    alpha: 0,
    scale: heavy || special ? 1.35 : 1.05,
    duration: special ? 260 : heavy ? 220 : 180,
    onComplete: () => ring.destroy(),
  });
  const slashAng = angleDeg + (heavy ? 55 : 35) * (Math.random() > 0.5 ? 1 : -1);
  const streak = scene.add
    .image(x, y, "fx-slash")
    .setTint(tint)
    .setAlpha(heavy || special ? 0.95 : 0.8)
    .setScale(heavy || special ? 0.72 : special ? 0.65 : 0.5)
    .setDepth(2999)
    .setAngle(slashAng);
  scene.tweens.add({
    targets: streak,
    alpha: 0,
    scale: heavy || special ? 1.15 : 0.9,
    x: x + fx * (heavy ? 18 : 10),
    y: y + fy * (heavy ? 18 : 10),
    duration: special ? 200 : 170,
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
