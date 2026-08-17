import type { RaidHouseId } from "../types";

export type RefugeeDef = {
  id: string;
  name: string;
  tunic: number;
  accent: number;
  scale: number;
  lines: string[];
  volunteerLine?: string;
};

const SERPENS_REFUGEES: RefugeeDef[] = [
  {
    id: "refugee-serpens-0",
    name: "Neris",
    tunic: 0x2f6b4a,
    accent: 0xc9c070,
    scale: 0.92,
    lines: [
      `"The coil is broken. We sleep under leaves now — not bars."`,
      `"Cassian found this clearing. Tell him the Serpens remember."`,
    ],
  },
  {
    id: "refugee-serpens-1",
    name: "Vara",
    tunic: 0x1e4a38,
    accent: 0xd8efe8,
    scale: 0.9,
    lines: [
      `"Captain Virex kept the keys. You took them. That is enough."`,
      `"If you march again, take water. The road east is dry."`,
    ],
  },
];

/** Stub lines for houses not yet raidable — ready when those pads fill. */
function stubRefugees(houseId: RaidHouseId, names: [string, string], tunic: number, accent: number): RefugeeDef[] {
  return [
    {
      id: `refugee-${houseId}-0`,
      name: names[0],
      tunic,
      accent,
      scale: 0.92,
      lines: [`"${names[0]} nods from the tent."`, `"The forest hides us. For now."`],
    },
    {
      id: `refugee-${houseId}-1`,
      name: names[1],
      tunic: shadeish(tunic),
      accent,
      scale: 0.9,
      lines: [`"${names[1]} keeps watch on the path."`, `"When more houses open, this clearing will grow."`],
    },
  ];
}

function shadeish(c: number): number {
  const r = (c >> 16) & 0xff;
  const g = (c >> 8) & 0xff;
  const b = c & 0xff;
  return ((Math.max(0, r - 24) << 16) | (Math.max(0, g - 24) << 8) | Math.max(0, b - 24)) >>> 0;
}

const LUPUS_REFUGEES: RefugeeDef[] = [
  {
    id: "refugee-lupus-0",
    name: "Acca",
    tunic: 0x6a6e78,
    accent: 0xc9d2dc,
    scale: 0.92,
    lines: [
      `"The pack howled as one. You broke the howl."`,
      `"Acca keeps the moon watch. Lupus remembers."`,
    ],
  },
  {
    id: "refugee-lupus-1",
    name: "Faustus",
    tunic: 0x4a5058,
    accent: 0xd0d4d8,
    scale: 0.9,
    lines: [
      `"Alpha Lupa is gone. The kennels are quiet."`,
      `"If you march on Aper next — mud slows the legs. Step light."`,
    ],
  },
];

const APER_REFUGEES: RefugeeDef[] = [
  {
    id: "refugee-aper-0",
    name: "Cossus",
    tunic: 0x5a4030,
    accent: 0xe0c090,
    scale: 0.92,
    lines: [
      `"Scrofa charged. You stood. The sty is ours now."`,
      `"Cossus nods toward the east. More houses wait."`,
    ],
  },
  {
    id: "refugee-aper-1",
    name: "Maia",
    tunic: 0x3a2818,
    accent: 0xd4a878,
    scale: 0.9,
    lines: [
      `"Mud still clings. We sleep cleaner here."`,
      `"Tell Cassian the boar-kin thank the night raid."`,
    ],
  },
];

const TAURUS_REFUGEES: RefugeeDef[] = [
  {
    id: "refugee-taurus-0",
    name: "Bos",
    tunic: 0x8a2820,
    accent: 0xe8dcc8,
    scale: 0.92,
    lines: [
      `"Taurinus charged the ring. You stepped aside. The horns are ours."`,
      `"Bos keeps the east watch. Tell Cassian the bull-kin remember."`,
    ],
  },
  {
    id: "refugee-taurus-1",
    name: "Cornu",
    tunic: 0x6a1810,
    accent: 0xd4c0a8,
    scale: 0.9,
    lines: [
      `"Lanes funnel the rush. We sleep without fences now."`,
      `"Tigris waits in shadow next — don't trust empty dark."`,
    ],
  },
];

const TIGRIS_REFUGEES: RefugeeDef[] = [
  {
    id: "refugee-tigris-0",
    name: "Stria",
    tunic: 0xd46818,
    accent: 0x1a1210,
    scale: 0.92,
    lines: [
      `"Striata waited in the dark. You forced the fight. The stripes fade."`,
      `"Stria keeps quiet watch. Tigris remembers the torch."`,
    ],
  },
  {
    id: "refugee-tigris-1",
    name: "Pardus",
    tunic: 0xa04810,
    accent: 0xe8d0b0,
    scale: 0.9,
    lines: [
      `"Ambush halls taught us patience. Here we speak aloud."`,
      `"Leo wakes as one — expect the roar when you march."`,
    ],
  },
];

const LEO_REFUGEES: RefugeeDef[] = [
  {
    id: "refugee-leo-0",
    name: "Aurelia",
    tunic: 0xc49a28,
    accent: 0x1a1210,
    scale: 0.92,
    lines: [
      `"Leonis roared. The pride answered. You ended both."`,
      `"Aurelia stands gold-ward. Leo kneels to no captain now."`,
    ],
  },
  {
    id: "refugee-leo-1",
    name: "Mane",
    tunic: 0xa07818,
    accent: 0xe8dcc8,
    scale: 0.9,
    lines: [
      `"Shield walls break when the captain falls."`,
      `"Ursus is rubble and hammer. Don't linger on the pads."`,
    ],
  },
];

const URSUS_REFUGEES: RefugeeDef[] = [
  {
    id: "refugee-ursus-0",
    name: "Ursa",
    tunic: 0x6a3e24,
    accent: 0xe0c090,
    scale: 0.92,
    lines: [
      `"Ursinus barely moved when struck. You wore him down. The cave is ours."`,
      `"Ursa stacks timber for the fire. Ursus remembers."`,
    ],
  },
  {
    id: "refugee-ursus-1",
    name: "Hostus",
    tunic: 0x4a2818,
    accent: 0xd0b080,
    scale: 0.9,
    lines: [
      `"Rubble still aches in the knees. Clean ground here."`,
      `"Rhinoceros is plate and gore — narrow lanes, hard charges."`,
    ],
  },
];

const RHINOCEROS_REFUGEES: RefugeeDef[] = [
  {
    id: "refugee-rhinoceros-0",
    name: "Cornix",
    tunic: 0x6a6870,
    accent: 0xc9c0b0,
    scale: 0.92,
    lines: [
      `"Rhinus charged in plate. You broke the hide. We breathe."`,
      `"Cornix watches the east road. One house left."`,
    ],
  },
  {
    id: "refugee-rhinoceros-1",
    name: "Durus",
    tunic: 0x4a4850,
    accent: 0xb8b0a0,
    scale: 0.9,
    lines: [
      `"Narrow gore taught us to step aside."`,
      `"Elephas stamps the corridors — time your crosses."`,
    ],
  },
];

const ELEPHAS_REFUGEES: RefugeeDef[] = [
  {
    id: "refugee-elephas-0",
    name: "Eburna",
    tunic: 0x9a9aa0,
    accent: 0xe8dcc8,
    scale: 0.92,
    lines: [
      `"Elephantus fell. Nine houses free. The night raids are done."`,
      `"Eburna bows. Ivory sleeps under the trees now."`,
    ],
  },
  {
    id: "refugee-elephas-1",
    name: "Probos",
    tunic: 0x787870,
    accent: 0xd8d0b8,
    scale: 0.9,
    lines: [
      `"Stampede lanes are quiet. We farm. We rest."`,
      `"Tell Cassian: every pad is filled. The clearing is home."`,
    ],
  },
];

const BY_HOUSE: Record<string, RefugeeDef[]> = {
  serpens: SERPENS_REFUGEES,
  lupus: LUPUS_REFUGEES,
  aper: APER_REFUGEES,
  taurus: TAURUS_REFUGEES,
  tigris: TIGRIS_REFUGEES,
  leo: LEO_REFUGEES,
  ursus: URSUS_REFUGEES,
  rhinoceros: RHINOCEROS_REFUGEES,
  elephas: ELEPHAS_REFUGEES,
};

export function refugeesForHouse(houseId: string): RefugeeDef[] {
  return BY_HOUSE[houseId] ?? stubRefugees(houseId as RaidHouseId, ["Freed", "Kin"], 0x6a5a4a, 0xe8dcc8);
}

export function getRefugee(id: string): RefugeeDef | undefined {
  for (const list of Object.values(BY_HOUSE)) {
    const hit = list.find((r) => r.id === id);
    if (hit) return hit;
  }
  return undefined;
}

const VOLUNTEER_LINES: Record<string, string> = {
  "refugee-serpens-0": `"I know Serpens yards — pick me at the party ring."`,
  "refugee-serpens-1": `"Vara can march. Choose me at the party ring."`,
  "refugee-lupus-0": `"Acca hears the pack — I'll march if you pick me."`,
  "refugee-lupus-1": `"Faustus keeps moon-watch. Select me at the party ring."`,
  "refugee-aper-0": `"Cossus won't charge alone — pick me at the party ring."`,
  "refugee-aper-1": `"Maia knows the mud lanes. Choose me at the party ring."`,
  "refugee-taurus-0": `"Bos reads horn lanes — pick me at the party ring."`,
  "refugee-taurus-1": `"Cornu sidesteps charges. Select me at the party ring."`,
  "refugee-tigris-0": `"Stria stalks in dark — pick me at the party ring."`,
  "refugee-tigris-1": `"Pardus waits in shadow. Choose me at the party ring."`,
  "refugee-leo-0": `"Aurelia can roar once — pick me at the party ring."`,
  "refugee-leo-1": `"Mane shields the line. Select me at the party ring."`,
  "refugee-ursus-0": `"Ursa knows the rubble — pick me at the party ring."`,
  "refugee-ursus-1": `"Hostus stacks timber and steel. Choose me at the party ring."`,
  "refugee-rhinoceros-0": `"Cornix wears plate like hide — pick me at the party ring."`,
  "refugee-rhinoceros-1": `"Durus steps aside from gore. Select me at the party ring."`,
  "refugee-elephas-0": `"Eburna hears stampede rhythm — pick me at the party ring."`,
  "refugee-elephas-1": `"Probos times the sweeps. Choose me at the party ring."`,
};

export function refugeeVolunteerLine(id: string): string {
  return VOLUNTEER_LINES[id] ?? `"I can march with you — pick me at the party ring."`;
}
