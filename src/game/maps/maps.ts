import { TILE_SIZE } from "../config";
import { houseArenaLabel, houseBannerTex } from "../data/houses";
import { gameState } from "../state/GameState";

export interface MapDef {
  id: string;
  cols: number;
  rows: number;
  labels: { x: number; y: number; text: string }[];
}

export const LUDUS_META: MapDef = {
  id: "ludus",
  cols: 48,
  rows: 36,
  labels: [
    { x: 23.5, y: 2.2, text: "LANISTA" },
    { x: 4.5, y: 13.35, text: "ROOST" },
    { x: 6, y: 7.2, text: "ARMORY" },
    { x: 42, y: 7.2, text: "QUARTERS" },
    { x: 40.5, y: 13.35, text: "HALL" },
    { x: 23.5, y: 12.35, text: "TRAINING YARD" },
    { x: 23.5, y: 32.6, text: "ARENA GATE" },
  ],
};

export function arenaMetaFor(houseId: string): MapDef {
  return {
    id: "arena",
    cols: 32,
    rows: 22,
    labels: [{ x: 16, y: 1.2, text: houseArenaLabel(houseId) }],
  };
}

export const ARENA_META: MapDef = arenaMetaFor("vulpes");

export interface BuiltMap {
  cols: number;
  rows: number;
  solids: { x: number; y: number }[];
  spawns: Record<string, { x: number; y: number }>;
  props: { kind: string; x: number; y: number }[];
  tiles: { tex: string; x: number; y: number }[];
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
  addRect(tiles, solids, "tile-stone", 1, 1, 46, 5);
  addRect(tiles, solids, "tile-mosaic", 22, 2, 25, 4);
  addRect(tiles, solids, yardBanner, 16, 1, 17, 1, true);
  addRect(tiles, solids, yardBanner, 30, 1, 31, 1, true);
  addRect(tiles, solids, "tile-wall", 14, 1, 15, 5, true);
  addRect(tiles, solids, "tile-wall", 32, 1, 33, 5, true);
  addRect(tiles, solids, "tile-wall", 1, 5, 13, 5, true);
  addRect(tiles, solids, "tile-wall", 34, 5, 46, 5, true);
  addRect(tiles, solids, "tile-stone", 22, 5, 25, 12);
  spawns.lanista = cell(23, 3);

  addRect(tiles, solids, "tile-wood", 1, 6, 10, 12);
  addRect(tiles, solids, "tile-rug-armory", 3, 8, 7, 10);
  addRect(tiles, solids, "tile-wall", 10, 6, 10, 12, true);
  addRect(tiles, solids, "tile-wall", 1, 12, 10, 12, true);
  addRect(tiles, solids, "tile-wood", 10, 9, 10, 10);
  solids.push(...popSolids(solids, 10, 9, 10, 10));
  spawns.rack = cell(5, 8);
  props.push({ kind: "rack", ...cell(5, 8) });
  props.push({ kind: "shieldstand", ...cell(2, 7) });
  props.push({ kind: "crate", ...cell(8, 7) });
  props.push({ kind: "anvil", ...cell(8, 11) });
  props.push({ kind: "barrel", ...cell(2, 11) });

  addRect(tiles, solids, "tile-wood-pale", 37, 6, 46, 12);
  addRect(tiles, solids, "tile-rug-quarters", 40, 8, 44, 10);
  addRect(tiles, solids, "tile-wall", 37, 6, 37, 12, true);
  addRect(tiles, solids, "tile-wall", 37, 12, 46, 12, true);
  addRect(tiles, solids, "tile-wood-pale", 37, 9, 37, 10);
  solids.push(...popSolids(solids, 37, 9, 37, 10));
  props.push({ kind: "bed", ...cell(39, 7) });
  props.push({ kind: "bed", ...cell(45, 7) });
  props.push({ kind: "chest", ...cell(39, 8) });
  props.push({ kind: "chest", ...cell(45, 8) });
  props.push({ kind: "shop", ...cell(43, 11) });
  props.push({ kind: "barrel", ...cell(46, 11) });

  addRect(tiles, solids, "tile-wood", 1, 14, 8, 19);
  addRect(tiles, solids, "tile-wall", 1, 14, 8, 14, true);
  addRect(tiles, solids, "tile-wall", 8, 14, 8, 19, true);
  addRect(tiles, solids, "tile-wall", 1, 19, 8, 19, true);
  addRect(tiles, solids, "tile-wood", 8, 16, 8, 17);
  solids.push(...popSolids(solids, 8, 16, 8, 17));
  spawns.pal = cell(4, 16);
  props.push({ kind: "perch", ...cell(3, 15) });
  props.push({ kind: "hay", ...cell(7, 15) });
  props.push({ kind: "hay", ...cell(2, 18) });

  addRect(tiles, solids, "tile-wood-pale", 35, 14, 46, 21);
  addRect(tiles, solids, "tile-mosaic", 38, 16, 43, 19);
  addRect(tiles, solids, "tile-wall", 35, 14, 46, 14, true);
  addRect(tiles, solids, "tile-wall", 35, 14, 35, 21, true);
  addRect(tiles, solids, "tile-wall", 35, 21, 46, 21, true);
  addRect(tiles, solids, "tile-wood-pale", 35, 17, 35, 18);
  solids.push(...popSolids(solids, 35, 17, 35, 18));
  props.push({ kind: "dice", ...cell(40, 18) });

  addRect(tiles, solids, "tile-dirt", 17, 14, 30, 23);
  addRect(tiles, solids, "tile-fence", 16, 13, 31, 13, true);
  addRect(tiles, solids, "tile-fence", 16, 24, 31, 24, true);
  addRect(tiles, solids, "tile-fence", 16, 13, 16, 24, true);
  addRect(tiles, solids, "tile-fence", 31, 13, 31, 24, true);
  addRect(tiles, solids, "tile-dirt", 22, 13, 25, 13);
  addRect(tiles, solids, "tile-dirt", 22, 24, 25, 29);
  popSolids(solids, 22, 13, 25, 13);
  popSolids(solids, 22, 24, 25, 24);

  addRect(tiles, solids, "tile-ring", 22, 17, 25, 20);
  spawns.dummy = { x: 24 * TILE_SIZE, y: 19 * TILE_SIZE };
  props.push({ kind: "dummy", x: 21 * TILE_SIZE + 16, y: 19 * TILE_SIZE });
  props.push({ kind: "dummy", x: 26 * TILE_SIZE + 16, y: 19 * TILE_SIZE });
  props.push({ kind: "hay", ...cell(20, 15) });
  props.push({ kind: "hay", ...cell(27, 15) });
  props.push({ kind: "bench", ...cell(14, 22) });
  props.push({ kind: "bench", ...cell(33, 22) });
  spawns.brom = cell(18, 16);
  spawns.aelia = cell(29, 16);
  spawns.titus = cell(18, 21);
  spawns.rufus = cell(29, 21);

  props.push({ kind: "fountain", ...cell(6, 22) });
  props.push({ kind: "crate", ...cell(9, 23) });
  props.push({ kind: "crate", ...cell(10, 24) });

  addRect(tiles, solids, "tile-stone", 1, 31, 46, 34);
  addRect(tiles, solids, yardBanner, 2, 31, 3, 31, true);
  addRect(tiles, solids, yardBanner, 44, 31, 45, 31, true);
  addRect(tiles, solids, "tile-wall", 1, 30, 21, 30, true);
  addRect(tiles, solids, "tile-wall", 26, 30, 46, 30, true);
  addRect(tiles, solids, "tile-dirt", 22, 30, 25, 34);
  popSolids(solids, 22, 30, 25, 30);
  addRect(tiles, solids, "tile-gate", 22, 34, 25, 35);
  popSolids(solids, 22, 35, 25, 35);
  spawns.player = { x: 24 * TILE_SIZE, y: 22 * TILE_SIZE + 16 };
  spawns.gate = { x: 24 * TILE_SIZE, y: 34 * TILE_SIZE + 16 };
  props.push({ kind: "gate", x: 24 * TILE_SIZE, y: 34 * TILE_SIZE + 16 });

  return { cols, rows, solids, spawns, props, tiles };
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

export function buildArena(houseId = "vulpes"): BuiltMap {
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
  const banner = houseBannerTex(houseId);
  addRect(tiles, solids, banner, 1, 1, cols - 2, 1);
  addRect(tiles, solids, banner, 1, rows - 2, cols - 2, rows - 2);
  addRect(tiles, solids, "tile-wall", 2, 2, cols - 3, 2, true);
  addRect(tiles, solids, "tile-wall", 2, rows - 3, cols - 3, rows - 3, true);
  addRect(tiles, solids, "tile-wall", 2, 2, 2, rows - 3, true);
  addRect(tiles, solids, "tile-wall", cols - 3, 2, cols - 3, rows - 3, true);
  addRect(tiles, solids, "tile-sand", 3, 3, cols - 4, rows - 4);

  spawns.player = cell(16, 16);
  spawns.enemy = cell(16, 6);
  props.push({ kind: "column", ...cell(5, 5) });
  props.push({ kind: "column", ...cell(26, 5) });
  props.push({ kind: "column", ...cell(5, 16) });
  props.push({ kind: "column", ...cell(26, 16) });

  return { cols, rows, solids, spawns, props, tiles };
}

export function worldPx(cols: number, rows: number): { w: number; h: number } {
  return { w: cols * TILE_SIZE, h: rows * TILE_SIZE };
}
