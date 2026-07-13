# `.context/` Routing Table

The agent must read this file at the start of every session. Everything else
in this folder is conditional — read this first, then read only what the
current task actually needs.

## When to read each file

| File | Read when… | Skip when… |
|---|---|---|
| `roadmap.md` | Always (first read after this file). Tells you which phase the project is in and which milestone is active. | Never skip — the active phase determines which workflow rules from `AGENTS.md` apply. |
| `game_design.md` | Working on gameplay, state machine, race algorithm, settlement math, lobby/player model, or data shapes. Adding/changing the 9-phase loop. | Working on tooling, infrastructure, or pure architecture (no gameplay impact). |
| `architecture.md` | Working on stack, deployment, DO/Worker/Pages layout, WebSocket protocol, or onboarding a new dev to "what are we building on". | Working on gameplay rules in isolation — the stack is irrelevant. |
| `game_design_principles.md` | Designing or evaluating any new mechanic. Use it to check the user's mechanic idea against the four classic frameworks (MDA, four layers of rules, dominant-strategy trap, loss aversion, meaningful choice) before locking it in. | Working on implementation, not design. |
| `captains_log.json` | About to make a significant change (milestone reached, architectural decision, refactor, pivot). Check recent entries to avoid contradicting prior decisions. After making a significant change, append a new entry. | Routine implementation work that doesn't cross a trigger condition. |
| `race_modifiers.md` | The user pitches a V2 modifier idea, or asks "could we add X mechanic later". | V1 implementation — modifiers are explicitly deferred. |
| `todo_random.md` | The user explicitly references it or asks "what was that thing I mentioned last week". | Most sessions — it's the dump for half-baked ideas, not a source of truth. |
| `initial_idea.md` | Need to recall the original ask verbatim (player counts, latency tolerance, budget, the 9-step loop from the user's words). Useful for "did we already decide this?" checks. | After Phase 1 is locked — `game_design.md` is the canonical version, `initial_idea.md` is the source. |

## Cross-references (one-way, who references whom)

- `roadmap.md` → references `game_design.md` (milestone descriptions) and `architecture.md` (stack decision).
- `game_design.md` → was derived from `initial_idea.md` (now frozen as reference). Loosely related to `race_modifiers.md` (V2 deferred surface).
- `architecture.md` → references the data model from `game_design.md` (Room, Player, Bid, Horse, TrackCard, DrinksState).
- `captains_log.json` → entries list `files_affected` which point to the other files in this folder (and source files in the repo).
- `AGENTS.md` (at repo root, not in `.context/`) → references this folder and the files within it for the Captain's Log protocol and design principles.

## Folder conventions

- **Markdown is the only format for design documents** (except `captains_log.json` which is structured for the website pipeline). All `.md` files use standard Markdown headings, no frontmatter, no embedded HTML.
- **Files are append-only or replace-only.** Do not rewrite `game_design.md` from scratch — append new clarifications or edit specific sections. The Captain's Log captures the "why" of changes.
- **The folder is the single source of truth for design.** Code may reference these documents (e.g., schema fields in `src/game/types.ts` should mirror the data model in `game_design.md`).
- **Do not create files in `.context/` without an explicit ask** from the user. This folder is curated, not a scratchpad. Use `todo_random.md` for half-formed ideas.
