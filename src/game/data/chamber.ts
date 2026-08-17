import type { ChamberDecor } from "../types";
import { gameState } from "../state/GameState";
import { getHouse, houseBannerTex } from "./houses";
import { COLORS } from "../config";

export interface ChamberCatalogItem {
  id: string;
  name: string;
  description: string;
  cost: number;
}

export type ChamberSlot = "floor" | "rug" | "bed" | "banner" | "light" | "extra" | "trophy";

export const CHAMBER_TABS: { slot: ChamberSlot; label: string }[] = [
  { slot: "floor", label: "Floor" },
  { slot: "rug", label: "Rug" },
  { slot: "bed", label: "Bed" },
  { slot: "banner", label: "Walls" },
  { slot: "light", label: "Light" },
  { slot: "extra", label: "Extra" },
  { slot: "trophy", label: "Trophy" },
];

export function emptyChamber(): ChamberDecor {
  return {
    floor: "floor-pale",
    rug: "rug-none",
    bed: "bed-none",
    banner: "banner-none",
    light: "light-none",
    extra: "extra-none",
    trophy: "trophy-none",
  };
}

export function furnishedChamber(): ChamberDecor {
  return {
    floor: "floor-pale",
    rug: "rug-quarters",
    bed: "bed-simple",
    banner: "banner-house",
    light: "light-lamps",
    extra: "extra-chest",
    trophy: "trophy-empty",
  };
}

export function mergeChamber(parsed?: Partial<ChamberDecor>): ChamberDecor {
  return { ...emptyChamber(), ...(parsed ?? {}) };
}

export function chamberSlotFromId(id: string): ChamberSlot {
  if (id.startsWith("floor-")) return "floor";
  if (id.startsWith("bed-")) return "bed";
  if (id.startsWith("banner-")) return "banner";
  if (id.startsWith("light-")) return "light";
  if (id.startsWith("extra-")) return "extra";
  if (id.startsWith("trophy-")) return "trophy";
  return "rug";
}

export function chamberItemEquipped(id: string): boolean {
  const slot = chamberSlotFromId(id);
  return (gameState.save.chamber?.[slot] ?? emptyChamber()[slot]) === id;
}

export function chamberWithPreview(previewId: string | null): ChamberDecor {
  const next = { ...emptyChamber(), ...(gameState.save.chamber ?? {}) };
  if (previewId) next[chamberSlotFromId(previewId)] = previewId;
  return next;
}

export const CHAMBER_STARTERS = [
  "floor-pale",
  "floor-stone",
  "rug-none",
  "rug-quarters",
  "bed-none",
  "bed-simple",
  "banner-none",
  "banner-house",
  "light-none",
  "light-lamps",
  "extra-none",
  "extra-chest",
  "trophy-none",
  "trophy-empty",
];

export const CHAMBER_ITEMS: ChamberCatalogItem[] = [
  { id: "floor-pale", name: "Pale wood", description: "The loft boards, bleached by the sun.", cost: 0 },
  { id: "floor-mosaic", name: "Mosaic", description: "Small tiles. A lanista's floor.", cost: 36 },
  { id: "floor-stone", name: "Stone", description: "The same north stone, left bare.", cost: 0 },
  { id: "floor-dark", name: "Dark wood", description: "Stained planks. The hall below is paler.", cost: 32 },
  { id: "rug-none", name: "No rug", description: "Bare boards.", cost: 0 },
  { id: "rug-quarters", name: "Barracks rug", description: "The weave from the cots below.", cost: 0 },
  { id: "rug-feast", name: "Feast rug", description: "Wine-dark cloth from the hall.", cost: 24 },
  { id: "rug-crimson", name: "Crimson rug", description: "Aquila red underfoot.", cost: 28 },
  { id: "rug-ivory", name: "Ivory rug", description: "Pale wool. Dust shows on it.", cost: 30 },
  { id: "rug-eagle", name: "Eagle rug", description: "Gold stitch on dark wool.", cost: 40 },
  { id: "bed-none", name: "No bed", description: "Sleep in quarters if you must.", cost: 0 },
  { id: "bed-simple", name: "Simple cot", description: "A bed of your own.", cost: 0 },
  { id: "bed-crimson", name: "Crimson linens", description: "House cloth on the cot.", cost: 34 },
  { id: "bed-ivory", name: "Ivory linens", description: "Bleached sheets. A free man's rest.", cost: 38 },
  { id: "banner-none", name: "Bare wall", description: "North stone, unadorned.", cost: 0 },
  { id: "banner-house", name: "House hanging", description: "Your pledged colours on the loft wall.", cost: 0 },
  { id: "banner-eagle", name: "Eagle hanging", description: "Gold cloth. The aquila watches.", cost: 36 },
  { id: "banner-crimson", name: "Crimson hanging", description: "A long red drape.", cost: 28 },
  { id: "banner-ivory", name: "Ivory hanging", description: "Pale cloth. It catches the lamp.", cost: 30 },
  { id: "light-none", name: "No lamps", description: "The hall torch is enough.", cost: 0 },
  { id: "light-lamps", name: "Twin lamps", description: "Oil lamps on the east and west.", cost: 0 },
  { id: "light-brazier", name: "Brazier", description: "A coal pan. The loft warms.", cost: 26 },
  { id: "extra-none", name: "No extra", description: "The desk still takes the book.", cost: 0 },
  { id: "extra-chest", name: "Oak chest", description: "A chest against the west wall.", cost: 0 },
  { id: "extra-amphora", name: "Amphora", description: "Wine for the loft, not the feast.", cost: 22 },
  { id: "extra-keg", name: "Keg", description: "A small barrel. Rufus would approve.", cost: 24 },
  { id: "trophy-none", name: "No trophy", description: "The hook waits.", cost: 0 },
  { id: "trophy-empty", name: "Empty hook", description: "A plaque with no kill on it yet.", cost: 0 },
  { id: "trophy-eagle", name: "Eagle plaque", description: "House Aquila, in bone and gold.", cost: 44 },
  { id: "trophy-last", name: "Last champion", description: "The last house you beat, mounted here.", cost: 50 },
];

export function chamberFloorTex(id: string): string {
  if (id === "floor-mosaic") return "tile-mosaic";
  if (id === "floor-stone") return "tile-stone";
  if (id === "floor-dark") return "tile-wood-dark";
  return "tile-wood-pale";
}

export function chamberRugTex(id: string): string | null {
  if (id === "rug-none") return null;
  if (id === "rug-feast") return "tile-feast-rug";
  if (id === "rug-crimson") return "tile-rug-crimson";
  if (id === "rug-ivory") return "tile-rug-ivory";
  if (id === "rug-eagle") return "tile-rug-eagle";
  return "tile-rug-quarters";
}

export function chamberBedTex(id: string): string | null {
  if (id === "bed-none") return null;
  if (id === "bed-crimson") return "prop-bed-crimson";
  if (id === "bed-ivory") return "prop-bed-ivory";
  return "prop-bed";
}

export function chamberHangingTex(id: string): string | null {
  if (id === "banner-none") return null;
  if (id === "banner-eagle") return "prop-hanging-eagle";
  if (id === "banner-house") return "prop-hanging";
  if (id === "banner-ivory") return "prop-hanging-ivory";
  if (id === "banner-crimson") return "prop-hanging-crimson";
  return "prop-hanging";
}

export function chamberHangingTint(id: string): number | undefined {
  if (id === "banner-house") {
    const house = gameState.save.playerHouse ? getHouse(gameState.save.playerHouse) : undefined;
    return house?.colors.primary ?? COLORS.crimson;
  }
  return undefined;
}

export function chamberExtraTex(id: string): string | null {
  if (id === "extra-chest") return "prop-chest";
  if (id === "extra-amphora") return "prop-amphora";
  if (id === "extra-keg") return "prop-keg";
  return null;
}

export function chamberThumbTex(id: string): string {
  const slot = chamberSlotFromId(id);
  if (slot === "floor") return chamberFloorTex(id);
  if (slot === "rug") return chamberRugTex(id) ?? "tile-wood-pale";
  if (slot === "bed") return chamberBedTex(id) ?? "prop-bed";
  if (slot === "banner") return chamberHangingTex(id) ?? "prop-hanging";
  if (slot === "light") return id === "light-brazier" ? "prop-brazier" : "prop-lamp";
  if (slot === "extra") return chamberExtraTex(id) ?? "prop-desk";
  if (id === "trophy-eagle") return "trophy-skel-eagle";
  if (id === "trophy-last") {
    const last = gameState.save.defeatedHouses[gameState.save.defeatedHouses.length - 1];
    const house = last ? getHouse(last) : undefined;
    const kind = house?.beastKind ?? "eagle";
    return `trophy-skel-${kind}`;
  }
  return "prop-trophy-empty";
}

export function lastTrophyHouse() {
  const last = gameState.save.defeatedHouses[gameState.save.defeatedHouses.length - 1];
  return last ? getHouse(last) : undefined;
}

export function houseBannerForChamber(): string {
  return gameState.save.playerHouse ? houseBannerTex(gameState.save.playerHouse) : "tile-banner-red";
}
