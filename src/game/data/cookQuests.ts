import type { CookQuestId, CookQuestProgress, CookRecipeId, FarmCropId } from "../types";
import { camp } from "./camp";
import { bus } from "../systems/bus";

export const COOK_QUEST_DEFS: Record<
  CookQuestId,
  { label: string; goal: number; reward: CookRecipeId; rewardLabel: string; minHouses?: number }
> = {
  olive_harvests: {
    label: "Bring 3 olive harvests to the cook",
    goal: 3,
    reward: "olive_press",
    rewardLabel: "Unlock Olive press recipe",
  },
  mutton_stews: {
    label: "Cook 2 mutton stews",
    goal: 2,
    reward: "honey_mead",
    rewardLabel: "Unlock Honey mead recipe",
    minHouses: 5,
  },
};

export function ensureCookQuests(): CookQuestProgress[] {
  const c = camp();
  if (!Array.isArray(c.cookQuests)) c.cookQuests = [];
  for (const id of Object.keys(COOK_QUEST_DEFS) as CookQuestId[]) {
    if (!c.cookQuests.find((q) => q.id === id)) {
      c.cookQuests.push({ id, progress: 0, done: false });
    }
  }
  return c.cookQuests;
}

export function cookQuestProgress(id: CookQuestId): CookQuestProgress {
  ensureCookQuests();
  return camp().cookQuests.find((q) => q.id === id) ?? { id, progress: 0, done: false };
}

export function visibleCookQuests(): CookQuestProgress[] {
  const houses = camp().freedPads.length;
  return ensureCookQuests().filter((q) => {
    if (q.done) return false;
    const min = COOK_QUEST_DEFS[q.id].minHouses ?? 0;
    return houses >= min;
  });
}

function completeQuest(id: CookQuestId): void {
  const q = cookQuestProgress(id);
  if (q.done) return;
  q.done = true;
  const def = COOK_QUEST_DEFS[id];
  bus.emit("toast", `Cook quest done — ${def.rewardLabel}.`);
}

export function onHarvestForQuest(cropId: FarmCropId): void {
  if (cropId !== "olives") return;
  const q = cookQuestProgress("olive_harvests");
  if (q.done) return;
  q.progress += 1;
  if (q.progress >= COOK_QUEST_DEFS.olive_harvests.goal) completeQuest("olive_harvests");
}

export function onCraftForQuest(recipeId: CookRecipeId): void {
  if (recipeId !== "mutton_stew") return;
  const q = cookQuestProgress("mutton_stews");
  if (q.done) return;
  q.progress += 1;
  if (q.progress >= COOK_QUEST_DEFS.mutton_stews.goal) completeQuest("mutton_stews");
}

export function isRecipeQuestLocked(recipeId: CookRecipeId): boolean {
  if (recipeId === "olive_press") return !cookQuestProgress("olive_harvests").done;
  if (recipeId === "honey_mead") return !cookQuestProgress("mutton_stews").done;
  if (recipeId === "camp_wine") return camp().freedPads.length < 9;
  return false;
}

export function recipeLockHint(recipeId: CookRecipeId): string {
  if (recipeId === "olive_press") return "Complete cook quest: 3 olive harvests.";
  if (recipeId === "honey_mead") return "Complete cook quest: 2 mutton stews.";
  if (recipeId === "camp_wine") return "Free nine houses to press camp wine.";
  return "";
}
