import type { Card, Suit } from "./types";
import { SUITS } from "./types";

// ── src/game/random.ts — RNG abstraction (interface + MathRNG prod / SeededRNG test) and the 44-card deck factory. ──
// Depends on: ./types.
// Used by: src/room.ts (MathRNG instance), src/game/machine.ts, src/game/setup.ts, all tests/*.test.ts (SeededRNG).

// ── RNG abstraction ──────────────────────────────────────────────────

/** Reproducible or real random-number generator. */
export interface RNG {
  /** Integer in [0, max). */
  nextInt(max: number): number;
  /** Fisher-Yates shuffle in-place, returns the same array. */
  shuffle<T>(arr: T[]): T[];
  /** Random element from a non-empty array. */
  pick<T>(arr: T[]): T;
}

// ── MathRNG (production) ─────────────────────────────────────────────

/** Wraps crypto.getRandomValues — available in Workers and bun test. */
export class MathRNG implements RNG {
  nextInt(max: number): number {
    if (max <= 0) return 0;
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0]! >>> 0) % max;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }

  pick<T>(arr: T[]): T {
    return arr[this.nextInt(arr.length)]!;
  }
}

// ── SeededRNG (tests) ────────────────────────────────────────────────

/**
 * Deterministic 32-bit xorshift.  Produces the same sequence for a given
 * seed, making race outcomes reproducible in tests.
 */
export class SeededRNG implements RNG {
  private state: number;

  constructor(seed: number) {
    // ensure non-zero
    this.state = (seed | 0) || 1;
  }

  private step(): number {
    let x = this.state | 0;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x;
    return x;
  }

  nextInt(max: number): number {
    if (max <= 0) return 0;
    // Use the full 31-bit range for uniform distribution
    return (Math.abs(this.step()) >>> 0) % max;
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.nextInt(i + 1);
      const tmp = arr[i]!;
      arr[i] = arr[j]!;
      arr[j] = tmp;
    }
    return arr;
  }

  pick<T>(arr: T[]): T {
    return arr[this.nextInt(arr.length)]!;
  }
}

// ── Deck helpers ─────────────────────────────────────────────────────

/** Create a fresh 44-card draw pile and shuffle it with the given RNG. */
export function makeDeck(rng: RNG): Card[] {
  const ranks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12];
  const pile: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of ranks) {
      pile.push({ rank, suit });
    }
  }
  return rng.shuffle(pile);
}
