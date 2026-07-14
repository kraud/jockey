import { describe, expect, test } from "bun:test";
import { SeededRNG } from "../src/game/random";
import {
  drawNextCard,
  finishRound,
  hostAddPlayer,
  hostSetRacePacing,
  hostRenamePlayer,
  hostStartRace,
  placeBid,
  settleRound,
  startDistribution,
  finalizeDistribution,
  markReady,
  assignDrink,
  startRace,
  closeBidding,
} from "../src/game/machine";
import type { Room } from "../src/game/types";
import { GameError } from "../src/game/machine";

function makeLobbyRoom(players: Array<{ id: string; name: string; type: "independent" | "hosted" }>): Room {
  let room: Room = {
    id: "room-1",
    roomCode: "TEST",
    hostId: players[0]?.id ?? "",
    isLocked: false,
    players: [],
    trackLength: 6,
    state: "LOBBY",
    createdAt: Date.now(),
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

  for (const p of players) {
    room = hostAddPlayer(room, { id: p.id, name: p.name, type: p.type, isHost: p.id === players[0]!.id });
  }

  return room;
}

describe("drawNextCard (race)", () => {
  test("one draw advances at least one horse on a fresh race", () => {
    const rng = new SeededRNG(42);
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "a", suit: "Coins", amount: 2 }, rng);
    room = startRace(room);
    expect(room.state).toBe("RACING");

    const beforePositions = room.horses.map(h => h.position);
    room = drawNextCard(room, rng);
    const afterPositions = room.horses.map(h => h.position);
    const movedCount = afterPositions.filter((p, i) => p !== beforePositions[i]).length;
    expect(movedCount).toBeGreaterThanOrEqual(1);
  });

  test("a draw matching a finished horse is ignored (no HORSE_MOVE for that suit)", () => {
    const rng = new SeededRNG(42);
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "a", suit: "Coins", amount: 2 }, rng);
    room = startRace(room);
    expect(room.state).toBe("RACING");

    // Force Coins to be finished.
    const coinsHorse = room.horses.find(h => h.suit === "Coins")!;
    coinsHorse.position = room.trackLength + 1;
    coinsHorse.isFinished = true;
    coinsHorse.placement = 1;

    // Draw until we see a Coins DECK_DRAW or the race ends.
    let foundIgnored = false;
    let drawRng = new SeededRNG(999);
    for (let i = 0; i < 100 && !foundIgnored && room.state === "RACING"; i++) {
      const beforeLen = room.raceLog.length;
      room = drawNextCard(room, drawRng);
      const newEvents = room.raceLog.slice(beforeLen);
      for (const e of newEvents) {
        if (e.type === "DECK_DRAW" && e.suit === "Coins" && e.ignored) {
          foundIgnored = true;
        }
      }
    }
    // We should eventually hit a Coins card that's ignored.
    expect(foundIgnored).toBe(true);
  });
});

describe("race completion", () => {
  test("a complete 2-player race ends in SETTLEMENT with placements", () => {
    const rng = new SeededRNG(8675309);
    let room = makeLobbyRoom([
      { id: "a", name: "Alice", type: "independent" },
      { id: "b", name: "Bob", type: "independent" },
    ]);

    room = hostStartRace(room);
    room = placeBid(room, { playerId: "a", suit: "Coins", amount: 3 }, rng);
    room = placeBid(room, { playerId: "b", suit: "Cups", amount: 2 }, rng);
    room = startRace(room);
    expect(room.state).toBe("RACING");

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
  });

  test("3rd finish ends the race", () => {
    const rng = new SeededRNG(555);
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "a", suit: "Coins", amount: 1 }, rng);
    room = startRace(room);

    let safety = 0;
    while (room.state === "RACING" && safety < 500) {
      room = drawNextCard(room, rng);
      safety++;
    }
    expect(room.state).toBe("SETTLEMENT");
  });
});

describe("regression (track-card flip)", () => {
  test("regression does not re-trigger flip on the same step (no infinite loop)", () => {
    const rng = new SeededRNG(111);
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "a", suit: "Coins", amount: 1 }, rng);
    room = startRace(room);

    let safety = 0;
    while (room.state === "RACING" && safety < 500) {
      room = drawNextCard(room, rng);
      safety++;
    }
    expect(safety).toBeLessThan(500);
    expect(room.state).toBe("SETTLEMENT");
  });
});

describe("full round E2E", () => {
  test("start → bid → race → settle → distribute → ready → next round", () => {
    const rng = new SeededRNG(42);
    let room = makeLobbyRoom([
      { id: "a", name: "Alice", type: "independent" },
      { id: "b", name: "Bob", type: "independent" },
      { id: "c", name: "Carol", type: "independent" },
      { id: "d", name: "Dave", type: "independent" },
    ]);

    room = hostStartRace(room);
    expect(room.state).toBe("BIDDING");

    room = placeBid(room, { playerId: "a", suit: "Coins", amount: 3 }, rng);
    room = placeBid(room, { playerId: "b", suit: "Cups", amount: 2 }, rng);
    room = placeBid(room, { playerId: "c", suit: "Swords", amount: 1 }, rng);
    expect(room.state).toBe("BIDDING"); // 3 of 4, no auto-advance

    room = placeBid(room, { playerId: "d", suit: "Clubs", amount: 5 }, rng);
    room = startRace(room);
    expect(room.state).toBe("RACING"); // all 4 → auto-advance

    let safety = 0;
    while (room.state === "RACING" && safety < 500) {
      room = drawNextCard(room, rng);
      safety++;
    }
    expect(room.state).toBe("SETTLEMENT");

    room = settleRound(room);
    const settlements = room.raceLog.filter(e => e.type === "SETTLEMENT");
    expect(settlements.length).toBeGreaterThan(0);

    room = startDistribution(room);
    expect(room.state).toBe("DISTRIBUTION");

    const givers = room.players.filter(p => p.drinks.give > 0);
    if (givers.length > 0) {
      const giver = givers[0]!;
      const target = room.players.find(p => p.id !== giver.id)!;
      room = assignDrink(room, { fromPlayerId: giver.id, toPlayerId: target.id, amount: 1 });
    }

    room = finalizeDistribution(room, rng);
    expect(room.state).toBe("READY");

    for (const p of room.players) {
      room = markReady(room, { playerId: p.id, ready: true });
    }

    room = finishRound(room);
    expect(room.state).toBe("LOBBY");
    expect(room.bids).toEqual({});
    expect(room.raceLog).toEqual([]);
    expect(room.players).toHaveLength(4);
  });
});
describe("hostSetRacePacing", () => {
  test("sets pacing fields on a lobby room", () => {
    let room = makeLobbyRoom([{ id: "host", name: "Host", type: "independent" }]);
    room = hostSetRacePacing(room, { gapDeckMs: 3000, gapTrackMs: 1500 });
    expect(room.raceGapDeckMs).toBe(3000);
    expect(room.raceGapTrackMs).toBe(1500);
  });
});

describe("hostRenamePlayer", () => {
  test("changes a player's name", () => {
    let room = makeLobbyRoom([{ id: "host", name: "Host", type: "independent" }]);
    room = hostAddPlayer(room, { id: "p2", name: "Alice", type: "independent", isHost: false });
    room = hostRenamePlayer(room, { playerId: "p2", name: "  Bob  " });
    const renamed = room.players.find((p) => p.id === "p2");
    expect(renamed!.name).toBe("Bob");
  });
});

describe("countdown", () => {
  test("closeBidding transitions to COUNTDOWN and startRace to RACING", () => {
    const rng = new SeededRNG(42);
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room = hostStartRace(room);
    room = placeBid(room, { playerId: "a", suit: "Coins", amount: 2 }, rng);

    // closeBidding is auto-invoked by placeBid when all players bid
    expect(room.state).toBe("COUNTDOWN");
    expect(room.countdownMs).toBeGreaterThan(Date.now());

    room = startRace(room);
    expect(room.state).toBe("RACING");
    expect(room.countdownMs).toBeNull();

    // startRace on non-COUNTDOWN throws
    expect(() => startRace(room)).toThrow(GameError);
  });
});
