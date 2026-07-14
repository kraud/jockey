# Project Roadmap
Current Phase: Phase 3 (Implementation & Prototyping)

## Milestones
- [x] Define Core Loop
  - Core loop written; 9 phases; drinking-game layer integrated.
- [x] Lock Mechanics Glossary
  - Glossary written; 25 terms; data model and state transitions mapped.
- [x] Select Architecture Stack
  - Chose Cloudflare Workers + Durable Objects + Pages: edge-deployed, $0 free tier, per-room DOs for strong state consistency. WebSocket transport, no database needed.
- [x] MVP Implementation
  - Full vertical slice: pure-TS game engine (15 state-machine functions, 59 tests), Cloudflare Worker + Durable Object with WebSocket Hibernation API, vanilla-TS Pages SPA. Race pacing via self-rescheduling alarms. Room creation, WS join, bidding, race streaming, settlement, distribution — all verified end-to-end.
- [ ] Playtest V1 Review
