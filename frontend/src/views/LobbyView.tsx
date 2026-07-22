import { For, Show, createSignal, createMemo } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage, Suit } from "@cdc/shared/messages";
import AppShell from "../components/AppShell";
import GlassPanel from "../components/GlassPanel";
import PlayerChip from "../components/PlayerChip";
import Button from "../components/Button";
// ── frontend/src/views/LobbyView.tsx — LOBBY phase UI: 3-column layout (host controls / room info / player list) with player management and race configuration. ──
// Depends on: solid-js, @cdc/shared/messages, ../components/*.
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

  // Track length draft signal
  const [draftTrackLength, setDraftTrackLength] = createSignal(room().trackLength);

  // Collapsible advanced controls
  const [advancedOpen, setAdvancedOpen] = createSignal(false);

  // Hosted player name input
  const [hostedName, setHostedName] = createSignal("");

  function savePacing() {
    props.send({
      type: "host_set_race_pacing",
      gapDeckMs: Math.round(draftPaceDeck() * 1000),
      gapTrackMs: Math.round(draftPaceTrack() * 1000),
    });
  }

  function handleTrackLength(val: number) {
    setDraftTrackLength(val);
    props.send({ type: "host_set_track_length", length: val });
  }

  const playerCount = () => room().players.length;

  return (
    <AppShell title="LOBBY">
      <div class="grid grid-cols-12 gap-[var(--space-gutter)]">
        {/* ═══ Left Column (3) — Host Controls ═══ */}
        <div class="col-span-3">
          <Show when={isHost()}>
            <GlassPanel borderColor="primary" class="flex flex-col gap-6">
              <h2 class="text-headline-md text-[var(--color-primary)]">
                Host Controls
              </h2>

              {/* ── Track Length Slider (always visible) ── */}
              <div class="flex flex-col gap-4">
                <div class="flex justify-between items-center">
                  <label class="text-label-bold text-[var(--color-on-surface-variant)]">
                    Track Length
                  </label>
                  <span class="text-[var(--color-primary)] text-headline-md font-bold tabular-nums">
                    {draftTrackLength()}
                  </span>
                </div>
                <div class="relative h-4 bg-[var(--color-surface-container-low)] rounded-full">
                  <input
                    type="range"
                    min={6}
                    max={20}
                    value={draftTrackLength()}
                    onInput={(e) => handleTrackLength(parseInt(e.currentTarget.value, 10))}
                    class="absolute w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div
                    class="h-full bg-[var(--color-primary)] rounded-full transition-all"
                    style={{ width: `${((draftTrackLength() - 6) / 14) * 100}%` }}
                  />
                </div>
                <div class="flex justify-between text-label-bold text-sm opacity-50">
                  <span class="text-[var(--color-on-surface-variant)]">Sprint</span>
                  <span class="text-[var(--color-on-surface-variant)]">Marathon</span>
                </div>
              </div>

              {/* ── Collapsible Advanced Controls ── */}
              <button
                type="button"
                class="flex items-center justify-between w-full text-label-bold text-[var(--color-on-surface-variant)] hover:text-[var(--color-primary)] transition-colors"
                onClick={() => setAdvancedOpen(!advancedOpen())}
              >
                <span>Advanced Settings</span>
                <span class="material-symbols-outlined transition-transform duration-200" classList={{ "rotate-180": advancedOpen() }}>
                  expand_more
                </span>
              </button>

              <Show when={advancedOpen()}>
                <div class="flex flex-col gap-4 border-t border-[var(--color-outline-variant)] pt-4">
                  {/* ── Lock Room Toggle ── */}
                  <button
                    type="button"
                    class="flex items-center gap-3 px-4 py-3 rounded-[var(--radius-component)] border-2 transition-all duration-200 hover:scale-[1.02]"
                    classList={{
                      "border-[var(--color-secondary)] text-[var(--color-secondary)] bg-[var(--color-secondary)]/10":
                        room().isLocked,
                      "border-[var(--color-outline-variant)] text-[var(--color-on-surface-variant)]":
                        !room().isLocked,
                    }}
                    onClick={() =>
                      props.send({ type: "host_lock_room", locked: !room().isLocked })
                    }
                  >
                    <span class="material-symbols-outlined text-2xl">
                      {room().isLocked ? "lock" : "lock_open"}
                    </span>
                    <span class="text-label-bold">
                      {room().isLocked ? "Unlock Room" : "Lock Room"}
                    </span>
                  </button>

                  {/* ── Distribution Timer ── */}
                  <div class="flex flex-col gap-2 p-4 rounded-[var(--radius-component)] border-2 border-[var(--color-outline-variant)]">
                    <h3 class="text-label-bold text-[var(--color-on-surface-variant)]">
                      Distribution Timer
                    </h3>
                    <div class="flex items-center gap-3">
                      <input
                        type="number"
                        min={5}
                        max={600}
                        step={5}
                        value={room().distributionTimeLimitMs / 1000}
                        class="w-20 bg-[var(--color-surface-container)] border-2 border-[var(--color-outline-variant)] rounded-[var(--radius-component)] px-3 py-2 text-body-lg text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] transition-colors"
                        onChange={(e) => {
                          const secs = Math.max(
                            5,
                            Math.min(600, parseInt(e.currentTarget.value, 10) || 30),
                          );
                          props.send({
                            type: "host_set_distribution_time_limit",
                            timeLimitMs: secs * 1000,
                          });
                        }}
                      />
                      <span class="text-label-bold text-[var(--color-on-surface-variant)] opacity-60">
                        seconds
                      </span>
                    </div>
                  </div>

                  {/* ── Race Pacing ── */}
                  <div class="flex flex-col gap-3 p-4 rounded-[var(--radius-component)] border-2 border-[var(--color-outline-variant)]">
                    <h3 class="text-label-bold text-[var(--color-on-surface-variant)]">
                      Race Pacing
                    </h3>
                    <div class="flex flex-col gap-3">
                      <label class="flex items-center justify-between gap-4">
                        <span class="text-body-lg text-[var(--color-on-surface)]">Deck Gap</span>
                        <div class="flex items-center gap-1">
                          <input
                            type="number"
                            step={0.5}
                            min={0.5}
                            max={10}
                            value={draftPaceDeck()}
                            class="w-16 bg-[var(--color-surface-container)] border-2 border-[var(--color-outline-variant)] rounded-[var(--radius-component)] px-2 py-1 text-body-lg text-[var(--color-on-surface)] text-right outline-none focus:border-[var(--color-primary)] transition-colors"
                            onInput={(e) =>
                              setDraftPaceDeck(parseFloat(e.currentTarget.value) || 2)
                            }
                          />
                          <span class="text-label-bold text-[var(--color-on-surface-variant)] opacity-60 text-xs">
                            s
                          </span>
                        </div>
                      </label>
                      <label class="flex items-center justify-between gap-4">
                        <span class="text-body-lg text-[var(--color-on-surface)]">Track Gap</span>
                        <div class="flex items-center gap-1">
                          <input
                            type="number"
                            step={0.5}
                            min={0.5}
                            max={10}
                            value={draftPaceTrack()}
                            class="w-16 bg-[var(--color-surface-container)] border-2 border-[var(--color-outline-variant)] rounded-[var(--radius-component)] px-2 py-1 text-body-lg text-[var(--color-on-surface)] text-right outline-none focus:border-[var(--color-primary)] transition-colors"
                            onInput={(e) =>
                              setDraftPaceTrack(parseFloat(e.currentTarget.value) || 1)
                            }
                          />
                          <span class="text-label-bold text-[var(--color-on-surface-variant)] opacity-60 text-xs">
                            s
                          </span>
                        </div>
                      </label>
                    </div>
                    <Button
                      variant="secondary"
                      onClick={savePacing}
                      class="w-full !min-h-[40px] text-sm"
                    >
                      Save Pacing
                    </Button>
                  </div>
                </div>
              </Show>

              {/* ── Start Race ── */}
              <Button
                variant="secondary"
                size="xl"
                disabled={playerCount() === 0}
                onClick={() => props.send({ type: "host_start_race" })}
                class={playerCount() > 0 ? "animate-pulse-neon" : ""}
              >
                Start Race
              </Button>
            </GlassPanel>
          </Show>
        </div>

        {/* ═══ Center Column (6) — Room Code & Info ═══ */}
        <div class="col-span-6 flex flex-col items-center gap-[var(--space-stack-lg)]">
          {/* Room Code */}
          <div class="flex flex-col items-center gap-3">
            <p class="text-label-bold text-[var(--color-secondary)] uppercase tracking-widest mb-1">
              Join Code
            </p>
            <h1 class="text-display-xl text-[var(--color-primary)] text-glow-gold tracking-[0.08em] tabular-nums select-all leading-none">
              {room().roomCode}
            </h1>
            <Show when={room().isLocked}>
              <span class="flex items-center gap-2 text-label-bold text-[var(--color-secondary)] animate-pulse-neon">
                <span class="material-symbols-outlined">lock</span>
                ROOM LOCKED
              </span>
            </Show>
          </div>

          {/* QR Code Placeholder */}
          <GlassPanel class="w-full max-w-xs flex flex-col items-center gap-3 text-center py-10 border-[var(--color-secondary)]/40">
            <div class="w-48 h-48 bg-white rounded-2xl flex items-center justify-center">
              <div class="grid grid-cols-8 grid-rows-8 w-40 h-40 gap-1">
                {Array.from({ length: 64 }, (_, i) => (
                  <div
                    class={i % 3 === 0 || i % 7 === 0 || i % 11 === 0 ? "bg-black" : "bg-white"}
                  />
                ))}
              </div>
            </div>
            <span class="text-body-lg text-[var(--color-on-surface-variant)] opacity-60">
              Scan to join or visit
            </span>
            <span class="text-label-bold text-[var(--color-primary)] opacity-80 tracking-wider">
              derbydrafts.game
            </span>
          </GlassPanel>

          {/* Player Count Badge */}
          <div class="flex items-center gap-4 px-8 py-4 glass rounded-[var(--radius-card)] border-2 border-[var(--color-primary)]/30">
            <span class="material-symbols-outlined text-[var(--color-primary)] text-4xl">
              groups
            </span>
            <span class="text-headline-lg text-[var(--color-primary)] tabular-nums">
              {playerCount()}
            </span>
            <span class="text-label-bold text-[var(--color-on-surface-variant)]">
              Player{playerCount() !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* ═══ Right Column (3) — Player List ═══ */}
        <div class="col-span-3 flex flex-col gap-6 h-full overflow-hidden">
          <div class="flex items-center justify-between mb-1">
            <h3 class="text-headline-md text-[var(--color-secondary)]">Players</h3>
            <span class="text-label-bold text-[var(--color-on-surface-variant)]">
              {playerCount()} / 12
            </span>
          </div>

          <div class="flex flex-col gap-3 overflow-y-auto pr-2 flex-1">
            <For each={room().players}>
              {(p) => {
                const bid = createMemo(() => room().bids[p.id]);
                const isMe = () => p.id === props.state.playerId;
                const isHostRow = () => p.id === room().hostId;
                const [draftSuit, setDraftSuit] = createSignal<Suit | null>(
                  bid()?.suit ?? null,
                );
                const [draftAmount, setDraftAmount] = createSignal(bid()?.amount ?? 1);
                const [renameDraft, setRenameDraft] = createSignal(p.name);

                const statusText = () => {
                  if (isHostRow()) return "Host";
                  if (isMe()) return "You";
                  if (!p.isConnected) return "Disconnected";
                  if (bid()) return `${bid()!.suit} ${bid()!.amount}`;
                  return "Waiting";
                };

                return (
                  <div class="flex flex-col gap-2">
                    <div class="flex items-start gap-2">
                      {/* PlayerChip takes remaining space */}
                      <div class="flex-1 min-w-0">
                        <PlayerChip
                          player={p}
                          highlighted={isMe() || isHostRow()}
                          status={statusText()}
                        />
                      </div>

                      {/* Kick button — host only, not self, not host row */}
                      <Show when={isHost() && !isHostRow() && !isMe()}>
                        <button
                          type="button"
                          class="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--color-error)]/20 text-[var(--color-error)] border border-[var(--color-error)]/30 hover:bg-[var(--color-error)] hover:text-[var(--color-on-error)] transition-all shrink-0 mt-1"
                          onClick={() =>
                            props.send({ type: "host_kick_player", playerId: p.id })
                          }
                          title="Remove player"
                        >
                          <span class="material-symbols-outlined text-base">close</span>
                        </button>
                      </Show>
                    </div>

                    {/* Host rename for hosted players */}
                    <Show when={isHost() && p.type === "hosted"}>
                      <div class="flex gap-2 pl-1">
                        <input
                          type="text"
                          value={renameDraft()}
                          maxLength={24}
                          class="flex-1 bg-[var(--color-surface-container)] border-2 border-[var(--color-outline-variant)] rounded-[var(--radius-component)] px-2 py-1.5 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-primary)] transition-colors"
                          onInput={(e) => setRenameDraft(e.currentTarget.value)}
                        />
                        <button
                          type="button"
                          class="text-xs font-bold px-3 py-1.5 rounded-[var(--radius-component)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-primary)] hover:text-[var(--color-on-primary)] transition-colors shrink-0"
                          onClick={() => {
                            const name = renameDraft().trim();
                            if (name && name !== p.name) {
                              props.send({
                                type: "host_set_player_name",
                                playerId: p.id,
                                name,
                              });
                            }
                          }}
                        >
                          Rename
                        </button>
                      </div>
                    </Show>

                    {/* Self rename */}
                    <Show when={isMe()}>
                      <div class="flex gap-2 pl-1">
                        <input
                          type="text"
                          value={renameDraft()}
                          maxLength={24}
                          class="flex-1 bg-[var(--color-surface-container)] border-2 border-[var(--color-outline-variant)] rounded-[var(--radius-component)] px-2 py-1.5 text-sm text-[var(--color-on-surface)] outline-none focus:border-[var(--color-secondary)] transition-colors"
                          onInput={(e) => setRenameDraft(e.currentTarget.value)}
                        />
                        <button
                          type="button"
                          class="text-xs font-bold px-3 py-1.5 rounded-[var(--radius-component)] bg-[var(--color-surface-container-high)] text-[var(--color-on-surface-variant)] hover:bg-[var(--color-secondary)] hover:text-[var(--color-on-secondary)] transition-colors shrink-0"
                          onClick={() => {
                            const name = renameDraft().trim();
                            if (name && name !== p.name) {
                              props.send({ type: "change_name", name });
                            }
                          }}
                        >
                          Change
                        </button>
                      </div>
                    </Show>
                  </div>
                );
              }}
            </For>
          </div>

          {/* ── Add Hosted Player (replaces "Invite More") ── */}
          <Show when={isHost()}>
            <div class="flex gap-3 mt-auto">
              <input
                type="text"
                placeholder="Hosted player name"
                maxLength={24}
                value={hostedName()}
                onInput={(e) => setHostedName(e.currentTarget.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && hostedName().trim()) {
                    props.send({ type: "host_add_hosted_player", playerName: hostedName().trim() });
                    setHostedName("");
                  }
                }}
                class="flex-1 bg-[var(--color-surface-container)] border-2 border-[var(--color-outline-variant)] rounded-[var(--radius-component)] px-3 py-3 text-body-lg text-[var(--color-on-surface)] placeholder-[var(--color-outline)] outline-none focus:border-[var(--color-primary)] transition-colors"
              />
              <button
                type="button"
                disabled={!hostedName().trim()}
                class="bg-[var(--color-primary)] text-[var(--color-on-primary)] px-6 py-3 rounded-[var(--radius-component)] text-label-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                onClick={() => {
                  if (hostedName().trim()) {
                    props.send({ type: "host_add_hosted_player", playerName: hostedName().trim() });
                    setHostedName("");
                  }
                }}
              >
                Add Player
              </button>
            </div>
          </Show>
        </div>
      </div>
    </AppShell>
  );
}
