import { For, Show, createMemo, createSignal } from "solid-js";
import type { RoomState } from "../ws/store";
import type { Suit, RaceLogEvent, Horse, Card } from "@cdc/shared/messages";
import { SUITS } from "@cdc/shared/messages";
import AppShell from "../components/AppShell";
import GlassPanel from "../components/GlassPanel";
import SuitIcon from "../components/SuitIcon";
// ── RacingView.tsx — RACING phase: CSS grid horse track, draw pile, race log, and floating state indicator. ──
// Depends on: solid-js, @cdc/shared/messages, ../components/*, ../ws/store.
// Used by: RoomView.tsx.

interface Props {
  state: RoomState;
}

const SUIT_COLOR: Record<Suit, string> = {
  Coins: "var(--color-coins)",
  Cups: "var(--color-cups)",
  Swords: "var(--color-swords)",
  Clubs: "var(--color-clubs)",
};

const SUIT_LABEL: Record<Suit, string> = {
  Coins: "Cn",
  Cups: "Cp",
  Swords: "Sw",
  Clubs: "Cl",
};

function eventToText(e: RaceLogEvent): string {
  switch (e.type) {
    case "DECK_DRAW":
      return `Draw: ${e.card.rank} of ${e.suit}${e.ignored ? " (ignored)" : ""}`;
    case "HORSE_MOVE":
      return `${e.suit} moves ${e.from}\u2192${e.to} (${e.reason})`;
    case "TRACK_FLIP":
      return `Track card ${e.index} flipped: ${e.suit}${e.ignored ? " (ignored)" : ""}`;
    case "HORSE_FINISH":
      return `${e.suit} finishes in place ${e.placement}!`;
    case "RACE_END":
      return "Race over!";
    case "SETTLEMENT":
      return `Player ${e.playerId}: give ${e.drinksGive}, consume ${e.drinksConsume}`;
    case "DRINK_GIVE":
      return `${e.from} gives ${e.amount} to ${e.to}`;
    case "DRINK_AUTO":
      return `Auto: ${e.amount} drink to ${e.to}`;
    case "PLAYER_READY":
      return `Player ${e.playerId} is ready`;
    default:
      return `Unknown event`;
  }
}

/** Group raceLog events into turns delimited by DECK_DRAW events. */
function groupByTurn(events: RaceLogEvent[]): RaceLogEvent[][] {
  const turns: RaceLogEvent[][] = [];
  let current: RaceLogEvent[] = [];
  for (const e of events) {
    if (e.type === "DECK_DRAW" && current.length > 0) {
      turns.push(current);
      current = [];
    }
    current.push(e);
  }
  if (current.length > 0) turns.push(current);
  return turns;
}

export default function RacingView(props: Props) {
  const room = () => props.state.room!;
  const trackLen = () => room().trackLength;

  const [logOpen, setLogOpen] = createSignal(false);

  // Derived: draw pile size from deckState
  const drawPileSize = () => room().deckState.drawPile.length;

  // Derived: last drawn card from race log
  const lastDrawnCard = createMemo<Card | null>(() => {
    const log = room().raceLog;
    for (let i = log.length - 1; i >= 0; i--) {
      const e = log[i];
      if (e.type === "DECK_DRAW") return e.card;
    }
    return null;
  });

  // Leader: horse with max position (not yet finished), or highest placement among finished
  const leader = createMemo<Horse | null>(() => {
    const horses = room().horses;
    const active = horses.filter((h) => !h.isFinished);
    if (active.length > 0) {
      return active.reduce((a, b) => (a.position > b.position ? a : b));
    }
    // All finished — pick the one with placement 1
    return horses.find((h) => h.placement === 1) ?? null;
  });

  const turns = createMemo(() => {
    const log = room().raceLog;
    // Last 20 events, grouped by turn, newest first
    const recent = log.slice(-20);
    return groupByTurn(recent).slice().reverse();
  });

  // Grid column style string
  const gridStyle = () =>
    `grid-template-columns: 80px 100px repeat(${trackLen()}, 1fr) 100px;`;

  return (
    <AppShell title="RACING">
      <div class="flex flex-col gap-8">
        {/* ── Header Row: Draw Pile + Last Card + Leader ── */}
        <div class="grid grid-cols-3 gap-6">
          {/* Draw Pile */}
          <GlassPanel borderColor="outline">
            <div class="flex flex-col items-center gap-2">
              <span class="text-label-bold text-[var(--color-on-surface-variant)] opacity-60 uppercase tracking-wider">
                Draw Pile
              </span>
              <span class="text-headline-md text-[var(--color-primary)] text-glow-gold">
                {drawPileSize()}
              </span>
              <span class="text-body-lg text-[var(--color-on-surface)] opacity-80">
                DRAW
              </span>
            </div>
          </GlassPanel>

          {/* Last Drawn Card */}
          <GlassPanel borderColor="primary">
            <div class="flex flex-col items-center gap-2">
              <span class="text-label-bold text-[var(--color-on-surface-variant)] opacity-60 uppercase tracking-wider">
                Last Draw
              </span>
              <Show
                when={lastDrawnCard()}
                fallback={
                  <span class="text-body-lg text-[var(--color-on-surface)] opacity-40">
                    &mdash;
                  </span>
                }
              >
                {(card) => (
                  <div class="flex flex-col items-center gap-1">
                    <SuitIcon suit={card().suit} size="sm" />
                    <span
                      class="text-headline-md"
                      style={{ color: SUIT_COLOR[card().suit] }}
                    >
                      {card().rank}
                    </span>
                  </div>
                )}
              </Show>
            </div>
          </GlassPanel>

          {/* Race Status / Leader */}
          <GlassPanel borderColor="secondary">
            <div class="flex flex-col items-center gap-2">
              <span class="text-label-bold text-[var(--color-on-surface-variant)] opacity-60 uppercase tracking-wider">
                Leader
              </span>
              <Show
                when={leader()}
                fallback={
                  <span class="text-body-lg text-[var(--color-on-surface)] opacity-40">
                    &mdash;
                  </span>
                }
              >
                {(l) => (
                  <div class="flex flex-col items-center gap-1">
                    <SuitIcon suit={l().suit} size="sm" />
                    <span
                      class="text-headline-md"
                      style={{ color: SUIT_COLOR[l().suit] }}
                    >
                      {l().isFinished ? `#${l().placement}` : `+${l().position}`}
                    </span>
                  </div>
                )}
              </Show>
            </div>
          </GlassPanel>
        </div>

        {/* ── Track Grid ── */}
        <GlassPanel class="overflow-x-auto">
          <div
            class="grid gap-px"
            style={gridStyle()}
          >
            {/* Header Row: track card positions */}
            <div class="flex items-center justify-center h-10" />
            <div class="flex items-center justify-center h-10 text-label-bold text-[var(--color-on-surface-variant)] opacity-60 uppercase text-xs">
              Start
            </div>
            <For each={Array.from({ length: trackLen() }, (_, i) => i + 1)}>
              {(step) => {
                const trackCard = createMemo(
                  () => room().trackCards.find((tc) => tc.index === step)
                );
                const isFlipped = () => trackCard()?.isFlipped ?? false;
                const cardSuit = () => trackCard()?.suit;
                return (
                  <div class="flex items-center justify-center h-10">
                    <Show
                      when={isFlipped()}
                      fallback={
                        <span class="material-symbols-outlined text-lg text-[var(--color-on-surface-variant)] opacity-40">
                          lock
                        </span>
                      }
                    >
                      <SuitIcon suit={cardSuit()!} size="sm" />
                    </Show>
                  </div>
                );
              }}
            </For>
            <div class="flex items-center justify-center h-10 text-label-bold text-[var(--color-on-surface-variant)] opacity-60 uppercase text-xs">
              End
            </div>

            {/* Suit Rows */}
            <For each={SUITS}>
              {(suit) => {
                const horse = createMemo(
                  () => room().horses.find((h) => h.suit === suit)
                );
                const color = () => SUIT_COLOR[suit];
                const isActive = () =>
                  horse() && !horse()!.isFinished;

                return (
                  <>
                    {/* Suit label */}
                    <div
                      class="flex items-center justify-center font-bold text-sm"
                      style={{ color: color() }}
                    >
                      {SUIT_LABEL[suit]}
                    </div>

                    {/* Start column */}
                    <div class="flex items-center justify-center">
                      <Show when={horse()?.position === 0 && isActive()}>
                        <span
                          class="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 text-lg animate-pulse-gold"
                          style={{
                            color: color(),
                            "border-color": color(),
                          }}
                        >
                          {"\u265E"}
                        </span>
                      </Show>
                    </div>

                    {/* Track step columns */}
                    <For each={Array.from({ length: trackLen() }, (_, i) => i + 1)}>
                      {(step) => {
                        const horseHere = () =>
                          horse() && horse()!.position === step && !horse()!.isFinished;
                        return (
                          <div class="flex items-center justify-center relative">
                            <Show when={horseHere()}>
                              <span
                                class="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 text-lg border-glow-active"
                                style={{
                                  color: color(),
                                  "border-color": color(),
                                }}
                              >
                                {"\u265E"}
                              </span>
                            </Show>
                          </div>
                        );
                      }}
                    </For>

                    {/* End column */}
                    <div class="flex items-center justify-center">
                      <Show when={horse()?.isFinished}>
                        <span
                          class="inline-flex items-center justify-center w-10 h-10 rounded-full border-2 text-lg font-bold animate-pulse-gold"
                          style={{
                            color: "var(--color-primary)",
                            "border-color": "var(--color-primary)",
                          }}
                        >
                          <span class="text-xs">#{horse()!.placement}</span>
                        </span>
                      </Show>
                    </div>
                  </>
                );
              }}
            </For>
          </div>
        </GlassPanel>

        {/* ── Race Log (collapsible) ── */}
        <GlassPanel borderColor="outline">
          <button
            type="button"
            class="w-full flex items-center justify-between text-label-bold text-[var(--color-on-surface-variant)] uppercase tracking-wider"
            onClick={() => setLogOpen((v) => !v)}
          >
            <span>Race Log</span>
            <span class="material-symbols-outlined text-2xl transition-transform duration-200"
              style={{ transform: logOpen() ? "rotate(180deg)" : "rotate(0deg)" }}
            >
              expand_more
            </span>
          </button>
          <Show when={logOpen()}>
            <div class="mt-4 space-y-2 max-h-80 overflow-y-auto">
              <Show
                when={turns().length > 0}
                fallback={
                  <p class="text-body-lg text-[var(--color-on-surface)] opacity-40 text-center py-4">
                    No events yet
                  </p>
                }
              >
                <For each={turns()}>
                  {(turn, turnIdx) => (
                    <div
                      class="glass p-3 rounded-lg border border-[var(--color-outline-variant)]"
                      classList={{
                        "border-[var(--color-primary)]": turnIdx() === 0,
                        "border-glow-active": turnIdx() === 0,
                      }}
                    >
                      <For each={turn}>
                        {(e) => (
                          <div class="text-body-lg text-[var(--color-on-surface)] opacity-80 leading-relaxed">
                            {eventToText(e)}
                          </div>
                        )}
                      </For>
                    </div>
                  )}
                </For>
              </Show>
            </div>
          </Show>
        </GlassPanel>

        {/* ── Floating Action / Status ── */}
        <div class="flex justify-center">
          <div class="glass px-10 py-4 rounded-full border-[var(--color-secondary)] animate-pulse-neon">
            <span class="text-label-bold text-[var(--color-secondary)] text-glow-pink uppercase tracking-wider">
              RACE IN PROGRESS...
            </span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
