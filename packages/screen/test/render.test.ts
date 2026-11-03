import { addShop, createLobby, makeConfig, parachuteSky, TICK, type GameState, type SimEvent } from '@walking-shops/sim';
import { describe, expect, it } from 'vitest';
import { run, shop, street } from '../../sim/test/helpers.ts';
import { colorDistance, SHIRT_SKIN_MIN, SHIRTS_FOR_SKIN, SKIN, undiesFor, type Undies } from '../src/render/colors.ts';
import { drawLegs, kneeIK, legPose, strideFrame, type LegPose } from '../src/render/legs.ts';
import { floorsNeeded, layoutStreet } from '../src/render/layout.ts';
import { FX_LOOK, GRID, LEG_LOOK, MOTION_LOOK, PEOPLE_LOOK, SHOP_LOOK, UNDIES_LOOK } from '../src/render/look.ts';
import { Pix } from '../src/render/pix.ts';
import { SHOP } from '../src/render/shopArt.ts';
import { fitLines } from '../src/render/signs.ts';
import { strainsByColumn } from '../src/render/strain.ts';
import { StreetView, type Banner } from '../src/render/view.ts';

// Long enough for any eased motion to settle
const SETTLE = 2;
// Close enough to the grid position after settling, in columns or floors
const NEAR = 0.01;

function banners(view: StreetView, banner: Banner): number {
  return view.effects.filter((e) => e.kind === 'banner' && e.banner === banner).length;
}

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
    play(g, view, 0.5);
    expect(banners(view, 'phase2')).toBe(0);
    play(g, view, 1);
    expect(banners(view, 'phase2')).toBe(1);
  });

  it('counts a round in with READY? then GO!, holding until GO!', () => {
    const g = street([['A']]);
    const view = new StreetView();
    view.reset(g, true);
    expect(view.holding).toBe(true);
    expect(banners(view, 'ready')).toBe(1);
    view.update(g, FX_LOOK.readyHold / 2);
    expect(view.holding).toBe(true);
    expect(banners(view, 'go')).toBe(0);
    view.update(g, FX_LOOK.readyHold / 2);
    expect(view.holding).toBe(false);
    expect(banners(view, 'go')).toBe(1);
    view.reset(g);
    expect(view.holding).toBe(false);
    expect(view.effects).toHaveLength(0);
  });
});

describe('joining', () => {
  it('drops a shop that joins from above the sky into its place, and leaves shops already there', () => {
    const g = createLobby(makeConfig(), 1);
    addShop(g, { id: 'A', label: 'A', controller: 'human' });
    const view = new StreetView();
    view.reset(g);
    const B = addShop(g, { id: 'B', label: 'B', controller: 'human' });
    expect(view.anim(B).y).toBeGreaterThan(view.floors);
    expect(view.anim(shop(g, 'A')).y).toBe(0);
    play(g, view, MOTION_LOOK.dropTime);
    expect(view.anim(B).drop).toBeNull();
    expect(view.anim(B).y).toBeCloseTo(B.level, 5);
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

  it('climb with the walker under them, a floor above it all the way', () => {
    const g = street([['A', 'C'], ['B'], []]);
    const view = new StreetView();
    view.reset(g);
    const a = view.anim(shop(g, 'A'));
    const c = view.anim(shop(g, 'C'));
    let climbed = false;
    for (let i = 0; i < Math.round(SETTLE / TICK); i++) {
      play(g, view, TICK, { A: 1 });
      climbed ||= a.climb !== null;
      expect(c.y - a.y).toBeCloseTo(1);
      expect(c.carried).toBeCloseTo(a.carried + a.legs * g.config.MOVEMENT.walkLift);
    }
    expect(climbed).toBe(true);
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

  /** The art pixels a pose covers, at one device pixel per art pixel, as "x,y" keys with the color last drawn there. */
  function cells(pose: LegPose, flip: boolean, undies: Undies | null = null): Map<string, string> {
    const out = new Map<string, string>();
    const ctx = {
      fillStyle: '',
      fillRect(x: number, y: number, w: number, h: number) {
        for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) out.set(`${i},${j}`, this.fillStyle);
      },
    };
    const px = new Pix(ctx as unknown as CanvasRenderingContext2D, 1);
    drawLegs(flip ? px.mirrored() : px, pose, SHOP.W, '#', undies);
    return out;
  }

  it('face left as the right-facing legs mirrored pixel for pixel, striding and climbing', () => {
    const poses = [0, 1, 2, 3].map((f) => legPose(lift, SHOP.W, true, f));
    for (const u of [0.1, 0.4, 0.7]) poses.push(legPose(lift, SHOP.W, true, 0, { u, rest: lift * (1 - u), rise: lift }));
    const undies = undiesFor('Lettuce Pray');
    for (const pose of poses) {
      const mirrored = [...cells(pose, false, undies)].map(([k, col]): [string, string] => {
        const [x, y] = k.split(',').map(Number);
        return [`${-x},${y}`, col];
      });
      expect(cells(pose, true, undies)).toEqual(new Map(mirrored));
    }
  });

  it('wear the same underwear for the same name, and a mix of them along the street', () => {
    const names = ['Knead to Know', 'Bean There', 'Novel Idea', 'Thyme Out', 'Rolling Scones', 'Petal Pushers', 'Hair Force One', 'Bloom'];
    expect(names.map(undiesFor)).toEqual(names.map(undiesFor));
    const looks = new Set(names.map((n) => JSON.stringify(undiesFor(n))));
    expect(looks.size).toBeGreaterThan(names.length / 2);
    expect(new Set(names.map((n) => undiesFor(n).print)).size).toBe(2);
  });

  it('keep the underwear off the ground while standing up, and over the tops of the legs', () => {
    const undies = undiesFor('Bean There');
    for (let raise = LEG_LOOK.minLift; raise <= lift; raise++) {
      const drawn = cells(legPose(raise, SHOP.W, false, 0), false, undies);
      for (const [k, col] of drawn) {
        if (col === undies.base) expect(Number(k.split(',')[1])).toBeLessThan(-UNDIES_LOOK.groundGap + 1);
      }
    }
    const standing = cells(legPose(lift, SHOP.W, false, 0), false, undies);
    // The hips are covered by the shorts
    const hip = Math.round(SHOP.W * LEG_LOOK.hipSpread);
    expect(standing.get(`${hip},${-lift}`)).not.toBe('#');
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

  it('step up a floor: the front foot lifts onto the step and stays on it as the body rises', () => {
    const g = street([['A'], ['B'], []]);
    const view = new StreetView();
    view.reset(g);
    const a = view.anim(shop(g, 'A'));
    const cap = GRID.cellH * LEG_LOOK.climbFootRaise;
    let frames = 0;
    let y = a.y;
    for (let i = 0; i < Math.round(SETTLE / TICK) && (frames === 0 || a.climb); i++) {
      play(g, view, TICK, { A: 1 });
      if (!a.climb) continue;
      frames++;
      expect(a.y).toBeGreaterThanOrEqual(y);
      y = a.y;
      const rest = (a.climb.to - a.y) * GRID.cellH;
      const front = legPose(lift, SHOP.W, true, 0, { u: a.climb.u, rest, rise: GRID.cellH }).feet![1];
      expect(front.dx).toBeGreaterThanOrEqual(0);
      // Once lifted, the foot sits on the step: as high over the body's feet as the rise still ahead
      if (a.climb.u >= LEG_LOOK.climbLiftShare && rest <= cap) expect(Math.abs(front.up - rest)).toBeLessThanOrEqual(1);
    }
    expect(frames).toBeGreaterThan(0);
    expect(frames * TICK).toBeLessThanOrEqual(g.config.MOVEMENT.cellTime * SHOP_LOOK.climbShare + TICK);
    expect(a.y).toBe(shop(g, 'A').level);
  });

  it('lead a climb with the front foot raised', () => {
    for (const u of [0.1, 0.4, 0.7]) {
      const [back, front] = legPose(lift, SHOP.W, true, 0, { u, rest: lift * (1 - u), rise: lift }).feet!;
      expect(front.up).toBeGreaterThan(0);
      expect(front.dx).toBeGreaterThan(0);
      expect(back.up).toBe(0);
    }
  });

  it('are hidden while sitting', () => {
    expect(legPose(0, SHOP.W, false, 0).feet).toBeNull();
  });
});

describe('signs', () => {
  it('wrap words onto lines, and end a cut-off name with a dot', () => {
    const fits = (s: string) => s.length <= 10;
    expect(fitLines('Hair Force One', fits, 2)).toEqual(['HAIR FORCE', 'ONE']);
    expect(fitLines('Espresso Yourself Today', fits, 2)).toEqual(['ESPRESSO', 'YOURSELF.']);
    expect(fitLines('Supercalifragilistics', fits, 2)).toEqual(['SUPERCALIF', 'RAGILISTI.']);
    expect(fitLines('YOU', fits, 2)).toEqual(['YOU']);
    // A sign too narrow for even one letter still ends
    expect(fitLines('AB', () => false, 2)).toEqual(['A', 'B']);
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
