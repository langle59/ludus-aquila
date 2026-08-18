import Phaser from "phaser";
import { TILE_SIZE, HUD_CAM_PAD } from "../config";
import { gameState } from "../state/GameState";
import { bus } from "../systems/bus";
import { audio } from "../systems/audio";
import { paintMap, animateBrazier, animateCampFire, placeLamp } from "../systems/worldRender";
import { buildFreedCamp, freedCampAreaName } from "../maps/maps";
import { Fighter } from "../entities/Fighter";
import { NpcActor, WorldProp } from "../entities/World";
import { playerLook } from "../data/shop";
import { playerCombatStats } from "../systems/progression";
import { CombatInput } from "../systems/input";
import { act4Unlocked, camp, CAMP_HOUSE_PADS, consumeMarchProvisions, cropTextureKey, animalTextureKey, isAnimalCrop, nextRaidRoomId, penUnlocked } from "../data/camp";
import { campBuffFireHeal, cookLines, cookName } from "../data/kitchen";
import { CASSIAN, getCompanionDef } from "../data/companions";
import { getHouse } from "../data/houses";
import { enterRaid, returnToLudusFromCamp } from "../systems/playFlow";
import {
  getRaid,
  isRaidHouseApproachable,
  liberationArriveFlag,
  liberationFlag,
  marchableRaidHouses,
  nextUnlockedRaidHouse,
  RAID_HOUSE_ORDER,
  raidRoomOrder,
} from "../data/raid";
import type { CompanionId, RaidHouseId } from "../types";
import { getRefugee, refugeeVolunteerLine, refugeesForHouse } from "../data/refugees";
import { setHouseVolunteer, volunteerDisplayLine, volunteersGroupedByHouse } from "../data/volunteers";
import { CAMP_GROWTH_TEX, growthForFreedPads, growthWorldPos } from "../data/campGrowth";
import { palBrought, palCombatStats, palDisplayName, palTexture, palUnlocked } from "../data/pal";

/**
 * Act 4 hub: forest clearing, tents, farm, stables, armory, party ring.
 */
export class FreedCampScene extends Phaser.Scene {
  private player!: Fighter;
  private combat!: CombatInput;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private interactables: { kind: string; x: number; y: number; id?: string }[] = [];
  private nearestHint?: Phaser.GameObjects.Text;
  private built = buildFreedCamp();
  private padGfx: Phaser.GameObjects.GameObject[] = [];
  private worldGfx: Phaser.GameObjects.GameObject[] = [];
  private farmBeds: { id: string; img: Phaser.GameObjects.Image; x: number; y: number }[] = [];
  private penTraderPos = { x: 0, y: 0 };
  private partyPos = { x: 0, y: 0 };
  private cassianPos = { x: 0, y: 0 };
  private palSprite?: Phaser.GameObjects.Image;
  private palNameTag?: Phaser.GameObjects.Text;
  private palShadow?: Phaser.GameObjects.Image;
  private palGfx: Phaser.GameObjects.GameObject[] = [];
  private palHome = { x: 0, y: 0 };
  private palGround = { x: 0, y: 0 };
  private roadSignPos?: { x: number; y: number };
  private roadPlaqueGfx: Phaser.GameObjects.GameObject[] = [];
  private growthGfx: Phaser.GameObjects.GameObject[] = [];
  private cookPos = { x: 0, y: 0 };
  private potPos = { x: 0, y: 0 };
  private penMin = { x: 0, y: 0 };
  private penMax = { x: 0, y: 0 };

  constructor() {
    super("FreedCampScene");
  }

  init(): void {
    this.interactables = [];
    this.padGfx = [];
    this.worldGfx = [];
    this.palGfx = [];
    this.palSprite = undefined;
    this.palNameTag = undefined;
    this.palShadow = undefined;
    this.farmBeds = [];
    this.built = buildFreedCamp();
  }

  create(): void {
    this.solids = paintMap(this, this.built, "freedcamp");
    this.cameras.main.setBounds(0, -HUD_CAM_PAD, this.built.cols * TILE_SIZE, this.built.rows * TILE_SIZE + HUD_CAM_PAD);
    audio.setMusicMood("yard");

    const spawn =
      gameState.save.position.scene === "freedcamp" && gameState.save.position.x
        ? { x: gameState.save.position.x, y: gameState.save.position.y }
        : this.built.spawns.player;

    const look = playerLook();
    this.player = new Fighter(this, spawn.x, spawn.y, {
      key: "player-camp",
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

    this.spawnProps();
    this.refreshPads();
    this.refreshCampGrowth();
    this.refreshWorldRead();
    this.refreshRoadPlaque();
    this.refreshPal();

    this.nearestHint = this.add
      .text(0, 0, "", { fontFamily: "Georgia", fontSize: "14px", color: "#d4a84b", stroke: "#1a1210", strokeThickness: 4 })
      .setOrigin(0.5)
      .setDepth(9000)
      .setVisible(false);

    this.combat = new CombatInput(this);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);

    bus.emit("minimap-scene", "freedcamp");
    bus.emit("combat-hud", { show: false });
    bus.emit("ludus-resumed");

    if (!gameState.save.storyFlags.act4CampSeen) {
      gameState.save.storyFlags.act4CampSeen = true;
      if (gameState.save.currentObjective === "freed_camp" || gameState.save.currentObjective === "school") {
        gameState.save.currentObjective = "raid_serpens";
      }
      gameState.persist();
      bus.emit("dialogue", {
        name: CASSIAN.name,
        lines: [
          `"This clearing is off Rome's roads. Trees hide us. Pads wait for nine houses — Serpens, then Lupus, then Aper."`,
          `"Plant the beds. Keep a goat in the stalls. Arm yourselves at the lean-to. March east when ready."`,
          ...CASSIAN.lines.slice(0, 1),
        ],
      });
    } else {
      this.playArrivalIfNeeded();
    }
    if (camp().freedPads.length >= 9 && !gameState.save.storyFlags.campNineGrowth) {
      gameState.save.storyFlags.campNineGrowth = true;
      gameState.persist();
      this.time.delayedCall(800, () => {
        bus.emit("toast", "All nine pads filled — banners line the raid road.");
      });
    }

    if (camp().freedPads.length >= 3 && !gameState.save.storyFlags.campCookWelcomed && camp().cookUnlocked) {
      gameState.save.storyFlags.campCookWelcomed = true;
      gameState.persist();
      this.time.delayedCall(800, () => {
        bus.emit("toast", "Therio the cook tends the farm kitchen.");
      });
    }

    bus.on("enter-raid", this.goRaid, this);
    bus.on("camp-refresh", this.onCampRefresh, this);
    bus.on("roost-changed", this.refreshPal, this);
    bus.on("cosmetics-changed", this.onCosmeticsChanged, this);
    bus.on("player-interact", this.tryInteract, this);
    bus.on("weapon-changed", this.onWeapon, this);
    this.events.on("shutdown", () => {
      bus.emit("minimap-scene", "none");
      bus.emit("combat-hud", { show: false });
      bus.off("enter-raid", this.goRaid, this);
      bus.off("camp-refresh", this.onCampRefresh, this);
      bus.off("roost-changed", this.refreshPal, this);
      bus.off("cosmetics-changed", this.onCosmeticsChanged, this);
      bus.off("player-interact", this.tryInteract, this);
      bus.off("weapon-changed", this.onWeapon, this);
    });
  }

  private onWeapon = (id: string): void => {
    this.player.setWeapon(id as typeof this.player.weaponId);
  };

  private onCosmeticsChanged = (): void => {
    const look = playerLook();
    this.player.applyLook(look.tunic, look.accent, look.style, look.cape, look.scar, look.crest);
  };

  private spawnProps(): void {
    for (const p of this.built.props) {
      if (p.kind === "tree") {
        const t = this.add.image(p.x, p.y, "prop-tree").setOrigin(0.5, 1).setDepth(p.y);
        void t;
      } else if (p.kind === "bush") {
        this.add.image(p.x, p.y, "prop-bush").setOrigin(0.5, 1).setDepth(p.y);
      } else if (p.kind === "hay") {
        this.add.image(p.x, p.y, "prop-hay").setDepth(p.y);
      } else if (p.kind === "brazier") {
        const b = new WorldProp(this, p.x, p.y, "brazier", "prop-brazier", true);
        this.physics.add.collider(this.player, b);
        animateBrazier(this, p.x, p.y);
      } else if (p.kind === "camp_fire") {
        animateCampFire(this, p.x, p.y);
        this.interactables.push({ kind: "fire", x: p.x, y: p.y });
      } else if (p.kind === "cooking_pot") {
        this.potPos = { x: p.x, y: p.y };
        this.add.image(p.x, p.y, "prop-cooking-pot").setOrigin(0.5, 1).setDepth(p.y + 2);
      } else if (p.kind === "camp_wardrobe") {
        this.add.image(p.x, p.y, "prop-camp-wardrobe").setOrigin(0.5, 1).setDepth(p.y + 2);
        this.interactables.push({ kind: "wardrobe", x: p.x, y: p.y });
      } else if (p.kind === "camp_rug") {
        this.add.image(p.x, p.y + 8, "prop-camp-rug").setDepth(1);
      } else if (p.kind === "crate") {
        const c = new WorldProp(this, p.x, p.y, "crate", "prop-crate", true);
        this.physics.add.collider(this.player, c);
      } else if (p.kind === "bench") {
        const b = new WorldProp(this, p.x, p.y, "bench", "prop-bench", true);
        this.physics.add.collider(this.player, b);
      } else if (p.kind === "livestock_stall") {
        this.add.image(p.x, p.y, "prop-livestock-stall").setOrigin(0.5, 1).setDepth(p.y + 2);
      } else if (p.kind === "pen_gate") {
        this.add.image(p.x, p.y - 4, "prop-pen-gate").setOrigin(0.5, 1).setDepth(p.y + 2);
        this.interactables.push({ kind: "pen_gate", x: p.x, y: p.y });
      } else if (p.kind === "pen_trader") {
        this.penTraderPos = { x: p.x, y: p.y };
        this.add.image(p.x, p.y, "prop-feed-trough").setOrigin(0.5, 1).setDepth(p.y + 3);
        this.interactables.push({ kind: "pen_trader", x: p.x, y: p.y });
      } else if (p.kind === "cassian") {
        this.cassianPos = { x: p.x, y: p.y };
      } else if (p.kind === "house_pad" && p.id) {
        // Interactables for pads are owned by refreshPads (unfreed clearings only).
      } else if (p.kind === "farm_plot") {
        const bed = this.add.image(p.x, p.y, "prop-farm-bed").setDepth(2);
        this.farmBeds.push({ id: p.id ?? "p0", img: bed, x: p.x, y: p.y });
        this.interactables.push({ kind: "farm_plot", x: p.x, y: p.y, id: p.id });
      } else if (p.kind === "armory") {
        const a = new WorldProp(this, p.x, p.y, "armory", "prop-camp-armory", true);
        this.physics.add.collider(this.player, a);
        this.interactables.push({ kind: "armory", x: p.x, y: p.y + 8 });
      } else if (p.kind === "party") {
        this.add.image(p.x, p.y, "prop-camp-party").setOrigin(0.5, 1).setDepth(p.y);
        this.partyPos = { x: p.x, y: p.y + 18 };
        this.interactables.push({ kind: "party", x: p.x, y: p.y + 12 });
      } else if (p.kind === "raid_road") {
        this.interactables.push({ kind: "raid_road", x: p.x, y: p.y });
        this.roadSignPos = { x: p.x, y: p.y };
      } else if (p.kind === "ludus_gate") {
        this.interactables.push({ kind: "ludus_gate", x: p.x, y: p.y });
      } else if (p.kind === "ludus_plaque") {
        this.add
          .rectangle(p.x, p.y, 88, 22, 0x2a1c10, 0.85)
          .setStrokeStyle(2, 0xd4a84b)
          .setDepth(p.y + 2);
        this.add
          .text(p.x, p.y, "TO THE LUDUS", {
            fontFamily: "Cinzel, Georgia",
            fontSize: "12px",
            color: "#e8c96a",
            stroke: "#1a1210",
            strokeThickness: 3,
          })
          .setOrigin(0.5)
          .setDepth(p.y + 3);
      } else if (p.kind === "lamp") {
        placeLamp(this, p.x, p.y);
      }
    }
    const pMin = this.built.spawns.penMin;
    const pMax = this.built.spawns.penMax;
    if (pMin && pMax) {
      this.penMin = { x: pMin.x, y: pMin.y };
      this.penMax = { x: pMax.x, y: pMax.y };
    }
  }

  private onCampRefresh = (): void => {
    this.refreshPads();
    this.refreshCampGrowth();
    this.refreshRoadPlaque();
    this.refreshWorldRead();
    this.refreshPal();
  };

  private refreshCampGrowth = (): void => {
    for (const g of this.growthGfx) g.destroy();
    this.growthGfx = [];
    const entries = growthForFreedPads(camp().freedPads);
    for (const entry of entries) {
      let ax = 0;
      let ay = 0;
      if (entry.anchor.type === "pad") {
        const spawn = this.built.spawns[`pad_${entry.anchor.houseId}`];
        if (!spawn) continue;
        ax = spawn.x;
        ay = spawn.y;
      } else if (entry.anchor.type === "fire") {
        const fire = this.built.spawns.fire;
        if (!fire) continue;
        ax = fire.x;
        ay = fire.y;
      } else if (entry.anchor.type === "raidRoad") {
        const road = this.built.spawns.raidRoad;
        if (!road) continue;
        ax = road.x;
        ay = road.y;
      }
      for (const prop of entry.props) {
        const tex = CAMP_GROWTH_TEX[prop.kind];
        if (!tex || !this.textures.exists(tex)) continue;
        const pos = growthWorldPos(ax, ay, prop);
        const img = this.add.image(pos.x, pos.y, tex).setOrigin(0.5, 1).setDepth(pos.y);
        if (prop.tint) img.setTint(prop.tint);
        if (prop.kind === "brazier") animateBrazier(this, pos.x, pos.y);
        this.growthGfx.push(img);
      }
    }
  };

  private refreshRoadPlaque = (): void => {
    for (const g of this.roadPlaqueGfx) g.destroy();
    this.roadPlaqueGfx = [];
    if (!this.roadSignPos) return;
    const { x, y } = this.roadSignPos;
    const bg = this.add
      .rectangle(x, y + 20, 88, 18, 0x2a1c10, 0.75)
      .setStrokeStyle(1, 0xc49a28)
      .setDepth(y + 2);
    const txt = this.add
      .text(x, y + 20, "TO LEO", {
        fontFamily: "Cinzel, Georgia",
        fontSize: "11px",
        color: "#c49a28",
        stroke: "#1a1210",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(y + 3);
    this.roadPlaqueGfx.push(bg, txt);
  };

  private playArrivalIfNeeded(): void {
    for (const id of RAID_HOUSE_ORDER) {
      if (!gameState.save.storyFlags[liberationFlag(id)] || gameState.save.storyFlags[liberationArriveFlag(id)]) continue;
      const spawn = this.built.spawns[`pad_${id}`];
      if (!spawn) continue;
      gameState.save.storyFlags[liberationArriveFlag(id)] = true;
      gameState.persist();
      const alreadyNear = Phaser.Math.Distance.Between(this.player.x, this.player.y, spawn.x, spawn.y) < 140;
      const showCaption = (): void => {
        const cap = this.add
          .text(spawn.x, spawn.y - 86, "Their tent is raised.", {
            fontFamily: "Georgia",
            fontSize: "16px",
            color: "#e8dcc8",
            stroke: "#1a1210",
            strokeThickness: 4,
          })
          .setOrigin(0.5)
          .setDepth(9000)
          .setAlpha(0);
        this.tweens.add({ targets: cap, alpha: 1, y: spawn.y - 94, duration: 280 });
        this.time.delayedCall(alreadyNear ? 1400 : 1700, () => {
          this.tweens.add({
            targets: cap,
            alpha: 0,
            duration: 240,
            onComplete: () => cap.destroy(),
          });
          this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
          gameState.paused = false;
        });
      };
      if (alreadyNear) {
        showCaption();
        return;
      }
      gameState.paused = true;
      this.cameras.main.stopFollow();
      let shown = false;
      this.cameras.main.pan(spawn.x, spawn.y, 720, "Sine.easeInOut", false, (_cam, progress) => {
        if (progress < 1 || shown) return;
        shown = true;
        showCaption();
      });
      return;
    }
  }

  private spawnRoamingAnimal = (tex: string, scale = 1): void => {
    if (!this.penMin.x || !this.penMax.x) return;
    const rx = Phaser.Math.Between(this.penMin.x, this.penMax.x);
    const ry = Phaser.Math.Between(this.penMin.y, this.penMax.y);
    const roam = this.add
      .image(rx, ry, tex)
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setDepth(ry + 3);
    this.worldGfx.push(roam);
    const wander = (): void => {
      if (!roam.active) return;
      const tx = Phaser.Math.Between(this.penMin.x, this.penMax.x);
      const ty = Phaser.Math.Between(this.penMin.y, this.penMax.y);
      roam.setFlipX(tx < roam.x);
      this.tweens.add({
        targets: roam,
        x: tx,
        y: ty,
        duration: Phaser.Math.Between(1400, 2800),
        ease: "Sine.easeInOut",
        onUpdate: () => roam.setDepth(roam.y + 3),
        onComplete: wander,
      });
    };
    wander();
  };

  private refreshWorldRead = (): void => {
    for (const g of this.worldGfx) g.destroy();
    this.worldGfx = [];
    this.interactables = this.interactables.filter((it) => it.kind !== "cassian");
    const plots = camp().farm.plots;

    for (const bed of this.farmBeds) {
      const plot = plots.find((p) => p.id === bed.id);
      if (!plot?.unlocked) {
        bed.img.setAlpha(0.42).setTint(0x5a5048);
        continue;
      }
      bed.img.setAlpha(1);
      if (plot.state === "empty" || !plot.cropId) {
        bed.img.clearTint();
        continue;
      }
      if (isAnimalCrop(plot.cropId)) continue;
      const tex = cropTextureKey(plot.cropId, plot.state);
      if (this.textures.exists(tex)) {
        const crop = this.add
          .image(bed.x, bed.y - 8, tex)
          .setOrigin(0.5, 1)
          .setDepth(bed.y + 3);
        this.worldGfx.push(crop);
      }
    }

    this.interactables = this.interactables.filter((it) => it.kind !== "pen_trader");
    if (this.penTraderPos.x) {
      this.interactables.push({ kind: "pen_trader", x: this.penTraderPos.x, y: this.penTraderPos.y });
    }

    if (penUnlocked() && this.penMin.x && this.penMax.x) {
      for (const plot of plots) {
        if (!plot.id.startsWith("s") || !plot.unlocked) continue;
        if (!plot.cropId || plot.state === "empty" || !isAnimalCrop(plot.cropId)) continue;
        const tex = animalTextureKey(plot.cropId, plot.state);
        const scale = plot.cropId === "chicken" ? 0.88 : plot.cropId === "pig" ? 1.05 : 1;
        this.spawnRoamingAnimal(tex, scale);
      }
    }

    if (this.potPos.x && camp().cookedStock.length > 0) {
      const steam = this.add
        .image(this.potPos.x, this.potPos.y - 30, "fx-steam")
        .setAlpha(0.45)
        .setDepth(this.potPos.y + 6);
      this.worldGfx.push(steam);
      this.tweens.add({
        targets: steam,
        y: this.potPos.y - 52,
        alpha: 0.08,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeOut",
      });
    }

    this.interactables = this.interactables.filter((it) => it.kind !== "cook" && it.kind !== "kitchen");
    if (camp().cookUnlocked) {
      const cx = this.potPos.x || this.built.spawns.fire?.x || 0;
      const cy = this.potPos.y || this.built.spawns.fire?.y || 0;
      this.cookPos = { x: cx - 28, y: cy + 4 };
      const cook = new NpcActor(this, this.cookPos.x, this.cookPos.y, "camp-cook", cookName(), 0x5a4030, 0xd4a878, 0.92, "npc-camp-cook");
      this.physics.add.collider(this.player, cook);
      this.worldGfx.push(cook);
      this.interactables.push({ kind: "cook", x: this.cookPos.x, y: this.cookPos.y });
      this.interactables.push({ kind: "kitchen", x: cx, y: cy - 8 });
    }

    const party = camp().party.slice(0, 2) as CompanionId[];
    const offsets = [
      { x: -22, y: 10 },
      { x: 22, y: 10 },
    ];
    party.forEach((id, i) => {
      const def = getCompanionDef(id);
      const o = offsets[i] ?? offsets[0];
      const npc = new NpcActor(
        this,
        this.partyPos.x + o.x,
        this.partyPos.y + o.y,
        id,
        def.name,
        def.color,
        def.accent,
        def.scale,
        `npc-camp-${id}`,
      );
      if (npc.body) npc.body.enable = false;
      npc.visual.setAlpha(0.72);
      npc.label.setAlpha(0.75);
      this.worldGfx.push(npc);
    });

    if (!party.includes("cassian")) {
      const npc = new NpcActor(
        this,
        this.cassianPos.x,
        this.cassianPos.y,
        "cassian",
        CASSIAN.name,
        CASSIAN.color,
        CASSIAN.accent,
        CASSIAN.scale,
        "npc-camp-cassian",
      );
      this.physics.add.collider(this.player, npc);
      this.worldGfx.push(npc);
      this.interactables.push({ kind: "cassian", x: this.cassianPos.x, y: this.cassianPos.y });
    }
  };

  private refreshPal = (): void => {
    for (const g of this.palGfx) {
      this.tweens.killTweensOf(g);
      g.destroy();
    }
    this.palGfx = [];
    this.palSprite = undefined;
    this.palNameTag = undefined;
    this.palShadow = undefined;
    if (!palUnlocked() || !this.textures.exists(palTexture())) return;

    const roost = this.built.spawns.fire ?? { x: this.partyPos.x - 40, y: this.partyPos.y + 28 };
    this.palHome = { x: roost.x - 36, y: roost.y + 18 };
    const following = palBrought();
    const stats = palCombatStats();
    const start =
      following && this.player
        ? { x: this.player.x - 28, y: this.player.y + 8 }
        : { x: this.palHome.x, y: this.palHome.y };
    this.palGround = { x: start.x, y: start.y };

    const shadow = this.add.image(start.x, start.y + 8, "char-shadow").setDepth(1).setScale(0.7);
    const img = this.add
      .image(start.x, start.y - 10, palTexture())
      .setDepth(start.y)
      .setScale(stats.visScale * 0.9);
    if (stats.tint) img.setTint(stats.tint);
    const tag = this.add
      .text(start.x, start.y - 36, following ? `${palDisplayName()} · with you` : `${palDisplayName()} · roost`, {
        fontFamily: "Cinzel, Georgia",
        fontSize: "11px",
        color: following ? "#8ecf6a" : "#e8dcc8",
        stroke: "#1a1210",
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(start.y + 2);

    this.palShadow = shadow;
    this.palSprite = img;
    this.palNameTag = tag;
    this.palGfx.push(shadow, img, tag);

    if (!following) {
      this.tweens.add({
        targets: img,
        y: start.y - 16,
        duration: 980,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
  };

  private updatePalFollower(now: number): void {
    if (!this.palSprite?.active || !palUnlocked() || !palBrought() || !this.player) return;
    const fx = this.player.facing.x;
    const fy = this.player.facing.y;
    const len = Math.hypot(fx, fy) || 1;
    const tx = this.player.x - (fx / len) * 34;
    const ty = this.player.y - (fy / len) * 28 + 6;
    const dist = Phaser.Math.Distance.Between(this.palGround.x, this.palGround.y, tx, ty);
    const step = dist > 90 ? 0.18 : dist > 40 ? 0.12 : 0.07;
    if (dist > 18) {
      this.palGround.x = Phaser.Math.Linear(this.palGround.x, tx, step);
      this.palGround.y = Phaser.Math.Linear(this.palGround.y, ty, step);
      this.palSprite.setFlipX(tx < this.palGround.x);
    }
    const bob = Math.sin(now / 260) * 3;
    this.palSprite.setPosition(this.palGround.x, this.palGround.y - 10 + bob).setDepth(this.palGround.y);
    this.palShadow?.setPosition(this.palGround.x, this.palGround.y + 8);
    this.palNameTag?.setPosition(this.palGround.x, this.palGround.y - 36).setDepth(this.palGround.y + 2);
  }

  private refreshPads = (): void => {
    for (const g of this.padGfx) {
      this.tweens.killTweensOf(g);
      g.destroy();
    }
    this.padGfx = [];
    const freed = new Set(camp().freedPads);
    const nextTarget = nextUnlockedRaidHouse(camp().freedPads);
    this.interactables = this.interactables.filter((it) => it.kind !== "refugee" && it.kind !== "house_pad");
    for (const id of CAMP_HOUSE_PADS) {
      const spawn = this.built.spawns[`pad_${id}`];
      if (!spawn) continue;
      const house = getHouse(id);
      const open = freed.has(id);
      if (open) {
        const tent = this.add
          .image(spawn.x, spawn.y + 4, "prop-camp-tent")
          .setOrigin(0.5, 1)
          .setDepth(spawn.y + 4);
        this.padGfx.push(tent);
        const color = house?.colors.primary ?? house?.crowdTint ?? 0xc4a878;
        if (this.textures.exists("prop-camp-flag-pole") && this.textures.exists("prop-camp-flag-cloth")) {
          const fx = spawn.x - 68;
          const fy = spawn.y + 6;
          const pole = this.add
            .image(fx, fy, "prop-camp-flag-pole")
            .setOrigin(0.5, 1)
            .setDepth(spawn.y + 6);
          const cloth = this.add
            .image(fx + 2, fy - 68, "prop-camp-flag-cloth")
            .setOrigin(0, 0)
            .setDepth(spawn.y + 7)
            .setTint(color);
          this.tweens.add({
            targets: cloth,
            scaleX: 0.78,
            angle: 10,
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.tweens.add({
            targets: cloth,
            scaleY: { from: 1, to: 0.92 },
            duration: 700,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.padGfx.push(pole, cloth);
        }
        const defs = refugeesForHouse(id);
        const offsets = [
          { x: -34, y: 58 },
          { x: 34, y: 56 },
        ];
        defs.slice(0, 2).forEach((def, i) => {
          const o = offsets[i] ?? offsets[0];
          const npc = new NpcActor(this, spawn.x + o.x, spawn.y + o.y, def.id, def.name, def.tunic, def.accent, def.scale);
          this.physics.add.collider(this.player, npc);
          this.padGfx.push(npc);
          this.interactables.push({ kind: "refugee", x: spawn.x + o.x, y: spawn.y + o.y, id: def.id });
        });
      } else {
        this.interactables.push({ kind: "house_pad", x: spawn.x, y: spawn.y, id });
        const isNext = nextTarget === id;
        const ring = this.add
          .circle(spawn.x, spawn.y, isNext ? 22 : 14, isNext ? 0x4a3828 : 0x3a3020, isNext ? 0.5 : 0.25)
          .setStrokeStyle(isNext ? 2 : 1, isNext ? 0xe8c96a : 0x5a4a38, isNext ? 0.9 : 0.4)
          .setDepth(2);
        this.padGfx.push(ring);
        if (isNext) {
          const pulse = this.add
            .circle(spawn.x, spawn.y, 26, 0xe8c96a, 0.12)
            .setStrokeStyle(1, 0xe8c96a, 0.35)
            .setDepth(1);
          this.tweens.add({
            targets: pulse,
            scale: 1.25,
            alpha: 0.04,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
          });
          this.padGfx.push(pulse);
        }
      }
    }
  };

  private nearest() {
    let best: (typeof this.interactables)[0] | null = null;
    let bestD = 56;
    for (const it of this.interactables) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, it.x, it.y);
      if (d < bestD) {
        bestD = d;
        best = it;
      }
    }
    return best;
  }

  private tryInteract = (): void => {
    const n = this.nearest();
    if (!n) return;
    if (n.kind === "cassian") {
      bus.emit("dialogue", { name: CASSIAN.name, lines: CASSIAN.lines });
      return;
    }
    if (n.kind === "fire") {
      gameState.restoreVitals();
      const extra = campBuffFireHeal(true);
      this.player.health = Math.min(
        this.player.stats.maxHealth + (camp().tempMaxHpBonus ?? 0),
        gameState.save.health + extra.hp,
      );
      this.player.stamina = gameState.save.stamina;
      gameState.save.health = this.player.health;
      gameState.persist();
      bus.emit("toast", extra.message || "The fire restores you.");
      this.refreshWorldRead();
      return;
    }
    if (n.kind === "cook") {
      bus.emit("dialogue", { name: cookName(), lines: cookLines() });
      return;
    }
    if (n.kind === "kitchen") {
      bus.emit("camp-kitchen");
      return;
    }
    if (n.kind === "wardrobe") {
      bus.emit("shop");
      return;
    }
    if (n.kind === "pen_gate") {
      bus.emit("camp-farm", "stables");
      return;
    }
    if (n.kind === "pen_trader") {
      bus.emit("camp-farm", "stables");
      return;
    }
    if (n.kind === "farm_plot") {
      bus.emit("camp-farm", "crops");
      return;
    }
    if (n.kind === "stable") {
      bus.emit("camp-farm", "stables");
      return;
    }
    if (n.kind === "armory") {
      bus.emit("camp-loadout");
      return;
    }
    if (n.kind === "party") {
      bus.emit("camp-party");
      return;
    }
    if (n.kind === "raid_road") {
      bus.emit("camp-march");
      return;
    }
    if (n.kind === "ludus_gate") {
      gameState.save.position = { x: this.player.x, y: this.player.y, scene: "freedcamp" };
      gameState.save.health = this.player.health;
      gameState.save.stamina = this.player.stamina;
      gameState.persist();
      returnToLudusFromCamp(this);
      return;
    }
    if (n.kind === "refugee" && n.id) {
      const def = getRefugee(n.id);
      if (!def) return;
      const lines = [...def.lines];
      if (camp().volunteersUnlocked.includes(def.id)) {
        lines.push(def.volunteerLine ?? refugeeVolunteerLine(def.id));
      }
      bus.emit("dialogue", { name: def.name, lines });
      return;
    }
    if (n.kind === "house_pad" && n.id) {
      const house = getHouse(n.id);
      const next = nextUnlockedRaidHouse(camp().freedPads);
      const unlocked = isRaidHouseApproachable(n.id as RaidHouseId, camp().freedPads);
      bus.emit("dialogue", {
        name: house?.latinName ?? n.id,
        lines: unlocked
          ? [`A clearing waits for ${house?.latinName ?? n.id}.`, `"March east when you are ready."`]
          : [
              `A clearing marked for ${house?.latinName ?? n.id}.`,
              next ? `"Not yet. Free ${getHouse(next)?.latinName ?? next} first."` : `"The road is quiet."`,
            ],
      });
    }
  };

  private goRaid = (houseId?: unknown): void => {
    if (!act4Unlocked()) return;
    const freed = camp().freedPads;
    const allowed = marchableRaidHouses(freed);
    const requested = typeof houseId === "string" ? houseId : "";
    const target = (allowed.includes(requested as RaidHouseId) ? requested : allowed[0] ?? nextUnlockedRaidHouse(freed) ?? "serpens") as string;
    const raid = getRaid(target);
    if (!raid) return;
    gameState.save.position = { x: this.player.x, y: this.player.y, scene: "freedcamp" };
    gameState.save.health = this.player.health;
    gameState.save.stamina = this.player.stamina;
    gameState.pendingRaidHouse = target;
    gameState.pendingRaidRoom = nextRaidRoomId(target, raidRoomOrder(target), raid.startRoom);
    gameState.raidDownedAllies = [];
    gameState.raidDownedVolunteer = false;
    gameState.raidMarchStats = consumeMarchProvisions();
    gameState.raidTempHpBonus = camp().tempMaxHpBonus;
    camp().tempMaxHpBonus = 0;
    gameState.raidActiveMeal = null;
    gameState.raidClearedRoomThisOuting = false;
    gameState.persist();
    enterRaid(this);
  };

  private emitMinimap(): void {
    const marks: { x: number; y: number; color: number; kind: string }[] = [];
    for (const it of this.interactables) {
      if (it.kind === "ludus_gate") marks.push({ x: it.x, y: it.y, color: 0xd4a84b, kind: "ludus" });
      if (it.kind === "raid_road") marks.push({ x: it.x, y: it.y, color: 0x7ab8a4, kind: "trail" });
      if (it.kind === "fire") marks.push({ x: it.x, y: it.y, color: 0xc45a1a, kind: "fire" });
      if (it.kind === "armory") marks.push({ x: it.x, y: it.y, color: 0xe07060, kind: "armory" });
      if (it.kind === "party") marks.push({ x: it.x, y: it.y, color: 0xe8c96a, kind: "party" });
      if (it.kind === "farm_plot") marks.push({ x: it.x, y: it.y, color: 0x6a8a40, kind: "farm" });
      if (it.kind === "kitchen") marks.push({ x: it.x, y: it.y, color: 0xc48a50, kind: "kitchen" });
      if (it.kind === "pen_trader") marks.push({ x: it.x, y: it.y, color: 0xc4a878, kind: "pen" });
      if (it.kind === "wardrobe") marks.push({ x: it.x, y: it.y, color: 0xe8c96a, kind: "wardrobe" });
    }
    const freed = new Set(camp().freedPads);
    for (const id of CAMP_HOUSE_PADS) {
      const spawn = this.built.spawns[`pad_${id}`];
      if (!spawn) continue;
      marks.push({
        x: spawn.x,
        y: spawn.y,
        color: freed.has(id) ? 0x8ecf6a : 0x4a4038,
        kind: freed.has(id) ? "tent" : "pad",
      });
    }
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    bus.emit("minimap", {
      show: true,
      cols: this.built.cols,
      rows: this.built.rows,
      playerX: this.player.x,
      playerY: this.player.y,
      area: freedCampAreaName(tx, ty),
      marks,
    });
  }

  update(): void {
    if (!this.player) return;
    const now = this.time.now;
    if (gameState.paused || gameState.inMenu || gameState.inDialogue) {
      this.player.setVelocity(0, 0);
      this.player.syncVisuals(now);
      return;
    }
    const move = this.combat.moveVector();
    this.player.tryMove(move.x * this.player.moveSpeed, move.y * this.player.moveSpeed);
    if (this.combat.justPressed("interact")) this.tryInteract();
    this.player.syncVisuals(now);
    this.updatePalFollower(now);

    gameState.save.health = this.player.health;
    gameState.save.stamina = this.player.stamina;
    this.emitMinimap();

    const n = this.nearest();
    if (n && !gameState.paused && !gameState.inMenu) {
      const refugeeName = n.kind === "refugee" && n.id ? getRefugee(n.id)?.name : undefined;
      const padNext =
        n.kind === "house_pad" && n.id ? isRaidHouseApproachable(n.id as RaidHouseId, camp().freedPads) : false;
      const labels: Record<string, string> = {
        cassian: "E  Cassian",
        fire: "E  Rest",
        pen_gate: penUnlocked() ? "E  Pen gate" : "E  Build pen",
        pen_trader: "E  Livestock",
        farm_plot: "E  Farm",
        kitchen: "E  Kitchen",
        cook: "E  Cook",
        wardrobe: "E  Customize",
        armory: "E  Armory",
        party: "E  Party",
        raid_road: "E  March",
        ludus_gate: "E  Ludus",
        house_pad: padNext ? "E  Next house" : "E  Pad",
        refugee: refugeeName ? `E  ${refugeeName}` : "E  Talk",
      };
      this.nearestHint!.setVisible(true).setText(labels[n.kind] ?? "E").setPosition(this.player.x, this.player.y + 28);
      bus.emit("talk-available", {
        show: true,
        label:
          n.kind === "raid_road"
            ? "MARCH"
            : n.kind === "farm_plot"
              ? "FARM"
              : n.kind === "pen_trader"
                ? "LIVESTOCK"
              : n.kind === "kitchen"
                ? "KITCHEN"
                : n.kind === "wardrobe"
                  ? "STYLE"
                : n.kind === "armory"
                  ? "ARMORY"
                  : n.kind === "party"
                    ? "PARTY"
                    : n.kind === "ludus_gate"
                      ? "LUDUS"
                      : n.kind === "fire"
                        ? "REST"
                        : "TALK",
      });
    } else {
      this.nearestHint!.setVisible(false);
      bus.emit("talk-available", { show: false });
    }
  }
}
