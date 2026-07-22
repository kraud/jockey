import { For, createSignal, Show, onCleanup, onMount } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage, Suit } from "@cdc/shared/messages";
import {
  AppShell,
  TimerBar,
  SuitGrid,
  PlayerStatusRow,
  Button,
  GlassPanel,
} from "../components";
// ── frontend/src/views/BiddingView.tsx — BIDDING phase UI: suit + bid amount selection, timer bar, player status list with click-to-select bid target for host. ──
// Depends on: solid-js, @cdc/shared/messages, ../ws/store, ../components.
// Used by: RoomView.tsx.

interface Props {
  state: RoomState;
  send: (msg: ClientMessage) => void;
}

export default function BiddingView(props: Props) {
  const room = () => props.state.room!;
  const playerId = () => props.state.playerId;
  const isHost = () => playerId() === room().hostId;

  // Which player are we bidding for? null = self (the current user), string = a specific player ID (hosted player).
  const [biddingForId, setBiddingForId] = createSignal<string | null>(null);
  // Has the host explicitly selected a target (self or hosted)? Controls form visibility.
  const [targetSelected, setTargetSelected] = createSignal(false);

  // Local bid form state
  const [suit, setSuit] = createSignal<Suit | null>(null);
  const [amount, setAmount] = createSignal(2); // default 2

  // ── Timer ────────────────────────────────────────────────────────────
  const [remaining, setRemaining] = createSignal(30);

  onMount(() => {
    const interval = setInterval(() => {
      const ms = room().bidDeadlineMs;
      if (ms !== null) {
        setRemaining(Math.max(0, Math.ceil((ms - Date.now()) / 1000)));
      }
    }, 250);
    onCleanup(() => clearInterval(interval));
  });

  // ── Target selection ─────────────────────────────────────────────────
  const selectBidTarget = (id: string | null) => {
    setBiddingForId(id);
    setTargetSelected(true);
    const targetId = id ?? playerId();
    const existingBid = room().bids[targetId];
    if (existingBid) {
      setSuit(existingBid.suit);
      setAmount(existingBid.amount);
    } else {
      setSuit(null);
      setAmount(2);
    }
  };

  // Non-host players immediately select themselves so the form is active.
  onMount(() => {
    if (!isHost()) {
      selectBidTarget(null);
    }
  });

  const title = () => {
    const id = biddingForId();
    const tp = id !== null ? room().players.find((p) => p.id === id) ?? null : null;
    return tp ? `${tp.name.toUpperCase()}'S BID` : "YOUR BID";
  };

  // ── Disabled suits ───────────────────────────────────────────────────
  const disabledSuits = (): Suit[] => {
    const bids = room().bids;
    const currentFor = biddingForId();
    const disabled: Suit[] = [];
    for (const bid of Object.values(bids)) {
      if (bid.playerId !== currentFor) {
        disabled.push(bid.suit);
      }
    }
    return disabled;
  };

  // ── Confirm ──────────────────────────────────────────────────────────
  const canConfirm = () => suit() !== null && amount() >= 1 && targetSelected();

  const confirm = () => {
    const s = suit();
    const a = amount();
    if (!s || a < 1) return;
    const targetId = biddingForId();
    if (targetId !== null) {
      props.send({ type: "host_place_bid", playerId: targetId, suit: s, amount: a });
    } else {
      props.send({ type: "place_bid", suit: s, amount: a });
    }
  };

  // ── Player status helpers ────────────────────────────────────────────
  const getPlayerStatus = (p: { id: string }): "confirmed" | "pending" | "you" => {
    if (room().bids[p.id]) return "confirmed";
    if (p.id === playerId()) return "you";
    return "pending";
  };

  const getPlayerDetail = (p: { id: string }): string | undefined => {
    const bid = room().bids[p.id];
    if (!bid) return undefined;
    return `${bid.suit} ${bid.amount}`;
  };

  // All players count vs confirmed count
  const confirmedCount = () =>
    room().players.filter((p) => room().bids[p.id]).length;

  // Whether the form (suit grid + slider) is visible
  const formVisible = () => targetSelected() || !isHost();

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <AppShell title="BIDDING PHASE">
      <TimerBar percent={(remaining() / 30) * 100} />
      <div class="flex flex-col gap-[var(--space-stack-lg)] items-center">
        {/* Title & subtitle */}
        <div class="text-center">
          <h1 class="text-display-xl text-glow-gold">{title()}</h1>
          <p class="text-body-lg text-[var(--color-secondary)] mt-2">
            Select your suit and wager drinks
          </p>
        </div>

        {/* SuitGrid — visible once a target is selected (or for non-host players immediately) */}
        <Show when={formVisible()}>
          <div class="max-w-md mx-auto w-full">
            <SuitGrid
              selectedSuit={suit()}
              onSelect={setSuit}
              disabledSuits={disabledSuits()}
            />
          </div>
        </Show>

        {/* Bid slider + Confirm (after suit selected) */}
        <Show when={suit() !== null && formVisible()}>
          <GlassPanel class="w-full max-w-lg">
            <div class="flex flex-col items-center gap-6">
              <h3 class="text-label-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest">
                Wager for{" "}
                {biddingForId() !== null
                  ? room().players.find((p) => p.id === biddingForId())?.name ?? "player"
                  : "yourself"}
              </h3>

              {/* Drink amount display */}
              <div class="text-display-xl text-glow-gold tabular-nums leading-none">
                {amount()}
              </div>
              <span class="text-label-bold text-[var(--color-on-surface)] -mt-4">
                drink{amount() !== 1 ? "s" : ""}
              </span>

              {/* Range slider (1-6) */}
              <div class="w-full max-w-sm flex flex-col gap-3">
                <div class="flex justify-between text-label-bold text-sm">
                  <span class="text-[var(--color-on-surface-variant)]">Drinks</span>
                  <span class="text-[var(--color-on-surface-variant)]">{amount()} / 6</span>
                </div>
                <div class="relative h-4 bg-[var(--color-surface-container-low)] rounded-full">
                  <input
                    type="range"
                    min="1"
                    max="6"
                    value={amount()}
                    onInput={(e) => setAmount(parseInt(e.currentTarget.value, 10))}
                    class="absolute w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div
                    class="h-full bg-[var(--color-primary)] rounded-full transition-all"
                    style={{ width: `${((amount() - 1) / 5) * 100}%` }}
                  />
                </div>
                <div class="flex justify-between text-label-bold text-xs text-[var(--color-on-surface-variant)] px-1">
                  <span>1</span>
                  <span>2</span>
                  <span>3</span>
                  <span>4</span>
                  <span>5</span>
                  <span>6</span>
                </div>
              </div>

              <Button
                variant="primary"
                size="lg"
                class="w-full max-w-sm"
                disabled={!canConfirm()}
                onClick={confirm}
              >
                CONFIRM BID
              </Button>
            </div>
          </GlassPanel>
        </Show>

        {/* Player Status Section — serves as selection UI for hosts, status display for everyone */}
        <section class="w-full max-w-4xl">
          <div class="flex items-center justify-between mb-6">
            <h4 class="text-label-bold uppercase tracking-widest text-[var(--color-on-surface-variant)]">
              Player Status
            </h4>
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 bg-[var(--color-primary)] rounded-full animate-pulse" />
              <span class="text-label-bold text-sm text-[var(--color-on-surface-variant)]">
                {confirmedCount()} PLAYER{confirmedCount() !== 1 ? "S" : ""} BETTING
              </span>
            </div>
          </div>
          <div class="flex flex-wrap gap-4 justify-center">
            <For each={room().players}>
              {(p) => {
                const isHostPlayer = () => p.id === room().hostId;
                const isSelectedTarget = () =>
                  isHost() && targetSelected() &&
                  biddingForId() === (isHostPlayer() ? null : p.id);

                const handleClick = isHost()
                  ? () => selectBidTarget(isHostPlayer() ? null : p.id)
                  : undefined;

                return (
                  <div
                    class={isHost() ? "cursor-pointer transition-transform duration-200 hover:scale-105" : ""}
                    classList={{ "scale-105": isSelectedTarget() }}
                    onClick={handleClick}
                  >
                    <PlayerStatusRow
                      player={p}
                      status={getPlayerStatus(p)}
                      detail={getPlayerDetail(p)}
                      bidSuit={room().bids[p.id]?.suit ?? null}
                      highlighted={isSelectedTarget()}
                    />
                  </div>
                );
              }}
            </For>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
