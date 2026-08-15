import type { ObjectiveId } from "../types";
import { OBJECTIVE_TEXT } from "../data/dialogue";
import { gameState } from "../state/GameState";
import { getRival } from "../data/houses";
import { nextUnlockedOpponent } from "./progression";

const ORDER: ObjectiveId[] = [
  "speak_lanista",
  "equip_gladius",
  "attack_dummy",
  "learn_stamina",
  "learn_dodge",
  "learn_block",
  "spar_friend",
  "return_lanista",
  "first_arena",
];

export function currentObjectiveText(): string {
  const id = gameState.save.currentObjective;
  if (id === "defeat_rival" || id === "first_arena" || id === "next_house") {
    const next = nextUnlockedOpponent();
    const found = next ? getRival(next) : undefined;
    if (found?.house.id === "rudis") {
      if (next === "tourney_1") return "The Rudis is open. Take the south gate and fight for your freedom.";
      if (next === "tourney_2") return "The Rudis continues. Defeat Balbus, the Beam.";
      if (next === "tourney_3") return "The last bout. Defeat Malleolus for the rudis.";
    }
    if (found) {
      if (id === "next_house") {
        return `${found.house.latinName} is open. Speak with Marcellus, then take the south gate.`;
      }
      if (found.fighter.isChampion) {
        return `Challenge ${found.fighter.name}, champion of ${found.house.latinName}.`;
      }
      return `Defeat ${found.fighter.name} of ${found.house.latinName}.`;
    }
  }
  return OBJECTIVE_TEXT[id] ?? OBJECTIVE_TEXT.free;
}

export function markTutorial(flag: string): void {
  if (gameState.save.tutorialFlags[flag]) return;
  gameState.save.tutorialFlags[flag] = true;

  const s = gameState.save;
  if (flag === "metLanista" && s.currentObjective === "speak_lanista") s.currentObjective = "equip_gladius";
  if (flag === "equippedWeapon" && beforeOrAt("equip_gladius")) s.currentObjective = "attack_dummy";
  if (flag === "hitDummy" && beforeOrAt("attack_dummy")) s.currentObjective = "learn_stamina";
  if (flag === "staminaDip" && beforeOrAt("learn_stamina")) s.currentObjective = "learn_dodge";
  if (flag === "dodged" && beforeOrAt("learn_dodge")) s.currentObjective = "learn_block";
  if (flag === "blocked" && beforeOrAt("learn_block")) s.currentObjective = "spar_friend";
  if (flag === "sparred" && beforeOrAt("spar_friend")) s.currentObjective = "return_lanista";
  if (flag === "readyForArena") {
    s.tutorialComplete = true;
    s.currentObjective = "first_arena";
  }
  gameState.persist();
}

function beforeOrAt(id: ObjectiveId): boolean {
  const cur = ORDER.indexOf(gameState.save.currentObjective);
  const at = ORDER.indexOf(id);
  if (cur < 0) return false;
  return cur <= at;
}

export function skipTutorial(): void {
  const s = gameState.save;
  s.tutorialComplete = true;
  s.tutorialFlags = {
    metLanista: true,
    equippedWeapon: true,
    hitDummy: true,
    staminaDip: true,
    dodged: true,
    blocked: true,
    sparred: true,
    readyForArena: true,
  };
  if (!s.unlockedWeapons.includes("gladius")) s.unlockedWeapons.push("gladius");
  s.currentObjective = "first_arena";
  gameState.persist();
}
