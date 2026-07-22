import { createSignal, onCleanup, Show } from "solid-js";
import type { RoomState } from "../ws/store";
import AppShell from "../components/AppShell";
// ── frontend/src/views/CountdownView.tsx — COUNTDOWN phase UI: 3-2-1-GO! centered gold display. ──
// Depends on: solid-js, ../components/AppShell.
// Used by: RoomView.tsx.


interface Props {
  state: RoomState;
}

export default function CountdownView(props: Props) {
  const room = () => props.state.room!;
  const [now, setNow] = createSignal(Date.now());

  const interval = setInterval(() => setNow(Date.now()), 100);
  onCleanup(() => clearInterval(interval));

  const countdownMs = () => room().countdownMs;

  const display = () => {
    const target = countdownMs();
    if (target === null) return "";
    const r = target - now();
    if (r > 2000) return "3";
    if (r > 1000) return "2";
    if (r > 0) return "1";
    return "GO!";
  };

  return (
    <AppShell title="Get Ready!">
      <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Show when={display() === "GO!"} fallback={
          <div class="text-display-xl text-[var(--color-primary)] text-glow-gold text-[12rem] leading-none">
            {display()}
          </div>
        }>
          <div class="text-headline-lg text-[var(--color-primary)] animate-pulse-gold">
            GO!
          </div>
        </Show>
      </div>
    </AppShell>
  );
}
