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
- **Tiny payloads.** Phones send input changes only (`-1 | 0 | 1` with a sequence number), not a stream. The screen sends each phone a small state packet when it changes, checked a few times a second and batched into one message (phase, score, rank, closed/open, tint, and the last input seq the sim has read).
- **The protocol** lives in `packages/net/src/protocol.ts`; the relay and both apps parse every message with it. Connections name their role in the URL (`?role=screen|phone`), and a phone's connection id is its reconnect token.
- **One screen per room.** The first screen to open a room stores a key with it; a screen without that key is refused, so a phone can't pose as the screen. A reloaded screen (same key) replaces the old one. Refusals arrive as a `refused` message before the close, because a hibernating Durable Object's close code doesn't always reach the client.
- **The screen's `Host`** (`packages/net/src/host.ts`) owns the game and seats phones: it opens on the lobby, where each phone that joins gets a shop; `begin` starts the round and `replay` goes back to the lobby, where phones that joined during the round get theirs. A phone that drops keeps its shop.
- **Taps are latched.** Inputs are events, but the sim reads a direction per tick, so each controller (keyboard or phone) goes through a `Latch`: a press released before the tick reads it still counts once.
- **Latency tolerance is built into the rules.** Grid moves, steps that finish on their own, push times of ~0.9s and crossings of ~2.5s all absorb 100–300 ms of venue cellular.

## Stack

- **Vite + React + TypeScript** for both the screen app and the phone app. npm workspaces: `packages/sim`, `packages/render`, `packages/screen`, `packages/phone`, `packages/net`, `packages/server`. Vitest for tests; Node runs the bench's TypeScript directly (no build step).
- **Rendering:** Canvas 2D, grown from the prototype's renderer, in its own package (`packages/render`) so the phone draws shops with the same code. It only reads the game state: a `StreetView` eases each shop toward its grid position and turns each tick's sim events into animation (topple arcs, coins, callouts, shoppers walking away). The street is pixel art: everything is drawn in art pixels on a fixed grid per cell, then scaled up by the largest factor that fits (see "Look" in `GAME_DESIGN.md`). Shops are drawn from parts into cached sprites and placed with their lean, spin and squash; people are pixel maps. Visual-only constants live in `render/src/look.ts` and the daylight palette in `render/src/colors.ts`; gameplay numbers always come from the sim config. The HUD keeps its CSS theme tokens, with a dark theme; the street is always daytime.
- **Server:** Cloudflare Durable Objects with **PartyServer** (not the hosted PartyKit platform, which stopped taking deployments on Oct 23, 2026). The free plan covers this load: incoming WebSocket messages bill as one request per 20, outgoing are free, and a hibernating room isn't billed for idle time. The free plan only allows SQLite-backed Durable Objects, which is how `wrangler.jsonc` declares the room.

## Simulation

- `packages/sim` is a **pure, deterministic module** ported from `reference/sim.js`: `step(state, inputs, dt)` at a fixed `TICK`, seeded RNG, no DOM, no timers. Its tsconfig has no DOM or Node types, so it can't reach for them.
- **State is plain data.** Columns hold shop indices, RNG state is a number, and `step` returns the tick's events (topple, bump, pushback, closed, reopened, paid, lost) instead of keeping effects in the state. A JSON round trip of the state carries on identically.
- **Two RNG streams:** world (placement, movement order, waves, trickle, parachuters) and bots. Human input can't change where customers appear.
- **Inputs** are the held direction per human shop id. `setController` hands a shop between a phone and a bot mid-round (the network-down fallback).
- **Config:** every tunable lives in `packages/sim/src/config.ts`, in named sections (`export const WAVES = { … }`). The game holds the config by reference, so the screen's tuning panel (Tweakpane, hidden until `T`) edits it live; sections read at round start (street size, bot mix) apply on restart (`R`). In dev, **Save to config.ts** posts the values to a Vite middleware (`packages/screen/tools/saveTuningPlugin.ts`) that rewrites the `key: value,` lines, so keep one key per line and keys unique across sections.
- Keep the bot players. They are the offline fallback, the load-test clients, and the balance harness.

## Reliability

- **Reconnect:** each phone stores a token in localStorage. On reconnect, it reclaims its shop and resends what it holds. Sequence numbers start from the clock, so they stay ahead after a reload. A phone briefly holding two sockets (reconnected before the old one closed) gets its state on both, and only counts as gone when the last one closes.
- **Wake Lock** on phones during play (tolerate rejection; it needs https, so not on the LAN dev server).
- **Dropped phones:** idle shutters close their shop automatically. No special handling needed in the game rules.
- **Network dies:** once the screen has been cut off from the relay for `NET.fallbackAfter` seconds mid-round, bots take over the phones' shops (the HUD says BOTS PLAYING) and hand them back when the relay returns; `F` does the same by hand. The presenter can still play with the keyboard (`?screenShop`). The pitch survives.
- **Cold starts:** warm the server before going on stage.

## Testing

- **Simulation:** unit tests on the rules (each row of the movement table), invariants after every tick (every shop indexed exactly once), and golden replays (same seed + inputs produce the same result).
- **Balance:** a headless bench that runs hundreds of bot rounds and reports income by strategy (see `reference/bench.js`).
- **Load:** `npm run loadtest` runs the real `Host` headless as the screen plus scripted fake phones (50 by default) through a relay, and reports seating and input-to-ack latency. Point it at a deployed room with `-- --host`.
- **Rehearsal:** `npm run bots -- --room CODE` joins the room a real screen is hosting with bot phones (20 by default), so a few real phones play in a full room. They trickle in, type short names, play at random, sometimes look away long enough to close, and a few edit their shop in the lobby; `--flaky` drops and reconnects them now and then. Their ids come from the room and their number, so a rerun reclaims the same shops.
- **Rehearsal:** a small in-person session with real phones on cellular data.

## Join flow details

The design is in `GAME_DESIGN.md` ("Flow" and "Phone"). Planned build:

- **Sim (done, `packages/sim/src/lobby.ts`):** `createLobby` starts an empty street in lobby mode (movement rules only: no customers, round end, scoring or shutters). `addShop` drops a shop into a random empty column, widening the street at its right edge once it passes `minPlayers`; `removeShop` takes one off. `beginRound` fills the widest empty gaps with bots up to `minPlayers` and starts the round from the lobby's street, rebasing the clock to zero (walk start times shift with it, so who walked first still holds). `toLobby` sends the bots away for a replay.
- **Shared shop art (done):** the whole renderer is `packages/render`, which the phone also draws with, so the phone's preview is pixel for pixel what the screen shows, and `nameFits` tells the phone when a name would be cut off.
- **Looks (done):** each shop carries a `look` (shop type and color slot) in the game state; the sim never reads it. The `Host` gives a phone its color slot when it first connects, so the preview is in its color: the slot fewest shops wear, and never one already worn by the same type while another is free.
- **Protocol (done):** the phone sends a `profile` (name, shop type) to open its shop, and again for each confirmed edit in the lobby; the relay cleans the name and checks its length. A phone that sends one during a round waits and drops in at the next lobby. The phone keeps its draft in localStorage, beside the reconnect token.
- **Screen (done, except the list):** title and QR (short URL underneath) over the lobby, `Enter` or a Begin button, and new shops dropping from the sky. A phone that joins during a round waits for the next lobby; a reconnecting phone still gets its shop back. Still to do: the presenter list.

## Ending

- Contact card on every phone: site, LinkedIn, **Save contact (vCard)**, shareable image of their shop, and a permanent URL that works after the session ends.
