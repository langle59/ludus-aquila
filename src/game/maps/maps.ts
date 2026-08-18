import { TILE_SIZE } from "../config";
import { houseArenaLabel, houseBannerTex, houseCrowdTint } from "../data/houses";
import { gameState } from "../state/GameState";
import { camp } from "../data/camp";
import { nextUnlockedRaidHouse, raidHouseShortName } from "../data/raid";

export interface MapDef {
  id: string;
  cols: number;
  rows: number;
  labels: { x: number; y: number; text: string }[];
}

export const LUDUS_META: MapDef = {
  id: "ludus",
  cols: 62,
  rows: 36,
  labels: [
    { x: 20.5, y: 1.35, text: "LANISTA" },
    { x: 6.5, y: 13.35, text: "ROOST" },
    { x: 8, y: 21.35, text: "SHRINE" },
    { x: 19.5, y: 14.2, text: "ARMORY" },
    { x: 37, y: 1.35, text: "HALL" },
    { x: 54.5, y: 7.2, text: "QUARTERS" },
    { x: 54, y: 25.35, text: "FEAST" },
    { x: 31.5, y: 14.2, text: "TRAINING YARD" },
    { x: 23.5, y: 32.6, text: "ARENA GATE" },
    { x: 2.2, y: 30.2, text: "WEST GATE" },
  ],
};

export const DRILL_YARD_LABELS: { x: number; y: number; text: string }[] = [
  { x: 54, y: 12.35, text: "LOCKERS" },
  { x: 51, y: 14.2, text: "TITUS" },
  { x: 57, y: 14.2, text: "BROM" },
  { x: 51, y: 21.2, text: "AELIA" },
  { x: 57, y: 21.2, text: "RUFUS" },
];

export function arenaMetaFor(houseId: string): MapDef {
  return {
    id: "arena",
    cols: 32,
    rows: 22,
    labels: [{ x: 16, y: 1.2, text: houseArenaLabel(houseId) }],
  };
}

export const ARENA_META: MapDef = arenaMetaFor("serpens");

export interface BuiltMap {
  cols: number;
  rows: number;
  solids: { x: number; y: number }[];
  spawns: Record<string, { x: number; y: number }>;
  props: { kind: string; x: number; y: number; id?: string }[];
  tiles: { tex: string; x: number; y: number }[];
  torchTint?: number;
}

function cell(tx: number, ty: number): { x: number; y: number } {
  return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
}

function addRect(
  tiles: BuiltMap["tiles"],
  solids: BuiltMap["solids"],
  tex: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  solid = false,
): void {
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      tiles.push({ tex, x: tx * TILE_SIZE, y: ty * TILE_SIZE });
      if (solid) solids.push(cell(tx, ty));
    }
  }
}

export function buildLudus(): BuiltMap {
  const cols = LUDUS_META.cols;
  const rows = LUDUS_META.rows;
  const tiles: BuiltMap["tiles"] = [];
  const solids: BuiltMap["solids"] = [];
  const spawns: BuiltMap["spawns"] = {};
  const props: BuiltMap["props"] = [];

  addRect(tiles, solids, "tile-yard", 0, 0, cols - 1, rows - 1);

  for (let tx = 0; tx < cols; tx++) {
    addRect(tiles, solids, "tile-wall", tx, 0, tx, 0, true);
    addRect(tiles, solids, "tile-wall", tx, rows - 1, tx, rows - 1, true);
  }
  for (let ty = 0; ty < rows; ty++) {
    addRect(tiles, solids, "tile-wall", 0, ty, 0, ty, true);
    addRect(tiles, solids, "tile-wall", cols - 1, ty, cols - 1, ty, true);
  }

  const yardBanner = gameState.save.playerHouse ? houseBannerTex(gameState.save.playerHouse) : "tile-banner-red";
  // Lanista office — enclosed bay west of the Hall
  addRect(tiles, solids, "tile-stone", 1, 1, 25, 5);
  addRect(tiles, solids, "tile-mosaic", 19, 2, 22, 4);
  addRect(tiles, solids, yardBanner, 16, 1, 17, 1, true);
  addRect(tiles, solids, yardBanner, 23, 1, 24, 1, true);
  addRect(tiles, solids, "tile-wall", 14, 1, 15, 5, true);
  addRect(tiles, solids, "tile-wall", 1, 5, 13, 5, true);
  // Complete the office: east wall up to the top, south wall across
  addRect(tiles, solids, "tile-wall", 26, 1, 26, 5, true);
  addRect(tiles, solids, "tile-wall", 16, 5, 25, 5, true);
  // South door into the sand corridor toward the yard / Hall wing
  addRect(tiles, solids, "tile-sand", 20, 5, 21, 5);
  solids.push(...popSolids(solids, 20, 5, 21, 5));
  // Sand approach left of the Hall
  addRect(tiles, solids, "tile-sand", 11, 6, 25, 12);
  solids.push(...popSolids(solids, 11, 6, 25, 12));
  spawns.lanista = cell(20, 3);
  if (gameState.save.lanistaUnlocked) paintChamber(tiles, solids, props, spawns);
  else {
    // Closed loft above Quarters until lanista
    addRect(tiles, solids, "tile-wall", 49, 1, 60, 5, true);
  }

  // Open sand where the old Armory stood — clear path lanista → yard
  addRect(tiles, solids, "tile-sand", 1, 6, 10, 12);
  solids.push(...popSolids(solids, 1, 6, 10, 12));

  // Hall — symmetrical bay under the top wall
  addRect(tiles, solids, "tile-wood-pale", 27, 1, 47, 12);
  addRect(tiles, solids, "tile-wood-pale", 26, 6, 26, 12);
  // Centered mosaic (room center x ≈ 37)
  addRect(tiles, solids, "tile-mosaic", 32, 4, 42, 9);
  addRect(tiles, solids, "tile-wall", 26, 6, 26, 12, true);
  addRect(tiles, solids, "tile-wall", 26, 12, 47, 12, true);
  addRect(tiles, solids, "tile-wall", 47, 1, 47, 12, true);
  addRect(tiles, solids, yardBanner, 36, 1, 37, 1, true);
  // Door from lanista office into the Hall
  addRect(tiles, solids, "tile-wood-pale", 26, 3, 26, 4);
  solids.push(...popSolids(solids, 26, 3, 26, 4));
  // West door from the sand corridor into the Hall wing
  addRect(tiles, solids, "tile-wood-pale", 26, 9, 26, 10);
  solids.push(...popSolids(solids, 26, 9, 26, 10));
  // Centered south door onto the sand
  addRect(tiles, solids, "tile-wood-pale", 36, 12, 38, 12);
  solids.push(...popSolids(solids, 36, 12, 38, 12));
  // East door toward Quarters
  addRect(tiles, solids, "tile-wood-pale", 47, 9, 47, 10);
  solids.push(...popSolids(solids, 47, 9, 47, 10));
  // Three gambling tables in a centered row
  props.push({ kind: "dice", ...cell(33, 7) });
  props.push({ kind: "dice", ...cell(37, 7) });
  props.push({ kind: "dice", ...cell(41, 7) });
  spawns.rufusHall = cell(45, 3);

  // Short link Hall → Quarters
  addRect(tiles, solids, "tile-stone", 48, 9, 48, 10);
  solids.push(...popSolids(solids, 48, 9, 48, 10));

  // Quarters — absolute top-right
  addRect(tiles, solids, "tile-wood-pale", 49, 6, 60, 12);
  addRect(tiles, solids, "tile-rug-quarters", 52, 8, 57, 10);
  addRect(tiles, solids, "tile-wall", 49, 6, 49, 12, true);
  addRect(tiles, solids, "tile-wall", 49, 12, 60, 12, true);
  addRect(tiles, solids, "tile-wall", 60, 6, 60, 12, true);
  addRect(tiles, solids, "tile-wall", 49, 6, 60, 6, true);
  addRect(tiles, solids, "tile-wood-pale", 49, 9, 49, 10);
  solids.push(...popSolids(solids, 49, 9, 49, 10));
  props.push({ kind: "bed", ...cell(58, 7) });
  props.push({ kind: "chest", ...cell(58, 8) });
  props.push({ kind: "bed", ...cell(58, 9) });
  props.push({ kind: "chest", ...cell(58, 10) });
  props.push({ kind: "shop", ...cell(55, 11) });
  // Chamber stairs through Quarters north wall (paintChamber runs before Quarters)
  if (gameState.save.lanistaUnlocked) {
    addRect(tiles, solids, "tile-wood-pale", 54, 6, 55, 6);
    solids.push(...popSolids(solids, 54, 6, 55, 6));
  }

  // Keep Hall south door walkable onto the Training Yard
  addRect(tiles, solids, "tile-wood-pale", 36, 12, 38, 12);
  solids.push(...popSolids(solids, 36, 12, 38, 12));

  // Drill Yard between spar and far right — sealed until lanista
  if (gameState.save.lanistaUnlocked) {
    paintDrillYard(tiles, solids, props, spawns);
  } else {
    addRect(tiles, solids, "tile-wall", 48, 13, 60, 25, true);
  }

  addRect(tiles, solids, "tile-wood", 1, 14, 12, 21);
  addRect(tiles, solids, "tile-straw", 4, 16, 9, 19);
  addRect(tiles, solids, "tile-wall", 1, 14, 12, 14, true);
  addRect(tiles, solids, yardBanner, 6, 14, 7, 14, true);
  addRect(tiles, solids, "tile-wall", 12, 14, 12, 21, true);
  addRect(tiles, solids, "tile-wall", 1, 21, 12, 21, true);
  addRect(tiles, solids, "tile-wood", 12, 17, 12, 18);
  solids.push(...popSolids(solids, 12, 17, 12, 18));
  addRect(tiles, solids, "tile-wood", 6, 21, 7, 21);
  solids.push(...popSolids(solids, 6, 21, 7, 21));
  spawns.pal = cell(5, 17);
  props.push({ kind: "perch", ...cell(3, 15) });
  props.push({ kind: "nest", ...cell(5, 17) });
  props.push({ kind: "bowl", ...cell(8, 15) });
  props.push({ kind: "hook", ...cell(10, 15) });

  paintTrainingYard(tiles, solids, props, spawns);

  addRect(tiles, solids, "tile-shrine", 1, 22, 15, 29);
  addRect(tiles, solids, "tile-mosaic", 3, 24, 13, 27);
  addRect(tiles, solids, "tile-wall", 1, 22, 15, 22, true);
  addRect(tiles, solids, "tile-wall", 1, 29, 15, 29, true);
  addRect(tiles, solids, "tile-wall", 15, 22, 15, 29, true);
  addRect(tiles, solids, yardBanner, 2, 22, 3, 22, true);
  addRect(tiles, solids, yardBanner, 13, 22, 14, 22, true);
  addRect(tiles, solids, yardBanner, 3, 29, 4, 29, true);
  addRect(tiles, solids, yardBanner, 12, 29, 13, 29, true);
  addRect(tiles, solids, "tile-shrine", 6, 22, 7, 22);
  solids.push(...popSolids(solids, 6, 22, 7, 22));
  addRect(tiles, solids, "tile-shrine", 15, 25, 15, 26);
  solids.push(...popSolids(solids, 15, 25, 15, 26));
  props.push({ kind: "lararium", ...cell(2, 25) });
  props.push({ kind: "altar", ...cell(3, 25) });
  spawns.shrine = cell(2, 25);

  // Sand apron south of the Training Yard — path toward the SE feast / arena
  addRect(tiles, solids, "tile-sand", 32, 25, 47, 30);
  solids.push(...popSolids(solids, 32, 25, 47, 30));
  addRect(tiles, solids, "tile-sand", 22, 25, 25, 29);
  solids.push(...popSolids(solids, 22, 25, 25, 29));

  // Feast — bottom-right, south of the Drill Yard
  addRect(tiles, solids, "tile-wood-pale", 48, 26, 60, 33);
  addRect(tiles, solids, "tile-feast-rug", 50, 28, 58, 31);
  addRect(tiles, solids, "tile-wall", 48, 26, 60, 26, true);
  addRect(tiles, solids, "tile-wall", 48, 33, 60, 33, true);
  addRect(tiles, solids, "tile-wall", 48, 26, 48, 33, true);
  addRect(tiles, solids, "tile-wall", 60, 26, 60, 33, true);
  addRect(tiles, solids, yardBanner, 49, 26, 50, 26, true);
  addRect(tiles, solids, yardBanner, 58, 26, 59, 26, true);
  addRect(tiles, solids, yardBanner, 50, 33, 51, 33, true);
  addRect(tiles, solids, yardBanner, 57, 33, 58, 33, true);
  // West door from the sand courtyard
  addRect(tiles, solids, "tile-wood-pale", 48, 29, 48, 30);
  solids.push(...popSolids(solids, 48, 29, 48, 30));
  props.push({ kind: "feast-table", ...cell(51, 28) });
  props.push({ kind: "feast-table", ...cell(54, 28) });
  props.push({ kind: "feast-table", ...cell(57, 28) });
  props.push({ kind: "feast-table", ...cell(51, 31) });
  props.push({ kind: "feast-table", ...cell(54, 31) });
  props.push({ kind: "feast-table", ...cell(57, 31) });
  props.push({ kind: "wine", ...cell(58, 28) });
  props.push({ kind: "beer", ...cell(58, 31) });
  spawns.feast = cell(54, 29);
  spawns.titusFeast = cell(51, 27);
  spawns.bromFeast = cell(57, 27);
  spawns.aeliaFeast = cell(51, 32);
  spawns.rufusFeast = cell(57, 32);

  addRect(tiles, solids, "tile-stone", 1, 31, 46, 34);
  addRect(tiles, solids, yardBanner, 2, 31, 3, 31, true);
  addRect(tiles, solids, yardBanner, 44, 31, 45, 31, true);
  addRect(tiles, solids, "tile-wall", 1, 30, 21, 30, true);
  addRect(tiles, solids, "tile-wall", 26, 30, 46, 30, true);
  addRect(tiles, solids, "tile-sand", 22, 30, 25, 34);
  popSolids(solids, 22, 30, 25, 30);
  addRect(tiles, solids, "tile-gate", 22, 34, 25, 35);
  popSolids(solids, 22, 35, 25, 35);
  spawns.player = { x: 32 * TILE_SIZE, y: 19 * TILE_SIZE };
  spawns.gate = { x: 24 * TILE_SIZE, y: 34 * TILE_SIZE + 16 };
  props.push({ kind: "gate", x: 24 * TILE_SIZE, y: 34 * TILE_SIZE + 16 });

  // Act 4 west gate — vertical opening flush with the left wall
  addRect(tiles, solids, "tile-stone", 1, 30, 5, 34);
  popSolids(solids, 1, 30, 5, 34);
  // Carve doorway in outer west wall (3 tiles tall)
  addRect(tiles, solids, "tile-gate", 0, 31, 0, 33);
  popSolids(solids, 0, 31, 0, 33);
  // Threshold + short approach
  addRect(tiles, solids, "tile-sand", 1, 31, 3, 33);
  popSolids(solids, 1, 31, 3, 33);
  // Flanking wall banners on the west rim
  addRect(tiles, solids, yardBanner, 0, 30, 0, 30, true);
  addRect(tiles, solids, yardBanner, 0, 34, 0, 34, true);
  spawns.westGate = cell(2, 32);
  props.push({ kind: "west_gate", ...cell(1, 32) });

  return { cols, rows, solids, spawns, props, tiles };
}

export function inFeastTiles(tx: number, ty: number): boolean {
  return tx >= 48 && tx <= 60 && ty >= 26 && ty <= 33;
}

export function inShrineTiles(tx: number, ty: number): boolean {
  return tx >= 1 && tx <= 15 && ty >= 22 && ty <= 29;
}

export function inChamberTiles(tx: number, ty: number): boolean {
  return tx >= 49 && tx <= 60 && ty >= 1 && ty <= 5;
}

export function inDrillYardTiles(tx: number, ty: number): boolean {
  return tx >= 48 && tx <= 60 && ty >= 13 && ty <= 25;
}

export function inTrainingYardTiles(tx: number, ty: number): boolean {
  return tx >= 16 && tx <= 47 && ty >= 13 && ty <= 24;
}

export function inHallTiles(tx: number, ty: number): boolean {
  return (tx >= 27 && tx <= 47 && ty >= 1 && ty <= 12) || (tx === 26 && ty >= 6 && ty <= 12);
}

export function inQuartersTiles(tx: number, ty: number): boolean {
  return tx >= 49 && tx <= 60 && ty >= 6 && ty <= 12;
}

export function inRoostTiles(tx: number, ty: number): boolean {
  return tx >= 1 && tx <= 12 && ty >= 14 && ty <= 21;
}

export function inLanistaTiles(tx: number, ty: number): boolean {
  return tx >= 1 && tx <= 25 && ty >= 1 && ty <= 5;
}

export function inArmoryTiles(tx: number, ty: number): boolean {
  return tx >= 17 && tx <= 21 && ty >= 14 && ty <= 16;
}

export function inArenaGateTiles(tx: number, ty: number): boolean {
  return ty >= 30 && ty <= 35 && tx >= 1 && tx <= 46;
}

/** Current ludus zone name for HUD / minimap. */
export function ludusAreaName(tx: number, ty: number): string {
  if (inArmoryTiles(tx, ty)) return "Armory";
  if (inChamberTiles(tx, ty)) return "Chamber";
  if (inQuartersTiles(tx, ty)) return "Quarters";
  if (inLanistaTiles(tx, ty)) return "Lanista";
  if (inHallTiles(tx, ty)) return "Hall";
  if (inDrillYardTiles(tx, ty) && gameState.save.lanistaUnlocked) return "Lockers";
  if (inFeastTiles(tx, ty)) return "Feast";
  if (inRoostTiles(tx, ty)) return "Roost";
  if (inShrineTiles(tx, ty)) return "Shrine";
  if (inTrainingYardTiles(tx, ty)) return "Training Yard";
  if (inArenaGateTiles(tx, ty)) return "Arena Gate";
  return "Ludus";
}

export type DrillStationId = "titus" | "brom" | "aelia" | "rufus";

export function drillCourtBounds(_id: DrillStationId): { x0: number; y0: number; x1: number; y1: number } {
  // Active drills play in the Training Yard ring; pads only start them.
  return { x0: 24, y0: 15, x1: 40, y1: 22 };
}

function paintChamber(
  tiles: BuiltMap["tiles"],
  solids: BuiltMap["solids"],
  _props: BuiltMap["props"],
  spawns: BuiltMap["spawns"],
): void {
  // Walled loft above Quarters — entrance only from Quarters below
  addRect(tiles, solids, "tile-wood-pale", 50, 1, 59, 4);
  addRect(tiles, solids, "tile-wall", 49, 1, 49, 5, true);
  addRect(tiles, solids, "tile-wall", 60, 1, 60, 5, true);
  addRect(tiles, solids, "tile-wall", 49, 5, 53, 5, true);
  addRect(tiles, solids, "tile-wall", 56, 5, 60, 5, true);
  addRect(tiles, solids, "tile-wall", 49, 1, 60, 1, true);
  // Entrance stairs down into Quarters
  addRect(tiles, solids, "tile-wood-pale", 54, 5, 55, 5);
  solids.push(...popSolids(solids, 54, 5, 55, 5));
  addRect(tiles, solids, "tile-wood-pale", 54, 6, 55, 6);
  solids.push(...popSolids(solids, 54, 6, 55, 6));
  spawns.chamber = cell(55, 3);
}

/** Everyday training compound — west of Drill, south of Hall. */
function paintTrainingYard(
  tiles: BuiltMap["tiles"],
  solids: BuiltMap["solids"],
  props: BuiltMap["props"],
  spawns: BuiltMap["spawns"],
): void {
  const yardBanner = gameState.save.playerHouse ? houseBannerTex(gameState.save.playerHouse) : "tile-banner-red";

  // Full compound floor
  addRect(tiles, solids, "tile-sand", 17, 14, 46, 23);
  solids.push(...popSolids(solids, 17, 14, 46, 23));

  // Fence shell
  addRect(tiles, solids, "tile-fence", 16, 13, 47, 13, true);
  addRect(tiles, solids, "tile-fence", 16, 24, 47, 24, true);
  addRect(tiles, solids, "tile-fence", 16, 13, 16, 24, true);
  addRect(tiles, solids, "tile-fence", 47, 13, 47, 24, true);

  // Gates — Hall (N), Roost (W), Drill (E), Arena (S), Feast apron (SE)
  addRect(tiles, solids, "tile-sand", 22, 13, 25, 13);
  solids.push(...popSolids(solids, 22, 13, 25, 13));
  addRect(tiles, solids, "tile-sand", 36, 13, 38, 13);
  solids.push(...popSolids(solids, 36, 13, 38, 13));
  addRect(tiles, solids, yardBanner, 34, 13, 35, 13, true);
  addRect(tiles, solids, yardBanner, 39, 13, 40, 13, true);
  addRect(tiles, solids, "tile-sand", 16, 17, 16, 18);
  solids.push(...popSolids(solids, 16, 17, 16, 18));
  addRect(tiles, solids, "tile-sand", 47, 17, 47, 18);
  solids.push(...popSolids(solids, 47, 17, 47, 18));
  addRect(tiles, solids, "tile-sand", 22, 24, 25, 26);
  solids.push(...popSolids(solids, 22, 24, 25, 26));
  addRect(tiles, solids, "tile-sand", 40, 24, 43, 24);
  solids.push(...popSolids(solids, 40, 24, 43, 24));
  addRect(tiles, solids, "tile-sand", 16, 24, 16, 26);
  solids.push(...popSolids(solids, 16, 24, 16, 26));
  addRect(tiles, solids, "tile-stone", 16, 25, 16, 26);

  // Center spar / lesson floor — keep the middle clear
  addRect(tiles, solids, "tile-ring", 23, 15, 41, 22);
  spawns.dummy = { x: 32 * TILE_SIZE, y: 18.5 * TILE_SIZE };
  spawns.sparRing = { x: 32 * TILE_SIZE, y: 18.5 * TILE_SIZE };

  // Armory bay — NW corner of the yard (off the west gate lane at 16,17–18)
  addRect(tiles, solids, "tile-wood", 17, 14, 21, 16);
  addRect(tiles, solids, "tile-rug-armory", 18, 14, 20, 15);
  addRect(tiles, solids, "tile-fence", 17, 16, 21, 16, true);
  addRect(tiles, solids, "tile-wood", 19, 16, 19, 16);
  solids.push(...popSolids(solids, 19, 16, 19, 16));
  spawns.rack = cell(19, 15);
  props.push({ kind: "rack", ...cell(19, 15) });
  props.push({ kind: "shieldstand", ...cell(17, 14) });

  // West dummy alley — teaching posts off the open ring (paths kept clear)
  addRect(tiles, solids, "tile-dirt", 18, 17, 21, 22);
  props.push({ kind: "dummy", x: 19.5 * TILE_SIZE, y: 18 * TILE_SIZE });
  props.push({ kind: "dummy", x: 19.5 * TILE_SIZE, y: 19.5 * TILE_SIZE });
  props.push({ kind: "dummy", x: 19.5 * TILE_SIZE, y: 21 * TILE_SIZE });

  // East footwork lanes — open sand against the east fence
  addRect(tiles, solids, "tile-sand-stripe", 44, 15, 44, 22);
  addRect(tiles, solids, "tile-sand-stripe", 45, 15, 45, 22);

  // House gladiators lined up above the spar ring (Rufus keeps the SE post for Hall seating)
  spawns.brom = cell(28, 14);
  spawns.aelia = cell(32, 14);
  spawns.titus = cell(36, 14);
  spawns.rufus = cell(45, 22);
}

/** East compound — four student locker rooms (replaces drill stations). */
function paintDrillYard(
  tiles: BuiltMap["tiles"],
  solids: BuiltMap["solids"],
  props: BuiltMap["props"],
  spawns: BuiltMap["spawns"],
): void {
  // Short apron into the Training Yard east gate (yard owns the interior)
  addRect(tiles, solids, "tile-sand", 47, 17, 47, 18);
  solids.push(...popSolids(solids, 47, 17, 47, 18));

  // Compound shell (below Quarters)
  addRect(tiles, solids, "tile-sand", 48, 13, 60, 25);
  addRect(tiles, solids, "tile-wall", 48, 13, 60, 13, true);
  addRect(tiles, solids, "tile-wall", 48, 25, 60, 25, true);
  addRect(tiles, solids, "tile-wall", 48, 13, 48, 25, true);
  addRect(tiles, solids, "tile-wall", 60, 13, 60, 25, true);
  // West door onto the sand
  addRect(tiles, solids, "tile-sand", 48, 17, 48, 18);
  solids.push(...popSolids(solids, 48, 17, 48, 18));
  // Corridor cross
  addRect(tiles, solids, "tile-sand", 49, 18, 59, 18);
  addRect(tiles, solids, "tile-sand", 54, 14, 54, 24);

  const yardBanner = gameState.save.playerHouse ? houseBannerTex(gameState.save.playerHouse) : "tile-banner-red";
  addRect(tiles, solids, yardBanner, 50, 13, 51, 13, true);
  addRect(tiles, solids, yardBanner, 57, 13, 58, 13, true);

  // Interior divider walls between bays (doors onto cross corridor)
  addRect(tiles, solids, "tile-wall", 49, 17, 53, 17, true);
  addRect(tiles, solids, "tile-wall", 55, 17, 59, 17, true);
  addRect(tiles, solids, "tile-wall", 49, 19, 53, 19, true);
  addRect(tiles, solids, "tile-wall", 55, 19, 59, 19, true);
  addRect(tiles, solids, "tile-wall", 54, 14, 54, 17, true);
  addRect(tiles, solids, "tile-wall", 54, 19, 54, 24, true);
  // Door gaps from corridor into each locker
  addRect(tiles, solids, "tile-wood", 51, 17, 51, 17);
  solids.push(...popSolids(solids, 51, 17, 51, 17));
  addRect(tiles, solids, "tile-wood", 57, 17, 57, 17);
  solids.push(...popSolids(solids, 57, 17, 57, 17));
  addRect(tiles, solids, "tile-wood", 51, 19, 51, 19);
  solids.push(...popSolids(solids, 51, 19, 51, 19));
  addRect(tiles, solids, "tile-wood", 57, 19, 57, 19);
  solids.push(...popSolids(solids, 57, 19, 57, 19));
  addRect(tiles, solids, "tile-sand", 54, 17, 54, 19);
  solids.push(...popSolids(solids, 54, 17, 54, 19));

  // NW Titus — shield / defense
  addRect(tiles, solids, "tile-wood", 49, 14, 53, 16);
  props.push({ kind: "bed", ...cell(49, 14) });
  props.push({ kind: "chest", ...cell(53, 14) });
  props.push({ kind: "bench", ...cell(49, 16) });
  props.push({ kind: "locker", x: cell(51, 15).x, y: cell(51, 15).y, id: "titus" });
  spawns.drillTitus = cell(51, 15);
  spawns.lockerTitus = cell(51, 15);

  // NE Brom — power
  addRect(tiles, solids, "tile-wood", 55, 14, 59, 16);
  props.push({ kind: "bed", ...cell(59, 14) });
  props.push({ kind: "chest", ...cell(55, 14) });
  props.push({ kind: "bench", ...cell(59, 16) });
  props.push({ kind: "locker", x: cell(57, 15).x, y: cell(57, 15).y, id: "brom" });
  spawns.drillBrom = cell(57, 15);
  spawns.lockerBrom = cell(57, 15);

  // SW Aelia — footwork
  addRect(tiles, solids, "tile-wood", 49, 20, 53, 24);
  props.push({ kind: "bed", ...cell(49, 24) });
  props.push({ kind: "chest", ...cell(53, 24) });
  props.push({ kind: "bench", ...cell(49, 20) });
  props.push({ kind: "locker", x: cell(51, 22).x, y: cell(51, 22).y, id: "aelia" });
  spawns.drillAelia = cell(51, 22);
  spawns.lockerAelia = cell(51, 22);

  // SE Rufus — dodge
  addRect(tiles, solids, "tile-wood", 55, 20, 59, 24);
  props.push({ kind: "bed", ...cell(59, 24) });
  props.push({ kind: "chest", ...cell(55, 24) });
  props.push({ kind: "bench", ...cell(59, 20) });
  props.push({ kind: "locker", x: cell(57, 22).x, y: cell(57, 22).y, id: "rufus" });
  spawns.drillRufus = cell(57, 22);
  spawns.lockerRufus = cell(57, 22);

  spawns.drillYard = cell(54, 18);
  spawns.lockers = cell(54, 18);
}

function popSolids(
  solids: { x: number; y: number }[],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { x: number; y: number }[] {
  const keep: { x: number; y: number }[] = [];
  for (const s of solids) {
    const tx = Math.floor(s.x / TILE_SIZE);
    const ty = Math.floor(s.y / TILE_SIZE);
    if (tx < x0 || tx > x1 || ty < y0 || ty > y1) keep.push(s);
  }
  solids.length = 0;
  solids.push(...keep);
  return [];
}

export function buildArena(houseId = "serpens"): BuiltMap {
  const cols = ARENA_META.cols;
  const rows = ARENA_META.rows;
  const tiles: BuiltMap["tiles"] = [];
  const solids: BuiltMap["solids"] = [];
  const spawns: BuiltMap["spawns"] = {};
  const props: BuiltMap["props"] = [];

  addRect(tiles, solids, "tile-stone", 0, 0, cols - 1, rows - 1);
  addRect(tiles, solids, "tile-wall", 0, 0, cols - 1, 0, true);
  addRect(tiles, solids, "tile-wall", 0, rows - 1, cols - 1, rows - 1, true);
  addRect(tiles, solids, "tile-wall", 0, 0, 0, rows - 1, true);
  addRect(tiles, solids, "tile-wall", cols - 1, 0, cols - 1, rows - 1, true);
  const banner = houseId === "rudis" ? "tile-banner-red" : houseBannerTex(houseId);
  addRect(tiles, solids, banner, 1, 1, cols - 2, 1);
  addRect(tiles, solids, banner, 1, rows - 2, cols - 2, rows - 2);

  const inset = houseId === "serpens" ? 3 : 2;
  arenaRing(tiles, solids, cols, rows, inset, pitFloor(houseId));
  dressPit(tiles, solids, props, houseId, cols, rows);
  const starts = pitSpawns(houseId);
  spawns.player = cell(starts.px, starts.py);
  spawns.enemy = cell(starts.ex, starts.ey);

  return {
    cols,
    rows,
    solids,
    spawns,
    props,
    tiles,
    torchTint: houseId === "rudis" ? 0xc45a1a : houseCrowdTint(houseId),
  };
}

function pitFloor(houseId: string): string {
  if (houseId === "serpens") return "tile-sand-coil";
  if (houseId === "lupus") return "tile-dirt";
  if (houseId === "aper") return "tile-sand-mud";
  if (houseId === "taurus") return "tile-sand";
  if (houseId === "tigris") return "tile-sand";
  if (houseId === "leo") return "tile-sand-ivory";
  if (houseId === "ursus") return "tile-sand-earth";
  if (houseId === "rhinoceros") return "tile-sand-stone";
  if (houseId === "elephas") return "tile-sand-ivory";
  return "tile-sand";
}

function pitSpawns(houseId: string): { px: number; py: number; ex: number; ey: number } {
  if (houseId === "serpens") return { px: 16, py: 15, ex: 16, ey: 7 };
  if (houseId === "aper") return { px: 16, py: 15, ex: 16, ey: 7 };
  if (houseId === "taurus") return { px: 16, py: 17, ex: 16, ey: 5 };
  if (houseId === "ursus" || houseId === "elephas") return { px: 16, py: 14, ex: 16, ey: 8 };
  return { px: 16, py: 16, ex: 16, ey: 6 };
}

function arenaRing(
  tiles: BuiltMap["tiles"],
  solids: BuiltMap["solids"],
  cols: number,
  rows: number,
  inset: number,
  floor: string,
): void {
  const x0 = inset;
  const y0 = inset;
  const x1 = cols - 1 - inset;
  const y1 = rows - 1 - inset;
  addRect(tiles, solids, "tile-wall", x0, y0, x1, y0, true);
  addRect(tiles, solids, "tile-wall", x0, y1, x1, y1, true);
  addRect(tiles, solids, "tile-wall", x0, y0, x0, y1, true);
  addRect(tiles, solids, "tile-wall", x1, y0, x1, y1, true);
  addRect(tiles, solids, floor, x0 + 1, y0 + 1, x1 - 1, y1 - 1);
}

function dressPit(
  tiles: BuiltMap["tiles"],
  solids: BuiltMap["solids"],
  props: BuiltMap["props"],
  houseId: string,
  cols: number,
  rows: number,
): void {
  const banner = houseId === "rudis" ? "tile-banner-red" : houseBannerTex(houseId);
  const sideBannerStrip = (x: number, y0: number, y1: number): void => {
    for (let ty = y0; ty <= y1; ty += 2) addRect(tiles, solids, banner, x, ty, x, ty);
  };
  sideBannerStrip(2, 4, rows - 5);
  sideBannerStrip(cols - 3, 4, rows - 5);

  if (houseId === "serpens") {
    overlayRing(tiles, "tile-mosaic", 8, 7, 23, 14);
    overlayRing(tiles, "tile-mosaic", 10, 9, 21, 12);
    props.push({ kind: "pit-ring", ...cell(4, 8) });
    props.push({ kind: "pit-ring", ...cell(27, 8) });
    props.push({ kind: "pit-ring", ...cell(4, 13) });
    props.push({ kind: "pit-ring", ...cell(27, 13) });
    props.push({ kind: "brazier", ...cell(5, 5) });
    props.push({ kind: "brazier", ...cell(26, 5) });
    return;
  }
  if (houseId === "lupus") {
    addRect(tiles, solids, "tile-sand-earth", 6, 4, 7, 5);
    addRect(tiles, solids, "tile-sand-earth", 24, 16, 25, 17);
    addRect(tiles, solids, "tile-sand-earth", 10, 16, 11, 17);
    addRect(tiles, solids, "tile-dirt", 14, 10, 17, 13);
    props.push({ kind: "pit-skull", ...cell(8, 3) });
    props.push({ kind: "pit-skull", ...cell(23, 3) });
    props.push({ kind: "pit-skull", ...cell(8, 18) });
    props.push({ kind: "pit-skull", ...cell(23, 18) });
    props.push({ kind: "hay", ...cell(4, 3) });
    props.push({ kind: "hay", ...cell(27, 18) });
    props.push({ kind: "lamp", ...cell(5, 10) });
    props.push({ kind: "lamp", ...cell(26, 10) });
    return;
  }
  if (houseId === "aper") {
    addRect(tiles, solids, "tile-dirt", 5, 8, 8, 10);
    addRect(tiles, solids, "tile-dirt", 23, 11, 26, 13);
    addRect(tiles, solids, "tile-sand-mud", 13, 9, 18, 12);
    props.push({ kind: "pit-tusk", ...cell(3, 8) });
    props.push({ kind: "pit-tusk", ...cell(3, 13) });
    props.push({ kind: "pit-tusk", ...cell(28, 8) });
    props.push({ kind: "pit-tusk", ...cell(28, 13) });
    props.push({ kind: "brazier", ...cell(6, 6) });
    props.push({ kind: "brazier", ...cell(25, 15) });
    return;
  }
  if (houseId === "taurus") {
    for (let ty = 4; ty <= 17; ty++) {
      addRect(tiles, solids, "tile-sand-stripe", 12, ty, 13, ty);
      addRect(tiles, solids, "tile-sand-stripe", 18, ty, 19, ty);
    }
    addRect(tiles, solids, "tile-sand-stone", 14, 9, 17, 12);
    props.push({ kind: "pit-horn", ...cell(3, 6) });
    props.push({ kind: "pit-horn", ...cell(3, 15) });
    props.push({ kind: "pit-horn", ...cell(28, 6) });
    props.push({ kind: "pit-horn", ...cell(28, 15) });
    props.push({ kind: "brazier", ...cell(5, 11) });
    props.push({ kind: "brazier", ...cell(26, 11) });
    return;
  }
  if (houseId === "tigris") {
    for (let ty = 5; ty <= 16; ty += 3) addRect(tiles, solids, "tile-sand-stripe", 4, ty, 27, ty);
    addRect(tiles, solids, "tile-sand-mud", 12, 8, 19, 13);
    props.push({ kind: "vine", ...cell(3, 7) });
    props.push({ kind: "vine", ...cell(3, 14) });
    props.push({ kind: "vine", ...cell(28, 7) });
    props.push({ kind: "vine", ...cell(28, 14) });
    props.push({ kind: "lamp", ...cell(8, 5) });
    props.push({ kind: "lamp", ...cell(23, 16) });
    return;
  }
  if (houseId === "leo") {
    addRect(tiles, solids, "tile-mosaic", 12, 8, 19, 13);
    overlayRing(tiles, "tile-mosaic", 11, 7, 20, 14);
    props.push({ kind: "brazier", ...cell(3, 3) });
    props.push({ kind: "brazier", ...cell(28, 3) });
    props.push({ kind: "brazier", ...cell(3, 18) });
    props.push({ kind: "brazier", ...cell(28, 18) });
    props.push({ kind: "lamp", ...cell(10, 6) });
    props.push({ kind: "lamp", ...cell(21, 15) });
    return;
  }
  if (houseId === "ursus") {
    addRect(tiles, solids, "tile-sand-mud", 14, 9, 17, 12);
    addRect(tiles, solids, "tile-sand-earth", 10, 7, 21, 14);
    props.push({ kind: "pit-log", ...cell(8, 3) });
    props.push({ kind: "pit-log", ...cell(23, 3) });
    props.push({ kind: "pit-log", ...cell(8, 18) });
    props.push({ kind: "pit-log", ...cell(23, 18) });
    props.push({ kind: "brazier", ...cell(6, 10) });
    props.push({ kind: "brazier", ...cell(25, 10) });
    return;
  }
  if (houseId === "rhinoceros") {
    addRect(tiles, solids, "tile-stone", 3, 3, 5, 18);
    addRect(tiles, solids, "tile-stone", 26, 3, 28, 18);
    addRect(tiles, solids, "tile-sand-stone", 13, 9, 18, 12);
    props.push({ kind: "pit-horn", ...cell(3, 7) });
    props.push({ kind: "pit-horn", ...cell(3, 14) });
    props.push({ kind: "pit-horn", ...cell(28, 7) });
    props.push({ kind: "pit-horn", ...cell(28, 14) });
    props.push({ kind: "lamp", ...cell(7, 8) });
    props.push({ kind: "lamp", ...cell(24, 13) });
    return;
  }
  if (houseId === "elephas") {
    addRect(tiles, solids, "tile-mosaic", 10, 7, 21, 14);
    overlayRing(tiles, "tile-mosaic", 11, 8, 20, 13);
    props.push({ kind: "pit-ivory", ...cell(16, 3) });
    props.push({ kind: "pit-ivory", ...cell(16, 18) });
    props.push({ kind: "pit-ivory", ...cell(3, 10) });
    props.push({ kind: "pit-ivory", ...cell(28, 10) });
    props.push({ kind: "brazier", ...cell(8, 6) });
    props.push({ kind: "brazier", ...cell(23, 15) });
    return;
  }
  props.push({ kind: "lamp", ...cell(3, 3) });
  props.push({ kind: "lamp", ...cell(cols - 4, 3) });
  props.push({ kind: "lamp", ...cell(3, rows - 4) });
  props.push({ kind: "lamp", ...cell(cols - 4, rows - 4) });
}

function overlayRing(
  tiles: BuiltMap["tiles"],
  tex: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  addRect(tiles, [], tex, x0, y0, x1, y0);
  addRect(tiles, [], tex, x0, y1, x1, y1);
  addRect(tiles, [], tex, x0, y0, x0, y1);
  addRect(tiles, [], tex, x1, y0, x1, y1);
}

export function worldPx(cols: number, rows: number): { w: number; h: number } {
  return { w: cols * TILE_SIZE, h: rows * TILE_SIZE };
}

export const FREED_CAMP_META: MapDef = {
  id: "freedcamp",
  cols: 36,
  rows: 28,
  labels: [],
};

/** Minimap-only zone names for the forest camp. */
export function freedCampAreaName(tx: number, ty: number): string {
  if (tx <= 4 && ty >= 10 && ty <= 16) return "Ludus Path";
  if (tx >= 28 && ty >= 18) {
    const next = nextUnlockedRaidHouse(camp().freedPads);
    return next ? `${raidHouseShortName(next)} Road` : "East trail";
  }
  if (tx <= 3 && ty >= 20 && ty <= 26) return "Livestock";
  if (tx >= 3 && tx <= 14 && ty >= 22 && ty <= 26) return "Pen";
  if (tx >= 3 && tx <= 14 && ty >= 17 && ty <= 21) return "Farm";
  if (tx >= 17 && tx <= 33 && ty >= 1 && ty <= 15) return "Tents";
  if (tx >= 4 && tx <= 14 && ty >= 6 && ty <= 14) return "Commons";
  return "Clearing";
}

/** Hub after Act 3 — hidden forest clearing, tents, farm, stables. */
export function buildFreedCamp(): BuiltMap {
  const cols = FREED_CAMP_META.cols;
  const rows = FREED_CAMP_META.rows;
  const tiles: BuiltMap["tiles"] = [];
  const solids: BuiltMap["solids"] = [];
  const spawns: BuiltMap["spawns"] = {};
  const props: BuiltMap["props"] = [];

  // Soft green forest floor
  addRect(tiles, solids, "tile-sand-earth", 0, 0, cols - 1, rows - 1);
  // Clearing grass pockets
  addRect(tiles, solids, "tile-yard", 4, 5, 15, 15);
  addRect(tiles, solids, "tile-dirt", 3, 16, 15, 25);

  // Dense tree rim instead of bare stone walls
  for (let tx = 0; tx < cols; tx++) {
    props.push({ kind: "tree", ...cell(tx, 0) });
    props.push({ kind: "tree", ...cell(tx, rows - 1) });
    solids.push(cell(tx, 0));
    solids.push(cell(tx, rows - 1));
  }
  for (let ty = 1; ty < rows - 1; ty++) {
    // Leave west exit gap for Ludus path
    if (ty < 11 || ty > 14) {
      props.push({ kind: "tree", ...cell(0, ty) });
      solids.push(cell(0, ty));
    }
    // Leave east exit gap for Serpens trail
    if (ty < 20 || ty > 23) {
      props.push({ kind: "tree", ...cell(cols - 1, ty) });
      solids.push(cell(cols - 1, ty));
    }
  }
  // Extra canopy clumps
  for (const [tx, ty] of [
    [2, 2],
    [3, 3],
    [14, 2],
    [15, 3],
    [33, 3],
    [15, 26],
    [20, 26],
    [33, 16],
  ] as [number, number][]) {
    props.push({ kind: "tree", ...cell(tx, ty) });
    solids.push(cell(tx, ty));
  }
  for (const [tx, ty] of [
    [5, 4],
    [12, 4],
    [16, 16],
    [26, 17],
    [8, 26],
  ] as [number, number][]) {
    props.push({ kind: "bush", ...cell(tx, ty) });
  }

  // Commons — packed yard with three stations around the fire
  addRect(tiles, solids, "tile-dirt", 4, 6, 14, 13);
  addRect(tiles, solids, "tile-yard", 8, 9, 10, 11);
  props.push({ kind: "camp_fire", ...cell(9, 10) });
  props.push({ kind: "cassian", ...cell(11, 12) });
  spawns.cassian = cell(11, 12);
  spawns.player = cell(9, 11);
  spawns.fire = cell(9, 10);

  // Armory lean-to — NW pad
  addRect(tiles, solids, "tile-dirt", 4, 6, 7, 9);
  props.push({ kind: "camp_rug", ...cell(6, 8), id: "armory" });
  props.push({ kind: "armory", ...cell(6, 7) });
  props.push({ kind: "crate", ...cell(5, 8) });
  spawns.armory = cell(6, 7);

  // Party ring — NE pad
  addRect(tiles, solids, "tile-dirt", 11, 6, 14, 9);
  props.push({ kind: "camp_rug", ...cell(12, 8), id: "party" });
  props.push({ kind: "party", ...cell(12, 7) });
  props.push({ kind: "bench", ...cell(11, 8) });
  props.push({ kind: "bench", ...cell(13, 8) });
  spawns.party = cell(12, 8);

  // Wardrobe / customize — SW pad
  addRect(tiles, solids, "tile-dirt", 4, 11, 7, 13);
  props.push({ kind: "camp_rug", ...cell(6, 12), id: "wardrobe" });
  props.push({ kind: "camp_wardrobe", ...cell(6, 11) });
  spawns.wardrobe = cell(6, 11);

  // Nine tent clearings (3×3) — east
  const padOrigins = [
    [18, 2],
    [23, 2],
    [28, 2],
    [18, 7],
    [23, 7],
    [28, 7],
    [18, 12],
    [23, 12],
    [28, 12],
  ];
  const houseIds = [
    "serpens",
    "lupus",
    "aper",
    "taurus",
    "tigris",
    "leo",
    "ursus",
    "rhinoceros",
    "elephas",
  ];
  padOrigins.forEach(([ox, oy], i) => {
    addRect(tiles, solids, "tile-sand-earth", ox, oy, ox + 3, oy + 3);
    const cx = ox + 1;
    const cy = oy + 1;
    props.push({ kind: "house_pad", ...cell(cx, cy), id: houseIds[i] });
    spawns[`pad_${houseIds[i]}`] = cell(cx, cy);
  });

  // Crop plots — SW beds (four plots)
  addRect(tiles, solids, "tile-dirt", 4, 16, 15, 21);
  props.push({ kind: "cooking_pot", ...cell(13, 17) });
  spawns.kitchen = cell(13, 17);
  for (let i = 0; i < 4; i++) {
    props.push({ kind: "farm_plot", ...cell(5 + i * 3, 19), id: `p${i}` });
  }
  spawns.farm = cell(8, 19);

  // Livestock pen — fenced corral south of crop beds
  addRect(tiles, solids, "tile-dirt", 4, 21, 14, 25);
  for (let tx = 4; tx <= 14; tx++) {
    tiles.push({ tex: "tile-fence", x: tx * TILE_SIZE, y: 21 * TILE_SIZE });
    tiles.push({ tex: "tile-fence", x: tx * TILE_SIZE, y: 25 * TILE_SIZE });
    solids.push(cell(tx, 21));
    if (tx < 8 || tx > 10) solids.push(cell(tx, 25));
  }
  for (let ty = 22; ty <= 24; ty++) {
    tiles.push({ tex: "tile-fence", x: 4 * TILE_SIZE, y: ty * TILE_SIZE });
    tiles.push({ tex: "tile-fence", x: 14 * TILE_SIZE, y: ty * TILE_SIZE });
    solids.push(cell(4, ty));
    solids.push(cell(14, ty));
  }
  popSolids(solids, 8, 25, 10, 25);
  props.push({ kind: "pen_gate", ...cell(9, 25) });
  spawns.penGate = cell(9, 25);
  spawns.penMin = cell(5, 22);
  spawns.penMax = cell(13, 24);
  props.push({ kind: "hay", ...cell(6, 22) });
  props.push({ kind: "hay", ...cell(12, 22) });
  props.push({ kind: "hay", ...cell(6, 24) });
  props.push({ kind: "hay", ...cell(12, 24) });
  spawns.stables = cell(2, 23);

  // Livestock stall — west of the pen fence (easy to find from the farm)
  addRect(tiles, solids, "tile-dirt", 1, 16, 3, 25);
  popSolids(solids, 1, 20, 3, 25);
  props.push({ kind: "livestock_stall", ...cell(2, 22) });
  props.push({ kind: "pen_trader", ...cell(2, 23) });
  props.push({ kind: "hay", ...cell(1, 23) });
  spawns.penTrader = cell(2, 23);

  // Dirt path west → Ludus (clearly marked trail)
  addRect(tiles, solids, "tile-dirt", 1, 11, 5, 14);
  popSolids(solids, 1, 11, 5, 14);
  // Open west rim for exit
  popSolids(solids, 0, 11, 0, 14);
  addRect(tiles, solids, "tile-gate", 0, 11, 0, 14);
  popSolids(solids, 0, 11, 0, 14);
  props.push({ kind: "ludus_gate", ...cell(1, 12) });
  props.push({ kind: "ludus_plaque", ...cell(3, 12) });
  spawns.ludusGate = cell(1, 12);

  // Quiet trail SE → Serpens march
  addRect(tiles, solids, "tile-dirt", 24, 18, 34, 24);
  popSolids(solids, 33, 20, 34, 23);
  addRect(tiles, solids, "tile-gate", 34, 20, 34, 23);
  popSolids(solids, 34, 20, 34, 23);
  props.push({ kind: "raid_road", ...cell(32, 21) });
  spawns.raidRoad = cell(32, 21);

  return { cols, rows, solids, spawns, props, tiles, torchTint: 0x4a6a40 };
}

/** Build a single raid room; optional dressing props and house torch tint. */
export function buildRaidRoom(
  cols: number,
  rows: number,
  floorTex = "tile-sand",
  opts?: {
    torchTint?: number;
    extraProps?: { kind: string; x: number; y: number }[];
    skipDefaultLamps?: boolean;
  },
): BuiltMap {
  const tiles: BuiltMap["tiles"] = [];
  const solids: BuiltMap["solids"] = [];
  const spawns: BuiltMap["spawns"] = {};
  const props: BuiltMap["props"] = [];

  addRect(tiles, solids, floorTex, 0, 0, cols - 1, rows - 1);
  for (let tx = 0; tx < cols; tx++) {
    addRect(tiles, solids, "tile-wall", tx, 0, tx, 0, true);
    addRect(tiles, solids, "tile-wall", tx, rows - 1, tx, rows - 1, true);
  }
  for (let ty = 0; ty < rows; ty++) {
    addRect(tiles, solids, "tile-wall", 0, ty, 0, ty, true);
    addRect(tiles, solids, "tile-wall", cols - 1, ty, cols - 1, ty, true);
  }
  addRect(tiles, solids, floorTex, 1, 1, cols - 2, rows - 2);
  popSolids(solids, 1, 1, cols - 2, rows - 2);

  if (!opts?.skipDefaultLamps) {
    props.push({ kind: "lamp", ...cell(2, 2) });
    props.push({ kind: "lamp", ...cell(cols - 3, 2) });
    props.push({ kind: "lamp", ...cell(2, rows - 3) });
    props.push({ kind: "lamp", ...cell(cols - 3, rows - 3) });
    props.push({ kind: "lamp", ...cell(Math.floor(cols / 2), 2) });
    props.push({ kind: "lamp", ...cell(Math.floor(cols / 2), rows - 3) });
    props.push({ kind: "lamp", ...cell(2, Math.floor(rows / 2)) });
    props.push({ kind: "lamp", ...cell(cols - 3, Math.floor(rows / 2)) });
  }

  if (opts?.extraProps) {
    for (const p of opts.extraProps) props.push({ kind: p.kind, x: p.x, y: p.y });
  }

  spawns.player = cell(3, Math.floor(rows / 2));
  return { cols, rows, solids, spawns, props, tiles, torchTint: opts?.torchTint ?? 0x2f6b4a };
}
