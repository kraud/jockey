import type { RNG } from "./random";
import type {
  Bid,
  Phase,
  Player,
  PlayerType,
  RaceLogEvent,
  Room,
  Suit,
} from "./types";
import {
  BID_MAX,
  BID_MIN,
  isSuit,
  SUITS,
  TRACK_MAX,
  TRACK_MIN,
} from "./types";
import { applyDraw, applyDrawStep, applyFlipStep, placements } from "./race";
import { computeSettlement } from "./settlement";
import { makeTrack, makeDeckState } from "./setup";

// ── src/game/machine.ts — Pure state-machine transitions; each fn takes a Room, returns a cloned Room; no I/O. ──
// Depends on: ./types, ./race, ./settlement, ./setup, ./random.
// Used by: src/room.ts (DO dispatch and alarm), tests/machine.test.ts.

// ── Error type ───────────────────────────────────────────────────────

export class GameError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "GameError";
  }
}

// ── Phase guard ──────────────────────────────────────────────────────

function assertPhase(room: Room, ...phases: Phase[]): void {
  if (!phases.includes(room.state)) {
    throw new GameError(
      "PHASE_GUARD",
      `Expected phase ${phases.join("|")} but room is ${room.state}`,
    );
  }
}

// ── Player helpers ───────────────────────────────────────────────────

function findPlayer(room: Room, playerId: string): Player {
  const p = room.players.find((pl) => pl.id === playerId);
  if (!p) throw new GameError("PLAYER_NOT_FOUND", `Player ${playerId} not found`);
  return p;
}

// ── LOBBY ────────────────────────────────────────────────────────────

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostAddPlayer(
  room: Room,
  params: { id: string; name: string; type: PlayerType; isHost: boolean },
): Room {
  assertPhase(room, "LOBBY");
  if (room.isLocked) {
    throw new GameError("ROOM_LOCKED", "Room is locked");
  }

  const r = structuredClone(room);
  const player: Player = {
    id: params.id,
    name: params.name,
    type: params.type,
    isConnected: true,
    drinks: { give: 0, consume: 0, isReady: false, gaveAll: false },
  };

  r.players.push(player);

  if (params.isHost) {
    r.hostId = player.id;
  }

  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostRemovePlayer(
  room: Room,
  params: { playerId: string },
): Room {
  const r = structuredClone(room);
  const idx = r.players.findIndex((p) => p.id === params.playerId);
  if (idx === -1) {
    throw new GameError("PLAYER_NOT_FOUND", `Player ${params.playerId} not found`);
  }

  r.players.splice(idx, 1);
  delete r.bids[params.playerId];

  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostSetLock(
  room: Room,
  params: { locked: boolean },
): Room {
  assertPhase(room, "LOBBY");
  const r = structuredClone(room);
  r.isLocked = params.locked;
  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostSetTrackLength(
  room: Room,
  params: { length: number },
): Room {
  assertPhase(room, "LOBBY");
  if (params.length < TRACK_MIN || params.length > TRACK_MAX) {
    throw new GameError(
      "TRACK_LENGTH_OUT_OF_RANGE",
      `Track length must be ${TRACK_MIN}–${TRACK_MAX}, got ${params.length}`,
    );
  }
  const r = structuredClone(room);
  r.trackLength = params.length;
  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostSetRacePacing(
  room: Room,
  params: { gapDeckMs: number; gapTrackMs: number },
): Room {
  assertPhase(room, "LOBBY");
  const r = structuredClone(room);
  r.raceGapDeckMs = params.gapDeckMs;
  r.raceGapTrackMs = params.gapTrackMs;
  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostSetDistributionTimeLimit(
  room: Room,
  params: { timeLimitMs: number },
): Room {
  assertPhase(room, "LOBBY");
  if (params.timeLimitMs < 5_000 || params.timeLimitMs > 600_000) {
    throw new GameError(
      "DIST_TIME_OUT_OF_RANGE",
      `Distribution time limit must be 5000–600000 ms, got ${params.timeLimitMs}`,
    );
  }
  const r = structuredClone(room);
  r.distributionTimeLimitMs = params.timeLimitMs;
  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostRenamePlayer(
  room: Room,
  params: { playerId: string; name: string },
): Room {
  const player = findPlayer(room, params.playerId);
  if (!player) {
    throw new GameError("PLAYER_NOT_FOUND", `Player ${params.playerId} not found`);
  }
  const r = structuredClone(room);
  const target = findPlayer(r, params.playerId);
  target.name = params.name.trim();
  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function selfRename(
  room: Room,
  params: { playerId: string; name: string },
): Room {
  const player = findPlayer(room, params.playerId);
  if (!player) {
    throw new GameError("PLAYER_NOT_FOUND", `Player ${params.playerId} not found`);
  }
  const r = structuredClone(room);
  const target = findPlayer(r, params.playerId);
  target.name = params.name.trim();
  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostStartRace(room: Room): Room {
  assertPhase(room, "LOBBY");
  const r = structuredClone(room);
  r.state = "BIDDING";
  r.bids = {};
  r.bidDeadlineMs = Date.now() + 30_000;
  r.countdownMs = null;
  r.distDeadlineMs = null;
  r.readyDeadlineMs = null;
  r.raceLog = [];
  // Reset drinks for all players
  for (const p of r.players) {
    p.drinks = { give: 0, consume: 0, isReady: false, gaveAll: false };
  }
  return r;
}

// ── BIDDING ──────────────────────────────────────────────────────────

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function placeBid(
  room: Room,
  params: { playerId: string; suit: Suit; amount: number },
  rng: RNG,
): Room {
  assertPhase(room, "BIDDING");

  // Validate player exists
  findPlayer(room, params.playerId);

  if (params.amount < BID_MIN || params.amount > BID_MAX) {
    throw new GameError(
      "BID_INVALID",
      `Bid amount must be ${BID_MIN}–${BID_MAX}, got ${params.amount}`,
    );
  }

  if (!isSuit(params.suit)) {
    throw new GameError("BID_INVALID", `Invalid suit: ${params.suit}`);
  }

  if (room.bids[params.playerId]) {
    throw new GameError(
      "BID_DUPLICATE",
      `Player ${params.playerId} already submitted a bid`,
    );
  }

  const r = structuredClone(room);
  const bid: Bid = {
    playerId: params.playerId,
    suit: params.suit,
    amount: params.amount,
    submittedAt: Date.now(),
  };
  r.bids = { ...r.bids, [params.playerId]: bid };

  // Auto-advance: if every player in the room has bid, close bidding.
  const allBidded = r.players.every((p) => r.bids[p.id]);
  if (allBidded) {
    return closeBidding(r, rng);
  }

  return r;
}

// ── BIDDING → SETUP → RACING ────────────────────────────────────────

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function closeBidding(room: Room, rng: RNG): Room {
  assertPhase(room, "BIDDING");

  const r = structuredClone(room);
  // Build track and deck.
  r.trackCards = makeTrack(rng, r.trackLength);
  r.deckState = makeDeckState(rng);

  // Initialize horses at position 0.
  r.horses = SUITS.map((suit) => ({
    suit,
    position: 0,
    isFinished: false,
    placement: 0,
  }));
  r.state = "COUNTDOWN";
  r.countdownMs = Date.now() + 4000;
  r.bidDeadlineMs = null;
  r.raceLog = [];

  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function startRace(room: Room): Room {
  assertPhase(room, "COUNTDOWN");
  const r = structuredClone(room);
  r.state = "RACING";
  r.countdownMs = null;
  return r;
}

// ── RACING ───────────────────────────────────────────────────────────

/**
 * Stage 1 of a race tick: pop the next card from the deck and apply it.
 * Returns the room with draw events applied.  The caller must follow up
 * with runFlipStep after the deck gap elapses.
 */
// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function runDrawStep(room: Room, rng: RNG): Room {
  assertPhase(room, "RACING");

  const r = structuredClone(room);
  const deck = r.deckState;

  // Reshuffle discard pile into draw pile when empty.
  if (deck.drawPile.length === 0) {
    deck.drawPile = rng.shuffle(deck.discardPile);
    deck.discardPile = [];
  }

  // Should not happen with a 44-card deck, but be safe.
  if (deck.drawPile.length === 0) {
    return r;
  }

  const card = deck.drawPile.pop()!;
  deck.discardPile.push(card);

  return applyDrawStep(r, card);
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
/**
 * Stage 2 of a race tick: flip a track card and apply regression.
 */
export function runFlipStep(room: Room): Room {
  return applyFlipStep(room);
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
/**
 * Draw the next card from the deck and apply it to the race.
 * Full composition: draw step + flip step in one call.
 * Maintained for backward compatibility with existing callers and tests.
 */
export function drawNextCard(room: Room, rng: RNG): Room {
  return runFlipStep(runDrawStep(room, rng));
}

// ── SETTLEMENT ───────────────────────────────────────────────────────

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function settleRound(room: Room): Room {
  assertPhase(room, "SETTLEMENT");

  const r = structuredClone(room);

  // Assign 4th place to the remaining unplaced horse.
  const unplaced = r.horses.find((h) => h.placement === 0);
  if (unplaced) {
    unplaced.placement = 4;
    unplaced.isFinished = true;
  }

  // Only bidders who actually placed a bid participate in settlement.
  const bids = Object.values(r.bids);
  if (bids.length === 0) {
    // No bids → no settlement needed. Skip to distribution.
    return r;
  }

  const results = computeSettlement(bids, placements(r), r.trackLength);

  for (const result of results) {
    const player = findPlayer(r, result.playerId);
    player.drinks.give += result.drinksGive;
    player.drinks.consume += result.drinksConsume;

    r.raceLog.push({
      type: "SETTLEMENT",
      playerId: result.playerId,
      drinksGive: result.drinksGive,
      drinksConsume: result.drinksConsume,
    });
  }

  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function startDistribution(room: Room): Room {
  assertPhase(room, "SETTLEMENT");

  const r = structuredClone(room);
  r.state = "DISTRIBUTION";
  r.distDeadlineMs = Date.now() + r.distributionTimeLimitMs;
  return r;
}

// ── DISTRIBUTION ─────────────────────────────────────────────────────

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function assignDrink(
  room: Room,
  params: { fromPlayerId: string; toPlayerId: string; amount: number },
): Room {
  assertPhase(room, "DISTRIBUTION");

  if (params.amount <= 0) {
    throw new GameError("DRINK_INVALID_AMOUNT", "Amount must be positive");
  }

  const r = structuredClone(room);
  const from = findPlayer(r, params.fromPlayerId);
  const to = findPlayer(r, params.toPlayerId);

  if (from.drinks.give < params.amount) {
    throw new GameError(
      "DRINK_INSUFFICIENT_POOL",
      `${from.name} only has ${from.drinks.give} drinks to give, requested ${params.amount}`,
    );
  }

  from.drinks.give -= params.amount;
  to.drinks.consume += params.amount;

  r.raceLog.push({
    type: "DRINK_GIVE",
    from: params.fromPlayerId,
    to: params.toPlayerId,
    amount: params.amount,
  });

  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostAssignDrink(
  room: Room,
  params: { fromPlayerId: string; toPlayerId: string; amount: number },
): Room {
  assertPhase(room, "DISTRIBUTION");

  if (params.amount <= 0) {
    throw new GameError("DRINK_INVALID_AMOUNT", "Amount must be positive");
  }

  const r = structuredClone(room);
  const from = findPlayer(r, params.fromPlayerId);
  const to = findPlayer(r, params.toPlayerId);

  if (from.drinks.give < params.amount) {
    throw new GameError(
      "DRINK_INSUFFICIENT_POOL",
      `${from.name} only has ${from.drinks.give} drinks to give, requested ${params.amount}`,
    );
  }

  from.drinks.give -= params.amount;
  to.drinks.consume += params.amount;

  r.raceLog.push({
    type: "DRINK_GIVE",
    from: params.fromPlayerId,
    to: params.toPlayerId,
    amount: params.amount,
  });

  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function clearDrink(
  room: Room,
  params: { fromPlayerId: string; toPlayerId: string; amount: number },
): Room {
  assertPhase(room, "DISTRIBUTION");
  if (params.amount <= 0) {
    throw new GameError("DRINK_INVALID_AMOUNT", "Amount must be positive");
  }
  const r = structuredClone(room);
  const from = findPlayer(r, params.fromPlayerId);
  const to = findPlayer(r, params.toPlayerId);
  if (to.drinks.consume < params.amount) {
    throw new GameError(
      "DRINK_INSUFFICIENT_RECIPIENT",
      `${to.name} only has ${to.drinks.consume} drinks to clear, requested ${params.amount}`,
    );
  }
  from.drinks.give += params.amount;
  to.drinks.consume -= params.amount;
  r.raceLog.push({
    type: "DRINK_CLEAR",
    from: params.fromPlayerId,
    to: params.toPlayerId,
    amount: params.amount,
  });
  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function hostClearDrink(
  room: Room,
  params: { fromPlayerId: string; toPlayerId: string; amount: number },
): Room {
  assertPhase(room, "DISTRIBUTION");
  if (params.amount <= 0) {
    throw new GameError("DRINK_INVALID_AMOUNT", "Amount must be positive");
  }
  const r = structuredClone(room);
  const from = findPlayer(r, params.fromPlayerId);
  const to = findPlayer(r, params.toPlayerId);
  if (to.drinks.consume < params.amount) {
    throw new GameError(
      "DRINK_INSUFFICIENT_RECIPIENT",
      `${to.name} only has ${to.drinks.consume} drinks to clear, requested ${params.amount}`,
    );
  }
  from.drinks.give += params.amount;
  to.drinks.consume -= params.amount;
  r.raceLog.push({
    type: "DRINK_CLEAR",
    from: params.fromPlayerId,
    to: params.toPlayerId,
    amount: params.amount,
  });
  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function markDistributionDone(
  room: Room,
  params: { playerId: string },
): Room {
  assertPhase(room, "DISTRIBUTION");
  const r = structuredClone(room);
  const player = findPlayer(r, params.playerId);
  player.drinks.gaveAll = !player.drinks.gaveAll;
  r.raceLog.push({
    type: "DISTRIBUTION_DONE",
    playerId: params.playerId,
  });
  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
/**
 * Auto-distribute all unassigned give-drinks uniformly at random over
 * all players (self-included).  Transitions to READY.
 */
export function finalizeDistribution(room: Room, rng: RNG): Room {
  assertPhase(room, "DISTRIBUTION");

  const r = structuredClone(room);

  for (const player of r.players) {
    while (player.drinks.give > 0) {
      const target = rng.pick(r.players);
      player.drinks.give -= 1;
      target.drinks.consume += 1;
      r.raceLog.push({
        type: "DRINK_AUTO",
        to: target.id,
        amount: 1,
      });
    }
  }

  r.state = "READY";
  r.distDeadlineMs = null;
  r.readyDeadlineMs = Date.now() + 60_000;
  return r;
}

// ── READY ────────────────────────────────────────────────────────────

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function markReady(
  room: Room,
  params: { playerId: string; ready: boolean },
): Room {
  assertPhase(room, "READY");

  const r = structuredClone(room);
  const player = findPlayer(r, params.playerId);
  player.drinks.isReady = params.ready;

  r.raceLog.push({
    type: "PLAYER_READY",
    playerId: params.playerId,
  });

  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
/**
 * Reset race state and return to LOBBY.  Keeps player identities and
 * trackLength; resets positions, placements, drinks, race log, bids.
 */
export function finishRound(room: Room): Room {
  assertPhase(room, "READY");

  const r = structuredClone(room);
  r.state = "LOBBY";
  r.bids = {};
  r.raceLog = [];
  r.horses = [];
  r.trackCards = [];
  r.deckState = { drawPile: [], discardPile: [] };
  r.bidDeadlineMs = null;
  r.countdownMs = null;
  r.distDeadlineMs = null;
  r.readyDeadlineMs = null;

  for (const p of r.players) {
    p.drinks = { give: 0, consume: 0, isReady: false, gaveAll: false };
  }

  return r;
}

// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
export function endGame(room: Room): Room {
  const r = structuredClone(room);
  r.state = "LOBBY";
  r.players = [];
  r.hostId = "";
  r.isLocked = false;
  r.horses = [];
  r.trackCards = [];
  r.deckState = { drawPile: [], discardPile: [] };
  r.bids = {};
  r.raceLog = [];
  r.bidDeadlineMs = null;
  r.countdownMs = null;
  r.distDeadlineMs = null;
  r.readyDeadlineMs = null;
  return r;
}
