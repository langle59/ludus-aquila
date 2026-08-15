import Phaser from "phaser";
import { TILE_SIZE } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { audio } from "../systems/audio";
import { paintMap, labelMap, animateFountain } from "../systems/worldRender";
import { buildLudus, LUDUS_META } from "../maps/maps";
import { Fighter, attachHpBar } from "../entities/Fighter";
import { NpcActor, TrainingDummy, WorldProp } from "../entities/World";
import { playerLook } from "../data/shop";
import { CombatAI } from "../systems/ai";
import { resolveHits, dummyStrikeFeedback } from "../systems/combat";
import { DIALOGUE } from "../data/dialogue";
import { getNpc, HOUSE_GLADIATORS, LANISTA } from "../data/gladiators";
import { markTutorial, skipTutorial } from "../systems/objectives";
import { applySparReward, applyDummyXp, pledgedHouse, rivalHouses } from "../systems/progression";
import { palBrought, palNextHint, palStats, palTier, palTitle, palUnlocked } from "../data/pal";
import { bodyStyleFor } from "../systems/assets";
import { CombatInput } from "../systems/input";

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
  private nearestHint?: Phaser.GameObjects.Text;
  private sparring: { enemy: Fighter; ai: CombatAI; npcId: string } | null = null;
  private hiddenNpc?: NpcActor;
  private awaitingSpar: string | null = null;
  private dummyCapTold = false;
  private built = buildLudus();

  constructor() {
    super("LudusScene");
  }

  create(): void {
    this.solids = paintMap(this, this.built, "ludus");
    labelMap(this, LUDUS_META.labels);
    this.cameras.main.setBounds(0, 0, this.built.cols * TILE_SIZE, this.built.rows * TILE_SIZE);
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
      stats: { ...gameState.save.stats },
      weapon: gameState.save.equippedWeapon,
      team: "player",
    });
    this.player.health = gameState.save.health;
    this.player.stamina = gameState.save.stamina;
    this.physics.add.collider(this.player, this.solids);

    this.spawnNpcs();
    this.spawnProps();
    this.spawnPalRoost();

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
      this.player.setWeapon(gameState.save.equippedWeapon);
      this.player.stats = { ...gameState.save.stats };
      this.player.revive(true);
      gameState.restoreVitals();
      bus.emit("minimap-scene", "ludus");
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
      bus.emit("spar-available", { show: false });
      bus.emit("talk-available", { show: false });
      bus.emit("minimap-scene", "none");
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
        const gate = new WorldProp(this, p.x, p.y - 8, "gate", "prop-gate", false);
        gate.setDepth(p.y + 30);
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
      } else if (p.kind === "bench") {
        const b = new WorldProp(this, p.x, p.y, "bench", "prop-bench", true);
        this.physics.add.collider(this.player, b);
      } else if (p.kind === "shop") {
        const stall = new WorldProp(this, p.x, p.y, "shop", "prop-stall", true);
        this.physics.add.collider(this.player, stall);
        this.interactables.push({ kind: "shop", x: p.x, y: p.y });
      }
    }
  }

  private spawnPalRoost(): void {
    if (!palUnlocked()) return;
    const pos = this.built.spawns.pal;
    if (!pos) return;
    const scale = palStats(palTier()).visScale;
    this.add.image(pos.x, pos.y + 10, "char-shadow").setDepth(1).setScale(0.85);
    const img = this.add.image(pos.x, pos.y - 12, "beast-eagle").setDepth(pos.y).setScale(scale);
    const tint = palStats(palTier()).tint;
    if (tint) img.setTint(tint);
    this.tweens.add({
      targets: img,
      y: pos.y - 18,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
    this.add
      .text(pos.x, pos.y - 38, palTitle(palTier()), {
        fontFamily: "Cinzel, Georgia",
        fontSize: "11px",
        color: "#e8c96a",
        stroke: "#1a1210",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(pos.y + 2);
    this.interactables.push({ kind: "pal", x: pos.x, y: pos.y });
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
      bus.emit("dialogue", {
        name: palTitle(palTier()),
        lines: DIALOGUE.pal(),
      });
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
          if (def.canSpar) {
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
    if (n?.kind === "npc" && n.id && getNpc(n.id).canSpar) {
      this.startSpar(n.id);
      return;
    }
    const nearby = this.npcs.find((npc) => {
      if (!getNpc(npc.npcId).canSpar) return false;
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

  private onSkillsChanged = (): void => {
    this.player.stats = { ...gameState.save.stats };
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
    this.scene.sleep();
    this.scene.launch("ArenaScene");
  };

  update(_t: number, delta: number): void {
    if (!this.player) return;
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
    } else if (n?.kind === "npc" && n.id && getNpc(n.id).canSpar) {
      bus.emit("spar-available", { show: true, yield: false });
    } else {
      bus.emit("spar-available", { show: false });
    }
    if (n && !this.sparring && !gameState.paused && !gameState.inMenu) {
      const talkLabel =
        n.kind === "rack" ? "ARMORY" : n.kind === "gate" ? "ARENA" : n.kind === "shop" ? "QUARTERS" : n.kind === "pal" ? "EAGLE" : "TALK";
      bus.emit("talk-available", { show: true, label: talkLabel });
      this.nearestHint!.setVisible(true).setPosition(this.player.x, this.player.y + 28);
      const canSpar = n.kind === "npc" && n.id ? getNpc(n.id).canSpar : false;
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
                  ? "E  Eagle"
                : "";
      this.nearestHint!.setText(label);
      this.npcs.forEach((npc) => npc.setPrompt(n.id === npc.npcId, getNpc(npc.npcId).canSpar ? "SPAR / E" : "E  Talk"));
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
      gameState.pendingArenaOpponent = rivalHouses()[0]?.fighters[0]?.id ?? "fox_1";
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
