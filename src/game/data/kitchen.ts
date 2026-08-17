import type { CampBuffId, CookRecipeId, FarmCropId } from "../types";
import { gameState } from "../state/GameState";
import { camp, FARM_CROPS, isStablePlot } from "./camp";
import { isRecipeQuestLocked, onCraftForQuest, recipeLockHint } from "./cookQuests";

export type RecipeDef = {
  id: CookRecipeId;
  name: string;
  desc: string;
  inputs: { cropId: FarmCropId; count: number }[];
  kind: "march" | "camp";
  sellPrice: number;
  marchStats?: { hp: number; stamina: number; attack: number };
  campBuff?: CampBuffId;
};

export const COOK_RECIPES: RecipeDef[] = [
  {
    id: "barley_mash",
    name: "Barley mash",
    desc: "+HP next march",
    inputs: [{ cropId: "barley", count: 1 }],
    kind: "march",
    sellPrice: 8,
    marchStats: { hp: 20, stamina: 0, attack: 0 },
  },
  {
    id: "olive_oil",
    name: "Olive oil",
    desc: "+Stamina next march",
    inputs: [{ cropId: "olives", count: 1 }],
    kind: "march",
    sellPrice: 8,
    marchStats: { hp: 0, stamina: 18, attack: 0 },
  },
  {
    id: "goat_roast",
    name: "Goat roast",
    desc: "+Attack next march",
    inputs: [{ cropId: "goat", count: 1 }],
    kind: "march",
    sellPrice: 14,
    marchStats: { hp: 0, stamina: 0, attack: 3 },
  },
  {
    id: "trail_stew",
    name: "Trail stew",
    desc: "+HP and +Stamina next march",
    inputs: [
      { cropId: "barley", count: 1 },
      { cropId: "olives", count: 1 },
    ],
    kind: "march",
    sellPrice: 16,
    marchStats: { hp: 14, stamina: 12, attack: 0 },
  },
  {
    id: "warriors_feast",
    name: "Warrior's feast",
    desc: "+HP and +Attack next march",
    inputs: [
      { cropId: "barley", count: 1 },
      { cropId: "goat", count: 1 },
    ],
    kind: "march",
    sellPrice: 18,
    marchStats: { hp: 14, stamina: 0, attack: 3 },
  },
  {
    id: "camp_broth",
    name: "Camp broth",
    desc: "Fire rest heals +25 HP",
    inputs: [{ cropId: "olives", count: 1 }],
    kind: "camp",
    sellPrice: 6,
    campBuff: "camp_broth",
  },
  {
    id: "hearty_stew",
    name: "Hearty stew",
    desc: "Fire rest +50 HP, +10 max HP until next raid",
    inputs: [{ cropId: "barley", count: 2 }],
    kind: "camp",
    sellPrice: 12,
    campBuff: "hearty_stew",
  },
  {
    id: "chicken_broth",
    name: "Chicken broth",
    desc: "+Stamina next march",
    inputs: [{ cropId: "chicken", count: 1 }],
    kind: "march",
    sellPrice: 10,
    marchStats: { hp: 0, stamina: 20, attack: 0 },
  },
  {
    id: "mutton_stew",
    name: "Mutton stew",
    desc: "+HP next march",
    inputs: [{ cropId: "sheep", count: 1 }],
    kind: "march",
    sellPrice: 14,
    marchStats: { hp: 22, stamina: 0, attack: 0 },
  },
  {
    id: "pork_roast",
    name: "Pork roast",
    desc: "+HP and +Attack next march",
    inputs: [{ cropId: "pig", count: 1 }],
    kind: "march",
    sellPrice: 16,
    marchStats: { hp: 12, stamina: 0, attack: 3 },
  },
  {
    id: "olive_press",
    name: "Olive press",
    desc: "+HP and +Stamina next march",
    inputs: [{ cropId: "olives", count: 2 }],
    kind: "march",
    sellPrice: 14,
    marchStats: { hp: 12, stamina: 14, attack: 0 },
  },
  {
    id: "honey_mead",
    name: "Honey mead",
    desc: "+HP and +Stamina next march",
    inputs: [{ cropId: "honey", count: 1 }],
    kind: "march",
    sellPrice: 16,
    marchStats: { hp: 14, stamina: 16, attack: 0 },
  },
  {
    id: "camp_wine",
    name: "Camp wine",
    desc: "+Stamina and +Attack next march",
    inputs: [{ cropId: "grape", count: 1 }],
    kind: "march",
    sellPrice: 18,
    marchStats: { hp: 0, stamina: 16, attack: 3 },
  },
];

const RECIPE_MAP = Object.fromEntries(COOK_RECIPES.map((r) => [r.id, r])) as Record<CookRecipeId, RecipeDef>;

export const RAW_SELL_PRICES: Record<FarmCropId, number> = {
  barley: 4,
  olives: 4,
  goat: 7,
  chicken: 5,
  sheep: 8,
  pig: 9,
  honey: 6,
  grape: 7,
};

export function getRecipe(id: CookRecipeId): RecipeDef {
  return RECIPE_MAP[id];
}

export function marchRecipes(): RecipeDef[] {
  return COOK_RECIPES.filter((r) => r.kind === "march");
}

export function campRecipes(): RecipeDef[] {
  return COOK_RECIPES.filter((r) => r.kind === "camp");
}

export function pantryCount(cropId: FarmCropId): number {
  return camp().farm.pantry.find((p) => p.cropId === cropId)?.count ?? 0;
}

/** Ready livestock in the pen counts as kitchen ingredients (no pantry harvest step). */
export function readyPenCount(cropId: FarmCropId): number {
  return camp().farm.plots.filter(
    (p) => isStablePlot(p.id) && p.unlocked && p.cropId === cropId && p.state === "ready",
  ).length;
}

export function ingredientCount(cropId: FarmCropId): number {
  return pantryCount(cropId) + readyPenCount(cropId);
}

export function cookedCount(recipeId: CookRecipeId): number {
  return camp().cookedStock.find((p) => p.recipeId === recipeId)?.count ?? 0;
}

function takePantry(cropId: FarmCropId, count: number): number {
  const c = camp();
  const row = c.farm.pantry.find((p) => p.cropId === cropId);
  if (!row || row.count <= 0) return 0;
  const taken = Math.min(row.count, count);
  row.count -= taken;
  if (row.count <= 0) c.farm.pantry = c.farm.pantry.filter((p) => p.count > 0);
  return taken;
}

/** Butcher ready pen animals straight into the pot (does not touch the pantry). */
function takeReadyPen(cropId: FarmCropId, count: number): number {
  const c = camp();
  let taken = 0;
  for (const plot of c.farm.plots) {
    if (taken >= count) break;
    if (!isStablePlot(plot.id) || !plot.unlocked || plot.cropId !== cropId || plot.state !== "ready") continue;
    plot.cropId = null;
    plot.state = "empty";
    taken++;
  }
  return taken;
}

function takeIngredient(cropId: FarmCropId, count: number): boolean {
  let need = count;
  need -= takePantry(cropId, need);
  if (need > 0) need -= takeReadyPen(cropId, need);
  return need <= 0;
}

export function ingredientShortfallHint(recipeId: CookRecipeId): string {
  const def = getRecipe(recipeId);
  for (const i of def.inputs) {
    if (ingredientCount(i.cropId) >= i.count) continue;
    const growing = camp().farm.plots.filter(
      (p) => isStablePlot(p.id) && p.unlocked && p.cropId === i.cropId && p.state === "growing",
    ).length;
    if (growing > 0) return `${FARM_CROPS[i.cropId].name} still raising — ready after a raid.`;
    return "Missing ingredients — harvest crops or ready livestock first.";
  }
  return "Missing ingredients.";
}

export function kitchenStockSummary(): string {
  const parts: string[] = [];
  for (const row of camp().farm.pantry) {
    if (row.count > 0) parts.push(`${rawCropLabel(row.cropId)}×${row.count}`);
  }
  for (const cropId of ["goat", "chicken", "sheep", "pig"] as FarmCropId[]) {
    const ready = readyPenCount(cropId);
    if (ready > 0) parts.push(`${rawCropLabel(cropId)}×${ready} (pen)`);
  }
  return parts.length === 0 ? "Pantry empty — harvest crops or wait for livestock after a raid" : parts.join("  ·  ");
}

export function formatRecipeInputs(recipeId: CookRecipeId): string {
  const def = getRecipe(recipeId);
  return def.inputs
    .map((inp) => {
      const have = ingredientCount(inp.cropId);
      const label = `${rawCropLabel(inp.cropId)}×${inp.count}`;
      return have >= inp.count ? label : `${label} (${have}/${inp.count})`;
    })
    .join(" + ");
}

export function canCraft(recipeId: CookRecipeId): boolean {
  if (isRecipeQuestLocked(recipeId)) return false;
  const def = getRecipe(recipeId);
  return def.inputs.every((i) => ingredientCount(i.cropId) >= i.count);
}

export function craftRecipe(recipeId: CookRecipeId): "ok" | "missing" | "locked" | "quest" {
  const c = camp();
  if (!c.cookUnlocked) return "locked";
  if (isRecipeQuestLocked(recipeId)) return "quest";
  const def = getRecipe(recipeId);
  if (!canCraft(recipeId)) return "missing";
  for (const i of def.inputs) {
    if (!takeIngredient(i.cropId, i.count)) return "missing";
  }
  const row = c.cookedStock.find((p) => p.recipeId === recipeId);
  if (row) row.count += 1;
  else c.cookedStock.push({ recipeId, count: 1 });
  onCraftForQuest(recipeId);
  return "ok";
}

export function consumeCookedStock(recipeId: CookRecipeId): boolean {
  const c = camp();
  const row = c.cookedStock.find((p) => p.recipeId === recipeId);
  if (!row || row.count <= 0) return false;
  row.count -= 1;
  if (row.count <= 0) c.cookedStock = c.cookedStock.filter((p) => p.count > 0);
  return true;
}

export function recipeMarchStats(recipeId: CookRecipeId): { hp: number; stamina: number; attack: number } {
  const def = getRecipe(recipeId);
  return def.marchStats ?? { hp: 0, stamina: 0, attack: 0 };
}

export function sellRaw(cropId: FarmCropId): "ok" | "empty" {
  const c = camp();
  const row = c.farm.pantry.find((p) => p.cropId === cropId);
  if (!row || row.count <= 0) return "empty";
  row.count -= 1;
  if (row.count <= 0) c.farm.pantry = c.farm.pantry.filter((p) => p.count > 0);
  gameState.save.denarii += RAW_SELL_PRICES[cropId];
  return "ok";
}

export function assignCampBuffFromStock(recipeId: CookRecipeId): "ok" | "empty" | "wrong" {
  const def = getRecipe(recipeId);
  if (def.kind !== "camp" || !def.campBuff) return "wrong";
  if (!consumeCookedStock(recipeId)) return "empty";
  camp().activeCampBuff = def.campBuff;
  return "ok";
}

export function sellCooked(recipeId: CookRecipeId): "ok" | "empty" {
  const c = camp();
  const row = c.cookedStock.find((p) => p.recipeId === recipeId);
  if (!row || row.count <= 0) return "empty";
  row.count -= 1;
  if (row.count <= 0) c.cookedStock = c.cookedStock.filter((p) => p.count > 0);
  gameState.save.denarii += getRecipe(recipeId).sellPrice;
  return "ok";
}

export function tryUnlockCook(): boolean {
  const c = camp();
  if (c.cookUnlocked) return false;
  if (c.freedPads.length < 3) return false;
  c.cookUnlocked = true;
  return true;
}

export function cookGreeting(): string {
  const n = camp().freedPads.length;
  if (n >= 9) return `"Nine houses free. The pot never empties — eat before you march."`;
  if (n >= 6) return `"Six pads filled. I can stretch a stew farther now."`;
  return `"Three houses free — someone has to feed this army. Bring harvest to the pot."`;
}

export function cookName(): string {
  return "Therio";
}

export function cookLines(): string[] {
  return [cookGreeting(), `"Raw grain keeps. Cooked meals march better. Broth warms the fire."`];
}

export function campBuffFireHeal(baseHeal: boolean): { hp: number; maxHpBonus: number; message: string } {
  const c = camp();
  const buff = c.activeCampBuff;
  if (!buff) {
    return { hp: 0, maxHpBonus: 0, message: baseHeal ? "The fire restores you." : "" };
  }
  if (buff === "camp_broth") {
    c.activeCampBuff = null;
    return { hp: 25, maxHpBonus: 0, message: "Camp broth — the fire mends deep." };
  }
  if (buff === "hearty_stew") {
    c.activeCampBuff = null;
    c.tempMaxHpBonus = (c.tempMaxHpBonus ?? 0) + 10;
    return { hp: 50, maxHpBonus: 10, message: "Hearty stew — warmth until the next raid." };
  }
  return { hp: 0, maxHpBonus: 0, message: "The fire restores you." };
}

export function rawCropLabel(cropId: FarmCropId): string {
  return FARM_CROPS[cropId].name;
}
