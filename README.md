# Walking Shops

The opening game of the Untame pitch. 10–30 people join from their phones and their businesses become walking shops on a shared street on the big screen. See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the rules, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together and [docs/MILESTONES.md](docs/MILESTONES.md) for the build order.

## Layout

| Path | What |
|---|---|
| `packages/sim` | The game simulation: pure, deterministic TypeScript. All tunables in `src/config.ts` |
| `packages/screen` | Big-screen app (Vite + React, Canvas 2D street). Hosts the room: runs the game, you play one shop from the keyboard, phones take over bots' shops |
| `packages/phone` | Phone controller (Vite + React): two tap-to-step, hold-to-walk halves in your shop's tint |
| `packages/net` | Shared networking: message protocol, the screen's `Host` (seats phones in shops), the PartySocket client, the load test |
| `packages/server` | The relay: a PartyServer Durable Object on Cloudflare, one per room. Checks and forwards; the screen is the authority |
| `reference/` | The JavaScript prototype the sim was ported from, and the pixel-art look mockup. Behavior and look to match, not code to ship |

## Commands

Needs Node 24 or later (it runs the bench's TypeScript directly).

```sh
npm install
npm test                       # rules, invariants, golden replay
npm run typecheck
npm run bench                  # income by bot type, 30 rounds per row
npm run bench -- 200           # more rounds
npm run bench:compare          # the same rows on reference/sim.js too, line by line
npm run dev                    # all three below in one terminal, with labelled output
npm run dev:server             # the relay, on port 7322 (also on the LAN)
npm run dev:screen             # http://localhost:7320
npm run dev:phone              # http://localhost:7321 (also on the LAN, for a real phone)
npm run loadtest               # a headless screen and 50 fake phones through the relay; -- --phones N --seconds S
npm run build
```

## Playing with phones (local)

Run `npm run dev` (or `dev:server`, `dev:screen` and `dev:phone` separately), then open the screen at http://localhost:7320. It opens on the lobby: the title and a QR code for the join URL (this machine's LAN address and a room code) over the street. Phones on the same Wi-Fi scan it, and each one's shop drops onto the street, ready to walk. `Enter` (or the Begin button) starts the round, with bots filling the street up to `minPlayers`; a phone that joins after that waits for the next lobby, which `R` opens. The HUD shows how many phones are connected; a green dot means the relay is reachable. A phone keeps its shop across a dropped connection or a reload.

The screen keeps its room across reloads (`?room=CODE` picks one). Over plain http on the LAN, phones can't keep the screen awake (Wake Lock needs https); the deployed version can.

Without the relay, the screen still plays offline: keyboard and bots.

## Deploying

Everything runs on Cloudflare's free plan, with no card needed. `npm run deploy:server` deploys the relay (run `npx wrangler login` once first). The screen and phone are static builds, so they can go on Cloudflare Pages, which is also free. Build the apps with `VITE_PARTY_HOST` (the relay's host, e.g. `walking-shops.<account>.workers.dev`) and, for the screen, `VITE_PHONE_URL` (where the phone app is served).

## Keys on the screen

| Key | Does |
|---|---|
| `A` / `D` or `←` / `→` | Tap to step your shop (the one signed YOU) one column, hold to keep walking or to push |
| `Space` | Pause |
| `B` | Scoreboard |
| `Enter` | Begin the round (in the lobby) |
| `T` | Tuning panel (its New street button lays the street out again) |
| `R` | Back to the lobby: the bots leave, everyone else stays put |

URL parameters for debugging: `?seed=N` replays the same round, `?at=S` skips the lobby and fast-forwards the first round to S seconds (for example `http://localhost:7320/?seed=7&at=70`).

## Tuning

On the screen app, `T` opens the tuning panel and `R` restarts the round. Edits apply to the running round on the next tick, except the `(on restart)` sections. In dev, **Save to config.ts** writes the values back into `packages/sim/src/config.ts` and reloads.

When a change affects balance, run `npm run bench` before and after and compare income by bot type. The golden replay test (`packages/sim/test/golden.test.ts`) fails on any change to a default or a rule; if the change is intended, review the new table and update it with `npx vitest run -u`.
