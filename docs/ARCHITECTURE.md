# Architecture

## Shape

```
 phones (controllers)          relay server                big screen (host)
 ┌──────────────┐  ws   ┌──────────────────────┐  ws   ┌───────────────────────┐
 │ join, hold   │──────▶│ Cloudflare Durable    │──────▶│ runs the simulation   │
 │ L / R, card  │◀──────│ Object (PartyServer)  │◀──────│ renders the town      │
 └──────────────┘       │ one room per session  │       │ presenter controls    │
                        └──────────────────────┘       └───────────────────────┘
```

- **The presenter's laptop is the authority.** It runs the simulation at a fixed tick and renders. The server only relays messages: joins, inputs to the screen, and per-player state back to each phone.
- **Tiny payloads.** Phones send input changes only (`-1 | 0 | 1` with a sequence number), not a stream. The screen sends each phone a small state packet a few times a second (phase, score, closed/open, tint).
- **Latency tolerance is built into the rules.** Grid moves, spring-back, push times of ~0.9s and crossings of ~2.5s all absorb 100–300 ms of venue cellular.

## Stack

- **Vite + React + TypeScript** for both the screen app and the phone app. npm workspaces: `packages/sim`, `packages/screen`, `packages/phone`. Vitest for tests; Node runs the bench's TypeScript directly (no build step).
- **Rendering:** Canvas 2D or PixiJS for the street. The prototype's Canvas 2D renderer is a fine starting point.
- **Server:** Cloudflare Durable Objects with **PartyServer** (not the hosted PartyKit platform, which stopped taking deployments on Oct 23, 2026). Free tier covers this load: incoming WebSocket messages bill as one request per 20, outgoing are free.

## Simulation

- `packages/sim` is a **pure, deterministic module** ported from `reference/sim.js`: `step(state, inputs, dt)` at a fixed `TICK`, seeded RNG, no DOM, no timers. Its tsconfig has no DOM or Node types, so it can't reach for them.
- **State is plain data.** Columns hold shop indices, RNG state is a number, and `step` returns the tick's events (topple, bump, pushback, closed, reopened, paid, lost) instead of keeping effects in the state. A JSON round trip of the state carries on identically.
- **Two RNG streams:** world (placement, movement order, waves, trickle, parachuters) and bots. Human input can't change where customers appear.
- **Inputs** are the held direction per human shop id. `setController` hands a shop between a phone and a bot mid-round (the network-down fallback).
- **Config:** every tunable lives in `packages/sim/src/config.ts`, in named sections (`export const WAVES = { … }`). The game holds the config by reference, so the screen's tuning panel (Tweakpane, `T`) edits it live; sections read at round start (street size, bot mix) apply on restart (`R`). In dev, **Save to config.ts** posts the values to a Vite middleware (`packages/screen/tools/saveTuningPlugin.ts`) that rewrites the `key: value,` lines, so keep one key per line and keys unique across sections.
- Keep the bot players. They are the offline fallback, the load-test clients, and the balance harness.

## Reliability

- **Reconnect:** each phone stores a token in localStorage. On reconnect, it reclaims its shop.
- **Wake Lock** on phones during play (tolerate rejection).
- **Dropped phones:** idle shutters close their shop automatically. No special handling needed in the game rules.
- **Network dies:** the screen fills the town with bots and the presenter plays with the keyboard. The pitch survives.
- **Cold starts:** warm the server before going on stage.

## Testing

- **Simulation:** unit tests on the rules (each row of the movement table), invariants after every tick (every shop indexed exactly once), and golden replays (same seed + inputs produce the same result).
- **Balance:** a headless bench that runs hundreds of bot rounds and reports income by strategy (see `reference/bench.js`).
- **Load:** scripted fake phones (50+) against a deployed room.
- **Rehearsal:** a small in-person session with real phones on cellular data.

## Join flow details

- QR on screen, short URL as a backup.
- Business name field pre-filled with a funny suggestion; profanity filter; truncate long names; fall back to "Shop #7".
- Pick from 4 designs drawn at random from a larger pool. Designs are a static facade sprite plus one shared procedural leg rig, so adding designs costs one image each.
- Each player gets a unique tint on top of the design.

## Ending

- Contact card on every phone: site, LinkedIn, **Save contact (vCard)**, shareable image of their shop, and a permanent URL that works after the session ends.
