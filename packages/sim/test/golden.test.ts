import { expect, it } from 'vitest';
import { botPlayers, createGame, makeConfig, step, type Dir, type GameState } from '../src/index.ts';

// Any change to a rule, a tunable default or RNG use changes this table. If the change is intended, review the new
// table and update the snapshot (npx vitest run -u)
const SEED = 2026;
const DECIMALS = 2;

// Two scripted phones: P1 sweeps back and forth, P2 taps now and then (each tap a step), then joins the push in phase 2
function inputs(g: GameState): Record<string, Dir> {
  const sweep = Math.floor(g.t / 3) % 2 ? -1 : 1;
  const tap = Math.floor(g.t * 2) % 16 === 0 ? 1 : 0;
  return { P1: g.t % 4 < 2.5 ? sweep : 0, P2: g.t < g.config.ROUND.paraStart ? tap : sweep };
}

it('replays a fixed seed and inputs to a fixed score table', () => {
  const players = [
    { id: 'P1', label: 'P1', controller: 'human' as const },
    { id: 'P2', label: 'P2', controller: 'human' as const },
    ...botPlayers(),
  ];
  const g = createGame(makeConfig(), players, SEED);
  while (!g.over) step(g, inputs(g));
  const table = g.shops.map((s) => `${s.label} ${s.income.toFixed(DECIMALS)}`);
  expect({ table, topples: g.stats.topples, lost: g.stats.lost }).toMatchInlineSnapshot(`
    {
      "lost": 127,
      "table": [
        "P1 195.00",
        "P2 225.00",
        "N1 205.00",
        "N2 295.00",
        "N3 215.00",
        "N4 220.00",
        "N5 260.00",
        "C1 160.00",
        "C2 125.00",
        "C3 140.00",
        "C4 195.00",
        "A1 55.00",
        "A2 60.00",
        "R1 230.00",
        "R2 135.00",
        "S1 0.00",
        "S2 10.00",
      ],
      "topples": 16,
    }
  `);
});
