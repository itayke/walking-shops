# Reference prototype

Behavior to match, not code to ship.

- `sim.js`: the whole game simulation in plain JavaScript (UMD: works in Node and the browser). Pure, fixed 20 Hz tick, seeded RNG. `createGame(params)`, `step(game, dt)`, `summarize(game)`, `checkInvariants(game)`. Defaults are in `DEFAULTS` at the top.
- `sandbox.html`: the browser sandbox (cube art, keyboard play, bots, live tuning sliders, batch tests). Open it locally in a browser.
- `bench.js`: headless bot comparisons. `node reference/bench.js 30` (about 5 seconds).

## Differences from the locked design

- The crosswalk telegraph here is a dashed outline with a countdown (`waveAnnounce`). The design replaces it with 4 horizontal bars drawn one per 0.5 s, bottom to top; the wave starts when the last bar is drawn (the same 2 s, so bench numbers carry over).
- `arrivalMode` still includes the rejected `street` (drifting band) and `crosswalk` (fixed) modes, and `towerPay` still includes the rejected `split` and `all` options. They're kept for comparison only. Ship `waves` and `top`.
- Bots are simple. They react to visible shoppers and crosswalks, tap to keep shutters open, and defend towers with a delay. They don't plan.
