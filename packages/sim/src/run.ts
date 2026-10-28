import { TICK, type Config } from './config.ts';
import { createGame } from './create.ts';
import { step } from './step.ts';
import { summarize } from './summarize.ts';
import type { GameState, PlayerSpec } from './types.ts';

const NO_INPUT = {};

/** Play a whole round with no human input (bots only) and summarize it. */
export function runRound(config: Config, players: readonly PlayerSpec[], seed: number): { g: GameState; sum: ReturnType<typeof summarize> } {
  const g = createGame(config, players, seed);
  while (!g.over) step(g, NO_INPUT, TICK);
  return { g, sum: summarize(g) };
}
