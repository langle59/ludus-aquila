import Phaser from "phaser";
import { gameState } from "../state/GameState";
import { act4Unlocked, advanceFarmAfterRaid } from "../data/camp";
import { tryVolunteerForager } from "../data/volunteers";
import { bus } from "./bus";
import { TILE_SIZE } from "../config";

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
  halt(p, "FreedCampScene");
  halt(p, "RaidScene");
  halt(p, "UIScene");
  p.launch("UIScene");
  p.start("LudusScene");
}

/** Continue a save: Act 4 resumes at the Freed Camp commons; earlier acts at the ludus. */
export function enterCareer(from: Phaser.Scene): void {
  if (act4Unlocked()) {
    // Middle of the campsite (commons / fire), not last gate position
    gameState.save.position = {
      x: 9 * TILE_SIZE + TILE_SIZE / 2,
      y: 11 * TILE_SIZE + TILE_SIZE / 2,
      scene: "freedcamp",
    };
    gameState.persist();
    enterFreedCamp(from);
    return;
  }
  enterLudus(from);
}

export function enterMenu(from: Phaser.Scene, persist = false): void {
  if (persist) gameState.persist();
  gameState.resetSession();
  const p = from.scene;
  halt(p, "LudusScene");
  halt(p, "ArenaScene");
  halt(p, "FreedCampScene");
  halt(p, "RaidScene");
  p.start("MenuScene");
}

let returning = false;
let returningCamp = false;

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
    haltManager(sm, "RaidScene");
    haltManager(sm, "FreedCampScene");
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

export function enterFreedCamp(from: Phaser.Scene): void {
  gameState.save.position.scene = "freedcamp";
  gameState.persist();
  const p = from.scene;
  halt(p, "LudusScene");
  halt(p, "ArenaScene");
  halt(p, "RaidScene");
  halt(p, "FreedCampScene");
  if (!p.isActive("UIScene") && !p.isSleeping("UIScene")) p.launch("UIScene");
  p.start("FreedCampScene");
}

export function enterRaid(from: Phaser.Scene): void {
  gameState.save.position.scene = "raid";
  gameState.persist();
  const p = from.scene;
  halt(p, "FreedCampScene");
  halt(p, "LudusScene");
  halt(p, "ArenaScene");
  halt(p, "RaidScene");
  if (!p.isActive("UIScene") && !p.isSleeping("UIScene")) p.launch("UIScene");
  p.start("RaidScene");
}

/** Return from raid to Freed Camp. Farm advances only after a death or a cleared room. */
export function returnFromRaid(game: Phaser.Game, opts?: { death?: boolean }): void {
  gameState.paused = false;
  gameState.inMenu = false;
  gameState.inDialogue = false;
  if (returningCamp) return;
  returningCamp = true;

  const tickFarm = Boolean(opts?.death) || gameState.raidClearedRoomThisOuting;
  const matured = tickFarm ? advanceFarmAfterRaid().matured : 0;
  const foragerMsg = tickFarm ? tryVolunteerForager() : null;
  gameState.pendingRaidHouse = null;
  gameState.pendingRaidRoom = null;
  gameState.raidDownedAllies = [];
  gameState.raidDownedVolunteer = false;
  gameState.raidActiveMeal = null;
  gameState.raidMarchStats = null;
  gameState.raidTempHpBonus = 0;
  gameState.raidClearedRoomThisOuting = false;
  gameState.restoreVitals();
  gameState.save.position.scene = "freedcamp";
  gameState.persist();

  const run = (): void => {
    gameState.paused = false;
    gameState.inMenu = false;
    gameState.inDialogue = false;
    const sm = game.scene;
    haltManager(sm, "RaidScene");
    haltManager(sm, "ArenaScene");
    haltManager(sm, "LudusScene");
    haltManager(sm, "FreedCampScene");
    try {
      if (!sm.isActive("UIScene") && !sm.isSleeping("UIScene")) sm.run("UIScene");
      else if (sm.isSleeping("UIScene") || sm.isPaused("UIScene")) sm.wake("UIScene");
    } catch {
      /* ignore */
    }
    try {
      sm.run("FreedCampScene");
    } catch {
      try {
        sm.start("FreedCampScene");
      } catch {
        /* ignore */
      }
    }
    if (matured > 0) {
      bus.emit("toast", matured === 1 ? "The farm is ready to harvest." : `${matured} farm plots are ready.`);
    }
    if (foragerMsg) bus.emit("toast", foragerMsg);
    if (opts?.death) {
      bus.emit("toast", "You wake at the Freed Camp. Cleared rooms hold. This room reset.");
    }
  };

  window.setTimeout(run, 0);
  window.setTimeout(run, 80);
  window.setTimeout(() => {
    run();
    bus.emit("camp-refresh");
    returningCamp = false;
  }, 200);
}

export function returnToLudusFromCamp(from: Phaser.Scene): void {
  gameState.save.position = {
    x: 2 * TILE_SIZE + TILE_SIZE / 2,
    y: 32 * TILE_SIZE + TILE_SIZE / 2,
    scene: "ludus",
  };
  gameState.persist();
  const p = from.scene;
  halt(p, "FreedCampScene");
  halt(p, "RaidScene");
  halt(p, "ArenaScene");
  if (!p.isActive("UIScene") && !p.isSleeping("UIScene")) p.launch("UIScene");
  p.start("LudusScene");
}
