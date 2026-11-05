import type { GameState } from '@walking-shops/sim';
import { PALETTE } from './colors.ts';
import { colX, floorY, type Layout } from './layout.ts';
import { PODIUM_LOOK } from './look.ts';
import { Pix } from './pix.ts';
import { SHOP } from './shopArt.ts';
import { standOn, type StreetView } from './view.ts';

// Each place's cap and plaque, first to third
const MEDALS = [
  { hi: PALETTE.gold, lo: PALETTE.goldLo },
  { hi: PALETTE.silver, lo: PALETTE.silverLo },
  { hi: PALETTE.bronze, lo: PALETTE.bronzeLo },
];

// The place numbers, a pixel per letter
const DIGITS = [
  ['.##.', '###.', '.##.', '.##.', '.##.', '.##.', '####'],
  ['.###.', '##.##', '...##', '..##.', '.##..', '##...', '#####'],
  ['####.', '...##', '...##', '.###.', '...##', '...##', '####.'],
];
// Every plaque is as wide as the widest number, so they match
const DIGIT_W = Math.max(...DIGITS.map((d) => d[0].length));

/** The podium's blocks, under the shops: a stack per place, dropping in from the sky when the podium goes up. */
export function drawPodium(ctx: CanvasRenderingContext2D, g: GameState, view: StreetView, L: Layout): void {
  if (!g.podium) return;
  const px = new Pix(ctx, L.P, L.ox, L.groundY);
  const { shadeW, capH, plaquePad, plaqueDrop } = PODIUM_LOOK;
  for (const [c, b] of view.blocks) {
    const place = g.podium.cols.indexOf(c);
    const medal = MEDALS[place] ?? MEDALS[MEDALS.length - 1];
    const floors = g.podium.blocks[c];
    const w = SHOP.spriteW;
    const x = Math.round(colX(c)) + SHOP.left - 1;
    const top = Math.round(floorY(b.y + standOn(g, c)));
    const h = Math.round(floorY(b.y)) - top;
    px.r(x, top, w, h, PALETTE.ink);
    px.r(x + 1, top + 1, w - 2, h - 1, PALETTE.cream);
    px.r(x + w - 1 - shadeW, top + 1, shadeW, h - 1, PALETTE.creamLo);
    // A seam between blocks
    for (let k = 1; k < floors; k++) px.r(x + 1, Math.round(floorY(b.y + k)), w - 2, 1, PALETTE.creamLo);
    px.r(x + 1, top + 1, w - 2, capH, medal.hi);
    px.r(x + 1, top + 1 + capH, w - 2, 1, medal.lo);
    // The plaque, centered on the top block
    const digit = DIGITS[place];
    if (!digit) continue;
    const pw = DIGIT_W + 2 * plaquePad;
    const ph = digit.length + 2 * plaquePad;
    const pxl = x + Math.round((w - pw) / 2);
    const pt = top + plaqueDrop + capH;
    px.r(pxl, pt, pw, ph, PALETTE.ink);
    px.r(pxl + 1, pt + 1, pw - 2, ph - 2, medal.hi);
    px.r(pxl + pw - 2, pt + 1, 1, ph - 2, medal.lo);
    px.map(digit, pxl + plaquePad + Math.floor((DIGIT_W - digit[0].length) / 2), pt + plaquePad, { '#': PALETTE.ink }, null);
  }
}
