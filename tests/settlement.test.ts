import { describe, expect, test } from "bun:test";
import { computeSettlement } from "../src/game/settlement";
import type { Bid } from "../src/game/types";

describe("computeSettlement", () => {
  const placements = [
    { suit: "Coins" as const, placement: 1 },
    { suit: "Cups" as const, placement: 2 },
    { suit: "Swords" as const, placement: 3 },
    { suit: "Clubs" as const, placement: 4 },
  ];
  test("1st place → 2× bid drinks to give", () => {
    const bids: Bid[] = [{ playerId: "a", suit: "Coins", amount: 3, submittedAt: 0 }];
    const results = computeSettlement(bids, placements, 6);
    expect(results[0]!.drinksGive).toBe(6);
    expect(results[0]!.drinksConsume).toBe(0);
  });

  test("2nd place → 1× bid drinks to give", () => {
    const bids: Bid[] = [{ playerId: "b", suit: "Cups", amount: 4, submittedAt: 0 }];
    const results = computeSettlement(bids, placements, 6);
    expect(results[0]!.drinksGive).toBe(4);
    expect(results[0]!.drinksConsume).toBe(0);
  });

  test("3rd place → 1× bid drinks to consume", () => {
    const bids: Bid[] = [{ playerId: "c", suit: "Swords", amount: 2, submittedAt: 0 }];
    const results = computeSettlement(bids, placements, 6);
    expect(results[0]!.drinksGive).toBe(0);
    expect(results[0]!.drinksConsume).toBe(2);
  });

  test("4th place → 2× bid drinks to consume", () => {
    const bids: Bid[] = [{ playerId: "d", suit: "Clubs", amount: 5, submittedAt: 0 }];
    const results = computeSettlement(bids, placements, 6);
    expect(results[0]!.drinksGive).toBe(0);
    expect(results[0]!.drinksConsume).toBe(10);
  });

  test("all four outcomes in one settlement", () => {
    const bids: Bid[] = [
      { playerId: "a", suit: "Coins", amount: 3, submittedAt: 0 },
      { playerId: "b", suit: "Cups", amount: 2, submittedAt: 0 },
      { playerId: "c", suit: "Swords", amount: 4, submittedAt: 0 },
      { playerId: "d", suit: "Clubs", amount: 1, submittedAt: 0 },
    ];
    const results = computeSettlement(bids, placements, 6);
    expect(results).toHaveLength(4);

    const byPlayer = Object.fromEntries(results.map(r => [r.playerId, r]));
    expect(byPlayer["a"]!.drinksGive).toBe(6);
    expect(byPlayer["a"]!.drinksConsume).toBe(0);
    expect(byPlayer["b"]!.drinksGive).toBe(2);
    expect(byPlayer["b"]!.drinksConsume).toBe(0);
    expect(byPlayer["c"]!.drinksGive).toBe(0);
    expect(byPlayer["c"]!.drinksConsume).toBe(4);
    expect(byPlayer["d"]!.drinksGive).toBe(0);
    expect(byPlayer["d"]!.drinksConsume).toBe(2);
  });
});
