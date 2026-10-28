# Walking Shops (Untame pitch game)

A Jackbox-style room game: 10–30 people join from their phones, their businesses become walking shops on a shared street on the big screen. It opens a pitch for Untame (games for local businesses).

## Read first

- `docs/GAME_DESIGN.md`: rules, tunables, and decisions. The movement rules, idle shutters, and scoring are **locked**. Ask before changing any of them.
- `docs/ARCHITECTURE.md`: screen-as-host, relay server, stack.
- `docs/MILESTONES.md`: build order.
- `reference/`: the working prototype. `sim.js` is the behavior to match; `sandbox.html` runs it in a browser; `bench.js` runs headless bot comparisons.

## Layout and commands

- `packages/sim` (pure sim, config in `src/config.ts`), `packages/screen` (renderer in `src/render`, visual-only constants in `src/render/look.ts`), `packages/phone`. See `README.md` for commands and keys.
- `npm test`, `npm run typecheck`, `npm run bench` (add `:compare` to run the prototype alongside).
- Config sections are rewritten line by line by the screen's save plugin: one `key: value,` per line, keys unique across sections.

## Principles

- **The big screen carries everything.** The phone is a blind controller: two halves, hold to walk. No UI that makes people look down during play.
- **Every rule must be visible.** There is no tutorial. If a rule can't be seen on screen, it doesn't belong in the game.
- **Simulation is pure and deterministic.** No DOM, timers, or `Math.random` in the sim. Seeded RNG, fixed tick, `step(state, inputs, dt)`. Rendering only reads state.
- **All tunables in one config.** Never hard-code a gameplay number in rendering or networking code.
- **Grid logic, smooth animation.** Positions are columns and stack levels. Animation interpolates. No physics engine.

## Conventions

- TypeScript strict mode. Vite + React for the screen and phone apps.
- Test every rule in the movement table, plus invariants (every shop indexed exactly once) after each tick in tests.
- When balance changes, run the bench and report income by bot type before and after.
