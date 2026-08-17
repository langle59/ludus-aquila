import { TILE_SIZE } from "../../config";
import type { AiStyle, RaidHouseId, WeaponId } from "../../types";

export type RaidRoomKind = "combat" | "puzzle" | "boss" | "rest";
export type RaidAlertMode = "ripple" | "pack";

export type RaidPropKind =
  | "lamp"
  | "hay"
  | "brazier"
  | "rack"
  | "shieldstand"
  | "pit-tusk"
  | "pit-skull"
  | "pit-horn"
  | "pit-log"
  | "pit-ivory"
  | "vine"
  | "fence";

export type RaidPropDef = {
  kind: RaidPropKind;
  x: number;
  y: number;
};

export type RaidHazardKind = "mud" | "dark" | "rubble" | "stampede";

export type RaidHazardDef = {
  kind: RaidHazardKind;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Stampede sweep period in ms. */
  periodMs?: number;
  /** Stampede travel axis. */
  axis?: "x" | "y";
};

export interface RaidGuardDef {
  id: string;
  name: string;
  weapon: WeaponId;
  aiStyle: AiStyle;
  color: number;
  scale: number;
  stats: { maxHealth: number; maxStamina: number; attack: number; defense: number; agility: number };
  /** Aper heavies: telegraphed charge on first aggro. */
  tuskCharge?: boolean;
  /** Longer/wider charge (Taurus / Rhinoceros). */
  hornCharge?: boolean;
  /** Short aggro until close (Tigris stalkers). */
  ambush?: boolean;
  /** On first aggro, wake nearby foes (Leo pride). */
  roarPulse?: boolean;
  /** Reduced knockback (Ursus / Rhinoceros armor). */
  armor?: boolean;
  /** World spawn; omit to use RaidScene spread fallback. */
  x?: number;
  y?: number;
}

export type GuardExtra = {
  scale?: number;
  tuskCharge?: boolean;
  hornCharge?: boolean;
  ambush?: boolean;
  roarPulse?: boolean;
  armor?: boolean;
  at?: [number, number];
};

export interface RaidDoor {
  to: string;
  x: number;
  y: number;
  label: string;
  requiresClear?: boolean;
}

export type RaidFacing = "up" | "down" | "left" | "right";

export type RaidStatueBeast = "serpent" | "wolf" | "boar";

export type RaidPuzzle =
  | {
      kind: "statues";
      target: RaidFacing;
      plaque: string;
      beast: RaidStatueBeast;
      statues: { x: number; y: number; facing: RaidFacing }[];
    }
  | {
      kind: "step_path";
      memory?: boolean;
      plaque: string;
      originTx: number;
      originTy: number;
      cols: number;
      rows: number;
      safe: [number, number][];
      goal: [number, number];
    }
  | {
      kind: "braziers";
      plaque: string;
      order: { x: number; y: number }[];
    }
  | {
      kind: "timing_gate";
      variant: "pressure" | "plates" | "stampede";
      plaque: string;
      goal?: { x: number; y: number };
      plates?: { x: number; y: number }[];
      holdMs?: number;
    };

export interface RaidRoomDef {
  id: string;
  name: string;
  kind: RaidRoomKind;
  cols: number;
  rows: number;
  spawn: { x: number; y: number };
  allySpawns: { x: number; y: number }[];
  guards: RaidGuardDef[];
  doors: RaidDoor[];
  rest?: { x: number; y: number };
  puzzle?: RaidPuzzle;
  boss?: RaidGuardDef;
  /** Override default floor tile. */
  floorTex?: string;
  /** Decorative props (plus default lamps from builder). */
  props?: RaidPropDef[];
  hazards?: RaidHazardDef[];
}

export type RaidVictory = {
  title: string;
  body: string;
};

export type RaidDef = {
  houseId: RaidHouseId;
  startRoom: string;
  rooms: RaidRoomDef[];
  alertMode: RaidAlertMode;
  torchTint: number;
  /** Optional night wash lean (cool grey / warm). */
  nightTint?: number;
  victory: RaidVictory;
};

export function cell(tx: number, ty: number) {
  return { x: tx * TILE_SIZE + TILE_SIZE / 2, y: ty * TILE_SIZE + TILE_SIZE / 2 };
}

export const makeGuard = (
  id: string,
  name: string,
  weapon: WeaponId,
  aiStyle: AiStyle,
  stats: RaidGuardDef["stats"],
  color: number,
  extra?: GuardExtra,
): RaidGuardDef => {
  const pos = extra?.at ? cell(extra.at[0], extra.at[1]) : {};
  return {
    id,
    name,
    weapon,
    aiStyle,
    color,
    scale: extra?.scale ?? 1,
    stats,
    tuskCharge: extra?.tuskCharge,
    hornCharge: extra?.hornCharge,
    ambush: extra?.ambush,
    roarPulse: extra?.roarPulse,
    armor: extra?.armor,
    ...pos,
  };
};

export function prop(kind: RaidPropKind, tx: number, ty: number): RaidPropDef {
  return { kind, ...cell(tx, ty) };
}

function hazardBox(kind: RaidHazardKind, tx: number, ty: number, tw: number, th: number, extra?: Partial<RaidHazardDef>): RaidHazardDef {
  return {
    kind,
    x: tx * TILE_SIZE + (tw * TILE_SIZE) / 2,
    y: ty * TILE_SIZE + (th * TILE_SIZE) / 2,
    w: tw * TILE_SIZE,
    h: th * TILE_SIZE,
    ...extra,
  };
}

export function mud(tx: number, ty: number, tw: number, th: number): RaidHazardDef {
  return hazardBox("mud", tx, ty, tw, th);
}

export function dark(tx: number, ty: number, tw: number, th: number): RaidHazardDef {
  return hazardBox("dark", tx, ty, tw, th);
}

export function rubble(tx: number, ty: number, tw: number, th: number): RaidHazardDef {
  return hazardBox("rubble", tx, ty, tw, th);
}

export function stampede(tx: number, ty: number, tw: number, th: number, axis: "x" | "y" = "x", periodMs = 3200): RaidHazardDef {
  return hazardBox("stampede", tx, ty, tw, th, { axis, periodMs });
}

export function facingPuzzle(
  beast: RaidStatueBeast,
  target: RaidFacing,
  plaque: string,
  statues: [number, number, RaidFacing][],
): RaidPuzzle {
  return {
    kind: "statues",
    beast,
    target,
    plaque,
    statues: statues.map(([tx, ty, facing]) => ({ ...cell(tx, ty), facing })),
  };
}

export function stepPathPuzzle(
  plaque: string,
  originTx: number,
  originTy: number,
  cols: number,
  rows: number,
  safe: [number, number][],
  goal: [number, number],
  memory = false,
): RaidPuzzle {
  return { kind: "step_path", plaque, originTx, originTy, cols, rows, safe, goal, memory };
}

export function brazierPuzzle(plaque: string, tiles: [number, number][]): RaidPuzzle {
  return { kind: "braziers", plaque, order: tiles.map(([tx, ty]) => cell(tx, ty)) };
}

export function timingPuzzle(
  variant: "pressure" | "plates" | "stampede",
  plaque: string,
  opts: { goal?: [number, number]; plates?: [number, number][]; holdMs?: number } = {},
): RaidPuzzle {
  return {
    kind: "timing_gate",
    variant,
    plaque,
    goal: opts.goal ? cell(opts.goal[0], opts.goal[1]) : undefined,
    plates: opts.plates?.map(([tx, ty]) => cell(tx, ty)),
    holdMs: opts.holdMs,
  };
}
