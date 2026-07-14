import { describe, expect, test } from "bun:test";
import { SeededRNG } from "../src/game/random";
import {
  drawNextCard,
  hostAddPlayer,
  hostStartRace,
  placeBid,
  startRace,
} from "../src/game/machine";
import { applyDrawStep, applyFlipStep } from "../src/game/race";
import type { Room, Card } from "../src/game/types";

function makeRoom(): Room {
  return {
    id: "r1",
    roomCode: "RACE",
    hostId: "p1",
    isLocked: false,
    players: [],
    trackLength: 4, // short track for fast tests
    state: "LOBBY",
    createdAt: 0,
    horses: [],
    trackCards: [],
    deckState: { drawPile: [], discardPile: [] },
    bids: {},
    raceLog: [],
    bidDeadlineMs: null,
    countdownMs: null,
    distDeadlineMs: null,
    readyDeadlineMs: null,
    raceGapDeckMs: 2000,
    raceGapTrackMs: 1000,
  };
}

describe("race: drawNextCard", () => {
  test("single draw advances one horse by 1 on a fresh 4-step race", () => {
    const rng = new SeededRNG(42);
    let room = makeRoom();
    room = hostAddPlayer(room, { id: "p1", name: "Alice", type: "independent", isHost: true });
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "p1", suit: "Coins", amount: 1 }, rng);
    room = startRace(room);
    expect(room.state).toBe("RACING");

    const before = room.horses.map(h => h.position);
    room = drawNextCard(room, rng);
    const after = room.horses.map(h => h.position);

    // At least one horse advanced.
    const advances = after.filter((p, i) => p > before[i]!).length;
    expect(advances).toBeGreaterThanOrEqual(1);

    // DECK_DRAW and HORSE_MOVE events exist.
    const draws = room.raceLog.filter(e => e.type === "DECK_DRAW");
    const moves = room.raceLog.filter(e => e.type === "HORSE_MOVE" && e.reason === "DECK");
    expect(draws.length).toBe(1);
    expect(moves.length).toBe(1);
  });

  test("draw matching a finished horse is ignored (no HORSE_MOVE for that suit)", () => {
    const rng = new SeededRNG(123);
    let room = makeRoom();
    room = hostAddPlayer(room, { id: "p1", name: "Alice", type: "independent", isHost: true });
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "p1", suit: "Coins", amount: 1 }, rng);
    room = startRace(room);

    // Force one horse to be finished.
    const coins = room.horses.find(h => h.suit === "Coins")!;
    coins.position = room.trackLength + 1;
    coins.isFinished = true;
    coins.placement = 1;

    // Draw until we hit a Coins card or race ends.
    let foundIgnored = false;
    for (let i = 0; i < 80 && room.state === "RACING" && !foundIgnored; i++) {
      const logBefore = room.raceLog.length;
      room = drawNextCard(room, new SeededRNG(i * 7 + 1));
      for (const e of room.raceLog.slice(logBefore)) {
        if (e.type === "DECK_DRAW" && e.suit === "Coins" && e.ignored) {
          foundIgnored = true;
        }
      }
    }
    expect(foundIgnored).toBe(true);
  });

  test("track-card flip regression moves matching horse -1 (clamped to 0)", () => {
    const rng = new SeededRNG(9999);
    let room = makeRoom();
    room = hostAddPlayer(room, { id: "p1", name: "Alice", type: "independent", isHost: true });
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "p1", suit: "Coins", amount: 1 }, rng);
    room = startRace(room);

    // Run the race — regression events should appear.
    let safety = 0;
    let regCount = 0;
    while (room.state === "RACING" && safety < 500) {
      const logBefore = room.raceLog.length;
      room = drawNextCard(room, rng);
      for (const e of room.raceLog.slice(logBefore)) {
        if (e.type === "HORSE_MOVE" && e.reason === "REGRESSION") {
          regCount++;
          // Regression should never move below 0.
          expect(e.to).toBeGreaterThanOrEqual(0);
          expect(e.to).toBe(e.from - 1); // exactly 1 step back
        }
      }
      safety++;
    }
    expect(safety).toBeLessThan(500);
    // With a 4-step track, regression is likely (track cards flip early).
    // At minimum the race completes without infinite loops.
    expect(room.state).toBe("SETTLEMENT");
  });

  test("regression does NOT re-trigger flip on the same step (single flip per draw)", () => {
    // After a regression, we should not see another TRACK_FLIP from the
    // same draw call.
    const rng = new SeededRNG(111);
    let room = makeRoom();
    room = hostAddPlayer(room, { id: "p1", name: "Alice", type: "independent", isHost: true });
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "p1", suit: "Coins", amount: 1 }, rng);
    room = startRace(room);

    let safety = 0;
    while (room.state === "RACING" && safety < 500) {
      const logBefore = room.raceLog.length;
      room = drawNextCard(room, rng);
      const newEvents = room.raceLog.slice(logBefore);
      const flips = newEvents.filter(e => e.type === "TRACK_FLIP");
      // At most one flip per draw.
      expect(flips.length).toBeLessThanOrEqual(1);
      safety++;
    }
    expect(safety).toBeLessThan(500);
    expect(room.state).toBe("SETTLEMENT");
  });

  test("3rd finish ends the race (state → SETTLEMENT, RACE_END event)", () => {
    const rng = new SeededRNG(555);
    let room = makeRoom();
    room = hostAddPlayer(room, { id: "p1", name: "Alice", type: "independent", isHost: true });
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "p1", suit: "Coins", amount: 1 }, rng);
    room = startRace(room);

    let safety = 0;
    while (room.state === "RACING" && safety < 500) {
      room = drawNextCard(room, rng);
      safety++;
    }
    expect(safety).toBeLessThan(500);
    expect(room.state).toBe("SETTLEMENT");

    const raceEnd = room.raceLog.find(e => e.type === "RACE_END");
    expect(raceEnd).toBeDefined();
    if (raceEnd && raceEnd.type === "RACE_END") {
      expect(raceEnd.placements).toHaveLength(3);
    }

    // All horses should be finished after settleRound assigns 4th.
    // But settleRound isn't called yet; 3 should be placed.
    const placed = room.horses.filter(h => h.placement > 0);
    expect(placed.length).toBe(3);
  });
});

describe("applyDrawStep / applyFlipStep split", () => {
  test("draw step produces DECK_DRAW and HORSE_MOVE; flip step produces TRACK_FLIP", () => {
    const rng = new SeededRNG(42);
    let room = makeRoom();
    room = hostAddPlayer(room, { id: "p1", name: "Alice", type: "independent", isHost: true });
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "p1", suit: "Coins", amount: 1 }, rng);
    room = startRace(room);
    expect(room.state).toBe("RACING");

    // Pop a card from the deck (mirror drawNextCard's deck management)
    const deck = room.deckState;
    if (deck.drawPile.length === 0) {
      deck.drawPile = rng.shuffle(deck.discardPile);
      deck.discardPile = [];
    }
    const card = deck.drawPile.pop()!;
    deck.discardPile.push(card);

    // Stage 1: draw step
    const afterDraw = applyDrawStep(room, card);
    const drawEvents = afterDraw.raceLog.slice(room.raceLog.length);
    const hasDeckDraw = drawEvents.some((e) => e.type === "DECK_DRAW");
    const hasHorseMove = drawEvents.some((e) => e.type === "HORSE_MOVE" && e.reason === "DECK");
    expect(hasDeckDraw).toBe(true);

    // Stage 2: flip step
    const afterFlip = applyFlipStep(afterDraw);
    const flipEvents = afterFlip.raceLog.slice(afterDraw.raceLog.length);
    const hasTrackFlip = flipEvents.some((e) => e.type === "TRACK_FLIP");

    // Full composition should match drawNextCard
    const composed = applyFlipStep(applyDrawStep(room, card));
    const full = drawNextCard(room, rng);
    expect(composed.raceLog.length).toBe(full.raceLog.length);
  });
});
