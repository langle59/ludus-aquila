import type { SchoolNpcId } from "../types";
import { COACHING_LESSONS } from "../data/school";

export type LessonEvent =
  | { type: "player_light" }
  | { type: "player_heavy" }
  | { type: "player_block" }
  | { type: "player_dodge" }
  | { type: "player_hurt" }
  | { type: "enemy_attack_resolved" };

export interface LessonBeatDef {
  id: string;
  prompt: string;
  /** How many successful counts to clear the beat. */
  need: number;
  /** If true, taking a real hit resets this beat's progress. */
  resetOnHurt?: boolean;
}

export interface LessonRuntime {
  studentId: SchoolNpcId;
  beatIndex: number;
  progress: number;
  complete: boolean;
}

export function lessonBeats(id: SchoolNpcId): LessonBeatDef[] {
  switch (id) {
    case "titus":
      return [
        { id: "blocks", prompt: "Hold block through 3 presses", need: 3 },
        { id: "light", prompt: "Land 1 light", need: 1 },
        { id: "heavy", prompt: "Land 1 heavy while they press", need: 1 },
      ];
    case "brom":
      return [
        { id: "heavies", prompt: "Land 2 heavies", need: 2 },
        { id: "survive", prompt: "Survive their flurry (block/dodge ×3)", need: 3, resetOnHurt: true },
        { id: "finish", prompt: "Finish with a heavy", need: 1 },
      ];
    case "aelia":
      return [
        { id: "lights", prompt: "Land 3 lights without taking a hit", need: 3, resetOnHurt: true },
        { id: "dodge", prompt: "Dodge once", need: 1 },
        { id: "finish", prompt: "Finish with a light or heavy", need: 1 },
      ];
    case "rufus":
      return [
        { id: "dodges", prompt: "Dodge their steel ×2", need: 2 },
        { id: "counter", prompt: "Counter with a light", need: 1 },
        { id: "finish", prompt: "Finish with a light or heavy", need: 1 },
      ];
  }
}

export function createLessonRuntime(studentId: SchoolNpcId): LessonRuntime {
  return { studentId, beatIndex: 0, progress: 0, complete: false };
}

export function lessonPrompt(state: LessonRuntime): string {
  const beats = lessonBeats(state.studentId);
  const beat = beats[state.beatIndex];
  if (!beat) return "Lesson clear";
  return `Beat ${state.beatIndex + 1}/3 — ${beat.prompt}  (${state.progress}/${beat.need})`;
}

export function lessonIntroLines(studentId: SchoolNpcId): { name: string; lines: string[] } {
  const lesson = COACHING_LESSONS[studentId];
  return { name: lesson.lesson.toUpperCase(), lines: lesson.lines };
}

/**
 * Apply a combat event to the current lesson beat.
 * Returns true if the full lesson just completed.
 */
export function applyLessonEvent(state: LessonRuntime, ev: LessonEvent, attackKind?: "light" | "heavy"): boolean {
  if (state.complete) return false;
  const beats = lessonBeats(state.studentId);
  const beat = beats[state.beatIndex];
  if (!beat) {
    state.complete = true;
    return true;
  }

  if (ev.type === "player_hurt" && beat.resetOnHurt) {
    state.progress = 0;
    return false;
  }

  let tick = false;
  switch (beat.id) {
    case "blocks":
      tick = ev.type === "player_block";
      break;
    case "light":
    case "counter":
      tick = ev.type === "player_light";
      break;
    case "heavies":
    case "heavy":
    case "finish":
      if (beat.id === "finish" && (state.studentId === "aelia" || state.studentId === "rufus")) {
        tick = ev.type === "player_light" || ev.type === "player_heavy";
      } else {
        tick = ev.type === "player_heavy";
      }
      break;
    case "survive":
      tick = ev.type === "player_block" || ev.type === "player_dodge";
      break;
    case "lights":
      tick = ev.type === "player_light";
      break;
    case "dodge":
    case "dodges":
      tick = ev.type === "player_dodge";
      break;
    default:
      tick = false;
  }

  // Titus beat 3: heavy while they press — require a recent enemy attack resolve nearby in time; caller gates via enemyPressing
  if (beat.id === "heavy" && state.studentId === "titus" && tick) {
    // Caller should only emit player_heavy when enemy recently attacked; if not, we still accept heavy for playability
    void attackKind;
  }

  if (!tick) return false;
  state.progress += 1;
  if (state.progress >= beat.need) {
    state.beatIndex += 1;
    state.progress = 0;
    if (state.beatIndex >= beats.length) {
      state.complete = true;
      return true;
    }
  }
  return false;
}
