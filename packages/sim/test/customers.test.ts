import { describe, expect, it } from 'vitest';
import { entryShop, telegraphBars, TICK, type GameState } from '../src/index.ts';
import { NEVER, ofType, run, shop, street } from './helpers.ts';

// A shopper that has finished crossing and stands at column c
function arrive(g: GameState, c: number): void {
  const { WALK_INS } = g.config;
  g.shoppers.push({ x: c, origin: c, rise: 0, cross: WALK_INS.crossTime, life: WALK_INS.shopperLife });
}

function dropParachuter(g: GameState, c: number, y: number): void {
  g.paras.push({ x: c, y, vx: 0 });
}

// Shutters on, so a test can close a shop by making it idle
const SHUTTERS = { IDLE: { idleOn: true } };
// Phase 2 from the start, with no random parachuters
const PHASE2 = { ROUND: { paraStart: 0 } };

function closeNow(g: GameState, id: string): void {
  shop(g, id).idleT = NEVER;
  run(g, TICK);
}

describe('walk-ins', () => {
  it('enter the open sitting shop in front of them', () => {
    const g = street([['A']]);
    arrive(g, 0);
    const paid = ofType(run(g, 0.1), 'paid');
    expect(paid).toEqual([{ type: 'paid', shop: 'A', value: g.config.SCORING.phase1Weight, kind: 'ground' }]);
  });

  it('go upstairs past a closed shop to the lowest open one', () => {
    const g = street([['A', 'B']], SHUTTERS);
    closeNow(g, 'A');
    expect(shop(g, 'A').closed).toBe(true);
    expect(entryShop(g, 0)).toBe(shop(g, 'B'));
    arrive(g, 0);
    expect(ofType(run(g, 0.1), 'paid').map((e) => e.shop)).toEqual(['B']);
  });

  it('skip a walking shop (they walk under its legs), and its riders too, then leave', () => {
    // A leans into the wall, standing on its legs, carrying B
    const g = street([['A', 'B']]);
    run(g, 0.3, { A: 1 });
    expect(shop(g, 'A').walking).toBe(true);
    arrive(g, 0);
    const events = run(g, 0.1, { A: 1 });
    expect(ofType(events, 'paid')).toHaveLength(0);
    expect(ofType(events, 'lost')).toHaveLength(1);
    expect(g.stats.lost).toBe(1);
  });

  it('take crossTime to cross before entering', () => {
    const g = street([['A'], [], [], []], { WAVES: { firstWave: 0, waveSize: 1, waveWidth: 1, waveLines: 1, waveLineInterval: 0.1 } });
    const { crossTime } = g.config.WALK_INS;
    // Telegraph, then the one shopper steps off somewhere; follow it
    run(g, 0.2);
    expect(g.wave.state).not.toBe('telegraph');
    expect(g.shoppers).toHaveLength(1);
    // Nobody arrives while crossing; then the shopper either enters A or leaves
    const resolved = () => g.stats.lost + (shop(g, 'A').incGround > 0 ? 1 : 0);
    run(g, crossTime * 0.9);
    expect(resolved()).toBe(0);
    run(g, crossTime * 0.2);
    expect(resolved()).toBe(1);
  });
});

describe('crosswalk telegraph', () => {
  it('draws one bar per waveLineInterval, and the wave steps off with the last bar', () => {
    const g = street([['A'], [], [], [], [], [], [], []], { WAVES: { firstWave: 0 } });
    const { waveLines, waveLineInterval, waveWidth } = g.config.WAVES;
    run(g, TICK);
    expect(g.wave.state).toBe('telegraph');
    expect(telegraphBars(g)).toBe(0);
    const start = g.wave.start;
    const bars: number[] = [];
    while (g.wave.state === 'telegraph') {
      bars.push(telegraphBars(g));
      expect(g.shoppers).toHaveLength(0);
      run(g, TICK);
    }
    expect(Math.abs(g.t - start - waveLines * waveLineInterval)).toBeLessThanOrEqual(TICK);
    // Every bar count from none to all but the last showed, in order
    expect([...new Set(bars)]).toEqual(Array.from({ length: waveLines }, (_, i) => i));
    expect(g.wave.state).toBe('active');
    expect(telegraphBars(g)).toBe(waveLines);
    run(g, 0.5);
    expect(g.shoppers.length).toBeGreaterThan(0);
    for (const sh of g.shoppers) {
      expect(sh.origin).toBeGreaterThanOrEqual(g.wave.col0);
      expect(sh.origin).toBeLessThan(g.wave.col0 + waveWidth);
    }
  });

  it('moves each new crosswalk at least one width from the last', () => {
    const g = street([['A'], ...Array.from({ length: 17 }, () => [])], { WAVES: { firstWave: 0 } });
    const { waveWidth } = g.config.WAVES;
    const placed: number[] = [];
    // Two minutes: several wave cycles
    const ticks = Math.round(120 / TICK);
    for (let i = 0; i < ticks; i++) {
      const was = g.wave.state;
      run(g, TICK);
      if (was === 'pause' && g.wave.state === 'telegraph') placed.push(g.wave.col0);
    }
    expect(placed.length).toBeGreaterThan(5);
    for (let i = 1; i < placed.length; i++) expect(Math.abs(placed[i] - placed[i - 1])).toBeGreaterThanOrEqual(waveWidth);
  });
});

describe('parachuters', () => {
  it('enter the first open shop they touch, from the top', () => {
    const g = street([['A', 'B']], PHASE2);
    dropParachuter(g, 0, 2.5);
    const paid = ofType(run(g, 1), 'paid');
    expect(paid).toEqual([{ type: 'paid', shop: 'B', value: g.config.SCORING.paraValue, kind: 'para' }]);
  });

  it('pass a closed top shop to the open one below', () => {
    const g = street([['A', 'B']], { ...PHASE2, ...SHUTTERS });
    closeNow(g, 'B');
    dropParachuter(g, 0, 2.5);
    expect(ofType(run(g, 1), 'paid').map((e) => e.shop)).toEqual(['A']);
  });

  it('land on the sidewalk and walk when every shop in the column is closed', () => {
    const g = street([['A'], []], { ...PHASE2, ...SHUTTERS });
    closeNow(g, 'A');
    dropParachuter(g, 0, 1.5);
    const events = run(g, 1);
    expect(ofType(events, 'paid')).toHaveLength(0);
    expect(g.stats.spawned).toBe(1);
  });

  it('are caught higher by a walking shop: it stands walkLift taller', () => {
    const height = 1.8;
    const sitting = street([['A']], PHASE2);
    dropParachuter(sitting, 0, height);
    expect(ofType(run(sitting, 0.1), 'paid')).toHaveLength(0);

    const walking = street([['A']], PHASE2);
    run(walking, 0.3, { A: 1 });
    dropParachuter(walking, 0, height);
    expect(ofType(run(walking, 0.1, { A: 1 }), 'paid')).toHaveLength(1);
  });

  it('become walk-ins when they reach an empty street', () => {
    const g = street([[], ['A']], PHASE2);
    dropParachuter(g, 0, 0.5);
    run(g, 1);
    expect(g.stats.spawned).toBe(1);
    expect(g.stats.lost).toBe(1);
  });
});

describe('scoring', () => {
  it('weights phase 1 earnings and pays parachuters paraValue', () => {
    const g = street([['A']], { ROUND: { paraStart: 1 } });
    const { phase1Weight, paraValue } = g.config.SCORING;
    arrive(g, 0);
    run(g, 0.1);
    expect(shop(g, 'A').income).toBeCloseTo(phase1Weight);
    run(g, 1);
    arrive(g, 0);
    run(g, 0.1);
    expect(shop(g, 'A').income).toBeCloseTo(phase1Weight + 1);
    dropParachuter(g, 0, 1.2);
    run(g, 0.5);
    expect(shop(g, 'A').incPara).toBeCloseTo(paraValue);
  });
});
