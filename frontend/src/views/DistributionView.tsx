import { For, Show } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage } from "../../../shared/messages"

interface Props {
  state: RoomState;
  send: (msg: ClientMessage) => void;
}

function ordinal(n: number): string {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}

export default function DistributionView(props: Props) {
  const room = () => props.state.room!;
  const me = () => room().players.find((p) => p.id === props.state.playerId);

  return (
    <>
      <div class="card">
        <span class="phase-badge">{room().state}</span>
      </div>

      <Show when={props.state.lastRaceResult}>
        {(result) => (
          <div class="card">
            <h2>Race Results</h2>
            <h3>Placements</h3>
            <For each={[...result().placements]}>
              {(p) => (
                <p>
                  {p.placement}
                  {ordinal(p.placement)}: {p.suit}
                </p>
              )}
            </For>
            <h3>Settlement</h3>
            <For each={result().settlement}>
              {(s) => {
                const player = room().players.find((pl) => pl.id === s.playerId);
                return (
                  <p>
                    {player?.name || s.playerId}: +{s.drinksGive} give, +{s.drinksTake} take
                  </p>
                );
              }}
            </For>
          </div>
        )}
      </Show>

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

      <Show when={room().state === "DISTRIBUTION" && me() && me()!.drinks.give > 0}>
        <div class="card">
          <h2>Assign Drinks</h2>
          <For each={room().players.filter((p) => p.id !== props.state.playerId)}>
            {(target) => (
              <div style="margin:0.25rem 0;display:flex;align-items:center;gap:0.5rem;">
                <span>{target.name}</span>
                <button
                  onClick={() =>
                    props.send({
                      type: "assign_drink",
                      to: target.id,
                      amount: 1,
                    })
                  }
                >
                  Give 1
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <div class="card">
        <button onClick={() => props.send({ type: "ready", ready: true })}>
          Ready
        </button>
      </div>
    </>
  );
}
