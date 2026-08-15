import type { ObjectiveId } from "../types";
import { gameState } from "../state/GameState";
import { getRival } from "./houses";
import {
  allRivalsBeaten,
  nextUnlockedOpponent,
  pledgedHouse,
  rivalHouses,
} from "../systems/progression";
import { palAnimalName, palBrought, palNextHint, palTier, palTitle, palUnlocked } from "./pal";
import { ensureNight } from "../systems/nights";

type LineFn = () => string[];

function beaten(): number {
  return gameState.save.defeatedHouses.length;
}

function afterAnyWin(): boolean {
  return gameState.save.defeatedOpponents.length > 0;
}

function tutorialDone(): boolean {
  return gameState.save.tutorialComplete;
}

function houseCloth(): string {
  return pledgedHouse()?.animalName ?? "Eagle";
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
    if (s.freedomWon) {
      const night = ensureNight();
      if (night?.kind === "weapon") {
        return [
          `"The rudis is yours. The editor still pays."`,
          `"Tonight is steel. ${night.fighterName} of ${night.houseName}. You fight with the ${night.weaponName}."`,
          `"Take the south gate. The yard is still yours after."`,
        ];
      }
      if (night) {
        return [
          `"The rudis is yours. The editor still wants a name on the sand."`,
          `"Tonight: ${night.fighterName} of ${night.houseName}. A purse fight. Come back heavier."`,
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
        fox_1: [`"The gate is open. ${found.house.latinName} sent a cub named Vitus — fast, sloppy, proud."`, `"Dodge his first rush. Then make him pay. Come back standing."`],
        fox_2: [`"Nerina is a spear. Sidestep, then step in. Do not charge the point."`],
        fox_elite: [`"Silvan is no cub. Close the gap or he will bleed you in pieces."`],
        cassian: [`"Cassian feints. When his shoulders drop, the flurry is coming. Do not freeze."`],
        serp_1: [`"Livia taught the door. Range first. Always."`],
        serp_2: [`"Kaeso's net is a question. Do not answer it with your feet planted."`],
        serp_elite: [`"Otho is still water. Come make a mistake, or do not."`],
        drusa: [`"She will throw the net when you rush. Parry or roll the first beat, then punish."`],
        bear_1: [`"Hostus is a door. Do not bounce. Plant, then cut."`],
        bear_2: [`"Gnaeus swings like a falling beam. Do not be under it."`],
        bear_elite: [`"Mera is frost. Dodge the first slam. Then get inside it."`],
        cotta: [`"Cotta is winter. A bear that misses is a door you can kick."`],
        wolf_1: [`"Acca is a cub with two blades. Do not get proud."`],
        wolf_2: [`"Faustus hunts in a circle. Cut the circle or he will bleed you in pieces."`],
        wolf_elite: [`"Neria is night. Keep moving. Parry the first cut."`],
        lupa: [`"She will not let you plant. Keep moving. The second cut is the one that names you."`],
        lion_1: [`"Aulus fights like a man who has never been told no. Make him hear it."`],
        lion_2: [`"Sabina keeps you at the point. Same lesson as a spear house. Sidestep, then in."`],
        lion_elite: [`"Rufinus grins. The second blade is the one that matters."`],
        leo: [`"Leo wants you to kneel to the idea of him. Hit the man, not the name."`],
        bull_1: [`"Spurius charges. Leave the line. Then cut."`],
        bull_2: [`"Flavia's axe is a horn. Do not be in front of it."`],
        bull_elite: [`"Nasica paws once. That is your warning."`],
        taurus: [`"The Bull does not feint. It arrives. Roll the first rush."`],
        boar_1: [`"Cossus wants you to hit first so he can hit harder. Do not play that game."`],
        boar_2: [`"Maia swings slow until she does not. Same as any axe."`],
        boar_elite: [`"Tullus eats dancers. Plant, then move after he commits."`],
        aper: [`"The Boar takes a hit to give a worse one. Do not trade with him."`],
        raven_1: [`"Noxa is a cub with two blades and a flock behind her."`],
        raven_2: [`"Caius hunts in a circle. Cut it."`],
        raven_elite: [`"Vespera is night. Keep moving."`],
        corvus: [`"Corvus will not let you plant. After him, only the Rudis."`],
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
        `"Armory. Dummy. Spar. Then you may see the sand."`,
      ];
    }
    if (s.currentObjective === "return_lanista") {
      return [
        `"You have the shape of a fighter. Barely."`,
        `"The south gate is open. Come back standing, or do not come back proud."`,
      ];
    }
    return [
      `"Armory west. Dummy in the yard. Spar Titus or Rufus."`,
      `"When you can do those, come back to me."`,
    ];
  },

  titus: () => {
    const home = consumeWelcome("titus");
    if (home) return [`"You came back. ${home} cloth on the other side of the sand, and you still standing. That is how a wall is built."`];
    if (gameState.save.freedomWon) {
      return [`"Free. Still here. The shield does not care about wood or steel. Keep it high."`];
    }
    if (allRivalsBeaten()) {
      return [`"Seven houses. The Rudis is a different sand. I will be at the gate when you walk back."`];
    }
    const n = beaten();
    const pledged = pledgedHouse();
    if (pledged?.id === "lupus" && n === 0) {
      return [`"Wolf cloth. Good. The yard eats the slow. Keep the shield high."`, `"Walk up and click SPAR. I will tap you, not bury you."`];
    }
    if (n >= 4) return [`"${n} houses. Cassian was fast. The later ones are worse. You were patient. That is how walls outlast storms."`];
    if (n >= 2) return [`"Two houses at least. You walked out. Keep the shield high in the arena. Pride makes openings."`];
    if (n >= 1) return [`"A champion is down. You were patient. That is how walls outlast storms."`];
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
    const home = consumeWelcome("rufus");
    if (home) return [`"You beat ${home} and you still look surprised. Yard. You and me. Unless you are scared of a friend."`];
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
    if (pledged?.id === "vulpes") {
      return [`"Fox cloth. Finally someone who might keep up."`, `"Click SPAR. I will even let you swing first."`];
    }
    const n = beaten();
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
    const home = consumeWelcome("brom");
    if (home) return [`"Ha! ${home} fell. Come eat. Even an oak is proud today."`];
    if (gameState.save.freedomWon) {
      return [`"Ha! Wood in your hand. Come eat. The hammer is yours if you want the weight."`];
    }
    if (allRivalsBeaten()) {
      return [`"Ha! The circuit fell. The hammer in the armory has your name on it if you earned it. Swing slow. Hit once."`];
    }
    const pledged = pledgedHouse();
    if (pledged?.id === "ursus" || pledged?.id === "aper" || pledged?.id === "taurus") {
      return [`"${houseCloth()} cloth. Heavy feet. I like that."`, `"I will spar if you click SPAR. Go easy on an old oak."`];
    }
    const n = beaten();
    if (n >= 5) return [`"Ha! Five houses. The hammer likes you. Swing slow. Hit once."`];
    if (n >= 1) return [`"Ha! A champion fell. The axe in the armory has your name on it. Swing slow. Hit once."`];
    if (afterAnyWin()) {
      return [`"You breathe better now. Good. Heavy steel waits for those who wait."`];
    }
    return [
      `"Big swings empty the lungs. If the yellow bar is gone, you are a statue."`,
      `"I will spar if you click SPAR. Go easy on an old oak."`,
    ];
  },

  aelia: () => {
    const home = consumeWelcome("aelia");
    if (home) return [`"${home} was a problem of range or weight. You answered it. That is the whole craft."`];
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
    if (n >= 2) return [`"A net is a spear that lies. A charge is a spear that forgets. You answered both. Good."`];
    if (n >= 1) return [`"A champion crowded you. You made space anyway. That is the whole craft."`];
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
  learn_dodge: "Press Shift to dodge.",
  learn_block: "Hold Q to block.",
  spar_friend: "Walk up to Titus or Rufus in the yard, then click SPAR.",
  return_lanista: "Return to Marcellus when you are ready.",
  first_arena: "Enter the south gate and fight your first rival.",
  defeat_rival: "Defeat the next fighter at the south gate.",
  next_house: "The next house is open. Speak with Marcellus, then take the south gate.",
  tournament_1: "The Rudis is open. Take the south gate and fight for your freedom.",
  tournament_2: "The Rudis continues. Defeat Balbus, the Beam.",
  tournament_3: "The last bout. Defeat Malleolus for the rudis.",
  free: "The rudis is yours. Train. The editor still pays at the south gate.",
};

export const AREA_HINTS: Record<string, string> = {
  dummy: "Training dummy — light attack (Space) or heavy (G).",
  rack: "Weapon rack — press E to open the armory.",
  shop: "Quarters — press E for cloth, dye, and unguent.",
  pal: "The roost. Straw, water, and a perch. Press E.",
  gate: "Arena gate — press E to choose a match.",
  fountain: "A stone basin. The water is warm.",
  trophy: "A mount on the wall. Press E to inspect it.",
  dice: "The oval table. Rufus keeps a seat. Press E.",
};
