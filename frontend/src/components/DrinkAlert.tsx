import { Show } from "solid-js";
// ── DrinkAlert.tsx — Full-screen neon pink overlay with display-xl typography + pulse animation. ──
// Depends on: solid-js.
// Used by: RacingView (mid-race drink penalties).

interface Props {
  sips: number;
  visible: boolean;
}

export default function DrinkAlert(props: Props) {
  return (
    <Show when={props.visible}>
      <div class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 animate-pulse-neon"
        style={{ background: "rgba(170, 2, 102, 0.92)" }}>
        <span class="text-display-xl text-[var(--color-secondary)] text-glow-pink">
          TAKE A DRINK!
        </span>
        <span class="text-headline-lg text-[var(--color-on-secondary-container)]">
          {props.sips} SIP{props.sips !== 1 ? "S" : ""}
        </span>
        <p class="text-body-lg text-[var(--color-secondary)] opacity-80">
          Penalty triggered — bottoms up!
        </p>
      </div>
    </Show>
  );
}
