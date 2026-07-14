# Horse Racing

A web-based multiplayer horse-race betting game played with a Spanish deck of cards. Pure chance, no skill — the entertainment comes from the race itself and the drinking-game economy layered on top.

Built as a Vite + SolidJS SPA with a Cloudflare Workers + Durable Objects backend. Message types shared via `shared/messages.ts` — no type drift between frontend and backend.

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
shared/          — Shared types (messages.ts) used by both backend and frontend
src/             — Cloudflare Worker + DO backend (game logic)
frontend/
  src/           — SolidJS components, views, WebSocket store
  index.html     — Vite HTML shell
  vite.config.ts — Vite config with dev proxy
```

## Development

Run two terminals:

```bash
# Terminal 1: Backend (Wrangler dev server)
bun run dev

# Terminal 2: Frontend (Vite dev server)
bun run dev:frontend
```

Vite proxies `/api` and `/ws` to the Wrangler dev server, so the frontend uses relative URLs (`fetch('/api/room', …)`, `new WebSocket('ws://' + location.host + '/ws?room=…')`).

## Build

```bash
bun run build      # TypeScript check + Vite production build
bun run build:frontend  # Vite production build only
```

Build output is in `frontend/dist/`, deployed to Cloudflare Pages.

## License

Not yet determined.
