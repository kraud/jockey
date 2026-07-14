import type { RNG } from "./random";
import type { Card, Horse, Room, Suit } from "./types";

// ── Derived helpers ──────────────────────────────────────────────────

/**
 * Ordered list of finished horses by placement (1st..4th).
 * Unplaced horses are excluded.
 */
export function placements(room: Room): ReadonlyArray<{ suit: Suit; placement: number }> {
  return room.horses
    .filter((h) => h.placement > 0)
    .sort((a, b) => a.placement - b.placement)
    .map((h) => ({ suit: h.suit, placement: h.placement }));
}

/**
 * The suit of the horse with the lowest position among non-finished horses.
 * Returns null if all horses have finished.
 */
export function lastPlacedHorse(room: Room): Suit | null {
  const unplaced = room.horses.filter((h) => !h.isFinished);
  if (unplaced.length === 0) return null;
  let lowest = unplaced[0]!;
  for (const h of unplaced) {
    if (h.position < lowest.position) lowest = h;
  }
  return lowest.suit;
}

/** How many horses have finished (have a placement). */
function finishedCount(room: Room): number {
  return room.horses.filter((h) => h.placement > 0).length;
}

// ── Core draw routine ────────────────────────────────────────────────

/**
 * Implements game_design.md Steps 4, 5, 6 for a single deck draw.
 *
 * Modifies and returns a clone of `room`.  Caller is responsible for
 * managing the deck (popping/reshuffling) — this function only handles
 * the race-logic side of a drawn card.
 *
 * ## Algorithm (per game_design.md)
 *
 * > When a track-card's step is reached by the last-placed horse (the
 * > horse with the lowest current step index), that track-card is flipped
 * > face-up.  If the flipped card's suit matches a horse that has already
 * > finished, it is ignored (no horse moves).  Otherwise, the matching
 * > horse regresses one step.  A regressing horse that would step below 0
 * > stays at 0.  A regression is itself a "horse passed a step" event, but
 * > it does not trigger another track-card flip on the same step
 * > (regression is not a re-passing).
 *
 * > Placements are assigned in strict crossing order: the first horse to
 * > advance past step N gets 1st, second gets 2nd, third gets 3rd.  As
 * > soon as the third horse crosses, the race ends.  The remaining horse
 * > is 4th.  A horse that has finished cannot be moved by subsequent deck
 * > draws or track-card flips.
 */
/**
 * Stage 1 of a draw: deck draw event + horse advance + finish detection.
 * Does NOT run the track-card flip or regression.
 */
export function applyDrawStep(room: Room, card: Card): Room {
  const r = structuredClone(room);
  const suit = card.suit;
  const horse = r.horses.find((h) => h.suit === suit)!;

  // Step 4: draw event
  r.raceLog.push({ type: "DECK_DRAW", card, suit, ignored: false });

  // If the matching horse is already finished, the card is ignored.
  if (horse.isFinished) {
    // Overwrite the last log entry's ignored flag
    const last = r.raceLog[r.raceLog.length - 1]!;
    if (last.type === "DECK_DRAW") {
      (last as { ignored: boolean }).ignored = true;
    }
    return r;
  }

  // Advance the horse by 1.
  const from = horse.position;
  horse.position += 1;
  r.raceLog.push({ type: "HORSE_MOVE", suit, from, to: horse.position, reason: "DECK" });

  // Step 6: finish detection.
  if (horse.position > r.trackLength && horse.placement === 0) {
    const nextPlacement = finishedCount(r) + 1;
    horse.placement = nextPlacement;
    horse.isFinished = true;
    r.raceLog.push({ type: "HORSE_FINISH", suit, placement: nextPlacement });

    // Third finish -> race over.
    if (nextPlacement === 3) {
      r.state = "SETTLEMENT";
      r.raceLog.push({
        type: "RACE_END",
        placements: placements(r),
      });
      return r;
    }
  }

  return r;
}

/**
 * Stage 2 of a draw: track-card flip and regression.
 * Operates on the room after applyDrawStep has run.
 */
export function applyFlipStep(room: Room): Room {
  const r = structuredClone(room);

  // Find the last-placed horse among non-finished horses.
  const lpSuit = lastPlacedHorse(r);
  if (lpSuit !== null) {
    const lastPlaced = r.horses.find((h) => h.suit === lpSuit)!;
    const flipCard = r.trackCards.find(
      (tc) => !tc.isFlipped && tc.index <= lastPlaced.position,
    );

    if (flipCard) {
      flipCard.isFlipped = true;
      const flipSuit = flipCard.suit;

      const flipHorse = r.horses.find((h) => h.suit === flipSuit)!;
      const flipIgnored = flipHorse.isFinished;

      r.raceLog.push({
        type: "TRACK_FLIP",
        index: flipCard.index,
        suit: flipSuit,
        ignored: flipIgnored,
      });

      // Regression: matching horse moves -1, clamped to 0.
      if (!flipIgnored) {
        const regFrom = flipHorse.position;
        flipHorse.position = Math.max(0, flipHorse.position - 1);
        if (flipHorse.position !== regFrom) {
          r.raceLog.push({
            type: "HORSE_MOVE",
            suit: flipSuit,
            from: regFrom,
            to: flipHorse.position,
            reason: "REGRESSION",
          });
        }
      }
    }
  }

  return r;
}

/**
 * Full draw: deck draw + horse advance + track-card flip.
 * Composes applyDrawStep then applyFlipStep.
 * Maintained for backward compatibility with existing callers.
 */
export function applyDraw(room: Room, card: Card, _rng: RNG): Room {
  return applyFlipStep(applyDrawStep(room, card));
}
