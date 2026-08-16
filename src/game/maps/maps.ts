import { TILE_SIZE } from "../config";
import { houseArenaLabel, houseBannerTex, houseCrowdTint } from "../data/houses";
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
    { x: 7.5, y: 19.4, text: "SHRINE" },
    { x: 6, y: 7.2, text: "ARMORY" },
    { x: 42, y: 7.2, text: "QUARTERS" },
    { x: 40.5, y: 13.35, text: "HALL" },
    { x: 39, y: 21.35, text: "FEAST" },
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

export const ARENA_META: MapDef = arenaMetaFor("serpens");

export interface BuiltMap {
  cols: number;
  rows: number;
  solids: { x: number; y: number }[];
  spawns: Record<string, { x: number; y: number }>;
  props: { kind: string; x: number; y: number }[];
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
  addRect(tiles, solids, "tile-straw", 3, 16, 6, 17);
  addRect(tiles, solids, "tile-wall", 1, 14, 8, 14, true);
  addRect(tiles, solids, yardBanner, 4, 14, 5, 14, true);
  addRect(tiles, solids, "tile-wall", 8, 14, 8, 19, true);
  addRect(tiles, solids, "tile-wall", 1, 19, 8, 19, true);
  addRect(tiles, solids, "tile-wood", 8, 16, 8, 17);
  solids.push(...popSolids(solids, 8, 16, 8, 17));
  addRect(tiles, solids, "tile-wood", 4, 19, 5, 19);
  solids.push(...popSolids(solids, 4, 19, 5, 19));
  spawns.pal = cell(4, 16);
  props.push({ kind: "perch", ...cell(3, 15) });
  props.push({ kind: "nest", ...cell(4, 16) });
  props.push({ kind: "bowl", ...cell(6, 15) });
  props.push({ kind: "trough", ...cell(2, 18) });
  props.push({ kind: "hay", ...cell(7, 18) });
  props.push({ kind: "hook", ...cell(7, 15) });

  addRect(tiles, solids, "tile-wood-pale", 35, 14, 46, 21);
  addRect(tiles, solids, "tile-mosaic", 38, 16, 43, 19);
  addRect(tiles, solids, "tile-wall", 35, 14, 46, 14, true);
  addRect(tiles, solids, "tile-wall", 35, 14, 35, 21, true);
  addRect(tiles, solids, "tile-wall", 35, 21, 46, 21, true);
  addRect(tiles, solids, "tile-wood-pale", 35, 17, 35, 18);
  solids.push(...popSolids(solids, 35, 17, 35, 18));
  addRect(tiles, solids, "tile-wood-pale", 40, 21, 41, 21);
  solids.push(...popSolids(solids, 40, 21, 41, 21));
  props.push({ kind: "dice", ...cell(40, 18) });
  spawns.rufusHall = cell(44, 17);

  addRect(tiles, solids, "tile-wood-pale", 32, 22, 46, 29);
  addRect(tiles, solids, "tile-feast-rug", 34, 24, 44, 27);
  addRect(tiles, solids, "tile-wall", 32, 22, 46, 22, true);
  addRect(tiles, solids, "tile-wall", 32, 29, 46, 29, true);
  addRect(tiles, solids, "tile-wall", 32, 22, 32, 29, true);
  addRect(tiles, solids, yardBanner, 33, 22, 34, 22, true);
  addRect(tiles, solids, yardBanner, 44, 22, 45, 22, true);
  addRect(tiles, solids, yardBanner, 34, 29, 35, 29, true);
  addRect(tiles, solids, yardBanner, 43, 29, 44, 29, true);
  addRect(tiles, solids, "tile-wood-pale", 40, 22, 41, 22);
  solids.push(...popSolids(solids, 40, 22, 41, 22));
  addRect(tiles, solids, "tile-wood-pale", 32, 25, 32, 26);
  solids.push(...popSolids(solids, 32, 25, 32, 26));
  addRect(tiles, solids, "tile-stone", 31, 25, 31, 26);
  props.push({ kind: "feast-table", ...cell(36, 24) });
  props.push({ kind: "feast-table", ...cell(39, 24) });
  props.push({ kind: "feast-table", ...cell(42, 24) });
  props.push({ kind: "feast-table", ...cell(36, 27) });
  props.push({ kind: "feast-table", ...cell(39, 27) });
  props.push({ kind: "feast-table", ...cell(42, 27) });
  props.push({ kind: "amphora", ...cell(45, 23) });
  props.push({ kind: "keg", ...cell(45, 24) });
  props.push({ kind: "wine", ...cell(44, 24) });
  props.push({ kind: "crate", ...cell(45, 25) });
  props.push({ kind: "barrel", ...cell(45, 26) });
  props.push({ kind: "keg", ...cell(45, 27) });
  props.push({ kind: "beer", ...cell(44, 27) });
  props.push({ kind: "keg", ...cell(45, 28) });
  props.push({ kind: "brazier", ...cell(34, 28) });
  spawns.feast = cell(38, 26);
  spawns.titusFeast = cell(36, 23);
  spawns.bromFeast = cell(42, 23);
  spawns.aeliaFeast = cell(36, 28);
  spawns.rufusFeast = cell(42, 28);

  addRect(tiles, solids, "tile-dirt", 17, 14, 30, 23);
  addRect(tiles, solids, "tile-fence", 16, 13, 31, 13, true);
  addRect(tiles, solids, "tile-fence", 16, 24, 31, 24, true);
  addRect(tiles, solids, "tile-fence", 16, 13, 16, 24, true);
  addRect(tiles, solids, "tile-fence", 31, 13, 31, 24, true);
  addRect(tiles, solids, "tile-dirt", 31, 23, 31, 24);
  popSolids(solids, 31, 23, 31, 24);
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
  spawns.brom = cell(18, 16);
  spawns.aelia = cell(29, 16);
  spawns.titus = cell(18, 21);
  spawns.rufus = cell(29, 21);

  addRect(tiles, solids, "tile-shrine", 1, 20, 14, 29);
  addRect(tiles, solids, "tile-mosaic", 5, 23, 10, 26);
  addRect(tiles, solids, "tile-wall", 1, 20, 14, 20, true);
  addRect(tiles, solids, "tile-wall", 1, 29, 14, 29, true);
  addRect(tiles, solids, "tile-wall", 14, 20, 14, 29, true);
  addRect(tiles, solids, yardBanner, 2, 20, 3, 20, true);
  addRect(tiles, solids, yardBanner, 12, 20, 13, 20, true);
  addRect(tiles, solids, "tile-shrine", 4, 20, 5, 20);
  solids.push(...popSolids(solids, 4, 20, 5, 20));
  addRect(tiles, solids, "tile-shrine", 14, 25, 14, 26);
  solids.push(...popSolids(solids, 14, 25, 14, 26));
  addRect(tiles, solids, "tile-stone", 15, 25, 15, 26);
  addRect(tiles, solids, "tile-dirt", 16, 22, 16, 26);
  popSolids(solids, 16, 22, 16, 26);
  props.push({ kind: "lararium", ...cell(2, 25) });
  props.push({ kind: "altar", ...cell(3, 25) });
  spawns.shrine = cell(2, 25);

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

export function inFeastTiles(tx: number, ty: number): boolean {
  return tx >= 32 && tx <= 46 && ty >= 22 && ty <= 29;
}

export function inShrineTiles(tx: number, ty: number): boolean {
  return tx >= 1 && tx <= 14 && ty >= 20 && ty <= 29;
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
  if (houseId === "serpens") {
    overlayRing(tiles, "tile-mosaic", 8, 7, 23, 14);
    props.push({ kind: "pit-ring", ...cell(4, 8) });
    props.push({ kind: "pit-ring", ...cell(27, 8) });
    props.push({ kind: "pit-ring", ...cell(4, 13) });
    props.push({ kind: "pit-ring", ...cell(27, 13) });
    return;
  }
  if (houseId === "lupus") {
    addRect(tiles, solids, "tile-sand-earth", 6, 4, 7, 5);
    addRect(tiles, solids, "tile-sand-earth", 24, 16, 25, 17);
    addRect(tiles, solids, "tile-sand-earth", 10, 16, 11, 17);
    props.push({ kind: "pit-skull", ...cell(8, 3) });
    props.push({ kind: "pit-skull", ...cell(23, 3) });
    props.push({ kind: "pit-skull", ...cell(8, 18) });
    props.push({ kind: "pit-skull", ...cell(23, 18) });
    props.push({ kind: "hay", ...cell(4, 3) });
    props.push({ kind: "hay", ...cell(27, 18) });
    return;
  }
  if (houseId === "aper") {
    addRect(tiles, solids, "tile-dirt", 5, 8, 8, 10);
    addRect(tiles, solids, "tile-dirt", 23, 11, 26, 13);
    props.push({ kind: "pit-tusk", ...cell(3, 8) });
    props.push({ kind: "pit-tusk", ...cell(3, 13) });
    props.push({ kind: "pit-tusk", ...cell(28, 8) });
    props.push({ kind: "pit-tusk", ...cell(28, 13) });
    return;
  }
  if (houseId === "taurus") {
    for (let ty = 4; ty <= 17; ty++) {
      addRect(tiles, solids, "tile-sand-stripe", 12, ty, 13, ty);
      addRect(tiles, solids, "tile-sand-stripe", 18, ty, 19, ty);
    }
    props.push({ kind: "pit-horn", ...cell(3, 6) });
    props.push({ kind: "pit-horn", ...cell(3, 15) });
    props.push({ kind: "pit-horn", ...cell(28, 6) });
    props.push({ kind: "pit-horn", ...cell(28, 15) });
    return;
  }
  if (houseId === "tigris") {
    for (let ty = 5; ty <= 16; ty += 3) addRect(tiles, solids, "tile-sand-stripe", 4, ty, 27, ty);
    props.push({ kind: "vine", ...cell(3, 7) });
    props.push({ kind: "vine", ...cell(3, 14) });
    props.push({ kind: "vine", ...cell(28, 7) });
    props.push({ kind: "vine", ...cell(28, 14) });
    return;
  }
  if (houseId === "leo") {
    addRect(tiles, solids, "tile-mosaic", 12, 8, 19, 13);
    props.push({ kind: "brazier", ...cell(3, 3) });
    props.push({ kind: "brazier", ...cell(28, 3) });
    props.push({ kind: "brazier", ...cell(3, 18) });
    props.push({ kind: "brazier", ...cell(28, 18) });
    return;
  }
  if (houseId === "ursus") {
    addRect(tiles, solids, "tile-sand-mud", 14, 9, 17, 12);
    props.push({ kind: "pit-log", ...cell(8, 3) });
    props.push({ kind: "pit-log", ...cell(23, 3) });
    props.push({ kind: "pit-log", ...cell(8, 18) });
    props.push({ kind: "pit-log", ...cell(23, 18) });
    return;
  }
  if (houseId === "rhinoceros") {
    addRect(tiles, solids, "tile-stone", 3, 3, 5, 18);
    addRect(tiles, solids, "tile-stone", 26, 3, 28, 18);
    props.push({ kind: "pit-horn", ...cell(3, 7) });
    props.push({ kind: "pit-horn", ...cell(3, 14) });
    props.push({ kind: "pit-horn", ...cell(28, 7) });
    props.push({ kind: "pit-horn", ...cell(28, 14) });
    return;
  }
  if (houseId === "elephas") {
    addRect(tiles, solids, "tile-mosaic", 10, 7, 21, 14);
    props.push({ kind: "pit-ivory", ...cell(16, 3) });
    props.push({ kind: "pit-ivory", ...cell(16, 18) });
    props.push({ kind: "pit-ivory", ...cell(3, 10) });
    props.push({ kind: "pit-ivory", ...cell(28, 10) });
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
