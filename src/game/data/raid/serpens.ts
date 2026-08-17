import { cell, dark, facingPuzzle, makeGuard, prop, type RaidDef, type RaidRoomDef } from "./types";

/** Serpens — 5 rooms, coil theme, ripple aggro. */
export const SERPENS_ROOMS: RaidRoomDef[] = [
  {
    id: "serp_yard",
    name: "Serpens Yard",
    kind: "combat",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand",
    props: [prop("vine", 4, 2), prop("vine", 18, 2), prop("vine", 4, 13), prop("brazier", 11, 3)],
    hazards: [dark(12, 6, 6, 4)],
    guards: [
      makeGuard("sy_g1", "Coil Guard", "spear", "spear", { maxHealth: 70, maxStamina: 70, attack: 8, defense: 5, agility: 7 }, 0x2f6b4a, {
        at: [16, 5],
      }),
      makeGuard("sy_g2", "Yard Watch", "gladius", "aggressive", { maxHealth: 65, maxStamina: 75, attack: 9, defense: 4, agility: 8 }, 0x2f6b4a, {
        at: [17, 11],
      }),
    ],
    doors: [{ to: "serp_barracks", ...cell(20, 8), label: "Barracks", requiresClear: true }],
  },
  {
    id: "serp_barracks",
    name: "Barracks",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand",
    props: [prop("rack", 16, 3), prop("rack", 16, 10), prop("vine", 3, 2), prop("shieldstand", 10, 2)],
    guards: [
      makeGuard("sb_g1", "Drill Master", "securis", "heavy", { maxHealth: 95, maxStamina: 65, attack: 12, defense: 6, agility: 4 }, 0x2f6b4a, {
        at: [14, 4],
      }),
      makeGuard("sb_g2", "Spear Hand", "spear", "spear", { maxHealth: 75, maxStamina: 80, attack: 9, defense: 5, agility: 8 }, 0x2f6b4a, {
        at: [16, 7],
      }),
      makeGuard("sb_g3", "Net Man", "trident_net", "spear", { maxHealth: 72, maxStamina: 78, attack: 8, defense: 4, agility: 7 }, 0x2f6b4a, {
        at: [14, 10],
      }),
    ],
    doors: [
      { to: "serp_yard", ...cell(1, 7), label: "Yard" },
      { to: "serp_cipher", ...cell(18, 7), label: "Coil Shrine", requiresClear: true },
    ],
  },
  {
    id: "serp_cipher",
    name: "Coil Shrine",
    kind: "puzzle",
    cols: 18,
    rows: 12,
    spawn: cell(2, 6),
    allySpawns: [cell(2, 4), cell(2, 8)],
    floorTex: "tile-stone",
    props: [prop("brazier", 9, 9), prop("vine", 4, 2), prop("vine", 14, 2)],
    guards: [],
    rest: cell(4, 9),
    puzzle: facingPuzzle("serpent", "right", "Turn them toward the way out.", [
      [7, 5, "down"],
      [9, 5, "left"],
      [11, 5, "up"],
    ]),
    doors: [
      { to: "serp_barracks", ...cell(1, 6), label: "Barracks" },
      { to: "serp_cells", ...cell(16, 6), label: "Cells", requiresClear: true },
    ],
  },
  {
    id: "serp_cells",
    name: "Slave Cells",
    kind: "combat",
    cols: 20,
    rows: 14,
    spawn: cell(2, 7),
    allySpawns: [cell(2, 5), cell(2, 9)],
    floorTex: "tile-sand",
    props: [prop("rack", 4, 3), prop("vine", 16, 2), prop("vine", 16, 11)],
    guards: [
      makeGuard("sc_g1", "Cell Warden", "malleus", "heavy", { maxHealth: 100, maxStamina: 60, attack: 13, defense: 7, agility: 3 }, 0x2f6b4a, {
        at: [15, 4],
      }),
      makeGuard("sc_g2", "Chain Hand", "gladius", "defensive", { maxHealth: 80, maxStamina: 70, attack: 9, defense: 8, agility: 5 }, 0x2f6b4a, {
        at: [15, 10],
      }),
    ],
    doors: [
      { to: "serp_cipher", ...cell(1, 7), label: "Coil Shrine" },
      { to: "serp_boss", ...cell(18, 7), label: "Captain's Hall", requiresClear: true },
    ],
  },
  {
    id: "serp_boss",
    name: "Captain's Hall",
    kind: "boss",
    cols: 22,
    rows: 16,
    spawn: cell(3, 8),
    allySpawns: [cell(3, 6), cell(3, 10)],
    floorTex: "tile-sand-coil",
    props: [prop("vine", 5, 2), prop("vine", 17, 2), prop("brazier", 11, 3), prop("brazier", 11, 13)],
    guards: [],
    boss: makeGuard(
      "serp_captain",
      "Captain Virex",
      "trident_net",
      "champion",
      { maxHealth: 160, maxStamina: 100, attack: 14, defense: 8, agility: 9 },
      0x1a4a32,
      { at: [16, 8] },
    ),
    doors: [{ to: "serp_cells", ...cell(1, 8), label: "Cells" }],
  },
];

export const SERPENS_RAID: RaidDef = {
  houseId: "serpens",
  startRoom: "serp_yard",
  rooms: SERPENS_ROOMS,
  alertMode: "ripple",
  torchTint: 0x2f6b4a,
  victory: {
    title: "Serpens Freed",
    body: "You return with the freed.",
  },
};

export function getSerpensRoom(id: string): RaidRoomDef | undefined {
  return SERPENS_ROOMS.find((r) => r.id === id);
}
