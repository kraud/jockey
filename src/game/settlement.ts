import type { Bid, SettlementResult, Suit } from "./types";

// ── src/game/settlement.ts — Payout table: bids + placements → SettlementResult[] (V1 2/1/-1/-2 multiplier). ──
// Depends on: ./types (only).
// Used by: src/game/machine.ts (settleRound), src/room.ts (alarm).

/**
 * Compute settlement for all bidders given the race placements.
 *
 * Payout table (per game_design.md Step 7):
 *   - 1st place → bidder earns 2 × bid.amount drinks to give
 *   - 2nd place → bidder earns 1 × bid.amount drinks to give
 *   - 3rd place → bidder owes 1 × bid.amount drinks to consume (auto-consumed)
 *   - 4th place → bidder owes 2 × bid.amount drinks to consume (auto-consumed)
 *
 * @param bids       Array of bids placed this round.
 * @param placements Finished horses, ordered by placement (1st..4th).
 * @param _trackLength Reserved for V2 modifiers (unused in V1).
 */
export function computeSettlement(
  bids: Bid[],
  placements: ReadonlyArray<{ suit: Suit; placement: number }>,
  _trackLength: number,
): SettlementResult[] {
  // Build a quick lookup: suit → placement
  const suitPlacement = new Map<Suit, number>();
  for (const p of placements) {
    suitPlacement.set(p.suit, p.placement);
  }

  const results: SettlementResult[] = [];

  for (const bid of bids) {
    const placement = suitPlacement.get(bid.suit);
    // A horse that never finished (shouldn't happen in V1, but be safe).
    if (placement === undefined) continue;

    let drinksGive = 0;
    let drinksConsume = 0;

    switch (placement) {
      case 1:
        drinksGive = 2 * bid.amount;
        break;
      case 2:
        drinksGive = 1 * bid.amount;
        break;
      case 3:
        drinksConsume = 1 * bid.amount;
        break;
      case 4:
        drinksConsume = 2 * bid.amount;
        break;
    }

    results.push({
      playerId: bid.playerId,
      drinksGive,
      drinksConsume,
    });
  }

  return results;
}
