import type { AiStyle, FighterStats, SchoolNpcId, SchoolRecord } from "../types";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { getNpc } from "./gladiators";
import { CHAMBER_STARTERS, furnishedChamber } from "./chamber";
import { getRival } from "./houses";
import { getStudentCircuit } from "./schoolCircuit";

export { emptyChamber, mergeChamber, chamberSlotFromId, chamberItemEquipped } from "./chamber";
export type { ChamberSlot } from "./chamber";

export const SCHOOL_IDS: SchoolNpcId[] = ["titus", "brom", "aelia", "rufus"];

/** Act 3 teach order — finish prior glory before the next opens. */
export const TEACH_ORDER: SchoolNpcId[] = ["titus", "brom", "aelia", "rufus"];

export interface SchoolReadyNeeds {
  underLessons: number;
  prideLessons: number;
  prideTraining: number;
}

/** Titus matches the old bar; each later student needs more lessons + training. */
const READY_BY_INDEX: SchoolReadyNeeds[] = [
  { underLessons: 1, prideLessons: 2, prideTraining: 3 },
  { underLessons: 1, prideLessons: 3, prideTraining: 4 },
  { underLessons: 2, prideLessons: 3, prideTraining: 5 },
  { underLessons: 2, prideLessons: 4, prideTraining: 6 },
];

export function schoolTeachIndex(id: string): number {
  return TEACH_ORDER.indexOf(id as SchoolNpcId);
}

export function schoolPriorId(id: string): SchoolNpcId | null {
  const i = schoolTeachIndex(id);
  if (i <= 0) return null;
  return TEACH_ORDER[i - 1] ?? null;
}

/** Next student after this one in the teach ladder (null if last / unknown). */
export function schoolNextId(id: string): SchoolNpcId | null {
  const i = schoolTeachIndex(id);
  if (i < 0 || i >= TEACH_ORDER.length - 1) return null;
  return TEACH_ORDER[i + 1] ?? null;
}

export function schoolReadyNeeds(id: string): SchoolReadyNeeds {
  const i = schoolTeachIndex(id);
  return READY_BY_INDEX[Math.max(0, i)] ?? READY_BY_INDEX[0];
}

/** Titus always; later students after the prior has glory (or they already earned theirs). */
export function schoolStudentUnlocked(id: string): boolean {
  if (!isSchoolNpc(id)) return false;
  if (getSchoolRecord(id).glory) return true;
  const prior = schoolPriorId(id);
  if (!prior) return true;
  return Boolean(getSchoolRecord(prior).glory);
}

export function schoolUnlockHint(id: string): string {
  const prior = schoolPriorId(id);
  if (!prior) return "";
  const name = getNpc(prior).name;
  return `Finish ${name}'s glory first (${TEACH_ORDER.map((x) => getNpc(x).name).join(" → ")}).`;
}

/** How training marks are earned — shown in locker / school UI. */
export const TRAINING_HINT =
  "Training: spar them in the yard (SPAR), or finish a Teach lesson. Each adds +1 Training.";


export const SCHOOL_FOCUS: Record<SchoolNpcId, { specialty: string; line: string }> = {
  titus: { specialty: "Shield wall", line: "Defense — hold the line, then strike." },
  brom: { specialty: "Power", line: "Heavy cuts that end a bout." },
  aelia: { specialty: "Footwork", line: "Clean lights and measured space." },
  rufus: { specialty: "Dodge", line: "Get clear, then cut back." },
};

export const COACHING_LESSONS: Record<
  SchoolNpcId,
  { lesson: string; skill: string; lines: string[] }
> = {
  titus: {
    lesson: "The shield",
    skill: "defense",
    lines: [
      "Titus watches your stance. You are the teacher.",
      "Hold the block through his presses, then show a light and a heavy.",
      "Clear every beat — one knockdown is not enough.",
    ],
  },
  brom: {
    lesson: "The killing blow",
    skill: "power",
    lines: [
      "Brom watches your weight. You are the teacher.",
      "Land heavies, weather his flurry, finish with power.",
      "Clear every beat — one knockdown is not enough.",
    ],
  },
  aelia: {
    lesson: "The clean cut",
    skill: "footwork",
    lines: [
      "Aelia watches your feet. You are the teacher.",
      "Three clean lights, a dodge, then finish.",
      "Clear every beat — one knockdown is not enough.",
    ],
  },
  rufus: {
    lesson: "Getting clear",
    skill: "dodge",
    lines: [
      "Rufus watches how you move. You are the teacher.",
      "Dodge his steel, counter light, finish the lesson.",
      "Clear every beat — one knockdown is not enough.",
    ],
  },
};

export function emptySchoolRecord(): SchoolRecord {
  return { wins: 0, losses: 0, injured: false, glory: false, training: 0, specialty: 0, lessons: 0, rung: 0 };
}

export function emptySchool(): Record<SchoolNpcId, SchoolRecord> {
  return {
    titus: emptySchoolRecord(),
    brom: emptySchoolRecord(),
    aelia: emptySchoolRecord(),
    rufus: emptySchoolRecord(),
  };
}

export function mergeSchool(parsed?: Partial<Record<string, Partial<SchoolRecord>>>): Record<SchoolNpcId, SchoolRecord> {
  const next = emptySchool();
  for (const id of SCHOOL_IDS) {
    const rec = { ...emptySchoolRecord(), ...(parsed?.[id] ?? {}) };
    rec.wins = Math.max(0, rec.wins || 0);
    rec.losses = Math.max(0, rec.losses || 0);
    rec.training = Math.max(0, Math.min(6, rec.training || 0));
    rec.specialty = Math.max(0, Math.min(3, rec.specialty || 0));
    rec.lessons = Math.max(0, rec.lessons || 0);
    rec.rung = Math.max(0, Math.min(3, rec.rung ?? (rec.glory ? 3 : 0)));
    rec.injured = Boolean(rec.injured);
    rec.glory = Boolean(rec.glory);
    if (rec.glory) rec.rung = 3;
    next[id] = rec;
  }
  return next;
}

export function isSchoolNpc(id: string): id is SchoolNpcId {
  return (SCHOOL_IDS as readonly string[]).includes(id);
}

export function getSchoolRecord(id: string): SchoolRecord {
  if (!isSchoolNpc(id)) return emptySchoolRecord();
  return gameState.save.school?.[id] ?? emptySchoolRecord();
}

export function schoolLessonCount(id: string): number {
  return getSchoolRecord(id).lessons ?? 0;
}

export function schoolGloryCount(): number {
  const school = gameState.save.school;
  if (!school) return 0;
  return SCHOOL_IDS.filter((id) => school[id]?.glory).length;
}

export function allSchoolGlory(): boolean {
  return schoolGloryCount() >= SCHOOL_IDS.length;
}

export function schoolReadyForUndercard(id: string): boolean {
  const rec = getSchoolRecord(id);
  if (rec.injured) return false;
  if (!schoolStudentUnlocked(id)) return false;
  return schoolLessonCount(id) >= schoolReadyNeeds(id).underLessons;
}

export function schoolReadyForChampion(id: string): boolean {
  const rec = getSchoolRecord(id);
  if (rec.injured) return false;
  if (!schoolStudentUnlocked(id)) return false;
  const need = schoolReadyNeeds(id);
  return schoolLessonCount(id) >= need.prideLessons && rec.training >= need.prideTraining;
}

/** Ready for glory (champ) bookings — alias used by older UI. */
export function schoolStudentReady(id: string): boolean {
  return schoolReadyForChampion(id);
}

export function schoolReadinessLabel(id: string): string {
  const rec = getSchoolRecord(id);
  if (rec.injured) return "Injured — rest before booking";
  if (rec.glory) return "Done — glory earned";
  if (!schoolStudentUnlocked(id)) {
    const prior = schoolPriorId(id);
    return prior ? `Locked — ${getNpc(prior).name} first` : "Locked";
  }
  if (schoolReadyForChampion(id)) return "Ready for house pride";
  if (schoolReadyForUndercard(id)) return "Ready for undercard";
  const need = schoolReadyNeeds(id);
  const lessons = schoolLessonCount(id);
  if (lessons < need.underLessons) {
    const left = need.underLessons - lessons;
    return `Not ready — need ${left} more lesson${left === 1 ? "" : "s"}`;
  }
  if (lessons < need.prideLessons) {
    const left = need.prideLessons - lessons;
    return `Need ${left} more lesson${left === 1 ? "" : "s"} for pride`;
  }
  if (rec.training < need.prideTraining) {
    const left = need.prideTraining - rec.training;
    return `Need ${left} more training (spar in the yard)`;
  }
  return "Not ready";
}

export function schoolReadyChecklist(id: string): { label: string; ok: boolean }[] {
  const rec = getSchoolRecord(id);
  if (rec.glory) {
    const next = schoolNextId(id);
    const rows = [
      { label: "Three-bout path cleared", ok: true },
      { label: "Act goal complete for this student", ok: true },
      { label: `School glory ${schoolGloryCount()}/${SCHOOL_IDS.length}`, ok: allSchoolGlory() },
    ];
    if (next) rows.push({ label: `${getNpc(next).name} unlocked next`, ok: true });
    return rows;
  }
  if (!schoolStudentUnlocked(id)) {
    const prior = schoolPriorId(id);
    return [
      {
        label: prior ? `Wait for ${getNpc(prior).name}'s glory` : "Locked",
        ok: false,
      },
      { label: `Order: ${TEACH_ORDER.map((x) => getNpc(x).name).join(" → ")}`, ok: false },
    ];
  }
  const need = schoolReadyNeeds(id);
  const lessons = schoolLessonCount(id);
  return [
    { label: `Lessons ${lessons}/${need.prideLessons} (undercard at ${need.underLessons})`, ok: lessons >= need.underLessons },
    { label: `Training ${rec.training}/${need.prideTraining} — spar or Teach`, ok: rec.training >= need.prideTraining },
    { label: "Not injured", ok: !rec.injured },
    {
      label: `Pride ready (${need.prideLessons} lessons + train ≥${need.prideTraining})`,
      ok: schoolReadyForChampion(id),
    },
  ];
}

export function meterBar(filled: number, max: number): string {
  const n = Math.max(0, Math.min(max, Math.floor(filled)));
  return "■".repeat(n) + "□".repeat(Math.max(0, max - n));
}

export type SchoolMatchup = "Fair" | "Hard" | "Deadly";

/** Extra lessons / training past this student's pride gate. Caps keep farmed lessons from stacking forever. */
export function schoolPrepOverflow(id: string): { lessonExtra: number; trainExtra: number; score: number } {
  const rec = getSchoolRecord(id);
  const need = schoolReadyNeeds(id);
  const lessonExtra = Math.max(0, Math.min(4, (rec.lessons ?? 0) - need.prideLessons));
  const trainExtra = Math.max(0, rec.training - need.prideTraining);
  return { lessonExtra, trainExtra, score: lessonExtra + trainExtra };
}

/** Taught students stop turtling once they have overflow prep. */
export function schoolStudentAiStyle(id: string): AiStyle {
  const overflow = schoolPrepOverflow(id).score;
  if (overflow >= 4) return "elite";
  if (overflow >= 2) return "aggressive";
  return getNpc(id).aiStyle;
}

function schoolPowerScore(s: Pick<FighterStats, "maxHealth" | "attack" | "defense" | "agility">): number {
  return s.maxHealth + s.attack * 10 + s.defense * 8 + s.agility * 4;
}

function schoolAiWeight(style: AiStyle): number {
  switch (style) {
    case "champion":
      return 1.12;
    case "elite":
      return 1.1;
    case "aggressive":
      return 1.04;
    case "spear":
      return 1.03;
    case "heavy":
      return 1.02;
    case "defensive":
      return 0.95;
    default:
      return 1;
  }
}

export function schoolMatchupHint(npcId: string, opponentId: string): SchoolMatchup {
  const s = schoolCombatStats(npcId);
  const f = getRival(opponentId)?.fighter.stats;
  if (!f) return "Hard";
  const d = schoolPowerScore(s) - schoolPowerScore(f);
  if (d >= -30) return "Fair";
  if (d >= -100) return "Hard";
  return "Deadly";
}

/** Estimate of an AI-vs-AI school bout. Not a roll — the fight still plays. Never 0 or 100. */
export function schoolWinChance(npcId: string, opponentId: string): number {
  const s = schoolCombatStats(npcId);
  const found = getRival(opponentId)?.fighter;
  if (!found) return 50;
  const student = schoolPowerScore(s) * schoolAiWeight(schoolStudentAiStyle(npcId));
  const foe = schoolPowerScore(found.stats) * schoolAiWeight(found.aiStyle);
  const ratio = student / Math.max(1, foe);
  const raw = 1 / (1 + Math.exp(-4.2 * (ratio - 1)));
  const hurt = getSchoolRecord(npcId).injured ? 8 : 0;
  return Math.max(20, Math.min(85, Math.round(raw * 100) - hurt));
}

export function schoolWinChanceColor(pct: number): string {
  if (pct >= 70) return "#8ecf6a";
  if (pct >= 50) return "#e8c96a";
  return "#c07060";
}

export function schoolPowerCompare(
  npcId: string,
  opponentId: string,
): { student: Pick<FighterStats, "maxHealth" | "attack">; foe: Pick<FighterStats, "maxHealth" | "attack">; match: SchoolMatchup; chance: number } {
  const s = schoolCombatStats(npcId);
  const f = getRival(opponentId)?.fighter.stats ?? { maxHealth: 100, attack: 10, defense: 6, agility: 6, maxStamina: 80 };
  return {
    student: { maxHealth: Math.round(s.maxHealth), attack: Math.round(s.attack) },
    foe: { maxHealth: Math.round(f.maxHealth), attack: Math.round(f.attack) },
    match: schoolMatchupHint(npcId, opponentId),
    chance: schoolWinChance(npcId, opponentId),
  };
}

/** Next foe on this student's fixed 3-bout ladder (exhibition rematch pride if done). */
export function schoolNextFoeId(npcId: string): string | null {
  const card = getStudentCircuit(npcId);
  if (!card) return null;
  const rec = getSchoolRecord(npcId);
  if (rec.glory || rec.rung >= 3) return card.fighters[2]?.id ?? null;
  return card.fighters[Math.min(2, rec.rung)]?.id ?? null;
}

export function schoolCircuitProgress(npcId: string): { rung: number; total: number; nextId: string | null; foes: import("../types").RivalFighterDef[] } {
  const card = getStudentCircuit(npcId);
  const rec = getSchoolRecord(npcId);
  const foes = card?.fighters ?? [];
  return {
    rung: Math.min(3, rec.rung ?? 0),
    total: 3,
    nextId: schoolNextFoeId(npcId),
    foes,
  };
}

/** Bout index 0–1 need undercard ready; pride (2) needs champion ready. Exhibition if glory. */
export function schoolBoutLocked(npcId: string, rungIndex: number): { locked: boolean; reason: string } {
  if (!schoolStudentUnlocked(npcId)) return { locked: true, reason: schoolUnlockHint(npcId) };
  const rec = getSchoolRecord(npcId);
  if (rec.injured) return { locked: true, reason: "Injured — rest first" };
  if (rec.glory) return { locked: false, reason: "" };
  if (rungIndex > rec.rung) return { locked: true, reason: "Win the earlier bout first" };
  if (rungIndex < rec.rung) return { locked: true, reason: "Already cleared" };
  if (rungIndex >= 2) {
    if (!schoolReadyForChampion(npcId)) {
      const need = schoolReadyNeeds(npcId);
      return { locked: true, reason: `Need ${need.prideLessons} lessons + train ≥${need.prideTraining}` };
    }
    return { locked: false, reason: "" };
  }
  if (!schoolReadyForUndercard(npcId)) {
    const need = schoolReadyNeeds(npcId);
    return { locked: true, reason: `Need ${need.underLessons} lesson${need.underLessons === 1 ? "" : "s"}` };
  }
  return { locked: false, reason: "" };
}

/** Buffed so a taught student can contest mid champs. Overflow lessons/training sit on top of the old caps. */
export function schoolCombatStats(id: string): FighterStats {
  const npc = getNpc(id);
  const rec = getSchoolRecord(id);
  const train = Math.min(6, rec.training);
  const spec = Math.min(3, rec.specialty ?? 0);
  const wins = Math.min(12, rec.wins);
  const { lessonExtra, trainExtra } = schoolPrepOverflow(id);
  const hp = Math.min(100, train * 10 + wins * 8 + (id === "brom" ? spec * 8 : train * 2) + (id === "titus" ? spec * 4 : 0));
  const atk = Math.min(14, train * 1.4 + wins * 1.1 + (id === "brom" ? spec * 1.2 : 0));
  const def = Math.min(12, train * 0.9 + (id === "titus" ? spec * 1.8 : train * 0.2));
  const agi = Math.min(10, Math.floor(train / 2) + (id === "aelia" || id === "rufus" ? spec * 1.5 : 0));
  const stam = train * 4 + (id === "rufus" ? spec * 5 : 0);
  return {
    maxHealth: npc.stats.maxHealth + hp + lessonExtra * 8 + trainExtra * 6 - (rec.injured ? 8 : 0),
    maxStamina: npc.stats.maxStamina + stam + lessonExtra * 3 + trainExtra * 2,
    attack: npc.stats.attack + atk + lessonExtra * 0.55 + trainExtra * 0.45,
    defense: npc.stats.defense + def + lessonExtra * 0.4 + trainExtra * 0.3,
    agility: npc.stats.agility + agi + Math.floor(trainExtra / 2),
  };
}

export function grantLanista(): boolean {
  const s = gameState.save;
  if (s.lanistaUnlocked) return false;
  s.lanistaUnlocked = true;
  if (!s.ownedCosmetics.includes("title-lanista")) s.ownedCosmetics.push("title-lanista");
  s.title = "lanista";
  for (const id of CHAMBER_STARTERS) {
    if (!s.ownedCosmetics.includes(id)) s.ownedCosmetics.push(id);
  }
  s.chamber = furnishedChamber();
  if (s.freedomWon) s.currentObjective = "school";
  gameState.persist();
  bus.emit("cosmetics-changed");
  bus.emit("lanista-unlocked");
  return true;
}

export function bumpSchoolTraining(npcId: string): void {
  if (!gameState.save.lanistaUnlocked || !isSchoolNpc(npcId)) return;
  const rec = gameState.save.school[npcId];
  rec.training = Math.min(6, rec.training + 1);
}

export function bumpSchoolSpecialty(npcId: string): boolean {
  if (!gameState.save.lanistaUnlocked || !isSchoolNpc(npcId)) return false;
  const rec = gameState.save.school[npcId];
  if ((rec.specialty ?? 0) >= 3) return false;
  rec.specialty = Math.min(3, (rec.specialty ?? 0) + 1);
  return true;
}

export function applyCoachingLesson(npcId: string): { message: string; training: number; specialty: number; lessons: number } {
  if (!isSchoolNpc(npcId)) return { message: "Lesson done.", training: 0, specialty: 0, lessons: 0 };
  bumpSchoolTraining(npcId);
  bumpSchoolSpecialty(npcId);
  const rec = gameState.save.school[npcId];
  rec.lessons = (rec.lessons ?? 0) + 1;
  gameState.persist();
  const npc = getNpc(npcId);
  const focus = SCHOOL_FOCUS[npcId];
  return {
    message: `${npc.name} learned the ${focus.specialty.toLowerCase()} lesson. Training ${rec.training}/6 · Specialty ${rec.specialty}/3 · Lessons ${rec.lessons}`,
    training: rec.training,
    specialty: rec.specialty,
    lessons: rec.lessons,
  };
}

export function ensureSchoolCosmetics(): void {
  const s = gameState.save;
  if (!s.lanistaUnlocked) return;
  if (!s.ownedCosmetics.includes("title-lanista")) s.ownedCosmetics.push("title-lanista");
  for (const id of CHAMBER_STARTERS) {
    if (!s.ownedCosmetics.includes(id)) s.ownedCosmetics.push(id);
  }
  s.chamber = { ...furnishedChamber(), ...(s.chamber ?? {}) };
}
