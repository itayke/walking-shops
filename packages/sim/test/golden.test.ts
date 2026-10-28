import { expect, it } from 'vitest';
import { botPlayers, createGame, makeConfig, step, type Dir, type GameState } from '../src/index.ts';

// Any change to a rule, a tunable default or RNG use changes this table. If the change is intended, review the new
// table and update the snapshot (npx vitest run -u)
const SEED = 2026;
const DECIMALS = 2;

// Two scripted phones: P1 sweeps back and forth, P2 sits and taps to stay open, then joins the push in phase 2
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
      "lost": 144,
      "table": [
        "P1 54.00",
        "P2 87.90",
        "N1 19.50",
        "N2 47.00",
        "N3 48.60",
        "N4 20.00",
        "N5 47.50",
        "C1 20.00",
        "C2 22.50",
        "C3 13.50",
        "C4 48.60",
        "A1 44.70",
        "A2 0.30",
        "R1 33.00",
        "R2 34.30",
        "S1 0.00",
        "S2 0.60",
      ],
      "topples": 4,
    }
  `);
});
