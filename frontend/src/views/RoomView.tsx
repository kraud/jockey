import { onCleanup } from "solid-js";
import { useParams, useSearchParams } from "@solidjs/router";
import { createRoomConnection } from "../ws/store";
import type { ClientMessage } from "../../../shared/messages";
import LobbyView from "./LobbyView";
import BiddingView from "./BiddingView";
import RacingView from "./RacingView";
import DistributionView from "./DistributionView";
import DoneView from "./DoneView";
import ResultsView from "./ResultsView";

export default function RoomView() {
  const params = useParams();
  const [search] = useSearchParams<{ name?: string }>();
  const code: string = params.code!;
  const playerName: string = search.name || "Player";

  const { state, send, disconnect } = createRoomConnection(code, playerName);

  onCleanup(() => disconnect());

  return (
    <div class="container">
      <h1>CDC</h1>
      {(() => {
        const room = state.room;
        if (!room) {
          return <p>Connecting to room <strong>{code}</strong>...</p>;
        }
        const sendFn = send as (msg: ClientMessage) => void;
        switch (room.state) {
          case "LOBBY":
            return <LobbyView state={state} send={sendFn} />;
          case "BIDDING":
            return <BiddingView state={state} send={sendFn} />;
          case "SETUP":
          case "RACING":
            return <RacingView state={state} />;
          case "SETTLEMENT":
            return <ResultsView state={state} send={sendFn} />;
          case "DISTRIBUTION":
            return <DistributionView state={state} send={sendFn} />;
          case "READY":
            return <DoneView state={state} send={sendFn} />;
          default:
            return <p>Unknown phase: {room.state}</p>;
        }
      })()}
    </div>
  );
}
