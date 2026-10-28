import { parachuteSky, TICK, type GameState, type SimEvent } from '@walking-shops/sim';
import { describe, expect, it } from 'vitest';
import { run, shop, street } from '../../sim/test/helpers.ts';
import { floorsNeeded, layoutStreet } from '../src/render/layout.ts';
import { PEOPLE_LOOK } from '../src/render/look.ts';
import { strainsByColumn } from '../src/render/strain.ts';
import { PHASE2_BANNER, StreetView } from '../src/render/view.ts';

// Long enough for any eased motion to settle
const SETTLE = 2;
// Close enough to the grid position after settling, in columns or floors
const NEAR = 0.01;

/** Advance the sim and the view together, as the screen loop does, one frame per tick. */
function play(g: GameState, view: StreetView, seconds: number, inputs = {}): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds / TICK); i++) {
    const ev = run(g, TICK, inputs);
    view.onEvents(g, ev);
    view.update(g, TICK);
    events.push(...ev);
  }
  return events;
}

// A pushes the tower in column 1; B stays, C and D fall into column 2
const TOWER = [['A'], ['B', 'C', 'D'], []];

describe('strain', () => {
  it('marks the pushed part of a tower, how far along the push is, and its fall side', () => {
    const g = street(TOWER);
    run(g, g.config.MOVEMENT.pushTime / 2, { A: 1 });
    const st = strainsByColumn(g).get(1);
    expect(st).toMatchObject({ level: 1, dir: 1 });
    expect(st!.amount).toBeGreaterThan(0);
    expect(st!.amount).toBeLessThan(1);
    expect(strainsByColumn(g).size).toBe(1);
  });
});

describe('topple arcs', () => {
  it('fly the fallen shops up and over, then land them on their new place', () => {
    const g = street(TOWER);
    const view = new StreetView();
    view.reset(g);
    let toppled = false;
    for (let i = 0; i < Math.round(SETTLE / TICK) && !toppled; i++) {
      toppled = play(g, view, TICK, { A: 1 }).some((e) => e.type === 'topple');
    }
    expect(toppled).toBe(true);
    expect(view.anim(shop(g, 'C')).arc).not.toBeNull();
    let peak = 0;
    for (let i = 0; i < Math.round(SETTLE / TICK); i++) {
      play(g, view, TICK);
      peak = Math.max(peak, view.anim(shop(g, 'C')).y);
    }
    for (const id of ['C', 'D']) {
      const s = shop(g, id);
      const a = view.anim(s);
      expect(a.arc).toBeNull();
      expect(s.col).toBe(2);
      expect(Math.abs(a.x - s.col)).toBeLessThan(NEAR);
      expect(Math.abs(a.y - s.level)).toBeLessThan(NEAR);
    }
    // C left floor 1 and landed on floor 0: the arc took it above both
    expect(peak).toBeGreaterThan(1);
  });
});

describe('view', () => {
  it('never changes the game state', () => {
    const g = street(TOWER, { ROUND: { paraStart: 0 }, PARACHUTES: { paraRate: 60 }, WAVES: { firstWave: 0 }, WALK_INS: { trickleRate: 30 } });
    const view = new StreetView();
    view.reset(g);
    for (let i = 0; i < Math.round(SETTLE / TICK); i++) {
      const ev = run(g, TICK, { A: 1 });
      const before = JSON.stringify(g);
      view.onEvents(g, ev);
      view.update(g, TICK);
      expect(JSON.stringify(g)).toBe(before);
    }
  });

  it('walks lost shoppers back across the street, then drops them', () => {
    const g = street([['A']]);
    const view = new StreetView();
    view.reset(g);
    view.onEvents(g, [{ type: 'lost', x: 0 }]);
    expect(view.effects.filter((e) => e.kind === 'leaver')).toHaveLength(1);
    view.update(g, PEOPLE_LOOK.leaveTime);
    expect(view.effects.filter((e) => e.kind === 'leaver')).toHaveLength(0);
  });

  it('announces phase 2 once, as it starts', () => {
    const g = street([['A']], { ROUND: { paraStart: 1 } });
    const view = new StreetView();
    view.reset(g);
    const banners = () => view.effects.filter((e) => e.kind === 'banner' && e.text === PHASE2_BANNER).length;
    play(g, view, 0.5);
    expect(banners()).toBe(0);
    play(g, view, 1);
    expect(banners()).toBe(1);
  });
});

describe('layout', () => {
  it('fits the highest parachuter spawn and a walking shop on the tallest tower under the sky', () => {
    const g = street([['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'], []]);
    const floors = floorsNeeded(g);
    expect(floors).toBeGreaterThan(parachuteSky(g) + g.config.PARACHUTES.skyJitter);
    expect(floors).toBeGreaterThan(g.cols[0].length + g.config.MOVEMENT.walkLift);
    for (const [w, h] of [
      [1920, 1080],
      [1280, 1024],
      [3840, 1080],
    ]) {
      const L = layoutStreet(w, h, g.C, floors);
      expect(L.groundY - floors * L.cellH).toBeGreaterThanOrEqual(-NEAR);
      expect(L.groundY + L.streetH).toBeCloseTo(h);
      expect(L.cellW * g.C).toBeCloseTo(w);
    }
  });
});
