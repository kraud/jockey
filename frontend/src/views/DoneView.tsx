import { For, Show } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage } from "../../../shared/messages"

interface Props {
  state: RoomState;
  send: (msg: ClientMessage) => void;
}

export default function DoneView(props: Props) {
  const room = () => props.state.room!;
  const me = () => room().players.find((p) => p.id === props.state.playerId);

  return (
    <>
      <div class="card">
        <span class="phase-badge">READY</span>
      </div>

      <div class="card">
        <h2>Your Drinks</h2>
        <Show when={me()}>
          {(m) => (
            <>
              <p>
                Give: {m().drinks.give} | Take: {m().drinks.take} | Consume:{" "}
                {m().drinks.consume}
              </p>
              <Show when={m().drinks.isReady}>
                <p style="color:#40f040;">Ready!</p>
              </Show>
            </>
          )}
        </Show>
      </div>

      <div class="card">
        <h2>Players</h2>
        <ul class="player-list">
          <For each={room().players}>
            {(p) => (
              <li>
                <span>
                  {p.name}
                  {p.id === room().hostId && <span style="color:#f0c040;"> [HOST]</span>}
                  {p.type === "hosted" && <span style="color:#a0a0a0;"> [hosted]</span>}
                  {p.id === props.state.playerId && <span style="color:#e94560;font-size:0.75rem;"> (you)</span>}
                </span>
              </li>
            )}
          </For>
        </ul>
      </div>

      <div class="card">
        <button onClick={() => props.send({ type: "ready", ready: true })}>
          Ready
        </button>
      </div>
    </>
  );
}
