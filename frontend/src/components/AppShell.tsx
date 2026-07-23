import type { JSXElement } from "solid-js";
// ── AppShell.tsx — Sticky top bar ("Derby & Drafts" logo) + <main> content area + mobile-only bottom nav. ──
// Depends on: solid-js.
// Used by: all view components.

interface Props {
  title: string;
  children: JSXElement;
}

export default function AppShell(props: Props) {
  return (
    <div class="min-h-screen flex flex-col">
      {/* Top Bar — sticky, glass surface */}
      <header class="sticky top-0 z-50 glass rounded-none border-x-0 border-t-0 border-b-2 border-[var(--glass-border)] px-8 py-4 flex items-center justify-between">
        <div class="flex items-center gap-4">
          {/* Logo */}
          <span class="material-symbols-outlined text-[var(--color-primary)] text-4xl">
            sports_bar
          </span>
          <span class="text-label-bold text-[var(--color-primary)] tracking-wider uppercase">
            Derby & Drafts
          </span>
        </div>
        <span class="text-label-bold text-[var(--color-on-surface-variant)] text-sm opacity-60">
          {props.title}
        </span>
      </header>

      {/* Main Content */}
      <main class="flex-1 py-8 max-w-[1440px] mx-auto min-w-full justify-items-center" style={{ "padding-left": "var(--space-container-margin)", "padding-right": "var(--space-container-margin)" }}>
        {props.children}
      </main>

      {/* Mobile Bottom Nav — hidden on desktop */}
      <nav class="lg:hidden fixed bottom-0 left-0 right-0 glass rounded-none border-x-0 border-b-0 border-t-2 border-[var(--glass-border)] px-6 py-3 flex justify-around items-center">
        <span class="material-symbols-outlined text-[var(--color-primary)]">home</span>
        <span class="material-symbols-outlined text-[var(--color-on-surface)] opacity-40">sports_esports</span>
        <span class="material-symbols-outlined text-[var(--color-on-surface)] opacity-40">groups</span>
      </nav>
    </div>
  );
}
