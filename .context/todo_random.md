# Random TODOs & Brainstorms
*A simple list of ideas, quick fixes, and out-of-scope reminders.*

- [ ] Find a better name for the game (currently just called 'Horse racing'). Ideas so far: 'Derby Day Suit', 'Deck Jockey', 'Card Jockey', 'Suit Jockey'
- [ ] Add settings on how the track-cards are set (full-random, force 1 per suit)
- [ ] Add track/grid layout variations to the game design and to the frontend implementation. The current V1 implementation is locked to one orientation (horizontal, track-cards on the top row, horse rows below, left-to-right progression). The user has proposed two further orientations to support as optional host settings:
  * **Horizontal, track-cards on the bottom row** — mirrors the WikiHow example. The header row holds the horse rows; the footer row holds the track-cards. Progression still runs left-to-right.
  * **Vertical, track-cards on the leftmost column** — track-cards stacked top-to-bottom in column 1; each horse gets its own row that runs from the start (bottom) to the end (top). Progression runs bottom-to-top.

  **When picked up, do this in two parts:**

  1. **Doc update first** (no code change yet) — extend the `## Track Layout` section in `.context/game_design.md`. Add a new `### Alternative Orientations` H3 subsection immediately after the second ASCII diagram (the post-flip example) and before the closing of the `## Track Layout` section. The wording is pre-drafted in the appendix below — paste it verbatim.

  2. **Code update** — add a host setting (e.g. a `trackOrientation: "horizontal-top" | "horizontal-bottom" | "vertical-left"` field on `Room` in `shared/messages.ts`), default to `"horizontal-top"` to match the current behavior, then thread the setting through `RacingView.tsx` and `ResultsView.tsx` so the grid template and row order reflect the choice. Reuse the existing `.horse-grid` / `.horse-cell` CSS classes; only the `grid-template-columns` / `grid-template-rows` strings and the loop order in the JSX change.

  **Appendix — exact wording to paste into the `## Track Layout` section, in `### Alternative Orientations` H3 subsection, immediately after the second ASCII diagram (and a blank line separator):**

  ````
  ### Alternative Orientations (not implemented in V1)

  The orientation described above is the V1 default. Two further orientations have been considered and are tracked for a future iteration. The V1 implementation has no host toggle for these.

  **Horizontal — track-cards on the bottom row.** Mirrors the WikiHow example. The grid shape is the same as above but the rows are flipped: the top row is the suit-label + horse-marker row, and the bottom row contains the track-cards. Progression still runs left-to-right (start on the left, end on the right). This is the natural orientation if the implementation ever wants to display the track-cards face-up before the race to convey "odds at a glance" like the WikiHow standard game.

  **Vertical — track-cards on the leftmost column.** The grid shape is transposed: each horse gets one row running bottom-to-top, and the track-cards are stacked in the leftmost column. The starting line is the bottom of the column, the finish line is the top. Progression runs bottom-to-top. A horse's position `p` maps to a row offset from the bottom; a track-card at step `k` is read off the leftmost column at the matching height. Useful for tall/narrow viewports.
  ````
