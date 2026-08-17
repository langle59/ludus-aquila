import type { RaidHouseId } from "../../types";
import { getHouse } from "../houses";
import { APER_RAID } from "./aper";
import type { RaidBriefing } from "./briefings";
import {
  APER_BRIEFINGS,
  ELEPHAS_BRIEFINGS,
  getBriefingFromMap,
  LEO_BRIEFINGS,
  LUPUS_BRIEFINGS,
  RHINOCEROS_BRIEFINGS,
  SERPENS_BRIEFINGS,
  TAURUS_BRIEFINGS,
  TIGRIS_BRIEFINGS,
  URSUS_BRIEFINGS,
} from "./briefings";
import { ELEPHAS_RAID } from "./elephas";
import { LEO_RAID } from "./leo";
import { LUPUS_RAID } from "./lupus";
import { RHINOCEROS_RAID } from "./rhinoceros";
import { SERPENS_RAID } from "./serpens";
import { TAURUS_RAID } from "./taurus";
import { TIGRIS_RAID } from "./tigris";
import { URSUS_RAID } from "./ursus";
import type { RaidDef, RaidRoomDef } from "./types";

const RAIDS: Record<string, RaidDef> = {
  serpens: SERPENS_RAID,
  lupus: LUPUS_RAID,
  aper: APER_RAID,
  taurus: TAURUS_RAID,
  tigris: TIGRIS_RAID,
  leo: LEO_RAID,
  ursus: URSUS_RAID,
  rhinoceros: RHINOCEROS_RAID,
  elephas: ELEPHAS_RAID,
};

const BRIEFINGS: Record<string, Record<string, RaidBriefing>> = {
  serpens: SERPENS_BRIEFINGS,
  lupus: LUPUS_BRIEFINGS,
  aper: APER_BRIEFINGS,
  taurus: TAURUS_BRIEFINGS,
  tigris: TIGRIS_BRIEFINGS,
  leo: LEO_BRIEFINGS,
  ursus: URSUS_BRIEFINGS,
  rhinoceros: RHINOCEROS_BRIEFINGS,
  elephas: ELEPHAS_BRIEFINGS,
};

/** March order for Act 4 night raids. */
export const RAID_HOUSE_ORDER: RaidHouseId[] = [
  "serpens",
  "lupus",
  "aper",
  "taurus",
  "tigris",
  "leo",
  "ursus",
  "rhinoceros",
  "elephas",
];

const BOSS_REWARDS: Record<string, { denarii: number; xp: number }> = {
  serpens: { denarii: 80, xp: 120 },
  lupus: { denarii: 100, xp: 140 },
  aper: { denarii: 120, xp: 160 },
  taurus: { denarii: 140, xp: 180 },
  tigris: { denarii: 155, xp: 195 },
  leo: { denarii: 170, xp: 210 },
  ursus: { denarii: 185, xp: 225 },
  rhinoceros: { denarii: 200, xp: 240 },
  elephas: { denarii: 220, xp: 260 },
};

export function bossRaidReward(houseId: string, rematch = false): { denarii: number; xp: number } {
  const base = BOSS_REWARDS[houseId] ?? { denarii: 80, xp: 120 };
  if (!rematch) return base;
  return { denarii: Math.round(base.denarii * 0.5), xp: Math.round(base.xp * 0.5) };
}

export function getRaid(houseId: string): RaidDef | undefined {
  return RAIDS[houseId];
}

export function getRaidRoom(houseId: string, roomId: string): RaidRoomDef | undefined {
  return getRaid(houseId)?.rooms.find((r) => r.id === roomId);
}

export function raidRoomOrder(houseId: string): string[] {
  return getRaid(houseId)?.rooms.map((r) => r.id) ?? [];
}

export function getRaidBriefing(houseId: string, roomId: string): RaidBriefing {
  return getBriefingFromMap(BRIEFINGS[houseId], roomId);
}

export function nextUnlockedRaidHouse(freedPads: string[]): RaidHouseId | null {
  for (const id of RAID_HOUSE_ORDER) {
    if (!freedPads.includes(id)) return id;
  }
  return null;
}

export function raidHouseShortName(id: string): string {
  return (getHouse(id)?.latinName ?? id).replace(/^Ludus\s+/i, "");
}

/** Freed houses plus the next unlocked target — what the march overlay can pick. */
export function marchableRaidHouses(freedPads: string[]): RaidHouseId[] {
  const next = nextUnlockedRaidHouse(freedPads);
  return RAID_HOUSE_ORDER.filter((id) => freedPads.includes(id) || id === next);
}

/** Whether the empty pad may be approached as the current night-raid target. */
export function isRaidHouseApproachable(id: RaidHouseId, freedPads: string[]): boolean {
  return nextUnlockedRaidHouse(freedPads) === id;
}

export {
  SERPENS_RAID,
  LUPUS_RAID,
  APER_RAID,
  TAURUS_RAID,
  TIGRIS_RAID,
  LEO_RAID,
  URSUS_RAID,
  RHINOCEROS_RAID,
  ELEPHAS_RAID,
};
export { getLiberation, liberationArriveFlag, liberationChainFlag, liberationFlag } from "./liberation";
export type { RaidDef, RaidRoomDef, RaidGuardDef, RaidAlertMode, RaidPuzzle, RaidFacing } from "./types";
