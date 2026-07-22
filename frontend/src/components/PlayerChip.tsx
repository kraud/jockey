import type { Player, Suit } from "@cdc/shared/messages";
// ── PlayerChip.tsx — Circular avatar with suit-color left border ring; shows name + status label. ──
// Depends on: @cdc/shared/messages.
// Used by: LobbyView, BiddingView, SettlementView.

interface Props {
  player: Player;
  highlighted?: boolean;
  status?: string;
  onClick?: () => void;
}

const SUIT_COLOR: Record<Suit, string> = {
  Coins: "var(--color-coins)",
  Cups: "var(--color-cups)",
  Swords: "var(--color-swords)",
  Clubs: "var(--color-clubs)",
};

const SUIT_INITIAL: Record<Suit, string> = {
  Coins: "C",
  Cups: "U",
  Swords: "S",
  Clubs: "L",
};

export default function PlayerChip(props: Props) {
  const borderColor = props.player.suit
    ? SUIT_COLOR[props.player.suit]
    : "var(--color-outline)";

  return (
    <button
      type="button"
      class={`flex items-center gap-3 px-4 py-3 glass rounded-full border-l-4 hover:bg-[var(--color-surface-container-high)] transition-colors cursor-pointer text-left w-full ${
        props.highlighted ? "scale-105 border-glow-active" : ""
      }`}
      style={{ "border-left-color": borderColor }}
      onClick={props.onClick}
      disabled={!props.onClick}
    >
      {/* Avatar circle */}
      <div
        class="w-12 h-12 rounded-full flex items-center justify-center text-label-bold shrink-0"
        style={{
          background: props.player.suit
            ? borderColor + "22"
            : "var(--color-surface-container-highest)",
          color: props.player.suit ? borderColor : "var(--color-on-surface-variant)",
          "border-color": borderColor,
          "border-width": "2px",
          "border-style": "solid",
        }}
      >
        {props.player.suit
          ? SUIT_INITIAL[props.player.suit]
          : props.player.name.charAt(0).toUpperCase()}
      </div>

      {/* Name + status */}
      <div class="flex flex-col min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-body-lg text-[var(--color-on-surface)] truncate">
            {props.player.name}
          </span>
          {props.player.type === "hosted" && (
            <span class="text-[10px] bg-[var(--color-secondary)]/20 text-[var(--color-secondary)] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold shrink-0">
              Hosted
            </span>
          )}
        </div>
        {props.status && (
          <span class="text-label-bold text-sm text-[var(--color-on-surface-variant)] opacity-60">
            {props.status}
          </span>
        )}
      </div>
    </button>
  );
}
