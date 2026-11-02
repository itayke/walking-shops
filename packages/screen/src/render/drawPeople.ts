import type { GameState } from '@walking-shops/sim';
import { GREY_PERSON, PALETTE, personColors, washOut, type PersonColors, type Washed } from './colors.ts';
import { colX, floorY, type Layout } from './layout.ts';
import { FX_LOOK, GRID, PEOPLE_LOOK } from './look.ts';
import { Pix } from './pix.ts';
import type { StreetView } from './view.ts';

// People as pixel maps, letters keyed to PersonColors: h hair, s skin, e eyes, c clothes, p pants, f feet.
// Walk-ins cross away from the camera (back) and walk back toward it (front), on four leg frames
const PERSON = {
  front: ['.hhh.', '.sss.', '.sss.', 'ccccc', 'scccs', '.ppp.'],
  back: ['.hhh.', '.hhh.', '.hhh.', 'ccccc', 'scccs', '.ppp.'],
  legs: [
    ['.p.p.', '.p.p.', '.f.f.'],
    ['.p.p.', '.p.f.', '.f...'],
    ['.p.p.', '.p.p.', '.f.f.'],
    ['.p.p.', '.f.p.', '...f.'],
  ],
};
export const PERSON_ROWS = PERSON.front.length + PERSON.legs[0].length;
// A parachuter holds the lines with hands up beside its face, at this row of the map
const PARA = ['.hhh.', 'sssss', 'cesec', 'csssc', 'ccccc', '.ccc.', '.ppp.', '.p.p.', '.p.p.', 'f...f'];
const PARA_HAND = 1;
// The leg frame of a person standing still
const STAND = 0;

type ChuteColor = 'red' | 'white' | 'blue' | 'yellow' | 'pink' | 'leaf';
interface Chute {
  style: 'stripes' | 'center' | 'seams';
  a: ChuteColor;
  b: ChuteColor;
}
const CHUTES: readonly Chute[] = [
  { style: 'stripes', a: 'red', b: 'white' },
  { style: 'center', a: 'blue', b: 'yellow' },
  { style: 'seams', a: 'pink', b: 'white' },
  { style: 'stripes', a: 'yellow', b: 'red' },
  { style: 'center', a: 'leaf', b: 'white' },
];
// Parachuters take their looks from a different stretch of ids than walk-ins, so the two don't twin
const PARA_LOOK_SALT = 0x5bd1e995;

// Knuth's multiplicative hash: consecutive shopper ids land far apart across the lane
const LANE_HASH = 2654435761;
const UINT_RANGE = 2 ** 32;

/** A shopper's lane: a steady offset from its column's center, in columns. */
export function lane(id: number): number {
  return ((Math.imul(id, LANE_HASH) >>> 0) / UINT_RANGE - 0.5) * PEOPLE_LOOK.laneSpread;
}

/** Where shoppers' feet are on the sidewalk, in art pixels below the ground line. */
export function sidewalkFeet(L: Layout): number {
  return Math.round(L.sidewalkH * PEOPLE_LOOK.sidewalkFeet);
}

/** Every part of a person in one color. */
function solid(fill: string): PersonColors {
  return { h: fill, s: fill, e: fill, c: fill, p: fill, f: fill };
}

/** A buyer's silhouette u of the way through its life: yellow like its coin, then washing out the same way. */
function buyLook(u: number): Washed {
  const frames = FX_LOOK.wash.length + 1;
  return washOut(PALETTE.yellow, Math.min(frames - 1, Math.floor(u * frames)));
}

function drawPerson(px: Pix, view: 'front' | 'back', frame: number, cx: number, feetY: number, colors: PersonColors, outline: string): void {
  const rows = PERSON[view].concat(PERSON.legs[frame % PERSON.legs.length]);
  px.map(rows, Math.round(cx - rows[0].length / 2), Math.round(feetY) - rows.length, colors, outline);
}

/** Walk-ins crossing up from the bottom edge, then walking the sidewalk; the ones who paid, flashing out; and the ones who gave up, walking back. */
export function drawShoppers(ctx: CanvasRenderingContext2D, g: GameState, view: StreetView, L: Layout, now: number): void {
  const look = PEOPLE_LOOK;
  const px = new Pix(ctx, L.P, L.ox, L.groundY);
  const sidewalk = sidewalkFeet(L);
  const far = L.streetH + PERSON_ROWS + look.farBelow;
  const frame = (id: number) => Math.floor(now * look.stepRate + id);
  const people: { y: number; draw: () => void }[] = [];
  for (const sh of g.shoppers) {
    const across = sh.cross > 0 ? Math.max(0, sh.rise) / sh.cross : 0;
    const y = sidewalk + across * (far - sidewalk);
    people.push({ y, draw: () => drawPerson(px, 'back', frame(sh.id), colX(sh.x + lane(sh.id)), y, personColors(sh.id), PALETTE.ink) });
  }
  for (const e of view.effects) {
    if (e.kind !== 'buyer' || e.para) continue;
    const look = buyLook(e.age / PEOPLE_LOOK.buyTime);
    people.push({ y: sidewalk, draw: () => drawPerson(px, 'back', STAND, colX(e.x + lane(e.who)), sidewalk, solid(look.fill), look.outline) });
  }
  for (const e of view.effects) {
    if (e.kind !== 'leaver') continue;
    const u = e.age / look.leaveTime;
    const y = sidewalk + u * (far - sidewalk);
    people.push({
      y,
      draw: () => {
        ctx.globalAlpha = look.leaveAlpha * (1 - u * look.leaveFade);
        drawPerson(px, 'front', frame(e.shopper), colX(e.x + lane(e.shopper)), y, GREY_PERSON, PALETTE.greyLo);
        ctx.globalAlpha = 1;
      },
    });
  }
  // Nearer people overlap farther ones
  people.sort((p, q) => p.y - q.y);
  for (const p of people) p.draw();
}

/** Canopy sizes in art pixels: radius, rows, the gap down to the hands, and panel width. */
const CANOPY = (() => {
  const L = PEOPLE_LOOK;
  const R = Math.max(L.minCanopy, Math.round(GRID.cellW * L.canopyShare));
  return {
    R,
    rows: Math.max(L.minCanopyRows, Math.round(R * L.canopyRows)),
    gap: Math.round(R * L.canopyGap) + 1,
    panel: Math.max(L.minCanopyPanel, Math.round(R * L.canopyPanel)),
  };
})();

// A parachuter's height from its feet to the top of its canopy's outline
export const PARA_TALL = PARA.length + CANOPY.gap + CANOPY.rows + 1;

/** A dome of `rows` over its rim at bottomY, outlined in ink, in one of the chute patterns; or a silhouette in `look`. */
function drawCanopy(px: Pix, cx: number, bottomY: number, chute: Chute, look: Washed | null): void {
  const { R, rows: h, panel: pw } = CANOPY;
  const A = look ? look.fill : PALETTE[chute.a];
  const B = look ? look.fill : PALETTE[chute.b];
  const ink = look ? look.outline : PALETTE.ink;
  const y0 = bottomY - h;
  const halves: number[] = [];
  for (let r = 0; r < h; r++) {
    const v = (h - 1 / 2 - r) / h;
    halves.push(Math.max(1, Math.round(R * Math.sqrt(Math.max(0, 1 - v * v)))));
  }
  px.r(cx - halves[0], y0 - 1, 2 * halves[0] + 1, 1, ink);
  for (let r = 0; r < h; r++) px.r(cx - halves[r] - 1, y0 + r, 2 * halves[r] + 3, 1, ink);
  for (let r = 0; r < h; r++) {
    for (let x = -halves[r]; x <= halves[r]; x++) {
      let c = A;
      if (chute.style === 'stripes') c = Math.floor((x + R) / pw) % 2 ? B : A;
      else if (chute.style === 'center') c = Math.abs(x) <= Math.floor(pw / 2) ? B : A;
      else if (chute.style === 'seams') c = (x + R) % pw === 0 ? B : A;
      // Scalloped rim between panels
      if (r === h - 1 && (x + R) % pw === 0) c = ink;
      px.r(cx + x, y0 + r, 1, 1, c);
    }
  }
  // A glint on the dome's shoulder
  if (!look) px.r(cx - Math.ceil(halves[1] / 2), y0 + 1, 1, 1, PALETTE.white);
}

/** The canopy's sway as a step of -1, 0 or 1: it shifts sideways instead of rotating. */
function swayStep(now: number, phase: number): number {
  const L = PEOPLE_LOOK;
  return Math.max(-1, Math.min(1, Math.round(Math.sin(now * L.swayRate + phase) * L.swayGain)));
}

/** One parachuter, feet at floor y: in its own colors, or as a silhouette in `look`. */
function drawParachuter(px: Pix, x: number, y: number, id: number, now: number, look: Washed | null): void {
  const w = PARA[0].length;
  const { R } = CANOPY;
  const left = Math.round(colX(x) - w / 2);
  const top = Math.round(floorY(y)) - PARA.length;
  const rimY = top - CANOPY.gap;
  const ccx = left + Math.floor(w / 2) + swayStep(now, id) * PEOPLE_LOOK.swayShift;
  const line = look ? look.fill : PALETTE.line;
  px.line(ccx - R + 1, rimY, left, top + PARA_HAND, line);
  px.line(ccx + R - 1, rimY, left + w - 1, top + PARA_HAND, line);
  drawCanopy(px, ccx, rimY, CHUTES[id % CHUTES.length], look);
  px.map(PARA, left, top, look ? solid(look.fill) : personColors(id ^ PARA_LOOK_SALT), look ? look.outline : PALETTE.ink);
}

/** Parachuters: a canopy swaying over a person, feet at the height the sim tracks; and the ones who paid, flashing out. */
export function drawParachuters(ctx: CanvasRenderingContext2D, g: GameState, view: StreetView, L: Layout, now: number): void {
  const px = new Pix(ctx, L.P, L.ox, L.groundY);
  for (const pa of g.paras) drawParachuter(px, pa.x, pa.y, pa.id, now, null);
  for (const e of view.effects) {
    if (e.kind === 'buyer' && e.para) drawParachuter(px, e.x, e.y, e.who, now, buyLook(e.age / PEOPLE_LOOK.buyTime));
  }
}
