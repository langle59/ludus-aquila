import type { AttackKind, AttackShape, WeaponDef, WeaponId, WeaponMove } from "../types";
import { gameState } from "../state/GameState";

function move(name: string, shape: AttackShape, extra: Partial<Omit<WeaponMove, "name" | "shape">> = {}): WeaponMove {
  return {
    name,
    description: extra.description ?? "",
    damageMult: extra.damageMult ?? 1,
    staminaMult: extra.staminaMult ?? 1,
    knockMult: extra.knockMult ?? 1,
    rangeBonus: extra.rangeBonus ?? 0,
    radiusBonus: extra.radiusBonus ?? 0,
    windupMult: extra.windupMult ?? 1,
    recoverMult: extra.recoverMult ?? 1,
    speedMult: extra.speedMult ?? 1,
    shape,
    lunge: extra.lunge ?? 0,
    stagger: extra.stagger ?? false,
  };
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  gladius: {
    id: "gladius",
    name: "Gladius and Shield",
    shortName: "Gladius",
    description: "A balanced beginner style. Medium speed, medium damage, and a reliable shield.",
    specialName: "Shield Bash",
    specialDescription: "Strike with the shield to briefly stagger an opponent.",
    light: move("Slash", "slash", { description: "A quick cut from either side." }),
    heavy: move("Thrust", "thrust", {
      description: "A committed stab. Slower, longer reach.",
      damageMult: 1.4,
      staminaMult: 1.55,
      knockMult: 1.15,
      rangeBonus: 16,
      radiusBonus: 4,
      windupMult: 1.35,
      recoverMult: 1.25,
      speedMult: 1.4,
      lunge: 200,
    }),
    damage: 12,
    attackSpeed: 380,
    range: 46,
    staminaCost: 10,
    specialStamina: 18,
    specialCooldown: 2200,
    blockStrength: 0.65,
    knockback: 90,
    windup: 80,
    recover: 140,
    comboHits: 1,
    playable: true,
    unlockAfter: "start",
  },
  spear: {
    id: "spear",
    name: "Spear and Shield",
    shortName: "Spear",
    description: "Long reach and strong defense. Slower attacks that keep enemies away.",
    specialName: "Lunge",
    specialDescription: "Thrust forward with increased reach and a burst of speed.",
    light: move("Jab", "thrust", { description: "A straight poke that holds the line." }),
    heavy: move("Sweep", "slash", {
      description: "A wide cut that catches anyone stepping around the point.",
      damageMult: 1.3,
      staminaMult: 1.5,
      knockMult: 1.45,
      rangeBonus: -8,
      radiusBonus: 16,
      windupMult: 1.3,
      recoverMult: 1.2,
      speedMult: 1.35,
    }),
    damage: 14,
    attackSpeed: 520,
    range: 78,
    staminaCost: 14,
    specialStamina: 22,
    specialCooldown: 2600,
    blockStrength: 0.55,
    knockback: 110,
    windup: 120,
    recover: 200,
    comboHits: 1,
    playable: true,
    unlockAfter: "first_win",
  },
  dual_blades: {
    id: "dual_blades",
    name: "Dual Blades",
    shortName: "Dual Blades",
    description: "Very fast, short range, and mobile. Weak defense, strong combos.",
    specialName: "Flurry",
    specialDescription: "A burst of several quick cuts.",
    light: move("Cut", "slash", { description: "Two short blades, one beat." }),
    heavy: move("Cross", "slash", {
      description: "A heavier X-cut. More bite, more recovery.",
      damageMult: 1.55,
      staminaMult: 1.7,
      knockMult: 1.18,
      rangeBonus: 6,
      radiusBonus: 8,
      windupMult: 1.4,
      recoverMult: 1.35,
      speedMult: 1.5,
      lunge: 90,
    }),
    damage: 7,
    attackSpeed: 280,
    range: 36,
    staminaCost: 8,
    specialStamina: 24,
    specialCooldown: 3000,
    blockStrength: 0.12,
    knockback: 40,
    windup: 40,
    recover: 82,
    comboHits: 2,
    playable: true,
    unlockAfter: "elite",
  },
  trident_net: {
    id: "trident_net",
    name: "Trident and Net",
    shortName: "Trident",
    description: "Long reach and battlefield control. Inspired by the retiarius.",
    specialName: "Net Throw",
    specialDescription: "Throw a net. If it catches, the opponent is stunned for a few seconds.",
    light: move("Jab", "thrust", { description: "Three points, one line." }),
    heavy: move("Hook", "slash", {
      description: "A sideways rake that pulls a fighter off their step.",
      damageMult: 1.35,
      staminaMult: 1.5,
      knockMult: 1.4,
      rangeBonus: -6,
      radiusBonus: 14,
      windupMult: 1.28,
      recoverMult: 1.22,
      speedMult: 1.32,
    }),
    damage: 13,
    attackSpeed: 460,
    range: 72,
    staminaCost: 12,
    specialStamina: 20,
    specialCooldown: 3200,
    blockStrength: 0.18,
    knockback: 80,
    windup: 110,
    recover: 180,
    comboHits: 1,
    playable: true,
    unlockAfter: "later",
  },
  securis: {
    id: "securis",
    name: "Battle Axe",
    shortName: "Axe",
    description: "A heavy two-handed axe. Huge damage, slow swings, costly stamina.",
    specialName: "Heavy Slam",
    specialDescription: "A crushing slam that damages and staggers nearby enemies.",
    light: move("Chop", "slam", {
      description: "A falling edge. Faster than the full overhead.",
      windupMult: 0.62,
      recoverMult: 0.7,
      speedMult: 0.72,
    }),
    heavy: move("Cleave", "slam", {
      description: "A full overhead. Staggers if it lands.",
      damageMult: 1.5,
      staminaMult: 1.4,
      knockMult: 1.55,
      rangeBonus: 6,
      radiusBonus: 8,
      windupMult: 1.35,
      recoverMult: 1.3,
      speedMult: 1.45,
      lunge: 80,
      stagger: true,
    }),
    damage: 24,
    attackSpeed: 720,
    range: 54,
    staminaCost: 22,
    specialStamina: 32,
    specialCooldown: 4000,
    blockStrength: 0.08,
    knockback: 220,
    windup: 220,
    recover: 380,
    comboHits: 1,
    playable: true,
    unlockAfter: "later",
  },
  malleus: {
    id: "malleus",
    name: "War Hammer",
    shortName: "Hammer",
    description: "The heaviest steel in the ludus. Slowest swing, greatest ruin. Almost no defense.",
    specialName: "Earth Shatter",
    specialDescription: "A ground slam that staggers and hurls anyone close.",
    light: move("Smash", "slam", {
      description: "A short hammer blow.",
      windupMult: 0.58,
      recoverMult: 0.68,
      speedMult: 0.7,
    }),
    heavy: move("Crush", "slam", {
      description: "A two-handed drop. Staggers and throws.",
      damageMult: 1.45,
      staminaMult: 1.35,
      knockMult: 1.5,
      rangeBonus: 8,
      radiusBonus: 10,
      windupMult: 1.3,
      recoverMult: 1.25,
      speedMult: 1.4,
      lunge: 70,
      stagger: true,
    }),
    damage: 30,
    attackSpeed: 820,
    range: 58,
    staminaCost: 26,
    specialStamina: 36,
    specialCooldown: 4600,
    blockStrength: 0.05,
    knockback: 290,
    windup: 260,
    recover: 420,
    comboHits: 1,
    playable: true,
    unlockAfter: "later",
  },
};

export const WEAPON_ORDER: WeaponId[] = [
  "gladius",
  "spear",
  "dual_blades",
  "trident_net",
  "securis",
  "malleus",
];

export function weaponIconKey(id: WeaponId): string {
  if (id === "spear") return "wep-spear";
  if (id === "dual_blades") return "wep-blade";
  if (id === "securis") return "wep-axe";
  if (id === "malleus") return "wep-hammer";
  if (id === "trident_net") return "wep-trident";
  return "wep-gladius";
}

export function getWeapon(id: WeaponId, mastered = false): WeaponDef {
  const base = WEAPONS[id];
  if (!mastered) return base;
  const lv = masteryLevel(id);
  if (lv <= 0) return base;
  const w: WeaponDef = { ...base, light: { ...base.light }, heavy: { ...base.heavy } };
  if (id === "gladius") {
    w.recover = Math.max(90, w.recover - (lv === 1 ? 18 : 32));
    if (lv >= 2) w.damage += 1;
  } else if (id === "spear") {
    w.range += lv === 1 ? 8 : 14;
  } else if (id === "dual_blades") {
    w.staminaCost = Math.max(6, w.staminaCost - lv);
    w.recover = Math.max(70, w.recover - (lv === 1 ? 8 : 16));
  } else if (id === "trident_net") {
    w.range += lv === 1 ? 6 : 12;
  } else if (id === "securis") {
    w.knockback += lv === 1 ? 10 : 22;
    if (lv >= 2) w.damage += 1;
  } else if (id === "malleus") {
    w.knockback += lv === 1 ? 12 : 24;
    if (lv >= 2) w.damage += 1;
  }
  return w;
}

export function recordWeaponWin(id: WeaponId): void {
  const s = gameState.save;
  s.weaponWins = s.weaponWins ?? {};
  s.weaponWins[id] = (s.weaponWins[id] ?? 0) + 1;
}

export function masteryLevel(id: WeaponId): 0 | 1 | 2 {
  const n = gameState.save.weaponWins?.[id] ?? 0;
  if (n >= 5) return 2;
  if (n >= 2) return 1;
  return 0;
}

export function masteryHint(id: WeaponId): string {
  const n = gameState.save.weaponWins?.[id] ?? 0;
  const lv = masteryLevel(id);
  if (lv >= 2) return "Mastered in the pit.";
  if (lv === 1) return `Form II — win ${Math.max(0, 5 - n)} more with this weapon.`;
  return `Form I — win ${Math.max(0, 2 - n)} more with this weapon.`;
}

export function flurryInterval(id: WeaponId, mastered = false): number {
  if (id !== "dual_blades") return 120;
  const lv = mastered ? masteryLevel(id) : 0;
  if (lv >= 2) return 95;
  if (lv >= 1) return 108;
  return 120;
}

export function isHeavyWeapon(id: WeaponId): boolean {
  return id === "securis" || id === "malleus";
}

export function weaponMove(w: WeaponDef, kind: Exclude<AttackKind, "special">): WeaponMove {
  return kind === "heavy" ? w.heavy : w.light;
}
