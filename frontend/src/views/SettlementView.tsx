import { For, Show, createMemo, createSignal, onCleanup } from "solid-js";
import type { RoomState } from "../ws/store";
import type { ClientMessage } from "../../../shared/messages";
import AppShell from "../components/AppShell";
import GlassPanel from "../components/GlassPanel";
import PlayerChip from "../components/PlayerChip";
import SuitIcon from "../components/SuitIcon";
import Button from "../components/Button";
import TimerBar from "../components/TimerBar";
// ── frontend/src/views/SettlementView.tsx — SETTLEMENT & DISTRIBUTION phases: race results leaderboard, personal settlement, drink distribution controls ──
// Depends on: solid-js, ../../../shared/messages, ../components/*.
// Used by: RoomView.tsx.


interface Props {
  state: RoomState;
  send: (msg: ClientMessage) => void;
}

function ordinal(n: number): string {
  return n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th";
}

export default function SettlementView(props: Props) {
  const room = () => props.state.room!;
  const me = () => room().players.find((p) => p.id === props.state.playerId);
  const isHost = () => props.state.playerId === room().hostId;
  const phase = () => room().state;

  const placements = createMemo(() =>
    room().horses
      .filter((h) => h.placement > 0)
      .sort((a, b) => a.placement - b.placement),
  );

  const winner = createMemo(() => placements()[0] ?? null);

  const settlement = () => props.state.lastRaceResult?.settlement ?? [];

  const mySettlement = createMemo(() =>
    settlement().find((s) => s.playerId === props.state.playerId),
  );

  // ── DISTRIBUTION countdown timer ──
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 250);
  onCleanup(() => clearInterval(timer));

  const remainingSec = () => {
    const dl = room().distDeadlineMs;
    if (dl === null) return null;
    return Math.ceil(Math.max(0, dl - now()) / 1000);
  };

  const timerPercent = () => {
    const dl = room().distDeadlineMs;
    if (dl === null) return 100;
    const limit = room().distributionTimeLimitMs || 30000;
    const rem = Math.max(0, dl - now());
    return Math.min(100, (rem / limit) * 100);
  };

  const myGive = () => me()?.drinks.give ?? 0;
  const allPlayersDone = () => room().players.every((p) => p.drinks.gaveAll);

  // ── Distribute remaining drinks evenly ──
  function distributeAll() {
    const give = myGive();
    if (give <= 0) return;
    const others = room().players.filter((p) => p.id !== props.state.playerId);
    if (others.length === 0) return;
    const per = Math.floor(give / others.length);
    const rem = give % others.length;
    others.forEach((p, i) => {
      const amt = per + (i < rem ? 1 : 0);
      if (amt > 0) props.send({ type: "assign_drink", to: p.id, amount: amt });
    });
  }

  // ── Shared Leaderboard Panel ──
  const isSettlement = () => phase() === "SETTLEMENT";

  return (
    <AppShell title={isSettlement() ? "Race Results" : "Distribute Drinks"}>
      {/* Timer bar — DISTRIBUTION only */}
      <Show when={!isSettlement() && room().distDeadlineMs !== null}>
        <TimerBar percent={timerPercent()} />
      </Show>

      {/* Hero: winner announcement */}
      <Show when={winner()}>
        <div class="text-center mb-12">
          <h1 class="text-headline-lg text-glow-gold text-[var(--color-primary)]">
            RACE FINISHED! {winner()!.suit} WINS!
          </h1>
        </div>
      </Show>

      {/* ── SETTLEMENT layout ── */}
      <Show when={isSettlement()}>
        <div class="grid grid-cols-12 gap-8">
          {/* Left: Leaderboard — 5 cols */}
          <div class="col-span-5">
            <GlassPanel borderColor="primary">
              <h2 class="text-headline-md text-[var(--color-primary)] mb-6">Final Standings</h2>
              <For each={placements()}>
                {(h) => {
                  const isFirst = h.placement === 1;
                  const isSecond = h.placement === 2;
                  const isThird = h.placement === 3;
                  const isLast = h.placement === 4;
                  const textColor = isFirst
                    ? "text-[var(--color-primary)]"
                    : isSecond
                      ? "text-[var(--color-swords)]"
                      : isThird
                        ? "text-[var(--color-cups)]"
                        : "text-[var(--color-secondary)]";
                  const glowClass = isFirst ? "text-glow-gold" : "";
                  const pulseClass = isLast ? "animate-pulse-neon rounded-[var(--radius-component)]" : "";

                  return (
                    <div class={`flex items-center gap-4 py-3 px-2 ${pulseClass}`}>
                      <div class="w-12 h-12 flex items-center justify-center shrink-0">
                        <Show when={isFirst}>
                          <span class="material-symbols-outlined text-4xl text-[var(--color-primary)]">
                            trophy
                          </span>
                        </Show>
                        <Show when={isSecond}>
                          <span class="material-symbols-outlined text-3xl text-[var(--color-swords)]">
                            social_leaderboard
                          </span>
                        </Show>
                        <Show when={isThird}>
                          <span class="material-symbols-outlined text-3xl text-[var(--color-cups)]">
                            social_leaderboard
                          </span>
                        </Show>
                        <Show when={isLast}>
                          <span class="material-symbols-outlined text-3xl text-[var(--color-secondary)]">
                            sentiment_very_dissatisfied
                          </span>
                        </Show>
                      </div>
                      <SuitIcon suit={h.suit} size="md" />
                      <span class={`flex-1 text-headline-md ${textColor} ${glowClass}`}>
                        {h.suit}
                      </span>
                      <span class={`text-label-bold ${textColor} ${glowClass}`}>
                        {h.placement}{ordinal(h.placement)}
                        {isLast && " LOSER"}
                      </span>
                    </div>
                  );
                }}
              </For>
            </GlassPanel>
          </div>

          {/* Right: Personal result — 7 cols */}
          <div class="col-span-7 flex flex-col gap-8">
            <Show when={mySettlement()}>
              {(ms) => (
                <GlassPanel
                  borderColor={ms().drinksGive > 0 ? "primary" : "secondary"}
                >
                  <Show when={ms().drinksGive > 0}>
                    <div class="text-center">
                      <h2 class="text-headline-lg text-glow-gold text-[var(--color-primary)] mb-4">
                        YOU WON!
                      </h2>
                      <p class="text-display-xl text-[var(--color-primary)]">
                        DISTRIBUTE {ms().drinksGive} DRINK{ms().drinksGive !== 1 ? "S" : ""}
                      </p>
                    </div>
                  </Show>
                  <Show when={ms().drinksConsume > 0}>
                    <div class="text-center">
                      <h2 class="text-headline-lg text-glow-pink text-[var(--color-secondary)] mb-4">
                        BETTER LUCK NEXT TIME
                      </h2>
                      <p class="text-display-xl text-[var(--color-secondary)]">
                        OWE {ms().drinksConsume} DRINK{ms().drinksConsume !== 1 ? "S" : ""}
                      </p>
                    </div>
                  </Show>
                  <Show when={ms().drinksGive === 0 && ms().drinksConsume === 0}>
                    <p class="text-body-lg text-[var(--color-on-surface-variant)] text-center">
                      No drinks to give or take — you broke even!
                    </p>
                  </Show>
                </GlassPanel>
              )}
            </Show>

            {/* Player chips + waiting message */}
            <GlassPanel>
              <h3 class="text-label-bold text-[var(--color-on-surface-variant)] mb-4">
                PLAYERS
              </h3>
              <div class="flex flex-col gap-2">
                <For each={room().players}>
                  {(p) => (
                    <PlayerChip
                      player={p}
                      highlighted={p.id === props.state.playerId}
                      status={
                        p.id === props.state.playerId
                          ? "YOU"
                          : p.drinks.give > 0
                            ? "WINNER"
                            : "WAITING"
                      }
                    />
                  )}
                </For>
              </div>
              <p class="text-label-bold text-[var(--color-on-surface-variant)] opacity-60 mt-4 text-center">
                Wait for winners to assign drinks
              </p>
            </GlassPanel>

            {/* Host: Continue to Distribution */}
            <Show when={isHost()}>
              <Button variant="primary" size="xl" onClick={() => props.send({ type: "host_advance_phase" })}>
                Continue to Distribution
              </Button>
            </Show>
          </div>
        </div>
      </Show>

      {/* ── DISTRIBUTION layout ── */}
      <Show when={!isSettlement()}>
        <div class="grid grid-cols-12 gap-8">
          {/* Left: Leaderboard — 4 cols (persistent) */}
          <div class="col-span-4">
            <GlassPanel borderColor="primary">
              <h2 class="text-headline-md text-[var(--color-primary)] mb-6">Final Standings</h2>
              <For each={placements()}>
                {(h) => {
                  const isFirst = h.placement === 1;
                  const isSecond = h.placement === 2;
                  const isThird = h.placement === 3;
                  const isLast = h.placement === 4;
                  const textColor = isFirst
                    ? "text-[var(--color-primary)]"
                    : isSecond
                      ? "text-[var(--color-swords)]"
                      : isThird
                        ? "text-[var(--color-cups)]"
                        : "text-[var(--color-secondary)]";
                  const glowClass = isFirst ? "text-glow-gold" : "";
                  const pulseClass = isLast ? "animate-pulse-neon rounded-[var(--radius-component)]" : "";

                  return (
                    <div class={`flex items-center gap-3 py-2 px-2 ${pulseClass}`}>
                      <SuitIcon suit={h.suit} size="sm" />
                      <span class={`flex-1 text-body-lg ${textColor} ${glowClass}`}>
                        {h.suit}
                      </span>
                      <span class={`text-label-bold text-sm ${textColor}`}>
                        {h.placement}{ordinal(h.placement)}
                        {isLast && " LOSER"}
                      </span>
                    </div>
                  );
                }}
              </For>
            </GlassPanel>
          </div>

          {/* Right: Distribution controls — 8 cols */}
          <div class="col-span-8 flex flex-col gap-8">
            {/* Countdown badge */}
            <Show when={remainingSec() !== null}>
              <div class="flex items-center gap-3">
                <span class="text-label-bold text-[var(--color-on-surface-variant)]">
                  TIME REMAINING
                </span>
                <span
                  class="text-headline-md text-[var(--color-tertiary)]"
                  classList={{ "animate-pulse-neon": (remainingSec() ?? 999) <= 10 }}
                >
                  {remainingSec()}s
                </span>
              </div>
            </Show>

            {/* My drink pool */}
            <Show when={me()}>
              {(m) => (
                <Show
                  when={m().drinks.give > 0}
                  fallback={
                    <GlassPanel borderColor="outline">
                      <p class="text-body-lg text-[var(--color-on-surface-variant)] text-center">
                        You have 0 drinks to give. Waiting for winners.
                      </p>
                    </GlassPanel>
                  }
                >
                  {/* Win banner */}
                  <GlassPanel borderColor="primary">
                    <div class="text-center">
                      <h2 class="text-headline-lg text-glow-gold text-[var(--color-primary)] mb-4">
                        YOU WON!
                      </h2>
                      <p class="text-display-xl text-[var(--color-primary)]">
                        DISTRIBUTE {m().drinks.give} DRINK{m().drinks.give !== 1 ? "S" : ""}
                      </p>
                    </div>
                  </GlassPanel>

                  {/* Per-player drink assignment rows */}
                  <GlassPanel>
                    <h3 class="text-label-bold text-[var(--color-on-surface-variant)] mb-4">
                      ASSIGN DRINKS
                    </h3>
                    <div class="flex flex-col gap-3">
                      <For each={room().players}>
                        {(p) => {
                          const isMe = p.id === props.state.playerId;
                          const showSelfAssign = !isMe && myGive() > 0;
                          const showClear = !isMe && myGive() > 0 && p.drinks.consume > 0;
                          const showHostProxy =
                            isHost() && p.type === "hosted" && p.drinks.give > 0;

                          return (
                            <div>
                              {/* Player row with controls */}
                              <div class="flex items-center gap-3">
                                <PlayerChip
                                  player={p}
                                  highlighted={isMe}
                                  status={
                                    isMe
                                      ? "YOU"
                                      : p.drinks.gaveAll
                                        ? "DONE"
                                        : p.drinks.give > 0
                                          ? `GIVE: ${p.drinks.give}`
                                          : "WAITING"
                                  }
                                />

                                {/* Self-assign controls */}
                                <Show when={showSelfAssign}>
                                  <div class="flex items-center gap-1 ml-auto">
                                    <Show when={p.drinks.consume > 0}>
                                      <button
                                        type="button"
                                        class="btn-squishy bg-[var(--color-error)] text-[var(--color-on-error)] border-b-[var(--color-on-error)] px-3 py-1 text-label-bold text-sm"
                                        onClick={() =>
                                          props.send({
                                            type: "clear_drink",
                                            fromPlayerId: me()!.id,
                                            toPlayerId: p.id,
                                            amount: 1,
                                          })
                                        }
                                      >
                                        −
                                      </button>
                                    </Show>
                                    <span class="text-label-bold text-[var(--color-on-surface)] min-w-[2rem] text-center">
                                      {p.drinks.consume}
                                    </span>
                                    <button
                                      type="button"
                                      class="btn-squishy bg-[var(--color-tertiary)] text-[var(--color-on-tertiary)] border-b-[var(--color-on-tertiary)] px-3 py-1 text-label-bold text-sm"
                                      onClick={() =>
                                        props.send({
                                          type: "assign_drink",
                                          to: p.id,
                                          amount: 1,
                                        })
                                      }
                                    >
                                      +
                                    </button>
                                    <Show when={myGive() > 1}>
                                      <button
                                        type="button"
                                        class="btn-squishy bg-[var(--color-tertiary)] text-[var(--color-on-tertiary)] border-b-[var(--color-on-tertiary)] px-3 py-1 text-label-bold text-sm"
                                        onClick={() =>
                                          props.send({
                                            type: "assign_drink",
                                            to: p.id,
                                            amount: Math.min(myGive(), 5),
                                          })
                                        }
                                      >
                                        +{Math.min(myGive(), 5)}
                                      </button>
                                    </Show>
                                  </div>
                                </Show>
                              </div>

                              {/* Host proxy controls for hosted players */}
                              <Show when={showHostProxy}>
                                <div class="ml-4 mt-2 pl-4 border-l-4 border-[var(--color-primary)] flex flex-wrap gap-1 items-center">
                                  <span class="text-xs text-[var(--color-on-surface-variant)]">
                                    host proxy:
                                  </span>
                                  <For each={room().players}>
                                    {(target) => (
                                      <Show when={target.id !== p.id}>
                                        <button
                                          type="button"
                                          class="btn-squishy bg-[var(--color-primary)] text-[var(--color-on-primary)] border-b-[var(--color-on-primary-container)] px-2 py-1 text-xs text-label-bold"
                                          onClick={() =>
                                            props.send({
                                              type: "host_assign_drink",
                                              fromPlayerId: p.id,
                                              toPlayerId: target.id,
                                              amount: 1,
                                            })
                                          }
                                        >
                                          +1 →{target.name}
                                        </button>
                                        <Show when={target.drinks.consume > 0}>
                                          <button
                                            type="button"
                                            class="btn-squishy bg-[var(--color-error)] text-[var(--color-on-error)] border-b-[var(--color-on-error)] px-2 py-1 text-xs text-label-bold"
                                            onClick={() =>
                                              props.send({
                                                type: "host_clear_drink",
                                                fromPlayerId: p.id,
                                                toPlayerId: target.id,
                                                amount: 1,
                                              })
                                            }
                                          >
                                            −1 →{target.name}
                                          </button>
                                        </Show>
                                      </Show>
                                    )}
                                  </For>
                                </div>
                              </Show>
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  </GlassPanel>

                  {/* Drinks left counter */}
                  <div class="text-center">
                    <span class="text-label-bold text-[var(--color-on-surface-variant)]">
                      DRINKS LEFT TO GIVE
                    </span>
                    <p class="text-display-xl text-[var(--color-primary)] text-glow-gold">
                      {myGive()}
                    </p>
                  </div>

                  {/* Distribute all button */}
                  <Button
                    variant="secondary"
                    size="xl"
                    disabled={myGive() === 0}
                    onClick={distributeAll}
                  >
                    DISTRIBUTE ALL DRINKS
                  </Button>
                </Show>
              )}
            </Show>

            {/* I'm done toggle */}
            <Show when={me() && me()!.drinks.give === 0 && !me()!.drinks.gaveAll}>
              <Button variant="secondary" onClick={() => props.send({ type: "distribution_done" })}>
                I'm done assigning
              </Button>
            </Show>

            {/* Waiting for host — when done */}
            <Show when={me()?.drinks.gaveAll}>
              <GlassPanel>
                <p class="text-label-bold text-[var(--color-tertiary)] text-center">
                  ✓ Waiting for host to finalize
                </p>
              </GlassPanel>
            </Show>

            {/* Host: Finalize Distribution */}
            <Show when={isHost()}>
              <Button
                variant="primary"
                size="xl"
                disabled={!allPlayersDone()}
                onClick={() => props.send({ type: "host_advance_phase" })}
              >
                Finalize Distribution
              </Button>
              <Show when={!allPlayersDone()}>
                <p class="text-label-bold text-[var(--color-on-surface-variant)] opacity-60 text-center">
                  Waiting for all players to mark done
                </p>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
    </AppShell>
  );
}
