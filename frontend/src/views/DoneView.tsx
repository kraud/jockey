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
  const isHost = () => props.state.playerId === room().hostId;

  return (
    <>
      {/* Phase badge */}
      <div class="card">
        <span class="phase-badge">READY</span>
      </div>

      {/* Your consume counter */}
      <Show when={me()}>
        {(m) => (
          <div class="card">
            <h2 style="font-size:2rem;text-align:center;margin:0;">
              {m().drinks.consume}
            </h2>
            <p style="text-align:center;margin:0.25rem 0 0 0;">
              Drink {m().drinks.consume} and mark yourself ready.
            </p>
          </div>
        )}
      </Show>

      {/* Your ready toggle */}
      <Show when={me()}>
        {(m) => (
          <div class="card">
            <button
              onClick={() =>
                props.send({ type: "ready", ready: !m().drinks.isReady })
              }
            >
              {m().drinks.isReady ? "Cancel ready" : "I'm ready"}
            </button>
          </div>
        )}
      </Show>

      {/* Live player list card */}
      <div class="card">
        <h2>Players</h2>
        <ul class="player-list">
          <For each={room().players}>
            {(p) => {
              const isMe = () => p.id === props.state.playerId;
              const isHostRow = () => p.id === room().hostId;

              return (
                <li>
                  <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                    {/* Consume counter badge */}
                    <span style="font-size:1.4rem;font-weight:bold;min-width:2rem;text-align:center;">
                      {p.drinks.consume}
                    </span>
                    {/* Name + badges */}
                    <span>
                      {p.name}
                      {isMe() && <span style="color:#e94560;font-size:0.75rem;"> (you)</span>}
                      {isHostRow() && <span style="color:#f0c040;"> [HOST]</span>}
                      {p.type === "hosted" && <span style="color:#a0a0a0;"> [hosted]</span>}
                    </span>
                    {/* Ready indicator */}
                    {p.drinks.isReady ? (
                      <span style="color:#40f040;font-size:0.85rem;">&#x2713; ready</span>
                    ) : p.drinks.give === 0 && !p.drinks.gaveAll ? (
                      <span style="color:#666;font-size:0.75rem;">auto-ready</span>
                    ) : (
                      <span style="color:#666;font-size:0.85rem;">…</span>
                    )}
                  </div>

                  {/* Host can mark hosted player as ready */}
                  <Show when={isHost() && p.type === "hosted" && !p.drinks.isReady}>
                    <div style="margin-top:0.25rem;border-left:3px solid #f0c040;padding-left:0.5rem;">
                      <button
                        style="font-size:0.75rem;padding:0.2rem 0.5rem;"
                        onClick={() =>
                          props.send({ type: "host_set_ready", playerId: p.id, ready: true })
                        }
                      >
                        Mark ready
                      </button>
                    </div>
                  </Show>
                  {/* Host can un-ready hosted player */}
                  <Show when={isHost() && p.type === "hosted" && p.drinks.isReady}>
                    <div style="margin-top:0.25rem;border-left:3px solid #f0c040;padding-left:0.5rem;">
                      <button
                        style="font-size:0.75rem;padding:0.2rem 0.5rem;"
                        onClick={() =>
                          props.send({ type: "host_set_ready", playerId: p.id, ready: false })
                        }
                      >
                        Unready
                      </button>
                    </div>
                  </Show>
                </li>
              );
            }}
          </For>
        </ul>
      </div>

      {/* End-of-round host actions */}
      <Show when={isHost()}>
        <div class="card">
          <h2>Host Actions</h2>
          <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
            <button
              onClick={() => props.send({ type: "host_advance_phase" })}
            >
              End round (new race)
            </button>
            <button
              style="background:#e94560;"
              onClick={() => props.send({ type: "host_end_game" })}
            >
              End game (back to lobby)
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
