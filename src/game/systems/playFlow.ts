import Phaser from "phaser";
import { gameState } from "../state/GameState";

function halt(plugin: Phaser.Scenes.ScenePlugin, key: string): void {
  if (plugin.isActive(key) || plugin.isSleeping(key) || plugin.isPaused(key)) plugin.stop(key);
}

function haltManager(sm: Phaser.Scenes.SceneManager, key: string): void {
  try {
    if (sm.isActive(key) || sm.isSleeping(key) || sm.isPaused(key)) sm.stop(key);
  } catch {
    /* ignore */
  }
}

/** Shut down a previous career so the next file boots fresh, instead of waking the old pit. */
export function enterLudus(from: Phaser.Scene): void {
  const p = from.scene;
  halt(p, "LudusScene");
  halt(p, "ArenaScene");
  halt(p, "UIScene");
  p.launch("UIScene");
  p.start("LudusScene");
}

export function enterMenu(from: Phaser.Scene, persist = false): void {
  if (persist) gameState.persist();
  gameState.resetSession();
  const p = from.scene;
  halt(p, "LudusScene");
  halt(p, "ArenaScene");
  p.start("MenuScene");
}

let returning = false;

/**
 * Hard return from the arena: stop pit + yard, relaunch yard, keep UI.
 * Uses window timers so a hung Phaser scene clock cannot block homecoming.
 */
export function returnFromArena(game: Phaser.Game): void {
  gameState.paused = false;
  gameState.inMenu = false;
  gameState.inDialogue = false;
  if (returning) return;
  returning = true;

  const run = (): void => {
    gameState.paused = false;
    gameState.inMenu = false;
    gameState.inDialogue = false;
    const sm = game.scene;
    haltManager(sm, "ArenaScene");
    haltManager(sm, "LudusScene");
    try {
      if (!sm.isActive("UIScene") && !sm.isSleeping("UIScene")) sm.run("UIScene");
      else if (sm.isSleeping("UIScene") || sm.isPaused("UIScene")) sm.wake("UIScene");
    } catch {
      /* ignore */
    }
    try {
      sm.run("LudusScene");
    } catch {
      try {
        sm.start("LudusScene");
      } catch {
        /* ignore */
      }
    }
    gameState.paused = false;
    gameState.inMenu = false;
    gameState.inDialogue = false;
  };

  window.setTimeout(run, 0);
  window.setTimeout(run, 80);
  window.setTimeout(() => {
    run();
    returning = false;
  }, 200);
}
