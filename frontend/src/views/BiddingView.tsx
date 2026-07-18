import { For, createSignal, Show } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage, Suit } from "../../../shared/messages"
import { SUITS } from "../../../shared/messages"
// ── frontend/src/views/BiddingView.tsx — BIDDING phase UI: suit + bid amount selection, host's "place bid for player" form, per-player remaining time, auto-close indicator. ──
// Depends on: solid-js, ../../../shared/messages.
// Used by: RoomView.tsx.


interface Props {
  state: RoomState;
  send: (msg: ClientMessage) => void;
}

export default function BiddingView(props: Props) {
  const room = () => props.state.room!;
  // Remaining time for bid deadline
  const remaining = () => {
    const ms = room().bidDeadlineMs;
    if (!ms) return null;
    return Math.max(0, Math.ceil((ms - Date.now()) / 1000));
  };
  const isHost = () => props.state.playerId === room().hostId;

  return (
    <>
      <div class="card">
        <span class="phase-badge">BIDDING</span>
        <Show when={remaining() !== null}>
          <span style="float:right;">{remaining()}s</span>
        </Show>
      </div>

      <Show
        when={!props.state.bidPlaced}
        fallback={
          <div class="card">
            <p>Bid submitted! Waiting for others...</p>
          </div>
        }
      >
        <BidForm state={props.state} send={props.send} />
      </Show>

      <div class="card">
        <h2>Bids</h2>
        <ul class="player-list">
          <For each={room().players}>
            {(p) => {
              const hasBid = !!room().bids[p.id];
              return (
                <li style={hasBid ? "color:#40f040;" : ""}>
                  {p.name}: {hasBid ? "ready" : "pending"}
                </li>
              );
            }}
          </For>
        </ul>
      </div>

      {/* Host Bid Controls card */}
      <Show when={isHost()}>
        <div class="card">
          <h2>Host Bid Controls</h2>
          <For each={room().players.filter(p => p.type === "hosted")}>
            {(p) => {
              const existingBid = () => room().bids[p.id];
              const [draftSuit, setDraftSuit] = createSignal<Suit | null>(existingBid()?.suit ?? null);
              const [draftAmount, setDraftAmount] = createSignal(existingBid()?.amount ?? 1);
              return (
                <div style="margin-top:0.5rem;display:flex;gap:0.25rem;align-items:center;flex-wrap:wrap;">
                  <span style="font-size:0.85rem;">{p.name}</span>
                  <select
                    value={draftSuit() ?? ""}
                    onChange={(e) => {
                      const v = e.currentTarget.value as Suit | "";
                      if (v) {
                        setDraftSuit(v);
                        props.send({ type: "host_set_bid", playerId: p.id, suit: v, amount: draftAmount() });
                      }
                    }}
                  >
                    <option value="" disabled>Suit</option>
                    <For each={SUITS}>{(s) => <option value={s}>{s}</option>}</For>
                  </select>
                  <select
                    value={draftAmount()}
                    onChange={(e) => {
                      const v = parseInt(e.currentTarget.value, 10);
                      if (v >= 1 && v <= 5) {
                        setDraftAmount(v);
                        if (draftSuit()) {
                          props.send({ type: "host_set_bid", playerId: p.id, suit: draftSuit()!, amount: v });
                        }
                      }
                    }}
                  >
                    <For each={[1, 2, 3, 4, 5]}>{(n) => <option value={n}>{n}</option>}</For>
                  </select>
                  {existingBid() && (
                    <span style="font-size:0.75rem;color:#40f040;">ready</span>
                  )}
                </div>
              );
            }}
          </For>
        </div>
      </Show>
    </>
  );
}


function BidForm(props: Props) {
  const [suit, setSuit] = createSignal<Suit | null>(null);
  const [amount, setAmount] = createSignal(0);

  const canSubmit = () => suit() !== null && amount() > 0;

  function submit() {
    const s = suit();
    const a = amount();
    if (!s || a === 0) return;
    props.send({ type: "place_bid", suit: s, amount: a });
  }

  return (
    <div class="card">
      <h2>Place Your Bid</h2>
      <div>Suit:</div>
      <div class="suit-btns">
        <For each={SUITS as unknown as Suit[]}>
          {(s) => (
            <button
              classList={{ selected: suit() === s }}
              onClick={() => setSuit(s)}
            >
              {s}
            </button>
          )}
        </For>
      </div>
      <div>Amount:</div>
      <div class="amount-btns">
        <For each={[1, 2, 3, 4, 5]}>
          {(a) => (
            <button
              classList={{ selected: amount() === a }}
              onClick={() => setAmount(a)}
            >
              {a}
            </button>
          )}
        </For>
      </div>
      <button disabled={!canSubmit()} onClick={submit}>
        Submit Bid
      </button>
    </div>
  );
}
