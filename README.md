# Walking Shops

The opening game of the Untame pitch. 10–30 people join from their phones and their businesses become walking shops on a shared street on the big screen. See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for the rules, [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together and [docs/MILESTONES.md](docs/MILESTONES.md) for the build order.

## Layout

| Path | What |
|---|---|
| `packages/sim` | The game simulation: pure, deterministic TypeScript. All tunables in `src/config.ts` |
| `packages/screen` | Big-screen app (Vite + React, Canvas 2D street). For now offline: you play one shop from the keyboard, bots play the rest |
| `packages/phone` | Phone controller (Vite + React). For now: the two hold-to-walk halves, not yet connected |
| `reference/` | The JavaScript prototype the sim was ported from. Behavior to match, not code to ship |

## Commands

Needs Node 24 or later (it runs the bench's TypeScript directly).

```sh
npm install
npm test                       # rules, invariants, golden replay
npm run typecheck
npm run bench                  # income by bot type, 30 rounds per row
npm run bench -- 200           # more rounds
npm run bench:compare          # the same rows on reference/sim.js too, line by line
npm run dev:screen             # http://localhost:7320
npm run dev:phone              # http://localhost:7321 (also on the LAN, for a real phone)
npm run build
```

## Playing the screen offline

| Key | Does |
|---|---|
| `A` / `D` or `←` / `→` | Hold to walk your shop (the one with the arrow over it) |
| `Space` | Pause |
| `B` | Scoreboard |
| `T` | Tuning panel |
| `R` | New round |

URL parameters for debugging: `?seed=N` replays the same round, `?at=S` fast-forwards the first round to S seconds (for example `http://localhost:7320/?seed=7&at=70`).

## Tuning

On the screen app, `T` opens the tuning panel and `R` restarts the round. Edits apply to the running round on the next tick, except the `(on restart)` sections. In dev, **Save to config.ts** writes the values back into `packages/sim/src/config.ts` and reloads.

When a change affects balance, run `npm run bench` before and after and compare income by bot type. The golden replay test (`packages/sim/test/golden.test.ts`) fails on any change to a default or a rule; if the change is intended, review the new table and update it with `npx vitest run -u`.
