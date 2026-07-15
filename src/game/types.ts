// ── Suits ────────────────────────────────────────────────────────────
export type Suit = "Coins" | "Cups" | "Swords" | "Clubs";

/** Ordered tuple — index 0..3 maps to the four horses. */
export const SUITS: readonly Suit[] = ["Coins", "Cups", "Swords", "Clubs"];

/** Runtime type guard for Suit. */
export function isSuit(x: unknown): x is Suit {
  return typeof x === "string" && (SUITS as readonly string[]).includes(x);
}

// ── Player ───────────────────────────────────────────────────────────
export type PlayerType = "independent" | "hosted";

export interface Player {
  id: string;
  name: string;
  type: PlayerType;
  isConnected: boolean;
  drinks: {
    give: number;    // drinks to give away this round
    take: number;    // penalty drinks auto-added
    consume: number; // drinks to consume this round
    isReady: boolean;
    gaveAll: boolean; // player marked distribution as done
  };
}

// ── Phases ───────────────────────────────────────────────────────────
export type Phase =
  | "LOBBY"
  | "BIDDING"
  | "COUNTDOWN"
  | "SETUP"
  | "RACING"
  | "SETTLEMENT"
  | "DISTRIBUTION"
  | "READY";

// ── Bid ──────────────────────────────────────────────────────────────
export interface Bid {
  playerId: string;
  suit: Suit;
  amount: number;
  submittedAt: number; // Date.now()
}

// ── Horse ────────────────────────────────────────────────────────────
export interface Horse {
  suit: Suit;
  position: number;   // 0 at start, finishes at trackLength+1
  isFinished: boolean;
  placement: number;  // 0 = unplaced, 1..4 after finish
}

// ── Cards ────────────────────────────────────────────────────────────
export interface Card {
  rank: number;  // 1..12 (11 excluded from draw pile)
  suit: Suit;
}

// ── Track ────────────────────────────────────────────────────────────
export interface TrackCard {
  index: number;   // 1..N, step number
  suit: Suit;
  isFlipped: boolean;
}

// ── Deck ─────────────────────────────────────────────────────────────
export interface DeckState {
  drawPile: Card[];
  discardPile: Card[];
}

// ── Race log events ──────────────────────────────────────────────────
export type RaceLogEvent =
  | { type: "DECK_DRAW";  card: Card; suit: Suit; ignored: boolean }
  | { type: "HORSE_MOVE"; suit: Suit; from: number; to: number; reason: "DECK" | "REGRESSION" }
  | { type: "TRACK_FLIP"; index: number; suit: Suit; ignored: boolean }
  | { type: "HORSE_FINISH"; suit: Suit; placement: number }
  | { type: "RACE_END"; placements: ReadonlyArray<{ suit: Suit; placement: number }> }
  | { type: "SETTLEMENT"; playerId: string; drinksGive: number; drinksTake: number }
  | { type: "DRINK_GIVE"; from: string; to: string; amount: number }
  | { type: "DRINK_CLEAR"; from: string; to: string; amount: number }
  | { type: "DRINK_AUTO"; to: string; amount: number }
  | { type: "PLAYER_READY"; playerId: string }
  | { type: "DISTRIBUTION_DONE"; playerId: string };

// ── Room ─────────────────────────────────────────────────────────────
export interface Room {
  id: string;
  roomCode: string;
  hostId: string;
  isLocked: boolean;
  players: Player[];
  trackLength: number;
  state: Phase;
  createdAt: number;
  horses: Horse[];
  trackCards: TrackCard[];
  deckState: DeckState;
  bids: Record<string, Bid>;         // playerId → Bid
  raceLog: RaceLogEvent[];
  bidDeadlineMs: number | null;
  countdownMs: number | null;
  distDeadlineMs: number | null;
  readyDeadlineMs: number | null;
  raceGapDeckMs: number;
  raceGapTrackMs: number;
  distributionTimeLimitMs: number;
}

// ── Settlement result ────────────────────────────────────────────────
export interface SettlementResult {
  playerId: string;
  drinksGive: number;
  drinksTake: number;
}

// ── Constants ────────────────────────────────────────────────────────
export const TRACK_MIN = 6;
export const TRACK_MAX = 20;
export const BID_MIN = 1;
export const BID_MAX = 5;

/** The 44-card draw pile: ranks 1..12 for each suit, excluding 11. */
export function createDrawPileConstant(): Card[] {
  const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
  const pile: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      pile.push({ rank, suit });
    }
  }
  return pile;
}
