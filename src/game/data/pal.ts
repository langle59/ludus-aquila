import type { BeastKind, PalSkillId, SaveData } from "../types";
import { gameState } from "../state/GameState";
import { getHouse } from "./houses";
import { generateHouseName } from "./names";
import { bus } from "../systems/bus";

export type PalTier = 1 | 2 | 3 | 4;
export type PalTintId = "house" | "ivory" | "night";
export type PalSkillBranch = "hide" | "fang" | "pace";

export interface PalSkillDef {
  id: PalSkillId;
  name: string;
  branch: PalSkillBranch;
  tier: 0 | 1 | 2;
  requires?: PalSkillId;
  cost: number;
  description: string;
}

export const PAL_SKILLS: PalSkillDef[] = [
  { id: "hide_1", name: "Thick Pelt", branch: "hide", tier: 0, cost: 50, description: "+10 health. The yard hardens the hide." },
  { id: "hide_2", name: "Iron Shoulder", branch: "hide", tier: 1, requires: "hide_1", cost: 110, description: "+12 knock. Blows glance off." },
  { id: "hide_3", name: "Den Heart", branch: "hide", tier: 2, requires: "hide_2", cost: 220, description: "+14 health. It will not drop easily." },
  { id: "fang_1", name: "Sharp Tooth", branch: "fang", tier: 0, cost: 50, description: "+3 bite." },
  { id: "fang_2", name: "Deep Bite", branch: "fang", tier: 1, requires: "fang_1", cost: 110, description: "+4 bite. The crowd hears the snap." },
  { id: "fang_3", name: "Kill Instinct", branch: "fang", tier: 2, requires: "fang_2", cost: 220, description: "+4 bite and a faster lunge." },
  { id: "pace_1", name: "Quick Paw", branch: "pace", tier: 0, cost: 50, description: "+10 speed." },
  { id: "pace_2", name: "Long Lunge", branch: "pace", tier: 1, requires: "pace_1", cost: 110, description: "+24 lunge speed." },
  { id: "pace_3", name: "Dust Wake", branch: "pace", tier: 2, requires: "pace_2", cost: 220, description: "+12 speed. It closes like a thrown spear." },
];

export const PAL_SKILL_BRANCHES: { id: PalSkillBranch; title: string; color: number }[] = [
  { id: "hide", title: "HIDE", color: 0x6a3e24 },
  { id: "fang", title: "FANG", color: 0xa33b2b },
  { id: "pace", title: "PACE", color: 0x4a8a7a },
];

export const PAL_TINTS: { id: PalTintId; name: string; hint: string }[] = [
  { id: "house", name: "House dye", hint: "Colours of the house you pledged." },
  { id: "ivory", name: "Ivory", hint: "Bleached pale, like parade cloth." },
  { id: "night", name: "Night", hint: "Dark as the stands after a fall." },
];

const PAL_TITLES: Record<BeastKind, [string, string, string, string]> = {
  serpent: ["Hatchling", "Coil", "War Serpent", "Serpens Rex"],
  wolf: ["Hatchling", "Pup", "War Wolf", "Lupus Rex"],
  bear: ["Hatchling", "Cub", "War Bear", "Ursus Rex"],
  lion: ["Hatchling", "Cub", "War Lion", "Leo Rex"],
  bull: ["Hatchling", "Calf", "War Bull", "Taurus Rex"],
  boar: ["Hatchling", "Shoat", "War Boar", "Aper Rex"],
  eagle: ["Hatchling", "Eaglet", "War Eagle", "Aquila Rex"],
  tiger: ["Hatchling", "Cub", "War Tiger", "Tigris Rex"],
  rhino: ["Hatchling", "Calf", "War Rhino", "Rhinoceros Rex"],
  elephant: ["Hatchling", "Calf", "War Elephant", "Elephas Rex"],
};

export function palSkillsInBranch(branch: PalSkillBranch): PalSkillDef[] {
  return PAL_SKILLS.filter((s) => s.branch === branch);
}

export function getPalSkill(id: PalSkillId): PalSkillDef {
  const found = PAL_SKILLS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown pal skill ${id}`);
  return found;
}

export function palKind(save: SaveData = gameState.save): BeastKind {
  if (save.palBeastKind) return save.palBeastKind;
  return getHouse(save.playerHouse ?? "")?.beastKind ?? "eagle";
}

const PAL_BEAST_NAMES: Record<BeastKind, string> = {
  serpent: "Serpent",
  wolf: "Wolf",
  bear: "Bear",
  lion: "Lion",
  bull: "Bull",
  boar: "Boar",
  eagle: "Eagle",
  tiger: "Tiger",
  rhino: "Rhino",
  elephant: "Elephant",
};

export function palAnimalName(save: SaveData = gameState.save): string {
  if (save.palBeastKind) return PAL_BEAST_NAMES[save.palBeastKind];
  return getHouse(save.playerHouse ?? "")?.animalName ?? "Eagle";
}

export function palTexture(save: SaveData = gameState.save): string {
  return `beast-${palKind(save)}`;
}

export function palUnlocked(save: SaveData = gameState.save): boolean {
  return Boolean(save.palUnlocked) || save.defeatedHouses.length >= 1;
}

export function palTier(save: SaveData = gameState.save): PalTier {
  const n = save.defeatedHouses.length;
  if (save.freedomWon || n >= 8) return 4;
  if (n >= 5) return 3;
  if (n >= 3) return 2;
  return 1;
}

export function palTitle(tier: PalTier, save: SaveData = gameState.save): string {
  return PAL_TITLES[palKind(save)][tier - 1];
}

export function palDisplayName(save: SaveData = gameState.save): string {
  const n = save.palName?.trim();
  return n || palTitle(palTier(save), save);
}

export function palBrought(save: SaveData = gameState.save): boolean {
  return palUnlocked(save) && save.palBrought !== false;
}

export function palNextHint(save: SaveData = gameState.save): string {
  const tier = palTier(save);
  const animal = palAnimalName(save).toLowerCase();
  if (tier === 1) return `Beat 3 houses and the ${animal} grows.`;
  if (tier === 2) return `Beat 5 houses and it hardens.`;
  if (tier === 3) return "Take the rest of the circuit, or the Rudis, and it becomes legend.";
  return "It has grown as far as a yard beast can.";
}

export function palSkillCount(save: SaveData = gameState.save): number {
  return (save.unlockedPalSkills ?? []).length;
}

export function palSkillMax(): number {
  return PAL_SKILLS.length;
}

export function palBondProgress(save: SaveData = gameState.save): {
  xp: number;
  toNext: number;
  ratio: number;
  points: number;
  skills: number;
  skillMax: number;
  treeRatio: number;
  hint: string;
} {
  const xp = Math.max(0, save.palXp ?? 0);
  const toNext = Math.max(20, save.palXpToNext ?? 40);
  const skills = palSkillCount(save);
  const skillMax = palSkillMax();
  const points = save.palPoints ?? 0;
  const treeFull = skills >= skillMax;
  let hint: string;
  if (!palUnlocked(save)) hint = "Beat a house champion first.";
  else if (treeFull) hint = "The tree is learned. Bond XP still banks pal points.";
  else if (!palBrought(save)) hint = "Bring it to the arena to earn bond XP.";
  else hint = "Win in the arena with it beside you to fill the bar.";
  return {
    xp,
    toNext,
    ratio: Math.min(1, xp / toNext),
    points,
    skills,
    skillMax,
    treeRatio: skillMax > 0 ? skills / skillMax : 0,
    hint,
  };
}

export function palBondHint(save: SaveData = gameState.save): string {
  if (!palUnlocked(save)) return "Beat a house champion first.";
  return palBrought(save)
    ? "It fights beside you. Arena XP ×0.9. Its bites stir the crowd."
    : "You walk in alone. Arena XP ×1.15. The crowd starts colder.";
}

export function grantPalXp(amount: number): { amount: number; gained: number } {
  const s = gameState.save;
  if (!palUnlocked(s) || amount <= 0) return { amount: 0, gained: 0 };
  s.palXp = (s.palXp ?? 0) + amount;
  if (!s.palXpToNext || s.palXpToNext < 20) s.palXpToNext = 40;
  let gained = 0;
  while (s.palXp >= s.palXpToNext) {
    s.palXp -= s.palXpToNext;
    s.palPoints = (s.palPoints ?? 0) + 1;
    gained += 1;
    s.palXpToNext = Math.min(180, Math.round(s.palXpToNext * 1.32 + 10));
  }
  if (gained > 0) bus.emit("toast", gained === 1 ? "The pal earned a pal point." : `The pal earned ${gained} pal points.`);
  bus.emit("roost-changed");
  return { amount, gained };
}

export function togglePalBrought(): boolean {
  const s = gameState.save;
  if (!palUnlocked(s)) return false;
  s.palBrought = s.palBrought === false;
  gameState.persist();
  bus.emit("roost-changed");
  return palBrought(s);
}

export function palTintId(save: SaveData = gameState.save): PalTintId {
  const id = save.palTint;
  if (id === "ivory" || id === "night" || id === "house") return id;
  return "house";
}

export function palTintColor(save: SaveData = gameState.save): number | undefined {
  const id = palTintId(save);
  if (id === "ivory") return 0xf4ead8;
  if (id === "night") return 0x5a5478;
  return getHouse(save.playerHouse ?? "")?.colors.primary;
}

export function setPalTint(id: PalTintId): void {
  gameState.save.palTint = id;
  gameState.persist();
  bus.emit("roost-changed");
}

export function rollPalName(): string {
  const next = generateHouseName(gameState.save.playerHouse, gameState.save.palName ?? "");
  gameState.save.palName = next;
  gameState.persist();
  bus.emit("roost-changed");
  return next;
}

export function hasPalSkill(id: PalSkillId, save: SaveData = gameState.save): boolean {
  return (save.unlockedPalSkills ?? []).includes(id);
}

export function canUnlockPalSkill(id: PalSkillId): boolean {
  if (!palUnlocked()) return false;
  if (hasPalSkill(id)) return false;
  if ((gameState.save.palPoints ?? 0) < 1) return false;
  const def = getPalSkill(id);
  if (def.requires && !hasPalSkill(def.requires)) return false;
  return gameState.save.denarii >= def.cost;
}

export function unlockPalSkill(id: PalSkillId): "ok" | "poor" | "points" | "locked" | "owned" {
  if (!palUnlocked()) return "locked";
  if (hasPalSkill(id)) return "owned";
  const def = getPalSkill(id);
  if (def.requires && !hasPalSkill(def.requires)) return "locked";
  if ((gameState.save.palPoints ?? 0) < 1) return "points";
  if (gameState.save.denarii < def.cost) return "poor";
  gameState.save.palPoints -= 1;
  gameState.save.denarii = Math.max(0, gameState.save.denarii - def.cost);
  gameState.save.unlockedPalSkills = [...(gameState.save.unlockedPalSkills ?? []), id];
  gameState.persist();
  bus.emit("denarii-changed", -def.cost);
  bus.emit("roost-changed");
  return "ok";
}

export function grantPalPoint(note?: string): void {
  gameState.save.palPoints = (gameState.save.palPoints ?? 0) + 1;
  if (note) bus.emit("toast", note);
}

export function palStats(tier: PalTier): {
  maxHp: number;
  bite: number;
  knock: number;
  speed: number;
  lungeSpd: number;
  visScale: number;
  tint?: number;
} {
  if (tier === 1) return { maxHp: 28, bite: 6, knock: 28, speed: 112, lungeSpd: 250, visScale: 0.92 };
  if (tier === 2) return { maxHp: 42, bite: 9, knock: 36, speed: 128, lungeSpd: 280, visScale: 1.05 };
  if (tier === 3) return { maxHp: 58, bite: 13, knock: 44, speed: 142, lungeSpd: 310, visScale: 1.18, tint: 0xf0d8a0 };
  return { maxHp: 74, bite: 17, knock: 52, speed: 158, lungeSpd: 340, visScale: 1.32, tint: 0xe8c96a };
}

export function palCombatStats(save: SaveData = gameState.save): {
  maxHp: number;
  bite: number;
  knock: number;
  speed: number;
  lungeSpd: number;
  visScale: number;
  tint?: number;
  label: string;
} {
  const base = palStats(palTier(save));
  const kind = palKind(save);
  const scaleCap = kind === "bear" || kind === "bull" || kind === "boar" || kind === "rhino" || kind === "elephant" ? 0.62 : 1.05;
  let maxHp = base.maxHp;
  let bite = base.bite;
  let knock = base.knock;
  let speed = base.speed;
  let lungeSpd = base.lungeSpd;
  if (hasPalSkill("hide_1", save)) maxHp += 10;
  if (hasPalSkill("hide_2", save)) knock += 12;
  if (hasPalSkill("hide_3", save)) maxHp += 14;
  if (hasPalSkill("fang_1", save)) bite += 3;
  if (hasPalSkill("fang_2", save)) bite += 4;
  if (hasPalSkill("fang_3", save)) {
    bite += 4;
    lungeSpd += 18;
  }
  if (hasPalSkill("pace_1", save)) speed += 10;
  if (hasPalSkill("pace_2", save)) lungeSpd += 24;
  if (hasPalSkill("pace_3", save)) speed += 12;
  return {
    ...base,
    maxHp,
    bite,
    knock,
    speed,
    lungeSpd,
    visScale: Math.min(base.visScale, scaleCap),
    tint: palTintColor(save) ?? base.tint,
    label: palDisplayName(save),
  };
}
