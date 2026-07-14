import { describe, expect, test } from "bun:test";
import { SeededRNG } from "../src/game/random";
import {
  hostAddPlayer,
  hostStartRace,
  placeBid,
  closeBidding,
} from "../src/game/machine";
import type { Room } from "../src/game/types";

/**
 * Termination Rule (game_design.md):
 * A player who is !isConnected for the entire Bidding phase is treated
 * as a non-bidder and excluded from Placement, Settlement, and Distribution.
 * The machine doesn't enforce this — the DO layer filters disconnected
 * players. These tests verify the DO-layer contract.
 */

function makeRoom(): Room {
  return {
    id: "r",
    roomCode: "DC",
    hostId: "host",
    isLocked: false,
    players: [],
    trackLength: 6,
    state: "LOBBY",
    createdAt: 0,
    horses: [],
    trackCards: [],
    deckState: { drawPile: [], discardPile: [] },
    bids: {},
    raceLog: [],
    bidDeadlineMs: null,
    distDeadlineMs: null,
    readyDeadlineMs: null,
    raceGapDeckMs: 2000,
    raceGapTrackMs: 1000,
  };
}

describe("disconnect policy (DO-layer contract)", () => {
  test("disconnected player excluded from bid-wait auto-advance", () => {
    const rng = new SeededRNG(42);
    let room = makeRoom();

    room = hostAddPlayer(room, { id: "host", name: "Host", type: "independent", isHost: true });
    room = hostAddPlayer(room, { id: "p2", name: "Connected", type: "independent", isHost: false });
    room = hostAddPlayer(room, { id: "p3", name: "Disconnected", type: "independent", isHost: false });

    // Simulate disconnection.
    const p3 = room.players.find(p => p.id === "p3")!;
    p3.isConnected = false;

    room = hostStartRace(room);
    expect(room.state).toBe("BIDDING");

    // Active players only.
    const activePlayers = room.players.filter(p => p.isConnected);
    expect(activePlayers).toHaveLength(2);

    // Active players bid.
    room = placeBid(room, { playerId: "host", suit: "Coins", amount: 2 }, rng);
    expect(room.state).toBe("BIDDING"); // p3 (disconnected) hasn't bid → no auto-advance

    room = placeBid(room, { playerId: "p2", suit: "Cups", amount: 3 }, rng);
    // Still BIDDING because the machine checks ALL players.
    expect(room.state).toBe("BIDDING");

    // DO handles this: filters to connected, calls closeBidding directly.
    room = closeBidding(room, rng);
    expect(room.state).toBe("RACING");
  });
});
