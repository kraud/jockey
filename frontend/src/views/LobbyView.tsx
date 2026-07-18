import { For, Show, createSignal, createMemo } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage, Suit } from "../../../shared/messages";
import { SUITS } from "../../../shared/messages";
// ── frontend/src/views/LobbyView.tsx — LOBBY phase UI: player list, host controls (lock, kick, hosted-player add, track length, race pacing, distribution timer, start race). ──
// Depends on: solid-js, ../../../shared/messages.
// Used by: RoomView.tsx.


interface Props {
  state: RoomState;
  send: (msg: ClientMessage) => void;
}

export default function LobbyView(props: Props) {
  const room = () => props.state.room!;
  const isHost = () => props.state.playerId === room().hostId;

  // Pacing signals (in seconds, derived from room ms)
  const paceDeck = createMemo(() => room().raceGapDeckMs / 1000);
  const paceTrack = createMemo(() => room().raceGapTrackMs / 1000);
  const [draftPaceDeck, setDraftPaceDeck] = createSignal(paceDeck());
  const [draftPaceTrack, setDraftPaceTrack] = createSignal(paceTrack());

  function savePacing() {
    props.send({
      type: "host_set_race_pacing",
      gapDeckMs: Math.round(draftPaceDeck() * 1000),
      gapTrackMs: Math.round(draftPaceTrack() * 1000),
    });
  }

  return (
    <>
      <div class="card">
        <span>
          Room: <strong>{room().roomCode}</strong>
        </span>
        <span class="phase-badge">LOBBY</span>
        <Show when={room().isLocked}>
          <span style="color:#e94560;"> LOCKED</span>
        </Show>
      </div>

      {/* Player List card (first, before host controls) */}
      <div class="card">
        <h2>Players</h2>
        <ul class="player-list">
          <For each={room().players}>
            {(p) => {
              const bid = () => room().bids[p.id];
              const isMe = () => p.id === props.state.playerId;
              const isHostRow = () => p.id === room().hostId;
              const [draftSuit, setDraftSuit] = createSignal<Suit | null>(bid()?.suit ?? null);
              const [draftAmount, setDraftAmount] = createSignal(bid()?.amount ?? 1);
              const [renameDraft, setRenameDraft] = createSignal(p.name);

              return (
                <li>
                  <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
                    <span>
                      {p.name}
                      {isMe() && <span style="color:#e94560;font-size:0.75rem;"> (you)</span>}
                      {isHostRow() && <span style="color:#f0c040;"> [HOST]</span>}
                      {p.type === "hosted" && <span style="color:#a0a0a0;"> [hosted]</span>}
                      {!p.isConnected && <span style="color:#e94560;"> (disconnected)</span>}
                    </span>
                    {bid() && (
                      <span style="font-size:0.8rem;color:#40c0f0;">
                        {bid()!.suit} {bid()!.amount}
                      </span>
                    )}
                  </div>


                  {/* Host rename for hosted players */}
                  <Show when={isHost() && p.type === "hosted"}>
                    <div style="margin-top:0.25rem;display:flex;gap:0.25rem;align-items:center;">
                      <input
                        type="text"
                        value={renameDraft()}
                        maxLength={24}
                        style="font-size:0.8rem;padding:0.2rem 0.4rem;width:120px;"
                        onInput={(e) => setRenameDraft(e.currentTarget.value)}
                      />
                      <button
                        style="font-size:0.7rem;padding:0.2rem 0.4rem;"
                        onClick={() => {
                          const name = renameDraft().trim();
                          if (name && name !== p.name) {
                            props.send({ type: "host_set_player_name", playerId: p.id, name });
                          }
                        }}
                      >
                        Rename
                      </button>
                    </div>
                  </Show>

                  {/* Self rename for own row */}
                  <Show when={isMe()}>
                    <div style="margin-top:0.25rem;display:flex;gap:0.25rem;align-items:center;">
                      <input
                        type="text"
                        value={renameDraft()}
                        maxLength={24}
                        style="font-size:0.8rem;padding:0.2rem 0.4rem;width:120px;"
                        onInput={(e) => setRenameDraft(e.currentTarget.value)}
                      />
                      <button
                        style="font-size:0.7rem;padding:0.2rem 0.4rem;"
                        onClick={() => {
                          const name = renameDraft().trim();
                          if (name && name !== p.name) {
                            props.send({ type: "change_name", name });
                          }
                        }}
                      >
                        Change name
                      </button>
                    </div>
                  </Show>

                  {/* Remove button (host only, not self) */}
                  <Show when={isHost() && !isHostRow()}>
                    <button
                      style="font-size:0.7rem;padding:0.2rem 0.5rem;margin-top:0.25rem;"
                      onClick={() => props.send({ type: "host_kick_player", playerId: p.id })}
                    >
                      Remove
                    </button>
                  </Show>
                </li>
              );
            }}
          </For>
        </ul>
      </div>

      {/* Host Controls card (second) */}
      <Show when={isHost()}>
        <div class="card">
          <h2>Host Controls</h2>
          <label>
            Track length:{" "}
            <input
              type="number"
              min={6}
              max={20}
              value={room().trackLength}
              onChange={(e) =>
                props.send({
                  type: "host_set_track_length",
                  length: parseInt(e.currentTarget.value, 10),
                })
              }
            />
          </label>

          {/* Pacing sub-card */}
          <div style="margin:0.75rem 0;padding:0.5rem;border:1px solid #533483;border-radius:4px;">
            <h3 style="font-size:0.95rem;margin:0 0 0.5rem 0;">Pacing</h3>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
              <label style="font-size:0.85rem;">
                Deck gap:{" "}
                <input
                  type="number"
                  step={0.5}
                  min={0.5}
                  max={10}
                  style="width:70px;"
                  value={draftPaceDeck()}
                  onInput={(e) => setDraftPaceDeck(parseFloat(e.currentTarget.value) || 2)}
                />
                s
              </label>
              <label style="font-size:0.85rem;">
                Track gap:{" "}
                <input
                  type="number"
                  step={0.5}
                  min={0.5}
                  max={10}
                  style="width:70px;"
                  value={draftPaceTrack()}
                  onInput={(e) => setDraftPaceTrack(parseFloat(e.currentTarget.value) || 1)}
                />
                s
              </label>
              <button style="font-size:0.8rem;" onClick={savePacing}>Save pacing</button>
            </div>
          </div>

          {/* Distribution timer sub-card */}
          <div style="margin:0.75rem 0;padding:0.5rem;border:1px solid #533483;border-radius:4px;">
            <h3 style="font-size:0.95rem;margin:0 0 0.5rem 0;">Distribution timer</h3>
            <div style="display:flex;gap:0.5rem;align-items:center;">
              <input
                type="number"
                min={5}
                max={600}
                step={5}
                style="width:80px;"
                value={room().distributionTimeLimitMs / 1000}
                onChange={(e) => {
                  const secs = Math.max(5, Math.min(600, parseInt(e.currentTarget.value, 10) || 30));
                  props.send({ type: "host_set_distribution_time_limit", timeLimitMs: secs * 1000 });
                }}
              />
              <span style="font-size:0.85rem;">seconds</span>
             </div>
           </div>

          <button
            onClick={() =>
              props.send({ type: "host_lock_room", locked: !room().isLocked })
            }
          >
            {room().isLocked ? "Unlock Room" : "Lock Room"}
          </button>

          <div style="margin-top:0.5rem;">
            <input
              type="text"
              placeholder="Hosted player name"
              maxLength={24}
              id="hosted-name-input"
            />
            <button
              onClick={() => {
                const el = document.getElementById("hosted-name-input") as HTMLInputElement;
                const name = el?.value.trim();
                if (name) {
                  props.send({ type: "host_add_hosted_player", playerName: name });
                  el.value = "";
                }
              }}
            >
              Add Hosted
            </button>
          </div>

          <div class="primary-action" style="margin-top:1rem;">
            <button onClick={() => props.send({ type: "host_start_race" })}>
              Start Race
            </button>
          </div>
        </div>
      </Show>
    </>
  );
}
