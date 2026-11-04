import type { Look, Shop } from '@walking-shops/sim';
import { PALETTE, type PaletteColor, type Tint } from './colors.ts';
import { GRID, SHOP_LOOK } from './look.ts';
import { Pix, scratch } from './pix.ts';

type Swatch = keyof Tint | PaletteColor;

interface Design {
  awning: 'stripes' | 'fringe' | 'cornice' | 'flap' | 'scallop' | 'drip' | 'marquee';
  // The awning's two colors: from the shop's tint or the palette
  aw: [Swatch, Swatch];
  wall: 'plain' | 'siding' | 'brick' | 'checker' | 'pilasters' | 'dots' | 'planks';
  // Where the door goes: right of the window, left of it, between two windows, or none (a serving hatch)
  front: 'right' | 'left' | 'center' | 'counter';
  window: 'crates' | 'cup' | 'loaves' | 'books' | 'flowers' | 'pole' | 'burger' | 'dresses' | 'cones' | 'records';
}

// The pool of shop designs: a few parts each, colored by the shop's tint. New designs go on the end, so a shop keeps its look
const DESIGNS: readonly Design[] = [
  { awning: 'stripes', aw: ['lo', 'cream'], wall: 'plain', front: 'left', window: 'crates' },
  { awning: 'fringe', aw: ['lo', 'cream'], wall: 'siding', front: 'right', window: 'cup' },
  { awning: 'cornice', aw: ['lo', 'cream'], wall: 'brick', front: 'right', window: 'loaves' },
  { awning: 'stripes', aw: ['hi', 'lo'], wall: 'plain', front: 'left', window: 'books' },
  { awning: 'stripes', aw: ['hi', 'cream'], wall: 'siding', front: 'right', window: 'flowers' },
  { awning: 'fringe', aw: ['hi', 'white'], wall: 'brick', front: 'right', window: 'pole' },
  { awning: 'flap', aw: ['wood', 'woodLo'], wall: 'checker', front: 'counter', window: 'burger' },
  { awning: 'scallop', aw: ['white', 'lo'], wall: 'pilasters', front: 'left', window: 'dresses' },
  { awning: 'drip', aw: ['hi', 'white'], wall: 'dots', front: 'center', window: 'cones' },
  { awning: 'marquee', aw: ['yellow', 'woodLo'], wall: 'planks', front: 'right', window: 'records' },
];

/** How many shop types there are to pick from. */
export const DESIGN_COUNT = DESIGNS.length;

/** A shop's look: its own, or (for a shop made without one) one from its place in the shop list. */
export function lookOf(s: Shop, index: number): Look {
  return s.look ?? { design: index % DESIGN_COUNT, hue: index };
}

// Siding boards and brick courses repeat every this many rows; bricks are this wide (with mortar)
const BOARD_ROWS = 3;
const BRICK_ROWS = 3;
const BRICK_W = 4;
// Polka dots: a row of dots every this many rows; planks are this wide
const DOT_ROWS = 3;
const PLANK_W = 3;
// The checkered base: squares this big, this many rows of them under the counter
const CHECK = 2;
const CHECK_ROWS = 1;
// Barber pole stripes repeat every this many pixels: red, red, white, blue
const POLE_PERIOD = 4;
const STEAM_FRAMES = 2;
// The glint goes round each record in this many steps; every this many marquee bulbs, one is lit
const RECORD_FRAMES = 4;
const BULB_FRAMES = 3;
// Window goods: rows each kind needs before it stacks a second layer
const CRATE_STACK = 6;
const STEAM_ROWS = 5;
const STEAM_HIGH = 6;
const LOAF_STACK = 6;
const LOAF_W = 3;
const LOAF_STEP = 4;
const SHELF_BREAK = 6;
const TALL_SHELF = 8;
const FRUIT_W = 2;
// Window glare: a short streak in the top corner, on glass wider than this
const GLARE_MIN = 4;
// Scallops are this wide (with the notch between them); icing runs down this far, pixel by pixel along the awning
const LOBE_W = 4;
const DRIPS = [2, 0, 1, 3, 0, 2, 1, 0, 3, 1, 0, 2, 0, 1];
// The marquee lid's props stand this far in from each end
const PROP_IN = 4;

/** Art-pixel sizes of a shop on the grid: body W×H with the roof ledge on top, so body plus roof is one floor. */
export const SHOP = (() => {
  const { cellW, cellH } = GRID;
  const L = SHOP_LOOK;
  const roof = Math.max(L.minRoof, Math.round(cellH * L.roofShare));
  const W = Math.round(cellW * L.bodyWidth);
  const H = cellH - roof;
  // A padding row above and below the name, then the shade row
  const signH = Math.max(L.minSign, Math.round(H * L.signShare)) + 2 * L.signPad;
  const awnH = Math.max(L.minAwning, Math.round(H * L.awningShare));
  const lowTop = 1 + signH + awnH;
  // The sign board, in sprite pixels (the body starts a pixel in, under the roof), and the area its name fills:
  // a pixel in from each side, between the padding rows above and below it
  const si = Math.max(1, Math.round(W * L.signInset));
  const sign = { x: 2 + si, y: roof + 1, w: W - 2 - 2 * si, h: signH };
  const name = { x: sign.x + 1, y: sign.y + L.signPad, w: sign.w - 2, h: signH - 1 - 2 * L.signPad };
  // The sprite is the roof ledge's width (a pixel past the body each side) by one floor
  return { W, H, roof, signH, awnH, lowTop, sign, name, spriteW: W + 2, spriteH: cellH, left: Math.round(-W / 2) };
})();

/** Everything that changes how a shop's sprite looks. */
export interface ShopLook {
  design: number;
  tint: Tint;
  // Shutter rows down, out of shutterRows()
  shutter: number;
  danger: boolean;
  t: number;
}

/** How many rows the shutters cover when fully down. */
export function shutterRows(): number {
  return SHOP.H - 1 - SHOP.lowTop;
}

/** Where a design's window and awning are in their animations at time t; 0 for parts that don't animate. */
interface Frames {
  window: number;
  awning: number;
}

function animFrames(design: number, t: number): Frames {
  const D = DESIGNS[design];
  const L = SHOP_LOOK;
  const step = (rate: number, frames: number) => Math.floor(t * rate) % frames;
  let window = 0;
  if (D.window === 'pole') window = step(L.poleRate, POLE_PERIOD);
  if (D.window === 'cup') window = step(L.steamRate, STEAM_FRAMES);
  if (D.window === 'records') window = step(L.recordRate, RECORD_FRAMES);
  return { window, awning: D.awning === 'marquee' ? step(L.bulbRate, BULB_FRAMES) : 0 };
}

const cache = new Map<string, OffscreenCanvas>();

/** The shop's sprite, drawn once per look and state: one floor tall, the body's left edge at x = 1. The name is drawn over it. */
export function shopSprite(o: ShopLook): OffscreenCanvas {
  const frames = animFrames(o.design, o.t);
  const key = `${o.design}|${o.tint.base}|${o.shutter}|${o.danger}|${frames.window}|${frames.awning}`;
  let cv = cache.get(key);
  if (!cv) {
    if (cache.size >= SHOP_LOOK.spriteCache) cache.clear();
    const out = scratch(null, SHOP.spriteW, SHOP.spriteH);
    drawShopArt(new Pix(out.ctx, 1), o, frames);
    cv = out.cv;
    cache.set(key, cv);
  }
  return cv;
}

function drawShopArt(px: Pix, o: ShopLook, frames: Frames): void {
  const { W, H, roof } = SHOP;
  const D = DESIGNS[o.design];
  const P = PALETTE;
  const bx = 1;
  const by = roof;
  px.r(bx - 1, 0, W + 2, roof, P.creamLo);
  if (roof > 2) px.r(bx, 1, W, 1, P.cream);
  px.r(bx - 1, 0, W + 2, 1, P.ink);
  px.r(bx - 1, 0, 1, roof, P.ink);
  px.r(bx + W, 0, 1, roof, P.ink);
  px.r(bx, by, W, H, o.tint.base);
  drawWall(px, D, bx, by, o.tint);
  drawSign(px);
  drawFront(px, D, bx, by, o.tint, frames.window);
  if (o.shutter > 0) drawShutter(px, o.shutter, bx, by);
  const edge = o.danger ? P.danger : P.ink;
  px.r(bx, by, W, 1, edge);
  px.r(bx, by + H - 1, W, 1, edge);
  px.r(bx, by, 1, H, edge);
  px.r(bx + W - 1, by, 1, H, edge);
  drawAwning(px, D, bx, by + 1 + SHOP.signH, o.tint, frames.awning);
}

function drawWall(px: Pix, D: Design, bx: number, by: number, T: Tint): void {
  const { W, H, lowTop } = SHOP;
  const y0 = by + lowTop + 1;
  const y1 = by + H - 1;
  if (D.wall === 'siding') for (let y = y0 + 1; y < y1; y += BOARD_ROWS) px.r(bx + 1, y, W - 2, 1, T.hi);
  if (D.wall === 'brick') {
    for (let y = y0; y < y1; y++) {
      const k = y - y0;
      if (k % BRICK_ROWS === BRICK_ROWS - 1) {
        px.r(bx + 1, y, W - 2, 1, T.lo);
        continue;
      }
      // Alternate courses shift by half a brick
      const shift = (Math.floor(k / BRICK_ROWS) % 2) * (BRICK_W / 2);
      for (let x = shift + 1; x < W - 1; x += BRICK_W) px.r(bx + x, y, 1, 1, T.lo);
    }
  }
  if (D.wall === 'dots') {
    for (let y = y0; y < y1; y += DOT_ROWS) {
      const shift = Math.floor((y - y0) / DOT_ROWS) % 2;
      for (let x = 1 + shift; x < W - 1; x += 2) px.r(bx + x, y, 1, 1, T.hi);
    }
  }
  if (D.wall === 'planks') for (let x = PLANK_W; x < W - 1; x += PLANK_W) px.r(bx + x, y0, 1, y1 - y0, T.lo);
  if (D.wall === 'pilasters') {
    // A column at each side of the front: a lit edge and a shaded one
    for (const x of [1, W - 3]) {
      px.r(bx + x, y0, 2, y1 - y0, T.hi);
      px.r(bx + x + 1, y0, 1, y1 - y0, T.lo);
    }
  }
  if (D.wall === 'checker') {
    // A checkered band along the base, under the counter
    const top = y1 - CHECK * CHECK_ROWS;
    for (let y = top; y < y1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const k = Math.floor((x - 1) / CHECK) + Math.floor((y - top) / CHECK);
        px.r(bx + x, y, 1, 1, k % 2 ? T.lo : PALETTE.cream);
      }
    }
  }
}

/** The blank sign board with its shade row; the name goes on at full resolution (see signs.ts). */
function drawSign(px: Pix): void {
  const { x, y, w, h } = SHOP.sign;
  px.r(x, y, w, h, PALETTE.cream);
  px.r(x, y + h - 1, w, 1, PALETTE.creamLo);
}

function drawFront(px: Pix, D: Design, bx: number, by: number, T: Tint, frame: number): void {
  const { W, H, lowTop } = SHOP;
  const L = SHOP_LOOK;
  const P = PALETTE;
  px.r(bx + 1, by + lowTop, W - 2, 1, T.lo);
  const m = Math.max(1, Math.round(W * L.frontMargin));
  const top = by + lowTop + 1;
  const bottom = by + H - 1;
  const left = bx + 1 + m;
  const right = bx + W - 1 - m;
  if (D.front === 'counter') {
    drawCounter(px, D, left, right, top, bottom - 1 - CHECK * CHECK_ROWS);
    return;
  }
  const dw = Math.max(L.minDoor, Math.round(W * L.doorShare));
  const dh = bottom - top;
  if (D.front === 'left') {
    drawDoor(px, left, top, dw, dh);
    drawWindow(px, D, left + dw + m, right, top, dh - 1, frame, 0);
    return;
  }
  if (D.front === 'center') {
    // A narrower gap beside the door, so each window keeps room for its goods
    const dx = bx + Math.floor((W - dw) / 2);
    drawDoor(px, dx, top, dw, dh);
    drawWindow(px, D, left, dx - 1, top, dh - 1, frame, 0);
    drawWindow(px, D, dx + dw + 1, right, top, dh - 1, frame, 1);
    return;
  }
  const dx = right - dw;
  drawDoor(px, dx, top, dw, dh);
  let wr = dx - m;
  if (D.window === 'pole') {
    const pw = Math.max(1, Math.round(W * L.poleShare));
    const p0 = wr - pw;
    for (let y = top + 1; y < bottom - 1; y++) {
      for (let x = 0; x < pw; x++) {
        const k = (y + x + frame) % POLE_PERIOD;
        px.r(p0 + x, y, 1, 1, k < 2 ? P.red : k === 2 ? P.white : P.blue);
      }
    }
    px.r(p0, top, pw, 1, P.ink);
    px.r(p0, bottom - 1, pw, 1, P.ink);
    wr = p0 - 1;
  }
  drawWindow(px, D, left, wr, top, dh - 1, frame, 0);
}

function drawDoor(px: Pix, dx: number, top: number, dw: number, dh: number): void {
  const L = SHOP_LOOK;
  const P = PALETTE;
  px.r(dx, top, dw, dh, P.woodLo);
  px.r(dx + 1, top + 1, dw - 2, dh - 1, P.wood);
  if (dw >= 5) px.r(dx + 2, top + 2, dw - 4, Math.max(1, Math.round(dh * L.doorGlassShare)), P.glass);
  px.r(dx + dw - 2, top + Math.floor(dh * L.knobAt), 1, 1, P.yellow);
}

/** A window from wx up to wr, wh rows tall; `slot` tells apart two windows on one front. */
function drawWindow(px: Pix, D: Design, wx: number, wr: number, top: number, wh: number, frame: number, slot: number): void {
  const P = PALETTE;
  const ww = wr - wx;
  if (ww < 3 || wh < 3) return;
  px.r(wx, top, ww, wh, P.creamLo);
  const gx = wx + 1;
  const gy = top + 1;
  const gw = ww - 2;
  const gh = wh - 2;
  px.r(gx, gy, gw, gh, P.glass);
  px.r(gx, gy + gh - 1, gw, 1, P.glassLo);
  if (gw > GLARE_MIN) {
    px.r(gx + gw - 3, gy, 2, 1, P.glassHi);
    px.r(gx + gw - 4, gy + 1, 1, 1, P.glassHi);
  }
  drawGoods(px, D.window, gx, gy, gw, gh, frame, slot);
  px.r(wx - 1, top + wh, ww + 2, 1, D.window === 'flowers' ? P.leafLo : P.cream);
}

/** No door: a serving hatch from x0 to x1, its counter on row `counter`, the goods sitting on it. */
function drawCounter(px: Pix, D: Design, x0: number, x1: number, top: number, counter: number): void {
  const P = PALETTE;
  const hw = x1 - x0;
  px.r(x0, top, hw, counter - top, P.creamLo);
  px.r(x0 + 1, top, hw - 2, counter - top, P.woodLo);
  px.r(x0 - 1, counter, hw + 2, 1, P.cream);
  drawGoods(px, D.window, x0 + 1, top, hw - 2, counter - top, 0, 0);
}

function drawGoods(px: Pix, kind: Design['window'], gx: number, gy: number, gw: number, gh: number, frame: number, slot: number): void {
  const P = PALETTE;
  const yb = gy + gh - 1;
  if (kind === 'crates') {
    const fruit = [P.red, P.yellow, P.leaf];
    px.r(gx, yb, gw, 1, P.woodLo);
    for (let x = 0; x < gw; x++) px.r(gx + x, yb - 1, 1, 1, fruit[Math.floor(x / FRUIT_W) % fruit.length]);
    if (gh >= CRATE_STACK) for (let x = 1; x < gw - 1; x += 2) px.r(gx + x, yb - 2, 1, 1, fruit[(Math.floor(x / FRUIT_W) + 1) % fruit.length]);
  } else if (kind === 'cup') {
    const cx = gx + Math.floor(gw / 2) - 1;
    px.r(cx, yb - 1, 3, 2, P.white);
    px.r(cx + 3, yb - 1, 1, 1, P.white);
    if (gh >= STEAM_ROWS) {
      px.r(cx + 1 + frame, yb - 3, 1, 1, P.white);
      if (gh >= STEAM_HIGH) px.r(cx + 2 - frame, yb - 4, 1, 1, P.white);
    }
  } else if (kind === 'loaves') {
    for (let x = 1; x + LOAF_W <= gw; x += LOAF_STEP) {
      px.r(gx + x, yb, LOAF_W, 1, P.wood);
      px.r(gx + x, yb - 1, LOAF_W, 1, P.creamLo);
    }
    if (gh >= LOAF_STACK) {
      for (let x = 3; x + LOAF_W <= gw; x += LOAF_STEP) {
        px.r(gx + x, yb - 2, LOAF_W, 1, P.wood);
        px.r(gx + x, yb - 3, LOAF_W, 1, P.creamLo);
      }
    }
  } else if (kind === 'books') {
    const spines = [P.red, P.blue, P.yellow, P.leaf, P.cream];
    for (let x = 0; x < gw; x++) {
      if ((x + 1) % SHELF_BREAK === 0) continue;
      // Spine heights vary in a fixed pattern, taller on a tall window
      const h = 1 + ((x * 7) % 3 === 0 ? 1 : 0) + (gh >= TALL_SHELF ? 1 : 0);
      px.r(gx + x, yb - h + 1, 1, h, spines[(x * 3) % spines.length]);
    }
  } else if (kind === 'flowers') {
    const petals = [P.red, P.pink, P.yellow];
    for (let x = 0; x < gw; x++) {
      px.r(gx + x, yb, 1, 1, P.leaf);
      px.r(gx + x, yb - 1, 1, 1, x % 2 === 0 ? petals[(x >> 1) % petals.length] : P.leafLo);
    }
  } else if (kind === 'burger') {
    // A burger at one end of the counter, a soda with a straw at the other, a bell between
    px.r(gx + 3, yb - 2, 4, 1, P.yellow);
    px.r(gx + 3, yb - 2, 1, 1, P.cream);
    px.r(gx + 2, yb - 1, 6, 1, P.leaf);
    px.r(gx + 2, yb, 6, 1, P.wood);
    const sx = gx + gw - 6;
    px.r(sx, yb - 2, 3, 3, P.red);
    px.r(sx + 1, yb - 2, 1, 3, P.white);
    px.r(sx + 2, yb - 4, 1, 2, P.white);
    const bell = gx + Math.floor(gw / 2) - 1;
    px.r(bell, yb, 3, 1, P.yellow);
    px.r(bell + 1, yb - 1, 1, 1, P.yellow);
  } else if (kind === 'dresses') {
    // Two dresses on stands: a dot of a neck, then a skirt that widens to the floor
    for (const [x, col] of [[gx + 2, P.red], [gx + gw - 5, P.white]] as const) {
      px.r(x + 1, yb - 3, 1, 1, P.ink);
      px.r(x + 1, yb - 2, 1, 1, col);
      px.r(x, yb - 1, 3, 1, col);
      px.r(x - 1, yb, 5, 1, col);
    }
  } else if (kind === 'cones') {
    // One cone per window, a different scoop in each
    const scoops = [P.pink, P.white];
    const cx = gx + Math.floor((gw - 3) / 2);
    px.r(cx, yb - 3, 3, 2, scoops[slot % scoops.length]);
    px.r(cx, yb - 1, 3, 1, P.wood);
    px.r(cx + 1, yb, 1, 1, P.wood);
  } else if (kind === 'records') {
    // Two round discs with colored labels; a glint goes round each rim
    const rim = [[1, 0], [3, 1], [2, 3], [0, 2]];
    const [rx, ry] = rim[frame % rim.length];
    for (const [x, label] of [[gx + 1, P.red], [gx + 6, P.yellow]] as const) {
      const y = yb - 3;
      px.r(x + 1, y, 2, 4, P.ink);
      px.r(x, y + 1, 4, 2, P.ink);
      px.r(x + 1, y + 1, 2, 2, label);
      px.r(x + rx, y + ry, 1, 1, P.greyLo);
    }
  }
}

function drawAwning(px: Pix, D: Design, bx: number, ay: number, T: Tint, frame: number): void {
  const { W, awnH: h } = SHOP;
  const P = PALETTE;
  const swatch = (k: Swatch) => (k in T ? T[k as keyof Tint] : P[k as PaletteColor]);
  const A = swatch(D.aw[0]);
  const B = swatch(D.aw[1]);
  const ax = bx - 1;
  const aw = W + 2;
  if (D.awning === 'stripes') {
    const sw = Math.max(SHOP_LOOK.minStripe, Math.round(W * SHOP_LOOK.stripeShare));
    for (let x = 0; x < aw; x++) {
      const k = Math.floor(x / sw) % 2;
      const c = k ? B : A;
      const xi = x % sw;
      px.r(ax + x, ay, 1, h - 1, c);
      // Scalloped edge: each stripe's bottom row is cut short at its sides
      if (sw >= 3 ? xi > 0 && xi < sw - 1 : k === 0) px.r(ax + x, ay + h - 1, 1, 1, c);
    }
  } else if (D.awning === 'fringe') {
    px.r(ax, ay, aw, h - 1, A);
    for (let x = 0; x < aw; x += 2) px.r(ax + x, ay + h - 1, 1, 1, B);
  } else if (D.awning === 'cornice') {
    px.r(ax, ay, aw, h - 1, T.lo);
    px.r(ax, ay, aw, 1, P.creamLo);
    for (let x = 1; x < aw; x += 2) px.r(ax + x, ay + 1, 1, 1, P.cream);
    px.r(ax, ay + h - 2, aw, 1, P.creamLo);
  } else if (D.awning === 'flap') {
    // The hatch's lid, propped open on two sticks
    px.r(ax, ay, aw, h - 2, A);
    px.r(ax, ay + h - 2, aw, 1, B);
    px.r(ax + PROP_IN, ay + h - 1, 1, 1, P.ink);
    px.r(ax + aw - 1 - PROP_IN, ay + h - 1, 1, 1, P.ink);
  } else if (D.awning === 'scallop') {
    // A valance trimmed along the top, with round lobes along its bottom
    px.r(ax, ay, aw, 1, B);
    px.r(ax, ay + 1, aw, h - 3, A);
    for (let x = 0; x < aw; x++) {
      const k = x % LOBE_W;
      px.r(ax + x, ay + h - 2, 1, 1, k < LOBE_W - 1 ? A : B);
      if (k === 1) px.r(ax + x, ay + h - 1, 1, 1, A);
    }
  } else if (D.awning === 'drip') {
    // Icing poured over the top, running down at uneven lengths
    px.r(ax, ay, aw, h - 1, A);
    px.r(ax, ay, aw, 1, B);
    for (let x = 0; x < aw; x++) {
      const d = Math.min(DRIPS[x % DRIPS.length], h - 1);
      if (d > 0) px.r(ax + x, ay + 1, 1, d, B);
    }
  } else {
    // A dark marquee lined with bulbs that chase along it, one lit in every few
    px.r(ax, ay, aw, h - 1, P.ink);
    for (let x = 1; x < aw - 1; x += 2) px.r(ax + x, ay + 1, 1, 1, ((x >> 1) + BULB_FRAMES - frame) % BULB_FRAMES === 0 ? A : B);
  }
  px.r(ax, ay, 1, h - 1, P.ink);
  px.r(ax + aw - 1, ay, 1, h - 1, P.ink);
}

function drawShutter(px: Pix, rows: number, bx: number, by: number): void {
  const { W, lowTop } = SHOP;
  const top = by + lowTop;
  px.r(bx + 1, top, W - 2, rows, PALETTE.shutter);
  for (let y = 1; y < rows; y += 2) px.r(bx + 1, top + y, W - 2, 1, PALETTE.shutterLo);
  px.r(bx + 1, top + rows - 1, W - 2, 1, PALETTE.shutterLo);
}
