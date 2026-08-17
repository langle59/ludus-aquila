import type { CompanionId, FarmCropId, FarmPlot, MealBuff, RaidHouseId, VolunteerId, WeaponId } from "../types";
import { gameState } from "../state/GameState";
import { HOUSES } from "./houses";
import { backfillVolunteersFromFreedPads } from "./volunteers";
import { recipeMarchStats, tryUnlockCook } from "./kitchen";
import type { CookRecipeId } from "../types";
import { bus } from "../systems/bus";
import { onHarvestForQuest } from "./cookQuests";

/** Nine rival houses — pads and night raids for the full Act 4 circuit. */
export const CAMP_HOUSE_PADS: RaidHouseId[] = HOUSES.map((h) => h.id as RaidHouseId);

export const COMPANION_IDS: CompanionId[] = ["titus", "aelia", "brom", "rufus", "cassian"];

export const DEFAULT_PARTY: [CompanionId, CompanionId] = ["titus", "aelia"];

export const PEN_BUY_COST = 70;
export const PLOT_BUY_COST = 25;
export const MAX_OWNED_PLOTS = 4;

export const ANIMAL_UNLOCK_HOUSES: Partial<Record<FarmCropId, number>> = {
  chicken: 3,
  sheep: 5,
  pig: 6,
};

export const CROP_UNLOCK_HOUSES: Partial<Record<FarmCropId, number>> = {
  honey: 6,
  grape: 9,
};

export const FARM_CROPS: Record<
  FarmCropId,
  {
    name: string;
    kind: "crop" | "animal";
    meal: MealBuff;
    cost: number;
    desc: string;
    marchStats?: { hp: number; stamina: number; attack: number };
  }
> = {
  barley: { name: "Barley", kind: "crop", meal: "hp", cost: 8, desc: "Hearty mash — +max HP next march." },
  olives: { name: "Olives", kind: "crop", meal: "stamina", cost: 8, desc: "Oil and fruit — +stamina next march." },
  goat: { name: "Goat", kind: "animal", meal: "damage", cost: 14, desc: "Meat for the road — +attack next march." },
  chicken: { name: "Chicken", kind: "animal", meal: "stamina", cost: 10, desc: "Eggs and broth — +stamina next march." },
  sheep: { name: "Sheep", kind: "animal", meal: "hp", cost: 16, desc: "Mutton for the march — +HP next march." },
  pig: {
    name: "Pig",
    kind: "animal",
    meal: "damage",
    cost: 18,
    desc: "Roast pork — +HP and +attack next march.",
    marchStats: { hp: 10, stamina: 0, attack: 2 },
  },
  honey: {
    name: "Honey",
    kind: "crop",
    meal: "stamina",
    cost: 12,
    desc: "Leo hive — sweet stamina for the road.",
    marchStats: { hp: 0, stamina: 14, attack: 0 },
  },
  grape: {
    name: "Grapes",
    kind: "crop",
    meal: "stamina",
    cost: 14,
    desc: "Camp wine grapes — +stamina and +attack.",
    marchStats: { hp: 0, stamina: 12, attack: 2 },
  },
};

export function emptyFarmPlots(): FarmPlot[] {
  return [
    { id: "p0", unlocked: true, cropId: null, state: "empty" },
    { id: "p1", unlocked: false, cropId: null, state: "empty" },
    { id: "p2", unlocked: false, cropId: null, state: "empty" },
    { id: "p3", unlocked: false, cropId: null, state: "empty" },
    { id: "s0", unlocked: false, cropId: null, state: "empty" },
    { id: "s1", unlocked: false, cropId: null, state: "empty" },
    { id: "s2", unlocked: false, cropId: null, state: "empty" },
    { id: "s3", unlocked: false, cropId: null, state: "empty" },
    { id: "s4", unlocked: false, cropId: null, state: "empty" },
    { id: "s5", unlocked: false, cropId: null, state: "empty" },
  ];
}

export function isStablePlot(id: string): boolean {
  return id.startsWith("s");
}

export function cropPlotIds(): string[] {
  return ["p0", "p1", "p2", "p3"];
}

export function stablePlotIds(): string[] {
  return ["s0", "s1", "s2", "s3", "s4", "s5"];
}

export function isAnimalCrop(id: FarmCropId): boolean {
  return FARM_CROPS[id].kind === "animal";
}

export function penUnlocked(): boolean {
  return Boolean(camp().farm.penUnlocked);
}

export function isAnimalUnlocked(cropId: FarmCropId): boolean {
  if (!isAnimalCrop(cropId)) return false;
  if (cropId === "goat") return penUnlocked();
  const need = ANIMAL_UNLOCK_HOUSES[cropId] ?? 0;
  return camp().freedPads.length >= need;
}

export function isCropUnlocked(cropId: FarmCropId): boolean {
  if (isAnimalCrop(cropId)) return isAnimalUnlocked(cropId);
  const need = CROP_UNLOCK_HOUSES[cropId];
  if (need == null) return true;
  return camp().freedPads.length >= need;
}

export function animalUnlockHint(cropId: FarmCropId): string {
  if (cropId === "goat") return penUnlocked() ? "" : "Buy the livestock pen first.";
  const need = ANIMAL_UNLOCK_HOUSES[cropId];
  if (!need) return "";
  const n = camp().freedPads.length;
  if (n >= need) return "";
  return `Free ${need} houses (${n}/${need}).`;
}

export function cropUnlockHint(cropId: FarmCropId): string {
  const need = CROP_UNLOCK_HOUSES[cropId];
  if (!need) return "";
  const n = camp().freedPads.length;
  if (n >= need) return "";
  return `Free ${need} houses (${n}/${need}).`;
}

export function buyLivestockPen(): "ok" | "owned" | "poor" {
  const c = camp();
  if (c.farm.penUnlocked) return "owned";
  if (gameState.save.denarii < PEN_BUY_COST) return "poor";
  gameState.save.denarii -= PEN_BUY_COST;
  c.farm.penUnlocked = true;
  const s0 = c.farm.plots.find((p) => p.id === "s0");
  if (s0) s0.unlocked = true;
  return "ok";
}

/** Milestone unlocks when a house is freed. Returns toast messages. */
export function tryUnlockFarmMilestones(): string[] {
  const c = camp();
  const n = c.freedPads.length;
  const msgs: string[] = [];
  if (n >= 3 && !c.cookUnlocked) msgs.push("Chickens available — cook tends the farm kitchen.");
  if (n >= 5) msgs.push("Sheep unlocked at the pen.");
  if (n >= 6) {
    const p3 = c.farm.plots.find((p) => p.id === "p3");
    if (p3 && !p3.unlocked) {
      p3.unlocked = true;
      msgs.push("Fourth crop bed ready — Leo honey awaits.");
    }
    const s4 = c.farm.plots.find((p) => p.id === "s4");
    if (s4 && !s4.unlocked) {
      s4.unlocked = true;
      msgs.push("Pen expanded — another stall.");
    }
    msgs.push("Pigs join the livestock pen.");
  }
  if (n >= 9) {
    const s5 = c.farm.plots.find((p) => p.id === "s5");
    if (s5 && !s5.unlocked) {
      s5.unlocked = true;
      msgs.push("Pen expanded — grapes and wine unlocked.");
    }
  }
  return msgs;
}

export function emptyCompanions(): Record<CompanionId, { weapon: WeaponId; nodes: string[] }> {
  return {
    titus: { weapon: "gladius", nodes: [] },
    aelia: { weapon: "spear", nodes: [] },
    brom: { weapon: "securis", nodes: [] },
    rufus: { weapon: "dual_blades", nodes: [] },
    cassian: { weapon: "gladius", nodes: [] },
  };
}

export function emptyRaidHouse(): import("../types").RaidHouseProgress {
  return { rooms: {}, freed: false, bossBeaten: false };
}

export function emptyCamp(): import("../types").CampSave {
  return {
    party: [...DEFAULT_PARTY],
    companions: emptyCompanions(),
    farm: {
      plots: emptyFarmPlots(),
      pantry: [],
      selectedMeal: null,
      penUnlocked: false,
      selectedPantryCrop: null,
    },
    cookQuests: [],
    freedPads: [],
    raids: {
      serpens: emptyRaidHouse(),
    },
    volunteersUnlocked: [],
    houseVolunteer: null,
    cookUnlocked: false,
    cookedStock: [],
    selectedMarchRecipe: null,
    activeCampBuff: null,
    tempMaxHpBonus: 0,
  };
}

export function mergeCamp(parsed?: Partial<import("../types").CampSave>): import("../types").CampSave {
  const base = emptyCamp();
  if (!parsed) return base;
  const party = Array.isArray(parsed.party)
    ? parsed.party.filter((id): id is CompanionId => COMPANION_IDS.includes(id as CompanionId)).slice(0, 2)
    : base.party;
  while (party.length < 2) {
    const fill = DEFAULT_PARTY.find((id) => !party.includes(id)) ?? "titus";
    if (!party.includes(fill)) party.push(fill);
    else break;
  }
  base.party = party as CompanionId[];

  const comps = emptyCompanions();
  for (const id of COMPANION_IDS) {
    const row = parsed.companions?.[id];
    if (row) {
      comps[id] = {
        weapon: (row.weapon as WeaponId) || comps[id].weapon,
        nodes: Array.isArray(row.nodes) ? row.nodes.slice(0, 3) : [],
      };
    }
  }
  base.companions = comps;

  const plots = emptyFarmPlots();
  if (Array.isArray(parsed.farm?.plots)) {
    for (const p of parsed.farm.plots) {
      if (!p?.id) continue;
      const slot = plots.find((x) => x.id === p.id);
      if (!slot) continue;
      slot.unlocked = Boolean(p.unlocked ?? slot.unlocked);
      slot.cropId = (p.cropId as FarmCropId | null) ?? null;
      slot.state = p.state === "growing" || p.state === "ready" ? p.state : "empty";
    }
    for (const plot of plots) {
      if (!isStablePlot(plot.id) && plot.cropId && isAnimalCrop(plot.cropId)) {
        const stable = plots.find((s) => isStablePlot(s.id) && s.state === "empty" && !s.cropId);
        if (stable) {
          stable.unlocked = true;
          stable.cropId = plot.cropId;
          stable.state = plot.state;
          plot.cropId = null;
          plot.state = "empty";
        }
      }
    }
  }
  const penWasUnlocked = Boolean((parsed.farm as { penUnlocked?: boolean })?.penUnlocked);
  const hadStableUse = plots.some((p) => isStablePlot(p.id) && (p.unlocked || p.cropId));
  base.farm = {
    plots,
    pantry: Array.isArray(parsed.farm?.pantry)
      ? parsed.farm.pantry
          .filter((x) => x && typeof x.cropId === "string" && typeof x.count === "number")
          .map((x) => ({ cropId: x.cropId as FarmCropId, count: Math.max(0, x.count) }))
      : [],
    selectedMeal:
      parsed.farm?.selectedMeal === "hp" || parsed.farm?.selectedMeal === "stamina" || parsed.farm?.selectedMeal === "damage"
        ? parsed.farm.selectedMeal
        : null,
    penUnlocked: penWasUnlocked || hadStableUse,
    selectedPantryCrop:
      typeof (parsed.farm as { selectedPantryCrop?: FarmCropId })?.selectedPantryCrop === "string"
        ? ((parsed.farm as { selectedPantryCrop?: FarmCropId }).selectedPantryCrop as FarmCropId)
        : null,
  };
  if (base.farm.penUnlocked) {
    const s0 = base.farm.plots.find((p) => p.id === "s0");
    if (s0) s0.unlocked = true;
  }
  const houses = Array.isArray(parsed.freedPads) ? parsed.freedPads.length : 0;
  if (houses >= 6) {
    const p3 = base.farm.plots.find((p) => p.id === "p3");
    if (p3) p3.unlocked = true;
    const s4 = base.farm.plots.find((p) => p.id === "s4");
    if (s4) s4.unlocked = true;
  }
  if (houses >= 9) {
    const s5 = base.farm.plots.find((p) => p.id === "s5");
    if (s5) s5.unlocked = true;
  }

  base.cookQuests = Array.isArray(parsed.cookQuests)
    ? parsed.cookQuests
        .filter((q) => q && typeof q.id === "string")
        .map((q) => ({
          id: q.id as import("../types").CookQuestId,
          progress: typeof q.progress === "number" ? q.progress : 0,
          done: Boolean(q.done),
        }))
    : [];

  base.freedPads = Array.isArray(parsed.freedPads) ? parsed.freedPads.filter((id) => typeof id === "string") : [];
  base.volunteersUnlocked = Array.isArray(parsed.volunteersUnlocked)
    ? parsed.volunteersUnlocked.filter((id): id is import("../types").VolunteerId => typeof id === "string")
    : [];
  if (base.volunteersUnlocked.length === 0 && base.freedPads.length > 0) {
    base.volunteersUnlocked = backfillVolunteersFromFreedPads(base.freedPads);
  }
  const hv = parsed.houseVolunteer;
  base.houseVolunteer =
    typeof hv === "string" && base.volunteersUnlocked.includes(hv) ? hv : null;
  base.cookUnlocked = Boolean(parsed.cookUnlocked) || base.freedPads.length >= 3;
  base.cookedStock = Array.isArray(parsed.cookedStock)
    ? parsed.cookedStock
        .filter((x) => x && typeof x.recipeId === "string" && typeof x.count === "number")
        .map((x) => ({ recipeId: x.recipeId as CookRecipeId, count: Math.max(0, x.count) }))
    : [];
  const smr = parsed.selectedMarchRecipe;
  base.selectedMarchRecipe = typeof smr === "string" ? (smr as CookRecipeId) : null;
  const acb = parsed.activeCampBuff;
  base.activeCampBuff = acb === "camp_broth" || acb === "hearty_stew" ? acb : null;
  base.tempMaxHpBonus = typeof parsed.tempMaxHpBonus === "number" ? Math.max(0, parsed.tempMaxHpBonus) : 0;
  base.raids = { ...base.raids };
  if (parsed.raids) {
    for (const [hid, prog] of Object.entries(parsed.raids)) {
      if (!prog) continue;
      base.raids[hid] = {
        rooms: { ...(prog.rooms ?? {}) },
        freed: Boolean(prog.freed),
        bossBeaten: Boolean(prog.bossBeaten),
      };
    }
  }
  return base;
}

export function camp(): import("../types").CampSave {
  return gameState.save.camp ?? emptyCamp();
}

export function act4Unlocked(): boolean {
  return Boolean(gameState.save.storyFlags.act3Complete);
}

export function getRaidProgress(houseId: string): import("../types").RaidHouseProgress {
  const c = camp();
  if (!c.raids[houseId]) c.raids[houseId] = emptyRaidHouse();
  return c.raids[houseId];
}

export function isRoomCleared(houseId: string, roomId: string): boolean {
  return Boolean(getRaidProgress(houseId).rooms[roomId]?.cleared);
}

export function markRoomCleared(houseId: string, roomId: string): void {
  const prog = getRaidProgress(houseId);
  prog.rooms[roomId] = { ...prog.rooms[roomId], cleared: true };
  gameState.raidClearedRoomThisOuting = true;
}

export function clearRoomGuards(houseId: string, roomId: string): void {
  const prog = getRaidProgress(houseId);
  const prev = prog.rooms[roomId] ?? { cleared: false };
  prog.rooms[roomId] = { ...prev, cleared: false };
}

/** Wipe room clears for a fresh rematch (keeps pad freed). */
export function resetRaidRooms(houseId: string): void {
  const prog = getRaidProgress(houseId);
  prog.rooms = {};
  prog.bossBeaten = false;
}

/**
 * Next room to enter when marching from camp.
 * Skips already-cleared rooms; if the house is fully done, resets for rematch.
 */
export function nextRaidRoomId(houseId: string, roomOrder: string[], startRoom: string): string {
  const prog = getRaidProgress(houseId);
  const allDone =
    prog.bossBeaten ||
    (roomOrder.length > 0 && roomOrder.every((id) => Boolean(prog.rooms[id]?.cleared)));
  if (allDone) {
    resetRaidRooms(houseId);
    return startRoom;
  }
  for (const id of roomOrder) {
    if (!prog.rooms[id]?.cleared) return id;
  }
  return startRoom;
}

/** Growing plots finish when a raid returns after a death or a cleared room. */
export function advanceFarmAfterRaid(): { matured: number } {
  const c = camp();
  let matured = 0;
  for (const plot of c.farm.plots) {
    if (plot.state === "growing" && plot.cropId) {
      plot.state = "ready";
      matured++;
    }
  }
  return { matured };
}


export function nextEmptyPenSlot(): FarmPlot | undefined {
  return camp().farm.plots.find((p) => isStablePlot(p.id) && p.unlocked && p.state === "empty");
}

export function penCapacity(): number {
  return camp().farm.plots.filter((p) => isStablePlot(p.id) && p.unlocked).length;
}

export function penOccupancy(): number {
  return camp().farm.plots.filter((p) => isStablePlot(p.id) && p.unlocked && p.state !== "empty" && p.cropId).length;
}

export function penAnimalPlots(): FarmPlot[] {
  return camp().farm.plots.filter((p) => isStablePlot(p.id) && p.unlocked && p.cropId && p.state !== "empty");
}

/** Buy an animal into the next open pen slot. */
export function buyPenAnimal(cropId: FarmCropId): "ok" | "locked" | "busy" | "poor" | "full" | "need_pen" | "wrong" {
  const slot = nextEmptyPenSlot();
  if (!slot) return "full";
  const r = plantPlot(slot.id, cropId);
  if (r === "busy") return "full";
  return r;
}

export function harvestPlot(plotId: string): boolean {
  const c = camp();
  const plot = c.farm.plots.find((p) => p.id === plotId);
  if (!plot || plot.state !== "ready" || !plot.cropId) return false;
  const crop = plot.cropId;
  const row = c.farm.pantry.find((p) => p.cropId === crop);
  if (row) row.count += 1;
  else c.farm.pantry.push({ cropId: crop, count: 1 });
  onHarvestForQuest(crop);
  plot.cropId = null;
  plot.state = "empty";
  return true;
}

export function plantPlot(plotId: string, cropId: FarmCropId): "ok" | "locked" | "busy" | "poor" | "wrong" | "need_pen" {
  const c = camp();
  const plot = c.farm.plots.find((p) => p.id === plotId);
  if (!plot?.unlocked) return "locked";
  if (plot.state !== "empty") return "busy";
  const def = FARM_CROPS[cropId];
  const wantAnimal = isStablePlot(plotId);
  if (wantAnimal !== (def.kind === "animal")) return "wrong";
  if (wantAnimal && !penUnlocked()) return "need_pen";
  if (!isCropUnlocked(cropId)) return "locked";
  if (gameState.save.denarii < def.cost) return "poor";
  gameState.save.denarii -= def.cost;
  plot.cropId = cropId;
  plot.state = "growing";
  return "ok";
}

export function buyNextPlot(kind: "crops" | "stables" = "crops"): "ok" | "max" | "poor" | "need_pen" {
  const c = camp();
  if (kind === "stables" && !penUnlocked()) return "need_pen";
  const ids = kind === "stables" ? stablePlotIds() : cropPlotIds();
  const next = c.farm.plots.find((p) => ids.includes(p.id) && !p.unlocked);
  if (!next) return "max";
  if (gameState.save.denarii < PLOT_BUY_COST) return "poor";
  gameState.save.denarii -= PLOT_BUY_COST;
  next.unlocked = true;
  return "ok";
}

export function cropMarchStats(cropId: FarmCropId): { hp: number; stamina: number; attack: number } {
  const def = FARM_CROPS[cropId];
  if (def.marchStats) return { ...def.marchStats };
  return mealBuffStats(def.meal);
}

export function consumeSelectedPantryCrop(): { hp: number; stamina: number; attack: number } | null {
  const c = camp();
  const cropId = c.farm.selectedPantryCrop;
  if (!cropId) return null;
  const row = c.farm.pantry.find((p) => p.cropId === cropId);
  if (!row || row.count <= 0) {
    c.farm.selectedPantryCrop = null;
    return null;
  }
  row.count -= 1;
  if (row.count <= 0) c.farm.pantry = c.farm.pantry.filter((p) => p.count > 0);
  c.farm.selectedPantryCrop = null;
  c.farm.selectedMeal = null;
  return cropMarchStats(cropId);
}

export function consumeSelectedMeal(): MealBuff {
  const c = camp();
  const meal = c.farm.selectedMeal;
  if (!meal) return null;
  const cropId = (Object.keys(FARM_CROPS) as FarmCropId[]).find((id) => FARM_CROPS[id].meal === meal && !FARM_CROPS[id].marchStats);
  if (!cropId) {
    c.farm.selectedMeal = null;
    return null;
  }
  const row = c.farm.pantry.find((p) => p.cropId === cropId);
  if (!row || row.count <= 0) {
    c.farm.selectedMeal = null;
    return null;
  }
  row.count -= 1;
  if (row.count <= 0) c.farm.pantry = c.farm.pantry.filter((p) => p.count > 0);
  c.farm.selectedMeal = null;
  c.farm.selectedPantryCrop = null;
  return meal;
}

/** Consume march meal — prefers cooked recipe, then raw pantry crop, then legacy meal buff. */
export function consumeMarchProvisions(): { hp: number; stamina: number; attack: number } | null {
  const c = camp();
  if (c.selectedMarchRecipe) {
    const id = c.selectedMarchRecipe;
    const row = c.cookedStock.find((p) => p.recipeId === id);
    if (row && row.count > 0) {
      row.count -= 1;
      if (row.count <= 0) c.cookedStock = c.cookedStock.filter((p) => p.count > 0);
      c.selectedMarchRecipe = null;
      return recipeMarchStats(id);
    }
    c.selectedMarchRecipe = null;
  }
  const byCrop = consumeSelectedPantryCrop();
  if (byCrop) return byCrop;
  const meal = consumeSelectedMeal();
  return meal ? mealBuffStats(meal) : null;
}

export function activeMarchBuff(): { hp: number; stamina: number; attack: number } {
  const stats = gameState.raidMarchStats;
  if (stats) return stats;
  return mealBuffStats(gameState.raidActiveMeal);
}

export function mealBuffStats(meal: MealBuff): { hp: number; stamina: number; attack: number } {
  if (meal === "hp") return { hp: 20, stamina: 0, attack: 0 };
  if (meal === "stamina") return { hp: 0, stamina: 18, attack: 0 };
  if (meal === "damage") return { hp: 0, stamina: 0, attack: 3 };
  return { hp: 0, stamina: 0, attack: 0 };
}

export function cropTextureKey(cropId: FarmCropId, state: string): string {
  const ready = state === "ready";
  if (cropId === "barley") return ready ? "crop-barley-ready" : "crop-barley-mid";
  if (cropId === "olives") return ready ? "crop-olive-ready" : "crop-olive-mid";
  if (cropId === "honey") return ready ? "crop-honey-ready" : "crop-honey-mid";
  if (cropId === "grape") return ready ? "crop-grape-ready" : "crop-grape-mid";
  return ready ? "crop-barley-ready" : "crop-barley-mid";
}

export function animalTextureKey(cropId: FarmCropId, state: string): string {
  const adult = state === "ready";
  const species = cropId === "goat" || cropId === "chicken" || cropId === "sheep" || cropId === "pig" ? cropId : "goat";
  return adult ? `animal-${species}-adult` : `animal-${species}-kid`;
}

export function setParty(a: CompanionId, b: CompanionId): void {
  if (a === b) return;
  camp().party = [a, b];
}

export function markHouseFreed(houseId: string): boolean {
  const c = camp();
  const prog = getRaidProgress(houseId);
  prog.freed = true;
  prog.bossBeaten = true;
  if (!c.freedPads.includes(houseId)) c.freedPads.push(houseId);
  const cookNew = tryUnlockCook();
  const farmMsgs = tryUnlockFarmMilestones();
  for (const msg of farmMsgs) bus.emit("toast", msg);
  return cookNew;
}
