import type { Player, Suit } from "@cdc/shared/messages";
import SuitIcon from "./SuitIcon";
// ── PlayerStatusRow.tsx — Horizontal chip showing avatar, name, bid/drink info with status indicator. ──
// Depends on: @cdc/shared/messages, ./SuitIcon.
// Used by: BiddingView, SettlementView.

interface Props {
  player: Player;
  status: "confirmed" | "pending" | "you";
  /** Primary detail text, shown below the name if provided. */
  detail?: string;
  /** Override the suit icon to show even when the player object doesn't carry a suit. */
  bidSuit?: Suit | null;
  /** Whether this row is currently selected as the bid target (host only). */
  highlighted?: boolean;
}

const STATUS_CONFIG: Record<Props["status"], { label: string; color: string; border: string }> = {
  confirmed: { label: "CONFIRMED", color: "var(--color-tertiary)", border: "var(--color-primary-container)" },
  pending: { label: "BETTING...", color: "var(--color-on-surface-variant)", border: "var(--color-outline-variant)" },
  you: { label: "YOU", color: "var(--color-primary)", border: "var(--color-primary)" },
};

const SUIT_COLOR: Record<Suit, string> = {
  Coins: "var(--color-coins)",
  Cups: "var(--color-cups)",
  Swords: "var(--color-swords)",
  Clubs: "var(--color-clubs)",
};

export default function PlayerStatusRow(props: Props) {
  const st = STATUS_CONFIG[props.status];
  const displaySuit = props.player.suit ?? props.bidSuit ?? null;
  const isHosted = props.player.type === "hosted";

  return (
    <div
      class={`flex items-center gap-3 px-5 py-3 glass rounded-full border-2 transition-all duration-200 ${
        props.highlighted ? "border-glow-active scale-105" : ""
      }`}
      style={{
        "border-color": props.highlighted
          ? "var(--color-primary)"
          : props.status === "you"
            ? st.border
            : "var(--color-outline-variant)",
        "border-width": props.highlighted || props.status === "you" ? "2px" : "1px",
      }}
    >
      {/* Status dot */}
      <div
        class="w-3 h-3 rounded-full shrink-0"
        style={{ background: st.color, "box-shadow": `0 0 6px ${st.color}` }}
      />

      {/* Avatar */}
      <div
        class="w-10 h-10 rounded-full flex items-center justify-center text-label-bold text-sm shrink-0 overflow-hidden"
        style={{
          background: displaySuit
            ? SUIT_COLOR[displaySuit] + "22"
            : "var(--color-surface-container-highest)",
          color: displaySuit ? SUIT_COLOR[displaySuit] : "var(--color-on-surface-variant)",
          "border-color": displaySuit ? SUIT_COLOR[displaySuit] : "var(--color-outline)",
          "border-width": "2px",
          "border-style": "solid",
        }}
      >
        {displaySuit ? <SuitIcon suit={displaySuit} size="sm" /> : props.player.name.charAt(0).toUpperCase()}
      </div>

      {/* Name + detail */}
      <div class="flex flex-col min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="text-body-lg text-[var(--color-on-surface)] truncate font-bold uppercase">
            {props.player.name}
          </span>
          {isHosted && (
            <span class="text-[10px] text-[var(--color-on-surface-variant)] opacity-50 uppercase tracking-wider shrink-0">
              Hosted
            </span>
          )}
        </div>
        {props.detail ? (
          <span
            class="text-label-bold text-sm"
            style={{ color: st.color }}
          >
            {props.status === "confirmed" ? props.detail : "BETTING..."}
          </span>
        ) : (
          <span class="text-label-bold text-sm text-[var(--color-on-surface-variant)] opacity-50">
            {props.status === "you" ? "Pick a suit" : "Waiting..."}
          </span>
        )}
      </div>

      {/* Suit icon for confirmed */}
      {props.status === "confirmed" && displaySuit && (
        <SuitIcon suit={displaySuit} size="sm" filled />
      )}

      {/* Status label */}
      <span
        class="text-label-bold text-xs px-3 py-1 rounded-full whitespace-nowrap"
        style={{ background: st.color + "22", color: st.color }}
      >
        {st.label}
      </span>
    </div>
  );
}
