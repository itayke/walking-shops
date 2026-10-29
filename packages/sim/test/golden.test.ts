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
      "lost": 148,
      "table": [
        "P1 5.00",
        "P2 90.00",
        "N1 32.40",
        "N2 41.00",
        "N3 44.40",
        "N4 50.10",
        "N5 51.80",
        "C1 36.70",
        "C2 25.20",
        "C3 29.40",
        "C4 13.90",
        "A1 15.30",
        "A2 24.30",
        "R1 43.00",
        "R2 26.50",
        "S1 0.00",
        "S2 0.60",
      ],
      "topples": 3,
    }
  `);
});
