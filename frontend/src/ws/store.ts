import { createStore } from "solid-js/store";
import type { ClientMessage } from "../../../shared/messages"
import type { RoomState } from "./handle";
import { applyServerMessage, parseServerMessage } from "./handle";
// ── frontend/src/ws/store.ts — createRoomConnection(code, name): opens a WebSocket, manages exponential-backoff reconnect, returns { state, send, disconnect } over a createStore<RoomState>. ──
// Depends on: solid-js/store, ../../../shared/messages, ./handle.
// Used by: RoomView.tsx.


export type { RoomState } from "./handle";

/**
 * Creates a reactive WebSocket connection to a room.
 *
 * Returns a `{ state, send, disconnect }` tuple where `state` is a
 * Solid store that re-renders components on every server message.
 *
 * Reconnect uses exponential backoff (500ms * 2^retry, max 5s, 10 retries)
 * lifted verbatim from the old ws-client.ts.
 */
// ⚠️ STATE MUTATION: opens a WebSocket, mutates `state` via setState on every server message, manages reconnect.
export function createRoomConnection(roomCode: string, playerName: string) {
  const [state, setState] = createStore<RoomState>({
    playerId: "",
    room: null,
    selectedSuit: null,
    selectedAmount: 0,
    bidPlaced: false,
    lastRaceResult: null,
  });

  let ws: WebSocket | null = null;
  let closed = false;
  let retries = 0;
  const maxRetries = 10;

  function connect(): WebSocket {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${location.host}/ws?room=${roomCode}`;
    const socket = new WebSocket(url);

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: "join_room" as const,
        roomCode,
        playerName,
      }));
    };

    socket.onmessage = (event) => {
      const raw = event.data as string;
      const parsed = parseServerMessage(raw);
      if (!parsed) {
        console.error("Failed to parse server message:", raw);
        return;
      }
      setState((prev) => applyServerMessage(prev, parsed));
    };

    socket.onclose = () => {
      if (closed) return;
      if (retries < maxRetries) {
        const delay = Math.min(5000, 500 * Math.pow(2, retries));
        retries++;
        setTimeout(() => {
          if (!closed) ws = connect();
        }, delay);
      }
    };

    socket.onerror = () => {
      // onclose fires after onerror
    };

    return socket;
  }

  ws = connect();

  function send(msg: ClientMessage): void {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  function disconnect(): void {
    closed = true;
    ws?.close();
  }

  return { state, send, disconnect };
}
