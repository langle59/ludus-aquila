import { cell, makeGuard, prop, rubble, timingPuzzle, type RaidDef, type RaidRoomDef } from "./types";

const BEAR = 0x6a3e24;

/** Ursus — 8 rooms, rubble crush pads + armored heavies. */
export const URSUS_ROOMS: RaidRoomDef[] = [
  {
    id: "urs_yard",
    name: "Earth Yard",
    kind: "combat",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-earth",
    props: [prop("pit-log", 6, 4), prop("pit-log", 16, 4), prop("hay", 11, 13)],
    hazards: [rubble(12, 7, 4, 3)],
    guards: [
      makeGuard("uy_g1", "Earth Guard", "malleus", "heavy", { maxHealth: 130, maxStamina: 65, attack: 15, defense: 10, agility: 3 }, BEAR, {
        armor: true,
        at: [16, 5],
      }),
      makeGuard("uy_g2", "Yard Bear", "securis", "heavy", { maxHealth: 120, maxStamina: 70, attack: 14, defense: 9, agility: 4 }, BEAR, {
        armor: true,
        at: [18, 8],
      }),
      makeGuard("uy_g3", "Stone Watch", "spear", "spear", { maxHealth: 112, maxStamina: 75, attack: 13, defense: 7, agility: 5 }, BEAR, {
        at: [16, 11],
      }),
    ],
    doors: [{ to: "urs_rubble", ...cell(20, 8), label: "Rubble Walk", requiresClear: true }],
  },
  {
    id: "urs_rubble",
    name: "Rubble Walk",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-earth",
    props: [prop("pit-log", 5, 3), prop("pit-log", 5, 10), prop("pit-log", 15, 4), prop("pit-log", 15, 9)],
    hazards: [rubble(8, 4, 5, 3), rubble(10, 8, 5, 3)],
    guards: [
      makeGuard("ur_g1", "Crush Guard", "malleus", "heavy", { maxHealth: 140, maxStamina: 60, attack: 16, defense: 11, agility: 2 }, BEAR, {
        armor: true,
        at: [12, 4],
      }),
      makeGuard("ur_g2", "Rubble Hand", "securis", "heavy", { maxHealth: 130, maxStamina: 65, attack: 15, defense: 10, agility: 3 }, BEAR, {
        armor: true,
        at: [16, 6],
      }),
      makeGuard("ur_g3", "Walk Spear", "spear", "spear", { maxHealth: 115, maxStamina: 75, attack: 13, defense: 7, agility: 6 }, BEAR, {
        at: [12, 10],
      }),
      makeGuard("ur_g4", "Bear Net", "trident_net", "defensive", { maxHealth: 120, maxStamina: 70, attack: 12, defense: 9, agility: 4 }, BEAR, {
        armor: true,
        at: [16, 10],
      }),
    ],
    doors: [
      { to: "urs_yard", ...cell(1, 7), label: "Yard" },
      { to: "urs_den", ...cell(18, 7), label: "Stone Den", requiresClear: true },
    ],
  },
  {
    id: "urs_den",
    name: "Stone Den",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [prop("pit-log", 6, 4), prop("hay", 10, 3), prop("pit-log", 14, 10), prop("brazier", 16, 7)],
    hazards: [rubble(9, 5, 6, 4)],
    guards: [
      makeGuard("ud_g1", "Den Warden", "malleus", "heavy", { maxHealth: 145, maxStamina: 60, attack: 16, defense: 12, agility: 2 }, BEAR, {
        armor: true,
        at: [14, 5],
      }),
      makeGuard("ud_g2", "Stone Hand", "securis", "heavy", { maxHealth: 135, maxStamina: 65, attack: 15, defense: 10, agility: 3 }, BEAR, {
        armor: true,
        at: [16, 8],
      }),
      makeGuard("ud_g3", "Den Scout", "gladius", "aggressive", { maxHealth: 118, maxStamina: 80, attack: 14, defense: 7, agility: 7 }, BEAR, {
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "urs_rubble", ...cell(1, 7), label: "Rubble" },
      { to: "urs_cipher", ...cell(18, 7), label: "Earth Plates", requiresClear: true },
    ],
  },
  {
    id: "urs_cipher",
    name: "Earth Plates",
    kind: "puzzle",
    cols: 18,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [prop("pit-log", 5, 3), prop("pit-log", 13, 3)],
    guards: [],
    rest: cell(4, 9),
    puzzle: timingPuzzle("pressure", "Hold the earth west to east before the stones rise.", {
      plates: [
        [6, 6],
        [9, 6],
        [12, 6],
      ],
      holdMs: 2800,
    }),
    doors: [
      { to: "urs_den", ...cell(1, 6), label: "Den" },
      { to: "urs_hall", ...cell(16, 6), label: "Timber Hall", requiresClear: true },
    ],
  },
  {
    id: "urs_hall",
    name: "Timber Hall",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-earth",
    props: [prop("pit-log", 6, 3), prop("pit-log", 10, 3), prop("pit-log", 14, 3), prop("rack", 10, 10)],
    hazards: [rubble(8, 6, 4, 3), rubble(13, 8, 4, 3)],
    guards: [
      makeGuard("uh_g1", "Timber Chief", "malleus", "heavy", { maxHealth: 150, maxStamina: 60, attack: 17, defense: 12, agility: 2 }, BEAR, {
        armor: true,
        at: [14, 4],
      }),
      makeGuard("uh_g2", "Hall Axe", "securis", "heavy", { maxHealth: 138, maxStamina: 65, attack: 16, defense: 10, agility: 3 }, BEAR, {
        armor: true,
        at: [16, 7],
      }),
      makeGuard("uh_g3", "Hall Pike", "spear", "spear", { maxHealth: 120, maxStamina: 80, attack: 14, defense: 8, agility: 6 }, BEAR, {
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "urs_cipher", ...cell(1, 7), label: "Earth Plates" },
      { to: "urs_vault", ...cell(18, 7), label: "Stone Vault", requiresClear: true },
    ],
  },
  {
    id: "urs_vault",
    name: "Stone Vault",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-stone",
    props: [prop("pit-log", 7, 4), prop("pit-log", 13, 4), prop("shieldstand", 10, 10), prop("brazier", 16, 7)],
    hazards: [rubble(9, 5, 5, 4)],
    guards: [
      makeGuard("uv_g1", "Vault Wall", "malleus", "heavy", { maxHealth: 155, maxStamina: 60, attack: 17, defense: 13, agility: 2 }, BEAR, {
        armor: true,
        at: [12, 4],
      }),
      makeGuard("uv_g2", "Vault Guard", "securis", "heavy", { maxHealth: 142, maxStamina: 65, attack: 16, defense: 11, agility: 3 }, BEAR, {
        armor: true,
        at: [16, 5],
      }),
      makeGuard("uv_g3", "Vault Shield", "gladius", "defensive", { maxHealth: 130, maxStamina: 75, attack: 13, defense: 12, agility: 4 }, BEAR, {
        armor: true,
        at: [12, 10],
      }),
      makeGuard("uv_g4", "Vault Spear", "spear", "spear", { maxHealth: 122, maxStamina: 80, attack: 14, defense: 8, agility: 6 }, BEAR, {
        at: [16, 9],
      }),
    ],
    doors: [
      { to: "urs_hall", ...cell(1, 7), label: "Hall" },
      { to: "urs_crush", ...cell(18, 7), label: "Crush Approach", requiresClear: true },
    ],
  },
  {
    id: "urs_crush",
    name: "Crush Approach",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-earth",
    props: [prop("pit-log", 5, 3), prop("pit-log", 15, 3), prop("pit-log", 5, 10), prop("pit-log", 15, 10)],
    hazards: [rubble(7, 4, 6, 3), rubble(9, 8, 6, 3)],
    guards: [
      makeGuard("uc_g1", "Crush Elite", "malleus", "heavy", { maxHealth: 155, maxStamina: 60, attack: 17, defense: 13, agility: 2 }, BEAR, {
        armor: true,
        at: [14, 4],
      }),
      makeGuard("uc_g2", "Approach Bear", "securis", "heavy", { maxHealth: 145, maxStamina: 65, attack: 16, defense: 11, agility: 3 }, BEAR, {
        armor: true,
        at: [16, 7],
      }),
      makeGuard("uc_g3", "Approach Pike", "spear", "spear", { maxHealth: 125, maxStamina: 80, attack: 14, defense: 8, agility: 6 }, BEAR, {
        at: [12, 10],
      }),
    ],
    doors: [
      { to: "urs_vault", ...cell(1, 7), label: "Vault" },
      { to: "urs_boss", ...cell(18, 7), label: "Captain's Cave", requiresClear: true },
    ],
  },
  {
    id: "urs_boss",
    name: "Captain's Cave",
    kind: "boss",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-stone",
    props: [
      prop("pit-log", 5, 3),
      prop("pit-log", 17, 3),
      prop("pit-log", 5, 13),
      prop("pit-log", 17, 13),
      prop("brazier", 11, 4),
    ],
    hazards: [rubble(10, 7, 5, 3)],
    guards: [],
    boss: makeGuard(
      "ursus_captain",
      "Captain Ursinus",
      "malleus",
      "champion",
      { maxHealth: 310, maxStamina: 100, attack: 20, defense: 14, agility: 4 },
      0x4a2818,
      { armor: true, at: [16, 8] },
    ),
    doors: [{ to: "urs_crush", ...cell(1, 8), label: "Approach" }],
  },
];

export const URSUS_RAID: RaidDef = {
  houseId: "ursus",
  startRoom: "urs_yard",
  rooms: URSUS_ROOMS,
  alertMode: "ripple",
  torchTint: 0xb08050,
  nightTint: 0x1a140c,
  victory: {
    title: "Ursus Freed",
    body: "The cave opens. The crush is broken.",
  },
};
