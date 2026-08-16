export type WeaponId =
  | "gladius"
  | "spear"
  | "dual_blades"
  | "trident_net"
  | "securis"
  | "malleus";

export type BeastKind = "serpent" | "bear" | "wolf" | "lion" | "bull" | "boar" | "tiger" | "rhino" | "elephant" | "eagle";

export type AiStyle = "aggressive" | "spear" | "heavy" | "elite" | "champion" | "defensive" | "sparring";

export type ReputationTier =
  | "Unknown"
  | "Prospect"
  | "Fighter"
  | "Contender"
  | "Champion"
  | "Legend";

export type ObjectiveId =
  | "speak_lanista"
  | "equip_gladius"
  | "attack_dummy"
  | "learn_stamina"
  | "learn_dodge"
  | "learn_block"
  | "spar_friend"
  | "return_lanista"
  | "first_arena"
  | "defeat_rival"
  | "next_house"
  | "tournament_1"
  | "tournament_2"
  | "tournament_3"
  | "free";

export type SkillId =
  | "iron_edge"
  | "heavy_hands"
  | "opening_cut"
  | "killing_blow"
  | "relentless"
  | "thick_hide"
  | "firm_guard"
  | "second_wind"
  | "iron_wall"
  | "guarded_heart"
  | "quick_step"
  | "low_stance"
  | "deep_breath"
  | "fox_step"
  | "ghost_step";

export type PalSkillId =
  | "hide_1"
  | "hide_2"
  | "hide_3"
  | "fang_1"
  | "fang_2"
  | "fang_3"
  | "pace_1"
  | "pace_2"
  | "pace_3";

export type TunicColor =
  | "crimson"
  | "white"
  | "bronze"
  | "midnight"
  | "sea"
  | "ivory"
  | "obsidian"
  | "sand"
  | "wine"
  | "bear"
  | "wolf"
  | "serpent"
  | "lion"
  | "bull"
  | "boar"
  | "tiger"
  | "rhino"
  | "elephant";

export type AttackKind = "light" | "heavy" | "special";
export type AttackShape = "slash" | "thrust" | "slam";

export interface WeaponMove {
  name: string;
  description: string;
  damageMult: number;
  staminaMult: number;
  knockMult: number;
  rangeBonus: number;
  radiusBonus: number;
  windupMult: number;
  recoverMult: number;
  speedMult: number;
  shape: AttackShape;
  lunge: number;
  stagger: boolean;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  shortName: string;
  description: string;
  specialName: string;
  specialDescription: string;
  light: WeaponMove;
  heavy: WeaponMove;
  damage: number;
  attackSpeed: number;
  range: number;
  staminaCost: number;
  specialStamina: number;
  specialCooldown: number;
  blockStrength: number;
  knockback: number;
  windup: number;
  recover: number;
  comboHits: number;
  playable: boolean;
  unlockAfter: "start" | "first_win" | "elite" | "champion" | "later";
}

export interface FighterStats {
  maxHealth: number;
  maxStamina: number;
  attack: number;
  defense: number;
  agility: number;
}

export interface GladiatorDef {
  id: string;
  name: string;
  title: string;
  role: "lanista" | "friend" | "rival";
  personality: string;
  weapon: WeaponId;
  aiStyle: AiStyle;
  color: number;
  accent: number;
  scale: number;
  canSpar: boolean;
  stats: FighterStats;
}

export interface RivalFighterDef {
  id: string;
  name: string;
  title: string;
  weapon: WeaponId;
  aiStyle: AiStyle;
  isChampion: boolean;
  color: number;
  scale: number;
  stats: FighterStats;
  intro: string[];
  victory: string[];
  defeat: string[];
  rewards: { denarii: number; xp: number; unlockWeapon?: WeaponId };
}

export interface HouseDef {
  id: string;
  name: string;
  latinName: string;
  animalName: string;
  colors: { primary: number; secondary: number; accent: number };
  philosophy: string;
  preferredWeapons: WeaponId[];
  difficulty: number;
  arenaId: string;
  fighters: RivalFighterDef[];
  championId: string;
  beastKind?: BeastKind;
  bannerTex: string;
  crowdTint: number;
  titleColor: string;
  arenaLabel: string;
  nextHouseId?: string;
}

export interface SaveData {
  version: number;
  playerName: string;
  playerHouse: string | null;
  tournamentWins: number;
  freedomWon: boolean;
  nightKind: "exhibition" | "weapon" | null;
  nightOpponent: string | null;
  nightWins: number;
  tunic: TunicColor;
  level: number;
  xp: number;
  xpToNext: number;
  stats: FighterStats;
  health: number;
  stamina: number;
  statPoints: number;
  denarii: number;
  reputation: ReputationTier;
  equippedWeapon: WeaponId;
  unlockedWeapons: WeaponId[];
  defeatedOpponents: string[];
  defeatedHouses: string[];
  currentObjective: ObjectiveId;
  tutorialComplete: boolean;
  tutorialFlags: Record<string, boolean>;
  sparWins: Record<string, number>;
  dialogueFlags: Record<string, boolean>;
  storyFlags: Record<string, boolean>;
  position: { x: number; y: number; scene: "ludus" | "arena" };
  unlockedSkills: SkillId[];
  dummyHits: number;
  ownedCosmetics: string[];
  plume: string;
  helm: "gladiator" | "lanista" | "champion";
  title: string;
  cape: string;
  scar: string;
  steelFalls: number;
  unguent: number;
  palUnlocked: boolean;
  palBrought: boolean;
  palName: string;
  palTint: "house" | "ivory" | "night";
  palTraining: number;
  palPoints: number;
  palXp: number;
  palXpToNext: number;
  unlockedPalSkills: PalSkillId[];
  injured: boolean;
  weaponWins: Partial<Record<WeaponId, number>>;
  unlockedMastery: string[];
  activePrayer: string | null;
}

export interface SettingsData {
  musicVolume: number;
  sfxVolume: number;
  musicMuted: boolean;
  screenShake: boolean;
  fullscreen: boolean;
  showMinimap: boolean;
  keybinds: Record<CombatBindAction, string>;
}

export type CombatBindAction = "attack" | "heavy" | "dodge" | "block" | "special" | "parry" | "interact" | "unguent";

export const DEFAULT_KEYBINDS: Record<CombatBindAction, string> = {
  attack: "SPACE",
  heavy: "G",
  dodge: "SHIFT",
  block: "Q",
  special: "R",
  parry: "F",
  interact: "E",
  unguent: "V",
};
