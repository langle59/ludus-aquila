import { cell, dark, makeGuard, prop, stepPathPuzzle, type RaidDef, type RaidRoomDef } from "./types";

const TIGER = 0xd46818;

/** Tigris — 7 rooms, dark zones + ambush stalkers. */
export const TIGRIS_ROOMS: RaidRoomDef[] = [
  {
    id: "tig_yard",
    name: "Stripe Yard",
    kind: "combat",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-stripe",
    props: [prop("hay", 6, 4), prop("pit-skull", 16, 3), prop("brazier", 11, 13)],
    hazards: [dark(12, 5, 6, 5)],
    guards: [
      makeGuard("ty_g1", "Stripe Watch", "gladius", "aggressive", { maxHealth: 100, maxStamina: 80, attack: 13, defense: 5, agility: 9 }, TIGER, {
        ambush: true,
        at: [16, 5],
      }),
      makeGuard("ty_g2", "Yard Stalker", "gladius", "aggressive", { maxHealth: 95, maxStamina: 85, attack: 12, defense: 4, agility: 10 }, TIGER, {
        ambush: true,
        at: [18, 9],
      }),
      makeGuard("ty_g3", "Torch Guard", "spear", "spear", { maxHealth: 105, maxStamina: 75, attack: 12, defense: 6, agility: 7 }, TIGER, {
        at: [14, 11],
      }),
    ],
    doors: [{ to: "tig_shadow", ...cell(20, 8), label: "Shadow Walk", requiresClear: true }],
  },
  {
    id: "tig_shadow",
    name: "Shadow Walk",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stripe",
    props: [prop("hay", 5, 3), prop("hay", 5, 10), prop("pit-skull", 15, 4), prop("pit-skull", 15, 9)],
    hazards: [dark(7, 3, 8, 4), dark(9, 8, 7, 4)],
    guards: [
      makeGuard("ts_g1", "Night Claw", "gladius", "aggressive", { maxHealth: 110, maxStamina: 85, attack: 14, defense: 5, agility: 10 }, TIGER, {
        ambush: true,
        at: [12, 4],
      }),
      makeGuard("ts_g2", "Dark Dual", "gladius", "aggressive", { maxHealth: 108, maxStamina: 85, attack: 14, defense: 4, agility: 11 }, TIGER, {
        ambush: true,
        at: [16, 6],
      }),
      makeGuard("ts_g3", "Shade Spear", "spear", "spear", { maxHealth: 105, maxStamina: 80, attack: 13, defense: 6, agility: 8 }, TIGER, {
        at: [12, 10],
      }),
      makeGuard("ts_g4", "Net Tiger", "trident_net", "defensive", { maxHealth: 110, maxStamina: 75, attack: 12, defense: 8, agility: 6 }, TIGER, {
        ambush: true,
        at: [16, 10],
      }),
    ],
    doors: [
      { to: "tig_yard", ...cell(1, 7), label: "Yard" },
      { to: "tig_dens", ...cell(18, 7), label: "Stripe Dens", requiresClear: true },
    ],
  },
  {
    id: "tig_dens",
    name: "Stripe Dens",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stripe",
    props: [prop("hay", 4, 4), prop("hay", 8, 4), prop("hay", 4, 9), prop("pit-skull", 16, 5)],
    hazards: [dark(10, 4, 6, 6)],
    guards: [
      makeGuard("td_g1", "Den Stalker", "securis", "aggressive", { maxHealth: 120, maxStamina: 75, attack: 15, defense: 6, agility: 8 }, TIGER, {
        ambush: true,
        at: [14, 5],
      }),
      makeGuard("td_g2", "Stripe Hand", "gladius", "aggressive", { maxHealth: 112, maxStamina: 85, attack: 14, defense: 5, agility: 10 }, TIGER, {
        ambush: true,
        at: [16, 8],
      }),
      makeGuard("td_g3", "Den Watch", "spear", "spear", { maxHealth: 108, maxStamina: 80, attack: 13, defense: 6, agility: 8 }, TIGER, {
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "tig_shadow", ...cell(1, 7), label: "Shadow" },
      { to: "tig_cipher", ...cell(18, 7), label: "Stripe Path", requiresClear: true },
    ],
  },
  {
    id: "tig_cipher",
    name: "Stripe Path",
    kind: "puzzle",
    cols: 18,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [prop("pit-skull", 4, 2), prop("hay", 14, 2)],
    guards: [],
    rest: cell(4, 9),
    puzzle: stepPathPuzzle(
      "Watch the gold flash. Then the stones forget.",
      5,
      3,
      8,
      5,
      [
        [0, 3],
        [1, 3],
        [1, 2],
        [1, 1],
        [2, 1],
        [3, 1],
        [3, 2],
        [4, 2],
        [5, 2],
        [5, 3],
        [6, 3],
        [7, 3],
      ],
      [7, 3],
      true,
    ),
    doors: [
      { to: "tig_dens", ...cell(1, 6), label: "Dens" },
      { to: "tig_ambush", ...cell(16, 6), label: "Ambush Hall", requiresClear: true },
    ],
  },
  {
    id: "tig_ambush",
    name: "Ambush Hall",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stripe",
    props: [prop("hay", 6, 3), prop("hay", 14, 3), prop("pit-skull", 10, 10), prop("brazier", 4, 11)],
    hazards: [dark(8, 3, 8, 5), dark(6, 9, 10, 3)],
    guards: [
      makeGuard("ta_g1", "Hall Claw", "gladius", "aggressive", { maxHealth: 118, maxStamina: 90, attack: 15, defense: 5, agility: 11 }, TIGER, {
        ambush: true,
        at: [14, 4],
      }),
      makeGuard("ta_g2", "Silent Dual", "gladius", "aggressive", { maxHealth: 115, maxStamina: 90, attack: 15, defense: 4, agility: 12 }, TIGER, {
        ambush: true,
        at: [16, 7],
      }),
      makeGuard("ta_g3", "Ambush Pike", "spear", "spear", { maxHealth: 112, maxStamina: 80, attack: 13, defense: 6, agility: 8 }, TIGER, {
        ambush: true,
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "tig_cipher", ...cell(1, 7), label: "Stripe Path" },
      { to: "tig_cells", ...cell(18, 7), label: "Holding Cells", requiresClear: true },
    ],
  },
  {
    id: "tig_cells",
    name: "Holding Cells",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-stone",
    props: [prop("rack", 8, 3), prop("pit-skull", 14, 3), prop("hay", 10, 10), prop("brazier", 6, 10)],
    hazards: [dark(11, 5, 5, 5)],
    guards: [
      makeGuard("tc_g1", "Cell Warden", "securis", "heavy", { maxHealth: 130, maxStamina: 70, attack: 15, defense: 8, agility: 5 }, TIGER, {
        at: [14, 4],
      }),
      makeGuard("tc_g2", "Cell Stalker", "gladius", "aggressive", { maxHealth: 120, maxStamina: 90, attack: 15, defense: 5, agility: 11 }, TIGER, {
        ambush: true,
        at: [16, 7],
      }),
      makeGuard("tc_g3", "Cell Spear", "spear", "spear", { maxHealth: 115, maxStamina: 80, attack: 13, defense: 7, agility: 8 }, TIGER, {
        at: [12, 10],
      }),
      makeGuard("tc_g4", "Night Net", "trident_net", "defensive", { maxHealth: 118, maxStamina: 75, attack: 12, defense: 9, agility: 6 }, TIGER, {
        ambush: true,
        at: [16, 10],
      }),
    ],
    doors: [
      { to: "tig_ambush", ...cell(1, 7), label: "Ambush" },
      { to: "tig_boss", ...cell(18, 7), label: "Captain's Den", requiresClear: true },
    ],
  },
  {
    id: "tig_boss",
    name: "Captain's Den",
    kind: "boss",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-stripe",
    props: [
      prop("pit-skull", 5, 3),
      prop("pit-skull", 17, 3),
      prop("hay", 5, 13),
      prop("hay", 17, 13),
      prop("brazier", 11, 4),
    ],
    hazards: [dark(10, 6, 8, 5)],
    guards: [],
    boss: makeGuard(
      "tigris_captain",
      "Captain Striata",
      "gladius",
      "champion",
      { maxHealth: 265, maxStamina: 110, attack: 19, defense: 9, agility: 10 },
      0xa04810,
      { ambush: true, at: [16, 8] },
    ),
    doors: [{ to: "tig_cells", ...cell(1, 8), label: "Cells" }],
  },
];

export const TIGRIS_RAID: RaidDef = {
  houseId: "tigris",
  startRoom: "tig_yard",
  rooms: TIGRIS_ROOMS,
  alertMode: "ripple",
  torchTint: 0x88a0c0,
  nightTint: 0x0a1020,
  victory: {
    title: "Tigris Freed",
    body: "The stripes fade into the trees.",
  },
};
