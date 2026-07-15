import type { ServerMessage, Room, Suit, SettlementResult } from "../../../shared/messages"

// ── Frontend room state ──────────────────────────────────────────────
export interface RoomState {
  playerId: string;
  room: Room | null;
  selectedSuit: Suit | null;
  selectedAmount: number;
  bidPlaced: boolean;
  lastRaceResult: {
    placements: ReadonlyArray<{ suit: Suit; placement: number }>;
    settlement: SettlementResult[];
  } | null;
}

// ── Type guard ───────────────────────────────────────────────────────

export function parseServerMessage(raw: string): ServerMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) return null;
  const msg = parsed as Record<string, unknown>;
  if (typeof msg.type !== "string") return null;

  // Accept any message with a known server-side type field — the server
  // is trusted to send well-formed payloads. This guard catches JSON
  // parse failures and non-object payloads only.
  return parsed as ServerMessage;
}

// ── State transitions ────────────────────────────────────────────────

export function applyServerMessage(state: RoomState, msg: ServerMessage): RoomState {
  switch (msg.type) {
    case "room_joined":
      return {
        ...state,
        playerId: msg.playerId,
        room: msg.room,
        bidPlaced: false,
        selectedSuit: null,
        selectedAmount: 0,
      };

    case "room_created":
      return {
        ...state,
        playerId: msg.playerId,
        room: msg.room,
      };

    case "player_joined": {
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: [...state.room.players, msg.player],
        },
      };
    }

    case "player_left": {
      if (!state.room) return state;
      return {
        ...state,
        room: {
          ...state.room,
          players: state.room.players.filter(p => p.id !== msg.playerId),
        },
      };
    }

    case "room_locked": {
      if (!state.room) return state;
      return {
        ...state,
        room: { ...state.room, isLocked: msg.locked },
      };
    }

    case "phase_changed": {
      if (!state.room) return state;
      const next: RoomState = {
        ...state,
        room: { ...state.room, state: msg.phase },
      };
      if (msg.phase === "BIDDING") {
        next.bidPlaced = false;
        next.selectedSuit = null;
        next.selectedAmount = 0;
      }
      return next;
    }

    case "bids_updated": {
      if (!state.room) return state;
      const bids = { ...state.room.bids };
      for (const bid of msg.bids) {
        bids[bid.playerId] = bid;
      }
      return {
        ...state,
        room: { ...state.room, bids },
      };
    }

    case "race_log": {
      if (!state.room) return state;
      const raceLog = [...state.room.raceLog];
      const horses = state.room.horses.map(h => ({ ...h }));
      const trackCards = state.room.trackCards.map(tc => ({ ...tc }));
      for (const e of msg.events) {
        raceLog.push(e);
        if (e.type === "HORSE_MOVE") {
          const h = horses.find(h => h.suit === e.suit);
          if (h) h.position = e.to;
        }
        if (e.type === "HORSE_FINISH") {
          const h = horses.find(h => h.suit === e.suit);
          if (h) {
            h.isFinished = true;
            h.placement = e.placement;
          }
        }
        if (e.type === "TRACK_FLIP") {
          const tc = trackCards.find(tc => tc.index === e.index);
          if (tc) tc.isFlipped = true;
        }
      }
      return {
        ...state,
        room: { ...state.room, raceLog, horses, trackCards },
      };
    }

    case "race_ended": {
      if (!state.room) return state;
      return {
        ...state,
        room: { ...state.room, state: "SETTLEMENT" as const },
        lastRaceResult: {
          placements: msg.placements,
          settlement: msg.settlement,
        },
      };
    }

    case "drinks_updated": {
      if (!state.room) return state;
      const players = state.room.players.map(p => {
        const d = msg.drinks.find(d => d.playerId === p.id);
        return d
          ? { ...p, drinks: { ...p.drinks, give: d.give, take: d.take, consume: d.consume, gaveAll: d.gaveAll } }
          : p;
      });
      return {
        ...state,
        room: { ...state.room, players },
      };
    }

    case "player_ready": {
      if (!state.room) return state;
      const players = state.room.players.map(p =>
        p.id === msg.playerId
          ? { ...p, drinks: { ...p.drinks, isReady: msg.ready } }
          : p,
      );
      return {
        ...state,
        room: { ...state.room, players },
      };
    }

    case "state_sync":
      return {
        ...state,
        room: msg.room,
        bidPlaced: false,
        selectedSuit: null,
        selectedAmount: 0,
        lastRaceResult: null,
      };

    case "game_ended":
      location.assign("/");
      return { ...state, room: null };

    case "error":
      console.error(`[${msg.code}] ${msg.message}`);
      return state;

    default:
      return state;
  }
}
