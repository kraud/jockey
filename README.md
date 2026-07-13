# Horse Racing

A web-based multiplayer horse-race betting game played with a Spanish deck of cards. Pure chance, no skill — the entertainment comes from the race itself and the drinking-game economy layered on top.

Built as a prototype: no framework, minimal dependencies, deployable at near-zero cost.

## Current status

Phase 1 complete (gameplay loop & domain definition). Next: architecture selection and cost exploration.

### Core loop (one round)

1. **Lobby** — players join, host sets track length (6–20)
2. **Bidding** — each player secretly picks a horse (suit) and bid (1–5)
3. **Track Setup** — random face-down track-cards laid out, one per step
4. **Race** — Spanish deck (44 cards, four 11s removed) drawn one at a time; matching horse advances one step
5. **Track-Card Flip** — last-placed horse passing a step flips that track-card; matching horse regresses one step
6. **Finish** — first three horses across the line place; fourth is the remainder
7. **Settlement** — winner earns drinks-to-give, losers owe drinks-to-take
8. **Distribution** — 30s window to assign earned drinks, random fallback after
9. **Ready** — all players drink and press ready (60s cap), then next round

## Project structure

```
.context/        — Design docs, roadmap, glossary
```

## License

Not yet determined.
