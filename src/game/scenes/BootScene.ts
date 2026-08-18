import Phaser from "phaser";
import { generatePlaceholderAssets } from "../systems/assets";
import { preloadBeastSheets } from "../systems/beastAnim";
import { gameState } from "../state/GameState";
import { audio } from "../systems/audio";
import { skipTutorial } from "../systems/objectives";
import { enterLudus } from "../systems/playFlow";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    this.load.image("wolf-src", "beasts/wolf.png");
    this.load.image("serpent-src", "beasts/serpent.png");
    this.load.image("bear-src", "beasts/bear.png");
    this.load.image("lion-src", "beasts/lion.png");
    this.load.image("bull-src", "beasts/bull.png");
    this.load.image("boar-src", "beasts/boar.png");
    this.load.image("eagle-src", "beasts/eagle.png");
    this.load.image("tiger-src", "beasts/tiger.png");
    this.load.image("rhino-src", "beasts/rhino.png");
    this.load.image("elephant-src", "beasts/elephant.png");
    this.load.image("axe-src", "weapons/axe.png");
    this.load.image("hammer-src", "weapons/hammer.png");
    this.load.image("tent-src", "tents/tent.png");
    preloadBeastSheets(this);
    this.load.on("loaderror", () => {
      /* missing beast/tent PNGs fall back to canvas art */
    });
  }

  create(): void {
    generatePlaceholderAssets(this);
    gameState.loadSettings();
    const params = new URLSearchParams(window.location.search);
    const s2 = gameState.peekSlot(2);
    if (params.get("seed2") === "1" || !s2 || s2.playerName === "Tutor") {
      gameState.seedAct3TestSlot(2, { playerName: "Tutor", pledgedHouse: "lupus", palBeastKind: "eagle" });
    }
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
      enterLudus(this);
    };

    this.scene.start("MenuScene");
  }
}
