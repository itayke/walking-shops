import { describe, expect, it } from 'vitest';
import { shutterDrop, type Inputs } from '../src/index.ts';
import { column, ofType, run, runUntil, shop, street } from './helpers.ts';

const SHUTTERS = { IDLE: { idleOn: true } };

describe('idle shutters (GAME_DESIGN §8)', () => {
  it('drop over the last idleWarn seconds and close after idleTime with no input', () => {
    const g = street([['A']], SHUTTERS);
    const { idleTime, idleWarn } = g.config.IDLE;
    run(g, idleTime - idleWarn);
    expect(shutterDrop(g, shop(g, 'A'))).toBe(0);
    run(g, idleWarn / 2);
    expect(shutterDrop(g, shop(g, 'A'))).toBeCloseTo(0.5, 1);
    expect(shop(g, 'A').closed).toBe(false);
    const closedAt = runUntil(g, 'closed', {}, idleWarn);
    expect(closedAt).toBeCloseTo(idleTime, 1);
    expect(shop(g, 'A').closed).toBe(true);
    expect(shutterDrop(g, shop(g, 'A'))).toBe(1);
  });

  it('reopen on any press', () => {
    const g = street([['A'], []], SHUTTERS);
    run(g, g.config.IDLE.idleTime + 1);
    expect(shop(g, 'A').closed).toBe(true);
    const events = run(g, 0.05, { A: 1 });
    expect(ofType(events, 'reopened')).toEqual([{ type: 'reopened', shop: 'A' }]);
    expect(shop(g, 'A').closed).toBe(false);
  });

  it('let walk-ins go upstairs to a shop that climbed onto a closed one', () => {
    const g = street([['A'], ['B']], SHUTTERS);
    // A taps now and then to stay open; B never does
    run(g, g.config.IDLE.idleTime + 1, (s): Inputs => (Math.round(s.t * 10) % 50 === 0 ? { A: 1 } : {}));
    expect(shop(g, 'B').closed).toBe(true);
    expect(shop(g, 'A').closed).toBe(false);
    run(g, 0.6, { A: 1 });
    run(g, 0.5);
    expect(column(g, 1)).toEqual(['B', 'A']);
    const { WALK_INS } = g.config;
    g.shoppers.push({ x: 1, origin: 1, rise: 0, cross: WALK_INS.crossTime, life: WALK_INS.shopperLife });
    expect(ofType(run(g, 0.1), 'paid').map((e) => e.shop)).toEqual(['A']);
  });

  it('earn nothing while closed', () => {
    const g = street([['A']], SHUTTERS);
    run(g, g.config.IDLE.idleTime + 1);
    const { WALK_INS } = g.config;
    g.shoppers.push({ x: 0, origin: 0, rise: 0, cross: WALK_INS.crossTime, life: WALK_INS.shopperLife });
    const events = run(g, 0.1);
    expect(ofType(events, 'paid')).toHaveLength(0);
    expect(ofType(events, 'lost')).toHaveLength(1);
    expect(shop(g, 'A').income).toBe(0);
  });
});
