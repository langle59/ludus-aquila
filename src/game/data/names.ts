const MAX_NAME = 18;

type HouseNamePack = {
  given: string[];
  nick: string[];
  ring: string[];
};

const ROMAN = [
  "Valens",
  "Marcus",
  "Julia",
  "Lucius",
  "Flavia",
  "Quintus",
  "Octavia",
  "Sextus",
  "Claudia",
  "Publius",
  "Helvia",
  "Caelia",
  "Priscus",
  "Sabina",
  "Lucan",
  "Celsa",
  "Varro",
  "Fausta",
  "Cinna",
  "Alba",
];

const HOUSE_NAMES: Record<string, HouseNamePack> = {
  vulpes: {
    given: ["Vitus", "Silvan", "Nerina", "Fausta", "Lucan", "Celsa", "Varro", "Sabina"],
    nick: ["Swift", "Grin", "Cub", "Reed", "Dust", "Fox"],
    ring: ["Dust-Step", "Fox Cub", "Sand-Grin", "Reed-Step", "Quick Fox"],
  },
  serpens: {
    given: ["Livia", "Caelia", "Priscus", "Helvia", "Nestor", "Sura"],
    nick: ["Coil", "Scale", "Fang", "Green", "Reed"],
    ring: ["Green Coil", "Quiet Fang", "Scale", "Reed-Spear"],
  },
  ursus: {
    given: ["Bruma", "Ursina", "Balbus", "Robur", "Silva", "Spurin"],
    nick: ["Hide", "Oak", "Umber", "Crush", "Paw"],
    ring: ["Bear-Hide", "Oak Wall", "Heavy Paw", "Umber"],
  },
  lupus: {
    given: ["Acca", "Faunus", "Hirpus", "Cinna", "Alba", "Hirpa"],
    nick: ["Grey", "Pack", "Frost", "Howl", "Fang"],
    ring: ["Winter-Grey", "Pack-Run", "Night Howl", "Frost Fang"],
  },
  leo: {
    given: ["Aurelia", "Leontia", "Flavius", "Aurea", "Solon"],
    nick: ["Pride", "Gold", "Roar", "Mane", "Sun"],
    ring: ["Sun-Mane", "Pride Gold", "Loud Roar", "Gold Mane"],
  },
  taurus: {
    given: ["Brutus", "Cornelia", "Stertin", "Bos", "Horatia", "Tullus"],
    nick: ["Horn", "Ox", "Charge", "Blood", "Brow"],
    ring: ["Ox-Horn", "Red Charge", "Iron Brow", "Bull-Blood"],
  },
  aper: {
    given: ["Spina", "Scrofa", "Crispus", "Terra", "Setia"],
    nick: ["Tusk", "Bristle", "Hide", "Dust", "Root"],
    ring: ["Dust-Tusk", "Bristle", "Mud Hide", "Root-Tusk"],
  },
  corvus: {
    given: ["Umbra", "Noctua", "Vesper", "Pullus", "Nyx", "Corva"],
    nick: ["Night", "Dusk", "Omen", "Wing", "Ash"],
    ring: ["Night-Wing", "Dark Omen", "Dusk", "Ash Wing"],
  },
  tigris: {
    given: ["Rutila", "Stria", "Amba", "Varro", "Tigrina", "Rutilus"],
    nick: ["Stripe", "Amber", "Ambush", "Paw", "Fang"],
    ring: ["Stripe-Paw", "Amber Fang", "Night Ambush", "Gold Stripe"],
  },
  aquila: {
    given: ["Valens", "Scaeva", "Julia", "Marcus", "Aquila", "Aurea"],
    nick: ["Eagle", "Gold", "Yard", "Wing", "Sun"],
    ring: ["Gold-Wing", "Yard Bird", "Sun-Eagle", "Gold Yard"],
  },
};

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]!;
}

function clip(name: string): string {
  return name.trim().slice(0, MAX_NAME);
}

function rollName(pack: HouseNamePack): string {
  const given = pick([...ROMAN, ...pack.given]);
  const nick = pick(pack.nick);
  const roll = Math.random();
  if (roll < 0.42) return `${pick(pack.given)} ${nick}`;
  if (roll < 0.78) return pick(pack.ring);
  if (roll < 0.9) return `${given} ${nick}`;
  return pick(pack.given);
}

export function generateHouseName(houseId: string | null | undefined, avoid = ""): string {
  const pack = HOUSE_NAMES[houseId ?? ""] ?? HOUSE_NAMES.aquila;
  for (let i = 0; i < 18; i++) {
    const name = clip(rollName(pack));
    if (name && name !== avoid) return name;
  }
  return clip(pack.given[0] ?? "Valens");
}
