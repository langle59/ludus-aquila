import { cell, makeGuard, prop, rubble, stampede, timingPuzzle, type RaidDef, type RaidRoomDef } from "./types";

const RHINO = 0x6a6870;

/** Rhinoceros — 8 rooms, hardened horn charge + armor, narrow gore corridors. */
export const RHINOCEROS_ROOMS: RaidRoomDef[] = [
  {
    id: "rhi_yard",
    name: "Grey Yard",
    kind: "combat",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-stone",
    props: [prop("pit-horn", 5, 3), prop("pit-tusk", 17, 3), prop("fence", 11, 5), prop("brazier", 11, 13)],
    guards: [
      makeGuard("ry_g1", "Grey Guard", "securis", "heavy", { maxHealth: 135, maxStamina: 65, attack: 16, defense: 11, agility: 3 }, RHINO, {
        hornCharge: true,
        armor: true,
        at: [16, 5],
      }),
      makeGuard("ry_g2", "Yard Hide", "malleus", "heavy", { maxHealth: 140, maxStamina: 60, attack: 16, defense: 12, agility: 2 }, RHINO, {
        armor: true,
        at: [18, 8],
      }),
      makeGuard("ry_g3", "Stone Watch", "spear", "spear", { maxHealth: 120, maxStamina: 75, attack: 14, defense: 8, agility: 5 }, RHINO, {
        at: [16, 11],
      }),
    ],
    doors: [{ to: "rhi_gore", ...cell(20, 8), label: "Gore Corridor", requiresClear: true }],
  },
  {
    id: "rhi_gore",
    name: "Gore Corridor",
    kind: "combat",
    cols: 18,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [
      prop("fence", 6, 3),
      prop("fence", 6, 10),
      prop("fence", 10, 3),
      prop("fence", 10, 10),
      prop("pit-horn", 14, 4),
      prop("pit-tusk", 14, 9),
    ],
    hazards: [rubble(9, 6, 3, 3)],
    guards: [
      makeGuard("rg_g1", "Gore Rusher", "securis", "heavy", { maxHealth: 145, maxStamina: 65, attack: 17, defense: 11, agility: 3 }, RHINO, {
        hornCharge: true,
        armor: true,
        at: [10, 4],
      }),
      makeGuard("rg_g2", "Corridor Horn", "securis", "heavy", { maxHealth: 140, maxStamina: 65, attack: 16, defense: 11, agility: 3 }, RHINO, {
        hornCharge: true,
        armor: true,
        at: [14, 5],
      }),
      makeGuard("rg_g3", "Hide Wall", "malleus", "heavy", { maxHealth: 150, maxStamina: 60, attack: 16, defense: 13, agility: 2 }, RHINO, {
        armor: true,
        at: [10, 10],
      }),
      makeGuard("rg_g4", "Narrow Pike", "spear", "spear", { maxHealth: 122, maxStamina: 75, attack: 14, defense: 8, agility: 5 }, RHINO, {
        at: [14, 9],
      }),
    ],
    doors: [
      { to: "rhi_yard", ...cell(1, 7), label: "Yard" },
      { to: "rhi_pens", ...cell(16, 7), label: "Hide Pens", requiresClear: true },
    ],
  },
  {
    id: "rhi_pens",
    name: "Hide Pens",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [prop("hay", 4, 3), prop("hay", 4, 10), prop("pit-horn", 16, 4), prop("pit-tusk", 16, 9), prop("fence", 10, 6)],
    guards: [
      makeGuard("rp_g1", "Pen Warden", "malleus", "heavy", { maxHealth: 155, maxStamina: 60, attack: 17, defense: 13, agility: 2 }, RHINO, {
        armor: true,
        at: [12, 5],
      }),
      makeGuard("rp_g2", "Pen Horn", "securis", "heavy", { maxHealth: 145, maxStamina: 65, attack: 17, defense: 11, agility: 3 }, RHINO, {
        hornCharge: true,
        armor: true,
        at: [16, 7],
      }),
      makeGuard("rp_g3", "Pen Spear", "spear", "spear", { maxHealth: 125, maxStamina: 80, attack: 14, defense: 8, agility: 6 }, RHINO, {
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "rhi_gore", ...cell(1, 7), label: "Gore" },
      { to: "rhi_cipher", ...cell(18, 7), label: "Plate Gates", requiresClear: true },
    ],
  },
  {
    id: "rhi_cipher",
    name: "Plate Gates",
    kind: "puzzle",
    cols: 18,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [prop("pit-horn", 4, 2), prop("pit-tusk", 14, 2), prop("shieldstand", 9, 9)],
    hazards: [stampede(6, 4, 8, 4, "x", 2600)],
    guards: [],
    rest: cell(4, 9),
    puzzle: timingPuzzle("plates", "Cross when the plates open. Reach the far pad.", {
      goal: [14, 6],
    }),
    doors: [
      { to: "rhi_pens", ...cell(1, 6), label: "Pens" },
      { to: "rhi_armory", ...cell(16, 6), label: "Plate Armory", requiresClear: true },
    ],
  },
  {
    id: "rhi_armory",
    name: "Plate Armory",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-stone",
    props: [prop("rack", 8, 3), prop("rack", 12, 3), prop("shieldstand", 10, 10), prop("pit-horn", 16, 5)],
    guards: [
      makeGuard("ra_g1", "Plate Chief", "malleus", "heavy", { maxHealth: 160, maxStamina: 60, attack: 18, defense: 14, agility: 2 }, RHINO, {
        armor: true,
        at: [14, 4],
      }),
      makeGuard("ra_g2", "Plate Horn", "securis", "heavy", { maxHealth: 150, maxStamina: 65, attack: 17, defense: 12, agility: 3 }, RHINO, {
        hornCharge: true,
        armor: true,
        at: [16, 7],
      }),
      makeGuard("ra_g3", "Plate Pike", "spear", "spear", { maxHealth: 128, maxStamina: 80, attack: 14, defense: 9, agility: 5 }, RHINO, {
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "rhi_cipher", ...cell(1, 7), label: "Plate Gates" },
      { to: "rhi_narrow", ...cell(18, 7), label: "Narrow Gore", requiresClear: true },
    ],
  },
  {
    id: "rhi_narrow",
    name: "Narrow Gore",
    kind: "combat",
    cols: 16,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [
      prop("fence", 5, 3),
      prop("fence", 5, 10),
      prop("fence", 8, 3),
      prop("fence", 8, 10),
      prop("pit-horn", 12, 4),
      prop("pit-tusk", 12, 9),
    ],
    guards: [
      makeGuard("rn_g1", "Narrow Rusher", "securis", "heavy", { maxHealth: 155, maxStamina: 65, attack: 18, defense: 12, agility: 3 }, RHINO, {
        hornCharge: true,
        armor: true,
        at: [8, 4],
      }),
      makeGuard("rn_g2", "Narrow Hide", "malleus", "heavy", { maxHealth: 160, maxStamina: 60, attack: 17, defense: 14, agility: 2 }, RHINO, {
        armor: true,
        at: [12, 5],
      }),
      makeGuard("rn_g3", "Narrow Shield", "gladius", "defensive", { maxHealth: 140, maxStamina: 75, attack: 14, defense: 13, agility: 4 }, RHINO, {
        armor: true,
        at: [8, 10],
      }),
      makeGuard("rn_g4", "Narrow Pike", "spear", "spear", { maxHealth: 130, maxStamina: 80, attack: 15, defense: 9, agility: 5 }, RHINO, {
        at: [12, 9],
      }),
    ],
    doors: [
      { to: "rhi_armory", ...cell(1, 7), label: "Armory" },
      { to: "rhi_approach", ...cell(14, 7), label: "Captain Approach", requiresClear: true },
    ],
  },
  {
    id: "rhi_approach",
    name: "Captain Approach",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [prop("fence", 8, 3), prop("fence", 8, 10), prop("pit-horn", 14, 4), prop("pit-tusk", 14, 9), prop("brazier", 16, 7)],
    guards: [
      makeGuard("rap_g1", "Approach Horn", "securis", "heavy", { maxHealth: 158, maxStamina: 65, attack: 18, defense: 12, agility: 3 }, RHINO, {
        hornCharge: true,
        armor: true,
        at: [14, 4],
      }),
      makeGuard("rap_g2", "Approach Plate", "malleus", "heavy", { maxHealth: 162, maxStamina: 60, attack: 18, defense: 14, agility: 2 }, RHINO, {
        armor: true,
        at: [16, 7],
      }),
      makeGuard("rap_g3", "Approach Pike", "spear", "spear", { maxHealth: 132, maxStamina: 80, attack: 15, defense: 9, agility: 5 }, RHINO, {
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "rhi_narrow", ...cell(1, 7), label: "Narrow" },
      { to: "rhi_boss", ...cell(18, 7), label: "Captain's Hide", requiresClear: true },
    ],
  },
  {
    id: "rhi_boss",
    name: "Captain's Hide",
    kind: "boss",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-stone",
    props: [
      prop("pit-horn", 5, 3),
      prop("pit-tusk", 17, 3),
      prop("pit-horn", 5, 13),
      prop("pit-tusk", 17, 13),
      prop("fence", 11, 4),
      prop("brazier", 11, 13),
    ],
    guards: [],
    boss: makeGuard(
      "rhinoceros_captain",
      "Captain Rhinus",
      "securis",
      "champion",
      { maxHealth: 335, maxStamina: 105, attack: 21, defense: 15, agility: 4 },
      0x4a4850,
      { hornCharge: true, armor: true, at: [16, 8] },
    ),
    doors: [{ to: "rhi_approach", ...cell(1, 8), label: "Approach" }],
  },
];

export const RHINOCEROS_RAID: RaidDef = {
  houseId: "rhinoceros",
  startRoom: "rhi_yard",
  rooms: RHINOCEROS_ROOMS,
  alertMode: "ripple",
  torchTint: 0xa0a098,
  nightTint: 0x141418,
  victory: {
    title: "Rhinoceros Freed",
    body: "The hide cracks. The road opens east.",
  },
};
