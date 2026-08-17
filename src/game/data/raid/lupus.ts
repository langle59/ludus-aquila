import { cell, dark, facingPuzzle, makeGuard, prop, type RaidDef, type RaidRoomDef } from "./types";

const WOLF = 0x6a6e78;

/** Lupus — 6 rooms, pack howl, wolf set dressing. */
export const LUPUS_ROOMS: RaidRoomDef[] = [
  {
    id: "lup_yard",
    name: "Moon Yard",
    kind: "combat",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-dirt",
    props: [prop("brazier", 11, 3), prop("brazier", 11, 13), prop("hay", 5, 4), prop("pit-skull", 18, 4)],
    guards: [
      makeGuard("ly_g1", "Moon Scout", "gladius", "aggressive", { maxHealth: 82, maxStamina: 80, attack: 10, defense: 4, agility: 10 }, WOLF, {
        at: [15, 4],
      }),
      makeGuard("ly_g2", "Yard Hound", "spear", "spear", { maxHealth: 78, maxStamina: 75, attack: 9, defense: 5, agility: 9 }, WOLF, {
        at: [18, 8],
      }),
      makeGuard("ly_g3", "Night Fang", "dual_blades", "elite", { maxHealth: 75, maxStamina: 85, attack: 11, defense: 3, agility: 11 }, WOLF, {
        at: [15, 12],
      }),
    ],
    doors: [{ to: "lup_kennels", ...cell(20, 8), label: "Kennels", requiresClear: true }],
  },
  {
    id: "lup_kennels",
    name: "Kennels",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-dirt",
    props: [
      prop("hay", 5, 3),
      prop("hay", 8, 3),
      prop("hay", 5, 10),
      prop("fence", 10, 4),
      prop("fence", 10, 9),
      prop("pit-skull", 16, 3),
    ],
    guards: [
      makeGuard("lk_g1", "Kennel Master", "securis", "heavy", { maxHealth: 110, maxStamina: 70, attack: 13, defense: 6, agility: 5 }, WOLF, {
        at: [12, 4],
      }),
      makeGuard("lk_g2", "Pack Runner", "gladius", "aggressive", { maxHealth: 85, maxStamina: 85, attack: 11, defense: 4, agility: 11 }, WOLF, {
        at: [16, 5],
      }),
      makeGuard("lk_g3", "Pack Runner", "spear", "spear", { maxHealth: 88, maxStamina: 80, attack: 10, defense: 5, agility: 10 }, WOLF, {
        at: [12, 10],
      }),
      makeGuard("lk_g4", "Cub Guard", "dual_blades", "aggressive", { maxHealth: 80, maxStamina: 90, attack: 10, defense: 3, agility: 12 }, WOLF, {
        at: [16, 9],
      }),
    ],
    doors: [
      { to: "lup_yard", ...cell(1, 7), label: "Yard" },
      { to: "lup_ambush", ...cell(18, 7), label: "Ambush Run", requiresClear: true },
    ],
  },
  {
    id: "lup_ambush",
    name: "Ambush Run",
    kind: "combat",
    cols: 16,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [
      prop("lamp", 4, 2),
      prop("lamp", 8, 2),
      prop("lamp", 12, 2),
      prop("lamp", 4, 9),
      prop("lamp", 8, 9),
      prop("lamp", 12, 9),
      prop("pit-skull", 7, 3),
    ],
    hazards: [dark(5, 4, 8, 4)],
    guards: [
      makeGuard("la_g1", "Ambush Lead", "dual_blades", "elite", { maxHealth: 90, maxStamina: 90, attack: 12, defense: 4, agility: 12 }, WOLF, {
        at: [8, 3],
      }),
      makeGuard("la_g2", "Flanker", "gladius", "aggressive", { maxHealth: 85, maxStamina: 85, attack: 11, defense: 4, agility: 11 }, WOLF, {
        at: [13, 6],
      }),
      makeGuard("la_g3", "Flanker", "spear", "spear", { maxHealth: 88, maxStamina: 80, attack: 10, defense: 5, agility: 10 }, WOLF, {
        at: [8, 9],
      }),
    ],
    doors: [
      { to: "lup_kennels", ...cell(1, 6), label: "Kennels" },
      { to: "lup_cipher", ...cell(14, 6), label: "Moon Court", requiresClear: true },
    ],
  },
  {
    id: "lup_cipher",
    name: "Moon Court",
    kind: "puzzle",
    cols: 18,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [prop("brazier", 9, 9), prop("pit-skull", 5, 3), prop("pit-skull", 13, 3)],
    guards: [],
    rest: cell(4, 9),
    puzzle: facingPuzzle("wolf", "right", "Turn them toward the way out.", [
      [7, 5, "up"],
      [9, 5, "down"],
      [11, 5, "left"],
    ]),
    doors: [
      { to: "lup_ambush", ...cell(1, 6), label: "Ambush Run" },
      { to: "lup_pens", ...cell(16, 6), label: "Holding Pens", requiresClear: true },
    ],
  },
  {
    id: "lup_pens",
    name: "Holding Pens",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-dirt",
    props: [prop("fence", 6, 4), prop("fence", 6, 9), prop("hay", 12, 3), prop("pit-skull", 16, 11)],
    guards: [
      makeGuard("lp_g1", "Pen Warden", "malleus", "heavy", { maxHealth: 115, maxStamina: 65, attack: 14, defense: 7, agility: 4 }, WOLF, {
        at: [14, 4],
      }),
      makeGuard("lp_g2", "Chain Wolf", "gladius", "defensive", { maxHealth: 95, maxStamina: 75, attack: 11, defense: 8, agility: 7 }, WOLF, {
        at: [16, 7],
      }),
      makeGuard("lp_g3", "Pack Guard", "spear", "spear", { maxHealth: 90, maxStamina: 80, attack: 11, defense: 5, agility: 9 }, WOLF, {
        at: [14, 10],
      }),
    ],
    doors: [
      { to: "lup_cipher", ...cell(1, 7), label: "Moon Court" },
      { to: "lup_boss", ...cell(18, 7), label: "Alpha's Den", requiresClear: true },
    ],
  },
  {
    id: "lup_boss",
    name: "Alpha's Den",
    kind: "boss",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-stone",
    props: [
      prop("pit-skull", 6, 3),
      prop("pit-skull", 16, 3),
      prop("pit-skull", 6, 13),
      prop("pit-skull", 16, 13),
      prop("brazier", 11, 4),
    ],
    guards: [],
    boss: makeGuard(
      "lup_alpha",
      "Alpha Lupa",
      "dual_blades",
      "champion",
      { maxHealth: 190, maxStamina: 110, attack: 15, defense: 7, agility: 12 },
      0x4a5058,
      { at: [16, 8] },
    ),
    doors: [{ to: "lup_pens", ...cell(1, 8), label: "Pens" }],
  },
];

export const LUPUS_RAID: RaidDef = {
  houseId: "lupus",
  startRoom: "lup_yard",
  rooms: LUPUS_ROOMS,
  alertMode: "pack",
  torchTint: 0x8a9aac,
  nightTint: 0x1a2430,
  victory: {
    title: "Lupus Freed",
    body: "You return under the moon.",
  },
};
