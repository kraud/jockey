import { describe, expect, test } from "bun:test";
import { SeededRNG } from "../src/game/random";
import { makeTrack, makeDeckState } from "../src/game/setup";
import { SUITS } from "../src/game/types";

describe("makeTrack", () => {
  test("returns correct number of cards", () => {
    const rng = new SeededRNG(1);
    const track = makeTrack(rng, 6);
    expect(track).toHaveLength(6);
  });

  test("all cards have valid suits", () => {
    const rng = new SeededRNG(1);
    const track = makeTrack(rng, 20);
    for (const card of track) {
      expect(SUITS).toContain(card.suit);
    }
  });

  test("indices are sequential 1..N", () => {
    const rng = new SeededRNG(1);
    const track = makeTrack(rng, 10);
    for (let i = 0; i < 10; i++) {
      expect(track[i]!.index).toBe(i + 1);
    }
  });

  test("all cards start face-down", () => {
    const rng = new SeededRNG(1);
    const track = makeTrack(rng, 8);
    for (const card of track) {
      expect(card.isFlipped).toBe(false);
    }
  });

  test("per-card suit distribution is roughly uniform", () => {
    const counts: Record<number, Record<string, number>> = {};
    for (let i = 1; i <= 6; i++) {
      counts[i] = {};
      for (const s of SUITS) counts[i]![s] = 0;
    }

    for (let seed = 0; seed < 10_000; seed++) {
      const rng = new SeededRNG(seed);
      const track = makeTrack(rng, 6);
      for (const card of track) {
        counts[card.index]![card.suit]!++;
      }
    }

    for (let i = 1; i <= 6; i++) {
      for (const s of SUITS) {
        const ratio = counts[i]![s]! / 10_000;
        expect(ratio).toBeGreaterThan(0.2);
        expect(ratio).toBeLessThan(0.3);
      }
    }
  });
});

describe("makeDeckState", () => {
  test("produces 44-card draw pile", () => {
    const rng = new SeededRNG(42);
    const deck = makeDeckState(rng);
    expect(deck.drawPile).toHaveLength(44);
  });

  test("draw pile has no rank 11", () => {
    const rng = new SeededRNG(42);
    const deck = makeDeckState(rng);
    for (const card of deck.drawPile) {
      expect(card.rank).not.toBe(11);
    }
  });

  test("draw pile has exactly 11 cards per suit", () => {
    const rng = new SeededRNG(42);
    const deck = makeDeckState(rng);
    for (const suit of SUITS) {
      const count = deck.drawPile.filter((c) => c.suit === suit).length;
      expect(count).toBe(11);
    }
  });

  test("discard pile starts empty", () => {
    const rng = new SeededRNG(1);
    const deck = makeDeckState(rng);
    expect(deck.discardPile).toHaveLength(0);
  });
});
