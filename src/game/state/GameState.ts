import type { ObjectiveId, SaveData, SettingsData, TunicColor, WeaponId } from "../types";
import { DEFAULT_KEYBINDS } from "../types";
import { ACTIVE_SLOT_KEY, SAVE_KEY, SAVE_SLOT_COUNT, SETTINGS_KEY, TILE_SIZE, saveSlotKey } from "../config";
import { getHouse } from "../data/houses";
import { emptyChamber, emptySchool, ensureSchoolCosmetics, mergeChamber, mergeSchool } from "../data/school";
import { emptyCamp, mergeCamp } from "../data/camp";
import type { CompanionId } from "../types";

export type SaveSlotId = 1 | 2 | 3;

export type SaveSlotSummary = {
  slot: SaveSlotId;
  playerName: string;
  houseId: string | null;
  houseName: string;
  level: number;
  progress: string;
};

export function defaultStats() {
  return {
    maxHealth: 100,
    maxStamina: 80,
    attack: 8,
    defense: 5,
    agility: 7,
  };
}

export function xpForLevel(level: number): number {
  return 40 + level * 35;
}

function migrateKeybinds(parsed?: Partial<Record<string, string>>): SettingsData["keybinds"] {
  const next = { ...DEFAULT_KEYBINDS, ...(parsed ?? {}) };
  if ((parsed?.heavy ?? "G") === "G" && (parsed?.parry ?? "F") === "F") {
    next.heavy = "F";
    next.parry = "G";
  }
  return next;
}

export function createNewSave(playerName: string, tunic: TunicColor, playerHouse: string | null = null): SaveData {
  const stats = defaultStats();
  return {
    version: 2,
    playerName,
    playerHouse,
    tournamentWins: 0,
    freedomWon: false,
    lanistaUnlocked: false,
    school: emptySchool(),
    chamber: emptyChamber(),
    nightKind: null,
    nightOpponent: null,
    nightWins: 0,
    tunic,
    level: 1,
    xp: 0,
    xpToNext: xpForLevel(1),
    stats,
    health: stats.maxHealth,
    stamina: stats.maxStamina,
    statPoints: 0,
    denarii: 12,
    reputation: "Unknown",
    equippedWeapon: null,
    unlockedWeapons: ["gladius"],
    defeatedOpponents: [],
    defeatedHouses: [],
    currentObjective: "speak_lanista",
    tutorialComplete: false,
    tutorialFlags: {},
    sparWins: {},
    dialogueFlags: {},
    storyFlags: {},
    position: { x: 0, y: 0, scene: "ludus" },
    unlockedSkills: [],
    dummyHits: 0,
    ownedCosmetics: [
      `tunic-${tunic}`,
      "tunic-crimson",
      "tunic-white",
      "tunic-bronze",
      "plume-gold",
      "helm-gladiator",
      "title-none",
      "cape-none",
      "scar-none",
    ],
    plume: "gold",
    helm: "gladiator",
    title: "none",
    cape: "none",
    scar: "none",
    steelFalls: 0,
    unguent: 1,
    palUnlocked: false,
    palBrought: true,
    palName: "",
    palTint: "house",
    palTraining: 0,
    palPoints: 0,
    palXp: 0,
    palXpToNext: 40,
    unlockedPalSkills: [],
    injured: false,
    weaponWins: {},
    unlockedMastery: [],
    activePrayer: null,
    camp: emptyCamp(),
  };
}

export const defaultSettings: SettingsData = {
  musicVolume: 0.45,
  sfxVolume: 0.7,
  musicMuted: false,
  screenShake: true,
  fullscreen: false,
  showMinimap: true,
  keybinds: { ...DEFAULT_KEYBINDS },
};

class GameState {
  save: SaveData = createNewSave("Gladiator", "crimson");
  settings: SettingsData = { ...defaultSettings, keybinds: { ...DEFAULT_KEYBINDS } };
  activeSlot: SaveSlotId = 1;
  paused = false;
  inDialogue = false;
  inMenu = false;
  pendingArenaOpponent: string | null = null;
  pendingSchoolBout: { npcId: string; opponentId: string } | null = null;
  /** One free school injury rest per ludus visit. */
  schoolFreeRestAvailable = true;
  pendingNight = false;
  pendingForcedWeapon: WeaponId | null = null;
  pendingFeast = false;
  feastWineDrunk = false;
  feastBeerDrunk = false;
  /** Act 4 raid session. */
  pendingRaidHouse: string | null = null;
  pendingRaidRoom: string | null = null;
  raidDownedAllies: CompanionId[] = [];
  raidDownedVolunteer = false;
  raidActiveMeal: "hp" | "stamina" | "damage" | null = null;
  raidMarchStats: { hp: number; stamina: number; attack: number } | null = null;
  raidTempHpBonus = 0;
  /** True once any raid room is cleared this outing (farm ticks on return). */
  raidClearedRoomThisOuting = false;
  lastResult: {
    kind: "win" | "lose" | "spar";
    title: string;
    body: string;
    denarii?: number;
    xp?: number;
  } | null = null;

  loadSettings(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SettingsData>;
        this.settings = {
          ...defaultSettings,
          ...parsed,
          musicMuted: Boolean(parsed.musicMuted),
          keybinds: migrateKeybinds(parsed.keybinds),
        };
        if (parsed.keybinds?.heavy === "G" && parsed.keybinds?.parry === "F") this.persistSettings();
      }
    } catch {
      this.settings = { ...defaultSettings };
    }
    this.migrateSaves();
  }

  persistSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* ignore quota / private mode */
    }
  }

  private migrateSaves(): void {
    try {
      const slot1 = localStorage.getItem(saveSlotKey(1));
      const legacy = localStorage.getItem(SAVE_KEY);
      if (legacy && !slot1) {
        localStorage.setItem(saveSlotKey(1), legacy);
      }
      const stored = Number(localStorage.getItem(ACTIVE_SLOT_KEY));
      if (stored >= 1 && stored <= SAVE_SLOT_COUNT) {
        this.activeSlot = stored as SaveSlotId;
      } else {
        this.activeSlot = this.firstOccupiedSlot() ?? 1;
      }
      this.persistActiveSlot();
    } catch {
      this.activeSlot = 1;
    }
  }

  private persistActiveSlot(): void {
    try {
      localStorage.setItem(ACTIVE_SLOT_KEY, String(this.activeSlot));
    } catch {
      /* ignore */
    }
  }

  private firstOccupiedSlot(): SaveSlotId | null {
    for (let i = 1; i <= SAVE_SLOT_COUNT; i++) {
      if (this.peekSlot(i as SaveSlotId)) return i as SaveSlotId;
    }
    return null;
  }

  setActiveSlot(slot: number): void {
    const n = Math.min(SAVE_SLOT_COUNT, Math.max(1, Math.floor(slot))) as SaveSlotId;
    this.activeSlot = n;
    this.persistActiveSlot();
  }

  peekSlot(slot: SaveSlotId): SaveSlotSummary | null {
    try {
      const raw = localStorage.getItem(saveSlotKey(slot));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      if (!parsed?.playerName) return null;
      const house = parsed.playerHouse ? getHouse(parsed.playerHouse) : undefined;
      return {
        slot,
        playerName: parsed.playerName,
        houseId: parsed.playerHouse ?? null,
        houseName: house?.name ?? "Unpledged",
        level: parsed.level ?? 1,
        progress: this.progressLabel(parsed),
      };
    } catch {
      return null;
    }
  }

  slotSummaries(): Array<SaveSlotSummary | null> {
    return ([1, 2, 3] as SaveSlotId[]).map((slot) => this.peekSlot(slot));
  }

  private progressLabel(s: Partial<SaveData>): string {
    const obj = String(s.currentObjective ?? "");
    const act4 =
      Boolean(s.storyFlags?.act3Complete) ||
      obj === "freed_camp" ||
      obj.startsWith("raid_");
    if (act4) {
      const freed = s.camp?.freedPads?.length ?? 0;
      if (freed >= 9) return "Act IV — All nine freed";
      if (freed >= 1) return `Act IV — ${freed}/9 houses freed`;
      return "Act IV — Beyond the Gate";
    }
    if (s.lanistaUnlocked) return "Act III — Lanista of Aquila";
    if (s.freedomWon) return "Act III — The School";
    if (obj.startsWith("tournament") || obj === "free" || obj === "take_school") return "Act II — The Rudis";
    const n = s.defeatedHouses?.length ?? 0;
    if (n === 1) return "Act II — 1 house fallen";
    if (n > 1) return `Act II — ${n} houses fallen`;
    if (s.tutorialComplete) return "Act II — The Circuit";
    return "Act I — The Yard";
  }

  hasSave(): boolean {
    return this.slotSummaries().some(Boolean);
  }

  resetSession(): void {
    this.paused = false;
    this.inDialogue = false;
    this.inMenu = false;
    this.pendingArenaOpponent = null;
    this.pendingSchoolBout = null;
    this.pendingNight = false;
    this.pendingForcedWeapon = null;
    this.pendingFeast = false;
    this.feastWineDrunk = false;
    this.feastBeerDrunk = false;
    this.pendingRaidHouse = null;
    this.pendingRaidRoom = null;
    this.raidDownedAllies = [];
    this.raidDownedVolunteer = false;
    this.raidActiveMeal = null;
    this.raidMarchStats = null;
    this.raidTempHpBonus = 0;
    this.raidClearedRoomThisOuting = false;
    this.lastResult = null;
  }

  beginFeast(): void {
    this.pendingFeast = true;
    this.feastWineDrunk = false;
    this.feastBeerDrunk = false;
    // Must land inside inFeastTiles (48–60, 26–33) or LudusScene ends the feast on the first frame.
    const x = 54 * TILE_SIZE + TILE_SIZE / 2;
    const y = 29 * TILE_SIZE + TILE_SIZE / 2;
    this.save.position = { x, y, scene: "ludus" };
    const max = this.save.stats.maxHealth - (this.save.injured ? 8 : 0);
    this.save.health = Math.max(16, Math.round(max * 0.48));
    this.save.stamina = Math.max(10, Math.round(this.save.stats.maxStamina * 0.42));
  }

  endFeast(): void {
    this.pendingFeast = false;
  }

  startNew(name: string, tunic: TunicColor, playerHouse: string | null = null): void {
    this.resetSession();
    this.save = createNewSave(name.trim() || "Gladiator", tunic, playerHouse);
    this.persist();
  }

  load(): boolean {
    return this.loadSlot(this.activeSlot);
  }

  loadSlot(slot: number): boolean {
    this.setActiveSlot(slot);
    try {
      const raw = localStorage.getItem(saveSlotKey(this.activeSlot));
      if (!raw) return false;
      const parsed = JSON.parse(raw) as SaveData;
      const ok = this.applyParsed(parsed);
      if (ok) this.resetSession();
      return ok;
    } catch {
      return false;
    }
  }

  private applyParsed(parsed: SaveData): boolean {
    if (!parsed?.playerName) return false;
    this.save = { ...createNewSave(parsed.playerName, parsed.tunic || "crimson"), ...parsed };
    this.save.unlockedSkills = parsed.unlockedSkills ?? [];
    this.save.dummyHits = parsed.dummyHits ?? 0;
    this.save.ownedCosmetics = parsed.ownedCosmetics ?? [
      `tunic-${this.save.tunic}`,
      "tunic-crimson",
      "tunic-white",
      "tunic-bronze",
      "plume-gold",
      "helm-gladiator",
      "title-none",
      "cape-none",
      "scar-none",
    ];
    this.save.plume = parsed.plume ?? "gold";
    this.save.helm = parsed.helm ?? "gladiator";
    this.save.title = parsed.title ?? "none";
    this.save.cape = parsed.cape ?? "none";
    this.save.scar = parsed.scar ?? "none";
    this.save.steelFalls = parsed.steelFalls ?? 0;
    this.save.unguent = parsed.unguent ?? 1;
    this.save.palUnlocked = parsed.palUnlocked ?? this.save.defeatedHouses.length >= 1;
    this.save.palBrought = parsed.palBrought ?? true;
    this.save.palName = parsed.palName ?? "";
    this.save.palTint = parsed.palTint === "ivory" || parsed.palTint === "night" || parsed.palTint === "house" ? parsed.palTint : "house";
    this.save.palTraining = Math.max(0, Math.min(3, parsed.palTraining ?? 0));
    this.save.unlockedPalSkills = parsed.unlockedPalSkills ?? [];
    const leftoverTrain = this.save.palTraining;
    this.save.palPoints = parsed.palPoints ?? leftoverTrain;
    this.save.palTraining = 0;
    this.save.palXp = Math.max(0, parsed.palXp ?? 0);
    this.save.palXpToNext = Math.max(20, parsed.palXpToNext ?? 40);
    this.save.injured = Boolean(parsed.injured);
    this.save.weaponWins = parsed.weaponWins ?? {};
    this.save.unlockedMastery = parsed.unlockedMastery ?? [];
    this.save.playerHouse = parsed.playerHouse && getHouse(parsed.playerHouse) ? parsed.playerHouse : null;
    this.save.tournamentWins = parsed.tournamentWins ?? 0;
    this.save.freedomWon = parsed.freedomWon ?? false;
    this.save.lanistaUnlocked = parsed.lanistaUnlocked ?? false;
    this.save.school = mergeSchool(parsed.school);
    this.save.chamber = mergeChamber(parsed.chamber);
    this.save.nightKind = parsed.nightKind === "weapon" || parsed.nightKind === "exhibition" ? parsed.nightKind : null;
    this.save.nightOpponent = parsed.nightOpponent ?? null;
    this.save.nightWins = parsed.nightWins ?? 0;
    this.save.activePrayer = parsed.activePrayer ?? null;
    this.save.camp = mergeCamp(parsed.camp);
    this.save.version = 2;
    const legacyObj = parsed.currentObjective as string;
    const known: SaveData["currentObjective"][] = [
      "speak_lanista",
      "equip_gladius",
      "attack_dummy",
      "learn_stamina",
      "learn_heavy",
      "learn_dodge",
      "learn_block",
      "learn_parry",
      "spar_friend",
      "bout_titus",
      "bout_rufus",
      "bout_brom",
      "bout_aelia",
      "return_lanista",
      "first_arena",
      "defeat_rival",
      "next_house",
      "tournament_1",
      "tournament_2",
      "tournament_3",
      "free",
      "take_school",
      "school",
      "freed_camp",
      "raid_serpens",
      "raid_lupus",
      "raid_aper",
      "raid_taurus",
      "raid_tigris",
      "raid_leo",
      "raid_ursus",
      "raid_rhinoceros",
      "raid_elephas",
    ];
    if (!known.includes(legacyObj as SaveData["currentObjective"])) {
      if (legacyObj === "after_wolf" && this.save.freedomWon) this.save.currentObjective = "free";
      else if (String(legacyObj).startsWith("tournament")) this.save.currentObjective = "tournament_1";
      else this.save.currentObjective = this.save.tutorialComplete ? "defeat_rival" : this.save.currentObjective;
    }
    if (legacyObj === "spar_friend") this.save.currentObjective = "bout_titus";
    if (!this.save.tutorialComplete && (legacyObj === "return_lanista" || legacyObj === "spar_friend")) {
      const flags = this.save.tutorialFlags;
      if (!flags.boutTitus) this.save.currentObjective = "bout_titus";
      else if (!flags.boutRufus) this.save.currentObjective = "bout_rufus";
      else if (!flags.boutBrom) this.save.currentObjective = "bout_brom";
      else if (!flags.boutAelia) this.save.currentObjective = "bout_aelia";
      else this.save.currentObjective = "return_lanista";
    }
    if (!this.save.ownedCosmetics.includes("cape-none")) this.save.ownedCosmetics.push("cape-none");
    if (!this.save.ownedCosmetics.includes("scar-none")) this.save.ownedCosmetics.push("scar-none");
    if (this.save.freedomWon && !this.save.ownedCosmetics.includes("title-freeman")) {
      this.save.ownedCosmetics.push("title-freeman");
      this.save.title = "freeman";
    }
    if (this.save.tutorialComplete && !this.save.ownedCosmetics.includes("title-aquila")) {
      this.save.ownedCosmetics.push("title-aquila");
    }
    if (!this.save.tutorialComplete && !this.save.tutorialFlags.equippedWeapon) {
      this.save.equippedWeapon = null;
    } else if (!this.save.equippedWeapon) {
      this.save.equippedWeapon = "gladius";
    }
    if (!this.save.unlockedWeapons.includes("gladius")) this.save.unlockedWeapons.push("gladius");
    ensureSchoolCosmetics();
    if (this.save.lanistaUnlocked && (this.save.currentObjective === "free" || this.save.currentObjective === "take_school")) {
      this.save.currentObjective = "school";
    } else if (this.save.freedomWon && !this.save.lanistaUnlocked && this.save.currentObjective === "free") {
      this.save.currentObjective = "take_school";
    }
    if (this.save.storyFlags.act3Complete && (this.save.currentObjective === "school" || this.save.currentObjective === "free")) {
      if (!this.save.camp?.raids?.serpens?.freed) this.save.currentObjective = "freed_camp";
    }
    this.save.health = this.save.stats.maxHealth;
    this.save.stamina = this.save.stats.maxStamina;
    return true;
  }

  persist(): void {
    try {
      localStorage.setItem(saveSlotKey(this.activeSlot), JSON.stringify(this.save));
    } catch {
      /* ignore */
    }
  }

  restoreVitals(): void {
    const p = this.save.activePrayer;
    const max = this.save.stats.maxHealth - (this.save.injured ? 8 : 0) + (p === "silvanus" ? 12 : 0);
    this.save.health = max;
    this.save.stamina = this.save.stats.maxStamina + (p === "lares" ? 8 : 0);
  }

  setObjective(id: ObjectiveId): void {
    this.save.currentObjective = id;
  }

  unlockWeapon(id: WeaponId): void {
    if (!this.save.unlockedWeapons.includes(id)) this.save.unlockedWeapons.push(id);
  }

  flag(key: string): boolean {
    return Boolean(this.save.tutorialFlags[key] || this.save.storyFlags[key]);
  }

  setFlag(key: string, store: "tutorialFlags" | "storyFlags" | "dialogueFlags" = "tutorialFlags"): void {
    this.save[store][key] = true;
  }
}

export const gameState = new GameState();
