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
  | "learn_heavy"
  | "learn_dodge"
  | "learn_block"
  | "learn_parry"
  | "spar_friend"
  | "bout_titus"
  | "bout_rufus"
  | "bout_brom"
  | "bout_aelia"
  | "return_lanista"
  | "first_arena"
  | "defeat_rival"
  | "next_house"
  | "tournament_1"
  | "tournament_2"
  | "tournament_3"
  | "free"
  | "take_school"
  | "school"
  | "freed_camp"
  | "raid_serpens"
  | "raid_lupus"
  | "raid_aper"
  | "raid_taurus"
  | "raid_tigris"
  | "raid_leo"
  | "raid_ursus"
  | "raid_rhinoceros"
  | "raid_elephas";

export type CompanionId = "titus" | "aelia" | "brom" | "rufus" | "cassian";
/** Refugee id — matches entries in refugees.ts (e.g. refugee-serpens-0). */
export type VolunteerId = string;
export type RaidHouseId =
  | "serpens"
  | "lupus"
  | "aper"
  | "taurus"
  | "tigris"
  | "leo"
  | "ursus"
  | "rhinoceros"
  | "elephas";
export type FarmCropId = "barley" | "olives" | "goat" | "chicken" | "sheep" | "pig" | "honey" | "grape";
export type CookRecipeId =
  | "barley_mash"
  | "olive_oil"
  | "goat_roast"
  | "trail_stew"
  | "warriors_feast"
  | "camp_broth"
  | "hearty_stew"
  | "chicken_broth"
  | "mutton_stew"
  | "pork_roast"
  | "honey_mead"
  | "camp_wine"
  | "olive_press";
export type CookQuestId = "olive_harvests" | "mutton_stews";
export interface CookQuestProgress {
  id: CookQuestId;
  progress: number;
  done: boolean;
}
export type CampBuffId = "camp_broth" | "hearty_stew";
export type FarmPlotState = "empty" | "growing" | "ready";
export type MealBuff = "hp" | "stamina" | "damage" | null;

export interface FarmPlot {
  id: string;
  unlocked: boolean;
  cropId: FarmCropId | null;
  state: FarmPlotState;
}

export interface RaidRoomProgress {
  cleared: boolean;
  puzzleSolved?: boolean;
}

export interface RaidHouseProgress {
  rooms: Record<string, RaidRoomProgress>;
  freed: boolean;
  bossBeaten: boolean;
}

export interface CampSave {
  party: CompanionId[];
  companions: Record<CompanionId, { weapon: WeaponId; nodes: string[] }>;
  farm: {
    plots: FarmPlot[];
    pantry: { cropId: FarmCropId; count: number }[];
    selectedMeal: MealBuff;
    penUnlocked: boolean;
    selectedPantryCrop: FarmCropId | null;
  };
  cookQuests: CookQuestProgress[];
  freedPads: string[];
  raids: Record<string, RaidHouseProgress>;
  volunteersUnlocked: VolunteerId[];
  houseVolunteer: VolunteerId | null;
  cookUnlocked: boolean;
  cookedStock: { recipeId: CookRecipeId; count: number }[];
  selectedMarchRecipe: CookRecipeId | null;
  activeCampBuff: CampBuffId | null;
  tempMaxHpBonus: number;
}

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

export type SchoolNpcId = "titus" | "brom" | "aelia" | "rufus";

export interface SchoolRecord {
  wins: number;
  losses: number;
  injured: boolean;
  glory: boolean;
  training: number;
  specialty: number;
  /** Completed multi-beat yard lessons (persists across visits). */
  lessons: number;
  /** Cleared rungs on their 3-bout school ladder (0–3). Glory at 3. */
  rung: number;
}

export interface ChamberDecor {
  floor: string;
  rug: string;
  bed: string;
  banner: string;
  light: string;
  extra: string;
  trophy: string;
}

export interface SaveData {
  version: number;
  playerName: string;
  playerHouse: string | null;
  tournamentWins: number;
  freedomWon: boolean;
  lanistaUnlocked: boolean;
  school: Record<SchoolNpcId, SchoolRecord>;
  chamber: ChamberDecor;
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
  equippedWeapon: WeaponId | null;
  unlockedWeapons: WeaponId[];
  defeatedOpponents: string[];
  defeatedHouses: string[];
  currentObjective: ObjectiveId;
  tutorialComplete: boolean;
  tutorialFlags: Record<string, boolean>;
  sparWins: Record<string, number>;
  dialogueFlags: Record<string, boolean>;
  storyFlags: Record<string, boolean>;
  position: { x: number; y: number; scene: "ludus" | "arena" | "freedcamp" | "raid" };
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
  /** Act 4 freed camp, farm, companions, raid progress. */
  camp: CampSave;
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
  heavy: "F",
  dodge: "SHIFT",
  block: "Q",
  special: "R",
  parry: "G",
  interact: "E",
  unguent: "V",
};
