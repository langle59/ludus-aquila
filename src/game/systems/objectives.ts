import type { ObjectiveId } from "../types";
import { OBJECTIVE_TEXT } from "../data/dialogue";
import { gameState } from "../state/GameState";
import { getRival } from "../data/houses";
import { nextUnlockedOpponent } from "./progression";
import { nightObjective } from "./nights";
import { allSchoolGlory, schoolGloryCount, SCHOOL_IDS } from "../data/school";
import { mergedKeybinds, prettyKey } from "./input";
import { bus } from "./bus";

export const BOUT_ORDER = ["titus", "rufus", "brom", "aelia"] as const;
export type BoutNpcId = (typeof BOUT_ORDER)[number];

export const BOUT_FLAGS: Record<BoutNpcId, string> = {
  titus: "boutTitus",
  rufus: "boutRufus",
  brom: "boutBrom",
  aelia: "boutAelia",
};

const BOUT_OBJECTIVES: Record<BoutNpcId, ObjectiveId> = {
  titus: "bout_titus",
  rufus: "bout_rufus",
  brom: "bout_brom",
  aelia: "bout_aelia",
};

const ORDER: ObjectiveId[] = [
  "speak_lanista",
  "equip_gladius",
  "attack_dummy",
  "learn_stamina",
  "learn_heavy",
  "learn_dodge",
  "learn_block",
  "learn_parry",
  "bout_titus",
  "bout_rufus",
  "bout_brom",
  "bout_aelia",
  "return_lanista",
  "first_arena",
];

export function currentBoutNpc(): BoutNpcId | null {
  const id = gameState.save.currentObjective;
  if (id === "bout_titus") return "titus";
  if (id === "bout_rufus") return "rufus";
  if (id === "bout_brom") return "brom";
  if (id === "bout_aelia") return "aelia";
  return null;
}

export function allHouseBoutsWon(): boolean {
  const flags = gameState.save.tutorialFlags;
  return BOUT_ORDER.every((id) => flags[BOUT_FLAGS[id]]);
}

export type ActId = 1 | 2 | 3;

export const ACT_META: Record<
  ActId,
  { roman: string; title: string; blurb: string }
> = {
  1: {
    roman: "I",
    title: "The Yard",
    blurb: "Learn the steel. Beat the four. Earn Marcellus's name.",
  },
  2: {
    roman: "II",
    title: "The Circuit",
    blurb: "Walk the houses. Win favor. Claim the rudis.",
  },
  3: {
    roman: "III",
    title: "The School",
    blurb: "Lockers. Lessons. Their circuit. Four glories under your hand.",
  },
};

export function currentAct(): ActId {
  const s = gameState.save;
  if (s.freedomWon || s.lanistaUnlocked) return 3;
  if (s.tutorialComplete) return 2;
  return 1;
}

export function actIntroFlag(act: ActId = currentAct()): string {
  return `actIntro${act}`;
}

/** Show the act title card once when that act first begins. */
export function queueActIntro(): void {
  const act = currentAct();
  const flag = actIntroFlag(act);
  if (gameState.save.storyFlags[flag]) return;
  gameState.save.storyFlags[flag] = true;
  gameState.persist();
  bus.emit("act-card", act);
}

export function actHudPrefix(): string {
  const meta = ACT_META[currentAct()];
  return `Act ${meta.roman} — ${meta.title} · `;
}

export function currentObjectiveText(): string {
  const id = gameState.save.currentObjective;
  const prefix = actHudPrefix();
  const b = mergedKeybinds();
  if (id === "speak_lanista") return `${prefix}WASD or arrows to move. Speak with Marcellus.`;
  if (id === "attack_dummy") return `${prefix}Light attack (${prettyKey(b.attack)}) on the dummy.`;
  if (id === "learn_stamina") return `${prefix}Watch your stamina. Attack until it dips, then let it return.`;
  if (id === "learn_heavy") return `${prefix}Heavy attack (${prettyKey(b.heavy)}) on the dummy.`;
  if (id === "learn_dodge") return `${prefix}Press ${prettyKey(b.dodge)} to dodge.`;
  if (id === "learn_block") return `${prefix}Hold ${prettyKey(b.block)} to block.`;
  if (id === "learn_parry") return `${prefix}Tap ${prettyKey(b.parry)} to parry.`;
  if (id === "bout_titus") return `${prefix}Defeat Titus in the yard. Yield does not count.`;
  if (id === "bout_rufus") return `${prefix}Defeat Rufus in the yard.`;
  if (id === "bout_brom") return `${prefix}Defeat Brom in the yard.`;
  if (id === "bout_aelia") return `${prefix}Defeat Aelia in the yard.`;
  if (id === "return_lanista") return `${prefix}Return to Marcellus. He will name a champion.`;
  if (id === "take_school") return `${prefix}The rudis is yours. Speak with Marcellus about the school.`;
  if (id === "defeat_rival" || id === "first_arena" || id === "next_house") {
    const next = nextUnlockedOpponent();
    const found = next ? getRival(next) : undefined;
    if (found?.house.id === "rudis") {
      if (next === "tourney_1") return `${prefix}The Rudis is open. Take the south gate and fight for your freedom.`;
      if (next === "tourney_2") return `${prefix}The Rudis continues. Defeat Balbus, the Beam.`;
      if (next === "tourney_3") return `${prefix}The last bout. Defeat Malleolus for the rudis.`;
    }
    if (found) {
      if (id === "next_house") {
        return `${prefix}${found.house.latinName} is open. Speak with Marcellus, then take the south gate.`;
      }
      if (found.fighter.isChampion) {
        return `${prefix}Challenge ${found.fighter.name}, champion of ${found.house.latinName}.`;
      }
      return `${prefix}Defeat ${found.fighter.name} of ${found.house.latinName}.`;
    }
  }
  if (id === "free") {
    const night = nightObjective();
    if (night) return `${prefix}${night}`;
  }
  if (id === "school") {
    if (gameState.save.storyFlags.act3Complete || allSchoolGlory()) {
      return `${prefix}Teacher of the Sand. The four have glory. Speak with Marcellus.`;
    }
    const gloryN = schoolGloryCount();
    const night = nightObjective();
    if (night) return `${prefix}Glory ${gloryN}/${SCHOOL_IDS.length}. ${night}`;
    return `${prefix}Glory ${gloryN}/${SCHOOL_IDS.length} — Titus first, then Brom, Aelia, Rufus. Spar for Training; Teach for Lessons.`;
  }
  const base = OBJECTIVE_TEXT[id] ?? OBJECTIVE_TEXT.free;
  return `${prefix}${base}`;
}

export function markTutorial(flag: string): void {
  const s = gameState.save;
  const first = !s.tutorialFlags[flag];
  if (first) s.tutorialFlags[flag] = true;

  if (flag === "metLanista" && s.currentObjective === "speak_lanista") s.currentObjective = "equip_gladius";
  if (flag === "equippedWeapon" && beforeOrAt("equip_gladius")) s.currentObjective = "attack_dummy";
  if (flag === "hitDummy" && beforeOrAt("attack_dummy")) s.currentObjective = "learn_stamina";
  if (flag === "staminaDip" && beforeOrAt("learn_stamina")) s.currentObjective = "learn_heavy";
  if (flag === "hitHeavy" && beforeOrAt("learn_heavy")) s.currentObjective = "learn_dodge";
  if (flag === "dodged" && beforeOrAt("learn_dodge")) s.currentObjective = "learn_block";
  if (flag === "blocked" && beforeOrAt("learn_block")) s.currentObjective = "learn_parry";
  if (flag === "parried" && beforeOrAt("learn_parry")) s.currentObjective = "bout_titus";
  if (flag === "boutTitus" && beforeOrAt("bout_titus")) s.currentObjective = "bout_rufus";
  if (flag === "boutRufus" && beforeOrAt("bout_rufus")) s.currentObjective = "bout_brom";
  if (flag === "boutBrom" && beforeOrAt("bout_brom")) s.currentObjective = "bout_aelia";
  if (flag === "boutAelia" && beforeOrAt("bout_aelia")) s.currentObjective = "return_lanista";
  if (flag === "readyForArena") {
    crownAquilaChampion();
    s.tutorialComplete = true;
    s.currentObjective = "first_arena";
    bus.emit("cosmetics-changed");
    queueActIntro();
  }
  catchUpTutorial();
  if (first || s.currentObjective) gameState.persist();
}

function crownAquilaChampion(): void {
  const s = gameState.save;
  if (!s.ownedCosmetics.includes("title-aquila")) s.ownedCosmetics.push("title-aquila");
  if (!s.title || s.title === "none") s.title = "aquila";
}

function catchUpTutorial(): void {
  const s = gameState.save;
  if (s.tutorialComplete) return;
  const steps: Array<[ObjectiveId, string, ObjectiveId]> = [
    ["learn_stamina", "staminaDip", "learn_heavy"],
    ["learn_heavy", "hitHeavy", "learn_dodge"],
    ["learn_dodge", "dodged", "learn_block"],
    ["learn_block", "blocked", "learn_parry"],
    ["learn_parry", "parried", "bout_titus"],
    ["bout_titus", "boutTitus", "bout_rufus"],
    ["bout_rufus", "boutRufus", "bout_brom"],
    ["bout_brom", "boutBrom", "bout_aelia"],
    ["bout_aelia", "boutAelia", "return_lanista"],
  ];
  let guard = 0;
  while (guard++ < 12) {
    const step = steps.find((row) => row[0] === s.currentObjective);
    if (!step || !s.tutorialFlags[step[1]]) break;
    s.currentObjective = step[2];
  }
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
    hitHeavy: true,
    dodged: true,
    blocked: true,
    parried: true,
    boutTitus: true,
    boutRufus: true,
    boutBrom: true,
    boutAelia: true,
    sparred: true,
    readyForArena: true,
  };
  if (!s.unlockedWeapons.includes("gladius")) s.unlockedWeapons.push("gladius");
  if (!s.equippedWeapon) s.equippedWeapon = "gladius";
  crownAquilaChampion();
  s.currentObjective = "first_arena";
  gameState.persist();
  bus.emit("cosmetics-changed");
  queueActIntro();
}

export { BOUT_OBJECTIVES };
