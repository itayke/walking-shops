import { describe, expect, it } from 'vitest';
import { classify } from '../src/index.ts';
import { column, ofType, run, runUntil, shop, street } from './helpers.ts';

// Long enough to cross a cell and settle
const WALK = 0.6;
// Comfortably past pushTime
const LONG_PUSH = 1.5;

describe('movement table (GAME_DESIGN §6)', () => {
  it('steps across into an empty column', () => {
    const g = street([['A'], []]);
    run(g, WALK, { A: 1 });
    run(g, WALK);
    expect(column(g, 1)).toEqual(['A']);
    expect(shop(g, 'A').off).toBe(0);
  });

  it('steps down when the target is below its feet', () => {
    const g = street([['B', 'A'], []]);
    run(g, WALK, { A: 1 });
    expect(column(g, 0)).toEqual(['B']);
    expect(column(g, 1)).toEqual(['A']);
  });

  it('steps across onto a column level with its feet', () => {
    const g = street([['B', 'A'], ['C']]);
    run(g, WALK, { A: 1 });
    expect(column(g, 1)).toEqual(['C', 'A']);
  });

  it('climbs a column one floor above its feet', () => {
    const g = street([['A'], ['C']]);
    expect(classify(g, shop(g, 'A'), 1).type).toBe('free');
    run(g, WALK, { A: 1 });
    expect(column(g, 1)).toEqual(['C', 'A']);
  });

  it('pushes a column two or more floors above, toppling everything above its first floor to the far side', () => {
    const g = street([['A'], ['C', 'D', 'F'], ['E']]);
    expect(classify(g, shop(g, 'A'), 1).type).toBe('push');
    const pushTime = g.config.MOVEMENT.pushTime;
    // Not yet: the push has to be sustained
    expect(ofType(run(g, pushTime / 2, { A: 1 }), 'topple')).toHaveLength(0);
    const at = runUntil(g, 'topple', { A: 1 }, LONG_PUSH);
    expect(at).not.toBeNull();
    expect(column(g, 1)).toEqual(['C']);
    expect(column(g, 2)).toEqual(['E', 'D', 'F']);
    // Fallen shops are stunned and immune
    for (const id of ['D', 'F']) {
      expect(shop(g, id).stunT).toBeGreaterThan(0);
      expect(shop(g, id).immuneT).toBeGreaterThan(g.config.MOVEMENT.immuneTime - g.config.MOVEMENT.stunTime);
    }
    // Then climbs what is left
    run(g, WALK, { A: 1 });
    expect(column(g, 1)).toEqual(['C', 'A']);
  });

  it('needs the push held for the whole pushTime: a release resets it', () => {
    const g = street([['A'], ['C', 'D'], []]);
    const part = g.config.MOVEMENT.pushTime * 0.7;
    const events = [...run(g, part, { A: 1 }), ...run(g, WALK), ...run(g, part, { A: 1 })];
    expect(ofType(events, 'topple')).toHaveLength(0);
    expect(column(g, 1)).toEqual(['C', 'D']);
  });

  it('bumps two walkers pressing toward each other at the same level: both bounce back', () => {
    const g = street([['A'], ['B']]);
    const events = run(g, 0.2, { A: 1, B: -1 });
    expect(ofType(events, 'bump')).toHaveLength(1);
    expect(column(g, 0)).toEqual(['A']);
    expect(column(g, 1)).toEqual(['B']);
    expect(shop(g, 'A').off).toBeLessThan(0);
    expect(shop(g, 'B').off).toBeGreaterThan(0);
    expect(shop(g, 'A').stunT).toBeGreaterThan(0);
    expect(shop(g, 'B').stunT).toBeGreaterThan(0);
  });

  it('waits behind a walker standing in the target column', () => {
    // B leans into the wall, so it stands on its legs
    const g = street([['A'], ['B']]);
    run(g, 0.3, { B: 1 });
    expect(shop(g, 'B').walking).toBe(true);
    expect(classify(g, shop(g, 'A'), 1).type).toBe('wait');
    run(g, WALK, { A: 1, B: 1 });
    expect(column(g, 0)).toEqual(['A']);
    // Once B sits, A climbs
    run(g, WALK, { A: 1 });
    expect(column(g, 1)).toEqual(['B', 'A']);
  });
});

describe('spring-back', () => {
  it('snaps back when released before crossing half a cell', () => {
    const g = street([['A'], []]);
    run(g, 0.15, { A: 1 });
    expect(shop(g, 'A').off).toBeGreaterThan(0);
    run(g, WALK);
    expect(column(g, 0)).toEqual(['A']);
    expect(shop(g, 'A').off).toBe(0);
    expect(shop(g, 'A').walking).toBe(false);
  });

  it('commits once past half a cell', () => {
    const g = street([['A'], []]);
    run(g, 0.3, { A: 1 });
    run(g, WALK);
    expect(column(g, 1)).toEqual(['A']);
    expect(shop(g, 'A').off).toBe(0);
  });
});

describe('push-back defense', () => {
  it('lets the pushed shop walk into its attacker: a bump that resets the push', () => {
    const g = street([['A'], ['C', 'D'], []]);
    run(g, 0.4, { A: 1 });
    expect(shop(g, 'A').pushT).toBeGreaterThan(0);
    const events = run(g, LONG_PUSH, { A: 1, D: -1 });
    expect(ofType(events, 'pushback').length).toBeGreaterThan(0);
    expect(ofType(events, 'topple')).toHaveLength(0);
    expect(column(g, 1)).toEqual(['C', 'D']);
  });
});

describe('topple immunity', () => {
  it("can't push fallen shops again until immuneTime runs out", () => {
    const g = street([['A'], ['C', 'D'], ['E'], ['F'], []]);
    expect(runUntil(g, 'topple', { A: 1 }, LONG_PUSH)).not.toBeNull();
    expect(column(g, 2)).toEqual(['E', 'D']);
    // F pushes the fallen D straight away: it just waits
    const { immuneTime, pushTime } = g.config.MOVEMENT;
    const during = run(g, immuneTime * 0.8, { F: -1 });
    expect(ofType(during, 'topple')).toHaveLength(0);
    expect(shop(g, 'F').pushT).toBe(0);
    // Then the push works
    expect(runUntil(g, 'topple', { F: -1 }, immuneTime + pushTime)).not.toBeNull();
    expect(column(g, 2)).toEqual(['E']);
  });
});

describe('edge towers', () => {
  it("can't be toppled: there's nowhere to fall", () => {
    const g = street([['C', 'D'], ['A']]);
    expect(classify(g, shop(g, 'A'), -1).type).toBe('wall');
    const events = run(g, LONG_PUSH * 2, { A: -1 });
    expect(ofType(events, 'topple')).toHaveLength(0);
    expect(column(g, 0)).toEqual(['C', 'D']);
    expect(shop(g, 'A').pushT).toBe(0);
  });
});

describe('carrying', () => {
  it('carries everything stacked on its roof; riders count as sitting', () => {
    const g = street([['A', 'B'], []]);
    run(g, 0.3, { A: 1 });
    expect(shop(g, 'B').walking).toBe(false);
    run(g, WALK);
    expect(column(g, 1)).toEqual(['A', 'B']);
  });

  it('lets a rider step off at any time', () => {
    const g = street([['A', 'B'], []]);
    run(g, WALK, { B: 1 });
    expect(column(g, 0)).toEqual(['A']);
    expect(column(g, 1)).toEqual(['B']);
  });
});
