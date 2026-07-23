import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import AppShell from "../components/AppShell";
import GlassPanel from "../components/GlassPanel";
import Button from "../components/Button";
// ── HomeView.tsx — Landing page: hero "DERBY & DRAFTS", name input, HOST/JOIN cards with room code. ──
// Depends on: @solidjs/router, solid-js, ../components/*.
// Used by: App.tsx.

const ROOM_CODE_RE = /^[A-Z0-9]{4,6}$/;

export default function HomeView() {
  const navigate = useNavigate();
  const [error, setError] = createSignal("");
  const [playerName, setPlayerName] = createSignal(
    sessionStorage.getItem("cdc:name") ?? ""
  );
  const [joinCode, setJoinCode] = createSignal("");

  /** Generate a random casino-chip name for quick onboarding. */
  function randomName(): string {
    const adj = ["Lucky", "Wild", "Bold", "Fast", "Royal", "Neon", "Rogue", "Storm"];
    const noun = ["Jockey", "Bluff", "Sprint", "Gamble", "Derby", "Turf", "Copper", "Flask"];
    return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}`;
  }

  const nameValid = () => playerName().trim().length > 0;

  async function handleCreate() {
    const name = playerName().trim();
    if (!name) { setError("Enter your name"); return; }
    setError("");
    try {
      const res = await fetch("/api/room", { method: "POST" });
      if (!res.ok) throw new Error("Failed to create room");
      const { roomCode } = await res.json();
      sessionStorage.setItem("cdc:name", name);
      navigate(`/room/${roomCode}?name=${encodeURIComponent(name)}`);
    } catch {
      setError("Network error");
    }
  }

  async function handleJoin() {
    const code = joinCode().trim().toUpperCase();
    const name = playerName().trim();
    if (!name) { setError("Enter your name"); return; }
    if (!ROOM_CODE_RE.test(code)) { setError("Room code must be 4–6 letters/numbers"); return; }
    setError("");
    try {
      const res = await fetch(`/api/room/${code}/state`);
      if (!res.ok) {
        setError("Room not found");
        return;
      }
      sessionStorage.setItem("cdc:name", name);
      navigate(`/room/${code}?name=${encodeURIComponent(name)}`);
    } catch {
      setError("Network error");
    }
  }

  return (
    <AppShell title="Home">
      <div class="flex flex-col items-center justify-center py-12 gap-[var(--space-stack-lg)] max-w-7xl mx-auto w-full">
        {/* ── Hero Section ── */}
        <section class="text-center space-y-4">
          <h1 class="text-display-xl text-[var(--color-primary)] leading-none">
            DERBY DAY SUIT
          </h1>
        </section>

        {/* ── Player Identification ── */}
        <section class="w-full max-w-2xl flex gap-4 justify-center ">
          <GlassPanel borderColor="primary" class="flex flex-col items-center gap-3">
            <label
              for="player-name"
              class="text-label-bold text-[var(--color-primary)] uppercase tracking-widest"
            >
              Enter Your Name
            </label>
            <div class="flex gap-4 w-full items-center">
              <input
                type="text"
                id="player-name"
                class="flex-1 bg-[var(--color-surface-container-low)] border-b-2 border-[var(--color-primary)] text-center text-headline-md text-[var(--color-on-surface)] focus:outline-none focus:border-[var(--color-secondary)] transition-colors p-1 rounded-2xl"
                placeholder="E.G. CHAMPION_CHUG"
                value={playerName()}
                onInput={(e) => {
                  setPlayerName(e.currentTarget.value);
                  setError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && nameValid() && handleCreate()}
              />
            </div>
          </GlassPanel>
          <button
            type="button"
            class="bg-[var(--color-primary)] text-[var(--color-on-primary)] p-8 rounded-[var(--radius-component)] hover:scale-105 active:scale-95 transition-all flex items-center justify-center shadow-lg max-h-max self-center"
            title="Auto-generate Name"
            onClick={() => setPlayerName(randomName())}
          >
            <span class="material-symbols-outlined text-3xl">casino</span>
          </button>
        </section>

        {/* ── Primary Actions Grid ── */}
        <section class="grid grid-cols-1 md:grid-cols-2 gap-[var(--space-gutter)] w-full max-w-4xl">
          {/* ── HOST Card ── */}
          <GlassPanel borderColor="primary" class="flex flex-col items-center gap-6 text-center group hover:scale-[1.02] transition-all duration-300">
            <div class="bg-[var(--color-primary)]/20 w-32 h-32 rounded-full flex items-center justify-center group-hover:bg-[var(--color-primary)] transition-colors">
              <span class="material-symbols-outlined text-7xl text-[var(--color-primary)] group-hover:text-[var(--color-on-primary)]" style="font-variation-settings: 'FILL' 1;">
                stadium
              </span>
            </div>
            <div>
              <h2 class="text-headline-md text-[var(--color-primary)] mb-2">HOST A RACE</h2>
              <p class="text-body-lg text-[var(--color-on-surface-variant)]">
                Create a new room and control the track.
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              class="w-full"
              disabled={!nameValid()}
              onClick={handleCreate}
            >
              Start Room
            </Button>
          </GlassPanel>

          {/* ── JOIN Card ── */}
          <GlassPanel borderColor="secondary" class="flex flex-col items-center gap-6 text-center group hover:scale-[1.02] transition-all duration-300">
            <div class="bg-[var(--color-secondary)]/20 w-32 h-32 rounded-full flex items-center justify-center group-hover:bg-[var(--color-secondary)] transition-colors">
              <span class="material-symbols-outlined text-7xl text-[var(--color-secondary)] group-hover:text-[var(--color-on-secondary)]" style="font-variation-settings: 'FILL' 1;">
                confirmation_number
              </span>
            </div>
            <div class="w-full">
              <h2 class="text-headline-md text-[var(--color-secondary)] mb-2">JOIN A RACE</h2>
              <p class="text-body-lg text-[var(--color-on-surface-variant)] mb-6">
                Enter the 5-character room code.
              </p>
              <div class="flex gap-4 items-center justify-center">
                <input
                  type="text"
                  class="flex-1 bg-[var(--color-surface-container-high)] border-2 border-[var(--color-secondary)]/40 text-center text-headline-md text-[var(--color-on-surface)] focus:outline-none focus:border-[var(--color-secondary)] transition-all p-4 rounded-[var(--radius-component)] uppercase w-full py-6"
                  maxlength={5}
                  placeholder="CODE"
                  value={joinCode()}
                  onInput={(e) => {
                    setJoinCode(e.currentTarget.value.toUpperCase());
                    setError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && nameValid() && handleJoin()}
                />
                <button
                  type="button"
                  class="bg-[var(--color-secondary)] text-[var(--color-on-secondary)] h-full aspect-square flex items-center justify-center rounded-[var(--radius-component)] hover:scale-105 active:scale-95 transition-all disabled:opacity-40"
                  disabled={!nameValid()}
                  onClick={handleJoin}
                >
                  <span class="material-symbols-outlined text-4xl">arrow_forward</span>
                </button>
              </div>
            </div>
          </GlassPanel>
        </section>

        {/* ── Error ── */}
        <Show when={error()}>
          <p class="text-[var(--color-error)] text-label-bold">{error()}</p>
        </Show>
      </div>
    </AppShell>
  );
}
