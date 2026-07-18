# Developer Cookbook

Step-by-step recipes for common CDC development tasks. Every recipe references the exact files and patterns in the codebase.

---

## Add a New Gameplay Action

Worked example: adding a `play_card` action to the DISTRIBUTION phase. Follow these 7 steps in order — **types first, then validator, then pure machine fn, then test, then DO glue, then UI.**

### Step 1: Add the Message Type

File: `shared/messages.ts`

Append to the `ClientMessage` union (lines 140-163):
```ts
| { type: "play_card"; cardId: string }
```

If the server needs to send a response, append to `ServerMessage`:
```ts
| { type: "card_played"; playerId: string; cardId: string }
```

### Step 2: Add the Parser Case

File: `shared/messages.ts`, inside `parseClientMessage` switch (line 261)

```ts
case "play_card": {
  validatePlayerId(msg.cardId);
  return { type: "play_card", cardId: msg.cardId as string };
}
```

Use the existing validators: `validatePlayerId`, `validatePositiveInt`, `validateSuit`, `validateBidAmount`, `validateBoolean`, `validatePlayerName`, `validateRoomCode`. Never write a custom regex — the validators produce consistent `WsProtocolError` responses.

### Step 3: Add the Machine Function

File: `src/game/machine.ts`

Place under the correct phase section (e.g., `// ── DISTRIBUTION ──`). Signature:

```ts
export function playCard(
  room: Room,
  params: { playerId: string; cardId: string },
): Room {
  assertPhase(room, "DISTRIBUTION");
  const r = structuredClone(room);
  // — mutate r here —
  // Push events to r.raceLog
  return r;
}
```

Rules:
- Always `assertPhase` to guard against wrong-state calls.
- Always `structuredClone(room)` as the first mutation line.
- Never mutate the original `room` parameter.
- Push any auditable side effects to `r.raceLog`.
- Throw `GameError("CODE", "message")` for invalid inputs.

### Step 4: Add a Unit Test

File: `tests/machine.test.ts`

Add a new `describe("playCard", …)` block mirroring the structure of existing tests. Example pattern (from `hostAssignDrink` at lines 286-317):

```ts
describe("playCard", () => {
  test("does the thing when conditions are met", () => {
    // Arrange: build a room in the right phase
    let room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    room.state = "DISTRIBUTION";

    // Act
    room = playCard(room, { playerId: "a", cardId: "card-1" });

    // Assert
    expect(room.raceLog.some(e => e.type === "CARD_PLAYED" && …)).toBe(true);
  });

  test("throws outside DISTRIBUTION", () => {
    const room = makeLobbyRoom([{ id: "a", name: "Alice", type: "independent" }]);
    expect(() => playCard(room, { playerId: "a", cardId: "card-1" })).toThrow(GameError);
  });
});
```

### Step 5: Add a Parser Test

File: `tests/messages.test.ts`

Add a test for the new message type:
```ts
test("play_card", () => {
  const msg = parseClientMessage(JSON.stringify({ type: "play_card", cardId: "abc" }));
  expect(msg).toEqual({ type: "play_card", cardId: "abc" });
});
```

### Step 6: Wire the DO Handler

File: `src/room.ts`, inside the `dispatch` switch (line 346)

```ts
case "play_card": {
  this.assertPlayer(att);
  const beforeLen = this.room.raceLog.length;
  this.room = playCard(this.room, { playerId: att!.playerId, cardId: msg.cardId });
  await this.persist();
  const newEvents = this.room.raceLog.slice(beforeLen);
  this.broadcast({ type: "race_log", events: newEvents });
  break;
}
```

Pattern to follow (from `assign_drink` at lines 450-463):
1. Assert authorization (`assertPlayer` or `assertHost`).
2. Call the machine function.
3. `await this.persist()`.
4. Broadcast incremental events (race_log, drinks_updated, etc.).
5. If the machine transition triggers a phase change, broadcast `phase_changed` and schedule the alarm.

### Step 7: Wire the UI

File: the appropriate view under `frontend/src/views/`

Add a button that calls `props.send`:
```tsx
<button onClick={() => props.send({ type: "play_card", cardId: selectedCard() })}>
  Play Card
</button>
```

Use `<Show when={…}>` for visibility logic (e.g., only show the button in DISTRIBUTION phase for the current player). Always read from `props.state` — never destructure props.

### The Principle

```
types → validator → pure machine fn → test → DO glue → UI
```

Never skip the test step. The machine is the authoritative game logic; it must be correct in isolation before wiring it to the network layer.

---

## Add a New Game State Property

Worked example: adding `stamina: number` to each horse.

### Step 1: Add the Field

File: `src/game/types.ts` — add to the `Horse` interface (lines 49-54):
```ts
export interface Horse {
  suit: Suit;
  position: number;
  isFinished: boolean;
  placement: number;
  stamina: number;  // new
}
```

If the field needs to be visible on the client, also add it to the `Horse` interface in `shared/messages.ts` (line ~49). **The two copies must stay in sync.**

### Step 2: Initialize the Field

File: `src/game/machine.ts` — find the construction site. For `stamina`, horses are created in `closeBidding` (line 256):
```ts
r.horses = SUITS.map((suit) => ({
  suit,
  position: 0,
  isFinished: false,
  placement: 0,
  stamina: 100,  // new — default value
}));
```

### Step 3: Reset the Field in State-Reset Paths

Audit every function that holds the field through a transition and might leak old values:
- `finishRound` (line 566) clears the entire `horses` array — safe for `stamina`.
- `endGame` (line 588) also clears `horses` — safe.
- If your field lives on `Player`, check `hostStartRace` (line 180) which resets drinks but not all player fields — you may need to add a reset line.

### Step 4: Wire Through Broadcast Payloads

`stamina` is on `Horse`, which is part of `Room.horses`. The `state_sync` ServerMessage payload includes the full `Room`, so `stamina` is automatically broadcast. No changes needed.

For fields not on an already-broadcast object, verify they appear in the relevant `ServerMessage` payload or `state_sync`.

### Step 5: Display in UI

File: the relevant view. For `stamina`, in `RacingView.tsx`:
```tsx
<For each={room().horses}>
  {(horse) => (
    <div class="horse-cell">
      <span class="horse-knight">♞</span>
      <span>{horse.stamina}</span>
    </div>
  )}
</For>
```

Always use `props.state.room.horses[i].stamina` in JSX; never destructure.

---

## Debug the Game Loop Locally

### Pure-TS Engine Tests

```bash
bun test tests/
```

Runs all ~59 tests in ~7 test files. Engine tests use `SeededRNG` from `src/game/random.ts:48` for determinism. To isolate a single function:

```bash
bun test tests/machine.test.ts -t "hostSetDistributionTimeLimit"
```

Add a `test.only(…)` temporarily, run, remove. Never commit `.only`.

### Engine Smoke in Isolation

Test a machine function without the Worker or DO:

```bash
bun -e '
import { hostAddPlayer, hostStartRace, placeBid } from "./src/game/machine";
import { SeededRNG } from "./src/game/random";
import type { Room } from "./src/game/types";

const rng = new SeededRNG(42);
let room: Room = {
  id: "test", roomCode: "TEST", hostId: "", isLocked: false,
  players: [], trackLength: 6, state: "LOBBY", createdAt: Date.now(),
  horses: [], trackCards: [], deckState: { drawPile: [], discardPile: [] },
  bids: {}, raceLog: [],
  bidDeadlineMs: null, countdownMs: null, distDeadlineMs: null, readyDeadlineMs: null,
  raceGapDeckMs: 2000, raceGapTrackMs: 1000, distributionTimeLimitMs: 30_000,
};

room = hostAddPlayer(room, { id: "a", name: "Alice", type: "independent", isHost: true });
room = hostStartRace(room);
room = placeBid(room, { playerId: "a", suit: "Coins", amount: 3 }, rng);
console.log(room.state, room.bids);
'
```

### Worker + DO End-to-End with wrangler dev

```bash
bun run dev          # Starts wrangler on localhost:8787
bun run dev:frontend # Starts Vite on localhost:5173
```

Vite proxies `/api` and `/ws` to `localhost:8787` via `frontend/vite.config.ts:15-22`. Open two browser windows on `localhost:5173`, create a room in one, join from the other.

The local DO simulator is single-process — rooms share memory but the DO namespace is mocked correctly. Multiple rooms in the same process work fine.

### Common Debug Points

| What | Where | How |
|---|---|---|
| Every inbound message | `src/room.ts:dispatch` (line 330) | `console.log("dispatch:", msg.type, msg)` |
| Alarm fire + state at tick | `src/room.ts:alarm` (line 188) | `console.log("alarm:", this.room.state, this.pendingStage)` |
| DO storage contents | `src/room.ts` anywhere | `console.log(await this.ctx.storage.list())` |
| Client message choke point | `frontend/src/ws/store.ts:45-53` | `console.log("ws msg:", parsed.type, parsed)` in the `onmessage` handler |
| State before reducer | `frontend/src/ws/handle.ts:38` | `console.log("before:", state, "msg:", msg)` in `applyServerMessage` |

---

## Error Code Reference

### GameError Codes (thrown by `src/game/machine.ts`)

| Code | When It Fires |
|---|---|
| `PHASE_GUARD` | A machine function is called when the room is in the wrong phase (e.g., `placeBid` during LOBBY) |
| `ROOM_LOCKED` | A player tries to join a locked room |
| `PLAYER_NOT_FOUND` | A player ID doesn't match any player in the room |
| `NOT_HOST` | A non-host player sends a host-only action |
| `TRACK_LENGTH_OUT_OF_RANGE` | Track length is outside 6–20 |
| `BID_INVALID` | Bid amount outside 1–5, or invalid suit |
| `BID_DUPLICATE` | Player already submitted a bid this round |
| `DRINK_INVALID_AMOUNT` | Drink assignment amount is zero or negative |
| `DRINK_INSUFFICIENT_POOL` | Giver doesn't have enough `drinks.give` remaining |
| `DRINK_INSUFFICIENT_RECIPIENT` | Recipient doesn't have enough `drinks.consume` to clear |
| `DIST_TIME_OUT_OF_RANGE` | Distribution time limit outside 5000–600000 ms |

### WsProtocolError Codes (thrown by `shared/messages.ts:parseClientMessage`)

All use `code: "VALIDATION_ERROR"` or `code: "PARSE_ERROR"`:

| Code | When It Fires |
|---|---|
| `PARSE_ERROR` | The raw string is not valid JSON |
| `VALIDATION_ERROR` | Message has no `type` field, an unknown `type`, or any field fails validation (bad room code, bad player name, out-of-range bid, etc.) |

The `message` field always contains a human-readable explanation of the specific validation failure.

---

## In-Code Documentation Standard

When writing or modifying any file in `src/`, follow these three rules:

### 1. Top-of-File Header Block

Every major file gets a 3-line block immediately after imports:

```ts
// ── <File> — <single-line responsibility> ─────────────────────────────
// Depends on: <one or more comma-separated paths>.
// Used by: <one or more comma-separated paths>.
```

Reference the existing headers in `src/room.ts`, `src/game/machine.ts`, etc. for exact format. The separator line (`── … ──`) is 74 characters wide with the `─` (U+2500) character.

### 2. Why-Over-What

Comments explain **why** the code does something, not what it does. What is visible from the code; why is the design rationale, edge-case justification, or non-obvious constraint. Good example (from `src/room.ts:215`):

```ts
// Race: two-stage alarm (DRAW → FLIP).
```

Bad (redundant):
```ts
// Set pending stage to FLIP.
this.pendingStage = "FLIP";
```

### 3. State Mutation Labels

Any function that mutates `this.room` (in the DO) or produces a new `Room` (in the machine) gets a `// ⚠️ STATE MUTATION` label. Two variants:

**DO methods** (mutate in-place + trigger side effects):
```ts
// ⚠️ STATE MUTATION: mutates this.room, persists to ctx.storage, and may broadcast to all WebSockets.
```

**Machine functions** (pure, return a new object):
```ts
// ⚠️ STATE MUTATION (pure): structuredClone + mutate clone; caller must persist + broadcast.
```

The label goes on the line directly above the function/method signature. If side effects differ from the default, add a one-liner naming the specific broadcasts.
