import { cell, makeGuard, prop, stampede, timingPuzzle, type RaidDef, type RaidRoomDef } from "./types";

const IVORY = 0x9a9aa0;

/** Elephas — 8 rooms, stampede sweeps, climax boss. */
export const ELEPHAS_ROOMS: RaidRoomDef[] = [
  {
    id: "ele_yard",
    name: "Ivory Yard",
    kind: "combat",
    cols: 24,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-ivory",
    props: [prop("pit-ivory", 6, 3), prop("pit-ivory", 18, 3), prop("brazier", 12, 13)],
    hazards: [stampede(10, 5, 10, 4, "x", 3400)],
    guards: [
      makeGuard("ey_g1", "Ivory Guard", "malleus", "heavy", { maxHealth: 145, maxStamina: 65, attack: 17, defense: 12, agility: 3 }, IVORY, {
        armor: true,
        at: [18, 5],
      }),
      makeGuard("ey_g2", "Yard Tusk", "securis", "heavy", { maxHealth: 140, maxStamina: 70, attack: 16, defense: 11, agility: 4 }, IVORY, {
        hornCharge: true,
        at: [20, 8],
      }),
      makeGuard("ey_g3", "Yard Pike", "spear", "spear", { maxHealth: 128, maxStamina: 80, attack: 15, defense: 9, agility: 6 }, IVORY, {
        at: [18, 11],
      }),
      makeGuard("ey_g4", "Yard Shield", "gladius", "defensive", { maxHealth: 135, maxStamina: 75, attack: 14, defense: 12, agility: 5 }, IVORY, {
        armor: true,
        at: [16, 7],
      }),
    ],
    doors: [{ to: "ele_sweep", ...cell(22, 8), label: "Stampede Walk", requiresClear: true }],
  },
  {
    id: "ele_sweep",
    name: "Stampede Walk",
    kind: "combat",
    cols: 22,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-ivory",
    props: [prop("pit-ivory", 5, 3), prop("pit-ivory", 17, 3), prop("pit-ivory", 5, 10), prop("hay", 11, 10)],
    hazards: [stampede(6, 3, 12, 3, "x", 3000), stampede(6, 9, 12, 3, "x", 3600)],
    guards: [
      makeGuard("es_g1", "Sweep Warden", "malleus", "heavy", { maxHealth: 155, maxStamina: 60, attack: 18, defense: 13, agility: 2 }, IVORY, {
        armor: true,
        at: [14, 4],
      }),
      makeGuard("es_g2", "Tusk Hand", "securis", "heavy", { maxHealth: 148, maxStamina: 65, attack: 17, defense: 11, agility: 3 }, IVORY, {
        hornCharge: true,
        at: [18, 6],
      }),
      makeGuard("es_g3", "Walk Spear", "spear", "spear", { maxHealth: 130, maxStamina: 80, attack: 15, defense: 9, agility: 6 }, IVORY, {
        at: [14, 10],
      }),
      makeGuard("es_g4", "Ivory Net", "trident_net", "defensive", { maxHealth: 135, maxStamina: 70, attack: 13, defense: 11, agility: 5 }, IVORY, {
        at: [18, 10],
      }),
    ],
    doors: [
      { to: "ele_yard", ...cell(1, 7), label: "Yard" },
      { to: "ele_hall", ...cell(20, 7), label: "Ivory Hall", requiresClear: true },
    ],
  },
  {
    id: "ele_hall",
    name: "Ivory Hall",
    kind: "combat",
    cols: 22,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-ivory",
    props: [prop("pit-ivory", 6, 3), prop("pit-ivory", 16, 3), prop("rack", 11, 10), prop("brazier", 18, 7)],
    hazards: [stampede(8, 5, 8, 5, "y", 3200)],
    guards: [
      makeGuard("eh_g1", "Hall Elite", "malleus", "heavy", { maxHealth: 160, maxStamina: 60, attack: 18, defense: 14, agility: 2 }, IVORY, {
        armor: true,
        at: [14, 4],
      }),
      makeGuard("eh_g2", "Hall Tusk", "securis", "heavy", { maxHealth: 150, maxStamina: 65, attack: 17, defense: 12, agility: 3 }, IVORY, {
        hornCharge: true,
        armor: true,
        at: [18, 6],
      }),
      makeGuard("eh_g3", "Hall Pike", "spear", "spear", { maxHealth: 135, maxStamina: 85, attack: 15, defense: 9, agility: 6 }, IVORY, {
        at: [12, 10],
      }),
      makeGuard("eh_g4", "Hall Blade", "gladius", "aggressive", { maxHealth: 140, maxStamina: 85, attack: 16, defense: 9, agility: 7 }, IVORY, {
        at: [16, 10],
      }),
    ],
    doors: [
      { to: "ele_sweep", ...cell(1, 7), label: "Sweep" },
      { to: "ele_cipher", ...cell(20, 7), label: "Ivory Crossing", requiresClear: true },
    ],
  },
  {
    id: "ele_cipher",
    name: "Ivory Crossing",
    kind: "puzzle",
    cols: 18,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [prop("pit-ivory", 4, 2), prop("pit-ivory", 14, 2)],
    hazards: [stampede(6, 4, 8, 4, "x", 3000)],
    guards: [],
    rest: cell(4, 9),
    puzzle: timingPuzzle("stampede", "Reach the ivory pad between sweeps.", {
      goal: [14, 6],
    }),
    doors: [
      { to: "ele_hall", ...cell(1, 6), label: "Hall" },
      { to: "ele_pens", ...cell(16, 6), label: "Tusk Pens", requiresClear: true },
    ],
  },
  {
    id: "ele_pens",
    name: "Tusk Pens",
    kind: "combat",
    cols: 22,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-ivory",
    props: [prop("hay", 5, 3), prop("hay", 5, 10), prop("pit-ivory", 16, 4), prop("pit-ivory", 16, 9), prop("pit-tusk", 11, 6)],
    hazards: [stampede(8, 4, 10, 3, "x", 3100)],
    guards: [
      makeGuard("ep_g1", "Pen Warden", "malleus", "heavy", { maxHealth: 165, maxStamina: 60, attack: 19, defense: 14, agility: 2 }, IVORY, {
        armor: true,
        at: [14, 4],
      }),
      makeGuard("ep_g2", "Pen Tusk", "securis", "heavy", { maxHealth: 155, maxStamina: 65, attack: 18, defense: 12, agility: 3 }, IVORY, {
        hornCharge: true,
        armor: true,
        at: [18, 7],
      }),
      makeGuard("ep_g3", "Pen Spear", "spear", "spear", { maxHealth: 138, maxStamina: 80, attack: 15, defense: 9, agility: 6 }, IVORY, {
        at: [12, 10],
      }),
      makeGuard("ep_g4", "Pen Shield", "gladius", "defensive", { maxHealth: 145, maxStamina: 75, attack: 14, defense: 13, agility: 5 }, IVORY, {
        armor: true,
        at: [16, 10],
      }),
    ],
    doors: [
      { to: "ele_cipher", ...cell(1, 7), label: "Ivory Crossing" },
      { to: "ele_vault", ...cell(20, 7), label: "Ivory Vault", requiresClear: true },
    ],
  },
  {
    id: "ele_vault",
    name: "Ivory Vault",
    kind: "combat",
    cols: 22,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-stone",
    props: [prop("pit-ivory", 7, 3), prop("pit-ivory", 15, 3), prop("rack", 11, 10), prop("shieldstand", 18, 6)],
    hazards: [stampede(9, 5, 8, 5, "y", 2800)],
    guards: [
      makeGuard("ev_g1", "Vault Elite", "malleus", "heavy", { maxHealth: 170, maxStamina: 60, attack: 19, defense: 15, agility: 2 }, IVORY, {
        armor: true,
        at: [14, 4],
      }),
      makeGuard("ev_g2", "Vault Tusk", "securis", "heavy", { maxHealth: 160, maxStamina: 65, attack: 18, defense: 13, agility: 3 }, IVORY, {
        hornCharge: true,
        armor: true,
        at: [18, 5],
      }),
      makeGuard("ev_g3", "Vault Pike", "spear", "spear", { maxHealth: 140, maxStamina: 85, attack: 16, defense: 10, agility: 6 }, IVORY, {
        at: [12, 10],
      }),
      makeGuard("ev_g4", "Vault Blade", "gladius", "aggressive", { maxHealth: 145, maxStamina: 85, attack: 16, defense: 10, agility: 7 }, IVORY, {
        at: [16, 10],
      }),
    ],
    doors: [
      { to: "ele_pens", ...cell(1, 7), label: "Pens" },
      { to: "ele_approach", ...cell(20, 7), label: "Stampede Approach", requiresClear: true },
    ],
  },
  {
    id: "ele_approach",
    name: "Stampede Approach",
    kind: "combat",
    cols: 24,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand-ivory",
    props: [
      prop("pit-ivory", 5, 3),
      prop("pit-ivory", 19, 3),
      prop("pit-ivory", 5, 10),
      prop("pit-ivory", 19, 10),
      prop("brazier", 12, 6),
    ],
    hazards: [stampede(6, 3, 14, 3, "x", 2900), stampede(6, 9, 14, 3, "x", 3500)],
    guards: [
      makeGuard("ea_g1", "Approach Elite", "malleus", "heavy", { maxHealth: 175, maxStamina: 60, attack: 20, defense: 15, agility: 2 }, IVORY, {
        armor: true,
        at: [16, 4],
      }),
      makeGuard("ea_g2", "Approach Tusk", "securis", "heavy", { maxHealth: 165, maxStamina: 65, attack: 19, defense: 13, agility: 3 }, IVORY, {
        hornCharge: true,
        armor: true,
        at: [20, 6],
      }),
      makeGuard("ea_g3", "Approach Pike", "spear", "spear", { maxHealth: 145, maxStamina: 85, attack: 16, defense: 10, agility: 6 }, IVORY, {
        at: [14, 10],
      }),
      makeGuard("ea_g4", "Approach Shield", "gladius", "defensive", { maxHealth: 150, maxStamina: 80, attack: 15, defense: 14, agility: 5 }, IVORY, {
        armor: true,
        at: [18, 10],
      }),
    ],
    doors: [
      { to: "ele_vault", ...cell(1, 7), label: "Vault" },
      { to: "ele_boss", ...cell(22, 7), label: "Captain's Ivory", requiresClear: true },
    ],
  },
  {
    id: "ele_boss",
    name: "Captain's Ivory",
    kind: "boss",
    cols: 24,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-ivory",
    props: [
      prop("pit-ivory", 5, 3),
      prop("pit-ivory", 19, 3),
      prop("pit-ivory", 5, 13),
      prop("pit-ivory", 19, 13),
      prop("pit-tusk", 12, 4),
      prop("brazier", 12, 13),
    ],
    hazards: [stampede(8, 6, 12, 4, "x", 3000)],
    guards: [],
    boss: makeGuard(
      "elephas_captain",
      "Captain Elephantus",
      "malleus",
      "champion",
      { maxHealth: 370, maxStamina: 110, attack: 22, defense: 16, agility: 4 },
      0x787870,
      { hornCharge: true, armor: true, at: [18, 8] },
    ),
    doors: [{ to: "ele_approach", ...cell(1, 8), label: "Approach" }],
  },
];

export const ELEPHAS_RAID: RaidDef = {
  houseId: "elephas",
  startRoom: "ele_yard",
  rooms: ELEPHAS_ROOMS,
  alertMode: "pack",
  torchTint: 0xd8d0b8,
  nightTint: 0x181610,
  victory: {
    title: "Elephas Freed",
    body: "All nine houses stand free. The night raids are done.",
  },
};
