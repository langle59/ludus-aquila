import type { ObjectiveId, SaveData, SettingsData, TunicColor, WeaponId } from "../types";
import { DEFAULT_KEYBINDS } from "../types";
import { ACTIVE_SLOT_KEY, SAVE_KEY, SAVE_SLOT_COUNT, SETTINGS_KEY, saveSlotKey } from "../config";
import { getHouse } from "../data/houses";

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

export function createNewSave(playerName: string, tunic: TunicColor, playerHouse: string | null = null): SaveData {
  const stats = defaultStats();
  return {
    version: 2,
    playerName,
    playerHouse,
    tournamentWins: 0,
    freedomWon: false,
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
    equippedWeapon: "gladius",
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
  pendingNight = false;
  pendingForcedWeapon: WeaponId | null = null;
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
          keybinds: { ...DEFAULT_KEYBINDS, ...(parsed.keybinds ?? {}) },
        };
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
    if (s.freedomWon) return "The Free Man";
    const obj = String(s.currentObjective ?? "");
    if (obj.startsWith("tournament") || obj === "free") return "The Rudis";
    const n = s.defeatedHouses?.length ?? 0;
    if (n === 1) return "1 house fallen";
    if (n > 1) return `${n} houses fallen`;
    if (s.tutorialComplete) return "The circuit";
    return "The yard";
  }

  hasSave(): boolean {
    return this.slotSummaries().some(Boolean);
  }

  resetSession(): void {
    this.paused = false;
    this.inDialogue = false;
    this.inMenu = false;
    this.pendingArenaOpponent = null;
    this.pendingNight = false;
    this.pendingForcedWeapon = null;
    this.lastResult = null;
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
    this.save.nightKind = parsed.nightKind === "weapon" || parsed.nightKind === "exhibition" ? parsed.nightKind : null;
    this.save.nightOpponent = parsed.nightOpponent ?? null;
    this.save.nightWins = parsed.nightWins ?? 0;
    this.save.version = 2;
    const legacyObj = parsed.currentObjective as string;
    const known: SaveData["currentObjective"][] = [
      "speak_lanista",
      "equip_gladius",
      "attack_dummy",
      "learn_stamina",
      "learn_dodge",
      "learn_block",
      "spar_friend",
      "return_lanista",
      "first_arena",
      "defeat_rival",
      "next_house",
      "tournament_1",
      "tournament_2",
      "tournament_3",
      "free",
    ];
    if (!known.includes(legacyObj as SaveData["currentObjective"])) {
      if (legacyObj === "after_wolf" && this.save.freedomWon) this.save.currentObjective = "free";
      else if (String(legacyObj).startsWith("tournament")) this.save.currentObjective = "tournament_1";
      else this.save.currentObjective = this.save.tutorialComplete ? "defeat_rival" : this.save.currentObjective;
    }
    if (!this.save.ownedCosmetics.includes("cape-none")) this.save.ownedCosmetics.push("cape-none");
    if (!this.save.ownedCosmetics.includes("scar-none")) this.save.ownedCosmetics.push("scar-none");
    if (this.save.freedomWon && !this.save.ownedCosmetics.includes("title-freeman")) {
      this.save.ownedCosmetics.push("title-freeman");
      this.save.title = "freeman";
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
    const max = this.save.stats.maxHealth - (this.save.injured ? 8 : 0);
    this.save.health = max;
    this.save.stamina = this.save.stats.maxStamina;
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
