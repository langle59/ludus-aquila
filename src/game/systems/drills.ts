import type { SchoolNpcId } from "../types";
import { TILE_SIZE } from "../config";
import { gameState } from "../state/GameState";
import { bumpSchoolSpecialty, bumpSchoolTraining, getSchoolRecord, isSchoolNpc } from "../data/school";
import { getNpc } from "../data/gladiators";
import { mergedKeybinds, prettyKey } from "./input";
import type { DrillStationId } from "../maps/maps";

export type DrillId = DrillStationId;

export interface DrillDef {
  id: DrillId;
  lesson: string;
  studentName: string;
  teaching: string;
  goal: string;
  steps: string[];
  skill: string;
  passScore: number;
}

export interface DrillTelegraph {
  x: number;
  y: number;
  /** Unused for fail — cues wait until success. Kept for HUD pulse. */
  until: number;
  kind: "strike" | "post" | "marker" | "dodge";
  hit?: boolean;
  label?: string;
}

export interface DrillState {
  id: DrillId;
  startedAt: number;
  score: number;
  needed: number;
  nextAt: number;
  strikes: number;
  telegraphs: DrillTelegraph[];
  postIndex: number;
  posts: [{ x: number; y: number }, { x: number; y: number }];
  done: boolean;
  result: "running" | "pass" | "fail";
  prompt: string;
}

export interface DrillInput {
  light: boolean;
  heavy: boolean;
  dodge: boolean;
  /** Raw key held — not fighter.blocking (weapons can refuse block). */
  blocking: boolean;
  playerX: number;
  playerY: number;
}

function keys() {
  const b = mergedKeybinds();
  return {
    light: prettyKey(b.attack),
    heavy: prettyKey(b.heavy),
    dodge: prettyKey(b.dodge),
    block: prettyKey(b.block),
  };
}

export function getDrillDef(id: DrillId): DrillDef {
  const k = keys();
  const studentName = getNpc(id).name;
  if (id === "titus") {
    return {
      id,
      lesson: "The shield",
      studentName,
      teaching: `You are teaching ${studentName}. Stand in the ring and show him how a fighter stops a blow.`,
      goal: `When the red circle appears, hold ${k.block}.`,
      steps: [
        `${studentName} watches from the side — you are the teacher.`,
        `A red circle means a strike is coming.`,
        `Hold ${k.block} until it clears. Do this a few times so he learns.`,
      ],
      skill: "BLOCK",
      passScore: 3,
    };
  }
  if (id === "brom") {
    return {
      id,
      lesson: "The killing blow",
      studentName,
      teaching: `You are teaching ${studentName}. Show him how to put weight behind a heavy cut.`,
      goal: `Walk to the gold post and press ${k.heavy}.`,
      steps: [
        `${studentName} watches — demonstrate a proper heavy strike.`,
        "A gold post lights up. Walk up to it.",
        `Press ${k.heavy}. Repeat until he has seen enough.`,
      ],
      skill: "HEAVY",
      passScore: 3,
    };
  }
  if (id === "aelia") {
    return {
      id,
      lesson: "The clean cut",
      studentName,
      teaching: `You are teaching ${studentName}. Show her a measured light cut on the mark.`,
      goal: `Move to the blue mark and press ${k.light}.`,
      steps: [
        `${studentName} watches your footwork and your cut.`,
        "A blue mark appears on the sand.",
        `Walk to it and press ${k.light}. Show her a few clean hits.`,
      ],
      skill: "LIGHT",
      passScore: 3,
    };
  }
  return {
    id,
    lesson: "Getting clear",
    studentName,
    teaching: `You are teaching ${studentName}. Show him how to step out of a sweep.`,
    goal: `When the yellow circle appears, press ${k.dodge}.`,
    steps: [
      `${studentName} watches — you are showing the dodge, not sparring him.`,
      "A yellow circle means get out of the way.",
      `Press ${k.dodge}. Repeat so he sees the timing.`,
    ],
    skill: "DODGE",
    passScore: 3,
  };
}

export function drillPlayBounds(): { x0: number; y0: number; x1: number; y1: number } {
  return { x0: 24, y0: 15, x1: 40, y1: 22 };
}

export function drillYardCenter(): { x: number; y: number } {
  const c = drillPlayBounds();
  return {
    x: ((c.x0 + c.x1) / 2) * TILE_SIZE + TILE_SIZE / 2,
    y: ((c.y0 + c.y1) / 2) * TILE_SIZE + TILE_SIZE / 2,
  };
}

export function drillBromPosts(): [{ x: number; y: number }, { x: number; y: number }] {
  const c = drillYardCenter();
  return [
    { x: c.x - 5.5 * TILE_SIZE, y: c.y },
    { x: c.x + 5.5 * TILE_SIZE, y: c.y },
  ];
}

export function isDrillId(id: string): id is DrillId {
  return id === "titus" || id === "brom" || id === "aelia" || id === "rufus";
}

export function createDrillState(id: DrillId, now: number): DrillState {
  const def = getDrillDef(id);
  return {
    id,
    startedAt: now,
    score: 0,
    needed: def.passScore,
    nextAt: now + 900,
    strikes: 0,
    telegraphs: [],
    postIndex: 0,
    posts: drillBromPosts(),
    done: false,
    result: "running",
    prompt: idlePrompt(id),
  };
}

function idlePrompt(id: DrillId): string {
  const k = keys();
  if (id === "titus") return `Hold ${k.block} when the red circle appears`;
  if (id === "brom") return `Walk to the gold post, then press ${k.heavy}`;
  if (id === "aelia") return `Walk to the blue mark, then press ${k.light}`;
  return `Press ${k.dodge} when the yellow circle appears`;
}

export function clampDrillPosition(_id: DrillId, x: number, y: number): { x: number; y: number } {
  const c = drillPlayBounds();
  const pad = 14;
  return {
    x: Math.max(c.x0 * TILE_SIZE + pad, Math.min((c.x1 + 1) * TILE_SIZE - pad, x)),
    y: Math.max(c.y0 * TILE_SIZE + pad, Math.min((c.y1 + 1) * TILE_SIZE - pad, y)),
  };
}

/** Shift deadlines forward after tab-out / lag so cues don't expire. */
export function shiftDrillTimers(state: DrillState, ms: number): void {
  if (ms <= 0) return;
  state.nextAt += ms;
  for (const t of state.telegraphs) t.until += ms;
}

export function tickDrill(state: DrillState, input: DrillInput, now: number): DrillState {
  if (state.done) return state;

  if (state.id === "titus") tickTitus(state, input, now);
  else if (state.id === "brom") tickBrom(state, input, now);
  else if (state.id === "aelia") tickAelia(state, input, now);
  else tickRufus(state, input, now);

  if (state.score >= state.needed) {
    state.done = true;
    state.result = "pass";
    state.telegraphs = [];
    state.prompt = "They've seen enough. Lesson done.";
  }
  return state;
}

/** Titus: hold block. Cue waits forever until you do it. */
function tickTitus(state: DrillState, input: DrillInput, now: number): void {
  const k = keys();
  const center = drillYardCenter();
  for (const t of state.telegraphs) {
    if (t.kind !== "strike" || t.hit) continue;
    t.label = `HOLD  ${k.block}`;
    state.prompt = `Hold ${k.block} now`;
    if (input.blocking) {
      t.hit = true;
      state.score += 1;
      state.prompt = "Good — they saw the block";
      state.nextAt = now + 1600;
    }
  }
  state.telegraphs = state.telegraphs.filter((t) => !t.hit);
  if (now >= state.nextAt && state.telegraphs.length === 0) {
    state.nextAt = now + 999999;
    state.strikes += 1;
    state.telegraphs.push({
      x: center.x,
      y: center.y - 8,
      until: now + 999999,
      kind: "strike",
      label: `HOLD  ${k.block}`,
    });
    state.prompt = `Red circle — hold ${k.block}`;
  }
  if (!state.telegraphs.length) state.prompt = idlePrompt("titus");
}

function tickBrom(state: DrillState, input: DrillInput, now: number): void {
  const k = keys();
  const active = state.telegraphs.find((t) => t.kind === "post" && !t.hit);
  if (active) {
    const near = Math.hypot(input.playerX - active.x, input.playerY - active.y) < 96;
    active.label = near ? `PRESS  ${k.heavy}` : "WALK HERE";
    state.prompt = near ? `Press ${k.heavy} now` : "Walk onto the gold post";
    if (input.heavy && near) {
      active.hit = true;
      state.score += 1;
      state.prompt = "Good — they saw the heavy";
      state.nextAt = now + 1600;
    } else if (input.heavy && !near) {
      state.prompt = "Get closer to the gold post, then heavy";
    }
  }
  state.telegraphs = state.telegraphs.filter((t) => !t.hit);
  if (now >= state.nextAt && !state.telegraphs.some((t) => t.kind === "post")) {
    state.nextAt = now + 999999;
    state.postIndex = (state.postIndex + 1) % 2;
    const p = state.posts[state.postIndex];
    state.telegraphs.push({
      x: p.x,
      y: p.y,
      until: now + 999999,
      kind: "post",
      label: "WALK HERE",
    });
    state.prompt = `Walk to the gold post, then press ${k.heavy}`;
  }
  if (!state.telegraphs.length) state.prompt = idlePrompt("brom");
}

function tickAelia(state: DrillState, input: DrillInput, now: number): void {
  const k = keys();
  const center = drillYardCenter();
  for (const t of state.telegraphs) {
    if (t.kind !== "marker" || t.hit) continue;
    const near = Math.hypot(input.playerX - t.x, input.playerY - t.y) < 88;
    t.label = near ? `PRESS  ${k.light}` : "WALK HERE";
    state.prompt = near ? `Press ${k.light} now` : "Walk onto the blue mark";
    if (input.light && near) {
      t.hit = true;
      state.score += 1;
      state.prompt = "Good — clean cut";
      state.nextAt = now + 1600;
    } else if (input.light && !near) {
      state.prompt = "Get closer to the blue mark, then attack";
    }
  }
  state.telegraphs = state.telegraphs.filter((t) => !t.hit);
  if (now >= state.nextAt && state.telegraphs.length === 0) {
    state.nextAt = now + 999999;
    const spots = [
      { x: center.x, y: center.y - 40 },
      { x: center.x + 48, y: center.y + 12 },
      { x: center.x - 48, y: center.y + 12 },
    ];
    const spot = spots[state.strikes % spots.length];
    state.strikes += 1;
    state.telegraphs.push({
      x: spot.x,
      y: spot.y,
      until: now + 999999,
      kind: "marker",
      label: "WALK HERE",
    });
    state.prompt = `Walk to the blue mark, then press ${k.light}`;
  }
  if (!state.telegraphs.length) state.prompt = idlePrompt("aelia");
}

function tickRufus(state: DrillState, input: DrillInput, now: number): void {
  const k = keys();
  const center = drillYardCenter();
  for (const t of state.telegraphs) {
    if (t.kind !== "dodge" || t.hit) continue;
    t.label = `PRESS  ${k.dodge}`;
    state.prompt = `Press ${k.dodge} now`;
    if (input.dodge) {
      t.hit = true;
      state.score += 1;
      state.prompt = "Good — they saw the dodge";
      state.nextAt = now + 1600;
    }
  }
  state.telegraphs = state.telegraphs.filter((t) => !t.hit);
  if (now >= state.nextAt && state.telegraphs.length === 0) {
    state.nextAt = now + 999999;
    const side = state.strikes % 2 === 0 ? -40 : 40;
    state.strikes += 1;
    state.telegraphs.push({
      x: center.x + side,
      y: center.y,
      until: now + 999999,
      kind: "dodge",
      label: `PRESS  ${k.dodge}`,
    });
    state.prompt = `Yellow circle — press ${k.dodge}`;
  }
  if (!state.telegraphs.length) state.prompt = idlePrompt("rufus");
}

export function applyDrillReward(id: DrillId): { message: string; specialty: number; training: number } {
  if (!isSchoolNpc(id)) return { message: "Lesson done.", specialty: 0, training: 0 };
  bumpSchoolTraining(id);
  bumpSchoolSpecialty(id);
  gameState.persist();
  const rec = getSchoolRecord(id);
  const npc = getNpc(id);
  return {
    message: `${npc.name} learned from your demonstration. Training ${rec.training}/6 · Specialty ${rec.specialty}/3`,
    specialty: rec.specialty,
    training: rec.training,
  };
}

export function drillTimeLeft(_state: DrillState, _now: number): number {
  return 0;
}

export function asSchoolNpc(id: DrillId): SchoolNpcId {
  return id;
}
