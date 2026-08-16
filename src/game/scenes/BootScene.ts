import Phaser from "phaser";
import { generatePlaceholderAssets } from "../systems/assets";
import { gameState } from "../state/GameState";
import { audio } from "../systems/audio";
import { skipTutorial } from "../systems/objectives";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.image("wolf-src", "beasts/wolf.png");
    this.load.image("fox-src", "beasts/fox.png");
    this.load.image("serpent-src", "beasts/serpent.png");
    this.load.image("bear-src", "beasts/bear.png");
    this.load.image("lion-src", "beasts/lion.png");
    this.load.image("bull-src", "beasts/bull.png");
    this.load.image("boar-src", "beasts/boar.png");
    this.load.image("raven-src", "beasts/raven.png");
    this.load.image("eagle-src", "beasts/eagle.png");
    this.load.image("tiger-src", "beasts/tiger.png");
    this.load.image("axe-src", "weapons/axe.png");
    this.load.image("hammer-src", "weapons/hammer.png");
    this.load.on("loaderror", () => {
      /* missing beast PNGs fall back to canvas art */
    });
  }

  create(): void {
    generatePlaceholderAssets(this);
    gameState.loadSettings();
    audio.startMusic();
    const debug = new URLSearchParams(window.location.search).get("debug") === "1";
    this.registry.set("debug", debug);
    this.game.canvas.setAttribute("tabindex", "0");
    this.game.canvas.focus();

    const w = window as unknown as {
      __ludusStart?: (skip?: boolean) => void;
    };
    w.__ludusStart = (skip = false) => {
      gameState.setActiveSlot(1);
      gameState.startNew("Valens", "crimson");
      if (skip) skipTutorial();
      const mgr = this.scene.manager;
      mgr.stop("MenuScene");
      mgr.stop("CharacterCreateScene");
      mgr.start("LudusScene");
      mgr.start("UIScene");
    };

    this.scene.start("MenuScene");
  }
}
