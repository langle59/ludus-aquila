import type { WeaponId } from "../types";
import { gameState } from "../state/GameState";
import { getRival, sortedHouses } from "../data/houses";
import { getWeapon } from "../data/weapons";

function beatenRivals() {
  const pledged = gameState.save.playerHouse;
  return sortedHouses().filter((h) => (!pledged || h.id !== pledged) && gameState.save.defeatedHouses.includes(h.id));
}

export type NightKind = "exhibition" | "weapon";

export type NightBout = {
  kind: NightKind;
  opponentId: string;
  fighterName: string;
  houseName: string;
  houseId: string;
  weapon?: WeaponId;
  weaponName?: string;
  bonusDenarii: number;
  bonusXp: number;
};

const STEEL: Record<string, WeaponId> = {
  serpens: "spear",
  lupus: "dual_blades",
  aper: "malleus",
  taurus: "securis",
  tigris: "dual_blades",
  leo: "gladius",
  ursus: "securis",
  rhinoceros: "securis",
  elephas: "malleus",
};

export function houseSteel(houseId: string): WeaponId {
  return STEEL[houseId] ?? "gladius";
}

export function nightBonus(kind: NightKind): { denarii: number; xp: number } {
  return kind === "weapon" ? { denarii: 110, xp: 55 } : { denarii: 80, xp: 40 };
}

export function currentNight(): NightBout | null {
  const s = gameState.save;
  if (!s.freedomWon || !s.nightOpponent || !s.nightKind) return null;
  const found = getRival(s.nightOpponent);
  if (!found) return null;
  const bonus = nightBonus(s.nightKind);
  const weapon = s.nightKind === "weapon" ? houseSteel(found.house.id) : undefined;
  return {
    kind: s.nightKind,
    opponentId: found.fighter.id,
    fighterName: found.fighter.name,
    houseName: found.house.latinName,
    houseId: found.house.id,
    weapon,
    weaponName: weapon ? getWeapon(weapon).shortName : undefined,
    bonusDenarii: bonus.denarii,
    bonusXp: bonus.xp,
  };
}

export function steelUnlocked(houseId: string): boolean {
  const id = houseSteel(houseId);
  return gameState.save.unlockedWeapons.includes(id) && getWeapon(id).playable;
}

export function ensureNight(): NightBout | null {
  if (!gameState.save.freedomWon) return null;
  const cur = currentNight();
  if (cur) return cur;
  return rollNight();
}

export function rollNight(avoidId?: string): NightBout | null {
  const s = gameState.save;
  if (!s.freedomWon) {
    s.nightKind = null;
    s.nightOpponent = null;
    return null;
  }
  const beaten = beatenRivals();
  if (!beaten.length) {
    s.nightKind = null;
    s.nightOpponent = null;
    return null;
  }
  const wantWeapon = (s.nightWins ?? 0) % 2 === 1;
  const steelHouses = beaten.filter((h) => steelUnlocked(h.id));
  const kind: NightKind = wantWeapon && steelHouses.length ? "weapon" : "exhibition";
  const pool = kind === "weapon" ? steelHouses : beaten;
  const lastHouse = avoidId ? getRival(avoidId)?.house.id : getRival(s.nightOpponent ?? "")?.house.id;
  const prefer = pool.filter((h) => h.id !== lastHouse);
  const pick = (prefer.length ? prefer : pool)[Math.floor(Math.random() * (prefer.length ? prefer.length : pool.length))];
  if (!pick) {
    s.nightKind = null;
    s.nightOpponent = null;
    return null;
  }
  s.nightKind = kind;
  s.nightOpponent = pick.championId;
  gameState.persist();
  return currentNight();
}

export function completeNight(opponentId: string): NightBout | null {
  const night = currentNight();
  if (!night || night.opponentId !== opponentId) return null;
  if (!gameState.pendingNight) return null;
  gameState.save.nightWins = (gameState.save.nightWins ?? 0) + 1;
  gameState.pendingNight = false;
  rollNight(opponentId);
  return night;
}

export function enterNight(): "ok" | "missing" | "locked" {
  const night = ensureNight();
  if (!night) return "missing";
  if (night.kind === "weapon" && night.weapon && !gameState.save.unlockedWeapons.includes(night.weapon)) {
    return "locked";
  }
  gameState.pendingArenaOpponent = night.opponentId;
  gameState.pendingNight = true;
  gameState.pendingForcedWeapon = night.kind === "weapon" ? (night.weapon ?? null) : null;
  return "ok";
}

export function clearNightEntry(): void {
  gameState.pendingNight = false;
  gameState.pendingForcedWeapon = null;
}

export function arenaWeapon(): WeaponId {
  return gameState.pendingForcedWeapon ?? gameState.save.equippedWeapon;
}

export function nightObjective(): string | null {
  const night = currentNight();
  if (!night) return null;
  if (night.kind === "weapon") {
    return `Weapon night: fight ${night.fighterName} with the ${night.weaponName}. South gate.`;
  }
  return `Exhibition tonight: ${night.fighterName} of ${night.houseName}. South gate.`;
}

export function rufusAtTable(): boolean {
  return Boolean(gameState.save.freedomWon);
}
