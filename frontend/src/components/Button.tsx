import type { JSXElement } from "solid-js";
// ── Button.tsx — Squishy arcade button with 4px bottom-border 3D effect. Primary min 80px height. ──
// Depends on: solid-js.
// Used by: all views.

interface Props {
  variant?: "primary" | "secondary" | "danger";
  size?: "lg" | "xl";
  disabled?: boolean;
  onClick?: () => void;
  children: JSXElement;
  class?: string;
}

const VARIANT_CLASS: Record<NonNullable<Props["variant"]>, string> = {
  primary:
    "bg-[var(--color-primary)] text-[var(--color-on-primary)] border-b-[var(--color-on-primary-container)]",
  secondary:
    "bg-[var(--color-secondary)] text-[var(--color-on-secondary)] border-b-[var(--color-on-secondary)]",
  danger:
    "bg-[var(--color-error)] text-[var(--color-on-error)] border-b-[var(--color-on-error)]",
};

const SIZE_CLASS: Record<NonNullable<Props["size"]>, string> = {
  lg: "min-h-[80px] px-8 text-headline-md",
  xl: "min-h-[128px] px-12 text-headline-lg",
};

export default function Button(props: Props) {
  return (
    <button
      type="button"
      class={`btn-squishy ${VARIANT_CLASS[props.variant ?? "primary"]} ${SIZE_CLASS[props.size ?? "lg"]} ${
        props.disabled ? "opacity-40 cursor-not-allowed" : ""
      } ${props.class ?? ""}`}
      disabled={props.disabled}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}
