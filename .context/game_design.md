# Game Design Document
*This file tracks the core loop and game mechanics.*

## Lobby & Player Management

### Room Lifecycle

1. A player opens the site and creates a room → becomes the **host**. The room gets a unique room code shared via QR code or text.
2. Players join the room via one of two methods:
   - **Independent player** (own device): enters the room code, picks a display name, joins. Handles their own bets, drink distribution, etc. from their own browser.
   - **Hosted player** (managed by host): the host adds them by name. The host manages all game actions for these players (suit selection, bets, drink distribution). Hosted players spectate only; their choices are executed by the host. Useful for streaming/broadcasting to a larger audience without requiring each spectator to control their own device.
3. The host is by default also a player, but can opt out to purely host/manage.

### Host Controls (always available, time-independent)

#### Room Settings (pre-race)
- **Track length** (default 6, range 6–20). All players see the current setting.
- Additional parameters determined later — all host-configured, all players perceive the results.

#### Player Management
- **Lock room:** toggle preventing any further players from joining.
- **Kick player:** remove any player from the room at any time.

#### Game Flow
- **Start race:** begins the Bidding phase. The host decides when to start, even if they are the only player.
- **Progress to next phase:** the host advances the game through each phase (Bidding → Race → Settlement → Distribution → Ready). Ready signals from players are informational only — the host is never blocked from advancing.

### Bidding Process (by player type)

- **Independent player** (own device): chooses suit + bid amount on their own device, submits independently. Their bet is marked `confirmed`.
- **Hosted player** (managed by host): the host chooses suit + bid amount for them via the host UI, submits on their behalf. Their bet is marked `confirmed`.
- **Host-as-player:** the host manages their own bet like an independent player on their own device.

The host (and all independent players) can see which players have confirmed their bets and which are still pending. The host starts the race once ready.

### Distribution & Ready (by player type)

- **Independent player** (own device): assigns their drinks via their own device during the 30 s window, then marks themselves ready after drinking.
- **Hosted player** (managed by host): the host assigns drinks for them via the host UI. Their "ready" state is toggleable by the host.
- **Host-as-player:** the host manages their own drinks on their own device.

---

## Core Loop

The game proceeds in a single round from Lobby through Ready phase (see "Lobby & Player Management" above for how players join and interact). Each round is independent — no state carries between rounds except player identity.

### 1. Lobby
See **Lobby & Player Management** section above for room creation, joining, host controls, and player types (independent vs hosted). The host configures room settings, manages players, and starts the race when ready.
### 2. Bidding
Each player secretly picks one of the 4 suits (Coins, Cups, Swords, Clubs) and a bid amount 1–5. No bid can be changed once submitted. Bidding closes when all active players have submitted, or after a 30 s soft timer (host's choice to enforce; default = wait for all). All bids are revealed to all players simultaneously.

### 3. Track Setup
The server constructs `trackLength` track-cards. Each track-card's suit is independently random uniform over {Coins, Cups, Swords, Clubs}. Cards are face-down and indexed 1..N, position 1 being the step closest to the starting line.

### 4. Race
The remaining deck (Spanish 48-card deck minus the 4 × 11 "jockey" cards = 44 cards) is shuffled. The server draws one card at a time. The horse matching the card's suit advances one step. The drawn card is discarded. If the drawn card's suit matches a horse that has already finished, the card is ignored (no horse moves) and the next card is drawn. When the discard pile is exhausted, it is reshuffled back into the draw pile and the race continues.
When a horse advances, the server checks whether it was the last-placed horse (lowest step index) before the move and whether the newly reached step's track-card is still face-down. If both conditions are true, Phase 5 (Track-Card Flip) is triggered immediately.

### 5. Track-Card Flips (Regression)
Each track-card starts face-down. It is flipped only when the horse that was last-placed (lowest step index, possibly tied) advances to that step for the first time — i.e., when its forward movement brings it to a position whose track-card is still face-down. Once flipped, the card's suit determines which horse regresses:

- If the flipped card's suit matches a horse that has already finished, it is ignored — no horse moves.
- Otherwise, the matching horse (if not finished) regresses one step from its current position.
- A horse cannot regress below step 0 (the starting line — it stays at 0).

A regression does not trigger any additional track-card flips (a horse regressing into a step is not "first reaching" it). Each track-card flips at most once per race. If the flipped card's suit matches the last-placed horse itself, that horse immediately regresses back one step — it does not stall at the newly reached position.

### 6. Finish Detection
Placements are assigned in strict crossing order: the first horse to advance past step N (the finish line) gets 1st, the second gets 2nd, the third gets 3rd. As soon as the third horse crosses, the race ends. The remaining horse is 4th. A horse that has finished cannot be moved by subsequent deck draws or track-card flips (those events are ignored).

### 7. Settlement
For each bidder, the bid placed on the winning horse is resolved against the horse's placement:
- 1st place → bidder earns 2 × bid "drinks to give"
- 2nd place → bidder earns 1 × bid "drinks to give"
- 3rd place → bidder owes 1 × bid "drinks to consume" (auto-added to their counter)
- 4th place → bidder owes 2 × bid "drinks to consume" (auto-added)


> **UI cross-reference:** Settlements are displayed in the combined SettlementView.tsx alongside the Distribution controls (see § 8. Distribution Phase).
### 8. Distribution Phase
Every player with `drinks_to_give > 0` has a 30 s global window (single shared timer) to assign their drinks to any player (self or others). Each assignment is a discrete give of any positive integer up to the player's remaining pool. After 30 s, all unassigned drinks are auto-distributed: each unit is rolled uniformly at random over all players (self-included) and added to that player's drinks-to-consume counter. A player with `drinks_to_give == 0` simply waits 30 s; the timer does not pause for them.


> **UI cross-reference:** Distribution controls are rendered in the same SettlementView.tsx component as the Settlement results (see § 7. Settlement). The leaderboard from settlement persists as a sidebar during the distribution phase.
### 9. Ready Phase
Once all drinks are settled, every player sees their own `drinks_to_consume` total. Each player presses a "ready" button when they have finished drinking. The next round begins the moment all active players are ready, or after a 60 s hard cap (auto-ready any remaining players). The next round resets all race state (positions, placements, drinks counters) but keeps player identities and any per-player persistent settings the host has set.

## Track Layout

The track is rendered as a horizontal CSS grid with a fixed orientation: track-cards occupy the top row, one row per horse sits below, and progression runs left-to-right. Step 1 sits closest to the starting line (left side); step N sits closest to the finish line (right side).

**Grid shape (N = track length, default 6):**
- Columns: `[suit label 50px] [start] [step 1] [step 2] … [step N] [end]`
- Rows: 1 header row containing the track-cards, then one row per suit in the order Coins, Cups, Swords, Clubs (top to bottom).

**Cell contents:**
- Header row: empty / "start" label / one track-card per step (face-down until first flip) / "end" label.
- Each suit row: 2-letter suit label / the horse's marker placed in the column matching its current `position` (0 = `start` column, 1..N = matching step column, finished = `end` column).

**Progression direction:** left-to-right. A horse advances when the deck draws its suit; visually it moves one cell to the right.

**Step ↔ column mapping (1-indexed):** `column = position` for positions 0..N (with `start` mapped to 0 and `end` mapped to N+1). A horse at position `p` is drawn in the column for step `p` when `1 ≤ p ≤ N`, in the `start` column when `p = 0`, and in the `end` column when `p > N` (finished).

**ASCII diagram (track length 6, all horses at start, no flips yet):**

````
       |    | start | step1 | step2 | step3 | step4 | step5 | step6 | end |
       |    |       |   🖌  |   🖌  |   🖌  |   🖌 |   🖌  |  🖌   |     |
Coins  | Co |   ♞   |       |       |       |       |       |       |     |
Cups   | Cu |   ♞   |       |       |       |       |       |       |     |
Swords | Sw |   ♞   |       |       |       |       |       |       |     |
Clubs  | Cl |   ♞   |       |       |       |       |       |       |     |
````
**Gameplay example on a progression of that game:**
**After Clubs advances to step 1 (still pre-flip) and is the last horse to reach step 1, it triggers a flip on the track-card for step 1:**

````
       |    | start | step1 | step2 | step3 | step4 | step5 | step6 | end |
       |    |       |   🖌  |   🖌  |   🖌 |   🖌  |   🖌  |   🖌  |     |
Coins  | Co |       |       |       |   ♞   |       |       |       |     |
Cups   | Cu |       |       |   ♞   |       |       |       |       |     |
Swords | Sw |       |       |   ♞   |       |       |       |       |     |
Clubs  | Cl |       |   ♞   |       |       |       |       |       |     |
````

**After revealing Cups under the track-card for step 1, Cups regresses one step**

````
       |    | start | step1 | step2 | step3 | step4 | step5 | step6 | end |
       |    |       |   Cu  |   🖌  |   🖌  |   🖌  |   🖌 |   🖌  |     |
Coins  | Co |       |       |       |   ♞   |       |       |       |     |
Cups   | Cu |       |   ♞   |       |       |       |       |       |     |
Swords | Sw |       |       |   ♞   |       |       |       |       |     |
Clubs  | Cl |       |   ♞   |       |       |       |       |       |     |
````

## Glossary & Terms

- **Bid** — a player's choice of suit + integer 1..5, placed during the Bidding phase. Immutable once submitted.
- **Bid Amount** — the integer component of a Bid, range 1..5 inclusive.
- **Bidder** — any player who has placed a valid Bid in the current race.
- **Coins / Cups / Swords / Clubs** — the four Spanish-deck suits, mapped 1:1 to the four horses.
- **Deck (Draw Pile)** — the shuffled 44-card Spanish deck used to drive race movement (the 48-card Spanish deck minus the four 11s, which represent the jockeys riding the horses).
- **Discard Pile (Used Pile)** — cards already drawn from the Draw Pile this race. Reshuffled back into the Draw Pile when the Draw Pile is empty.
- **Distribution Phase** — the post-race phase in which players with `drinks_to_give > 0` assign drinks to other players (or themselves) within a 30 s window.
- **Drinks to Consume** — the integer counter each player owns; the number of sips they must drink this round. Increased by: (a) auto-assigned penalties from 3rd/4th place Settlement, and (b) drinks received from other players during Distribution. Also referred to as "drinks to take" — the two terms are synonymous.
- **Drinks to Give** — the integer pool a player earned from a winning bid; must be distributed (or auto-distributed) during Distribution.
- **Finished Horse** — a horse that has advanced past the finish line (step N+1). Cannot be moved by further draws or flips; matching cards are ignored.
- **Finishing Line** — the imaginary line one step past the last track-card. A horse wins by advancing past it.
- **Horse** — a runner identified by suit. The four horses are Coins, Cups, Swords, Clubs.
- **Jockey Card** — the four `11` cards of the Spanish deck, removed from the Draw Pile at race start. Each one represents the rider of a horse for narrative purposes but is not used as a gameplay card in V1.
- **Lobby** — pre-race state where players join and the host configures the round.
- **Host** — the player who created the room. Controls room settings, player management (lock/kick), and game flow progression. Can also play as a regular player (host-as-player) or opt out to purely manage.
- **Hosted Player** — a player managed by the host. The host chooses suit, places bets, and distributes drinks on their behalf. Hosted players spectate only. Useful for streaming/broadcasting.
- **Independent Player** — a player on their own device. Enters via room code, picks a display name, and handles their own bets and drink distribution.

- **Placement** — a horse's finishing rank (1, 2, 3, or 4). Assigned in strict crossing order.
- **Race** — the period from the first deck draw until the third horse crosses the finishing line.
- **Ready Phase** — the post-Distribution phase where each player presses a "ready" button once they have consumed their drinks.
- **Regression** — a one-step backward movement of a horse, triggered when a track-card is flipped (by the last-placed horse reaching that step) and its suit matches a non-finished horse. Cannot move a horse below step 0.
- **Spanish Deck** — the 48-card deck with suits Coins, Cups, Swords, Clubs and ranks 1–12.
- **Step** — a discrete position on the track, indexed 1..N. A horse at step 0 is at the starting line.
- **Step (last-placed horse triggers flip)** — the rule that a track-card is flipped only when the horse that was last-placed (lowest step index, possibly tied) before its move advances to that step for the first time. Each track-card flips at most once.
- **Track** — the `trackLength`-long sequence of face-down track-cards, one per step, plus the finishing line one step beyond.
- **Track Length** — the number of steps in the current race. Default 6, range 6..20 inclusive.
- **Track-Card** — a face-down card on the track. Its suit determines which horse regresses when it is flipped. Flipped by the "last-placed horse" rule.

**V2 Deck-Builder Effects (deferred)** — a future iteration will introduce effect cards that modify the race (track length, step gains, suit immunities, paired movements, etc.). V1 has no such cards; the rulebook for V2 will be defined after V1 playtest data. This is a recorded axis, not a V1 design surface.

## Data Model

### Room
- `id` (string, internal)
- `roomCode` (string, human-readable short code for sharing)
- `host` (playerId)
- `isLocked` (bool, prevents new joiners)
- `players` (list of Player)
- `trackLength` (int, default 6, range 6..20)
- `state` (enum: LOBBY | BIDDING | SETUP | RACING | SETTLEMENT | DISTRIBUTION | READY)
- `createdAt` (timestamp)

### Player
- `name` (string)
- `type` (enum: `independent` | `hosted`)
- `isConnected` (bool; independent players only, hosted are always considered connected)


### Bid
- `playerId`
- `suit` (one of Coins/Cups/Swords/Clubs)
- `amount` (int 1..5)
- `submittedAt` (timestamp)

### Horse
- `suit`
- `position` (int step 0..N+1)
- `isFinished` (bool, derived: `position > N`)

### TrackCard
- `index` (int 1..N)
- `suit` (suit enum, fixed at setup)
- `isFlipped` (bool, default false)

### DeckState
- `drawPile` (list of cards, server-private)
- `discardPile` (list of cards, server-private)

### DrinksState (per Player)
- `drinksToGive` (int >= 0)
- `drinksToConsume` (int >= 0)
- `isReady` (bool)

### RaceLog (event log, public)
Append-only list of typed events:
- `DECK_DRAW { card, suit, ignored }`
- `HORSE_MOVE { suit, from, to, reason: DECK|REGRESSION }`
- `TRACK_FLIP { index, suit, ignored }`
- `HORSE_FINISH { suit, placement }`
- `RACE_END { placements }`
- `SETTLEMENT { playerId, drinksToGive, drinksToConsume }`
- `DRINK_GIVE { from, to, amount }`
- `DRINK_AUTO { to, amount }`
- `PLAYER_READY { playerId }`

## State Transitions

| From State | Event | To State |
|---|---|---|
| LOBBY | `hostStartRace` | BIDDING |
| BIDDING | `allBidsSubmitted` OR `30sBidTimerExpired` | SETUP |
| SETUP | `setupComplete` (auto-immediate) | RACING |
| RACING | `deckDraw` (or `trackFlip` derived from it) | RACING |
| RACING | `horseFinish (placement=3)` (third horse crosses) | SETTLEMENT |
| SETTLEMENT | `allSettlementsDone` (auto-immediate) | DISTRIBUTION |
| DISTRIBUTION | `allDrinksDistributed` OR `30sDistTimerExpired` | READY |
| READY | `allReady` OR `60sReadyCapExpired` | LOBBY |

> **UI Note:** SETTLEMENT and DISTRIBUTION render as a single unified UI screen (SettlementView.tsx); the phase transition from SETTLEMENT → DISTRIBUTION is seamless to the player — the leaderboard persists and the right panel updates from "results summary" to "distribution controls."

### Termination Rule
A player who is `!isConnected` for the entire Bidding phase of a round is treated as a non-bidder for that round and is excluded from Placement, Settlement, and Distribution. They rejoin at the next round. (This is the V1 disconnect policy; deeper reconnect is deferred.)
