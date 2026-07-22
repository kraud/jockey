import { For } from "solid-js";
import type { Suit } from "@cdc/shared/messages";
import { SUITS } from "@cdc/shared/messages";
import SuitIcon from "./SuitIcon";
// ── SuitGrid.tsx — 2×2 grid of large suit-select buttons with bounce animation on hover. ──
// Depends on: @cdc/shared/messages, ./SuitIcon.
// Used by: BiddingView.

interface Props {
  selectedSuit: Suit | null;
  onSelect: (suit: Suit) => void;
  disabledSuits?: Suit[];
}

export default function SuitGrid(props: Props) {
  const disabled = (s: Suit) => (props.disabledSuits ?? []).includes(s);

  return (
    <div class="grid grid-cols-2 gap-4 max-w-md mx-auto">
      <For each={[...SUITS]}>
        {(suit) => {
          const isSelected = props.selectedSuit === suit;
          const isDisabled = disabled(suit);

          return (
            <button
              type="button"
              class={`glass flex flex-col items-center justify-center gap-2 p-6 rounded-[var(--radius-card)]
                transition-all duration-200 cursor-pointer
                hover:scale-105 hover:border-glow-active
                ${
                  isSelected
                    ? "scale-105 border-glow-active border-[var(--color-primary)]"
                    : isDisabled
                      ? "opacity-40 cursor-not-allowed"
                      : "border-[var(--color-outline-variant)]"
                }`}
              onClick={() => !isDisabled && props.onSelect(suit)}
              disabled={isDisabled}
            >
              <SuitIcon suit={suit} size="lg" filled={isSelected} />
              <span class="text-label-bold text-[var(--color-on-surface)] text-center">
                {suit}
              </span>
            </button>
          );
        }}
      </For>
    </div>
  );
}
