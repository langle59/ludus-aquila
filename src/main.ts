import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "./game/config";
import { BootScene } from "./game/scenes/BootScene";
import { MenuScene } from "./game/scenes/MenuScene";
import { CharacterCreateScene } from "./game/scenes/CharacterCreateScene";
import { LudusScene } from "./game/scenes/LudusScene";
import { ArenaScene } from "./game/scenes/ArenaScene";
import { FreedCampScene } from "./game/scenes/FreedCampScene";
import { RaidScene } from "./game/scenes/RaidScene";
import { UIScene } from "./game/scenes/UIScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-root",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  backgroundColor: "#1a1210",
  pixelArt: true,
  roundPixels: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    keyboard: true,
  },
  scene: [BootScene, MenuScene, CharacterCreateScene, LudusScene, ArenaScene, FreedCampScene, RaidScene, UIScene],
};

function boot(): void {
  const root = document.getElementById("game-root");
  if (!root) return;
  try {
    const game = new Phaser.Game(config);
    (window as unknown as { __ludusGame: Phaser.Game }).__ludusGame = game;
  } catch (err) {
    root.innerHTML = `<p style="color:#e8dcc8;padding:24px;font-family:Georgia">The game failed to start. Refresh the page. If this keeps happening, check the browser console.</p>`;
    console.error(err);
  }
}

boot();
