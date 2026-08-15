import type { SaveData } from "../types";
import { gameState } from "../state/GameState";

export type PalTier = 1 | 2 | 3 | 4;

export function palUnlocked(save: SaveData = gameState.save): boolean {
  return Boolean(save.palUnlocked) || save.defeatedHouses.length >= 1;
}

export function palTier(save: SaveData = gameState.save): PalTier {
  const n = save.defeatedHouses.length;
  if (save.freedomWon || n >= 7) return 4;
  if (n >= 5) return 3;
  if (n >= 3) return 2;
  return 1;
}

export function palTitle(tier: PalTier): string {
  if (tier === 1) return "Hatchling";
  if (tier === 2) return "Aquila";
  if (tier === 3) return "War Eagle";
  return "Aquila Rex";
}

export function palBrought(save: SaveData = gameState.save): boolean {
  return palUnlocked(save) && save.palBrought !== false;
}

export function palNextHint(save: SaveData = gameState.save): string {
  const tier = palTier(save);
  if (tier === 1) return "Beat 3 houses and it grows.";
  if (tier === 2) return "Beat 5 houses and it hardens.";
  if (tier === 3) return "Take the rest of the circuit, or the Rudis, and it becomes legend.";
  return "It has grown as far as a yard bird can.";
}

export function togglePalBrought(): boolean {
  const s = gameState.save;
  if (!palUnlocked(s)) return false;
  s.palBrought = s.palBrought === false;
  gameState.persist();
  return palBrought(s);
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
