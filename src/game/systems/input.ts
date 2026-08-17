import Phaser from "phaser";
import type { CombatBindAction as CombatAction } from "../types";
import { DEFAULT_KEYBINDS } from "../types";
import { gameState } from "../state/GameState";
import { bus } from "./bus";

export type { CombatAction };

export const ACTION_LABELS: Record<CombatAction, string> = {
  attack: "Light attack",
  heavy: "Heavy attack",
  dodge: "Dodge",
  block: "Block (hold)",
  special: "Special",
  parry: "Parry",
  interact: "Talk / Interact",
  unguent: "Drink unguent",
};

const RESERVED = new Set(["ESC", "ESCAPE", "TAB", "K", "C", "M", "F2", "F3", "F4", "F5", "F6", "F7", "F8"]);

export function mergedKeybinds(): Record<CombatAction, string> {
  return { ...DEFAULT_KEYBINDS, ...(gameState.settings.keybinds ?? {}) };
}

export function prettyKey(name: string): string {
  const n = (name || "").toUpperCase();
  if (n === "SPACE") return "Space";
  if (n === "SHIFT") return "Shift";
  if (n === "CTRL") return "Ctrl";
  if (n === "UP") return "Up";
  if (n === "DOWN") return "Down";
  if (n === "LEFT") return "Left";
  if (n === "RIGHT") return "Right";
  return n.length === 1 ? n : n.charAt(0) + n.slice(1).toLowerCase();
}

export function controlsHelpText(): string {
  const b = mergedKeybinds();
  return [
    "WASD / Arrow Keys — Move",
    `ATTACK button or ${prettyKey(b.attack)} — Light attack`,
    `HEAVY button or ${prettyKey(b.heavy)} — Heavy attack`,
    `${prettyKey(b.dodge)} — Dodge (roll into a swing for a perfect dodge)`,
    `${prettyKey(b.block)} — Block (hold)`,
    `${prettyKey(b.special)} or NET — Special (trident throws a catching net)`,
    `${prettyKey(b.parry)} — Parry (tap into a swing)`,
    `${prettyKey(b.unguent)} — Drink unguent (bought vials)`,
    `${prettyKey(b.interact)} — Talk / Interact`,
    "Tab — Equipment",
    "K — Skill Tree",
    "C — Customize / Shop (looks, and unguent vials)",
    "M — Minimize / restore map",
    "Esc — Pause",
    "Mute music — title screen or pause Settings",
  ].join("\n");
}

export function eventToKeyName(ev: KeyboardEvent): string | null {
  const c = ev.code;
  if (!c) return null;
  if (c === "Space") return "SPACE";
  if (c === "ShiftLeft" || c === "ShiftRight") return "SHIFT";
  if (c === "ControlLeft" || c === "ControlRight") return "CTRL";
  if (c === "AltLeft" || c === "AltRight") return "ALT";
  if (c === "ArrowUp") return "UP";
  if (c === "ArrowDown") return "DOWN";
  if (c === "ArrowLeft") return "LEFT";
  if (c === "ArrowRight") return "RIGHT";
  if (c === "Enter") return "ENTER";
  if (c === "Escape") return "ESC";
  if (c === "Tab") return "TAB";
  if (c.startsWith("Key") && c.length === 4) return c.slice(3);
  if (c.startsWith("Digit") && c.length === 6) {
    const map = ["ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE"];
    return map[Number(c.slice(5))] ?? null;
  }
  if (c.startsWith("F") && c.length <= 3) return c.toUpperCase();
  const codes = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
  const upper = c.toUpperCase();
  if (codes[upper] != null) return upper;
  return null;
}

export function isReservedBind(name: string): boolean {
  return RESERVED.has(name.toUpperCase());
}

export function trySetBind(action: CombatAction, name: string): "ok" | "reserved" | "taken" {
  const key = name.toUpperCase();
  if (isReservedBind(key)) return "reserved";
  const codes = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
  if (codes[key] == null) return "reserved";
  const next = { ...mergedKeybinds() };
  for (const [act, bound] of Object.entries(next)) {
    if (act !== action && bound === key) return "taken";
  }
  next[action] = key;
  gameState.settings.keybinds = next;
  gameState.persistSettings();
  bus.emit("keybinds-changed");
  return "ok";
}

function codeFor(name: string): number {
  const codes = Phaser.Input.Keyboard.KeyCodes as unknown as Record<string, number>;
  return codes[name.toUpperCase()] ?? Phaser.Input.Keyboard.KeyCodes.SPACE;
}

export class CombatInput {
  private actionKeys: Partial<Record<CombatAction, Phaser.Input.Keyboard.Key>> = {};
  private moveKeys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private blocking = false;

  constructor(private scene: Phaser.Scene) {
    this.rebuild();
    bus.on("keybinds-changed", this.rebuild, this);
    scene.events.once("shutdown", () => {
      bus.off("keybinds-changed", this.rebuild, this);
      this.destroyKeys();
    });
  }

  rebuild = (): void => {
    this.destroyKeys();
    const kb = this.scene.input.keyboard;
    if (!kb) return;
    const binds = mergedKeybinds();
    (Object.keys(binds) as CombatAction[]).forEach((action) => {
      this.actionKeys[action] = kb.addKey(codeFor(binds[action]), false);
    });
    this.moveKeys = {
      w: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W, false),
      a: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A, false),
      s: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S, false),
      d: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D, false),
      up: kb.addKey(Phaser.Input.Keyboard.KeyCodes.UP, false),
      down: kb.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN, false),
      left: kb.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT, false),
      right: kb.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT, false),
    };
    const capture = [codeFor(binds.attack), codeFor(binds.heavy), Phaser.Input.Keyboard.KeyCodes.SPACE];
    kb.addCapture(capture);
  };

  private destroyKeys(): void {
    Object.values(this.actionKeys).forEach((k) => k?.destroy());
    Object.values(this.moveKeys).forEach((k) => k?.destroy());
    this.actionKeys = {};
    this.moveKeys = {};
  }

  justPressed(action: CombatAction): boolean {
    const k = this.actionKeys[action];
    return Boolean(k && Phaser.Input.Keyboard.JustDown(k));
  }

  justReleased(action: CombatAction): boolean {
    const k = this.actionKeys[action];
    return Boolean(k && Phaser.Input.Keyboard.JustUp(k));
  }

  isDown(action: CombatAction): boolean {
    return Boolean(this.actionKeys[action]?.isDown);
  }

  pollBlock(): "start" | "hold" | "end" | "none" {
    if (this.justPressed("block")) {
      this.blocking = true;
      return "start";
    }
    if (this.justReleased("block") && this.blocking) {
      this.blocking = false;
      return "end";
    }
    if (this.blocking && this.isDown("block")) return "hold";
    if (!this.isDown("block")) this.blocking = false;
    return "none";
  }

  moveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.moveKeys.a?.isDown || this.moveKeys.left?.isDown) x -= 1;
    if (this.moveKeys.d?.isDown || this.moveKeys.right?.isDown) x += 1;
    if (this.moveKeys.w?.isDown || this.moveKeys.up?.isDown) y -= 1;
    if (this.moveKeys.s?.isDown || this.moveKeys.down?.isDown) y += 1;
    if (x || y) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}
