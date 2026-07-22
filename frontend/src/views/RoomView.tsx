import { onCleanup } from "solid-js";
import { useParams, useSearchParams } from "@solidjs/router";
import { createRoomConnection } from "../ws/store";
import type { ClientMessage } from "../../../shared/messages";
import LobbyView from "./LobbyView";
import BiddingView from "./BiddingView";
import RacingView from "./RacingView";
import SettlementView from "./SettlementView";
import ReadyView from "./ReadyView";
import CountdownView from "./CountdownView";

// ── frontend/src/views/RoomView.tsx — Phase router: reads room.state, dispatches to the right per-phase view component; owns the createRoomConnection lifecycle. ──
// Depends on: @solidjs/router, solid-js, ../ws/store, all sibling view files.
// Used by: App.tsx.

export default function RoomView() {
  const params = useParams();
  const [search] = useSearchParams<{ name?: string }>();
  const code: string = params.code!;
  const playerName: string = search.name || "Player";

  const { state, send, disconnect } = createRoomConnection(code, playerName);

  onCleanup(() => disconnect());

  return (
    <>
      {(() => {
        const room = state.room;
        if (!room) {
          return (
            <div class="flex items-center justify-center min-h-screen text-body-lg text-[var(--color-on-surface-variant)]">
              <div class="glass p-8 text-center">
                <p>Connecting to room <strong class="text-[var(--color-primary)]">{code}</strong>...</p>
              </div>
            </div>
          );
        }
        const sendFn = send as (msg: ClientMessage) => void;
        switch (room.state) {
          case "LOBBY":
            return <LobbyView state={state} send={sendFn} />;
          case "BIDDING":
            return <BiddingView state={state} send={sendFn} />;
          case "COUNTDOWN":
            return <CountdownView state={state} />;
          case "RACING":
            return <RacingView state={state} />;
          case "SETTLEMENT":
          case "DISTRIBUTION":
            return <SettlementView state={state} send={sendFn} />;
          case "READY":
            return <ReadyView state={state} send={sendFn} />;
          default:
            return <p class="text-[var(--color-error)] text-label-bold p-8">Unknown phase: {room.state}</p>;
        }
      })()}
    </>
  );
}
