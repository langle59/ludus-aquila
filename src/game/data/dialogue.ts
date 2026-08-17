import type { ObjectiveId } from "../types";
import { gameState } from "../state/GameState";
import { getHouse, getRival } from "./houses";
import {
  allRivalsBeaten,
  nextUnlockedOpponent,
  pledgedHouse,
  rivalHouses,
} from "../systems/progression";
import { palAnimalName, palBrought, palNextHint, palTier, palTitle, palUnlocked } from "./pal";
import { allSchoolGlory, getSchoolRecord } from "./school";
import { ensureNight, nightEditorLine } from "../systems/nights";

type LineFn = () => string[];

function beaten(): number {
  return gameState.save.defeatedHouses.length;
}

function lastBeatenAnimal(): string | null {
  const ids = gameState.save.defeatedHouses;
  const last = ids[ids.length - 1];
  if (!last) return null;
  return getHouse(last)?.animalName ?? null;
}

function afterAnyWin(): boolean {
  return gameState.save.defeatedOpponents.length > 0;
}

function tutorialDone(): boolean {
  return gameState.save.tutorialComplete;
}

function boutHint(): string | null {
  const id = gameState.save.currentObjective;
  if (id === "bout_titus") return "Titus";
  if (id === "bout_rufus") return "Rufus";
  if (id === "bout_brom") return "Brom";
  if (id === "bout_aelia") return "Aelia";
  return null;
}

function yardBoutLines(selfName: string): string[] | null {
  if (tutorialDone()) return null;
  const need = boutHint();
  if (!need) {
    if (gameState.save.currentObjective === "return_lanista") {
      return [`"Go back to Marcellus. The yard already named you."`];
    }
    return [`"Dummy first. Then the four of us. Marcellus is watching."`];
  }
  if (need !== selfName) return [`"Not me. ${need} first."`];
  return [`"Walk up. Click SPAR. Drop me. Yield does not count."`];
}

function houseCloth(): string {
  return pledgedHouse()?.animalName ?? "Eagle";
}

function feastLast(): string {
  return lastBeatenAnimal() ?? "that house";
}

function consumeWelcome(npcId: string): string | null {
  const houseId = Object.keys(gameState.save.dialogueFlags)
    .filter((k) => k.startsWith("home-") && gameState.save.dialogueFlags[k])
    .map((k) => k.slice(5))
    .pop();
  if (!houseId) return null;
  const flag = `greet-${houseId}-${npcId}`;
  if (gameState.save.dialogueFlags[flag]) return null;
  gameState.save.dialogueFlags[flag] = true;
  gameState.persist();
  const found = rivalHouses().find((h) => h.id === houseId);
  return found?.animalName ?? "the last house";
}

export const DIALOGUE: Record<string, LineFn> = {
  lanista: () => {
    const s = gameState.save;
    if (gameState.pendingFeast) {
      return [
        `"I heard the shout from the sand. The house is in the feast."`,
        `"Drink. Then come back when the cup is empty."`,
      ];
    }
    if (s.injured) {
      return [
        `"You limp. Rest in Quarters for a few denarii, or drink unguent."`,
        `"I will not send a broken man to the sand."`,
      ];
    }
    if (s.freedomWon && !s.lanistaUnlocked) {
      return [
        `"The rudis is yours. The yard is still my voice."`,
        `"The book of the school is not. Titus, Brom, Aelia, Rufus — they need a man who has stood on the sand and come back."`,
        `"Take the loft above quarters. Send them from the south gate. Watch. Their scars are not yours."`,
      ];
    }
    if (s.lanistaUnlocked && (s.storyFlags.act3Complete || allSchoolGlory())) {
      return [
        `"Teacher of the Sand. The four have names the stands know."`,
        `"You showed them in the yard. You watched them climb. That is the book, finished."`,
        `"Other houses still keep men in chains. The west gate opens to the Freed Camp — Cassian waits there."`,
        `"Take two with you. Farm what you can. Break Ludus Serpens first."`,
      ];
    }
    if (s.lanistaUnlocked) {
      const night = ensureNight();
      if (night?.kind === "weapon") {
        return [
          `"The book is yours. The editor still pays."`,
          `"${nightEditorLine(night)} You fight with the ${night.weaponName}. Or send a student from the School tab."`,
        ];
      }
      if (night) {
        return [
          `"The book is yours. The editor still wants a name on the sand."`,
          `"${nightEditorLine(night)} Fight it yourself, or send one of the four."`,
        ];
      }
      return [
        `"The loft is open. East of the yard — four lockers."`,
        `"Teach in order: Titus, then Brom, then Aelia, then Rufus. Each needs more lessons and spars than the last."`,
        `"Each has three bouts — Prospect, Contender, Pride. SPAR for Training. Teach for Lessons. Coach them from the stands."`,
      ];
    }
    if (s.freedomWon) {
      const night = ensureNight();
      if (night?.kind === "weapon") {
        return [
          `"The rudis is yours. The editor still pays."`,
          `"${nightEditorLine(night)} You fight with the ${night.weaponName}."`,
          `"Take the south gate. The yard is still yours after."`,
        ];
      }
      if (night) {
        return [
          `"The rudis is yours. The editor still wants a name on the sand."`,
          `"${nightEditorLine(night)} A purse fight. Come back heavier."`,
        ];
      }
      return [
        `"The rudis is yours. Wood, not steel. That is the point."`,
        `"You may still train. You may still fight. But no man here owns your name."`,
      ];
    }
    if (s.currentObjective === "tournament_2") {
      return [`"Balbus is a falling beam. Do not be under it. Then the Hammer."`];
    }
    if (s.currentObjective === "tournament_3") {
      return [
        `"Malleolus ends men with a hammer. Dodge the first slam. Then get inside it."`,
        `"Win, and I will put wood in your hand. Walk out the gate as a free man."`,
      ];
    }
    if (allRivalsBeaten() || s.currentObjective === "tournament_1") {
      return [
        `"The other houses are beaten. The editor has opened the Rudis."`,
        `"Three bouts. No banners. Win them, and the wooden sword is yours. Freedom."`,
        `"The south gate. Do not make me wait."`,
      ];
    }
    if (palUnlocked() && s.defeatedHouses.length === 1) {
      const animal = palAnimalName().toLowerCase();
      return [
        `"You took a house. The ${animal} of your pledge is yours now. It waits in the roost, west of my hall."`,
        `"Bring it to the sand. Beat more houses, and it grows."`,
      ];
    }
    const next = nextUnlockedOpponent();
    const found = next ? getRival(next) : undefined;
    if (found) {
      const tips: Record<string, string[]> = {
        serp_1: [`"The gate is open. ${found.house.latinName} sent a cub named Livia — range first, always."`, `"Dodge the point. Then make her pay. Come back standing."`],
        serp_2: [`"Kaeso's net is a question. Do not answer it with your feet planted."`],
        serp_elite: [`"Otho is still water. Come make a mistake, or do not."`],
        drusa: [`"She will throw the net when you rush. Parry or roll the first beat, then punish. After her, the pack hunts."`],
        bear_1: [`"Hostus is a door. Do not bounce. Plant, then cut."`],
        bear_2: [`"Gnaeus swings like a falling beam. Do not be under it."`],
        bear_elite: [`"Mera is frost. Dodge the first slam. Then get inside it."`],
        cotta: [`"Cotta is winter. A bear that misses is a door you can kick. After him, the horn."`],
        wolf_1: [`"Acca is a cub with two blades. Do not get proud."`],
        wolf_2: [`"Faustus hunts in a circle. Cut the circle or he will bleed you in pieces."`],
        wolf_elite: [`"Neria is night. Keep moving. Parry the first cut."`],
        lupa: [`"She will not let you plant. Keep moving. The second cut is the one that names you. After her, the bristle."`],
        lion_1: [`"Aulus fights like a man who has never been told no. Make him hear it."`],
        lion_2: [`"Sabina keeps you at the point. Same lesson as a spear house. Sidestep, then in."`],
        lion_elite: [`"Rufinus grins. The second blade is the one that matters."`],
        leo: [`"Leo wants you to kneel to the idea of him. Hit the man, not the name. After him, the hide."`],
        bull_1: [`"Spurius charges. Leave the line. Then cut."`],
        bull_2: [`"Flavia's axe is a horn. Do not be in front of it."`],
        bull_elite: [`"Nasica paws once. That is your warning."`],
        taurus: [`"The Bull does not feint. It arrives. Roll the first rush. After him, the stripe."`],
        boar_1: [`"Cossus wants you to hit first so he can hit harder. Do not play that game."`],
        boar_2: [`"Maia swings slow until she does not. Same as any axe."`],
        boar_elite: [`"Tullus eats dancers. Plant, then move after he commits."`],
        aper: [`"The Boar takes a hit to give a worse one. Do not trade with him. After him, the charge."`],
        tiger_1: [`"Rutila is a cub with two blades and no song. Do not wait for a warning."`],
        tiger_2: [`"Stria keeps the spear like a waiting paw. Leave the line, then in."`],
        tiger_elite: [`"Varro grins. The second blade is the one that names you."`],
        tigris: [`"Tigris hunts in daylight. After him, the pride waits."`],
        rhino_1: [`"Cornutus sets his feet like a wall. Leave the line, or do not."`],
        rhino_2: [`"Corniger paws once. That is your warning. Do not be in front of the horn."`],
        rhino_elite: [`"Platea does not blink. Hide first. Then horn."`],
        rhinoceros: [`"The Rhino takes the line you thought was safe. After him, the ivory."`],
        elephant_1: [`"Barus is a door. Do not bounce. Plant, then wait."`],
        elephant_2: [`"Turris lifts the hammer like a gate-bar. Do not be under it."`],
        elephant_elite: [`"Indus does not hurry. The second slam is the one that names you."`],
        elephas: [`"The Elephant arrives slowly. After him, only the Rudis."`],
      };
      if (next && tips[next]) return tips[next];
      if (found.fighter.isChampion) {
        return [
          `"${found.fighter.name} is champion of ${found.house.latinName}."`,
          `"A beast in the pit. Come back standing."`,
        ];
      }
      return [`"${found.fighter.name} of ${found.house.latinName}. ${found.fighter.title}. The south gate."`];
    }
    if (tutorialDone()) {
      const first = rivalHouses()[0];
      const cub = first?.fighters[0];
      return [
        `"The gate is open. ${first?.latinName ?? "The first house"} sent ${cub ? cub.name : "a cub"}."`,
        `"Dodge the first rush. Then make them pay. Come back standing."`,
      ];
    }
    if (!gameState.save.tutorialFlags.metLanista) {
      const cloth = houseCloth();
      return [
        `"You are ${s.playerName}. ${cloth} cloth. This yard will try to eat you."`,
        `"WASD. Armory west. Dummy in the yard. Learn the steel — light, heavy, dodge, block, parry."`,
        `"Then drop Titus, Rufus, Brom, and Aelia. One by one. Then I will name a champion."`,
      ];
    }
    if (s.currentObjective === "return_lanista") {
      return [
        `"The four are down. The yard has a name for you."`,
        `"Champion of the ${houseCloth()}. The other houses wait. The south gate is open."`,
      ];
    }
    const need = boutHint();
    if (need) {
      return [
        `"${need} first. In the yard. Drop them. Yield is not a name."`,
        `"Titus, then Rufus, then Brom, then Aelia. Then come back."`,
      ];
    }
    return [
      `"Armory west. Dummy in the yard. Learn the keys. Then the four."`,
      `"When the dummy has taught you, Titus is first."`,
    ];
  },

  titus: () => {
    const bout = yardBoutLines("Titus");
    if (bout) return bout;
    const home = consumeWelcome("titus");
    if (home) return [`"You came back. ${home} cloth on the other side of the sand, and you still standing. That is how a wall is built."`];
    if (gameState.pendingFeast) {
      return [
        `"The ${feastLast()} is down. Sit. A wall that never drinks still cracks."`,
        `"The cup takes the ache. Then we talk steel."`,
      ];
    }
    if (gameState.save.injured) {
      return [`"You limp. Rest in Quarters, or drink the vial. A wall with a crack still falls."`];
    }
    if (gameState.save.lanistaUnlocked) {
      if (getSchoolRecord("titus").glory) {
        return [
          `"Done. The stands know my name."`,
          `"Brom is next. I will still spar if you want the wall sharp."`,
        ];
      }
      return [
        `"My locker is east of the yard. Teach me a full lesson — not one drop."`,
        `"When Ready, book my three bouts. Prospect, Contender, Pride."`,
      ];
    }
    if (gameState.save.freedomWon) {
      return [`"Free. Still here. The shield does not care about wood or steel. Keep it high."`];
    }
    if (allRivalsBeaten()) {
      return [`"Eight houses. The Rudis is a different sand. I will be at the gate when you walk back."`];
    }
    const n = beaten();
    const last = lastBeatenAnimal();
    const pledged = pledgedHouse();
    if (pledged?.id === "lupus" && n === 0) {
      return [`"Wolf cloth. Good. The yard eats the slow. Keep the shield high."`, `"Walk up and click SPAR. I will tap you, not bury you."`];
    }
    if (last === "Elephant" && !gameState.save.freedomWon) {
      return [`"Ivory down. Only wood left. Keep the shield high for the Rudis."`];
    }
    if (last === "Rhino") return [`"The horn is down. The last house is a wall with a memory. Patience."`];
    if (n >= 4) return [`"${n} houses. The later ones are worse. You were patient. That is how walls outlast storms."`];
    if (n >= 2) return [`"Two houses at least. You walked out. Keep the shield high in the arena. Pride makes openings."`];
    if (n >= 1) return [`"A champion is down${last ? ` — the ${last}` : ""}. You were patient. That is how walls outlast storms."`];
    if (afterAnyWin()) {
      return [
        `"Not bad. Maybe the lanista was not wrong about you."`,
        `"Keep the shield high in the arena. Pride makes openings."`,
      ];
    }
    const cloth = houseCloth();
    return [
      `"${cloth} cloth. Keep your shield high. The arena punishes pride."`,
      `"Walk up and click SPAR. I will tap you, not bury you."`,
    ];
  },

  rufus: () => {
    const bout = yardBoutLines("Rufus");
    if (bout) return bout;
    const home = consumeWelcome("rufus");
    if (home) return [`"You beat ${home} and you still look surprised. Yard. You and me. Unless you are scared of a friend."`];
    if (gameState.pendingFeast) {
      return [
        `"You beat the ${feastLast()}. Drink before I take the table."`,
        `"If the beer is gone I will laugh. If you sit I might not."`,
      ];
    }
    if (gameState.save.lanistaUnlocked) {
      if (getSchoolRecord("rufus").glory) {
        return [
          `"Done. I got clear. The table can wait."`,
          `"Spar if you want. I am not going back to the dice until you say."`,
        ];
      }
      return [
        `"Locker east of the yard. Teach me to get clear — full lesson."`,
        `"Book my three bouts when Ready. Prospect, Contender, Pride."`,
      ];
    }
    if (gameState.save.freedomWon) {
      return [
        `"Free. Fine. Sit. I still want that rematch, but dice first."`,
        `"If you lose your purse I will laugh. If you win I will still want the yard."`,
      ];
    }
    if (allRivalsBeaten()) {
      return [`"You beat the circuit. Fine. I still want that rematch before you take the wood."`];
    }
    const pledged = pledgedHouse();
    if (pledged?.id === "serpens") {
      return [`"Serpent cloth. Range first. Fine."`, `"Click SPAR. I will even let you swing first."`];
    }
    const n = beaten();
    const last = lastBeatenAnimal();
    if (last === "Elephant" && !gameState.save.freedomWon) {
      return [`"Ivory. Fine. I still want that rematch before you take the wood."`];
    }
    if (last === "Rhino") return [`"The horn fell. Do not get slow before the last house. I still want that rematch."`];
    if (n >= 4) return [`"You keep coming back with other houses' dust on you. Do not get slow. I still want that rematch."`];
    if (n >= 1) return [`"Funny. When you arrived, I thought you'd last a week."`, `"Do not get slow now. I still want that rematch."`];
    if (afterAnyWin()) {
      return [`"You won a real fight and you still look surprised."`, `"Yard. You and me. Unless you are scared of a friend."`];
    }
    return [
      `"New blood. ${houseCloth()} cloth. Try not to trip on your own sandals."`,
      `"Click SPAR. I will even let you swing first."`,
    ];
  },

  brom: () => {
    const bout = yardBoutLines("Brom");
    if (bout) return bout;
    const home = consumeWelcome("brom");
    if (home) return [`"Ha! ${home} fell. Come eat. Even an oak is proud today."`];
    if (gameState.pendingFeast) {
      return [
        `"Ha! The ${feastLast()} fell. Sit. Even an oak is proud today."`,
        `"The beer is honest. The wine is a liar. Drink both."`,
      ];
    }
    if (gameState.save.lanistaUnlocked) {
      if (getSchoolRecord("brom").glory) {
        return [
          `"Ha! Done. The stands roared for an oak."`,
          `"Aelia next. I will still spar if you want weight."`,
        ];
      }
      return [
        `"Ha! My locker. Teach power — heavies, then weather the flurry."`,
        `"When Ready, book my three bouts. Prospect, Contender, Pride."`,
      ];
    }
    if (gameState.save.freedomWon) {
      return [`"Ha! Wood in your hand. Come eat. The hammer is yours if you want the weight."`];
    }
    if (allRivalsBeaten()) {
      return [`"Ha! The circuit fell. The hammer in the armory has your name on it if you earned it. Swing slow. Hit once."`];
    }
    const pledged = pledgedHouse();
    if (pledged?.id === "ursus" || pledged?.id === "aper" || pledged?.id === "taurus" || pledged?.id === "rhinoceros" || pledged?.id === "elephas") {
      return [`"${houseCloth()} cloth. Heavy feet. I like that."`, `"I will spar if you click SPAR. Go easy on an old oak."`];
    }
    const n = beaten();
    const last = lastBeatenAnimal();
    if (last === "Elephant" && !gameState.save.freedomWon) {
      return [`"Ha! Ivory down. The hammer likes you. Swing slow. Hit once."`];
    }
    if (last === "Rhino") return [`"Ha! The horn fell. One house left. Swing slow. Hit once."`];
    if (n >= 5) return [`"Ha! Five houses. The hammer likes you. Swing slow. Hit once."`];
    if (n >= 1) return [`"Ha! A champion fell${last ? ` — the ${last}` : ""}. The axe in the armory has your name on it. Swing slow. Hit once."`];
    if (afterAnyWin()) {
      return [`"You breathe better now. Good. Heavy steel waits for those who wait."`];
    }
    return [
      `"Big swings empty the lungs. If the yellow bar is gone, you are a statue."`,
      `"I will spar if you click SPAR. Go easy on an old oak."`,
    ];
  },

  aelia: () => {
    const bout = yardBoutLines("Aelia");
    if (bout) return bout;
    const home = consumeWelcome("aelia");
    if (home) return [`"${home} was a problem of range or weight. You answered it. That is the whole craft."`];
    if (gameState.pendingFeast) {
      return [
        `"The ${feastLast()} crowded you. You made space. Sit."`,
        `"A cup is not a spear. Drink anyway."`,
      ];
    }
    if (gameState.save.lanistaUnlocked) {
      if (getSchoolRecord("aelia").glory) {
        return [
          `"Done. The measure was clean."`,
          `"Rufus is next. Spar if you want the feet sharp."`,
        ];
      }
      return [
        `"My locker. Teach footwork — clean lights, then finish."`,
        `"Book my three bouts from the locker when Ready."`,
      ];
    }
    if (gameState.save.freedomWon) {
      return [`"A free step is still a step. Measure it."`];
    }
    if (allRivalsBeaten()) {
      return [`"The Rudis is a spear that does not name its house. Answer it the same way."`];
    }
    const pledged = pledgedHouse();
    if (pledged?.id === "serpens") {
      return [`"Serpent cloth. You already know the conversation at a distance."`, `"Click SPAR if you want a lesson. I will keep you at the point."`];
    }
    const n = beaten();
    const last = lastBeatenAnimal();
    if (last === "Elephant" && !gameState.save.freedomWon) {
      return [`"Ivory was a problem of weight. You answered it. The Rudis is a spear that does not name its house."`];
    }
    if (last === "Rhino") return [`"The horn was a charge that forgot to think. You left the line. The last house will not."`];
    if (n >= 2) return [`"A net is a spear that lies. A charge is a spear that forgets. You answered both. Good."`];
    if (n >= 1) return [`"A champion crowded you${last ? ` — the ${last}` : ""}. You made space anyway. That is the whole craft."`];
    if (afterAnyWin()) {
      return [`"You closed and lived. Remember that when the next house comes."`];
    }
    return [
      `"A spear is a conversation at a distance. Step in only when they commit."`,
      `"Click SPAR if you want a lesson. I will keep you at the point."`,
    ];
  },
  pal: () => {
    const name = palTitle(palTier());
    if (!palBrought()) {
      return [
        `The ${name} watches the yard from the roost.`,
        `"Leave it here if you want the sand to yourself. The roost can call it back."`,
        palNextHint(),
      ];
    }
    if (palTier() >= 4) {
      return [`The ${name} waits on the perch.`, `"It has hunted every house with you. The sand already knows its shadow."`];
    }
    return [
      `The ${name} of your pledged house waits on the perch.`,
      palBrought() ? `"It will fight when you walk the gate."` : `"It stays at roost until you call it."`,
      palNextHint(),
    ];
  },
};

export const OBJECTIVE_TEXT: Record<ObjectiveId, string> = {
  speak_lanista: "Speak with your lanista, Gaius Marcellus.",
  equip_gladius: "Walk to the armory and equip the gladius.",
  attack_dummy: "Attack the training dummy in the yard.",
  learn_stamina: "Watch your stamina. Attack until it dips, then let it return.",
  learn_heavy: "Heavy attack on the dummy.",
  learn_dodge: "Dodge.",
  learn_block: "Block.",
  learn_parry: "Parry.",
  spar_friend: "Defeat Titus in the yard.",
  bout_titus: "Defeat Titus in the yard. Yield does not count.",
  bout_rufus: "Defeat Rufus in the yard.",
  bout_brom: "Defeat Brom in the yard.",
  bout_aelia: "Defeat Aelia in the yard.",
  return_lanista: "Return to Marcellus. He will name a champion.",
  first_arena: "Enter the south gate and fight your first rival.",
  defeat_rival: "Defeat the next fighter at the south gate.",
  next_house: "The next house is open. Speak with Marcellus, then take the south gate.",
  tournament_1: "The Rudis is open. Take the south gate and fight for your freedom.",
  tournament_2: "The Rudis continues. Defeat Balbus, the Beam.",
  tournament_3: "The last bout. Defeat Malleolus for the rudis.",
  free: "The rudis is yours. Train. The editor still pays at the south gate.",
  take_school: "The rudis is yours. Speak with Marcellus about the school.",
  school: "The school is yours. Check lockers east of the yard. Teach, then book their circuit.",
  freed_camp: "West gate to the Freed Camp. Farm, loadout, then march.",
  raid_serpens: "March on Ludus Serpens. Free the chained.",
  raid_lupus: "March on Ludus Lupus. Silence the pack.",
  raid_aper: "March on Ludus Aper. Break the bristle.",
  raid_taurus: "March on Ludus Taurus. Break the horns.",
  raid_tigris: "March on Ludus Tigris. Light the shadows.",
  raid_leo: "March on Ludus Leo. Silence the pride.",
  raid_ursus: "March on Ludus Ursus. Break the crush.",
  raid_rhinoceros: "March on Ludus Rhinoceros. Crack the hide.",
  raid_elephas: "March on Ludus Elephas. End the stampede.",
};

export const AREA_HINTS: Record<string, string> = {
  dummy: "Training dummy — light and heavy attacks.",
  rack: "Weapon rack — press E to open the armory.",
  shop: "Quarters — press E for cloth, dye, and unguent.",
  pal: "The roost. Straw, water, and a perch. Press E.",
  gate: "Arena gate — press E to choose a match.",
  west_gate: "West gate — Freed Camp. Press E.",
  fountain: "A stone basin. The water is warm.",
  trophy: "A mount on the wall. Press E to inspect it.",
  dice: "The oval table. Rufus keeps a seat. Press E.",
  wine: "Wine in the mug. Press E.",
  beer: "Beer in the mug. Press E.",
  altar: "The lararium. Press E to pray.",
  chamber: "Your chamber. Press E to furnish the loft.",
};
