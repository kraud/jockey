import { describe, expect, test } from "bun:test";
import { SeededRNG } from "../src/game/random";
import {
  drawNextCard,
  finishRound,
  hostAddPlayer,
  hostSetRacePacing,
  hostSetDistributionTimeLimit,
  hostRenamePlayer,
  hostStartRace,
  placeBid,
  settleRound,
  startDistribution,
  finalizeDistribution,
  markReady,
  assignDrink,
  hostAssignDrink,
  clearDrink,
  hostClearDrink,
  markDistributionDone,
  endGame,
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

// ── New machine functions ─────────────────────────────────────────

describe("hostSetDistributionTimeLimit", () => {
  test("writes the field on a LOBBY room", () => {
    const room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    const result = hostSetDistributionTimeLimit(room, { timeLimitMs: 10000 });
    expect(result.distributionTimeLimitMs).toBe(10000);
  });

  test("throws on non-LOBBY room", () => {
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room = hostStartRace(room);
    expect(() => hostSetDistributionTimeLimit(room, { timeLimitMs: 10000 })).toThrow(GameError);
  });

  test("clamps to valid range", () => {
    const room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    expect(() => hostSetDistributionTimeLimit(room, { timeLimitMs: 0 })).toThrow(GameError);
  });
});

describe("hostAssignDrink", () => {
  test("decrements from and increments to like assignDrink", () => {
    let room = makeLobbyRoom([
      { id: "a", name: "Alice", type: "independent" },
      { id: "b", name: "Bob", type: "independent" },
    ]);
    room = hostStartRace(room);
    // Simulate entering DISTRIBUTION with give drinks on Alice
    room.state = "DISTRIBUTION";
    const alice = room.players.find(p => p.id === "a")!;
    alice.drinks.give = 5;

    room = hostAssignDrink(room, { fromPlayerId: "a", toPlayerId: "b", amount: 3 });

    const a = room.players.find(p => p.id === "a")!;
    const b = room.players.find(p => p.id === "b")!;
    expect(a.drinks.give).toBe(2);
    expect(b.drinks.consume).toBe(3);
    expect(room.raceLog.some(e => e.type === "DRINK_GIVE" && "from" in e && e.from === "a" && e.to === "b" && e.amount === 3)).toBe(true);
  });

  test("throws outside DISTRIBUTION", () => {
    const room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    expect(() => hostAssignDrink(room, { fromPlayerId: "a", toPlayerId: "a", amount: 1 })).toThrow(GameError);
  });

  test("throws on insufficient pool", () => {
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room.state = "DISTRIBUTION";
    expect(() => hostAssignDrink(room, { fromPlayerId: "a", toPlayerId: "a", amount: 1 })).toThrow(GameError);
  });
});

describe("clearDrink", () => {
  test("returns drink to giver and removes from recipient", () => {
    let room = makeLobbyRoom([
      { id: "a", name: "Alice", type: "independent" },
      { id: "b", name: "Bob", type: "independent" },
    ]);
    room = hostStartRace(room);
    room.state = "DISTRIBUTION";
    const alice = room.players.find(p => p.id === "a")!;
    alice.drinks.give = 5;

    // First give 3 to Bob
    room = assignDrink(room, { fromPlayerId: "a", toPlayerId: "b", amount: 3 });
    // Then clear 2
    room = clearDrink(room, { fromPlayerId: "a", toPlayerId: "b", amount: 2 });

    const a = room.players.find(p => p.id === "a")!;
    const b = room.players.find(p => p.id === "b")!;
    expect(a.drinks.give).toBe(4); // 5 - 3 + 2 = 4
    expect(b.drinks.consume).toBe(1); // 3 - 2 = 1
    expect(room.raceLog.some(e => e.type === "DRINK_CLEAR" && "from" in e && e.from === "a" && e.to === "b" && e.amount === 2)).toBe(true);
  });

  test("throws DRINK_INSUFFICIENT_RECIPIENT when recipient has less consume than cleared", () => {
    let room = makeLobbyRoom([
      { id: "a", name: "Alice", type: "independent" },
      { id: "b", name: "Bob", type: "independent" },
    ]);
    room.state = "DISTRIBUTION";
    const alice = room.players.find(p => p.id === "a")!;
    alice.drinks.give = 5;

    // Give 1 to Bob
    room = assignDrink(room, { fromPlayerId: "a", toPlayerId: "b", amount: 1 });
    // Try to clear 2 — Bob only has 1
    expect(() => clearDrink(room, { fromPlayerId: "a", toPlayerId: "b", amount: 2 })).toThrow(GameError);
  });

  test("throws outside DISTRIBUTION", () => {
    const room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    expect(() => clearDrink(room, { fromPlayerId: "a", toPlayerId: "a", amount: 1 })).toThrow(GameError);
  });
});

describe("hostClearDrink", () => {
  test("mirrors clearDrink for host proxy", () => {
    let room = makeLobbyRoom([
      { id: "a", name: "Alice", type: "independent" },
      { id: "b", name: "Bob", type: "independent" },
    ]);
    room = hostStartRace(room);
    room.state = "DISTRIBUTION";
    const alice = room.players.find(p => p.id === "a")!;
    alice.drinks.give = 5;

    // Give 3 to Bob via hostAssignDrink
    room = hostAssignDrink(room, { fromPlayerId: "a", toPlayerId: "b", amount: 3 });
    // Clear 2 via hostClearDrink
    room = hostClearDrink(room, { fromPlayerId: "a", toPlayerId: "b", amount: 2 });

    const a = room.players.find(p => p.id === "a")!;
    const b = room.players.find(p => p.id === "b")!;
    expect(a.drinks.give).toBe(4);
    expect(b.drinks.consume).toBe(1);
  });

  test("throws outside DISTRIBUTION", () => {
    const room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    expect(() => hostClearDrink(room, { fromPlayerId: "a", toPlayerId: "a", amount: 1 })).toThrow(GameError);
  });
});

describe("markDistributionDone", () => {
  test("sets gaveAll and pushes DISTRIBUTION_DONE event", () => {
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room.state = "DISTRIBUTION";

    room = markDistributionDone(room, { playerId: "a" });

    const alice = room.players.find(p => p.id === "a")!;
    expect(alice.drinks.gaveAll).toBe(true);
    expect(room.raceLog.some(e => e.type === "DISTRIBUTION_DONE" && e.playerId === "a")).toBe(true);
  });

  test("throws outside DISTRIBUTION", () => {
    const room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    expect(() => markDistributionDone(room, { playerId: "a" })).toThrow(GameError);
  });

  test("toggles gaveAll on second call", () => {
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room.state = "DISTRIBUTION";

    room = markDistributionDone(room, { playerId: "a" });
    expect(room.players.find(p => p.id === "a")!.drinks.gaveAll).toBe(true);

    room = markDistributionDone(room, { playerId: "a" });
    expect(room.players.find(p => p.id === "a")!.drinks.gaveAll).toBe(false);
    expect(room.raceLog.filter(e => e.type === "DISTRIBUTION_DONE" && e.playerId === "a").length).toBe(2);
  });
});

describe("startDistribution uses distributionTimeLimitMs", () => {
  test("deadline is set from room config", () => {
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room.state = "SETTLEMENT";
    room.distributionTimeLimitMs = 15000;

    const before = Date.now();
    room = startDistribution(room);
    const after = Date.now();

    expect(room.distDeadlineMs).toBeGreaterThanOrEqual(before + 15000);
    expect(room.distDeadlineMs).toBeLessThanOrEqual(after + 15000);
  });
});

describe("endGame", () => {
  test("resets players, hostId, and round fields", () => {
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room.state = "READY";

    room = endGame(room);

    expect(room.state).toBe("LOBBY");
    expect(room.players).toEqual([]);
    expect(room.hostId).toBe("");
    expect(room.isLocked).toBe(false);
    expect(room.horses).toEqual([]);
    expect(room.trackCards).toEqual([]);
    expect(room.bids).toEqual({});
    expect(room.raceLog).toEqual([]);
    expect(room.bidDeadlineMs).toBeNull();
    expect(room.countdownMs).toBeNull();
    expect(room.distDeadlineMs).toBeNull();
    expect(room.readyDeadlineMs).toBeNull();
  });
});
