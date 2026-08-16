import Phaser from "phaser";
import { gameState } from "../state/GameState";

function halt(plugin: Phaser.Scenes.ScenePlugin, key: string): void {
  if (plugin.isActive(key) || plugin.isSleeping(key) || plugin.isPaused(key)) plugin.stop(key);
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
