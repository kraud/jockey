// ── TimerBar.tsx — Fixed full-width 4px neon pink countdown bar with glow, driven by percent. ──
// Depends on: (none).
// Used by: BiddingView.

interface Props {
  /** 0..100 — percentage remaining */
  percent: number;
}

export default function TimerBar(props: Props) {
  const pct = Math.min(100, Math.max(0, props.percent));
  return (
    <div
      class="fixed top-[72px] left-0 right-0 h-1 z-40"
      style={{ background: "rgba(255, 180, 171, 0.2)" }}
    >
      <div
        class="h-full transition-all duration-300 ease-linear"
        style={{
          width: `${pct}%`,
          background: "var(--color-error)",
          "box-shadow": "0 0 12px rgba(255, 180, 171, 0.8), 0 0 4px rgba(255, 180, 171, 0.6)",
        }}
      />
    </div>
  );
}
