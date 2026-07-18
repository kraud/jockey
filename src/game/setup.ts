import type { RNG } from "./random";
import type { DeckState, TrackCard } from "./types";
import { SUITS } from "./types";
import { makeDeck } from "./random";

// ── src/game/setup.ts — Build the track (length random-suit cards) and the initial shuffled deck state. ──
// Depends on: ./types, ./random.
// Used by: src/game/machine.ts (closeBidding).

/**
 * Build the track: `length` face-down cards, each suit picked uniformly at
 * random.  Indexed 1..length.
 */
export function makeTrack(rng: RNG, length: number): TrackCard[] {
  const cards: TrackCard[] = [];
  for (let i = 1; i <= length; i++) {
    cards.push({
      index: i,
      suit: SUITS[rng.nextInt(4)]!,
      isFlipped: false,
    });
  }
  return cards;
}

/**
 * Create a fresh shuffled draw pile and an empty discard pile.
 */
export function makeDeckState(rng: RNG): DeckState {
  return {
    drawPile: makeDeck(rng),
    discardPile: [],
  };
}
