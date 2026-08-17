import type { FighterStats, ReputationTier, SkillId, WeaponId } from "../types";
import { gameState, xpForLevel } from "../state/GameState";
import { UNGUENT_COST, UNGUENT_MAX, REST_COST } from "../config";
import { getHouse, getRival, isTournamentId, sortedHouses } from "../data/houses";
import { TOURNAMENT_HOUSE, TOURNAMENT_ORDER } from "../data/tournament";
import { getSkill } from "../data/skills";
import { SHOP_ITEMS, shopUnlocked } from "../data/shop";
import { grantPalPoint, grantPalXp, palAnimalName, palBrought, palTier, palTitle, palUnlocked } from "../data/pal";
import { applyPrayerStats, prayerDodgeIframes, prayerMoveSpeed, clearPrayer } from "../data/patrons";
import { recordWeaponWin } from "../data/weapons";
import { allSchoolGlory, bumpSchoolTraining, chamberSlotFromId, isSchoolNpc, schoolGloryCount, schoolNextId, SCHOOL_IDS } from "../data/school";
import { getSchoolCircuitFighter } from "../data/schoolCircuit";
import { getNpc } from "../data/gladiators";
import { bus } from "./bus";
import { completeNight, ensureNight, arenaWeapon } from "./nights";
import { queueActIntro } from "./objectives";

const REP_ORDER: ReputationTier[] = [
  "Unknown",
  "Prospect",
  "Fighter",
  "Contender",
  "Champion",
  "Legend",
];

export interface SkillMods {
  attackStamina: number;
  specialMult: number;
  dodgeCost: number;
  dodgeIframes: number;
  dodgeSpeed: number;
  regen: number;
  blockBonus: number;
  moveSpeed: number;
  perfectDodgeWindow: number;
  comboStamina: number;
  blockChip: number;
}

export function playerCombatStats(): FighterStats {
  const s = { ...gameState.save.stats };
  if (gameState.save.injured) {
    s.maxHealth -= 8;
    s.attack -= 0.5;
  }
  return applyPrayerStats(s);
}

export function clearInjury(): boolean {
  if (!gameState.save.injured) return false;
  gameState.save.injured = false;
  gameState.restoreVitals();
  gameState.persist();
  bus.emit("toast", "The ache leaves you.");
  bus.emit("skills-changed");
  return true;
}

export function restInjury(): "ok" | "poor" | "healthy" {
  if (!gameState.save.injured) return "healthy";
  if (gameState.save.denarii < REST_COST) return "poor";
  addDenarii(-REST_COST);
  gameState.save.injured = false;
  gameState.restoreVitals();
  gameState.persist();
  bus.emit("skills-changed");
  return "ok";
}

export function hasSkill(id: SkillId): boolean {
  return (gameState.save.unlockedSkills ?? []).includes(id);
}

export function getSkillMods(): SkillMods {
  return {
    attackStamina: hasSkill("opening_cut") ? -2 : 0,
    specialMult: hasSkill("killing_blow") ? 1.35 : 1,
    dodgeCost: hasSkill("low_stance") ? -6 : 0,
    dodgeIframes: (hasSkill("fox_step") ? 140 : 0) + prayerDodgeIframes(),
    dodgeSpeed: hasSkill("fox_step") ? 50 : 0,
    regen: (hasSkill("second_wind") ? 10 : 0) + (hasSkill("deep_breath") ? 6 : 0),
    blockBonus: hasSkill("iron_wall") ? 0.14 : 0,
    moveSpeed: (hasSkill("quick_step") ? 14 : 0) + prayerMoveSpeed(),
    perfectDodgeWindow: hasSkill("ghost_step") ? 50 : 0,
    comboStamina: hasSkill("relentless") ? 3 : 0,
    blockChip: hasSkill("guarded_heart") ? 0.5 : 1,
  };
}

export function canUnlockSkill(id: SkillId): boolean {
  const s = gameState.save;
  if ((s.statPoints ?? 0) <= 0) return false;
  if (hasSkill(id)) return false;
  const def = getSkill(id);
  if (def.requires && !hasSkill(def.requires)) return false;
  return true;
}

export function unlockSkill(id: SkillId): boolean {
  const s = gameState.save;
  if (!canUnlockSkill(id)) return false;
  s.statPoints -= 1;
  s.unlockedSkills = [...(s.unlockedSkills ?? []), id];
  if (id === "iron_edge") s.stats.attack += 1.5;
  if (id === "heavy_hands") s.stats.attack += 2;
  if (id === "thick_hide") {
    s.stats.maxHealth += 16;
    s.health += 16;
  }
  if (id === "firm_guard") s.stats.defense += 1.5;
  if (id === "second_wind") {
    s.stats.maxStamina += 12;
    s.stamina += 12;
  }
  if (id === "quick_step") s.stats.agility += 1.5;
  if (id === "deep_breath") {
    s.stats.maxStamina += 10;
    s.stamina += 10;
  }
  gameState.persist();
  bus.emit("skills-changed");
  return true;
}

export function addXp(amount: number): { leveled: boolean; newLevel: number } {
  const s = gameState.save;
  if (amount <= 0) return { leveled: false, newLevel: s.level };
  s.xp += amount;
  let leveled = false;
  let gained = 0;
  while (s.xp >= s.xpToNext) {
    s.xp -= s.xpToNext;
    s.level += 1;
    s.xpToNext = xpForLevel(s.level);
    s.stats.maxHealth += 6;
    s.stats.maxStamina += 4;
    s.stats.attack += 0.6;
    s.stats.defense += 0.4;
    s.stats.agility += 0.3;
    s.statPoints += 1;
    s.health = s.stats.maxHealth - (s.injured ? 8 : 0) + (s.activePrayer === "silvanus" ? 12 : 0);
    s.stamina = s.stats.maxStamina + (s.activePrayer === "lares" ? 8 : 0);
    s.dummyHits = 0;
    leveled = true;
    gained += 1;
  }
  if (leveled) {
    bus.emit("level-up", s.level);
    bus.emit("toast", `Level ${s.level}! Press K or Esc for the Skill Tree (${s.statPoints} point${s.statPoints === 1 ? "" : "s"})`);
  }
  void gained;
  return { leveled, newLevel: s.level };
}

export function applyDummyXp(): { xp: number; leveled: boolean } {
  const s = gameState.save;
  const hits = s.dummyHits ?? 0;
  if (hits >= 24) return { xp: 0, leveled: false };
  s.dummyHits = hits + 1;
  const xp = hits < 8 ? 3 : hits < 16 ? 2 : 1;
  const { leveled } = addXp(xp);
  gameState.persist();
  return { xp, leveled };
}

export function addDenarii(amount: number): void {
  gameState.save.denarii = Math.max(0, gameState.save.denarii + amount);
  bus.emit("denarii-changed", amount);
}

export function buyUnguent(): "bought" | "full" | "poor" {
  const s = gameState.save;
  if ((s.unguent ?? 0) >= UNGUENT_MAX) return "full";
  if (s.denarii < UNGUENT_COST) return "poor";
  addDenarii(-UNGUENT_COST);
  s.unguent = (s.unguent ?? 0) + 1;
  gameState.persist();
  bus.emit("unguent-changed", s.unguent);
  return "bought";
}

export function buyCosmetic(id: string): "bought" | "equipped" | "poor" | "locked" | "owned" {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return "locked";
  const s = gameState.save;
  if (!shopUnlocked(item)) return "locked";
  if ((s.ownedCosmetics ?? []).includes(id)) {
    equipCosmetic(id);
    return "equipped";
  }
  if (item.cost > 0 && s.denarii < item.cost) return "poor";
  if (item.cost > 0) addDenarii(-item.cost);
  s.ownedCosmetics = [...(s.ownedCosmetics ?? []), id];
  equipCosmetic(id);
  gameState.persist();
  return "bought";
}

export function equipCosmetic(id: string): void {
  const item = SHOP_ITEMS.find((i) => i.id === id);
  if (!item) return;
  const s = gameState.save;
  if (item.kind === "tunic") s.tunic = id.replace("tunic-", "") as typeof s.tunic;
  if (item.kind === "plume") s.plume = id.replace("plume-", "");
  if (item.kind === "helm") s.helm = id.replace("helm-", "") as typeof s.helm;
  if (item.kind === "title") s.title = id.replace("title-", "");
  if (item.kind === "cape") s.cape = id.replace("cape-", "");
  if (item.kind === "scar") s.scar = id.replace("scar-", "");
  if (item.kind === "chamber") {
    const slot = chamberSlotFromId(id);
    s.chamber = { ...s.chamber, [slot]: id };
  }
  gameState.persist();
  bus.emit("cosmetics-changed");
}

export function bumpReputation(): void {
  const s = gameState.save;
  const wins = s.defeatedOpponents.length;
  let tier: ReputationTier = "Unknown";
  if (wins >= 1) tier = "Prospect";
  if (wins >= 3) tier = "Fighter";
  if (s.defeatedHouses.length >= 1) tier = "Contender";
  if (s.defeatedHouses.length >= 3) tier = "Champion";
  if (s.freedomWon || s.defeatedHouses.length >= 8) tier = "Legend";
  const idx = Math.max(REP_ORDER.indexOf(s.reputation), REP_ORDER.indexOf(tier));
  s.reputation = REP_ORDER[idx];
}

function grantWeapon(id: WeaponId): void {
  if (!gameState.save.unlockedWeapons.includes(id)) gameState.save.unlockedWeapons.push(id);
}

export function applyArenaVictory(opponentId: string): { denarii: number; xp: number; unlocked?: WeaponId; leveled: boolean; palNote?: string; nightNote?: string } {
  const found = getRival(opponentId);
  if (!found) return { denarii: 0, xp: 0, leveled: false };
  const { house, fighter } = found;
  const s = gameState.save;
  const wasNight = gameState.pendingNight;
  const firstWin = !s.defeatedOpponents.includes(opponentId);
  if (firstWin) s.defeatedOpponents.push(opponentId);
  const rawXp = firstWin ? fighter.rewards.xp : Math.round(fighter.rewards.xp * 0.5);
  const bond = palUnlocked(s) ? (palBrought(s) ? 0.9 : 1.15) : 1;
  let xp = Math.round(rawXp * bond);
  let denarii = firstWin ? fighter.rewards.denarii : Math.round(fighter.rewards.denarii * 0.5);
  let nightNote: string | undefined;
  const finishedNight = completeNight(opponentId);
  if (finishedNight) {
    denarii += finishedNight.bonusDenarii;
    xp += finishedNight.bonusXp;
    nightNote =
      finishedNight.kind === "weapon"
        ? `Weapon night. The editor pays extra. +${finishedNight.bonusDenarii} denarii.`
        : `Exhibition. The editor pays extra. +${finishedNight.bonusDenarii} denarii.`;
  }
  if (s.activePrayer === "victoria") xp = Math.round(xp * 1.15);
  if (s.activePrayer === "fortuna") denarii = Math.round(denarii * 1.2);
  addDenarii(denarii);
  const { leveled } = addXp(xp);
  const armed = arenaWeapon();
  if (armed) recordWeaponWin(armed);
  const unlocked: WeaponId[] = [];
  let palNote: string | undefined;
  if (firstWin && fighter.rewards.unlockWeapon) {
    grantWeapon(fighter.rewards.unlockWeapon);
    unlocked.push(fighter.rewards.unlockWeapon);
  }
  if (firstWin && house.id !== "rudis" && !fighter.isChampion && house.fighters[0]?.id === opponentId) {
    if (!s.unlockedWeapons.includes("spear")) {
      grantWeapon("spear");
      unlocked.push("spear");
    }
  }
  if (firstWin && fighter.isChampion && house.id !== "rudis") {
    const beforeTier = palTier(s);
    if (!s.defeatedHouses.includes(house.id)) s.defeatedHouses.push(house.id);
    if (!s.unlockedWeapons.includes("securis")) {
      grantWeapon("securis");
      unlocked.push("securis");
    }
    const champs = rivalHouses().filter((h) => s.defeatedHouses.includes(h.id)).length;
    if (champs >= 5 && !s.unlockedWeapons.includes("malleus")) {
      grantWeapon("malleus");
      unlocked.push("malleus");
    }
    s.dialogueFlags[`home-${house.id}`] = true;
    if (!s.palUnlocked && champs >= 1) {
      s.palUnlocked = true;
      s.palBrought = true;
      grantPalPoint();
      palNote = `A ${palAnimalName(s).toLowerCase()} of your pledged house takes the roost. A pal point is yours.`;
    } else if (s.palUnlocked && palTier(s) > beforeTier) {
      palNote = `Your ${palAnimalName(s).toLowerCase()} grows. It is now ${palTitle(palTier(s), s)}.`;
    }
    if (palBrought(s) && s.defeatedHouses.length > 1) {
      grantPalPoint("The pit taught your pal. +1 pal point.");
      palNote = palNote ? `${palNote}\nThe pit taught your pal. +1 pal point.` : "The pit taught your pal. +1 pal point.";
    }
  }
  if (firstWin && isTournamentId(opponentId)) {
    s.tournamentWins = Math.max(s.tournamentWins, TOURNAMENT_ORDER.indexOf(opponentId as (typeof TOURNAMENT_ORDER)[number]) + 1);
    if (opponentId === "tourney_3") {
      const beforeTier = palTier(s);
      s.freedomWon = true;
      s.reputation = "Legend";
      grantWeapon("malleus");
      if (!s.ownedCosmetics.includes("title-freeman")) s.ownedCosmetics.push("title-freeman");
      s.title = "freeman";
      bus.emit("cosmetics-changed");
      if (s.palUnlocked && palTier(s) > beforeTier) {
        palNote = `Your ${palAnimalName(s).toLowerCase()} becomes ${palTitle(palTier(s), s)}.`;
      }
      ensureNight();
      queueActIntro();
    }
  }
  if (palUnlocked(s) && palBrought(s)) {
    const gained = grantPalXp(Math.max(8, Math.round(xp * 0.35)));
    const xpLine = gained.gained
      ? `Bond XP +${gained.amount}. A pal point is ready in the roost.`
      : `Bond XP +${gained.amount}.`;
    palNote = palNote ? `${palNote}\n${xpLine}` : xpLine;
  }
  bumpReputation();
  advanceAfterWin(opponentId);
  if (!wasNight && wantsFeast(opponentId)) {
    /* leave() begins the feast tired — do not top off here */
  } else {
    gameState.restoreVitals();
  }
  gameState.persist();
  return {
    denarii,
    xp,
    unlocked: firstWin ? unlocked[0] : undefined,
    leveled,
    palNote,
    nightNote,
  };
}

export function applyArenaDefeat(spared = false): void {
  const nightLoss = gameState.pendingNight;
  if (!spared) {
    addDenarii(-5);
    grantSteelScar();
    if (gameState.save.activePrayer) {
      clearPrayer();
      bus.emit("toast", "The prayer fades.");
    }
  }
  if (!spared || nightLoss) {
    gameState.save.injured = true;
    bus.emit("toast", nightLoss && spared ? "The night still marked you." : "The body remembers the fall.");
  }
  gameState.restoreVitals();
  gameState.persist();
}

function grantSteelScar(): void {
  const s = gameState.save;
  s.steelFalls = (s.steelFalls ?? 0) + 1;
  const n = s.steelFalls;
  const grant = (id: string, flag: string, label: string): void => {
    s.storyFlags[flag] = true;
    if (!s.ownedCosmetics.includes(id)) s.ownedCosmetics.push(id);
    bus.emit("toast", label);
  };
  if (n === 1) grant("scar-cheek", "steelScar1", "The fall left a mark on your cheek. Equip it in Quarters → Scars.");
  else if (n === 2) grant("scar-brow", "steelScar2", "A second unsaved fall cut the brow. Equip it in Quarters → Scars.");
  else if (n === 3) grant("scar-sash", "steelScar3", "A marked sash is yours. Equip it in Quarters → Scars.");
}

export function restSchoolInjury(npcId: string): "ok" | "free" | "poor" | "healthy" | "unknown" {
  if (!isSchoolNpc(npcId)) return "unknown";
  const rec = gameState.save.school[npcId];
  if (!rec.injured) return "healthy";
  const free = gameState.schoolFreeRestAvailable;
  if (!free && gameState.save.denarii < REST_COST) return "poor";
  if (free) gameState.schoolFreeRestAvailable = false;
  else addDenarii(-REST_COST);
  rec.injured = false;
  gameState.persist();
  bus.emit("skills-changed");
  return free ? "free" : "ok";
}

export function applySchoolBout(npcId: string, opponentId: string, won: boolean): { denarii: number; glory: boolean; allGlory: boolean } {
  const rec = isSchoolNpc(npcId) ? gameState.save.school[npcId] : null;
  const found = getRival(opponentId);
  const circuitHit = getSchoolCircuitFighter(opponentId);
  let denarii = 0;
  let glory = false;
  if (rec) {
    if (won) {
      rec.wins += 1;
      denarii = Math.max(8, Math.round((found?.fighter.rewards.denarii ?? 20) * 0.4));
      addDenarii(denarii);
      addXp(18);
      const rung = circuitHit?.rung ?? (found?.fighter.isChampion ? 2 : 0);
      if (!rec.glory && rung === rec.rung) {
        rec.rung = Math.min(3, rec.rung + 1);
      }
      if ((found?.fighter.isChampion || rec.rung >= 3) && !rec.glory) {
        rec.glory = true;
        rec.rung = 3;
        glory = true;
        grantStudentGloryBeat(npcId);
      }
    } else {
      rec.losses += 1;
      rec.injured = true;
      const npc = isSchoolNpc(npcId) ? npcId : "";
      const theirs = npc === "aelia" ? "Hers" : "His";
      bus.emit("toast", `The body remembers. ${theirs}, this time.`);
    }
  }
  const allGlory = allSchoolGlory();
  if (allGlory) grantSchoolGloryClimax();
  if (gameState.save.lanistaUnlocked) gameState.setObjective("school");
  gameState.restoreVitals();
  gameState.persist();
  return { denarii, glory, allGlory };
}

const GLORY_BEATS: Record<string, { toast: string; denarii: number; xp: number }> = {
  titus: { toast: "Titus holds the line. Glory.", denarii: 25, xp: 40 },
  brom: { toast: "Brom breaks the pride. Glory.", denarii: 28, xp: 45 },
  aelia: { toast: "Aelia’s clean cut. Glory.", denarii: 30, xp: 50 },
  rufus: { toast: "Rufus slips clear. Glory. Speak with Marcellus.", denarii: 35, xp: 55 },
};

function grantStudentGloryBeat(npcId: string): void {
  const beat = GLORY_BEATS[npcId];
  const next = schoolNextId(npcId);
  if (!beat) {
    bus.emit("toast", `${getNpc(npcId).name} earned glory.`);
    return;
  }
  addDenarii(beat.denarii);
  addXp(beat.xp);
  const unlock = next ? ` ${getNpc(next).name}'s locker opens.` : "";
  bus.emit("toast", `${beat.toast}${unlock} (+${beat.denarii} denarii)`);
}

export function grantSchoolGloryClimax(): void {
  const s = gameState.save;
  if (!allSchoolGlory()) return;
  if (s.storyFlags.act3Complete) return;
  s.storyFlags.act3Ready = true;
  s.storyFlags.act3Complete = true;
  if (!s.ownedCosmetics.includes("title-sand-teacher")) s.ownedCosmetics.push("title-sand-teacher");
  if (!s.title || s.title === "lanista" || s.title === "aquila" || s.title === "none") {
    s.title = "sand-teacher";
  }
  s.currentObjective = "school";
  addXp(80);
  addDenarii(40);
  gameState.persist();
  bus.emit("cosmetics-changed");
  bus.emit("toast", "Teacher of the Sand. The four have glory under your hand.");
}

export function applySparReward(npcId: string, playerWon: boolean): { xp: number; denarii: number } {
  const wins = gameState.save.sparWins[npcId] ?? 0;
  gameState.save.sparWins[npcId] = wins + 1;
  let xp = 0;
  let denarii = 0;
  if (playerWon) {
    if (wins === 0) xp = 32;
    else if (wins < 5) xp = 14;
    else xp = 8;
    denarii = wins < 4 ? 4 : 1;
  } else {
    xp = wins === 0 ? 12 : 6;
  }
  addXp(xp);
  addDenarii(denarii);
  bumpSchoolTraining(npcId);
  gameState.restoreVitals();
  gameState.persist();
  if (gameState.save.lanistaUnlocked && isSchoolNpc(npcId)) {
    const rec = gameState.save.school[npcId];
    bus.emit("toast", `${getNpc(npcId).name}: Training ${rec.training}/6 (spar adds training)`);
  }
  return { xp, denarii };
}

function advanceAfterWin(id: string): void {
  const s = gameState.save;
  if (s.lanistaUnlocked) {
    gameState.setObjective("school");
    return;
  }
  if (s.freedomWon) {
    gameState.setObjective("take_school");
    return;
  }
  if (id === "tourney_1") {
    gameState.setObjective("tournament_2");
    return;
  }
  if (id === "tourney_2") {
    gameState.setObjective("tournament_3");
    return;
  }
  if (id === "tourney_3") {
    gameState.setObjective(s.lanistaUnlocked ? "school" : "take_school");
    return;
  }
  const found = getRival(id);
  if (found?.fighter.isChampion) {
    if (allRivalsBeaten()) gameState.setObjective("tournament_1");
    else gameState.setObjective("next_house");
    return;
  }
  gameState.setObjective(s.tutorialComplete ? "defeat_rival" : "first_arena");
}

export function wantsFeast(opponentId: string, night = false): boolean {
  if (night) return false;
  if (getRival(opponentId)?.fighter.isChampion) return true;
  return isTournamentId(opponentId) && gameState.save.freedomWon;
}

export function drinkFeast(kind: "wine" | "beer"): "ok" | "empty" {
  if (kind === "wine" && gameState.feastWineDrunk) return "empty";
  if (kind === "beer" && gameState.feastBeerDrunk) return "empty";
  if (kind === "wine") gameState.feastWineDrunk = true;
  else gameState.feastBeerDrunk = true;
  const s = gameState.save;
  const live = playerCombatStats();
  s.health = Math.min(live.maxHealth, s.health + 28);
  s.stamina = Math.min(live.maxStamina, s.stamina + 22);
  if (s.injured) {
    s.injured = false;
    const healed = playerCombatStats();
    s.health = Math.min(healed.maxHealth, s.health + (healed.maxHealth - live.maxHealth));
    bus.emit("skills-changed");
  }
  gameState.persist();
  return "ok";
}

export function rivalHouses() {
  const pledged = gameState.save.playerHouse;
  return sortedHouses().filter((h) => !pledged || h.id !== pledged);
}

export function allRivalsBeaten(): boolean {
  const s = gameState.save;
  const rivals = rivalHouses();
  if (rivals.every((h) => s.defeatedHouses.includes(h.id))) return true;
  const openedRudis =
    Boolean(s.freedomWon) || (s.tournamentWins ?? 0) > 0 || s.currentObjective.startsWith("tournament");
  if (!openedRudis) return false;
  return rivals
    .filter((h) => h.id !== "tigris" && h.id !== "rhinoceros" && h.id !== "elephas")
    .every((h) => s.defeatedHouses.includes(h.id));
}

export function tournamentUnlocked(): boolean {
  return gameState.save.tutorialComplete && allRivalsBeaten() && !gameState.save.freedomWon;
}

export function nextUnlockedOpponent(): string | null {
  const s = gameState.save;
  if (!s.tutorialComplete) return null;
  if (s.freedomWon) return null;
  if (allRivalsBeaten()) {
    const idx = s.tournamentWins ?? 0;
    return TOURNAMENT_ORDER[idx] ?? null;
  }
  for (const house of rivalHouses()) {
    for (const f of house.fighters) {
      if (!s.defeatedOpponents.includes(f.id)) return f.id;
    }
  }
  return null;
}

export function isHouseUnlocked(id: string): boolean {
  const s = gameState.save;
  if (id === TOURNAMENT_HOUSE.id) return tournamentUnlocked() || Boolean(s.freedomWon);
  if (!s.tutorialComplete) return false;
  const rivals = rivalHouses();
  const idx = rivals.findIndex((h) => h.id === id);
  if (idx < 0) return false;
  if (idx === 0) return true;
  return s.defeatedHouses.includes(rivals[idx - 1].id);
}

export function houseLockHint(id: string): string {
  if (id === TOURNAMENT_HOUSE.id) return "Beat the other houses first. Then the Rudis opens.";
  const rivals = rivalHouses();
  const idx = rivals.findIndex((h) => h.id === id);
  if (idx <= 0) return "Finish training first.";
  const prev = rivals[idx - 1];
  return `Beat the ${prev.animalName} champion first.`;
}

export function isOpponentUnlocked(id: string): boolean {
  const s = gameState.save;
  if (!s.tutorialComplete) return false;
  if (isTournamentId(id)) {
    if (!allRivalsBeaten()) return false;
    const idx = TOURNAMENT_ORDER.indexOf(id as (typeof TOURNAMENT_ORDER)[number]);
    if (idx < 0) return false;
    if (idx === 0) return true;
    return s.defeatedOpponents.includes(TOURNAMENT_ORDER[idx - 1]);
  }
  const found = getRival(id);
  if (!found) return false;
  if (!isHouseUnlocked(found.house.id)) return false;
  const i = found.house.fighters.findIndex((f) => f.id === id);
  if (i <= 0) return true;
  return s.defeatedOpponents.includes(found.house.fighters[i - 1].id);
}

export function nextHouseAfter(id: string) {
  const rivals = rivalHouses();
  const idx = rivals.findIndex((h) => h.id === id);
  if (idx < 0) return rivals[0];
  return rivals[idx + 1];
}

export function pledgedHouse() {
  const id = gameState.save.playerHouse;
  return id ? getHouse(id) : undefined;
}
