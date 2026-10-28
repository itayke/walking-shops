# First prompt for Claude Code

Paste this into Claude Code from the repo root after copying this folder in.

---

Read CLAUDE.md, then docs/GAME_DESIGN.md, docs/ARCHITECTURE.md and docs/MILESTONES.md, then reference/README.md and reference/sim.js.

We're starting Milestone 1: the simulation core.

1. Set up a Vite + React + TypeScript monorepo-style project with three packages or folders: `sim` (pure TypeScript, no DOM), `screen` (big-screen app) and `phone` (controller app). Only `sim` gets real code in this milestone; leave the others as stubs that build.
2. Port reference/sim.js to `sim` in TypeScript, matching its behavior. Drop the rejected modes (`street`, `crosswalk` arrivals; `split`, `all` tower pay). Implement the crosswalk telegraph as bars drawn one per `waveLineInterval` (see GAME_DESIGN §7) instead of `waveAnnounce`.
3. Put every tunable in one typed config with the defaults from GAME_DESIGN §10.
4. Tests: one test per row of the movement table (§6), spring-back, bump, push-back defense, topple immunity, idle shutters (close, reopen, customers going upstairs past a closed shop), parachuters entering the first open shop from the top, and an invariant check after every tick. Add a golden replay test: a fixed seed and scripted inputs produce a fixed final score table.
5. Port the bots and reference/bench.js. Run the bench and show me a side-by-side with the reference numbers (`node reference/bench.js 30`). They should match within noise.

Before writing code, show me the folder layout and the `sim` public API you plan, and list anything in the design docs you think is ambiguous.
