import type { AiStyle, FarmCropId, FighterStats, RaidHouseId, VolunteerId, WeaponId } from "../types";
import { camp } from "./camp";
import { getHouse } from "./houses";
import { raidHouseShortName } from "./raid";
import { getRefugee, refugeesForHouse } from "./refugees";

export type VolunteerCombatDef = {
  id: VolunteerId;
  houseId: RaidHouseId;
  name: string;
  tunic: number;
  accent: number;
  scale: number;
  weapon: WeaponId;
  aiStyle: AiStyle;
  stats: FighterStats;
  ambush?: boolean;
  hornCharge?: boolean;
  roarPulse?: boolean;
  armor?: boolean;
};

const HOUSE_COMBAT: Record<
  RaidHouseId,
  Pick<VolunteerCombatDef, "weapon" | "aiStyle" | "stats" | "ambush" | "hornCharge" | "roarPulse" | "armor">
> = {
  serpens: {
    weapon: "spear",
    aiStyle: "spear",
    stats: { maxHealth: 88, maxStamina: 72, attack: 10, defense: 6, agility: 7 },
  },
  lupus: {
    weapon: "dual_blades",
    aiStyle: "aggressive",
    stats: { maxHealth: 82, maxStamina: 78, attack: 11, defense: 4, agility: 10 },
  },
  aper: {
    weapon: "securis",
    aiStyle: "heavy",
    stats: { maxHealth: 95, maxStamina: 65, attack: 12, defense: 7, agility: 4 },
    hornCharge: true,
  },
  taurus: {
    weapon: "securis",
    aiStyle: "heavy",
    stats: { maxHealth: 100, maxStamina: 68, attack: 13, defense: 8, agility: 4 },
    hornCharge: true,
  },
  tigris: {
    weapon: "dual_blades",
    aiStyle: "aggressive",
    stats: { maxHealth: 86, maxStamina: 80, attack: 12, defense: 4, agility: 11 },
    ambush: true,
  },
  leo: {
    weapon: "spear",
    aiStyle: "defensive",
    stats: { maxHealth: 92, maxStamina: 75, attack: 11, defense: 9, agility: 6 },
    roarPulse: true,
  },
  ursus: {
    weapon: "malleus",
    aiStyle: "heavy",
    stats: { maxHealth: 110, maxStamina: 62, attack: 14, defense: 9, agility: 3 },
    armor: true,
  },
  rhinoceros: {
    weapon: "securis",
    aiStyle: "heavy",
    stats: { maxHealth: 108, maxStamina: 64, attack: 14, defense: 10, agility: 3 },
    hornCharge: true,
    armor: true,
  },
  elephas: {
    weapon: "malleus",
    aiStyle: "heavy",
    stats: { maxHealth: 115, maxStamina: 60, attack: 15, defense: 10, agility: 3 },
    armor: true,
  },
};

export function volunteerHouseId(id: string): RaidHouseId | null {
  const m = id.match(/^refugee-(.+)-\d+$/);
  if (!m) return null;
  const hid = m[1] as RaidHouseId;
  return HOUSE_COMBAT[hid] ? hid : null;
}

export function volunteerIdsForHouse(houseId: string): VolunteerId[] {
  return refugeesForHouse(houseId).map((r) => r.id);
}

export function unlockHouseVolunteers(houseId: string): boolean {
  const c = camp();
  let added = false;
  for (const id of volunteerIdsForHouse(houseId)) {
    if (!c.volunteersUnlocked.includes(id)) {
      c.volunteersUnlocked.push(id);
      added = true;
    }
  }
  return added;
}

export function backfillVolunteersFromFreedPads(freedPads: string[]): VolunteerId[] {
  const ids: VolunteerId[] = [];
  for (const hid of freedPads) {
    for (const id of volunteerIdsForHouse(hid)) {
      if (!ids.includes(id)) ids.push(id);
    }
  }
  return ids;
}

export function getVolunteerDef(id: VolunteerId): VolunteerCombatDef | undefined {
  const refugee = getRefugee(id);
  const houseId = volunteerHouseId(id);
  if (!refugee || !houseId) return undefined;
  const combat = HOUSE_COMBAT[houseId];
  return {
    id,
    houseId,
    name: refugee.name,
    tunic: refugee.tunic,
    accent: refugee.accent,
    scale: refugee.scale,
    ...combat,
  };
}

export function setHouseVolunteer(id: VolunteerId | null): void {
  const c = camp();
  if (!id) {
    c.houseVolunteer = null;
    return;
  }
  if (c.volunteersUnlocked.includes(id)) c.houseVolunteer = id;
}

export function volunteerUnlockLabel(houseId: string): string {
  const latin = getHouse(houseId)?.latinName ?? houseId;
  return `Two volunteers from ${latin.replace(/^Ludus\s+/i, "Ludus ")} join the camp.`;
}

export function volunteersGroupedByHouse(): { houseId: RaidHouseId; ids: VolunteerId[] }[] {
  const c = camp();
  const map = new Map<RaidHouseId, VolunteerId[]>();
  for (const id of c.volunteersUnlocked) {
    const hid = volunteerHouseId(id);
    if (!hid) continue;
    const list = map.get(hid) ?? [];
    list.push(id);
    map.set(hid, list);
  }
  return Array.from(map.entries()).map(([houseId, ids]) => ({ houseId, ids }));
}

export function volunteerDisplayLine(id: VolunteerId | null): string {
  if (!id) return "none";
  const def = getVolunteerDef(id);
  if (!def) return "none";
  return `${def.name} (${raidHouseShortName(def.houseId)})`;
}

export function volunteerBriefingLine(raidHouseId: string): string | null {
  const vid = camp().houseVolunteer;
  if (!vid) return null;
  const def = getVolunteerDef(vid);
  if (!def || def.houseId !== raidHouseId) return null;
  return `"${def.name} knows this house — stay close."`;
}

const FORAGER_HOUSES = new Set<RaidHouseId>(["serpens", "lupus"]);

/** Serpens/Lupus volunteer may forage extra pantry after a successful raid outing. */
export function tryVolunteerForager(): string | null {
  const c = camp();
  if (!c.houseVolunteer) return null;
  const def = getVolunteerDef(c.houseVolunteer);
  if (!def || !FORAGER_HOUSES.has(def.houseId)) return null;
  if (Math.random() > 0.3) return null;
  const houses = c.freedPads.length;
  const options: FarmCropId[] = ["barley", "olives"];
  if (houses >= 3) options.push("chicken");
  if (houses >= 6) options.push("honey");
  const cropId = options[Math.floor(Math.random() * options.length)]!;
  const row = c.farm.pantry.find((p) => p.cropId === cropId);
  if (row) row.count += 1;
  else c.farm.pantry.push({ cropId, count: 1 });
  return `${def.name} foraged extra provisions.`;
}
