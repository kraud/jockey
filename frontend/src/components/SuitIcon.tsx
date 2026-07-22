import type { Suit } from "@cdc/shared/messages";
// ── SuitIcon.tsx — Oversized Material Symbol icon per suit, mapped to suit color. ──
// Depends on: @cdc/shared/messages.
// Used by: SuitGrid, RacingView, BiddingView, SettlementView.

interface Props {
  suit: Suit;
  size?: "sm" | "md" | "lg";
  filled?: boolean;
}

const SUIT_ICON: Record<Suit, string> = {
  Coins: "monetization_on",
  Cups: "wine_bar",
  Swords: "swords",
  Clubs: "forest",
};

const SUIT_COLOR: Record<Suit, string> = {
  Coins: "var(--color-coins)",
  Cups: "var(--color-cups)",
  Swords: "var(--color-swords)",
  Clubs: "var(--color-clubs)",
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  sm: "text-2xl",
  md: "text-5xl",
  lg: "text-7xl",
};

export default function SuitIcon(props: Props) {
  return (
    <span
      class={`material-symbols-outlined ${SIZE_CLASS[props.size ?? "md"]}`}
      style={{
        color: SUIT_COLOR[props.suit],
        "font-variation-settings": `'FILL' ${props.filled ? 1 : 0}`,
      }}
    >
      {SUIT_ICON[props.suit]}
    </span>
  );
}
