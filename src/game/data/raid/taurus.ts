import { cell, dark, makeGuard, prop, stepPathPuzzle, type RaidDef, type RaidRoomDef } from "./types";

const BULL = 0x8a2820;

/** Taurus — 7 rooms, horn-charge lanes, bull-red night. */
export const TAURUS_ROOMS: RaidRoomDef[] = [
  {
    id: "tau_yard",
    name: "Horn Yard",
    kind: "combat",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-earth",
    props: [
      prop("pit-horn", 5, 3),
      prop("pit-horn", 17, 3),
      prop("fence", 10, 4),
      prop("fence", 10, 12),
      prop("brazier", 11, 13),
    ],
    guards: [
      makeGuard("ty_g1", "Horn Guard", "securis", "heavy", { maxHealth: 108, maxStamina: 70, attack: 13, defense: 7, agility: 4 }, BULL, {
        hornCharge: true,
        at: [16, 5],
      }),
      makeGuard("ty_g2", "Yard Bull", "gladius", "aggressive", { maxHealth: 98, maxStamina: 75, attack: 12, defense: 5, agility: 7 }, BULL, {
        at: [18, 8],
      }),
      makeGuard("ty_g3", "Lane Watch", "spear", "spear", { maxHealth: 100, maxStamina: 75, attack: 12, defense: 6, agility: 6 }, BULL, {
        at: [16, 11],
      }),
    ],
    doors: [{ to: "tau_lanes", ...cell(20, 8), label: "Charge Lanes", requiresClear: true }],
  },
  {
    id: "tau_lanes",
    name: "Charge Lanes",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-earth",
    props: [
      prop("fence", 6, 3),
      prop("fence", 6, 10),
      prop("fence", 12, 3),
      prop("fence", 12, 10),
      prop("pit-horn", 16, 4),
      prop("rack", 9, 2),
    ],
    hazards: [dark(9, 4, 4, 6)],
    guards: [
      makeGuard("tl_g1", "Lane Rusher", "securis", "heavy", { maxHealth: 120, maxStamina: 70, attack: 14, defense: 8, agility: 4 }, BULL, {
        hornCharge: true,
        at: [10, 4],
      }),
      makeGuard("tl_g2", "Gore Hand", "gladius", "heavy", { maxHealth: 115, maxStamina: 70, attack: 14, defense: 7, agility: 5 }, BULL, {
        hornCharge: true,
        at: [16, 5],
      }),
      makeGuard("tl_g3", "Fence Spear", "spear", "spear", { maxHealth: 105, maxStamina: 80, attack: 12, defense: 6, agility: 7 }, BULL, {
        at: [10, 10],
      }),
      makeGuard("tl_g4", "Bull Net", "trident_net", "defensive", { maxHealth: 108, maxStamina: 75, attack: 11, defense: 8, agility: 5 }, BULL, {
        at: [16, 9],
      }),
    ],
    doors: [
      { to: "tau_yard", ...cell(1, 7), label: "Yard" },
      { to: "tau_pens", ...cell(18, 7), label: "Bull Pens", requiresClear: true },
    ],
  },
  {
    id: "tau_pens",
    name: "Bull Pens",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [prop("hay", 4, 3), prop("hay", 4, 10), prop("pit-horn", 16, 3), prop("pit-horn", 16, 10), prop("fence", 10, 6)],
    guards: [
      makeGuard("tp_g1", "Pen Warden", "malleus", "heavy", { maxHealth: 128, maxStamina: 65, attack: 15, defense: 9, agility: 3 }, BULL, {
        hornCharge: true,
        at: [12, 5],
      }),
      makeGuard("tp_g2", "Horn Hand", "securis", "heavy", { maxHealth: 118, maxStamina: 70, attack: 14, defense: 8, agility: 4 }, BULL, {
        hornCharge: true,
        at: [16, 7],
      }),
      makeGuard("tp_g3", "Pen Scout", "gladius", "aggressive", { maxHealth: 105, maxStamina: 80, attack: 13, defense: 5, agility: 8 }, BULL, {
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "tau_lanes", ...cell(1, 7), label: "Lanes" },
      { to: "tau_cipher", ...cell(18, 7), label: "Horn Path", requiresClear: true },
    ],
  },
  {
    id: "tau_cipher",
    name: "Horn Path",
    kind: "puzzle",
    cols: 18,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [prop("pit-horn", 4, 2), prop("pit-horn", 14, 2)],
    guards: [],
    rest: cell(4, 9),
    puzzle: stepPathPuzzle(
      "The stamp goes left, then center. Wrong stone draws arrows.",
      5,
      3,
      8,
      5,
      [
        [0, 3],
        [0, 2],
        [1, 2],
        [2, 2],
        [2, 1],
        [3, 1],
        [4, 1],
        [4, 2],
        [4, 3],
        [5, 3],
        [6, 3],
        [7, 3],
      ],
      [7, 3],
    ),
    doors: [
      { to: "tau_pens", ...cell(1, 6), label: "Pens" },
      { to: "tau_armory", ...cell(16, 6), label: "Armory Hall", requiresClear: true },
    ],
  },
  {
    id: "tau_armory",
    name: "Armory Hall",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-stone",
    props: [prop("rack", 8, 3), prop("rack", 12, 3), prop("shieldstand", 10, 10), prop("pit-horn", 16, 4), prop("fence", 6, 7)],
    guards: [
      makeGuard("ta_g1", "Armory Chief", "securis", "heavy", { maxHealth: 130, maxStamina: 70, attack: 15, defense: 9, agility: 4 }, BULL, {
        hornCharge: true,
        at: [14, 4],
      }),
      makeGuard("ta_g2", "Blade Bull", "gladius", "aggressive", { maxHealth: 112, maxStamina: 80, attack: 14, defense: 6, agility: 7 }, BULL, {
        at: [16, 7],
      }),
      makeGuard("ta_g3", "Pike Bull", "spear", "spear", { maxHealth: 110, maxStamina: 80, attack: 13, defense: 6, agility: 7 }, BULL, {
        at: [14, 10],
      }),
    ],
    doors: [
      { to: "tau_cipher", ...cell(1, 7), label: "Horn Path" },
      { to: "tau_ring", ...cell(18, 7), label: "Ring Corridor", requiresClear: true },
    ],
  },
  {
    id: "tau_ring",
    name: "Ring Corridor",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-earth",
    props: [
      prop("fence", 8, 3),
      prop("fence", 8, 10),
      prop("fence", 12, 3),
      prop("fence", 12, 10),
      prop("pit-horn", 16, 5),
      prop("pit-horn", 16, 9),
    ],
    guards: [
      makeGuard("tr_g1", "Ring Rusher", "malleus", "heavy", { maxHealth: 135, maxStamina: 65, attack: 16, defense: 9, agility: 3 }, BULL, {
        hornCharge: true,
        at: [12, 4],
      }),
      makeGuard("tr_g2", "Corridor Gore", "securis", "heavy", { maxHealth: 125, maxStamina: 70, attack: 15, defense: 8, agility: 4 }, BULL, {
        hornCharge: true,
        at: [16, 5],
      }),
      makeGuard("tr_g3", "Shield Bull", "gladius", "defensive", { maxHealth: 118, maxStamina: 80, attack: 13, defense: 10, agility: 5 }, BULL, {
        at: [12, 10],
      }),
      makeGuard("tr_g4", "Lane Pike", "spear", "spear", { maxHealth: 112, maxStamina: 85, attack: 13, defense: 6, agility: 7 }, BULL, {
        at: [16, 9],
      }),
    ],
    doors: [
      { to: "tau_armory", ...cell(1, 7), label: "Armory" },
      { to: "tau_boss", ...cell(18, 7), label: "Captain's Ring", requiresClear: true },
    ],
  },
  {
    id: "tau_boss",
    name: "Captain's Ring",
    kind: "boss",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-earth",
    props: [
      prop("pit-horn", 5, 3),
      prop("pit-horn", 17, 3),
      prop("pit-horn", 5, 13),
      prop("pit-horn", 17, 13),
      prop("fence", 11, 4),
      prop("brazier", 11, 13),
    ],
    guards: [],
    boss: makeGuard(
      "taurus_captain",
      "Captain Taurinus",
      "securis",
      "champion",
      { maxHealth: 245, maxStamina: 105, attack: 18, defense: 11, agility: 6 },
      0x6a1810,
      { hornCharge: true, at: [16, 8] },
    ),
    doors: [{ to: "tau_ring", ...cell(1, 8), label: "Corridor" }],
  },
];

export const TAURUS_RAID: RaidDef = {
  houseId: "taurus",
  startRoom: "tau_yard",
  rooms: TAURUS_ROOMS,
  alertMode: "ripple",
  torchTint: 0xc45a40,
  nightTint: 0x2a1008,
  victory: {
    title: "Taurus Freed",
    body: "The horns fall silent.",
  },
};
