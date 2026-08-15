import type { GladiatorDef } from "../types";

export const LANISTA: GladiatorDef = {
  id: "lanista",
  name: "Gaius Marcellus",
  title: "Lanista of Ludus Aquila",
  role: "lanista",
  personality: "Stern, fair, and ambitious. He sees potential and expects results.",
  weapon: "gladius",
  aiStyle: "defensive",
  color: 0x6b3a6e,
  accent: 0xe8dcc8,
  scale: 1.08,
  canSpar: false,
  stats: { maxHealth: 120, maxStamina: 100, attack: 10, defense: 8, agility: 6 },
};

export const HOUSE_GLADIATORS: GladiatorDef[] = [
  {
    id: "titus",
    name: "Titus Ferrum",
    title: "The Iron Wall",
    role: "friend",
    personality: "Experienced and serious. Teaches blocking and patience.",
    weapon: "gladius",
    aiStyle: "defensive",
    color: 0x4a5c6e,
    accent: 0xc9d2dc,
    scale: 1.05,
    canSpar: true,
    stats: { maxHealth: 58, maxStamina: 80, attack: 8, defense: 8, agility: 6 },
  },
  {
    id: "rufus",
    name: "Rufus Cinder",
    title: "The Spark",
    role: "friend",
    personality: "Competitive and cocky. Always ready to prove he is faster.",
    weapon: "dual_blades",
    aiStyle: "aggressive",
    color: 0xb43a32,
    accent: 0xf0c070,
    scale: 0.98,
    canSpar: true,
    stats: { maxHealth: 52, maxStamina: 90, attack: 10, defense: 4, agility: 12 },
  },
  {
    id: "brom",
    name: "Brom Calvus",
    title: "Oak",
    role: "friend",
    personality: "Large, friendly, and unhurried. Talks about stamina and timing.",
    weapon: "securis",
    aiStyle: "heavy",
    color: 0x6b4a28,
    accent: 0xe0c090,
    scale: 1.18,
    canSpar: true,
    stats: { maxHealth: 110, maxStamina: 70, attack: 14, defense: 8, agility: 4 },
  },
  {
    id: "aelia",
    name: "Aelia Nerva",
    title: "Quiet Point",
    role: "friend",
    personality: "Calm and tactical. Measures every step before she strikes.",
    weapon: "spear",
    aiStyle: "spear",
    color: 0x2f6b62,
    accent: 0xd8efe8,
    scale: 1.0,
    canSpar: true,
    stats: { maxHealth: 80, maxStamina: 85, attack: 10, defense: 7, agility: 9 },
  },
];

export const ALL_NPCS: GladiatorDef[] = [LANISTA, ...HOUSE_GLADIATORS];

export function getNpc(id: string): GladiatorDef {
  const found = ALL_NPCS.find((n) => n.id === id);
  if (!found) throw new Error(`Unknown NPC ${id}`);
  return found;
}
