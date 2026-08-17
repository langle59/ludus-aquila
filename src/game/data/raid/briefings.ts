export type RaidBriefing = {
  title: string;
  subtitle: string;
  dialogue?: { name: string; lines: string[] };
};

export function getBriefingFromMap(map: Record<string, RaidBriefing> | undefined, roomId: string): RaidBriefing {
  return (
    map?.[roomId] ?? {
      title: roomId,
      subtitle: "Night raid",
    }
  );
}

export const SERPENS_BRIEFINGS: Record<string, RaidBriefing> = {
  serp_yard: {
    title: "Serpens Yard",
    subtitle: "Night raid",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Torches only. Serpens sleeps light — stay low until we are on them."`,
        `"Clear the yard. Then the barracks."`,
      ],
    },
  },
  serp_barracks: { title: "Barracks", subtitle: "Torch-lit halls" },
  serp_cipher: {
    title: "Coil Shrine",
    subtitle: "Rest if you need it",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Turn the serpents toward the cells. They only open when every coil faces the door."`,
        `"Rest by the fire before the wardens wake."`,
      ],
    },
  },
  serp_cells: { title: "Slave Cells", subtitle: "Free the chained" },
  serp_boss: {
    title: "Captain's Hall",
    subtitle: "Virex waits",
    dialogue: {
      name: "Cassian",
      lines: [`"Captain Virex. End him and the house opens."`, `"No more shadows — finish the night."`],
    },
  },
};

export const LUPUS_BRIEFINGS: Record<string, RaidBriefing> = {
  lup_yard: {
    title: "Moon Yard",
    subtitle: "The pack hunts",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Lupus hears as one. Wake a wolf and the yard answers."`,
        `"Stay tight. Clear the moon yard."`,
      ],
    },
  },
  lup_kennels: { title: "Kennels", subtitle: "Hay and fangs" },
  lup_ambush: { title: "Ambush Run", subtitle: "Narrow kill-path" },
  lup_cipher: {
    title: "Moon Court",
    subtitle: "Rest if you need it",
    dialogue: {
      name: "Cassian",
      lines: [`"Turn the wolves toward the pens. Every snout must face the way out."`, `"Breathe. The Alpha waits past the chains."`],
    },
  },
  lup_pens: { title: "Holding Pens", subtitle: "Free the chained" },
  lup_boss: {
    title: "Alpha's Den",
    subtitle: "Lupa waits",
    dialogue: {
      name: "Cassian",
      lines: [`"Alpha Lupa. End the howl and Lupus opens."`, `"No more pack — finish the night."`],
    },
  },
};

export const APER_BRIEFINGS: Record<string, RaidBriefing> = {
  aper_yard: {
    title: "Bristle Yard",
    subtitle: "Night in the sty",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Aper hits hard. Heavies will charge when they see you — don't stand still."`,
        `"Clear the bristle yard. Mud comes after."`,
      ],
    },
  },
  aper_barracks: { title: "Sty Barracks", subtitle: "Hay and iron" },
  aper_mud: { title: "Mud Sty", subtitle: "Slow ground" },
  aper_cipher: {
    title: "Tusk Court",
    subtitle: "Rest if you need it",
    dialogue: {
      name: "Cassian",
      lines: [`"Turn the boars toward the smoke. Tusks to the door — then we go."`, `"Rest here. Smoke and steel wait ahead."`],
    },
  },
  aper_smoke: { title: "Smoke Pens", subtitle: "Hot braziers" },
  aper_armory: { title: "Armory Hall", subtitle: "Iron before the captain" },
  aper_boss: {
    title: "Captain's Sty",
    subtitle: "Scrofa waits",
    dialogue: {
      name: "Cassian",
      lines: [`"Captain Scrofa. He will charge — meet it or die."`, `"End him and Aper opens."`],
    },
  },
};

export const TAURUS_BRIEFINGS: Record<string, RaidBriefing> = {
  tau_yard: {
    title: "Horn Yard",
    subtitle: "Bull-red night",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Taurus charges the lanes. Don't stand in the line when horns drop."`,
        `"Clear the yard. Fences funnel the rush."`,
      ],
    },
  },
  tau_lanes: { title: "Charge Lanes", subtitle: "Stay off the line" },
  tau_pens: { title: "Bull Pens", subtitle: "Hay and horns" },
  tau_cipher: {
    title: "Horn Path",
    subtitle: "Rest if you need it",
    dialogue: {
      name: "Cassian",
      lines: [`"Watch the tiles. The stamp goes left, then center — wrong stone draws arrows."`, `"Breathe. The captain waits in the ring."`],
    },
  },
  tau_armory: { title: "Armory Hall", subtitle: "Iron before the ring" },
  tau_ring: { title: "Ring Corridor", subtitle: "Narrow rush" },
  tau_boss: {
    title: "Captain's Ring",
    subtitle: "Taurinus waits",
    dialogue: {
      name: "Cassian",
      lines: [`"Captain Taurinus. Sidestep the charge — then finish him."`, `"End him and Taurus opens."`],
    },
  },
};

export const TIGRIS_BRIEFINGS: Record<string, RaidBriefing> = {
  tig_yard: {
    title: "Stripe Yard",
    subtitle: "Dark and quiet",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Tigris stalks the shadows. They ignore you until you're close — then they cut."`,
        `"Stay in torch light when you can. Clear the stripe yard."`,
      ],
    },
  },
  tig_shadow: { title: "Shadow Walk", subtitle: "Low vision" },
  tig_dens: { title: "Stripe Dens", subtitle: "Hay and skulls" },
  tig_cipher: {
    title: "Stripe Path",
    subtitle: "Rest if you need it",
    dialogue: {
      name: "Cassian",
      lines: [`"The gold flash is the path. After it dies, the stones forget — remember, or the arrows come."`, `"Rest. Ambush halls wait ahead."`],
    },
  },
  tig_ambush: { title: "Ambush Hall", subtitle: "Close before they wake" },
  tig_cells: { title: "Holding Cells", subtitle: "Free the chained" },
  tig_boss: {
    title: "Captain's Den",
    subtitle: "Striata waits",
    dialogue: {
      name: "Cassian",
      lines: [`"Captain Striata. She waits in the dark — force the fight."`, `"End her and Tigris opens."`],
    },
  },
};

export const LEO_BRIEFINGS: Record<string, RaidBriefing> = {
  leo_yard: {
    title: "Pride Yard",
    subtitle: "Gold and shields",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Leo fights as a pride. A roar wakes the hall — expect the pack."`,
        `"Shields and spears. Clear the pride yard."`,
      ],
    },
  },
  leo_wall: { title: "Shield Wall", subtitle: "Hold the line" },
  leo_court: { title: "Sun Court", subtitle: "Warm sand" },
  leo_cipher: {
    title: "Pride Hearth",
    subtitle: "Rest if you need it",
    dialogue: {
      name: "Cassian",
      lines: [`"Light the braziers in order: west, north, east, south. A wrong flame snuffs them all."`, `"Breathe. Gold halls wait."`],
    },
  },
  leo_hall: { title: "Gold Hall", subtitle: "Elites ahead" },
  leo_throne: { title: "Throne Approach", subtitle: "Pride pressure" },
  leo_boss: {
    title: "Captain's Pride",
    subtitle: "Leonis waits",
    dialogue: {
      name: "Cassian",
      lines: [`"Captain Leonis. His roar wakes every spear nearby."`, `"End him and Leo opens."`],
    },
  },
};

export const URSUS_BRIEFINGS: Record<string, RaidBriefing> = {
  urs_yard: {
    title: "Earth Yard",
    subtitle: "Stone and timber",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Ursus stands like a wall. Rubble pads crush if you linger — keep moving."`,
        `"Armored hammers. Clear the earth yard."`,
      ],
    },
  },
  urs_rubble: { title: "Rubble Walk", subtitle: "Don't stand still" },
  urs_den: { title: "Stone Den", subtitle: "Heavy ground" },
  urs_cipher: {
    title: "Earth Plates",
    subtitle: "Rest if you need it",
    dialogue: {
      name: "Cassian",
      lines: [`"Step the plates west to east before they rise. Don't linger — the earth forgets."`, `"Rest. Timber and vaults wait."`],
    },
  },
  urs_hall: { title: "Timber Hall", subtitle: "Logs and iron" },
  urs_vault: { title: "Stone Vault", subtitle: "High HP walls" },
  urs_crush: { title: "Crush Approach", subtitle: "Rubble denser" },
  urs_boss: {
    title: "Captain's Cave",
    subtitle: "Ursinus waits",
    dialogue: {
      name: "Cassian",
      lines: [`"Captain Ursinus. He barely moves when hit — wear him down."`, `"End him and Ursus opens."`],
    },
  },
};

export const RHINOCEROS_BRIEFINGS: Record<string, RaidBriefing> = {
  rhi_yard: {
    title: "Grey Yard",
    subtitle: "Hide and horn",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Rhinoceros is plate and charge. Narrow corridors punish standing still."`,
        `"Clear the grey yard. Gore lanes after."`,
      ],
    },
  },
  rhi_gore: { title: "Gore Corridor", subtitle: "Sidestep the rush" },
  rhi_pens: { title: "Hide Pens", subtitle: "Tanky wardens" },
  rhi_cipher: {
    title: "Plate Gates",
    subtitle: "Rest if you need it",
    dialogue: {
      name: "Cassian",
      lines: [`"The plates sweep the hall. Cross in the gap and take the far pad."`, `"Breathe. Plate armory waits."`],
    },
  },
  rhi_armory: { title: "Plate Armory", subtitle: "Hardened iron" },
  rhi_narrow: { title: "Narrow Gore", subtitle: "No room to miss" },
  rhi_approach: { title: "Captain Approach", subtitle: "Last wall" },
  rhi_boss: {
    title: "Captain's Hide",
    subtitle: "Rhinus waits",
    dialogue: {
      name: "Cassian",
      lines: [`"Captain Rhinus. Charge plus armor — don't trade blows in the line."`, `"End him and Rhinoceros opens."`],
    },
  },
};

export const ELEPHAS_BRIEFINGS: Record<string, RaidBriefing> = {
  ele_yard: {
    title: "Ivory Yard",
    subtitle: "The last house",
    dialogue: {
      name: "Cassian",
      lines: [
        `"Elephas stamps the corridors. Sweep lanes kill if you linger — time your crosses."`,
        `"This is the climax. Clear the ivory yard."`,
      ],
    },
  },
  ele_sweep: { title: "Stampede Walk", subtitle: "Timed sweeps" },
  ele_hall: { title: "Ivory Hall", subtitle: "Vertical rush" },
  ele_cipher: {
    title: "Ivory Crossing",
    subtitle: "Rest if you need it",
    dialogue: {
      name: "Cassian",
      lines: [`"Time the stampede. Reach the ivory pad between sweeps."`, `"Rest well. The hardest halls wait."`],
    },
  },
  ele_pens: { title: "Tusk Pens", subtitle: "Heavy packs" },
  ele_vault: { title: "Ivory Vault", subtitle: "Elites" },
  ele_approach: { title: "Stampede Approach", subtitle: "Double sweeps" },
  ele_boss: {
    title: "Captain's Ivory",
    subtitle: "Elephantus waits",
    dialogue: {
      name: "Cassian",
      lines: [`"Captain Elephantus. Stampede and hammer — finish the nine."`, `"End him and every house stands free."`],
    },
  },
};

/** @deprecated use getRaidBriefing from raid/index */
export function getSerpensBriefing(roomId: string): RaidBriefing {
  return getBriefingFromMap(SERPENS_BRIEFINGS, roomId);
}
