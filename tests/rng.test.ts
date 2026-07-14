import { describe, expect, test } from "bun:test";
import { SeededRNG } from "../src/game/random";

describe("SeededRNG", () => {
  test("produces reproducible sequences", () => {
    const a = new SeededRNG(42);
    const b = new SeededRNG(42);
    const seqA = Array.from({ length: 10 }, () => a.nextInt(100));
    const seqB = Array.from({ length: 10 }, () => b.nextInt(100));
    expect(seqA).toEqual(seqB);
  });

  test("different seeds produce different sequences", () => {
    const a = new SeededRNG(42);
    const b = new SeededRNG(99);
    const seqA = Array.from({ length: 5 }, () => a.nextInt(100));
    const seqB = Array.from({ length: 5 }, () => b.nextInt(100));
    expect(seqA).not.toEqual(seqB);
  });

  test("nextInt returns values in [0, max)", () => {
    const rng = new SeededRNG(7);
    for (let i = 0; i < 1000; i++) {
      const v = rng.nextInt(10);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(10);
    }
  });

  test("nextInt(0) returns 0", () => {
    const rng = new SeededRNG(1);
    expect(rng.nextInt(0)).toBe(0);
  });

  test("nextInt(1) always returns 0", () => {
    const rng = new SeededRNG(1);
    for (let i = 0; i < 100; i++) {
      expect(rng.nextInt(1)).toBe(0);
    }
  });

  test("shuffle preserves length and elements", () => {
    const rng = new SeededRNG(42);
    const original = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle([...original]);
    expect(shuffled).toHaveLength(original.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(original);
  });

  test("pick returns an element from the array", () => {
    const rng = new SeededRNG(1);
    const arr = ["a", "b", "c"];
    const result = rng.pick(arr);
    expect(arr).toContain(result);
  });
});
