import { gameState } from "../state/GameState";
import { addDenarii } from "./progression";

export const TABLE_BETS = [10, 25, 50] as const;

export const TABLE_GAMES = [
  { id: "alea", name: "ALEA", available: true },
  { id: "blackjack", name: "BLACKJACK", available: true },
  { id: "soon", name: "SOON", available: false },
] as const;

export type TableGameId = (typeof TABLE_GAMES)[number]["id"];

export type AleaResult = {
  bet: number;
  player: number;
  house: number;
  playerDice: [number, number];
  houseDice: [number, number];
  outcome: "win" | "lose" | "push";
};

export type Suit = "hearts" | "diamonds" | "clubs" | "spades";
export type Card = { suit: Suit; rank: number };

export type BlackjackOutcome = "win" | "lose" | "push" | "blackjack";

function d6(): number {
  return 1 + Math.floor(Math.random() * 6);
}

export function takeTableBet(bet: number): "ok" | "poor" | "locked" {
  if (!gameState.save.freedomWon) return "locked";
  if (!(TABLE_BETS as readonly number[]).includes(bet)) return "poor";
  if (gameState.save.denarii < bet) return "poor";
  addDenarii(-bet);
  gameState.persist();
  return "ok";
}

export function settleTakenBet(bet: number, outcome: "win" | "lose" | "push" | "blackjack"): void {
  if (outcome === "push") addDenarii(bet);
  else if (outcome === "win") addDenarii(bet * 2);
  else if (outcome === "blackjack") addDenarii(bet + Math.floor(bet * 1.5));
  gameState.persist();
}

export function rollAleaDice(): { player: [number, number]; house: [number, number] } {
  return {
    player: [d6(), d6()],
    house: [d6(), d6()],
  };
}

export function aleaOutcome(player: number, house: number): "win" | "lose" | "push" {
  if (player > house) return "win";
  if (player < house) return "lose";
  return "push";
}

const SUITS: Suit[] = ["hearts", "diamonds", "clubs", "spades"];

export function cardTex(card: Card): string {
  return `card-${card.suit}-${card.rank}`;
}

export function cardLabel(card: Card): string {
  const names = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  return names[card.rank - 1] ?? "?";
}

export function freshDeck(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) deck.push({ suit, rank });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = deck[i]!;
    const b = deck[j]!;
    deck[i] = b;
    deck[j] = a;
  }
  return deck;
}

export function drawCard(deck: Card[]): Card {
  return deck.pop() ?? { suit: "spades", rank: 1 };
}

export function handTotal(cards: Card[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 1) {
      aces += 1;
      total += 11;
    } else if (c.rank >= 11) total += 10;
    else total += c.rank;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

export function isNatural(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

export function dealerShouldHit(cards: Card[]): boolean {
  return handTotal(cards) < 17;
}

export function blackjackCompare(player: Card[], house: Card[]): BlackjackOutcome {
  const p = handTotal(player);
  const h = handTotal(house);
  const pNat = isNatural(player);
  const hNat = isNatural(house);
  if (p > 21) return "lose";
  if (h > 21) return pNat ? "blackjack" : "win";
  if (pNat && hNat) return "push";
  if (pNat) return "blackjack";
  if (hNat) return "lose";
  if (p > h) return "win";
  if (p < h) return "lose";
  return "push";
}
