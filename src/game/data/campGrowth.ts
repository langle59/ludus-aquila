import { TILE_SIZE } from "../config";
import type { RaidHouseId } from "../types";

export type CampGrowthProp = {
  kind: string;
  /** Offset from anchor in tiles. */
  dx: number;
  dy: number;
  tint?: number;
};

export type CampGrowthAnchor =
  | { type: "pad"; houseId: RaidHouseId }
  | { type: "fire" }
  | { type: "raidRoad" };

export type CampGrowthEntry = {
  anchor: CampGrowthAnchor;
  props: CampGrowthProp[];
};

/** Per-house decorations when a pad is freed. */
export const HOUSE_GROWTH: Record<RaidHouseId, CampGrowthProp[]> = {
  serpens: [{ kind: "vine", dx: -1, dy: 0 }],
  lupus: [
    { kind: "hay", dx: 1, dy: 1 },
    { kind: "pit-skull", dx: 0, dy: -1 },
  ],
  aper: [{ kind: "pit-tusk", dx: 1, dy: 0 }],
  taurus: [
    { kind: "fence", dx: 0, dy: -1 },
    { kind: "pit-horn", dx: -1, dy: 1 },
  ],
  tigris: [
    { kind: "pit-skull", dx: -1, dy: 0 },
    { kind: "bush", dx: 1, dy: 1, tint: 0x3a3028 },
  ],
  leo: [
    { kind: "shieldstand", dx: 1, dy: -1 },
    { kind: "brazier", dx: -1, dy: 1 },
  ],
  ursus: [{ kind: "pit-log", dx: 0, dy: 1 }],
  rhinoceros: [
    { kind: "pit-horn", dx: -1, dy: 0 },
    { kind: "pit-tusk", dx: 1, dy: 0 },
  ],
  elephas: [
    { kind: "pit-ivory", dx: -1, dy: -1 },
    { kind: "pit-ivory", dx: 1, dy: -1 },
  ],
};

/** Global milestones by freed-pad count. */
export function milestoneGrowth(count: number): CampGrowthEntry[] {
  const out: CampGrowthEntry[] = [];
  if (count >= 3) {
    out.push({
      anchor: { type: "fire" },
      props: [{ kind: "hay", dx: 1, dy: 0 }],
    });
  }
  if (count >= 6) {
    out.push({
      anchor: { type: "raidRoad" },
      props: [
        { kind: "brazier", dx: -2, dy: 0 },
        { kind: "brazier", dx: 2, dy: 0 },
      ],
    });
  }
  if (count >= 9) {
    out.push({
      anchor: { type: "raidRoad" },
      props: [
        { kind: "shieldstand", dx: -3, dy: -1 },
        { kind: "shieldstand", dx: 3, dy: -1 },
      ],
    });
  }
  return out;
}

export function growthForFreedPads(freedPads: string[]): CampGrowthEntry[] {
  const entries: CampGrowthEntry[] = [];
  for (const hid of freedPads) {
    const props = HOUSE_GROWTH[hid as RaidHouseId];
    if (!props?.length) continue;
    entries.push({ anchor: { type: "pad", houseId: hid as RaidHouseId }, props });
  }
  entries.push(...milestoneGrowth(freedPads.length));
  return entries;
}

export function growthWorldPos(
  anchorX: number,
  anchorY: number,
  prop: CampGrowthProp,
): { x: number; y: number } {
  return {
    x: anchorX + prop.dx * TILE_SIZE,
    y: anchorY + prop.dy * TILE_SIZE,
  };
}

export const CAMP_GROWTH_TEX: Record<string, string> = {
  hay: "prop-hay",
  brazier: "prop-brazier",
  "pit-tusk": "prop-pit-tusk",
  "pit-skull": "prop-pit-skull",
  "pit-horn": "prop-pit-horn",
  "pit-log": "prop-pit-log",
  "pit-ivory": "prop-pit-ivory",
  vine: "prop-pit-vine",
  fence: "tile-fence",
  shieldstand: "prop-shieldstand",
  bush: "prop-bush",
};
