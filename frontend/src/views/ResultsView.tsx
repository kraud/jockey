import { For, Show, createMemo } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage } from "../../../shared/messages";
import { SUITS } from "../../../shared/messages";
import type { RaceLogEvent } from "../../../shared/messages";

interface Props {
  state: RoomState;
  send: (msg: ClientMessage) => void;
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

export default function ResultsView(props: Props) {
  const room = () => props.state.room!;
  const isHost = () => props.state.playerId === room().hostId;
  const trackLen = () => room().trackLength;

  const turns = createMemo(() => groupByTurn(room().raceLog));

  const placements = createMemo(() =>
    room().horses
      .filter((h) => h.placement > 0)
      .sort((a, b) => a.placement - b.placement)
  );

  const settlement = () => props.state.lastRaceResult?.settlement ?? [];

  return (
    <>
      <div class="card">
        <span class="phase-badge">SETTLEMENT</span>
        <span style="margin-left:1rem;">Race complete</span>
      </div>

      {/* Placements */}
      <div class="card">
        <h2>Placements</h2>
        <For each={placements()}>
          {(h) => (
            <div style={`color:${COLORS[h.suit] || "#fff"};`}>
              {h.placement}. {h.suit}
            </div>
          )}
        </For>
      </div>

      {/* Settlement */}
      <Show when={settlement().length > 0}>
        <div class="card">
          <h2>Settlement</h2>
          <For each={settlement()}>
            {(r) => {
              const player = room().players.find((p) => p.id === r.playerId);
              return (
                <div>
                  {player?.name ?? r.playerId}: give {r.drinksGive}, take {r.drinksTake}
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Final track state */}
      <div class="card">
        <h2>Final Track</h2>
        <div class="horse-grid" style={`grid-template-columns: 50px repeat(${trackLen()}, 1fr);`}>
          <div class="horse-cell horse-header" />
          <For each={Array.from({ length: trackLen() }, (_, i) => i + 1)}>
            {(step) => <div class="horse-cell horse-header" style="font-size:0.7rem;">{step}</div>}
          </For>
          <For each={SUITS}>
            {(suit) => {
              const horse = createMemo(() => room().horses.find((h) => h.suit === suit));
              const color = () => COLORS[suit] || "#fff";
              return (
                <>
                  <div class="horse-cell" style={`color:${color()};font-weight:bold;font-size:0.85rem;`}>
                    {suit.substring(0, 2)}
                  </div>
                  <For each={Array.from({ length: trackLen() }, (_, i) => i + 1)}>
                    {(step) => {
                      const trackCard = createMemo(() =>
                        room().trackCards.find((tc) => tc.index === step)
                      );
                      const isFlipped = () => trackCard()?.isFlipped ?? false;
                      const cardSuit = () => trackCard()?.suit;
                      const isHorseHere = () =>
                        horse() && horse()!.position === step;
                      return (
                        <div class={`horse-cell${isFlipped() ? " flipped" : ""}`}>
                          {isFlipped() && (
                            <span
                              class="track-card-flipped"
                              style={`color:${COLORS[cardSuit()!] || "#888"};`}
                            >
                              {"\u265E"}
                            </span>
                          )}
                          {isHorseHere() && (
                            <span class="horse-knight" style={`color:${color()};`}>
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
                </>
              );
            }}
          </For>
        </div>
      </div>

      {/* Race log */}
      <div class="card">
        <h2>Race Log</h2>
        <div class="race-log">
          <For each={turns()}>
            {(turn, turnIdx) => (
              <div class={`race-turn${turnIdx() === 0 ? " first" : ""}`}>
                <For each={turn}>
                  {(e) => <div>{eventToText(e)}</div>}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>

      {/* Player list (persists after race) */}
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

      {/* Host advance button */}
      <Show when={isHost()}>
        <div class="card">
          <button onClick={() => props.send({ type: "host_advance_phase" })}>
            Continue to Distribution
          </button>
        </div>
      </Show>
    </>
  );
}
