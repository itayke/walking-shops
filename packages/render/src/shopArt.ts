import type { Look, Shop } from '@walking-shops/sim';
import { PALETTE, type PaletteColor, type Tint } from './colors.ts';
import { GRID, SHOP_LOOK } from './look.ts';
import { Pix, scratch } from './pix.ts';

type Swatch = keyof Tint | PaletteColor;

interface Design {
  awning: 'stripes' | 'fringe' | 'cornice';
  // The awning's two colors: from the shop's tint or the palette
  aw: [Swatch, Swatch];
  wall: 'plain' | 'siding' | 'brick';
  window: 'crates' | 'cup' | 'loaves' | 'books' | 'flowers' | 'pole';
}

// The pool of shop designs: a few parts each, colored by the shop's tint
const DESIGNS: readonly Design[] = [
  { awning: 'stripes', aw: ['lo', 'cream'], wall: 'plain', window: 'crates' },
  { awning: 'fringe', aw: ['lo', 'cream'], wall: 'siding', window: 'cup' },
  { awning: 'cornice', aw: ['lo', 'cream'], wall: 'brick', window: 'loaves' },
  { awning: 'stripes', aw: ['hi', 'lo'], wall: 'plain', window: 'books' },
  { awning: 'stripes', aw: ['hi', 'cream'], wall: 'siding', window: 'flowers' },
  { awning: 'fringe', aw: ['hi', 'white'], wall: 'brick', window: 'pole' },
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
// Barber pole stripes repeat every this many pixels: red, red, white, blue
const POLE_PERIOD = 4;
const STEAM_FRAMES = 2;
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

/** The animation frame a design is on at time t (the turning pole, the steaming cup); 0 when it doesn't animate. */
function animFrame(design: number, t: number): number {
  const w = DESIGNS[design].window;
  if (w === 'pole') return Math.floor(t * SHOP_LOOK.poleRate) % POLE_PERIOD;
  if (w === 'cup') return Math.floor(t * SHOP_LOOK.steamRate) % STEAM_FRAMES;
  return 0;
}

const cache = new Map<string, OffscreenCanvas>();

/** The shop's sprite, drawn once per look and state: one floor tall, the body's left edge at x = 1. The name is drawn over it. */
export function shopSprite(o: ShopLook): OffscreenCanvas {
  const frame = animFrame(o.design, o.t);
  const key = `${o.design}|${o.tint.base}|${o.shutter}|${o.danger}|${frame}`;
  let cv = cache.get(key);
  if (!cv) {
    if (cache.size >= SHOP_LOOK.spriteCache) cache.clear();
    const out = scratch(null, SHOP.spriteW, SHOP.spriteH);
    drawShopArt(new Pix(out.ctx, 1), o, frame);
    cv = out.cv;
    cache.set(key, cv);
  }
  return cv;
}

function drawShopArt(px: Pix, o: ShopLook, frame: number): void {
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
  drawFront(px, D, bx, by, o.tint, frame);
  if (o.shutter > 0) drawShutter(px, o.shutter, bx, by);
  const edge = o.danger ? P.danger : P.ink;
  px.r(bx, by, W, 1, edge);
  px.r(bx, by + H - 1, W, 1, edge);
  px.r(bx, by, 1, H, edge);
  px.r(bx + W - 1, by, 1, H, edge);
  drawAwning(px, D, bx, by + 1 + SHOP.signH, o.tint);
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
  const dw = Math.max(L.minDoor, Math.round(W * L.doorShare));
  const dx = bx + W - 1 - m - dw;
  const dh = bottom - top;
  px.r(dx, top, dw, dh, P.woodLo);
  px.r(dx + 1, top + 1, dw - 2, dh - 1, P.wood);
  if (dw >= 5) px.r(dx + 2, top + 2, dw - 4, Math.max(1, Math.round(dh * L.doorGlassShare)), P.glass);
  px.r(dx + dw - 2, top + Math.floor(dh * L.knobAt), 1, 1, P.yellow);
  const wx = bx + 1 + m;
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
  const ww = wr - wx;
  const wh = dh - 1;
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
  drawGoods(px, D.window, gx, gy, gw, gh, frame);
  px.r(wx - 1, top + wh, ww + 2, 1, D.window === 'flowers' ? P.leafLo : P.cream);
}

function drawGoods(px: Pix, kind: Design['window'], gx: number, gy: number, gw: number, gh: number, frame: number): void {
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
  }
}

function drawAwning(px: Pix, D: Design, bx: number, ay: number, T: Tint): void {
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
  } else {
    px.r(ax, ay, aw, h - 1, T.lo);
    px.r(ax, ay, aw, 1, P.creamLo);
    for (let x = 1; x < aw; x += 2) px.r(ax + x, ay + 1, 1, 1, P.cream);
    px.r(ax, ay + h - 2, aw, 1, P.creamLo);
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
