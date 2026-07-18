# Sketch-to-Code Transition Plan

> Generated 2026-07-19 from `frontend/ui-sketch/` mockups.
> Maps the "Derby & Drafts" design system mockups to the current SolidJS frontend.

---

## Mockup → Existing View Mapping

| # | Mockup Directory | Existing View | Game Phase | What It Shows |
|---|---|---|---|---|
| 1 | `home_derby_drafts/` | `HomeView.tsx` | *(pre-room landing)* | Hero "DERBY & DRAFTS", name input, HOST/JOIN cards with room code |
| 2 | `host_bidding_derby_drafts/` | `BiddingView.tsx` | `BIDDING` | Host's suit-selection grid, bid slider (1–6 drinks), player status chips, 30s pink timer bar |
| 3 | `lobby_derby_drafts/` | `LobbyView.tsx` | `LOBBY` | 3-col grid: host controls (track length, lock toggle, Start Race), QR code + room code, player list chips |
| 4 | `race_track_derby_drafts_grid/` | `RacingView.tsx` | `RACING` | Grid track with 4 suit rows, horse position markers, draw pile + last drawn card, race status panel |
| 5 | `ready_phase_derby_drafts/` | `DoneView.tsx` → `ReadyView.tsx` | `READY` | Drink penalty header ("YOU MUST DRINK: 8 SIPS"), player bento cards with progress bars, "I HAVE FINISHED DRINKING" button |
| 6 | `settlement_derby_drafts/` | `ResultsView.tsx` | `SETTLEMENT` | "RACE FINISHED! CUPS WINS!" hero, leaderboard (1st–4th), personal penalty card, distribution-awareness panel |
| 7 | `settlement_winner_distribution_derby_drafts/` | `DistributionView.tsx` | `DISTRIBUTION` | Winner's view: final standings sidebar, per-player +/- drink controls, "DISTRIBUTE ALL DRINKS" button |

### Coverage gap

`CountdownView.tsx` (3-2-1-GO! ticker) has no mockup. Lift its typography to match the design system but no structural change.

### Host bidding clarification

The `host_bidding_derby_drafts/` mockup is an example — not a separate host-only view. The title reads:
- `"YOUR BID"` when the host or an independent player bids for themselves
- `"{PLAYER_NAME}'S BID"` when the host bids on behalf of a hosted player

---

## Design System Summary (from `derby_drafts/DESIGN.md`)

- **Palette:** Midnight Navy (`#0B1326`) base, Energetic Gold primary (`#FFC174`), Neon Pink secondary (`#FFB0CD`), per-suit colors
- **Surfaces:** Glassmorphism — `rgba(30,41,59,0.7)` + `backdrop-filter: blur(20px)`, 2px solid/glow borders
- **Typography:** Inter 900 for display/headlines (uppercase, tight tracking, "10-foot UI"), Space Grotesk for labels
- **Shapes:** 0.5rem component radius, 1.5rem card radius, 4px bottom-border "squishy" arcade buttons, 32px-thick rounded-pill progress bars
- **Layout:** 12-col grid for desktop/TV (64px outer margins for overscan), 4-col fluid for mobile, all spacing multiples of 8px

---

## Decision: Tailwind CSS + SolidJS

**Tailwind CSS v4 works with SolidJS + Vite.** Add `tailwindcss` + `@tailwindcss/vite` as dev dependencies. The `@tailwindcss/vite` plugin integrates directly into the Vite pipeline — no PostCSS config needed.

**No generic UI component library.** The design system is custom enough (glassmorphism, neon glows, squishy buttons, 10-foot-UI typography) that a library like Radix or Kobalte would fight the aesthetic. We build a thin shared component layer (~12 components) atop Tailwind utilities and DESIGN.md tokens.

### New dependencies

```
tailwindcss @tailwindcss/vite
```

Inter + Space Grotesk switch from CDN to `@import` in CSS. Material Symbols stays as a CDN `<link>`.

---

## Component Architecture

### Directory Layout

```
frontend/src/
├── components/              # shared UI primitives
│   ├── AppShell.tsx         # top bar + bottom nav wrapper
│   ├── GlassPanel.tsx       # glassmorphism card container
│   ├── PlayerChip.tsx       # circular avatar + suit-color ring
│   ├── SuitIcon.tsx         # oversized material icon per suit
│   ├── SuitGrid.tsx         # 2×2 grid of suit-select buttons
│   ├── ProgressBar.tsx      # 32px rounded pill bar
│   ├── TimerBar.tsx         # neon pink countdown bar (fixed, full-width)
│   ├── DrinkAlert.tsx       # full-screen pink overlay ("TAKE A DRINK!")
│   ├── Button.tsx           # primary/secondary squishy button
│   ├── PlayerStatusRow.tsx  # player row with bid/drink status chips
│   └── index.ts             # barrel export
├── views/
│   ├── HomeView.tsx         # (rewrite)
│   ├── LobbyView.tsx        # (rewrite)
│   ├── BiddingView.tsx      # (rewrite — unified host + independent)
│   ├── CountdownView.tsx    # (minor style lift)
│   ├── RacingView.tsx       # (rewrite — grid track)
│   ├── SettlementView.tsx   # (NEW — merges ResultsView + DistributionView)
│   ├── ReadyView.tsx        # (rewrite — was DoneView)
│   └── RoomView.tsx         # (update phase routing)
├── styles/
│   ├── design-tokens.css    # CSS custom properties from DESIGN.md
│   └── global.css           # Tailwind directives + base resets
└── (App.tsx, main.tsx, ws/ — unchanged)
```

### Shared Component Specs

| Component | Props | Notes |
|---|---|---|
| `AppShell` | `title: string`, `children: JSXElement` | Sticky top bar ("Derby & Drafts" logo), `<main>` content area, mobile-only bottom nav. Used as the outer wrapper by every view. |
| `GlassPanel` | `class?: string`, `children`, `borderColor?: "primary" \| "secondary" \| "outline"` | `rgba(30,41,59,0.7)` + `backdrop-blur-xl` + 2px border. Accepts `class` to extend. |
| `PlayerChip` | `player`, `highlighted?: boolean`, `onClick?` | Avatar + name + status label. Colored left border matches player's suit (or outline if no suit selected). |
| `SuitIcon` | `suit`, `size?: "sm" \| "md" \| "lg"`, `filled?: boolean` | Maps suit → material icon name (`monetization_on`, `wine_bar`, `swords`, `forest`) + suit color. |
| `SuitGrid` | `selectedSuit`, `onSelect`, `disabledSuits?` | 2×2 grid of large suit buttons with bounce animation on hover. Shared by host and independent bidding. |
| `ProgressBar` | `value: number`, `max: number`, `color: "primary" \| "secondary" \| "tertiary"` | 32px thick rounded pill with inner shadow "trench." Used in ReadyView for drink progress. |
| `TimerBar` | `percent: number` | Fixed full-width 4px bar below top app bar. Neon pink (`#FFB4AB`) glow via `box-shadow`. Used in BiddingView. |
| `DrinkAlert` | `sips: number`, `visible: boolean` | Full-screen neon pink overlay with `display-xl` typography + pulse animation. Triggered on drink penalties. |
| `Button` | `variant: "primary" \| "secondary" \| "danger"`, `size: "lg" \| "xl"`, `disabled?`, `onClick`, `children` | Squishy arcade button with 4px bottom border 3D effect (disappears on `:active`). Primary variant min 80px height. |
| `PlayerStatusRow` | `player`, `status: "confirmed" \| "pending" \| "you"`, `detail?: string` | Horizontal chip showing avatar, name, bid/drink info. Used in BiddingView player list and SettlementView distribution rows. |

---

## View Rewrites

### HomeView

**New layout:** Hero section → glass-panel name input → 2-column host/join cards.

- `display-xl` gold "DERBY & DRAFTS" title with `drop-shadow` glow
- Tagline: "The social racing game where *every draw is a drink.*" in secondary pink italic
- Name input: glass panel with "Enter Your Name" label, casino-chip randomizer button
- Host card: stadium icon, "HOST A RACE", "Start Room" button — disabled until name entered
- Join card: ticket icon, "JOIN A RACE", 5-char room code input + arrow button

**State:** Same as current — `mode: "name" | "room"`, `playerName`, `createRoomName`, `joinRoomName`.

### LobbyView

**New layout:** 12-column grid — 3/6/3 split.

- **Left (3 col):** Host Controls `GlassPanel` — track length slider (Sprint ↔ Marathon), lock room toggle, massive "START RACE" button (neon pink, pulse animation)
- **Center (6 col):** Room code in `display-xl` gold with neon text glow + QR code in glass panel + "Scan to join or visit derbydrafts.game"
- **Right (3 col):** Player list — `PlayerChip` components with suit-color left borders, host star icon, ready/choosing status, empty "Invite More" slot

**State:** Unchanged — reads `RoomState`.

### BiddingView (Unified Host + Independent)

**One component for both host and independent players.** Conditional rendering drives the differences.

**Internal state:** `biddingForId: Signal<string | null>` — `null` = self, string = hosted player ID.

**Layout:**
- Dynamic title: `"YOUR BID"` (self) or `"{NAME}'S BID"` (hosted player)
- Subtitle: "Select your suit and wager drinks" in secondary pink
- `TimerBar` — full-width neon pink, counts down from 30s
- `SuitGrid` — 2×2 suit buttons. Inactive suits show `opacity-40`. Selected suit gets `neon-border-active` glow + `scale-105`.
- Bid slider (1–6 drinks) — appears after suit selection
- Submit button
- Player status section: `PlayerStatusRow` for each player
  - Confirmed: green check, suit icon, bid amount
  - Pending: grayscale, "BETTING..." label
  - You: gold border, "YOU" badge

**Host-only:** Row of hosted-player chips above the suit grid. Clicking a chip sets `biddingForId` and switches the title + bindings. The host's own bid chip is always present. All submissions go through the same `place_bid` message with the appropriate `playerId`.

**Independent-player-only:** No hosted-player chip row. Title always "YOUR BID." `biddingForId` is always the player's own ID.

### RacingView

**New layout:** Header row + CSS grid track.

- **Header row:** Draw pile (card-back with "N LEFT" badge) + last drawn card (glass panel, suit icon, "7 of Swords") + race update status panel ("Swords leads! Cups is closing in fast...")
- **Track grid:** `grid-template-columns: 80px 100px repeat(N, 1fr) 100px` where N = `trackLength`
  - Row 0 (header): empty / "Start" / track-cards 1..N (face-down lock icon or flipped suit icon) / "End"
  - Rows 1–4 (Coins, Cups, Swords, Clubs): 2-letter suit label / horse marker at position column / empty cells
  - Finished horse gets gold `#1`/`#2`/`#3` badge
  - Active horse gets neon glow border
- **Floating action button:** "FLIP NEXT" centered at bottom, glass panel border

**Data sources unchanged:** `room().horses`, `room().trackCards`, `room().trackLength`, `room().raceLog`.

### CountdownView

Typography lift only. Replace card-based layout with centered `display-xl` numbers ("3", "2", "1", "GO!") using gold `text-shadow` glow. Logic unchanged — polls `room().countdownMs` at 100ms.

### SettlementView (NEW — merges ResultsView + DistributionView)

Replaces `ResultsView.tsx` and `DistributionView.tsx`. Single component with two internal sub-views driven by `room().state` and player role.

#### Sub-view A: SETTLEMENT (results)

- **Hero:** "RACE FINISHED! {WINNER} WINS!" in `headline-lg` gold
- **Bento grid (5/7 split):**
  - Left (5 col): Leaderboard — 1st (gold glow, trophy), 2nd (silver), 3rd (bronze), 4th (pink "LOSER" with `neon-pulse`)
  - Right (7 col): Personal result card
    - Winner: "YOU WON! DISTRIBUTE {n} DRINKS" (gold banner)
    - Loser: "OWE {n} DRINKS" (pink banner, `text-glow-pink`)
  - Bottom-right: Distribution prelude — player chip grid + "Wait for winners to assign drinks" status
- Host sees "Continue to Distribution" button

#### Sub-view B: DISTRIBUTION (drink assignment)

- **Left sidebar (4 col):** Final standings (persistent from settlement, same leaderboard component)
- **Right panel (8 col):**
  - Win banner: "RACE FINISHED! {WINNER} WINS!" + "YOU WON! DISTRIBUTE {n} DRINKS" callout
  - **Winner sees:** Per-player rows with `-` / count / `+` drink controls, "Drinks Left to Give" counter (`display-xl`), "DISTRIBUTE ALL DRINKS" button (disabled until pool emptied)
  - **Loser sees:** "You have 0 drinks to give. Waiting for winners." status with info icon
  - "I'm done" toggle button
  - Host finalize action

#### Phase Routing

```tsx
// RoomView.tsx
case "SETTLEMENT":
case "DISTRIBUTION":
  return <SettlementView state={state} send={sendFn} />;
```

The state machine's `SETTLEMENT → DISTRIBUTION` transition is seamless — the leaderboard stays, the right panel updates. No flashing or remount.

### ReadyView (was DoneView)

Renamed from `DoneView` to `ReadyView` to match the phase name and mockup terminology.

**New layout:**
- "YOU MUST DRINK: {n} SIPS" header in `display-xl` gold with `drink-alert-glow` pulse
- Bento grid (2×2 or 4-col) of player cards:
  - Avatar + name + `ProgressBar` (sips consumed / total)
  - Status: "FINISHED" in gold (full bar) or "DRINKING (4/8)" in pink (partial bar)
  - Active drinker gets `animate-pulse-neon` border
- Giant "I HAVE FINISHED DRINKING" button — full-width, 128–192px tall, secondary-container pink
- "Next round starts when everyone is ready." subtitle (pulsing outline)
- Host controls at bottom: "End round (new race)" / "End game (back to lobby)"

---

## Phase Merger: SETTLEMENT + DISTRIBUTION → SettlementView

### State Machine — No Changes

The state machine in `src/game/machine.ts` is untouched. `SETTLEMENT` auto-transitions to `DISTRIBUTION` after `allSettlementsDone`. The DO broadcasts `phase_changed` on transition. The UI receives the new `room.state` and re-renders within the same `SettlementView` — the leaderboard persists, the right panel transitions from "results summary" to "distribution controls."

The host's "Continue to Distribution" button sends the existing `host_advance_phase` message.

### Files to Delete

| Delete | Reason |
|---|---|
| `frontend/src/views/ResultsView.tsx` | Merged into `SettlementView.tsx` |
| `frontend/src/views/DistributionView.tsx` | Merged into `SettlementView.tsx` |
| `frontend/src/styles/global.css` | Replaced by Tailwind + design-tokens.css |

### Files to Rename

| From | To | Reason |
|---|---|---|
| `frontend/src/views/DoneView.tsx` | `frontend/src/views/ReadyView.tsx` | Match phase name and mockup terminology |

### Documentation Updates

| File | Change |
|---|---|
| `.context/game_design.md` § State Transitions (line 226) | Add note: "SETTLEMENT and DISTRIBUTION render as a single unified UI screen; the phase transition is seamless to the player." |
| `.context/game_design.md` § 7. Settlement + § 8. Distribution | Add cross-reference linking the two sections to the combined SettlementView layout. |
| `frontend/src/views/RoomView.tsx` | Update `switch` — both `"SETTLEMENT"` and `"DISTRIBUTION"` route to `SettlementView`. |

---

## Implementation Order

### Phase A: Foundation

1. Add `tailwindcss` + `@tailwindcss/vite` to root `package.json` devDependencies
2. Add `@tailwindcss/vite` plugin to `frontend/vite.config.ts`
3. Create `frontend/src/styles/design-tokens.css` — CSS custom properties from DESIGN.md (colors, typography scales, spacing, radii)
4. Rewrite `frontend/src/styles/global.css` — `@import "tailwindcss"` + `@tailwindcss/vite` directives, base resets, Inter + Space Grotesk `@font-face` imports
5. Build all shared components in `frontend/src/components/`
6. Smoke test: render `AppShell` + `GlassPanel` + `Button` in a temporary route to confirm Tailwind builds and tokens resolve

### Phase B: View Rewrites (game-flow order)

1. `HomeView.tsx` — hero + host/join cards
2. `LobbyView.tsx` — 3-column grid
3. `BiddingView.tsx` — unified suit grid + slider + hosted-player chips
4. `CountdownView.tsx` — typography lift only
5. `RacingView.tsx` — grid track
6. `SettlementView.tsx` — merged results + distribution (new file)
7. `ReadyView.tsx` — drink penalty + progress grid + ready button

### Phase C: Integration & Cleanup

1. Update `RoomView.tsx` phase routing switch
2. Delete `ResultsView.tsx`, `DistributionView.tsx`
3. Delete old `DoneView.tsx` (replaced by `ReadyView.tsx`)
4. Remove old `global.css` rules superseded by Tailwind
5. Update `.context/game_design.md` with merged-phase documentation
6. Update `frontend/src/App.tsx` imports if any renamed views changed their export name
7. Full end-to-end smoke test: create room → join → lobby → bid → race → settlement → distribution → ready → next round

---

## Risk Assessment

| Risk | Mitigation |
|---|---|
| Tailwind v4 + SolidJS Vite plugin compatibility | `@tailwindcss/vite` is the blessed Tailwind v4 integration path. SolidJS's Vite plugin sits in the same pipeline without conflict. If issues arise, fall back to Tailwind v3 PostCSS mode. |
| Merged SETTLEMENT/DISTRIBUTION view state complexity | The view uses `room().state` as its internal sub-state driver. The state machine controls transitions; the view renders both sub-views in one component. No new state — purely presentational. |
| Hosted-player bidding UX — chip-click-to-switch | The active chip uses `neon-border-active` glow + `scale-105`. If it feels clunky during playtest, add a dropdown fallback. |
| Grid track rendering complexity | The game design doc § Track Layout already specifies the grid shape. The mockup's CSS grid maps 1:1 to that specification. |
| BiddingView now handles three roles (self, hosted, host-as-self) | The `biddingForId` signal cleanly separates "who am I bidding for" from "what suit/amount." All three roles use the same `SuitGrid` + slider, same `place_bid` message. |
| Removing ResultsView/DistributionView breaks imports | Both are only imported by `RoomView.tsx`. Delete the files, update one switch statement. Blast radius: 1 file. |

---

## What Stays Unchanged

| Layer | Files | Reason |
|---|---|---|
| Shared types | `shared/messages.ts` | No type changes needed |
| Game engine | `src/game/machine.ts`, `src/game/types.ts`, `src/game/random.ts` | No state machine changes |
| DO handler | `src/room.ts` | No server-side changes |
| WebSocket client | `frontend/src/ws/store.ts`, `frontend/src/ws/handle.ts` | No protocol changes |
| Router | `frontend/src/App.tsx` | Routes unchanged (`/` → HomeView, `/room/:code` → RoomView) |
| Vite config | `frontend/vite.config.ts` | Only plugin array grows |
| Tests | `tests/` | All existing tests continue to pass |
