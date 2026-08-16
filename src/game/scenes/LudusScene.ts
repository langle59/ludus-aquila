import Phaser from "phaser";
import { TILE_SIZE, HUD_CAM_PAD } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { audio } from "../systems/audio";
import { paintMap, labelMap, animateFountain, animateTrough } from "../systems/worldRender";
import { buildLudus, LUDUS_META } from "../maps/maps";
import { Fighter, attachHpBar } from "../entities/Fighter";
import { NpcActor, TrainingDummy, WorldProp } from "../entities/World";
import { playerLook } from "../data/shop";
import { CombatAI } from "../systems/ai";
import { resolveHits, dummyStrikeFeedback } from "../systems/combat";
import { DIALOGUE } from "../data/dialogue";
import { getNpc, HOUSE_GLADIATORS, LANISTA } from "../data/gladiators";
import { markTutorial, skipTutorial } from "../systems/objectives";
import { applySparReward, applyDummyXp, pledgedHouse, playerCombatStats, rivalHouses } from "../systems/progression";
import { palCombatStats, palDisplayName, palTexture, palUnlocked } from "../data/pal";
import { getHouse } from "../data/houses";
import { bodyStyleFor } from "../systems/assets";
import { CombatInput } from "../systems/input";
import { ensureNight, rufusAtTable } from "../systems/nights";

function mixTint(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255;
  const ag = (a >> 8) & 255;
  const ab = a & 255;
  const br = (b >> 16) & 255;
  const bg = (b >> 8) & 255;
  const bb = b & 255;
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return (r << 16) | (g << 8) | bl;
}

export class LudusScene extends Phaser.Scene {
  private player!: Fighter;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private npcs: NpcActor[] = [];
  private dummies: TrainingDummy[] = [];
  private combat!: CombatInput;
  private blockingHeld = false;
  private interactables: { kind: string; x: number; y: number; id?: string }[] = [];
  private palSprite?: Phaser.GameObjects.Image;
  private palNameTag?: Phaser.GameObjects.Text;
  private palShadow?: Phaser.GameObjects.Image;
  private roostGfx: Phaser.GameObjects.GameObject[] = [];
  private palHome = { x: 0, y: 0 };
  private roostIdleArmed = false;
  private nearestHint?: Phaser.GameObjects.Text;
  private sparring: { enemy: Fighter; ai: CombatAI; npcId: string } | null = null;
  private hiddenNpc?: NpcActor;
  private awaitingSpar: string | null = null;
  private dummyCapTold = false;
  private built = buildLudus();
  private trophyGfx: Phaser.GameObjects.GameObject[] = [];
  private tableLock?: Phaser.GameObjects.Image;

  constructor() {
    super("LudusScene");
  }

  create(): void {
    this.solids = paintMap(this, this.built, "ludus");
    labelMap(this, LUDUS_META.labels);
    this.cameras.main.setBounds(0, -HUD_CAM_PAD, this.built.cols * TILE_SIZE, this.built.rows * TILE_SIZE + HUD_CAM_PAD);
    this.cameras.main.setZoom(1);

    const spawn = gameState.save.position.x
      ? { x: gameState.save.position.x, y: gameState.save.position.y }
      : this.built.spawns.player;

    const look = playerLook();
    this.player = new Fighter(this, spawn.x, spawn.y, {
      key: "player",
      tunic: look.tunic,
      accent: look.accent,
      style: look.style,
      cape: look.cape,
      scar: look.scar,
      crest: look.crest,
      stats: { ...playerCombatStats() },
      weapon: gameState.save.equippedWeapon,
      team: "player",
    });
    this.player.health = gameState.save.health;
    this.player.stamina = gameState.save.stamina;
    this.physics.add.collider(this.player, this.solids);

    this.spawnNpcs();
    this.spawnProps();
    this.refreshRoost();
    this.refreshHall();
    if (gameState.save.freedomWon) ensureNight();

    this.nearestHint = this.add
      .text(0, 0, "", { fontFamily: "Georgia", fontSize: "14px", color: "#d4a84b", stroke: "#1a1210", strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(3000)
      .setVisible(false);

    const kb = this.input.keyboard!;
    this.combat = new CombatInput(this);
    kb.addCapture([Phaser.Input.Keyboard.KeyCodes.SPACE]);
    this.game.canvas.focus();

    this.events.on("wake", () => {
      gameState.paused = false;
      gameState.inMenu = false;
      gameState.inDialogue = false;
      this.physics.world.resume();
      const body = this.player.body as Phaser.Physics.Arcade.Body | undefined;
      if (body) {
        body.enable = true;
        body.setVelocity(0, 0);
      }
      this.player.setWeapon(gameState.save.equippedWeapon);
      this.player.stats = { ...playerCombatStats() };
      this.player.revive(true);
      gameState.restoreVitals();
      bus.emit("minimap-scene", "ludus");
      this.refreshHall();
      this.refreshRoost();
      if (gameState.save.freedomWon) ensureNight();
      if (gameState.save.freedomWon && !gameState.save.dialogueFlags.freedomSpeech) {
        gameState.save.dialogueFlags.freedomSpeech = true;
        gameState.persist();
        this.time.delayedCall(400, () => {
          bus.emit("dialogue", { name: LANISTA.name, lines: DIALOGUE.lanista() });
        });
      }
    });

    bus.on("weapon-changed", this.onWeapon, this);
    bus.on("enter-arena", this.goArena, this);
    bus.on("result-closed", this.afterResult, this);
    bus.on("player-attack", this.doAttack, this);
    bus.on("player-special", this.doSpecial, this);
    bus.on("player-interact", this.tryInteract, this);
    bus.on("player-spar", this.onSparRequest, this);
    bus.on("player-yield", this.onYield, this);
    bus.on("skills-changed", this.onSkillsChanged, this);
    bus.on("cosmetics-changed", this.onCosmeticsChanged, this);
    bus.on("roost-changed", this.onRoostChanged, this);

    this.events.on("shutdown", () => {
      bus.off("weapon-changed", this.onWeapon, this);
      bus.off("enter-arena", this.goArena, this);
      bus.off("result-closed", this.afterResult, this);
      bus.off("player-attack", this.doAttack, this);
      bus.off("player-special", this.doSpecial, this);
      bus.off("player-interact", this.tryInteract, this);
      bus.off("player-spar", this.onSparRequest, this);
      bus.off("player-yield", this.onYield, this);
      bus.off("skills-changed", this.onSkillsChanged, this);
      bus.off("cosmetics-changed", this.onCosmeticsChanged, this);
      bus.off("roost-changed", this.onRoostChanged, this);
      bus.emit("spar-available", { show: false });
      bus.emit("talk-available", { show: false });
      bus.emit("minimap-scene", "none");
      audio.setHall(false);
    });

    this.setupDebug();
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    if (!this.scene.isActive("UIScene")) this.scene.launch("UIScene");
    this.game.canvas.setAttribute("tabindex", "0");
    this.game.canvas.focus();
    bus.emit("minimap-scene", "ludus");
  }

  private doAttack = (kind: unknown = "light"): void => {
    if (this.blocked() || !this.sys.isActive()) return;
    const used = this.player.tryAttack(kind === "heavy" ? "heavy" : "light");
    if (used && this.player.stamina < this.player.stats.maxStamina * 0.75) markTutorial("staminaDip");
  };

  private doSpecial = (): void => {
    if (this.blocked() || !this.sys.isActive()) return;
    this.player.trySpecial();
  };

  private blocked(): boolean {
    return gameState.paused || gameState.inDialogue || gameState.inMenu || Boolean(this.sparring && false);
  }

  private uiLocked(): boolean {
    return gameState.paused || gameState.inDialogue || gameState.inMenu;
  }

  private spawnNpcs(): void {
    const list = [LANISTA, ...HOUSE_GLADIATORS];
    const house = pledgedHouse();
    for (const def of list) {
      const pos = this.built.spawns[def.id];
      if (!pos) continue;
      const tunic =
        house && def.role === "friend"
          ? mixTint(def.color, house.colors.primary, 0.42)
          : def.color;
      const npc = new NpcActor(this, pos.x, pos.y, def.id, def.name, tunic, def.accent, def.scale);
      this.physics.add.collider(this.player, npc);
      this.npcs.push(npc);
      this.interactables.push({ kind: "npc", x: pos.x, y: pos.y, id: def.id });
    }
  }

  private spawnProps(): void {
    for (const p of this.built.props) {
      if (p.kind === "dummy") {
        const d = new TrainingDummy(this, p.x, p.y);
        this.dummies.push(d);
        this.physics.add.collider(this.player, d);
        this.interactables.push({ kind: "dummy", x: p.x, y: p.y });
      } else if (p.kind === "rack") {
        const rack = new WorldProp(this, p.x, p.y, "rack", "prop-rack", true);
        this.physics.add.collider(this.player, rack);
        this.interactables.push({ kind: "rack", x: p.x, y: p.y });
      } else if (p.kind === "gate") {
        const footY = p.y + TILE_SIZE / 2;
        const span = 64;
        for (const dx of [-span, span]) {
          const post = this.physics.add.staticImage(p.x + dx, footY, "prop-gate-post");
          post.setOrigin(0.5, 1);
          post.setDepth(footY);
          const body = post.body as Phaser.Physics.Arcade.StaticBody;
          body.setSize(18, 14);
          body.setOffset(9, 66);
          post.refreshBody();
          this.physics.add.collider(this.player, post);
        }
        this.add.image(p.x, footY - 62, "prop-gate-arch").setOrigin(0.5, 1).setDepth(footY + 80);
        this.interactables.push({ kind: "gate", x: p.x, y: p.y });
      } else if (p.kind === "fountain") {
        const f = new WorldProp(this, p.x, p.y, "fountain", "prop-fountain", true);
        this.physics.add.collider(this.player, f);
        animateFountain(this, p.x, p.y);
      } else if (p.kind === "crate") {
        const c = new WorldProp(this, p.x, p.y, "crate", "prop-crate", true);
        this.physics.add.collider(this.player, c);
      } else if (p.kind === "anvil") {
        const a = new WorldProp(this, p.x, p.y, "anvil", "prop-anvil", true);
        this.physics.add.collider(this.player, a);
      } else if (p.kind === "barrel") {
        const b = new WorldProp(this, p.x, p.y, "barrel", "prop-barrel", true);
        this.physics.add.collider(this.player, b);
      } else if (p.kind === "bed") {
        const bed = new WorldProp(this, p.x, p.y, "bed", "prop-bed", true);
        this.physics.add.collider(this.player, bed);
      } else if (p.kind === "chest") {
        const chest = new WorldProp(this, p.x, p.y, "chest", "prop-chest", true);
        this.physics.add.collider(this.player, chest);
      } else if (p.kind === "shieldstand") {
        const sh = new WorldProp(this, p.x, p.y, "shieldstand", "prop-shieldstand", true);
        this.physics.add.collider(this.player, sh);
      } else if (p.kind === "hay") {
        this.add.image(p.x, p.y, "prop-hay").setDepth(2);
      } else if (p.kind === "perch") {
        const perch = new WorldProp(this, p.x, p.y + 4, "perch", "prop-perch", true);
        this.physics.add.collider(this.player, perch);
      } else if (p.kind === "nest") {
        this.add.image(p.x, p.y + 6, "prop-nest").setDepth(2);
      } else if (p.kind === "bowl") {
        this.add.image(p.x, p.y + 4, "prop-feed-bowl").setDepth(p.y + 2);
      } else if (p.kind === "trough") {
        const trough = new WorldProp(this, p.x, p.y, "trough", "prop-trough", true);
        this.physics.add.collider(this.player, trough);
        animateTrough(this, p.x, p.y);
      } else if (p.kind === "hook") {
        this.add.image(p.x, p.y - 8, "prop-collar-hook").setDepth(p.y);
      } else if (p.kind === "bench") {
        const b = new WorldProp(this, p.x, p.y, "bench", "prop-bench", true);
        this.physics.add.collider(this.player, b);
      } else if (p.kind === "shop") {
        const stall = new WorldProp(this, p.x, p.y, "shop", "prop-stall", true);
        this.physics.add.collider(this.player, stall);
        this.interactables.push({ kind: "shop", x: p.x, y: p.y });
      } else if (p.kind === "dice") {
        const table = new WorldProp(this, p.x, p.y, "dice", "prop-dice-table", true);
        this.physics.add.collider(this.player, table);
        this.interactables.push({ kind: "dice", x: p.x, y: p.y });
        this.tableLock = this.add.image(p.x, p.y - 6, "prop-dice-lock").setDepth(p.y + 1);
      }
    }
  }

  private hallSlotCols(count: number): number[] {
    if (count >= 4) return [37, 40, 43, 45];
    if (count === 3) return [38, 41, 44];
    if (count === 2) return [39, 43];
    if (count === 1) return [41];
    return [];
  }

  private refreshHall(): void {
    for (const g of this.trophyGfx) g.destroy();
    this.trophyGfx = [];
    this.interactables = this.interactables.filter((it) => it.kind !== "trophy");
    this.tableLock?.setVisible(!gameState.save.freedomWon);
    this.seatRufus();

    const houses = rivalHouses();
    const north = houses.slice(0, 4);
    const south = houses.slice(4);
    const place = (houseList: typeof houses, cols: number[], row: number) => {
      houseList.forEach((house, i) => {
        const col = cols[i];
        if (col == null) return;
        const x = col * TILE_SIZE + TILE_SIZE / 2;
        const y = row * TILE_SIZE + TILE_SIZE / 2;
        const beaten = gameState.save.defeatedHouses.includes(house.id);
        const plaque = this.add.image(x, y - 2, "prop-trophy-empty").setDepth(y);
        this.trophyGfx.push(plaque);
        if (beaten) {
          const banner = this.add.image(x, y - 22, "prop-trophy-banner").setDepth(y - 1).setTint(house.colors.primary);
          this.trophyGfx.push(banner);
          const kind = house.beastKind ?? "eagle";
          const tex = `trophy-skel-${kind}`;
          if (this.textures.exists(tex)) {
            const head = this.add.image(x, y - 8, tex).setDepth(y + 1);
            this.trophyGfx.push(head);
          }
          const tag = this.add
            .text(x, y + 16, house.animalName, {
              fontFamily: "Cinzel, Georgia",
              fontSize: "9px",
              color: "#e8c96a",
              stroke: "#1a1210",
              strokeThickness: 3,
            })
            .setOrigin(0.5)
            .setDepth(y + 2);
          this.trophyGfx.push(tag);
        }
        this.interactables.push({ kind: "trophy", x, y, id: house.id });
      });
    };
    place(north, this.hallSlotCols(north.length), 15);
    place(south, this.hallSlotCols(south.length), 20);
  }

  private seatRufus(): void {
    const npc = this.npcs.find((n) => n.npcId === "rufus");
    const hall = this.built.spawns.rufusHall;
    const yard = this.built.spawns.rufus;
    if (!npc || !hall || !yard) return;
    const pos = rufusAtTable() ? hall : yard;
    npc.place(pos.x, pos.y);
    const it = this.interactables.find((item) => item.kind === "npc" && item.id === "rufus");
    if (it) {
      it.x = pos.x;
      it.y = pos.y;
    }
  }

  private npcCanSpar(id: string): boolean {
    if (id === "rufus" && rufusAtTable()) return false;
    return getNpc(id).canSpar;
  }

  private clearRoostGfx(): void {
    for (const g of this.roostGfx) g.destroy();
    this.roostGfx = [];
    this.palSprite = undefined;
    this.palNameTag = undefined;
    this.palShadow = undefined;
  }

  private refreshRoost(): void {
    const pos = this.built.spawns.pal;
    if (!pos) return;
    this.palHome = { x: pos.x, y: pos.y };
    this.clearRoostGfx();
    this.interactables = this.interactables.filter((it) => it.kind !== "pal");
    this.interactables.push({ kind: "pal", x: pos.x, y: pos.y });

    const home = palUnlocked();
    const stats = home ? palCombatStats() : null;

    const nestGlow = this.add.image(pos.x, pos.y - 4, "fx-glow").setDepth(3).setAlpha(0.22).setScale(0.7).setBlendMode(Phaser.BlendModes.ADD);
    this.roostGfx.push(nestGlow);
    this.tweens.add({
      targets: nestGlow,
      alpha: { from: 0.12, to: 0.28 },
      scale: { from: 0.6, to: 0.85 },
      duration: 1400,
      yoyo: true,
      repeat: -1,
    });

    if (home && stats) {
      const shadow = this.add.image(pos.x, pos.y + 10, "char-shadow").setDepth(1).setScale(0.85);
      this.palShadow = shadow;
      this.roostGfx.push(shadow);
      const img = this.add.image(pos.x, pos.y - 14, palTexture()).setDepth(pos.y).setScale(stats.visScale);
      if (stats.tint) img.setTint(stats.tint);
      this.palSprite = img;
      this.roostGfx.push(img);
      this.tweens.add({
        targets: img,
        y: pos.y - 20,
        duration: 980,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
      const tag = this.add
        .text(pos.x, pos.y - 42, palDisplayName(), {
          fontFamily: "Cinzel, Georgia",
          fontSize: "11px",
          color: "#e8c96a",
          stroke: "#1a1210",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(pos.y + 2);
      this.palNameTag = tag;
      this.roostGfx.push(tag);
    } else {
      const tag = this.add
        .text(pos.x, pos.y - 28, "Empty perch", {
          fontFamily: "Cinzel, Georgia",
          fontSize: "11px",
          color: "#8a7a68",
          stroke: "#1a1210",
          strokeThickness: 4,
        })
        .setOrigin(0.5)
        .setDepth(pos.y + 2);
      this.palNameTag = tag;
      this.roostGfx.push(tag);
    }

    if (!this.roostIdleArmed) {
      this.roostIdleArmed = true;
      this.time.addEvent({
        delay: 2600,
        loop: true,
        callback: () => this.roostIdle(),
      });
    }
  }

  private roostIdle(): void {
    const pos = this.palHome;
    if (this.palSprite?.active) {
      const near = this.player && Phaser.Math.Distance.Between(this.player.x, this.player.y, pos.x, pos.y) < 96;
      if (!near && Math.random() < 0.45) this.palSprite.setFlipX(!this.palSprite.flipX);
      if (Math.random() < 0.35) {
        const hop = this.palSprite;
        this.tweens.add({
          targets: hop,
          x: pos.x + Phaser.Math.Between(-6, 6),
          duration: 180,
          yoyo: true,
          ease: "Sine.easeOut",
        });
      }
    }
    for (let i = 0; i < 3; i++) {
      const bit = this.add
        .image(pos.x + Phaser.Math.Between(-18, 18), pos.y + Phaser.Math.Between(-4, 8), "fx-mote")
        .setDepth(pos.y + 3)
        .setTint(0xc4a66e)
        .setAlpha(0.55)
        .setScale(0.8);
      this.tweens.add({
        targets: bit,
        y: bit.y - 16,
        alpha: 0,
        duration: 520,
        onComplete: () => bit.destroy(),
      });
    }
  }

  private nearest(): { kind: string; x: number; y: number; id?: string; dist: number } | null {
    let best: { kind: string; x: number; y: number; id?: string; dist: number } | null = null;
    for (const it of this.interactables) {
      const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (dist < 70 && (!best || dist < best.dist)) best = { ...it, dist };
    }
    return best;
  }

  private tryInteract(): void {
    if (this.uiLocked()) return;
    if (this.sparring) return;
    const n = this.nearest();
    if (!n) return;
    if (n.kind === "rack") {
      markTutorial("equippedWeapon");
      bus.emit("armory");
      return;
    }
    if (n.kind === "shop") {
      bus.emit("shop");
      return;
    }
    if (n.kind === "pal") {
      bus.emit("roost");
      return;
    }
    if (n.kind === "trophy") {
      const house = n.id ? getHouse(n.id) : undefined;
      const animal = house?.animalName ?? "beast";
      const beaten = n.id ? gameState.save.defeatedHouses.includes(n.id) : false;
      if (beaten && house) {
        bus.emit("dialogue", {
          name: house.latinName,
          lines: [`The ${animal} hangs here. You took their champion.`],
        });
      } else {
        bus.emit("dialogue", {
          name: "Empty hook",
          lines: [`The hook waits. Beat the ${animal} champion.`],
        });
      }
      return;
    }
    if (n.kind === "dice") {
      if (!gameState.save.freedomWon) {
        bus.emit("dialogue", {
          name: "Gambling Table",
          lines: ["The lanista keeps this shut. Free men gamble. You are not free."],
        });
        return;
      }
      bus.emit("table");
      return;
    }
    if (n.kind === "gate") {
      if (!gameState.save.tutorialComplete) {
        bus.emit("dialogue", {
          name: "Arena Gate",
          lines: ["The gate is barred until Marcellus says you are ready."],
        });
        return;
      }
      bus.emit("gate");
      return;
    }
    if (n.kind === "npc" && n.id) {
      const def = getNpc(n.id);
      const lines = DIALOGUE[n.id]?.() ?? [`${def.name} nods.`];
      bus.emit("dialogue", {
        name: def.name,
        lines,
        onDone: () => {
          if (n.id === "lanista") {
            markTutorial("metLanista");
            if (
              gameState.save.tutorialFlags.sparred &&
              !gameState.save.tutorialComplete
            ) {
              markTutorial("readyForArena");
            }
          }
          if (n.id && this.npcCanSpar(n.id)) {
            this.awaitingSpar = n.id ?? null;
            bus.emit("toast", "Click SPAR to start a match");
            bus.emit("spar-available", { show: true, yield: false });
          }
        },
      });
    }
  }

  private onSparRequest = (): void => {
    if (this.uiLocked() || this.sparring) return;
    const n = this.nearest();
    if (n?.kind === "npc" && n.id && this.npcCanSpar(n.id)) {
      this.startSpar(n.id);
      return;
    }
    const nearby = this.npcs.find((npc) => {
      if (!this.npcCanSpar(npc.npcId)) return false;
      return Phaser.Math.Distance.Between(this.player.x, this.player.y, npc.x, npc.y) < 90;
    });
    if (nearby) this.startSpar(nearby.npcId);
    else bus.emit("toast", "Stand next to Titus or Rufus first");
  };

  private onYield = (): void => {
    if (this.sparring) this.endSpar(false);
  };

  private startSpar(id: string): void {
    this.awaitingSpar = null;
    const def = getNpc(id);
    const npc = this.npcs.find((n) => n.npcId === id);
    if (npc) {
      npc.disableBody(true, false);
      npc.visual.setVisible(false);
      npc.label.setVisible(false);
      npc.setPrompt(false);
      this.hiddenNpc = npc;
    }
    const ring = this.built.spawns.dummy;
    this.player.setPosition(ring.x, ring.y + 36);
    this.player.setVelocity(0, 0);
    this.player.facing.set(0, -1);
    const enemy = new Fighter(this, ring.x, ring.y - 28, {
      key: `spar-${id}-${Date.now()}`,
      tunic: def.color,
      accent: def.accent,
      scale: def.scale,
      stats: { ...def.stats, maxHealth: Math.min(def.stats.maxHealth, 48), attack: Math.max(5, def.stats.attack - 2) },
      weapon: def.weapon,
      team: "enemy",
      speed: 95 + def.stats.agility * 3,
      style: bodyStyleFor(id),
    });
    enemy.health = enemy.stats.maxHealth;
    enemy.facing.set(0, 1);
    enemy.setWeapon(def.weapon);
    this.physics.add.collider(enemy, this.solids);
    this.physics.add.collider(this.player, enemy);
    const ai = new CombatAI(enemy, def.aiStyle === "defensive" ? "sparring" : def.aiStyle);
    attachHpBar(this, enemy, def.name);
    this.sparring = { enemy, ai, npcId: id };
    bus.emit("spar-available", { show: true, yield: true });
    bus.emit("toast", `Sparring vs ${def.name} — attack until someone falls`);
  }

  private endSpar(playerWon: boolean): void {
    if (!this.sparring) return;
    const { enemy, ai, npcId } = this.sparring;
    ai.destroy();
    enemy.destroy();
    this.sparring = null;
    if (this.hiddenNpc) {
      this.hiddenNpc.enableBody(true, this.hiddenNpc.x, this.hiddenNpc.y, true, false);
      this.hiddenNpc.visual.setVisible(true);
      this.hiddenNpc.label.setVisible(true);
      this.hiddenNpc = undefined;
    }
    this.player.revive(true);
    gameState.restoreVitals();
    bus.emit("spar-available", { show: false });
    const reward = applySparReward(npcId, playerWon);
    markTutorial("sparred");
    bus.emit("result", {
      title: playerWon ? "Spar won" : "Spar lost",
      body: playerWon
        ? `${getNpc(npcId).name} yields.\n+${reward.xp} XP  ·  +${reward.denarii} denarii\nNo one is hurt. That is the point of the yard.`
        : `${getNpc(npcId).name} stops the match.\nYou learn something anyway.\n+${reward.xp} XP`,
    });
  }

  private afterResult = (): void => {
    /* overlay closed */
  };

  private onCosmeticsChanged = (): void => {
    const look = playerLook();
    this.player.applyLook(look.tunic, look.accent, look.style, look.cape, look.scar, look.crest);
  };

  private onRoostChanged = (): void => {
    this.refreshRoost();
  };

  private onSkillsChanged = (): void => {
    this.player.refreshSkills();
    this.player.health = gameState.save.health;
    this.player.stamina = gameState.save.stamina;
  };

  private onWeapon = (id: string): void => {
    this.player.setWeapon(id as typeof this.player.weaponId);
    markTutorial("equippedWeapon");
  };

  private goArena = (): void => {
    gameState.save.position = { x: this.player.x, y: this.player.y, scene: "ludus" };
    gameState.persist();
    bus.emit("minimap-scene", "none");
    audio.setHall(false);
    this.scene.sleep();
    this.scene.launch("ArenaScene");
  };

  update(_t: number, delta: number): void {
    if (!this.player) return;
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    audio.setHall(tx >= 35 && tx <= 46 && ty >= 14 && ty <= 21);
    if (this.uiLocked()) {
      this.player.setVelocity(0, 0);
      this.player.syncVisuals(this.time.now);
      return;
    }

    const move = this.combat.moveVector();
    const speed = this.player.moveSpeed;
    this.player.tryMove(move.x * speed, move.y * speed);
    if (this.combat.justPressed("attack")) this.doAttack("light");
    if (this.combat.justPressed("heavy")) this.doAttack("heavy");
    if (this.combat.justPressed("interact")) this.tryInteract();
    if (this.combat.justPressed("dodge")) {
      if (this.player.tryDodge()) markTutorial("dodged");
    }
    if (this.combat.justPressed("special")) this.player.trySpecial();
    if (this.combat.justPressed("parry")) this.player.tryParry();
    if (this.combat.justPressed("unguent")) this.player.tryUnguent();
    const block = this.combat.pollBlock();
    if (block === "start") {
      this.blockingHeld = true;
      this.player.setBlocking(true);
      if (this.player.blocking) markTutorial("blocked");
    } else if (block === "end") {
      this.blockingHeld = false;
      this.player.setBlocking(false);
    }
    if (this.blockingHeld) this.player.setBlocking(true);
    this.player.regen(delta);
    audio.footstep(delta, Boolean(move.x || move.y));

    if (this.player.hitboxActive) {
      for (const d of this.dummies) {
        const c = this.player.attackCenter();
        if (Phaser.Math.Distance.Between(c.x, c.y, d.x, d.y) < this.player.attackRadius() + 12) {
          d.bonk();
          dummyStrikeFeedback(this, d.x, d.y);
          this.player.hitboxActive = false;
          this.player.registerCombo();
          markTutorial("hitDummy");
          if (gameState.save.tutorialFlags.dodged && !gameState.save.tutorialFlags.perfectDodgeHint) {
            gameState.setFlag("perfectDodgeHint");
            gameState.persist();
            bus.emit("toast", "Shift through a strike for a perfect dodge.");
          }
          const gained = applyDummyXp();
          if (gained.xp > 0) {
            this.dummyCapTold = false;
            const t = this.add
              .text(d.x, d.y - 28, `+${gained.xp} XP`, {
                fontFamily: "Cinzel, Georgia",
                fontSize: "14px",
                color: "#8ecf6a",
                stroke: "#1a1210",
                strokeThickness: 4,
              })
              .setOrigin(0.5)
              .setDepth(4000);
            this.tweens.add({
              targets: t,
              y: t.y - 22,
              alpha: 0,
              duration: 700,
              onComplete: () => t.destroy(),
            });
          } else if (!this.dummyCapTold) {
            this.dummyCapTold = true;
            bus.emit("toast", "The dummy has nothing more to teach until you grow stronger.");
          }
        }
      }
      if (this.sparring) resolveHits(this.player, [this.sparring.enemy]);
    }

    this.player.updateNet(this.sparring ? [this.sparring.enemy] : [], delta);
    if (this.sparring) this.sparring.enemy.updateNet([this.player], delta);

    if (this.sparring) {
      this.sparring.ai.update(this.player, this.time.now);
      this.sparring.enemy.syncVisuals(this.time.now);
      if (this.sparring.enemy.hitboxActive) resolveHits(this.sparring.enemy, [this.player]);
      if (!this.player.alive) {
        this.endSpar(false);
        return;
      }
      if (!this.sparring.enemy.alive) {
        this.endSpar(true);
        return;
      }
    }

    this.player.syncVisuals(this.time.now);
    this.npcs.forEach((npc) => {
      if (npc.visual.visible) npc.visual.setFlipX(this.player.x < npc.x);
    });
    if (this.palSprite?.active) {
      const near = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.palHome.x, this.palHome.y) < 96;
      if (near) this.palSprite.setFlipX(this.player.x < this.palSprite.x);
    }
    gameState.save.health = this.player.health;
    gameState.save.stamina = this.player.stamina;
    gameState.save.stats = { ...this.player.stats, ...gameState.save.stats };
    this.player.stats.maxHealth = gameState.save.stats.maxHealth;
    this.player.stats.maxStamina = gameState.save.stats.maxStamina;
    this.player.stats.attack = gameState.save.stats.attack;
    this.player.stats.defense = gameState.save.stats.defense;
    this.player.stats.agility = gameState.save.stats.agility;
    this.emitMinimap();

    const n = this.nearest();
    if (gameState.paused || gameState.inMenu) {
      /* keep combat UI from covering result / pause screens */
    } else if (this.sparring) {
      bus.emit("spar-available", { show: true, yield: true });
      bus.emit("talk-available", { show: false });
    } else if (n?.kind === "npc" && n.id && this.npcCanSpar(n.id)) {
      bus.emit("spar-available", { show: true, yield: false });
    } else {
      bus.emit("spar-available", { show: false });
    }
    if (n && !this.sparring && !gameState.paused && !gameState.inMenu) {
      const talkLabel =
        n.kind === "rack"
          ? "ARMORY"
          : n.kind === "gate"
            ? "ARENA"
            : n.kind === "shop"
              ? "QUARTERS"
              : n.kind === "pal"
                ? "ROOST"
                : n.kind === "trophy"
                  ? "MOUNT"
                  : n.kind === "dice"
                    ? gameState.save.freedomWon
                      ? "TABLE"
                      : "LOCKED"
                    : "TALK";
      bus.emit("talk-available", { show: true, label: talkLabel });
      this.nearestHint!.setVisible(true).setPosition(this.player.x, this.player.y + 28);
      const canSpar = n.kind === "npc" && n.id ? this.npcCanSpar(n.id) : false;
      const label =
        n.kind === "npc"
          ? canSpar
            ? "E Talk   or click SPAR"
            : "E  Talk"
          : n.kind === "rack"
            ? "E  Armory"
            : n.kind === "gate"
              ? "E  Arena"
              : n.kind === "shop"
                ? "E  Quarters"
                : n.kind === "pal"
                  ? "E  Roost"
                  : n.kind === "trophy"
                    ? "E  Inspect"
                    : n.kind === "dice"
                      ? gameState.save.freedomWon
                        ? "E  Table"
                        : "E  Locked"
                      : "";
      this.nearestHint!.setText(label);
      this.npcs.forEach((npc) => npc.setPrompt(n.id === npc.npcId, this.npcCanSpar(npc.npcId) ? "SPAR / E" : "E  Talk"));
    } else {
      if (!this.sparring && (gameState.paused || gameState.inMenu || !n)) {
        bus.emit("talk-available", { show: false });
      }
      this.nearestHint!.setVisible(false);
      this.npcs.forEach((npc) => npc.setPrompt(false));
    }
  }

  private emitMinimap(): void {
    const marks: { x: number; y: number; color: number; kind: string }[] = [];
    const sp = this.built.spawns;
    if (sp.lanista) marks.push({ x: sp.lanista.x, y: sp.lanista.y, color: 0xd4a84b, kind: "lanista" });
    for (const npc of this.npcs) {
      if (npc.visual.visible) marks.push({ x: npc.x, y: npc.y, color: 0x7ab8a4, kind: "npc" });
    }
    for (const it of this.interactables) {
      if (it.kind === "rack") marks.push({ x: it.x, y: it.y, color: 0xe07060, kind: "armory" });
      if (it.kind === "shop") marks.push({ x: it.x, y: it.y, color: 0xe8c96a, kind: "shop" });
      if (it.kind === "pal") marks.push({ x: it.x, y: it.y, color: 0xe8c96a, kind: "pal" });
      if (it.kind === "gate") marks.push({ x: it.x, y: it.y, color: 0xc45a1a, kind: "gate" });
      if (it.kind === "trophy") marks.push({ x: it.x, y: it.y, color: 0xc4a060, kind: "trophy" });
      if (it.kind === "dice") marks.push({ x: it.x, y: it.y, color: 0xd4a84b, kind: "dice" });
    }
    bus.emit("minimap", {
      show: true,
      cols: this.built.cols,
      rows: this.built.rows,
      playerX: this.player.x,
      playerY: this.player.y,
      marks,
    });
  }

  private setupDebug(): void {
    if (!this.registry.get("debug")) return;
    const kb = this.input.keyboard!;
    kb.on("keydown-F2", () => {
      this.player.revive(true);
      gameState.restoreVitals();
      bus.emit("toast", "Health restored");
    });
    kb.on("keydown-F3", () => {
      gameState.save.denarii += 100;
      bus.emit("toast", "+100 denarii");
    });
    kb.on("keydown-F4", () => {
      gameState.unlockWeapon("spear");
      gameState.unlockWeapon("dual_blades");
      gameState.unlockWeapon("securis");
      gameState.unlockWeapon("trident_net");
      gameState.unlockWeapon("malleus");
      bus.emit("toast", "Weapons unlocked");
    });
    kb.on("keydown-F5", () => {
      skipTutorial();
      bus.emit("toast", "Tutorial skipped");
    });
    kb.on("keydown-F6", () => {
      skipTutorial();
      gameState.pendingArenaOpponent = rivalHouses()[0]?.fighters[0]?.id ?? "serp_1";
      this.goArena();
    });
    kb.on("keydown-F7", () => {
      skipTutorial();
      const first = rivalHouses()[0];
      if (first) {
        gameState.save.defeatedHouses = [first.id];
        gameState.save.defeatedOpponents = first.fighters.map((f) => f.id);
        gameState.unlockWeapon("spear");
        gameState.unlockWeapon("dual_blades");
        gameState.unlockWeapon("securis");
        gameState.save.palUnlocked = true;
        gameState.save.palBrought = true;
        gameState.setObjective("next_house");
        gameState.persist();
        this.refreshRoost();
        this.refreshHall();
        bus.emit("toast", `${first.animalName} beaten — next house open`);
      }
    });
    kb.on("keydown-F8", () => {
      skipTutorial();
      const houses = rivalHouses();
      gameState.save.defeatedHouses = houses.map((h) => h.id);
      gameState.save.defeatedOpponents = houses.flatMap((h) => h.fighters.map((f) => f.id));
      gameState.unlockWeapon("spear");
      gameState.unlockWeapon("dual_blades");
      gameState.unlockWeapon("securis");
      gameState.unlockWeapon("trident_net");
      gameState.unlockWeapon("malleus");
      gameState.save.palUnlocked = true;
      gameState.save.palBrought = true;
      gameState.setObjective("tournament_1");
      gameState.persist();
      this.refreshRoost();
      this.refreshHall();
      bus.emit("toast", "Circuit beaten — Rudis open");
    });
    this.add
      .text(8, 80, "DEBUG F2 HP  F3 coin  F4 wep  F5 skip  F6 arena  F7 next house  F8 rudis", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#6a5a4a",
      })
      .setScrollFactor(0)
      .setDepth(50);
  }
}
