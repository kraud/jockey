import { For, Show, onCleanup, createSignal } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage } from "../../../shared/messages"

interface Props {
  state: RoomState;
  send: (msg: ClientMessage) => void;
}

function ordinal(n: number): string {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}

function badgeStyle(type: "host" | "hosted" | "you") {
  if (type === "host") return "color:#f0c040;";
  if (type === "hosted") return "color:#a0a0a0;";
  return "color:#e94560;font-size:0.75rem;";
}

export default function DistributionView(props: Props) {
  const room = () => props.state.room!;
  const me = () => room().players.find((p) => p.id === props.state.playerId);
  const isHost = () => props.state.playerId === room().hostId;

  // Countdown timer — client-derived from distDeadlineMs
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 250);
  onCleanup(() => clearInterval(timer));

  const remainingSec = () => {
    const dl = room().distDeadlineMs;
    if (dl === null) return null;
    const rem = Math.max(0, dl - now());
    return Math.ceil(rem / 1000);
  };

  const myGive = () => me()?.drinks.give ?? 0;
  const allPlayersDone = () => room().players.every((p) => p.drinks.gaveAll);

  return (
    <>
      {/* Phase badge */}
      <div class="card">
        <span class="phase-badge">{room().state}</span>
      </div>

      {/* Race results card */}
      <Show when={props.state.lastRaceResult}>
        {(result) => (
          <div class="card">
            <h2>Race Results</h2>
            <h3>Placements</h3>
            <For each={[...result().placements].sort((a, b) => a.placement - b.placement)}>
              {(p) => (
                <p>{p.placement}{ordinal(p.placement)}: {p.suit}</p>
              )}
            </For>
            <h3>Settlement</h3>
            <For each={result().settlement}>
              {(s) => (
                <p>
                  {room().players.find((pl) => pl.id === s.playerId)?.name ?? s.playerId}:{" "}
                  Give {s.drinksGive} / Take +{s.drinksTake}
                </p>
              )}
            </For>
          </div>
        )}
      </Show>

      {/* Your counters card */}
      <Show when={me()}>
        {(m) => (
          <div class="card">
            <h2>Your Counters</h2>
            <p>
              <strong>Give:</strong> {m().drinks.give}{" "}
              <strong>Take:</strong> {m().drinks.take}{" "}
              <Show when={!isHost() || m().drinks.give > 0}>
                <strong>Consume:</strong> {m().drinks.consume}
              </Show>
            </p>
          </div>
        )}
      </Show>

      {/* Time remaining line */}
      <Show when={room().distDeadlineMs !== null}>
        <div class="card" style={remainingSec()! <= 0 ? "opacity:0.5;" : ""}>
          <p>
            Time remaining: <strong>{remainingSec()}s</strong>
          </p>
        </div>
      </Show>

      {/* Live player list card */}
      <div class="card">
        <h2>Players</h2>
        <ul class="player-list">
          <For each={room().players}>
            {(p) => {
              const isMe = () => p.id === props.state.playerId;
              const isHostRow = () => p.id === room().hostId;
              // Host acting on behalf of a hosted player who still has give
              const showHostAction = () => isHost() && p.type === "hosted" && p.drinks.give > 0;
              const hostRemaining = () => p.drinks.give;

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
                      {isMe() && <span style={badgeStyle("you")}> (you)</span>}
                      {isHostRow() && <span style={badgeStyle("host")}> [HOST]</span>}
                      {p.type === "hosted" && <span style={badgeStyle("hosted")}> [hosted]</span>}
                    </span>
                    {/* Done indicator */}
                    {p.drinks.gaveAll && (
                      <span style="color:#40f040;font-size:0.85rem;">&#x2713; done</span>
                    )}
                    {/* Auto-ready indicator */}
                    {p.drinks.give === 0 && !p.drinks.gaveAll && (
                      <span style="color:#666;font-size:0.75rem;">auto-ready</span>
                    )}
                    {/* Ready indicator */}
                    {p.drinks.isReady && (
                      <span style="color:#40c0f0;font-size:0.85rem;">&#x2713; ready</span>
                    )}
                  </div>

                  {/* Self-assign action: +1 / +N for non-self target when viewer has give */}
                  <Show when={!isMe() && myGive() > 0}>
                    <div style="margin-top:0.25rem;display:flex;gap:0.25rem;">
                      <button
                        style="font-size:0.75rem;padding:0.2rem 0.5rem;"
                        onClick={() => props.send({ type: "assign_drink", to: p.id, amount: 1 })}
                      >
                        +1
                      </button>
                      <Show when={myGive() > 1}>
                        <button
                          style="font-size:0.75rem;padding:0.2rem 0.5rem;"
                          onClick={() => props.send({ type: "assign_drink", to: p.id, amount: Math.min(myGive(), 5) })}
                        >
                          +{Math.min(myGive(), 5)}
                        </button>
                      </Show>
                    </div>
                  </Show>

                  {/* Clear action: −1 / −N for non-self target when target has consume and viewer is a giver */}
                  <Show when={!isMe() && me() && me()!.drinks.give > 0 && p.drinks.consume > 0}>
                    <div style="margin-top:0.25rem;display:flex;gap:0.25rem;">
                      <button
                        style="font-size:0.75rem;padding:0.2rem 0.5rem;background:#e94560;"
                        onClick={() => props.send({ type: "clear_drink", fromPlayerId: me()!.id, toPlayerId: p.id, amount: 1 })}
                      >
                        −1
                      </button>
                      <Show when={p.drinks.consume > 1}>
                        <button
                          style="font-size:0.75rem;padding:0.2rem 0.5rem;background:#e94560;"
                          onClick={() => props.send({ type: "clear_drink", fromPlayerId: me()!.id, toPlayerId: p.id, amount: Math.min(p.drinks.consume, 5) })}
                        >
                          −{Math.min(p.drinks.consume, 5)}
                        </button>
                      </Show>
                    </div>
                  </Show>

                  {/* Host action block for hosted player */}
                  <Show when={showHostAction()}>
                    <div style="margin-top:0.25rem;display:flex;gap:0.25rem;border-left:3px solid #f0c040;padding-left:0.5rem;">
                      <span style="font-size:0.7rem;color:#a0a0a0;">host proxy:</span>
                      <button
                        style="font-size:0.75rem;padding:0.2rem 0.5rem;"
                        onClick={() => props.send({ type: "host_assign_drink", fromPlayerId: p.id, toPlayerId: p.id, amount: 1 })}
                      >
                        self +1
                      </button>
                      <For each={room().players}>
                        {(target) => (
                          <Show when={target.id !== p.id}>
                            <button
                              style="font-size:0.75rem;padding:0.2rem 0.5rem;"
                              onClick={() => props.send({ type: "host_assign_drink", fromPlayerId: p.id, toPlayerId: target.id, amount: 1 })}
                            >
                              →{target.name} +1
                            </button>
                            <Show when={hostRemaining() > 1}>
                              <button
                                style="font-size:0.75rem;padding:0.2rem 0.5rem;"
                                onClick={() => props.send({ type: "host_assign_drink", fromPlayerId: p.id, toPlayerId: target.id, amount: Math.min(hostRemaining(), 5) })}
                              >
                                →{target.name} +{Math.min(hostRemaining(), 5)}
                              </button>
                            </Show>
                            {/* Host clear for hosted player */}
                            <Show when={target.drinks.consume > 0}>
                              <button
                                style="font-size:0.75rem;padding:0.2rem 0.5rem;background:#e94560;"
                                onClick={() => props.send({ type: "host_clear_drink", fromPlayerId: p.id, toPlayerId: target.id, amount: 1 })}
                              >
                                →{target.name} −1
                              </button>
                            </Show>
                          </Show>
                        )}
                      </For>
                    </div>
                  </Show>
                </li>
              );
            }}
          </For>
        </ul>
      </div>

      {/* I'm done assigning — only when pool is empty and not yet marked done */}
      <Show when={me() && me()!.drinks.give === 0 && !me()!.drinks.gaveAll}>
        <div class="card">
          <button onClick={() => props.send({ type: "distribution_done" })}>
            I'm done assigning
          </button>
        </div>
      </Show>

      {/* Waiting for host — when done */}
      <Show when={me()?.drinks.gaveAll}>
        <div class="card">
          <p style="color:#40f040;">&#x2713; waiting for host</p>
        </div>
      </Show>

      {/* Your ready button */}
      <div class="card">
        <button onClick={() => props.send({ type: "ready", ready: true })}>
          Ready
        </button>
      </div>

      {/* Host: Finalize distribution */}
      <Show when={isHost()}>
        <div class="card">
          <button
            onClick={() => props.send({ type: "host_advance_phase" })}
            disabled={!allPlayersDone()}
            title={allPlayersDone() ? undefined : "Waiting for all players to mark done"}
            style={!allPlayersDone() ? "opacity:0.5;cursor:not-allowed;" : ""}
          >
            Finalize distribution
          </button>
        </div>
      </Show>
    </>
  );
}
