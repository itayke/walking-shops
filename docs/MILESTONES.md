# Milestones

Each milestone ends with something you can run and look at.

1. **Simulation core.** ✓ Done: tick-for-tick parity with the prototype, bench within noise. Port `reference/sim.js` to TypeScript. Rules, waves (with the bar telegraph), parachutes, idle shutters, scoring, bots. Unit tests per movement rule, invariant checks, golden replays. A headless bench script that matches the prototype's numbers within noise.
2. **Screen renderer, offline.** ✓ Done. Street, shops with legs, shutters, crosswalk bars, shoppers, parachuters, strain wobble, topple arcs. Keyboard plays one shop; bots play the rest. Debug panel with every tunable.
3. **Networking.** Local build done: relay, phone controller, reconnect, 50-phone load test (p95 input-to-ack ≈ 140 ms on a local relay). Still to do: deploy to Cloudflare, load test the deployed room, and a playtest with real phones on cellular. PartyServer room on Cloudflare. Phone controller (two halves: tap to step, hold to walk; send presses as events so a quick tap is never lost between ticks). Reconnect tokens. Fake-phone load test with 50 clients.
4. **Join flow.** QR, name entry, 4 random designs, tint, shop appears on screen as you join.
5. **Results, town hub, contact card.** Leaderboard, shops settle into Main Street, Workshop and Arcade buildings, vCard and permanent card URL.
6. **Stage readiness.** Presenter controls (start, skip, restart, bot fallback), projector readability check at 30 shops, rehearsal with real phones.
