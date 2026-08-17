import type { AiStyle, CompanionId, FighterStats, WeaponId } from "../types";
import { getNpc } from "./gladiators";
import { schoolCombatStats } from "./school";
import { camp } from "./camp";
import { gameState } from "../state/GameState";

export interface CompanionTechNode {
  id: string;
  name: string;
  desc: string;
}

export interface CompanionDef {
  id: CompanionId;
  name: string;
  title: string;
  defaultWeapon: WeaponId;
  aiStyle: AiStyle;
  color: number;
  accent: number;
  scale: number;
  tree: CompanionTechNode[];
  lines: string[];
}

export const CASSIAN: CompanionDef = {
  id: "cassian",
  name: "Cassian",
  title: "Old Cohort",
  defaultWeapon: "gladius",
  aiStyle: "defensive",
  color: 0x5a5048,
  accent: 0xc9c0b0,
  scale: 1.02,
  tree: [
    { id: "old_steel", name: "Old Steel", desc: "+defense from years of drill." },
    { id: "mentor", name: "Mentor", desc: "Nearby allies take less pressure." },
    { id: "last_stand", name: "Last Stand", desc: "+HP when the raid runs long." },
  ],
  lines: [
    `"Rome cast me out. The sand did not."`,
    `"I will walk with you — if you ask. Two blades at your side."`,
    `"Serpens keeps men like we kept men. Break the coil."`,
  ],
};

const SCHOOL_TREES: Record<Exclude<CompanionId, "cassian">, CompanionTechNode[]> = {
  titus: [
    { id: "iron_guard", name: "Iron Guard", desc: "+defense on the line." },
    { id: "hold_line", name: "Hold the Line", desc: "+HP when blocking matters." },
    { id: "wall_strike", name: "Wall Strike", desc: "+attack after a clean hold." },
  ],
  aelia: [
    { id: "clean_point", name: "Clean Point", desc: "+attack with measured thrusts." },
    { id: "measure", name: "Measure", desc: "+agility — keep the range." },
    { id: "pierce", name: "Pierce", desc: "+stamina for long presses." },
  ],
  brom: [
    { id: "crush", name: "Crush", desc: "+attack on heavies." },
    { id: "oak_heart", name: "Oak Heart", desc: "+HP like a rooted tree." },
    { id: "weight", name: "Weight", desc: "+defense when you plant." },
  ],
  rufus: [
    { id: "flash_step", name: "Flash Step", desc: "+agility — get clear." },
    { id: "twin_cut", name: "Twin Cut", desc: "+attack on the counter." },
    { id: "ember", name: "Ember", desc: "+stamina for the dance." },
  ],
};

export function getCompanionDef(id: CompanionId): CompanionDef {
  if (id === "cassian") return CASSIAN;
  const npc = getNpc(id);
  return {
    id,
    name: npc.name,
    title: npc.title,
    defaultWeapon: npc.weapon,
    aiStyle: npc.aiStyle,
    color: npc.color,
    accent: npc.accent,
    scale: npc.scale,
    tree: SCHOOL_TREES[id],
    lines: [`${npc.name} nods. Ready for the road.`],
  };
}

export function companionWeapon(id: CompanionId): WeaponId {
  const load = camp().companions[id];
  return load?.weapon ?? getCompanionDef(id).defaultWeapon;
}

export function companionHasNode(id: CompanionId, nodeId: string): boolean {
  return Boolean(camp().companions[id]?.nodes.includes(nodeId));
}

export function unlockCompanionNode(id: CompanionId, nodeId: string): "ok" | "owned" | "order" | "poor" {
  const def = getCompanionDef(id);
  const idx = def.tree.findIndex((n) => n.id === nodeId);
  if (idx < 0) return "owned";
  const load = camp().companions[id];
  if (load.nodes.includes(nodeId)) return "owned";
  if (idx > 0 && !load.nodes.includes(def.tree[idx - 1].id)) return "order";
  const cost = 20 + idx * 15;
  if (gameState.save.denarii < cost) return "poor";
  gameState.save.denarii -= cost;
  load.nodes.push(nodeId);
  return "ok";
}

export function companionNodeCost(id: CompanionId, nodeId: string): number {
  const def = getCompanionDef(id);
  const idx = def.tree.findIndex((n) => n.id === nodeId);
  return 20 + Math.max(0, idx) * 15;
}

export function setCompanionWeapon(id: CompanionId, weapon: WeaponId): void {
  if (!gameState.save.unlockedWeapons.includes(weapon)) return;
  camp().companions[id].weapon = weapon;
}

/** Raid ally stats: school base (or Cassian) + tech nodes. */
export function companionCombatStats(id: CompanionId): FighterStats {
  const nodes = camp().companions[id]?.nodes ?? [];
  let base: FighterStats;
  if (id === "cassian") {
    base = { maxHealth: 95, maxStamina: 88, attack: 11, defense: 9, agility: 6 };
  } else {
    base = { ...schoolCombatStats(id) };
  }
  for (const n of nodes) {
    if (n === "iron_guard" || n === "weight" || n === "old_steel") base.defense += 2;
    if (n === "hold_line" || n === "oak_heart" || n === "last_stand") base.maxHealth += 12;
    if (n === "wall_strike" || n === "crush" || n === "clean_point" || n === "twin_cut") base.attack += 2;
    if (n === "measure" || n === "flash_step") base.agility += 2;
    if (n === "pierce" || n === "ember") base.maxStamina += 10;
    if (n === "mentor") base.defense += 1;
  }
  return base;
}
