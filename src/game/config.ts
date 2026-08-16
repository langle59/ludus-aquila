export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TILE_SIZE = 32;
export const HUD_CAM_PAD = 120;
export const UNGUENT_MAX = 3;
export const UNGUENT_COST = 16;
export const SAVE_KEY = "ludus-aquila-save-v1";
export const SAVE_SLOT_COUNT = 3;
export const ACTIVE_SLOT_KEY = "ludus-aquila-active-slot-v1";
export const SETTINGS_KEY = "ludus-aquila-settings-v1";

export function saveSlotKey(slot: number): string {
  return `${SAVE_KEY}-slot-${slot}`;
}

export const COLORS = {
  sand: 0xc2a36b,
  dirt: 0x9a7a4a,
  stone: 0x7a7368,
  wall: 0x4a4038,
  wood: 0x6b4a2f,
  crimson: 0xa33b2b,
  gold: 0xd4a84b,
  white: 0xe8dcc8,
  foxOrange: 0xc45a1a,
  foxBlack: 0x1c1410,
  serpentGreen: 0x2f6b4a,
  bearBrown: 0x6a3e24,
  wolfGrey: 0x6a6e78,
  lionGold: 0xc49a28,
  bullRed: 0x8a2820,
  boarHide: 0x5a4030,
  ravenBlack: 0x3a3450,
  tigerOrange: 0xd46818,
  rhinoHide: 0x6a6870,
  elephantGrey: 0x9a9aa0,
  uiDark: 0x1a1210,
  uiPanel: 0x2a1c16,
  hp: 0xb33a2b,
  stamina: 0xd4a84b,
  xp: 0x6aa84f,
  unguent: 0x6a8a4a,
};

export const CONTROLS_TEXT = [
  "WASD / Arrow Keys — Move",
  "ATTACK button or Space — Light attack",
  "HEAVY button or G — Heavy attack",
  "Shift — Dodge (roll into a swing for a perfect dodge)",
  "Q — Block (hold)",
  "R — Special",
  "F — Parry (tap into a swing)",
  "V — Drink unguent (bought vials; restores health and stamina)",
  "E — Talk / Interact",
  "Tab — Equipment",
  "K — Skill Tree",
  "C — Customize / Shop (looks, and unguent vials)",
  "M — Minimap (ludus)",
  "Esc — Pause",
].join("\n");
