import type { JSXElement } from "solid-js";
// ── GlassPanel.tsx — Glassmorphism card container with configurable border color. ──
// Depends on: solid-js.
// Used by: all view components.

interface Props {
  class?: string;
  children: JSXElement;
  borderColor?: "primary" | "secondary" | "outline";
}

const BORDER_CLASS: Record<NonNullable<Props["borderColor"]>, string> = {
  primary: "border-[var(--color-primary)]",
  secondary: "border-[var(--color-secondary)]",
  outline: "border-[var(--color-outline-variant)]",
};

export default function GlassPanel(props: Props) {
  const border = BORDER_CLASS[props.borderColor ?? "outline"];
  return (
    <div
      class={`glass p-[var(--space-card-padding)] ${border} ${props.class ?? ""}`}
    >
      {props.children}
    </div>
  );
}
