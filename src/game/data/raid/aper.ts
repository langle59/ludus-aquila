import { cell, facingPuzzle, makeGuard, mud, prop, type RaidDef, type RaidRoomDef } from "./types";

const BOAR = 0x5a4030;

/** Aper — 7 rooms, mud + tusk charge, sty set dressing. */
export const APER_ROOMS: RaidRoomDef[] = [
  {
    id: "aper_yard",
    name: "Bristle Yard",
    kind: "combat",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-earth",
    props: [prop("pit-tusk", 5, 3), prop("pit-tusk", 17, 3), prop("hay", 8, 4), prop("brazier", 11, 13)],
    guards: [
      makeGuard("ay_g1", "Bristle Guard", "securis", "heavy", { maxHealth: 100, maxStamina: 70, attack: 12, defense: 7, agility: 4 }, BOAR, {
        tuskCharge: true,
        at: [16, 5],
      }),
      makeGuard("ay_g2", "Yard Tusker", "gladius", "aggressive", { maxHealth: 92, maxStamina: 75, attack: 11, defense: 5, agility: 7 }, BOAR, {
        at: [18, 8],
      }),
      makeGuard("ay_g3", "Sty Watch", "spear", "spear", { maxHealth: 95, maxStamina: 75, attack: 11, defense: 6, agility: 6 }, BOAR, {
        at: [16, 11],
      }),
    ],
    doors: [{ to: "aper_barracks", ...cell(20, 8), label: "Sty Barracks", requiresClear: true }],
  },
  {
    id: "aper_barracks",
    name: "Sty Barracks",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-earth",
    props: [prop("hay", 5, 3), prop("hay", 8, 3), prop("hay", 5, 10), prop("pit-tusk", 16, 4), prop("rack", 12, 2)],
    guards: [
      makeGuard("ab_g1", "Sty Drill", "malleus", "heavy", { maxHealth: 125, maxStamina: 65, attack: 15, defense: 8, agility: 3 }, BOAR, {
        tuskCharge: true,
        at: [12, 4],
      }),
      makeGuard("ab_g2", "Bristle Hand", "securis", "heavy", { maxHealth: 115, maxStamina: 70, attack: 14, defense: 7, agility: 4 }, BOAR, {
        tuskCharge: true,
        at: [16, 5],
      }),
      makeGuard("ab_g3", "Spear Boar", "spear", "spear", { maxHealth: 100, maxStamina: 80, attack: 12, defense: 6, agility: 7 }, BOAR, {
        at: [12, 10],
      }),
      makeGuard("ab_g4", "Net Boar", "trident_net", "defensive", { maxHealth: 105, maxStamina: 75, attack: 11, defense: 8, agility: 5 }, BOAR, {
        at: [16, 9],
      }),
    ],
    doors: [
      { to: "aper_yard", ...cell(1, 7), label: "Yard" },
      { to: "aper_mud", ...cell(18, 7), label: "Mud Sty", requiresClear: true },
    ],
  },
  {
    id: "aper_mud",
    name: "Mud Sty",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-mud",
    props: [prop("hay", 4, 3), prop("pit-tusk", 16, 3), prop("pit-tusk", 16, 10)],
    hazards: [mud(6, 4, 8, 6), mud(10, 8, 5, 4)],
    guards: [
      makeGuard("am_g1", "Mud Tusker", "securis", "heavy", { maxHealth: 120, maxStamina: 70, attack: 14, defense: 8, agility: 3 }, BOAR, {
        tuskCharge: true,
        at: [10, 6],
      }),
      makeGuard("am_g2", "Wallower", "malleus", "heavy", { maxHealth: 130, maxStamina: 60, attack: 15, defense: 9, agility: 2 }, BOAR, {
        tuskCharge: true,
        at: [12, 10],
      }),
      makeGuard("am_g3", "Mud Scout", "gladius", "aggressive", { maxHealth: 100, maxStamina: 80, attack: 12, defense: 5, agility: 8 }, BOAR, {
        at: [16, 4],
      }),
    ],
    doors: [
      { to: "aper_barracks", ...cell(1, 7), label: "Barracks" },
      { to: "aper_cipher", ...cell(18, 7), label: "Tusk Court", requiresClear: true },
    ],
  },
  {
    id: "aper_cipher",
    name: "Tusk Court",
    kind: "puzzle",
    cols: 18,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [prop("brazier", 9, 9), prop("pit-tusk", 5, 3), prop("pit-tusk", 13, 3)],
    guards: [],
    rest: cell(4, 9),
    puzzle: facingPuzzle("boar", "right", "Turn them toward the way out.", [
      [7, 5, "left"],
      [9, 5, "up"],
      [11, 5, "down"],
    ]),
    doors: [
      { to: "aper_mud", ...cell(1, 6), label: "Mud Sty" },
      { to: "aper_smoke", ...cell(16, 6), label: "Smoke Pens", requiresClear: true },
    ],
  },
  {
    id: "aper_smoke",
    name: "Smoke Pens",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-earth",
    props: [
      prop("brazier", 6, 3),
      prop("brazier", 10, 3),
      prop("brazier", 14, 3),
      prop("brazier", 6, 10),
      prop("brazier", 14, 10),
      prop("hay", 9, 11),
    ],
    guards: [
      makeGuard("as_g1", "Smoke Warden", "securis", "heavy", { maxHealth: 125, maxStamina: 70, attack: 15, defense: 8, agility: 4 }, BOAR, {
        tuskCharge: true,
        at: [14, 4],
      }),
      makeGuard("as_g2", "Ash Guard", "gladius", "aggressive", { maxHealth: 105, maxStamina: 80, attack: 13, defense: 5, agility: 8 }, BOAR, {
        at: [16, 7],
      }),
      makeGuard("as_g3", "Ember Spear", "spear", "spear", { maxHealth: 108, maxStamina: 75, attack: 12, defense: 6, agility: 7 }, BOAR, {
        at: [14, 10],
      }),
    ],
    doors: [
      { to: "aper_cipher", ...cell(1, 7), label: "Tusk Court" },
      { to: "aper_armory", ...cell(18, 7), label: "Armory Hall", requiresClear: true },
    ],
  },
  {
    id: "aper_armory",
    name: "Armory Hall",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-stone",
    props: [
      prop("rack", 8, 3),
      prop("rack", 12, 3),
      prop("shieldstand", 10, 10),
      prop("pit-tusk", 16, 4),
      prop("pit-tusk", 16, 9),
    ],
    guards: [
      makeGuard("aa_g1", "Armory Chief", "malleus", "heavy", { maxHealth: 135, maxStamina: 70, attack: 16, defense: 9, agility: 3 }, BOAR, {
        tuskCharge: true,
        at: [12, 4],
      }),
      makeGuard("aa_g2", "Blade Boar", "securis", "heavy", { maxHealth: 120, maxStamina: 75, attack: 15, defense: 7, agility: 5 }, BOAR, {
        tuskCharge: true,
        at: [16, 5],
      }),
      makeGuard("aa_g3", "Shield Boar", "gladius", "defensive", { maxHealth: 115, maxStamina: 80, attack: 12, defense: 10, agility: 5 }, BOAR, {
        at: [12, 10],
      }),
      makeGuard("aa_g4", "Pike Boar", "spear", "spear", { maxHealth: 110, maxStamina: 85, attack: 13, defense: 6, agility: 7 }, BOAR, {
        at: [16, 9],
      }),
    ],
    doors: [
      { to: "aper_smoke", ...cell(1, 7), label: "Smoke Pens" },
      { to: "aper_boss", ...cell(18, 7), label: "Captain's Sty", requiresClear: true },
    ],
  },
  {
    id: "aper_boss",
    name: "Captain's Sty",
    kind: "boss",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-mud",
    props: [
      prop("pit-tusk", 5, 3),
      prop("pit-tusk", 17, 3),
      prop("pit-tusk", 5, 13),
      prop("pit-tusk", 17, 13),
      prop("brazier", 11, 4),
      prop("hay", 10, 13),
    ],
    guards: [],
    boss: makeGuard(
      "aper_captain",
      "Captain Scrofa",
      "securis",
      "champion",
      { maxHealth: 220, maxStamina: 100, attack: 17, defense: 10, agility: 6 },
      0x3a2818,
      { tuskCharge: true, at: [16, 8] },
    ),
    doors: [{ to: "aper_armory", ...cell(1, 8), label: "Armory" }],
  },
];

export const APER_RAID: RaidDef = {
  houseId: "aper",
  startRoom: "aper_yard",
  rooms: APER_ROOMS,
  alertMode: "ripple",
  torchTint: 0xc49a58,
  nightTint: 0x2a1810,
  victory: {
    title: "Aper Freed",
    body: "You return through the mud.",
  },
};
