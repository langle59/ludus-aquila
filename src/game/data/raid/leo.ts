import { brazierPuzzle, cell, makeGuard, prop, type RaidDef, type RaidRoomDef } from "./types";

const LION = 0xc49a28;

/** Leo — 7 rooms, pride pressure + roar pulse. */
export const LEO_ROOMS: RaidRoomDef[] = [
  {
    id: "leo_yard",
    name: "Pride Yard",
    kind: "combat",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-stone",
    props: [prop("shieldstand", 6, 4), prop("brazier", 11, 3), prop("brazier", 11, 13), prop("rack", 16, 4)],
    guards: [
      makeGuard("ly_g1", "Pride Guard", "spear", "spear", { maxHealth: 112, maxStamina: 80, attack: 13, defense: 8, agility: 6 }, LION, {
        roarPulse: true,
        at: [16, 5],
      }),
      makeGuard("ly_g2", "Yard Shield", "gladius", "defensive", { maxHealth: 115, maxStamina: 75, attack: 12, defense: 10, agility: 5 }, LION, {
        at: [18, 8],
      }),
      makeGuard("ly_g3", "Mane Watch", "spear", "spear", { maxHealth: 110, maxStamina: 80, attack: 13, defense: 7, agility: 6 }, LION, {
        roarPulse: true,
        at: [16, 11],
      }),
    ],
    doors: [{ to: "leo_wall", ...cell(20, 8), label: "Shield Wall", requiresClear: true }],
  },
  {
    id: "leo_wall",
    name: "Shield Wall",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [
      prop("shieldstand", 8, 3),
      prop("shieldstand", 12, 3),
      prop("shieldstand", 8, 10),
      prop("shieldstand", 12, 10),
      prop("brazier", 16, 7),
    ],
    guards: [
      makeGuard("lw_g1", "Wall Captain", "spear", "spear", { maxHealth: 125, maxStamina: 80, attack: 14, defense: 9, agility: 5 }, LION, {
        roarPulse: true,
        at: [12, 4],
      }),
      makeGuard("lw_g2", "Gold Shield", "gladius", "defensive", { maxHealth: 122, maxStamina: 75, attack: 13, defense: 11, agility: 5 }, LION, {
        at: [16, 5],
      }),
      makeGuard("lw_g3", "Wall Pike", "spear", "spear", { maxHealth: 118, maxStamina: 80, attack: 14, defense: 8, agility: 6 }, LION, {
        at: [12, 10],
      }),
      makeGuard("lw_g4", "Pride Net", "trident_net", "defensive", { maxHealth: 115, maxStamina: 75, attack: 12, defense: 9, agility: 5 }, LION, {
        roarPulse: true,
        at: [16, 9],
      }),
    ],
    doors: [
      { to: "leo_yard", ...cell(1, 7), label: "Yard" },
      { to: "leo_court", ...cell(18, 7), label: "Sun Court", requiresClear: true },
    ],
  },
  {
    id: "leo_court",
    name: "Sun Court",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [prop("brazier", 6, 3), prop("brazier", 14, 3), prop("brazier", 6, 10), prop("brazier", 14, 10), prop("shieldstand", 10, 6)],
    guards: [
      makeGuard("lc_g1", "Court Elite", "securis", "heavy", { maxHealth: 130, maxStamina: 75, attack: 15, defense: 9, agility: 5 }, LION, {
        roarPulse: true,
        at: [14, 5],
      }),
      makeGuard("lc_g2", "Gold Blade", "gladius", "aggressive", { maxHealth: 120, maxStamina: 85, attack: 15, defense: 7, agility: 8 }, LION, {
        at: [16, 7],
      }),
      makeGuard("lc_g3", "Court Spear", "spear", "spear", { maxHealth: 118, maxStamina: 80, attack: 14, defense: 8, agility: 7 }, LION, {
        roarPulse: true,
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "leo_wall", ...cell(1, 7), label: "Wall" },
      { to: "leo_cipher", ...cell(18, 7), label: "Pride Hearth", requiresClear: true },
    ],
  },
  {
    id: "leo_cipher",
    name: "Pride Hearth",
    kind: "puzzle",
    cols: 18,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [prop("shieldstand", 5, 2), prop("shieldstand", 13, 2)],
    guards: [],
    rest: cell(4, 9),
    puzzle: brazierPuzzle("Light the pride in order: west, north, east, south.", [
      [6, 5],
      [9, 3],
      [12, 5],
      [9, 7],
    ]),
    doors: [
      { to: "leo_court", ...cell(1, 6), label: "Court" },
      { to: "leo_hall", ...cell(16, 6), label: "Gold Hall", requiresClear: true },
    ],
  },
  {
    id: "leo_hall",
    name: "Gold Hall",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [prop("rack", 7, 3), prop("rack", 13, 3), prop("shieldstand", 10, 10), prop("brazier", 16, 7)],
    guards: [
      makeGuard("lh_g1", "Hall Pride", "spear", "spear", { maxHealth: 128, maxStamina: 85, attack: 15, defense: 9, agility: 6 }, LION, {
        roarPulse: true,
        at: [14, 4],
      }),
      makeGuard("lh_g2", "Hall Shield", "gladius", "defensive", { maxHealth: 125, maxStamina: 80, attack: 14, defense: 11, agility: 5 }, LION, {
        at: [16, 7],
      }),
      makeGuard("lh_g3", "Hall Axe", "securis", "heavy", { maxHealth: 132, maxStamina: 70, attack: 16, defense: 9, agility: 4 }, LION, {
        roarPulse: true,
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "leo_cipher", ...cell(1, 7), label: "Pride Hearth" },
      { to: "leo_throne", ...cell(18, 7), label: "Throne Approach", requiresClear: true },
    ],
  },
  {
    id: "leo_throne",
    name: "Throne Approach",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-stone",
    props: [
      prop("shieldstand", 6, 3),
      prop("shieldstand", 14, 3),
      prop("shieldstand", 6, 10),
      prop("shieldstand", 14, 10),
      prop("brazier", 10, 6),
    ],
    guards: [
      makeGuard("lt_g1", "Throne Elite", "malleus", "heavy", { maxHealth: 140, maxStamina: 70, attack: 16, defense: 10, agility: 4 }, LION, {
        roarPulse: true,
        at: [12, 4],
      }),
      makeGuard("lt_g2", "Gold Pike", "spear", "spear", { maxHealth: 125, maxStamina: 85, attack: 15, defense: 9, agility: 7 }, LION, {
        roarPulse: true,
        at: [16, 5],
      }),
      makeGuard("lt_g3", "Approach Shield", "gladius", "defensive", { maxHealth: 128, maxStamina: 80, attack: 14, defense: 12, agility: 5 }, LION, {
        at: [12, 10],
      }),
      makeGuard("lt_g4", "Pride Blade", "securis", "aggressive", { maxHealth: 122, maxStamina: 85, attack: 15, defense: 8, agility: 7 }, LION, {
        at: [16, 9],
      }),
    ],
    doors: [
      { to: "leo_hall", ...cell(1, 7), label: "Hall" },
      { to: "leo_boss", ...cell(18, 7), label: "Captain's Pride", requiresClear: true },
    ],
  },
  {
    id: "leo_boss",
    name: "Captain's Pride",
    kind: "boss",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-stone",
    props: [
      prop("shieldstand", 5, 3),
      prop("shieldstand", 17, 3),
      prop("brazier", 5, 13),
      prop("brazier", 17, 13),
      prop("shieldstand", 11, 4),
    ],
    guards: [],
    boss: makeGuard(
      "leo_captain",
      "Captain Leonis",
      "spear",
      "champion",
      { maxHealth: 285, maxStamina: 110, attack: 19, defense: 12, agility: 7 },
      0xa07818,
      { roarPulse: true, at: [16, 8] },
    ),
    doors: [{ to: "leo_throne", ...cell(1, 8), label: "Approach" }],
  },
];

export const LEO_RAID: RaidDef = {
  houseId: "leo",
  startRoom: "leo_yard",
  rooms: LEO_ROOMS,
  alertMode: "pack",
  torchTint: 0xe0b858,
  nightTint: 0x241808,
  victory: {
    title: "Leo Freed",
    body: "The pride kneels to no captain.",
  },
};
