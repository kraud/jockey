import type { Phase, RaceLogEvent, Room, SettlementResult, Suit, Bid, Player } from "../game/types";
import { isSuit, BID_MIN, BID_MAX } from "../game/types";

// ── Error ────────────────────────────────────────────────────────────

export class WsProtocolError extends Error {
  constructor(
    public code: "PARSE_ERROR" | "VALIDATION_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "WsProtocolError";
  }
}

// ── Client message types ─────────────────────────────────────────────

export type ClientMessage =
  | { type: "create_room" }
  | { type: "join_room"; roomCode: string; playerName: string }
  | { type: "host_lock_room"; locked: boolean }
  | { type: "host_kick_player"; playerId: string }
  | { type: "host_add_hosted_player"; playerName: string }
  | { type: "host_start_race" }
  | { type: "place_bid"; suit: Suit; amount: number }
  | { type: "host_place_bid"; playerId: string; suit: Suit; amount: number }
  | { type: "host_advance_phase" }
  | { type: "host_set_track_length"; length: number }
  | { type: "assign_drink"; to: string; amount: number }
  | { type: "ready"; ready: boolean }
  | { type: "host_set_ready"; playerId: string; ready: boolean };

// ── Server message types ─────────────────────────────────────────────

export type ServerMessage =
  | { type: "room_created"; roomCode: string; playerId: string; room: Room }
  | { type: "room_joined"; playerId: string; room: Room }
  | { type: "player_joined"; player: Player }
  | { type: "player_left"; playerId: string }
  | { type: "room_locked"; locked: boolean }
  | { type: "phase_changed"; phase: Phase }
  | { type: "bids_updated"; bids: Bid[] }
  | { type: "race_log"; events: RaceLogEvent[] }
  | { type: "race_ended"; placements: ReadonlyArray<{ suit: Suit; placement: number }>; settlement: SettlementResult[] }
  | { type: "drinks_updated"; drinks: Array<{ playerId: string; give: number; take: number; consume: number }> }
  | { type: "player_ready"; playerId: string; ready: boolean }
  | { type: "error"; code: string; message: string }
  | { type: "state_sync"; room: Room };

// ── Validation helpers ───────────────────────────────────────────────

const ROOM_CODE_RE = /^[A-Z0-9]{4,6}$/;
const PLAYER_NAME_RE = /^[^\x00-\x1f\x7f]{1,24}$/;

function validateRoomCode(code: unknown): asserts code is string {
  if (typeof code !== "string" || !ROOM_CODE_RE.test(code)) {
    throw new WsProtocolError(
      "VALIDATION_ERROR",
      "roomCode must be 4–6 uppercase alphanumeric characters",
    );
  }
}

function validatePlayerName(name: unknown): asserts name is string {
  if (typeof name !== "string") {
    throw new WsProtocolError("VALIDATION_ERROR", "playerName must be a string");
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 24 || !PLAYER_NAME_RE.test(trimmed)) {
    throw new WsProtocolError(
      "VALIDATION_ERROR",
      "playerName must be 1–24 characters, no control chars",
    );
  }
}

function validateSuit(s: unknown): asserts s is Suit {
  if (!isSuit(s)) {
    throw new WsProtocolError("VALIDATION_ERROR", `Invalid suit: ${String(s)}`);
  }
}

function validateBidAmount(a: unknown): asserts a is number {
  if (typeof a !== "number" || !Number.isInteger(a) || a < BID_MIN || a > BID_MAX) {
    throw new WsProtocolError(
      "VALIDATION_ERROR",
      `Bid amount must be integer ${BID_MIN}–${BID_MAX}`,
    );
  }
}

function validatePlayerId(id: unknown): asserts id is string {
  if (typeof id !== "string" || id.length === 0) {
    throw new WsProtocolError("VALIDATION_ERROR", "playerId must be a non-empty string");
  }
}

function validateBoolean(b: unknown): asserts b is boolean {
  if (typeof b !== "boolean") {
    throw new WsProtocolError("VALIDATION_ERROR", "Expected boolean");
  }
}

function validatePositiveInt(n: unknown): asserts n is number {
  if (typeof n !== "number" || !Number.isInteger(n) || n <= 0) {
    throw new WsProtocolError("VALIDATION_ERROR", "Amount must be a positive integer");
  }
}

// ── Parser ───────────────────────────────────────────────────────────

/** Parse and validate an incoming JSON string into a ClientMessage. */
export function parseClientMessage(json: string): ClientMessage {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new WsProtocolError("PARSE_ERROR", "Invalid JSON");
  }

  if (typeof raw !== "object" || raw === null || !("type" in raw)) {
    throw new WsProtocolError("VALIDATION_ERROR", "Message must have a type field");
  }

  const msg = raw as Record<string, unknown>;
  const type = msg.type;

  switch (type) {
    case "create_room":
      return { type: "create_room" };

    case "join_room": {
      validateRoomCode(msg.roomCode);
      validatePlayerName(msg.playerName);
      return { type: "join_room", roomCode: msg.roomCode as string, playerName: (msg.playerName as string).trim() };
    }

    case "host_lock_room": {
      validateBoolean(msg.locked);
      return { type: "host_lock_room", locked: msg.locked as boolean };
    }

    case "host_kick_player": {
      validatePlayerId(msg.playerId);
      return { type: "host_kick_player", playerId: msg.playerId as string };
    }

    case "host_add_hosted_player": {
      validatePlayerName(msg.playerName);
      return { type: "host_add_hosted_player", playerName: (msg.playerName as string).trim() };
    }

    case "host_start_race":
      return { type: "host_start_race" };

    case "place_bid": {
      validateSuit(msg.suit);
      validateBidAmount(msg.amount);
      return { type: "place_bid", suit: msg.suit as Suit, amount: msg.amount as number };
    }

    case "host_place_bid": {
      validatePlayerId(msg.playerId);
      validateSuit(msg.suit);
      validateBidAmount(msg.amount);
      return {
        type: "host_place_bid",
        playerId: msg.playerId as string,
        suit: msg.suit as Suit,
        amount: msg.amount as number,
      };
    }

    case "host_advance_phase":
      return { type: "host_advance_phase" };

    case "host_set_track_length": {
      if (typeof msg.length !== "number" || !Number.isInteger(msg.length) || msg.length < 6 || msg.length > 20) {
        throw new WsProtocolError("VALIDATION_ERROR", "Track length must be integer 6–20");
      }
      return { type: "host_set_track_length", length: msg.length as number };
    }

    case "assign_drink": {
      validatePlayerId(msg.to);
      validatePositiveInt(msg.amount);
      return { type: "assign_drink", to: msg.to as string, amount: msg.amount as number };
    }

    case "ready": {
      validateBoolean(msg.ready);
      return { type: "ready", ready: msg.ready as boolean };
    }

    case "host_set_ready": {
      validatePlayerId(msg.playerId);
      validateBoolean(msg.ready);
      return { type: "host_set_ready", playerId: msg.playerId as string, ready: msg.ready as boolean };
    }

    default:
      throw new WsProtocolError("VALIDATION_ERROR", `Unknown message type: ${String(type)}`);
  }
}

/** Serialize a server message to JSON string. */
export function serializeServerMessage(msg: ServerMessage): string {
  return JSON.stringify(msg);
}
