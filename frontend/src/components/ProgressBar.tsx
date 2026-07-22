// ── ProgressBar.tsx — 32px thick rounded pill bar with inner "trench" shadow; fills left-to-right. ──
// Depends on: (none).
// Used by: ReadyView.

interface Props {
  value: number;
  max: number;
  color?: "primary" | "secondary" | "tertiary";
}

const COLOR_CSS: Record<NonNullable<Props["color"]>, string> = {
  primary: "var(--color-primary)",
  secondary: "var(--color-secondary)",
  tertiary: "var(--color-tertiary)",
};

export default function ProgressBar(props: Props) {
  const fillColor = COLOR_CSS[props.color ?? "primary"];
  const pct = Math.min(100, Math.max(0, (props.value / props.max) * 100));

  return (
    <div
      class="w-full rounded-full overflow-hidden"
      style={{
        height: "var(--progress-thickness)",
        background: "var(--color-surface-container-highest)",
        // Inner "trench" shadow — recessed track effect
        "box-shadow": "inset 0 2px 8px rgba(0,0,0,0.5), inset 0 1px 2px rgba(0,0,0,0.3)",
      }}
    >
      <div
        class="h-full rounded-full transition-all duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${fillColor}88, ${fillColor})`,
          "box-shadow": `0 0 12px ${fillColor}44`,
        }}
      />
    </div>
  );
}
