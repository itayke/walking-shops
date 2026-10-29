import { parachuteSky, TICK, type GameState, type SimEvent } from '@walking-shops/sim';
import { describe, expect, it } from 'vitest';
import { run, shop, street } from '../../sim/test/helpers.ts';
import { colorDistance, SHIRT_SKIN_MIN, SHIRTS_FOR_SKIN, SKIN } from '../src/render/colors.ts';
import { kneeIK, legPose, strideFrame } from '../src/render/legs.ts';
import { floorsNeeded, layoutStreet } from '../src/render/layout.ts';
import { GRID, PEOPLE_LOOK, SHOP_LOOK } from '../src/render/look.ts';
import { fitLines } from '../src/render/pix.ts';
import { SHOP } from '../src/render/shopArt.ts';
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
    view.onEvents(g, [{ type: 'lost', x: 0, shopper: 0 }]);
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
      // Within a device pixel of rounding: the street on the bottom edge, the sky above it, every column across
      expect(Math.abs(L.groundY + L.streetH * L.P - h)).toBeLessThanOrEqual(1);
      expect(L.groundY - floors * GRID.cellH * L.P).toBeGreaterThanOrEqual(-1);
      expect(L.ox).toBeGreaterThanOrEqual(0);
      expect(L.ox + L.gridW * L.P).toBeLessThanOrEqual(w + 1);
      // As large as fits: either the columns or the floors fill the canvas
      const fill = Math.max((L.gridW * L.P) / w, ((floors * GRID.cellH + L.streetH) * L.P) / h);
      expect(fill).toBeCloseTo(1);
    }
  });

  it('fills each floor with one shop, so stacked shops touch', () => {
    expect(SHOP.H + SHOP.roof).toBe(GRID.cellH);
    expect(SHOP.W).toBeLessThan(GRID.cellW);
  });
});

describe('riders', () => {
  it('stand on the walker under them as its legs come up, with no lag', () => {
    const g = street([['A', 'B'], []]);
    const view = new StreetView();
    view.reset(g);
    play(g, view, SHOP_LOOK.standTime / 2, { A: 1 });
    const a = view.anim(shop(g, 'A'));
    const b = view.anim(shop(g, 'B'));
    expect(a.legs).toBeGreaterThan(0);
    expect(b.carried).toBeCloseTo(a.legs * g.config.MOVEMENT.walkLift);
  });

  it('stand up within standTime', () => {
    const g = street([['A'], []]);
    const view = new StreetView();
    view.reset(g);
    play(g, view, SHOP_LOOK.standTime + TICK, { A: 1 });
    expect(view.anim(shop(g, 'A')).legs).toBe(1);
  });
});

describe('legs', () => {
  const lift = GRID.cellH;

  it('stride forward both ways: walking left mirrors the frames walking right', () => {
    for (let f = 0; f < 4; f++) {
      const right = legPose(lift, SHOP.W, true, f, 1).feet!;
      const left = legPose(lift, SHOP.W, true, (4 - f) % 4, -1).feet!;
      expect(left.map((ft) => [-ft.dx, ft.up])).toEqual(right.map((ft) => [ft.dx, ft.up]));
    }
  });

  it('keep both segments their length, folding the knee out as the hip comes down', () => {
    const seg = GRID.cellH / 2;
    for (const hipY of [-GRID.cellH / 2, -4]) {
      for (const side of [-1, 1]) {
        const k = kneeIK(0, hipY, 0, 0, seg, side);
        expect(Math.hypot(k.x, k.y - hipY)).toBeCloseTo(seg);
        expect(Math.hypot(k.x, k.y)).toBeCloseTo(seg);
        expect(Math.sign(k.x)).toBe(side);
      }
    }
  });

  it('keep the stride frame in range left of column 0, where a leaning shop goes', () => {
    for (const x of [-0.3, -0.01, 0, 2.7]) {
      expect(strideFrame(x)).toBeGreaterThanOrEqual(0);
      expect(strideFrame(x)).toBeLessThan(4);
    }
  });

  it('plant the feet while standing up, and stride only once fully up', () => {
    const g = street([['A'], []]);
    const view = new StreetView();
    view.reset(g);
    const a = view.anim(shop(g, 'A'));
    let strode = false;
    for (let i = 0; i < Math.round(g.config.MOVEMENT.cellTime / TICK); i++) {
      play(g, view, TICK, { A: 1 });
      if (a.moving) expect(a.legs).toBe(1);
      strode ||= a.moving;
    }
    expect(strode).toBe(true);
  });

  it('are hidden while sitting', () => {
    expect(legPose(0, SHOP.W, false, 0, 1).feet).toBeNull();
  });
});

describe('signs', () => {
  it('wrap words onto lines, and end a cut-off name with a dot', () => {
    expect(fitLines('Hair Force One', 10, 2)).toEqual(['HAIR FORCE', 'ONE']);
    expect(fitLines('Espresso Yourself Today', 10, 2)).toEqual(['ESPRESSO', 'YOURSELF.']);
    expect(fitLines('Supercalifragilistics', 10, 2)).toEqual(['SUPERCALIF', 'RAGILISTI.']);
    expect(fitLines('YOU', 10, 2)).toEqual(['YOU']);
  });
});

describe('people', () => {
  it('never wear a shirt too close to their skin', () => {
    for (const [i, shirts] of SHIRTS_FOR_SKIN.entries()) {
      expect(shirts.length).toBeGreaterThan(0);
      expect(shirts.every((c) => colorDistance(c, SKIN[i]) >= SHIRT_SKIN_MIN)).toBe(true);
    }
  });
});
