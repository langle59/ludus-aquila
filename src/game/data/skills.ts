import type { SkillId } from "../types";

export interface SkillDef {
  id: SkillId;
  name: string;
  branch: "blade" | "shield" | "dust";
  tier: 0 | 1 | 2 | 3 | 4;
  requires?: SkillId;
  description: string;
}

export const SKILLS: SkillDef[] = [
  {
    id: "iron_edge",
    name: "Iron Edge",
    branch: "blade",
    tier: 0,
    description: "+1.5 Attack. Your cuts bite deeper.",
  },
  {
    id: "heavy_hands",
    name: "Heavy Hands",
    branch: "blade",
    tier: 1,
    requires: "iron_edge",
    description: "+2 Attack. You hit like a charged bull.",
  },
  {
    id: "opening_cut",
    name: "Opening Cut",
    branch: "blade",
    tier: 2,
    requires: "heavy_hands",
    description: "Light attacks cost 2 less stamina.",
  },
  {
    id: "killing_blow",
    name: "Killing Blow",
    branch: "blade",
    tier: 3,
    requires: "opening_cut",
    description: "Special attacks deal 35% more damage.",
  },
  {
    id: "relentless",
    name: "Relentless",
    branch: "blade",
    tier: 4,
    requires: "killing_blow",
    description: "Combo hits return a little stamina so strings last longer.",
  },
  {
    id: "thick_hide",
    name: "Thick Hide",
    branch: "shield",
    tier: 0,
    description: "+16 Health. The yard hardens you.",
  },
  {
    id: "firm_guard",
    name: "Firm Guard",
    branch: "shield",
    tier: 1,
    requires: "thick_hide",
    description: "+1.5 Defense. Blows glance off.",
  },
  {
    id: "second_wind",
    name: "Second Wind",
    branch: "shield",
    tier: 2,
    requires: "firm_guard",
    description: "+12 Stamina. You recover faster in a fight.",
  },
  {
    id: "iron_wall",
    name: "Iron Wall",
    branch: "shield",
    tier: 3,
    requires: "second_wind",
    description: "Blocking shrugs off much more damage.",
  },
  {
    id: "guarded_heart",
    name: "Guarded Heart",
    branch: "shield",
    tier: 4,
    requires: "iron_wall",
    description: "Blocked blows chip even less. The shield holds.",
  },
  {
    id: "quick_step",
    name: "Quick Step",
    branch: "dust",
    tier: 0,
    description: "+1.5 Agility. You close and leave faster.",
  },
  {
    id: "low_stance",
    name: "Low Stance",
    branch: "dust",
    tier: 1,
    requires: "quick_step",
    description: "Dodging costs 6 less stamina.",
  },
  {
    id: "deep_breath",
    name: "Deep Breath",
    branch: "dust",
    tier: 2,
    requires: "low_stance",
    description: "+10 Stamina. Your lungs keep up.",
  },
  {
    id: "fox_step",
    name: "Fox Step",
    branch: "dust",
    tier: 3,
    requires: "deep_breath",
    description: "Longer invulnerability and a sharper dodge.",
  },
  {
    id: "ghost_step",
    name: "Ghost Step",
    branch: "dust",
    tier: 4,
    requires: "fox_step",
    description: "A wider window to roll through a swing for a perfect dodge.",
  },
];

export const SKILL_BRANCHES: { id: SkillDef["branch"]; title: string; color: number }[] = [
  { id: "blade", title: "BLADE", color: 0xa33b2b },
  { id: "shield", title: "SHIELD", color: 0xd4a84b },
  { id: "dust", title: "DUST", color: 0x4a8a7a },
];

export function getSkill(id: SkillId): SkillDef {
  const found = SKILLS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown skill ${id}`);
  return found;
}

export function skillsInBranch(branch: SkillDef["branch"]): SkillDef[] {
  return SKILLS.filter((s) => s.branch === branch).sort((a, b) => a.tier - b.tier);
}
