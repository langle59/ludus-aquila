import type { RivalFighterDef, SchoolNpcId } from "../types";

/** One fixed ladder per student: Prospect → Contender → Pride (glory on 3rd). */
export interface StudentCircuit {
  npcId: SchoolNpcId;
  /** Arena / crowd flavor house. */
  flavorHouseId: string;
  label: string;
  fighters: RivalFighterDef[];
}

function schoolFoe(
  id: string,
  name: string,
  title: string,
  weapon: RivalFighterDef["weapon"],
  aiStyle: RivalFighterDef["aiStyle"],
  isChampion: boolean,
  color: number,
  stats: RivalFighterDef["stats"],
  animal: string,
): RivalFighterDef {
  return {
    id,
    name,
    title,
    weapon,
    aiStyle,
    isChampion,
    color,
    scale: isChampion ? 1.1 : 1.02,
    stats,
    intro: [`A ${animal} school fighter takes the sand.`, `"Your student. Our yard."`],
    victory: [`${name} yields.`, `"Tell your lanista the school remembers."`],
    defeat: [`${name} stands over them.`, `"Send better steel next time."`],
    rewards: { denarii: isChampion ? 90 : 45, xp: isChampion ? 120 : 60 },
  };
}

/** Titus — shield / defense path. Brom — power. Aelia — footwork. Rufus — dodge. */
const STUDENT_CARDS: StudentCircuit[] = [
  {
    npcId: "titus",
    flavorHouseId: "taurus",
    label: "Shield circuit",
    fighters: [
      schoolFoe("school_titus_1", "Pavise", "Prospect", "gladius", "defensive", false, 0x6a5030, { maxHealth: 92, maxStamina: 82, attack: 9, defense: 8, agility: 5 }, "Bull"),
      schoolFoe("school_titus_2", "Scutum", "Contender", "gladius", "defensive", false, 0x5a4020, { maxHealth: 110, maxStamina: 88, attack: 10, defense: 10, agility: 5 }, "Bull"),
      schoolFoe("school_titus_pride", "Wall of Capua", "Pride", "gladius", "champion", true, 0x3a2810, { maxHealth: 136, maxStamina: 94, attack: 12, defense: 12, agility: 6 }, "Bull"),
    ],
  },
  {
    npcId: "brom",
    flavorHouseId: "aper",
    label: "Power circuit",
    fighters: [
      schoolFoe("school_brom_1", "Maul", "Prospect", "securis", "heavy", false, 0x6a4030, { maxHealth: 98, maxStamina: 80, attack: 11, defense: 7, agility: 4 }, "Boar"),
      schoolFoe("school_brom_2", "Breaker", "Contender", "securis", "heavy", false, 0x5a3020, { maxHealth: 118, maxStamina: 84, attack: 13, defense: 8, agility: 4 }, "Boar"),
      schoolFoe("school_brom_pride", "Axe of the Yard", "Pride", "securis", "champion", true, 0x3a2010, { maxHealth: 142, maxStamina: 90, attack: 15, defense: 9, agility: 5 }, "Boar"),
    ],
  },
  {
    npcId: "aelia",
    flavorHouseId: "tigris",
    label: "Footwork circuit",
    fighters: [
      schoolFoe("school_aelia_1", "Flick", "Prospect", "dual_blades", "aggressive", false, 0x8a5020, { maxHealth: 88, maxStamina: 90, attack: 10, defense: 5, agility: 10 }, "Tiger"),
      schoolFoe("school_aelia_2", "Measure", "Contender", "dual_blades", "aggressive", false, 0x7a4010, { maxHealth: 106, maxStamina: 96, attack: 12, defense: 6, agility: 11 }, "Tiger"),
      schoolFoe("school_aelia_pride", "Clean Cut", "Pride", "dual_blades", "champion", true, 0x5a2808, { maxHealth: 128, maxStamina: 102, attack: 14, defense: 7, agility: 13 }, "Tiger"),
    ],
  },
  {
    npcId: "rufus",
    flavorHouseId: "lupus",
    label: "Dodge circuit",
    fighters: [
      schoolFoe("school_rufus_1", "Slip", "Prospect", "dual_blades", "aggressive", false, 0x5a5a68, { maxHealth: 90, maxStamina: 92, attack: 10, defense: 5, agility: 9 }, "Wolf"),
      schoolFoe("school_rufus_2", "Veil", "Contender", "dual_blades", "aggressive", false, 0x4a4a58, { maxHealth: 108, maxStamina: 98, attack: 12, defense: 6, agility: 11 }, "Wolf"),
      schoolFoe("school_rufus_pride", "Ghost of the Rail", "Pride", "dual_blades", "champion", true, 0x2a2a38, { maxHealth: 130, maxStamina: 104, attack: 14, defense: 7, agility: 13 }, "Wolf"),
    ],
  },
];

const BY_NPC = new Map<SchoolNpcId, StudentCircuit>();
const BY_ID = new Map<string, { npcId: SchoolNpcId; flavorHouseId: string; fighter: RivalFighterDef; rung: number }>();

for (const card of STUDENT_CARDS) {
  BY_NPC.set(card.npcId, card);
  card.fighters.forEach((f, i) => {
    BY_ID.set(f.id, { npcId: card.npcId, flavorHouseId: card.flavorHouseId, fighter: f, rung: i });
  });
}

export function getStudentCircuit(npcId: string): StudentCircuit | undefined {
  return BY_NPC.get(npcId as SchoolNpcId);
}

/** @deprecated Use getStudentCircuit — kept for any house-id lookups during migration. */
export function getSchoolCircuit(houseId: string): StudentCircuit | undefined {
  return STUDENT_CARDS.find((c) => c.flavorHouseId === houseId);
}

export function getSchoolCircuitFighter(id: string): { houseId: string; fighter: RivalFighterDef; npcId?: SchoolNpcId; rung?: number } | undefined {
  const hit = BY_ID.get(id);
  if (!hit) return undefined;
  return { houseId: hit.flavorHouseId, fighter: hit.fighter, npcId: hit.npcId, rung: hit.rung };
}

export function isSchoolCircuitId(id: string): boolean {
  return BY_ID.has(id);
}

export function schoolCircuitRungLabel(rung: number): string {
  if (rung <= 0) return "Prospect";
  if (rung === 1) return "Contender";
  return "Pride";
}
