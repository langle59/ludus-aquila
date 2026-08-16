import type { TunicColor } from "../types";
import type { BodyStyle } from "../systems/assets";
import { COLORS } from "../config";
import { gameState } from "../state/GameState";

export type ShopKind = "tunic" | "plume" | "helm" | "cape" | "scar" | "title";

export interface ShopItem {
  id: string;
  kind: ShopKind;
  name: string;
  description: string;
  cost: number;
  requiresOpponent?: string;
  requiresFlag?: string;
}

export const TUNIC_HEX: Record<string, number> = {
  crimson: COLORS.crimson,
  white: COLORS.white,
  bronze: 0xb08a3a,
  midnight: 0x3a2a58,
  sea: 0x2f6b62,
  fox: COLORS.foxOrange,
  ivory: 0xe8dcc8,
  obsidian: 0x1c1410,
  sand: 0xc4a66e,
  wine: 0x6a2030,
  bear: COLORS.bearBrown,
  wolf: COLORS.wolfGrey,
  serpent: COLORS.serpentGreen,
  lion: COLORS.lionGold,
  bull: COLORS.bullRed,
  boar: COLORS.boarHide,
  raven: COLORS.ravenBlack,
  tiger: COLORS.tigerOrange,
  rhino: COLORS.rhinoHide,
  elephant: COLORS.elephantGrey,
};

export const PLUME_HEX: Record<string, number> = {
  gold: COLORS.gold,
  crimson: COLORS.crimson,
  white: COLORS.white,
  fox: COLORS.foxOrange,
  emerald: 0x3a8a5a,
  sky: 0x5a8ab8,
  bronze: 0xb08a3a,
  bear: 0x8a5a30,
  wolf: 0xa8b0b8,
  serpent: 0x4a9a68,
  lion: 0xe8c96a,
  bull: 0xc44a3a,
  boar: 0x8a6850,
  raven: 0x6a6088,
  tiger: 0xe07020,
  rhino: 0xa8a090,
  elephant: 0xc8c4b8,
};

export const CAPE_HEX: Record<string, number> = {
  none: 0,
  crimson: COLORS.crimson,
  ivory: 0xe8dcc8,
  fox: COLORS.foxOrange,
  bronze: 0xb08a3a,
  bear: COLORS.bearBrown,
  wolf: COLORS.wolfGrey,
  serpent: COLORS.serpentGreen,
  lion: COLORS.lionGold,
  bull: COLORS.bullRed,
  boar: COLORS.boarHide,
  raven: COLORS.ravenBlack,
  tiger: COLORS.tigerOrange,
  rhino: COLORS.rhinoHide,
  elephant: COLORS.elephantGrey,
};

export const TITLE_TEXT: Record<string, string> = {
  none: "",
  yard: "of the Yard",
  eagle: "of the Eagle",
  foxbane: "Foxbane",
  arena: "of the Arena",
  hide: "of the Hide",
  pack: "of the Pack",
  coil: "of the Coil",
  pride: "of the Pride",
  horn: "of the Horn",
  bristle: "of the Bristle",
  night: "of the Night",
  stripe: "of the Stripe",
  tusk: "of the Tusk",
  ivory: "of the Ivory",
  freeman: "the Free Man",
};

export const SHOP_TABS: { kind: ShopKind; label: string; hint: string }[] = [
  { kind: "tunic", label: "Tunics", hint: "Yard cloth and house dyes" },
  { kind: "plume", label: "Crests", hint: "House crests take an animal shape on the helm" },
  { kind: "helm", label: "Helms", hint: "What sits on the brow" },
  { kind: "cape", label: "Capes", hint: "Cloth at the shoulders" },
  { kind: "scar", label: "Scars", hint: "Marks from a real fall in the arena" },
  { kind: "title", label: "Titles", hint: "A name the crowd can shout" },
];

export const SHOP_ITEMS: ShopItem[] = [
  { id: "tunic-crimson", kind: "tunic", name: "Crimson tunic", description: "House Aquila red.", cost: 0 },
  { id: "tunic-white", kind: "tunic", name: "White tunic", description: "Pale linen of a new recruit.", cost: 0 },
  { id: "tunic-bronze", kind: "tunic", name: "Bronze tunic", description: "Warm as hammered coin.", cost: 0 },
  { id: "tunic-midnight", kind: "tunic", name: "Midnight tunic", description: "Deep purple dye from the east.", cost: 28 },
  { id: "tunic-sea", kind: "tunic", name: "Sea tunic", description: "Green as the harbour at dawn.", cost: 28 },
  { id: "tunic-ivory", kind: "tunic", name: "Ivory tunic", description: "Bleached cloth fit for a parade.", cost: 40 },
  { id: "tunic-obsidian", kind: "tunic", name: "Obsidian tunic", description: "Almost black. The crowd will see the steel.", cost: 50 },
  { id: "tunic-sand", kind: "tunic", name: "Sand tunic", description: "Yard dust, dyed into the cloth.", cost: 24 },
  { id: "tunic-wine", kind: "tunic", name: "Wine tunic", description: "Dark red, deeper than house crimson.", cost: 36 },
  { id: "tunic-bear", kind: "tunic", name: "Bear-hide tunic", description: "Umber cloth. Heavy on the shoulder.", cost: 52, requiresOpponent: "bear_1" },
  { id: "tunic-wolf", kind: "tunic", name: "Wolf-grey tunic", description: "The colour of winter stone.", cost: 55, requiresOpponent: "wolf_1" },
  { id: "tunic-serpent", kind: "tunic", name: "Serpent tunic", description: "Scale-green dye. Cool even in the sun.", cost: 48, requiresOpponent: "serp_1" },
  { id: "tunic-lion", kind: "tunic", name: "Lion tunic", description: "Pride gold. It catches every torch.", cost: 58, requiresOpponent: "lion_1" },
  { id: "tunic-bull", kind: "tunic", name: "Bull tunic", description: "Oxblood cloth. It does not yield.", cost: 62, requiresOpponent: "bull_1" },
  { id: "tunic-boar", kind: "tunic", name: "Boar tunic", description: "Bristle-brown. Dust sticks to it.", cost: 66, requiresOpponent: "boar_1" },
  { id: "tunic-tiger", kind: "tunic", name: "Tiger tunic", description: "Stripe-orange. It hunts in daylight.", cost: 74, requiresOpponent: "tiger_1" },
  { id: "tunic-rhino", kind: "tunic", name: "Rhino tunic", description: "Grey hide-dye. It does not yield.", cost: 78, requiresOpponent: "rhino_1" },
  { id: "tunic-elephant", kind: "tunic", name: "Elephant tunic", description: "War-grey cloth. The sand does not argue.", cost: 82, requiresOpponent: "elephant_1" },
  { id: "plume-gold", kind: "plume", name: "Gold crest", description: "The default eagle plume.", cost: 0 },
  { id: "plume-crimson", kind: "plume", name: "Crimson crest", description: "A blood-red helmet plume.", cost: 22 },
  { id: "plume-white", kind: "plume", name: "White crest", description: "Pale feathers for the helm.", cost: 22 },
  { id: "plume-emerald", kind: "plume", name: "Emerald crest", description: "Green dye, rare in the ludus.", cost: 32 },
  { id: "plume-sky", kind: "plume", name: "Sky crest", description: "Pale blue feathers from the coast.", cost: 30 },
  { id: "plume-bronze", kind: "plume", name: "Bronze crest", description: "Warm metal tone in the plume.", cost: 26 },
  { id: "plume-bear", kind: "plume", name: "Bear crest", description: "Round ears. A heavy brow.", cost: 36, requiresOpponent: "bear_1" },
  { id: "plume-wolf", kind: "plume", name: "Wolf crest", description: "Tall ears. A pack helm.", cost: 36, requiresOpponent: "wolf_1" },
  { id: "plume-serpent", kind: "plume", name: "Serpent crest", description: "A coil rising from the crown.", cost: 34, requiresOpponent: "serp_1" },
  { id: "plume-lion", kind: "plume", name: "Lion crest", description: "A mane around the helm.", cost: 40, requiresOpponent: "lion_1" },
  { id: "plume-bull", kind: "plume", name: "Bull crest", description: "Horns swept wide.", cost: 42, requiresOpponent: "bull_1" },
  { id: "plume-boar", kind: "plume", name: "Boar crest", description: "Bristles and tusks.", cost: 44, requiresOpponent: "boar_1" },
  { id: "plume-tiger", kind: "plume", name: "Tiger crest", description: "Striped ears. A quiet hunt.", cost: 48, requiresOpponent: "tiger_1" },
  { id: "plume-rhino", kind: "plume", name: "Rhino crest", description: "A horn on the galea.", cost: 50, requiresOpponent: "rhino_1" },
  { id: "plume-elephant", kind: "plume", name: "Elephant crest", description: "Fan ears and a short tusk.", cost: 52, requiresOpponent: "elephant_1" },
  { id: "helm-gladiator", kind: "helm", name: "Galea", description: "Standard fighting helm.", cost: 0 },
  { id: "helm-lanista", kind: "helm", name: "Victor's laurel", description: "A wreath instead of a full helm.", cost: 55 },
  { id: "helm-champion", kind: "helm", name: "Champion helm", description: "Heavier crest. Looks like a title.", cost: 70 },
  { id: "cape-none", kind: "cape", name: "No cape", description: "Fight unadorned.", cost: 0 },
  { id: "cape-crimson", kind: "cape", name: "Crimson cape", description: "House cloth at the shoulders.", cost: 38 },
  { id: "cape-ivory", kind: "cape", name: "Ivory cape", description: "Pale trim for parade days.", cost: 42 },
  { id: "cape-bronze", kind: "cape", name: "Bronze trim", description: "A short bronze-edged cloak.", cost: 44 },
  { id: "cape-bear", kind: "cape", name: "Bear cape", description: "Brown drape. It does not flutter.", cost: 50, requiresOpponent: "cotta" },
  { id: "cape-wolf", kind: "cape", name: "Wolf cape", description: "Grey cloth. It moves when you do.", cost: 52, requiresOpponent: "lupa" },
  { id: "cape-serpent", kind: "cape", name: "Serpent cape", description: "Green drape. It hangs still.", cost: 50, requiresOpponent: "drusa" },
  { id: "cape-lion", kind: "cape", name: "Lion cape", description: "Gold cloth for a proud walk.", cost: 56, requiresOpponent: "leo" },
  { id: "cape-bull", kind: "cape", name: "Bull cape", description: "Oxblood. Heavy as a charge.", cost: 58, requiresOpponent: "taurus" },
  { id: "cape-boar", kind: "cape", name: "Boar cape", description: "Bristle cloth. It sheds dust.", cost: 60, requiresOpponent: "aper" },
  { id: "cape-tiger", kind: "cape", name: "Tiger cape", description: "Orange drape with a dark edge. It does not rustle.", cost: 68, requiresOpponent: "tigris" },
  { id: "cape-rhino", kind: "cape", name: "Rhino cape", description: "Grey drape. It does not flutter.", cost: 70, requiresOpponent: "rhinoceros" },
  { id: "cape-elephant", kind: "cape", name: "Elephant cape", description: "War cloth. It hangs like a wall.", cost: 74, requiresOpponent: "elephas" },
  { id: "title-none", kind: "title", name: "No title", description: "Your name alone.", cost: 0 },
  { id: "title-yard", kind: "title", name: "of the Yard", description: "Shown beside your name.", cost: 20 },
  { id: "title-eagle", kind: "title", name: "of the Eagle", description: "House colours in a name.", cost: 35 },
  { id: "title-arena", kind: "title", name: "of the Arena", description: "For those the crowd remembers.", cost: 80, requiresOpponent: "drusa" },
  { id: "title-hide", kind: "title", name: "of the Hide", description: "Earned against the Bear.", cost: 90, requiresOpponent: "cotta" },
  { id: "title-pack", kind: "title", name: "of the Pack", description: "Earned against the Wolf.", cost: 100, requiresOpponent: "lupa" },
  { id: "title-coil", kind: "title", name: "of the Coil", description: "Earned against the Serpent.", cost: 75, requiresOpponent: "drusa" },
  { id: "title-pride", kind: "title", name: "of the Pride", description: "Earned against the Lion.", cost: 110, requiresOpponent: "leo" },
  { id: "title-horn", kind: "title", name: "of the Horn", description: "Earned against the Bull.", cost: 120, requiresOpponent: "taurus" },
  { id: "title-bristle", kind: "title", name: "of the Bristle", description: "Earned against the Boar.", cost: 130, requiresOpponent: "aper" },
  { id: "title-stripe", kind: "title", name: "of the Stripe", description: "Earned against the Tiger.", cost: 150, requiresOpponent: "tigris" },
  { id: "title-tusk", kind: "title", name: "of the Tusk", description: "Earned against the Rhino.", cost: 160, requiresOpponent: "rhinoceros" },
  { id: "title-ivory", kind: "title", name: "of the Ivory", description: "Earned against the Elephant.", cost: 170, requiresOpponent: "elephas" },
  { id: "title-freeman", kind: "title", name: "the Free Man", description: "Won with the rudis. No man owns your name.", cost: 0, requiresFlag: "freedomWon" },
  { id: "scar-none", kind: "scar", name: "No scar", description: "Unmarked.", cost: 0 },
  { id: "scar-cheek", kind: "scar", name: "Cheek cut", description: "From an arena fall you were not spared. Looks only.", cost: 0, requiresFlag: "steelScar1" },
  { id: "scar-brow", kind: "scar", name: "Brow cut", description: "A second unsaved fall. The helm did not save it.", cost: 0, requiresFlag: "steelScar2" },
  { id: "scar-sash", kind: "scar", name: "Marked sash", description: "A third fall. A dark band the crowd will read.", cost: 0, requiresFlag: "steelScar3" },
];

export function starterCosmetics(tunic: TunicColor): string[] {
  return [`tunic-${tunic}`, "tunic-crimson", "tunic-white", "tunic-bronze", "plume-gold", "helm-gladiator", "title-none", "cape-none", "scar-none"];
}

export function ownsCosmetic(id: string): boolean {
  return (gameState.save.ownedCosmetics ?? []).includes(id);
}

export function shopUnlocked(item: ShopItem): boolean {
  if (item.requiresFlag === "freedomWon") return Boolean(gameState.save.freedomWon);
  if (item.requiresFlag && !gameState.save.storyFlags[item.requiresFlag]) return false;
  if (item.requiresOpponent) return gameState.save.defeatedOpponents.includes(item.requiresOpponent);
  return true;
}

export function shopLockHint(item: ShopItem): string {
  if (item.requiresFlag === "freedomWon") return "Win the Rudis first.";
  if (item.requiresFlag?.startsWith("steelScar")) return "Lose an arena fight without being spared.";
  if (item.requiresFlag) return "That mark is still locked.";
  return "Win the matching arena fight first.";
}

export function lookWithItem(itemId: string | null): ReturnType<typeof playerLook> {
  const look = playerLook();
  if (!itemId) return look;
  const item = SHOP_ITEMS.find((i) => i.id === itemId);
  if (!item) return look;
  const key = item.id.slice(item.kind.length + 1);
  if (item.kind === "tunic") look.tunic = TUNIC_HEX[key] ?? look.tunic;
  if (item.kind === "plume") {
    look.accent = PLUME_HEX[key] ?? look.accent;
    look.crest = key;
  }
  if (item.kind === "helm") {
    look.style = key === "lanista" ? "lanista" : key === "champion" ? "champion" : "gladiator";
  }
  if (item.kind === "cape") look.cape = CAPE_HEX[key] ?? 0;
  if (item.kind === "scar") look.scar = key;
  return look;
}

export function previewTitle(itemId: string | null): string {
  const item = itemId ? SHOP_ITEMS.find((i) => i.id === itemId) : null;
  if (!item || item.kind !== "title") return displayTitle();
  const extra = TITLE_TEXT[item.id.replace("title-", "")] ?? "";
  return extra ? `${gameState.save.playerName} ${extra}` : gameState.save.playerName;
}

export function playerLook(): { tunic: number; accent: number; style: BodyStyle; title: string; cape: number; scar: string; crest: string } {
  const s = gameState.save;
  const tunic = TUNIC_HEX[s.tunic] ?? COLORS.crimson;
  const accent = PLUME_HEX[s.plume ?? "gold"] ?? COLORS.gold;
  const helm = s.helm ?? "gladiator";
  const style: BodyStyle = helm === "lanista" ? "lanista" : helm === "champion" ? "champion" : "gladiator";
  const title = TITLE_TEXT[s.title ?? "none"] ?? "";
  const cape = CAPE_HEX[s.cape ?? "none"] ?? 0;
  const scar = s.scar ?? "none";
  const crest = s.plume ?? "gold";
  return { tunic, accent, style, title, cape, scar, crest };
}

export function displayTitle(): string {
  const s = gameState.save;
  const extra = TITLE_TEXT[s.title ?? "none"] ?? "";
  return extra ? `${s.playerName} ${extra}` : s.playerName;
}

export function equippedId(kind: ShopKind): string {
  const s = gameState.save;
  if (kind === "tunic") return `tunic-${s.tunic}`;
  if (kind === "plume") return `plume-${s.plume ?? "gold"}`;
  if (kind === "helm") return `helm-${s.helm ?? "gladiator"}`;
  if (kind === "cape") return `cape-${s.cape ?? "none"}`;
  if (kind === "scar") return `scar-${s.scar ?? "none"}`;
  return `title-${s.title ?? "none"}`;
}
