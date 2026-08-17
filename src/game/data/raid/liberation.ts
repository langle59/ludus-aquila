import { refugeesForHouse } from "../refugees";

export function liberationFlag(houseId: string): string {
  return `raidFree_${houseId}`;
}

export function liberationArriveFlag(houseId: string): string {
  return `raidFreeArrive_${houseId}`;
}

/** Staged chain-break beat — separate from raidFree so older saves still see it once. */
export function liberationChainFlag(houseId: string): string {
  return `raidChain_${houseId}`;
}

/** World-space line after the chains break — not a dialogue box. */
export function getLiberation(houseId: string): { line: string } {
  if (houseId === "lupus") return { line: "The moon watch is yours." };
  if (houseId === "aper") return { line: "The sty is ours. We march." };
  if (houseId === "taurus") return { line: "The horns are quiet. We march." };
  if (houseId === "tigris") return { line: "The stripes break. We march." };
  if (houseId === "leo") return { line: "The pride walks free." };
  if (houseId === "ursus") return { line: "The cave opens. We march." };
  if (houseId === "rhinoceros") return { line: "The hide is ours. Eastward." };
  if (houseId === "elephas") return { line: "Nine houses free. The night is ours." };
  if (houseId === "serpens") return { line: "We walk with you." };
  const first = refugeesForHouse(houseId)[0];
  return { line: first ? `${first.name}: we join your cause.` : "We join your cause." };
}
