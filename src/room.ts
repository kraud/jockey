import { DurableObject } from "cloudflare:workers";
import type { DurableObjectState } from "@cloudflare/workers-types";
import { MathRNG } from "./game/random";
import {
  hostAddPlayer,
  hostRemovePlayer,
  hostSetLock,
  hostSetTrackLength,
  hostSetRacePacing,
  hostSetDistributionTimeLimit,
  hostRenamePlayer,
  selfRename,
  hostStartRace,
  placeBid,
  closeBidding,
  runDrawStep,
  runFlipStep,
  drawNextCard,
  startRace,
  settleRound,
  startDistribution,
  assignDrink,
  hostAssignDrink,
  clearDrink,
  hostClearDrink,
  finalizeDistribution,
  markDistributionDone,
  markReady,
  finishRound,
  endGame,
  GameError,
} from "./game/machine";
import type { Room, Player } from "./game/types";
import { TRACK_MAX, TRACK_MIN } from "./game/types";
import { parseClientMessage, WsProtocolError } from "./ws/messages";
import type { ClientMessage, ServerMessage } from "./ws/messages";
import { placements } from "./game/race";
import { computeSettlement } from "./game/settlement";

// ── Constants ────────────────────────────────────────────────────────

// Pacing is now per-room (raceGapDeckMs / raceGapTrackMs); this constant
// is kept as a fallback and for backward-compatible tests.
const RACE_DRAW_INTERVAL_MS = 750;
const BID_TIMEOUT_MS = 30_000;
const READY_TIMEOUT_MS = 60_000;

// ── Env ──────────────────────────────────────────────────────────────

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
}

// ── Attachment shape ─────────────────────────────────────────────────

interface Attachment {
  playerId: string;
}

// ── Durable Object ───────────────────────────────────────────────────

export class Room extends DurableObject<Env> {
  private room: Room | null = null;
  private rng = new MathRNG();
  private pendingRoomCode: string | null = null;
  private pendingStage: "DRAW" | "FLIP" | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Restore from storage on startup.
    ctx.blockConcurrencyWhile(async () => {
      const stored = await ctx.storage.get<string>("room_state");
      if (stored) {
        this.room = JSON.parse(stored) as Room;
      }
    });
  }

  // ── HTTP entry ───────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Init: called by Worker on room creation.
    if (url.pathname === "/init" && request.method === "POST") {
      if (this.room) {
        // Room already exists — collision.
        return new Response(JSON.stringify({ error: "Room already exists" }), {
          status: 409,
          headers: { "content-type": "application/json" },
        });
      }
      this.room = this.makeEmptyRoom("");
      await this.persist();
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "content-type": "application/json" },
      });
    }

    // State check: called by Worker for GET /api/room/:code/state.
    if (url.pathname === "/state" && request.method === "GET") {
      if (!this.room) {
        return new Response(null, { status: 404 });
      }
      return new Response(JSON.stringify({ room: this.room }), {
        headers: { "content-type": "application/json" },
      });
    }

    // WebSocket upgrade.
    if (request.headers.get("Upgrade") === "websocket") {
      // Store room code from forwarded header.
      const roomCode = request.headers.get("x-room-code");
      if (roomCode) {
        this.pendingRoomCode = roomCode;
        if (this.room) {
          this.room.roomCode = roomCode;
          await this.persist();
        }
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  }

  // ── WebSocket handlers ────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, raw: string): Promise<void> {
    let msg: ClientMessage;
    try {
      msg = parseClientMessage(raw);
    } catch (e) {
      if (e instanceof WsProtocolError) {
        this.send(ws, { type: "error", code: e.code, message: e.message });
      }
      return;
    }

    const att = ws.deserializeAttachment() as Attachment | null;

    try {
      await this.dispatch(ws, msg, att);
    } catch (e) {
      if (e instanceof GameError) {
        this.send(ws, { type: "error", code: e.code, message: e.message });
      } else {
        console.error("Unexpected error in message handler:", e);
        this.send(ws, { type: "error", code: "INTERNAL", message: "Internal server error" });
      }
    }
  }

  async webSocketClose(
    ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean,
  ): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att && this.room) {
      const player = this.room.players.find((p) => p.id === att.playerId);
      if (player) {
        player.isConnected = false;
        await this.persist();
        this.broadcast({ type: "player_left", playerId: att.playerId });
      }
    }
  }

  async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
    const att = ws.deserializeAttachment() as Attachment | null;
    if (att && this.room) {
      const player = this.room.players.find((p) => p.id === att.playerId);
      if (player) {
        player.isConnected = false;
        await this.persist();
        this.broadcast({ type: "player_left", playerId: att.playerId });
      }
    }
  }

  // ── Alarm handler ─────────────────────────────────────────────────

  async alarm(): Promise<void> {
    if (!this.room) return;
    const now = Date.now();

    // Bidding timeout.
    if (this.room.state === "BIDDING" && this.room.bidDeadlineMs !== null && now >= this.room.bidDeadlineMs) {
      this.room = closeBidding(this.room, this.rng);
      this.pendingStage = null;
      await this.persist();
      this.broadcast({ type: "phase_changed", phase: "COUNTDOWN" });
      this.broadcast({ type: "state_sync", room: this.room });
      // Schedule countdown alarm.
      await this.ctx.storage.setAlarm(this.room.countdownMs!);
      return;
    }

    // Countdown → Racing transition.
    if (this.room.state === "COUNTDOWN" && this.room.countdownMs !== null && now >= this.room.countdownMs) {
      this.room = startRace(this.room);
      this.pendingStage = null;
      await this.persist();
      this.broadcast({ type: "phase_changed", phase: "RACING" });
      this.broadcast({ type: "state_sync", room: this.room });
      await this.ctx.storage.setAlarm(now + this.room.raceGapDeckMs);
      return;
    }

    // Race: two-stage alarm (DRAW → FLIP).
    if (this.room.state === "RACING") {
      if (this.pendingStage !== "FLIP") {
        // Stage 1: draw a card.
        const beforeLen = this.room.raceLog.length;
        this.room = runDrawStep(this.room, this.rng);
        await this.persist();

        const drawEvents = this.room.raceLog.slice(beforeLen);
        this.broadcast({ type: "race_log", events: drawEvents });

        if (this.room.state === "SETTLEMENT") {
          // Race ended during draw — settle immediately.
          const beforeSettle = this.room.raceLog.length;
          this.room = settleRound(this.room);
          await this.persist();

          const settleEvents = this.room.raceLog.slice(beforeSettle);
          this.broadcast({ type: "race_log", events: settleEvents });

          const settlementResults = computeSettlement(
            Object.values(this.room.bids),
            placements(this.room),
            this.room.trackLength,
          );

          this.broadcast({
            type: "race_ended",
            placements: placements(this.room),
            settlement: settlementResults,
          });
          this.pendingStage = null;
          // Do NOT auto-advance to DISTRIBUTION — hold at SETTLEMENT
          // for the host to click "Continue to Distribution".
          return;
        }

        // Schedule flip stage.
        this.pendingStage = "FLIP";
        await this.ctx.storage.setAlarm(now + this.room.raceGapDeckMs);
        return;
      }

      // Stage 2: flip track card and regression.
      const beforeLen = this.room.raceLog.length;
      this.room = runFlipStep(this.room);
      this.pendingStage = null;
      await this.persist();

      const flipEvents = this.room.raceLog.slice(beforeLen);
      this.broadcast({ type: "race_log", events: flipEvents });

      if (this.room.state === "SETTLEMENT") {
        // Race ended after flip — settle.
        const beforeSettle = this.room.raceLog.length;
        this.room = settleRound(this.room);
        await this.persist();

        const settleEvents = this.room.raceLog.slice(beforeSettle);
        this.broadcast({ type: "race_log", events: settleEvents });

        const settlementResults = computeSettlement(
          Object.values(this.room.bids),
          placements(this.room),
          this.room.trackLength,
        );

        this.broadcast({
          type: "race_ended",
          placements: placements(this.room),
          settlement: settlementResults,
        });
        // Hold at SETTLEMENT; host advances to DISTRIBUTION.
        return;
      }

      // Schedule next draw cycle.
      await this.ctx.storage.setAlarm(now + this.room.raceGapTrackMs);
      return;
    }

    // Distribution timeout.
    if (this.room.state === "DISTRIBUTION" && this.room.distDeadlineMs !== null && now >= this.room.distDeadlineMs) {
      const beforeLen = this.room.raceLog.length;
      this.room = finalizeDistribution(this.room, this.rng);
      await this.persist();
      const newEvents = this.room.raceLog.slice(beforeLen);
      this.broadcast({ type: "race_log", events: newEvents });
      this.broadcast({ type: "phase_changed", phase: "READY" });
      this.broadcastDrinks();
      await this.ctx.storage.setAlarm(this.room.readyDeadlineMs!);
      return;
    }

    // Ready timeout.
    if (this.room.state === "READY" && this.room.readyDeadlineMs !== null && now >= this.room.readyDeadlineMs) {
      // Auto-ready remaining players.
      for (const p of this.room.players) {
        if (!p.drinks.isReady) {
          p.drinks.isReady = true;
        }
      }
      this.pendingStage = null;
      this.room = finishRound(this.room);
      await this.persist();
      // Also delete alarm so it doesn't re-fire.
      await this.ctx.storage.deleteAlarm();
      this.broadcast({ type: "phase_changed", phase: "LOBBY" });
      this.broadcast({ type: "state_sync", room: this.room });
      return;
    }
  }

  // ── Message dispatch ──────────────────────────────────────────────

  private async dispatch(
    ws: WebSocket,
    msg: ClientMessage,
    att: Attachment | null,
  ): Promise<void> {
    if (!this.room) {
      // Room not initialized — only join_room is valid.
      if (msg.type === "join_room") {
        this.room = this.makeEmptyRoom(this.pendingRoomCode ?? "");
        this.handleJoinRoom(ws, msg);
        return;
      }
      this.send(ws, { type: "error", code: "NO_ROOM", message: "Room not initialized" });
      return;
    }

    switch (msg.type) {
      case "join_room":
        this.handleJoinRoom(ws, msg);
        break;

      case "host_lock_room":
        this.assertHost(att);
        this.room = hostSetLock(this.room, { locked: msg.locked });
        await this.persist();
        this.broadcast({ type: "room_locked", locked: msg.locked });
        break;

      case "host_kick_player":
        this.assertHost(att);
        this.room = hostRemovePlayer(this.room, { playerId: msg.playerId });
        await this.persist();
        this.broadcast({ type: "player_left", playerId: msg.playerId });
        break;

      case "host_add_hosted_player": {
        this.assertHost(att);
        const playerId = crypto.randomUUID();
        this.room = hostAddPlayer(this.room, {
          id: playerId,
          name: msg.playerName,
          type: "hosted",
          isHost: false,
        });
        await this.persist();
        this.broadcastPlayerJoined(playerId);
        break;
      }

      case "host_start_race":
        this.assertHost(att);
        this.pendingStage = null;
        this.room = hostStartRace(this.room);
        await this.persist();
        // Schedule bid alarm.
        await this.ctx.storage.setAlarm(this.room.bidDeadlineMs!);
        this.broadcast({ type: "phase_changed", phase: "BIDDING" });
        break;

      case "place_bid": {
        this.assertPlayer(att);
        this.room = placeBid(this.room, {
          playerId: att!.playerId,
          suit: msg.suit,
          amount: msg.amount,
        }, this.rng);
        await this.persist();
        this.broadcast({ type: "bids_updated", bids: Object.values(this.room.bids) });
        // If auto-advance triggered, broadcast phase change and start race.
        if (this.room.state === "COUNTDOWN") {
          this.broadcast({ type: "phase_changed", phase: "COUNTDOWN" });
          this.broadcast({ type: "state_sync", room: this.room });
          this.pendingStage = null;
          await this.ctx.storage.setAlarm(this.room.countdownMs!);
        }
        break;
      }

      case "host_place_bid": {
        this.assertHost(att);
        this.room = placeBid(this.room, {
          playerId: msg.playerId,
          suit: msg.suit,
          amount: msg.amount,
        }, this.rng);
        await this.persist();
        this.broadcast({ type: "bids_updated", bids: Object.values(this.room.bids) });

        if (this.room.state === "COUNTDOWN") {
          this.broadcast({ type: "phase_changed", phase: "COUNTDOWN" });
          this.broadcast({ type: "state_sync", room: this.room });
          this.pendingStage = null;
          await this.ctx.storage.setAlarm(this.room.countdownMs!);
        }
        break;
      }

      case "host_advance_phase":
        this.assertHost(att);
        await this.handleAdvancePhase();
        break;

      case "host_end_game": {
        this.assertHost(att);
        await this.ctx.storage.deleteAlarm();
        this.room = endGame(this.room);
        await this.persist();
        this.broadcast({ type: "game_ended" });
        this.broadcast({ type: "phase_changed", phase: "LOBBY" });
        this.broadcast({ type: "state_sync", room: this.room });
        break;
      }
      case "host_set_track_length": {
        this.assertHost(att);
        this.room = hostSetTrackLength(this.room, { length: msg.length });
        await this.persist();
        this.broadcast({ type: "state_sync", room: this.room });
        break;
      }

      case "assign_drink": {
        this.assertPlayer(att);
        const beforeLen = this.room.raceLog.length;
        this.room = assignDrink(this.room, {
          fromPlayerId: att!.playerId,
          toPlayerId: msg.to,
          amount: msg.amount,
        });
        await this.persist();
        this.broadcastDrinks();
        // Broadcast exactly the new events.
        const newEvents = this.room.raceLog.slice(beforeLen);
        this.broadcast({ type: "race_log", events: newEvents });
        break;
      }

      case "clear_drink": {
        this.assertPlayer(att);
        const beforeLen = this.room.raceLog.length;
        this.room = clearDrink(this.room, {
          fromPlayerId: att!.playerId,
          toPlayerId: msg.toPlayerId,
          amount: msg.amount,
        });
        await this.persist();
        this.broadcastDrinks();
        const newEvents = this.room.raceLog.slice(beforeLen);
        this.broadcast({ type: "race_log", events: newEvents });
        break;
      }

      case "host_assign_drink": {
        this.assertHost(att);
        const beforeLen = this.room.raceLog.length;
        this.room = hostAssignDrink(this.room, {
          fromPlayerId: msg.fromPlayerId,
          toPlayerId: msg.toPlayerId,
          amount: msg.amount,
        });
        await this.persist();
        this.broadcastDrinks();
        const newEvents = this.room.raceLog.slice(beforeLen);
        this.broadcast({ type: "race_log", events: newEvents });
        break;
      }

      case "host_clear_drink": {
        this.assertHost(att);
        const beforeLen = this.room.raceLog.length;
        this.room = hostClearDrink(this.room, {
          fromPlayerId: msg.fromPlayerId,
          toPlayerId: msg.toPlayerId,
          amount: msg.amount,
        });
        await this.persist();
        this.broadcastDrinks();
        const newEvents = this.room.raceLog.slice(beforeLen);
        this.broadcast({ type: "race_log", events: newEvents });
        break;
      }

      case "distribution_done": {
        this.assertPlayer(att);
        const beforeLen = this.room.raceLog.length;
        this.room = markDistributionDone(this.room, { playerId: att!.playerId });
        await this.persist();
        this.broadcastDrinks();
        const newEvents = this.room.raceLog.slice(beforeLen);
        this.broadcast({ type: "race_log", events: newEvents });
        await this.checkAllDone();
        break;
      }

      case "ready": {
        this.assertPlayer(att);
        this.room = markReady(this.room, { playerId: att!.playerId, ready: msg.ready });
        await this.persist();
        this.broadcast({ type: "player_ready", playerId: att!.playerId, ready: msg.ready });
        this.checkAllReady();
        break;
      }

      case "host_set_ready": {
        this.assertHost(att);
        this.room = markReady(this.room, { playerId: msg.playerId, ready: msg.ready });
        await this.persist();
        this.broadcast({ type: "player_ready", playerId: msg.playerId, ready: msg.ready });
        this.checkAllReady();
        break;
      }


      case "host_set_race_pacing": {
        this.assertHost(att);
        this.room = hostSetRacePacing(this.room, { gapDeckMs: msg.gapDeckMs, gapTrackMs: msg.gapTrackMs });
        await this.persist();
        this.broadcast({ type: "state_sync", room: this.room });
        break;
      }

      case "host_set_distribution_time_limit": {
        this.assertHost(att);
        this.room = hostSetDistributionTimeLimit(this.room, { timeLimitMs: msg.timeLimitMs });
        await this.persist();
        this.broadcast({ type: "state_sync", room: this.room });
        break;
      }

      case "host_set_player_name": {
        this.assertHost(att);
        this.room = hostRenamePlayer(this.room, { playerId: msg.playerId, name: msg.name });
        await this.persist();
        this.broadcast({ type: "state_sync", room: this.room });
        break;
      }

      case "change_name": {
        this.assertPlayer(att);
        this.room = selfRename(this.room, { playerId: att!.playerId, name: msg.name });
        await this.persist();
        this.broadcast({ type: "state_sync", room: this.room });
        break;
      }

      case "host_set_bid": {
        this.assertHost(att);
        this.room = placeBid(this.room, {
          playerId: msg.playerId,
          suit: msg.suit,
          amount: msg.amount,
        }, this.rng);
        await this.persist();
        this.broadcast({ type: "bids_updated", bids: Object.values(this.room.bids) });

        if (this.room.state === "COUNTDOWN") {
          this.broadcast({ type: "phase_changed", phase: "COUNTDOWN" });
          this.broadcast({ type: "state_sync", room: this.room });
          this.pendingStage = null;
          await this.ctx.storage.setAlarm(this.room.countdownMs!);
        }
        break;
      }

      default:
        this.send(ws, { type: "error", code: "UNKNOWN", message: "Unhandled message type" });
    }
  }

  // ── Phase advancement (host) ─────────────────────────────────────

  private async handleAdvancePhase(): Promise<void> {
    if (!this.room) return;
    const now = Date.now();

    switch (this.room.state) {
      case "BIDDING":
        this.room = closeBidding(this.room, this.rng);
        this.pendingStage = null;
        await this.persist();
        this.broadcast({ type: "phase_changed", phase: "COUNTDOWN" });
        this.broadcast({ type: "state_sync", room: this.room });
        await this.ctx.storage.setAlarm(this.room.countdownMs!);
        break;

      case "SETTLEMENT": {
        // Advance from results view to distribution.
        this.room = startDistribution(this.room);
        await this.persist();
        this.broadcast({ type: "phase_changed", phase: "DISTRIBUTION" });
        await this.ctx.storage.setAlarm(this.room.distDeadlineMs!);
        break;
      }

      case "DISTRIBUTION": {
        const beforeLen = this.room.raceLog.length;
        this.room = finalizeDistribution(this.room, this.rng);
        await this.persist();
        const newEvents = this.room.raceLog.slice(beforeLen);
        this.broadcast({ type: "race_log", events: newEvents });
        this.broadcast({ type: "phase_changed", phase: "READY" });
        this.broadcastDrinks();
        await this.ctx.storage.setAlarm(this.room.readyDeadlineMs!);
        break;
      }

      case "READY":
        for (const p of this.room.players) {
          if (!p.drinks.isReady) p.drinks.isReady = true;
        }
        this.room = finishRound(this.room);
        this.pendingStage = null;
        await this.persist();
        await this.ctx.storage.deleteAlarm();
        this.broadcast({ type: "phase_changed", phase: "LOBBY" });
        this.broadcast({ type: "state_sync", room: this.room });
        break;

      default:
        break;
    }
  }

  // ── Join room handler ─────────────────────────────────────────────

  private handleJoinRoom(ws: WebSocket, msg: Extract<ClientMessage, { type: "join_room" }>): void {
    if (!this.room) return;
    const isHost = this.room.players.length === 0;
    const playerId = crypto.randomUUID();

    this.room = hostAddPlayer(this.room, {
      id: playerId,
      name: msg.playerName,
      type: "independent",
      isHost,
    });

    ws.serializeAttachment({ playerId } satisfies Attachment);
    this.send(ws, { type: "room_joined", playerId, room: this.room });

    // Broadcast to others.
    const player = this.room.players.find((p) => p.id === playerId)!;
    this.broadcast({ type: "player_joined", player }, ws);

    this.persist();
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private makeEmptyRoom(roomCode: string = ""): Room {
    return {
      id: "pending",
      roomCode,
      hostId: "",
      isLocked: false,
      players: [],
      trackLength: TRACK_MIN,
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
      distributionTimeLimitMs: 30_000,
    };
  }

  private async persist(): Promise<void> {
    if (!this.room) return;
    await this.ctx.storage.put("room_state", JSON.stringify(this.room));
  }

  private send(ws: WebSocket, msg: ServerMessage): void {
    ws.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerMessage, except?: WebSocket): void {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(data);
      } catch {
        // Socket may have closed between enumeration and send.
      }
    }
  }

  private broadcastDrinks(): void {
    if (!this.room) return;
    this.broadcast({
      type: "drinks_updated",
      drinks: this.room.players.map((p) => ({
        playerId: p.id,
        give: p.drinks.give,
        take: p.drinks.take,
        consume: p.drinks.consume,
        gaveAll: p.drinks.gaveAll,
      })),
    });
  }

  private broadcastPlayerJoined(playerId: string): void {
    if (!this.room) return;
    const player = this.room.players.find((p) => p.id === playerId);
    if (player) {
      this.broadcast({ type: "player_joined", player });
    }
  }

  private assertHost(att: Attachment | null): void {
    if (!this.room || !att || att.playerId !== this.room.hostId) {
      throw new GameError("NOT_HOST", "Only the host can perform this action");
    }
  }

  private assertPlayer(att: Attachment | null): void {
    if (!att) {
      throw new GameError("PLAYER_NOT_FOUND", "Not authenticated");
    }
  }

  /**
   * If all players are ready, immediately finish the round.
   */
  private async checkAllReady(): Promise<void> {
    if (!this.room) return;
    if (this.room.state !== "READY") return;
    const allReady = this.room.players.every((p) => p.drinks.isReady);
    if (!allReady) return;

    this.pendingStage = null;
    this.room = finishRound(this.room);
    await this.persist();
    await this.ctx.storage.deleteAlarm();
    this.broadcast({ type: "phase_changed", phase: "LOBBY" });
    this.broadcast({ type: "state_sync", room: this.room });
  }

  /**
   * If all players have marked distribution done, cancel the deadline
   * alarm so the host can trigger the transition manually.
   */
  private async checkAllDone(): Promise<void> {
    if (!this.room || this.room.state !== "DISTRIBUTION") return;
    const allDone = this.room.players.every((p) => p.drinks.gaveAll);
    if (!allDone) return;
    this.room.distDeadlineMs = null;
    await this.ctx.storage.deleteAlarm();
    await this.persist();
    this.broadcast({ type: "state_sync", room: this.room });
  }
}
