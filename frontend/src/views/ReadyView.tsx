import { For, Show } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage } from "../../../shared/messages";
import AppShell from "../components/AppShell";
import GlassPanel from "../components/GlassPanel";
import PlayerChip from "../components/PlayerChip";
import ProgressBar from "../components/ProgressBar";
import Button from "../components/Button";
// ── frontend/src/views/ReadyView.tsx — READY phase UI: drink penalty round with per-player progress, ready toggle, host end-round / end-game. ──
// Depends on: solid-js, ../../../shared/messages, ../components/*.
// Used by: RoomView.tsx.


interface Props {
  state: RoomState;
  send: (msg: ClientMessage) => void;
}

export default function ReadyView(props: Props) {
  const room = () => props.state.room!;
  const me = () => room().players.find((p) => p.id === props.state.playerId);
  const isHost = () => props.state.playerId === room().hostId;

  function markReady() {
    props.send({ type: "ready", ready: true });
  }

  function endRound() {
    props.send({ type: "host_advance_phase" });
  }

  function endGame() {
    props.send({ type: "host_end_game" });
  }

  return (
    <AppShell title="Ready">
      {/* ── Drink penalty header ── */}
      <Show when={me() && me()!.drinks.consume > 0}>
        <h1 class="text-display-xl text-[var(--color-primary)] text-glow-gold text-center mb-8">
          YOU MUST DRINK: {me()!.drinks.consume} SIPS
        </h1>
      </Show>

      {/* ── Bento grid of player drink cards ── */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <For each={room().players}>
          {(p) => {
            const isFinished = p.drinks.gaveAll || p.drinks.isReady;
            const hasConsume = p.drinks.consume > 0;
            const maxDrinks = p.drinks.consume || 1;
            const consumed = Math.max(0, maxDrinks - p.drinks.consume);

            return (
              <GlassPanel
                borderColor={isFinished ? "primary" : hasConsume ? "secondary" : "outline"}
                class={`flex flex-col items-center gap-3 ${hasConsume && !isFinished ? "animate-pulse-neon" : ""}`}
              >
                <PlayerChip player={p} />
                <div class="w-full">
                  <ProgressBar
                    value={consumed}
                    max={maxDrinks}
                    color={isFinished ? "primary" : "secondary"}
                  />
                </div>
                <span
                  class={`text-label-bold text-sm ${
                    isFinished
                      ? "text-[var(--color-primary)]"
                      : "text-[var(--color-secondary)]"
                  }`}
                >
                  {isFinished
                    ? "FINISHED"
                    : `DRINKING (${consumed}/${maxDrinks})`}
                </span>
              </GlassPanel>
            );
          }}
        </For>
      </div>

      {/* ── Ready button (current player only) ── */}
      <Show when={me()}>
        {(m) => (
          <div class="mb-6">
            <Show
              when={!m().drinks.isReady}
              fallback={
                <Button variant="secondary" size="xl" class="w-full" disabled>
                  <span class="material-symbols-outlined mr-2 align-middle">
                    check_circle
                  </span>
                  READY
                </Button>
              }
            >
              <Button variant="secondary" size="xl" class="w-full" onClick={markReady}>
                I HAVE FINISHED DRINKING
              </Button>
            </Show>
            {/* Hosted player note */}
            <Show when={m().type === "hosted" && !m().drinks.isReady}>
              <p class="text-label-bold text-[var(--color-on-surface-variant)] opacity-60 text-center mt-2">
                Host will mark your ready status.
              </p>
            </Show>
          </div>
        )}
      </Show>

      {/* ── Subtitle ── */}
      <p class="text-body-lg text-[var(--color-on-surface-variant)] text-center mb-8 opacity-80">
        Next round starts when everyone is ready.
      </p>

      {/* ── Host controls ── */}
      <Show when={isHost()}>
        <GlassPanel borderColor="outline" class="flex flex-col items-center gap-4">
          <h2 class="text-headline-md text-[var(--color-primary)]">Host Controls</h2>
          <div class="flex flex-wrap gap-4 justify-center">
            <Button variant="primary" size="lg" onClick={endRound}>
              End round (new race)
            </Button>
            <Button variant="danger" size="lg" onClick={endGame}>
              End game (back to lobby)
            </Button>
          </div>
        </GlassPanel>
      </Show>
    </AppShell>
  );
}
