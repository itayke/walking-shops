import { botUpdate } from './bots.ts';
import { TICK } from './config.ts';
import { spawnParachuters, spawnWalkIns, updateParachuters, updateShoppers } from './customers.ts';
import { updateShutters } from './idle.ts';
import { moveShop } from './movement.ts';
import { shuffle } from './rng.ts';
import { maxHeight } from './street.ts';
import type { GameState, Inputs, SimEvent } from './types.ts';

/** Advance the game one tick in place. Callers pass the fixed TICK; returns this tick's events. */
export function step(g: GameState, inputs: Inputs, dt: number = TICK): SimEvent[] {
  g.events = [];
  if (g.over) return g.events;
  const { ROUND, WALK_INS } = g.config;
  g.t += dt;
  if (g.t >= ROUND.roundTime) g.over = true;
  const phase2 = g.t >= ROUND.paraStart;

  for (const s of g.shops) {
    if (s.stunT > 0) s.stunT = Math.max(0, s.stunT - dt);
    if (s.immuneT > 0) s.immuneT = Math.max(0, s.immuneT - dt);
  }

  for (const s of g.shops) {
    if (s.controller !== 'human') botUpdate(g, s, dt);
    else {
      const v = inputs[s.id];
      s.input = v === 1 || v === -1 ? v : 0;
    }
  }
  updateShutters(g, dt);

  // Movement in a fresh random order each tick, so no shop always moves first
  for (const s of shuffle(g.shops.slice(), g.rng.world)) moveShop(g, s, dt);

  spawnWalkIns(g, dt, !phase2 || WALK_INS.groundInPhase2);
  if (phase2) spawnParachuters(g, dt);
  updateShoppers(g, dt);
  updateParachuters(g, dt);

  g.stats.maxHeight = Math.max(g.stats.maxHeight, maxHeight(g));
  for (const s of g.shops) {
    s.ticks++;
    if (s.level === 0 && !s.walking) s.sitGround++;
  }
  return g.events;
}
