import { For, createMemo } from "solid-js";
import type { RoomState } from "../ws/store";
import { SUITS } from "../../../shared/messages";
import type { RaceLogEvent } from "../../../shared/messages";
// ── frontend/src/views/RacingView.tsx — RACING phase UI: animated horse grid, face-down track cards, grouped race-log turn stream, settlement summary. ──
// Depends on: solid-js, ../../../shared/messages.
// Used by: RoomView.tsx.


interface Props {
  state: RoomState;
}

const COLORS: Record<string, string> = {
  Coins: "#f0c040",
  Cups: "#a0522d",
  Swords: "#a0a0a0",
  Clubs: "#40f040",
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
      return `Player ${e.playerId}: give ${e.drinksGive}, take ${e.drinksTake}`;
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

  const turns = createMemo(() => groupByTurn(room().raceLog));

  console.log('room().trackCards', room().trackCards)

  return (
    <>
      <div class="card">
        <span class="phase-badge">RACING</span>
        <span style="margin-left:1rem;">Race running...</span>
      </div>

      {/* CSS grid horse track */}
      <div class="card">
        <h2>Track</h2>
        <div class="horse-grid" style={`grid-template-columns: 50px 1fr repeat(${trackLen()}, 1fr) 1fr;`}>
          {/* Header row: lane labels + step numbers */}
          <div class="horse-cell horse-header" />
          <div class="horse-cell horse-header" style="font-size:0.7rem;">start</div>
          <For each={Array.from({ length: trackLen() }, (_, i) => i + 1)}>
            {(step) => {
              const trackCard = createMemo(() =>
                room().trackCards.find((tc) => tc.index === step)
              );
              const isFlipped = () => trackCard()?.isFlipped ?? false;
              const cardSuit = () => trackCard()?.suit;
              return (
                <div class="horse-cell horse-header" style="font-size:0.7rem;">
                  {isFlipped() ? (
                    <span class="track-card-flipped" style={`color:${COLORS[cardSuit()!] || "#888"};font-weight:bold;`}>
                      {cardSuit()!.substring(0, 2)}
                    </span>
                  ) : (
                    <span class="track-card-face-down" style="font-size:1rem;opacity:0.7;">
                      {"\u{1F5CC}"}
                    </span>
                  )}
                </div>
              );
            }}
          </For>
          <div class="horse-cell horse-header" style="font-size:0.7rem;">end</div>

          {/* One row per suit */}
          <For each={SUITS}>
            {(suit) => {
              const horse = createMemo(() => room().horses.find((h) => h.suit === suit));
              const color = () => COLORS[suit] || "#fff";
              return (
                <>
                  <div class="horse-cell" style={`color:${color()};font-weight:bold;font-size:0.85rem;`}>
                    {suit.substring(0, 2)}
                  </div>
                  <div class="horse-cell">
                    {horse() && horse()!.position === 0 && !horse()!.isFinished && (
                      <span class="horse-knight" style={`color:${color()};`}>
                        {"\u265E"}
                      </span>
                    )}
                  </div>
                  <For each={Array.from({ length: trackLen() }, (_, i) => i + 1)}>
                    {(step) => {
                      const trackCard = createMemo(() =>
                        room().trackCards.find((tc) => tc.index === step)
                      );
                      const isHorseHere = () =>
                        horse() && horse()!.position === step && !horse()!.isFinished;
                      return (
                        <div
                          class={`horse-cell`}
                          style={`position:relative;`}
                        >
                          {isHorseHere() && (
                            <span
                              class="horse-knight"
                              style={`color:${color()};`}
                            >
                              {"\u265E"}
                              {horse()!.placement > 0 && (
                                <sup style="font-size:0.6rem;color:gold;">{horse()!.placement}</sup>
                              )}
                            </span>
                          )}
                        </div>
                      );
                    }}
                  </For>
                  <div class="horse-cell">
                    {horse() && horse()!.isFinished && (
                      <span class="horse-knight" style={`color:${color()};`}>
                        {"\u265E"}
                        {horse()!.placement > 0 && (
                          <sup style="font-size:0.6rem;color:gold;">{horse()!.placement}</sup>
                        )}
                      </span>
                    )}
                  </div>
                </>
              );
            }}
          </For>
        </div>
      </div>

      {/* Turn-delimited race log */}
      <div class="card">
        <h2>Race Log</h2>
        <div class="race-log">
          <For each={turns().toReversed()}>
            {(turn, turnIdx) => (
              <div class={`race-turn${turnIdx() === 0 ? " first race-turn--enter" : ""}`}>
                <For each={turn}>
                  {(e) => <div>{eventToText(e)}</div>}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </>
  );
}
