import type { FighterStats } from "../types";
import { getHouse } from "./houses";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";

export type PatronId =
  | "lares"
  | "mercury"
  | "diana"
  | "hercules"
  | "mars"
  | "nemesis"
  | "victoria"
  | "silvanus"
  | "vulcan"
  | "fortuna";

export interface PatronDef {
  id: PatronId;
  name: string;
  houseId: string | null;
  blessing: string;
}

export const PATRONS: PatronDef[] = [
  { id: "lares", name: "Lares", houseId: null, blessing: "+8 max stamina" },
  { id: "mercury", name: "Mercury", houseId: "serpens", blessing: "+1.5 agility" },
  { id: "diana", name: "Diana", houseId: "lupus", blessing: "+14 move, longer dodge" },
  { id: "hercules", name: "Hercules", houseId: "aper", blessing: "+2 attack" },
  { id: "mars", name: "Mars", houseId: "taurus", blessing: "+1.5 attack and +1 defense" },
  { id: "nemesis", name: "Nemesis", houseId: "tigris", blessing: "Arena favor starts higher" },
  { id: "victoria", name: "Victoria", houseId: "leo", blessing: "+15% XP from arena wins" },
  { id: "silvanus", name: "Silvanus", houseId: "ursus", blessing: "+12 max health" },
  { id: "vulcan", name: "Vulcan", houseId: "rhinoceros", blessing: "+1.5 defense" },
  { id: "fortuna", name: "Fortuna", houseId: "elephas", blessing: "+20% denarii from arena wins" },
];

export const SHRINE_NICHES: { id: PatronId; tx: number; ty: number }[] = [
  { id: "mercury", tx: 2, ty: 21 },
  { id: "diana", tx: 7, ty: 21 },
  { id: "hercules", tx: 12, ty: 21 },
  { id: "mars", tx: 2, ty: 28 },
  { id: "nemesis", tx: 7, ty: 28 },
  { id: "victoria", tx: 12, ty: 28 },
  { id: "silvanus", tx: 13, ty: 22 },
  { id: "vulcan", tx: 13, ty: 27 },
  { id: "fortuna", tx: 13, ty: 24 },
];

export function getPatron(id: string | null | undefined): PatronDef | undefined {
  if (!id) return undefined;
  return PATRONS.find((p) => p.id === id);
}

export function patronUnlocked(id: string): boolean {
  const p = getPatron(id);
  if (!p) return false;
  if (!p.houseId) return true;
  const s = gameState.save;
  return s.defeatedHouses.includes(p.houseId) || s.playerHouse === p.houseId;
}

export function patronLockHint(p: PatronDef): string {
  if (!p.houseId) return "";
  const house = getHouse(p.houseId);
  return `Beat the ${house?.animalName ?? "house"}.`;
}

export function applyPrayerStats(stats: FighterStats): FighterStats {
  const id = gameState.save.activePrayer;
  if (id === "lares") stats.maxStamina += 8;
  else if (id === "mercury") stats.agility += 1.5;
  else if (id === "hercules") stats.attack += 2;
  else if (id === "mars") {
    stats.attack += 1.5;
    stats.defense += 1;
  } else if (id === "silvanus") stats.maxHealth += 12;
  else if (id === "vulcan") stats.defense += 1.5;
  return stats;
}

export function prayerMoveSpeed(): number {
  return gameState.save.activePrayer === "diana" ? 14 : 0;
}

export function prayerDodgeIframes(): number {
  return gameState.save.activePrayer === "diana" ? 60 : 0;
}

export function prayerHudLine(): string {
  const p = getPatron(gameState.save.activePrayer);
  return p ? `${p.name} walks with you` : "";
}

function prayerVitals(id: string | null): { maxHealth: number; maxStamina: number } {
  const s = gameState.save;
  let maxHealth = s.stats.maxHealth - (s.injured ? 8 : 0);
  let maxStamina = s.stats.maxStamina;
  if (id === "silvanus") maxHealth += 12;
  if (id === "lares") maxStamina += 8;
  return { maxHealth, maxStamina };
}

export function prayTo(id: PatronId): boolean {
  if (!patronUnlocked(id)) return false;
  const s = gameState.save;
  const next = prayerVitals(id);
  s.activePrayer = id;
  s.health = Math.min(s.health, next.maxHealth);
  s.stamina = Math.min(s.stamina, next.maxStamina);
  gameState.persist();
  bus.emit("skills-changed");
  bus.emit("toast", `${getPatron(id)!.name} walks with you.`);
  return true;
}

export function clearPrayer(): void {
  if (!gameState.save.activePrayer) return;
  gameState.save.activePrayer = null;
  const next = prayerVitals(null);
  gameState.save.health = Math.min(gameState.save.health, next.maxHealth);
  gameState.save.stamina = Math.min(gameState.save.stamina, next.maxStamina);
  bus.emit("skills-changed");
}
