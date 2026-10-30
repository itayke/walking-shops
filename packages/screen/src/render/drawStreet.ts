import { crosswalkWidth, telegraphBars, type GameState } from '@walking-shops/sim';
import { hash, PALETTE } from './colors.ts';
import type { Layout } from './layout.ts';
import { CROSSWALK_LOOK, GRID, STREET_LOOK } from './look.ts';
import { mulberry32, Pix, scratch } from './pix.ts';

const CLOUD = ['....wwww......', '..wwwwwwww.ww.', '.wwwwwwwwwwwww', 'wwwwwwwwwwwwww', 'llllllllllllll'];
const CLOUD_COLORS = { w: PALETTE.cloud, l: PALETTE.cloudLo };
// Hash multipliers that spread a pixel's x and y, so specks don't line up
const SPECK_MIX_X = 73856093;
const SPECK_MIX_Y = 19349663;
// Band edges are dithered over two rows: every other pixel, then every fourth
const DITHER = [
  [0, 2],
  [1, 4],
];

/** A static layer drawn at art resolution, redrawn only when the visible area changes. */
interface Layer {
  cv: OffscreenCanvas | null;
  key: string;
}
const skyLayer: Layer = { cv: null, key: '' };
const groundLayer: Layer = { cv: null, key: '' };

/** The visible area in whole art pixels: left, top, width, height. */
function bounds(L: Layout): [number, number, number, number] {
  const x0 = Math.floor(L.left);
  const y0 = Math.floor(L.top);
  return [x0, y0, Math.ceil(L.right) - x0, L.streetH - y0];
}

/** Draws a layer covering the visible area, from cache when it hasn't changed. */
function blitLayer(ctx: CanvasRenderingContext2D, L: Layout, layer: Layer, draw: (px: Pix, x0: number, y0: number, w: number) => void): void {
  const [x0, y0, w, h] = bounds(L);
  const key = `${x0}|${y0}|${w}|${h}`;
  if (layer.key !== key) {
    const out = scratch(layer.cv, w, h);
    draw(new Pix(out.ctx, 1, -x0, -y0), x0, y0, w);
    layer.cv = out.cv;
    layer.key = key;
  }
  const X = Math.round(L.ox + x0 * L.P);
  const Y = Math.round(L.groundY + y0 * L.P);
  ctx.drawImage(layer.cv!, X, Y, Math.round(L.ox + (x0 + w) * L.P) - X, Math.round(L.groundY + (y0 + h) * L.P) - Y);
}

export function drawStreet(ctx: CanvasRenderingContext2D, g: GameState, L: Layout, now: number): void {
  blitLayer(ctx, L, skyLayer, drawSky);
  const px = new Pix(ctx, L.P, L.ox, L.groundY);
  drawClouds(px, L, now);
  blitLayer(ctx, L, groundLayer, (p, x0, _y0, w) => {
    drawSkyline(p, x0, w);
    drawGround(p, L, x0, w);
  });
  drawCrosswalk(px, g, L, now);
}

/** Bands of sky from the top of the view down to the ground line. */
function drawSky(px: Pix, x0: number, y0: number, w: number): void {
  const bands = PALETTE.sky;
  const bh = -y0 / bands.length;
  for (let i = 0; i < bands.length; i++) {
    const a = y0 + Math.round(i * bh);
    const b = y0 + Math.round((i + 1) * bh);
    px.r(x0, a, w, b - a, bands[i]);
    if (i === 0) continue;
    for (const [row, [start, step]] of DITHER.entries()) {
      for (let x = x0 + start; x < x0 + w; x += step) px.r(x, a + row, 1, 1, bands[i - 1]);
    }
  }
}

function drawClouds(px: Pix, L: Layout, now: number): void {
  const S = STREET_LOOK;
  const cw = CLOUD[0].length;
  const span = L.right - L.left + cw * 2;
  for (let i = 0; i < S.clouds; i++) {
    const speed = S.cloudSpeed * (1 + i * S.cloudSpeedStep);
    const x = Math.round(L.left - cw + ((now * speed + i * S.cloudSpacing) % span));
    px.map(CLOUD, x, Math.round(L.top * (1 - S.cloudTop - i * S.cloudRowStep)), CLOUD_COLORS, null);
  }
}

/** Distant buildings along the ground line. They grow out from x = 0 both ways, so they keep their place as the view zooms. */
function drawSkyline(px: Pix, x0: number, w: number): void {
  const S = STREET_LOOK;
  const step = S.skylineWindowStep;
  for (const side of [1, -1]) {
    const rng = mulberry32(S.skylineSeed + side);
    for (let edge = 0; side > 0 ? edge < x0 + w : edge > x0; ) {
      const bw = Math.round(S.skylineMinW + rng() * (S.skylineMaxW - S.skylineMinW));
      const bh = Math.round((S.skylineMinH + rng() * (S.skylineMaxH - S.skylineMinH)) * GRID.cellH);
      const x = side > 0 ? edge : edge - bw;
      px.r(x, -bh, bw, bh, PALETTE.skyline);
      for (let wy = -bh + 2; wy < -2; wy += step) {
        for (let wx = x + 2; wx < x + bw - 2; wx += step) if (rng() < S.skylineWindowChance) px.r(wx, wy, 1, 1, PALETTE.skylineWin);
      }
      edge += side * (bw + (rng() < S.skylineGapChance ? 1 : 0));
    }
  }
}

/** Sidewalk with paving joints on the column grid, the curb, then asphalt with light specks. */
function drawGround(px: Pix, L: Layout, x0: number, w: number): void {
  const S = STREET_LOOK;
  const P = PALETTE;
  const sw = L.sidewalkH;
  px.r(x0, 0, w, sw, P.walk);
  px.r(x0, 0, w, 1, P.curbTop);
  const joint = Math.round(GRID.cellW * S.jointSpacing);
  const offset = Math.round(GRID.cellW * S.jointOffset);
  for (let x = offset + Math.ceil((x0 - offset) / joint) * joint; x < x0 + w; x += joint) px.r(x, 1, 1, sw - 3, P.walkLine);
  px.r(x0, sw - 2, w, 1, P.curb);
  px.r(x0, sw - 1, w, 1, P.curbLo);
  const road = L.streetH - sw;
  px.r(x0, sw, w, road, P.asphalt);
  // Specks are picked by position, so they stay put as the view zooms
  for (let y = sw + 1; y < L.streetH; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (hash(Math.imul(x, SPECK_MIX_X) ^ Math.imul(y, SPECK_MIX_Y) ^ S.speckSeed) % S.speckArea === 0) px.r(x, y, 1, 1, P.asphaltHi);
    }
  }
}

// Sim times sit on tick boundaries; this keeps float error from skipping or doubling a fade step
const STEP_EPSILON = 1e-6;

/**
 * The crosswalk telegraph: it appears empty (a blinking dashed outline), then its bars are drawn bottom to top, one
 * per waveLineInterval. The wave steps off with the last bar, and the crosswalk fades while the last shoppers cross.
 */
function drawCrosswalk(px: Pix, g: GameState, L: Layout, now: number): void {
  const W = g.wave;
  if (W.state === 'pause') return;
  const { WAVES, WALK_INS } = g.config;
  const look = CROSSWALK_LOOK;
  const ctx = px.c;
  const top = L.sidewalkH + look.inset;
  const bottom = L.streetH - look.inset;
  const x0 = W.col0 * GRID.cellW + look.inset;
  const x1 = (W.col0 + crosswalkWidth(g)) * GRID.cellW - look.inset;

  if (W.state === 'telegraph') {
    ctx.globalAlpha = Math.sin(now * look.blinkRate) > 0 ? look.blinkOn : look.blinkOff;
    const period = look.dash + look.dashGap;
    for (let x = x0; x < x1; x += period) {
      px.r(x, top, look.dash, 1, PALETTE.zebra);
      px.r(x, bottom - 1, look.dash, 1, PALETTE.zebra);
    }
    for (let y = top; y < bottom; y += period) {
      px.r(x0, y, 1, look.dash, PALETTE.zebra);
      px.r(x1 - 1, y, 1, look.dash, PALETTE.zebra);
    }
  }

  // Bars fade in one by one as they're drawn, and out together as the wave crosses, through the same stepped shades
  const step = (u: number) => Math.max(look.fadeFloor, Math.ceil(Math.min(1, u) * look.fadeSteps - STEP_EPSILON) / look.fadeSteps);
  const out = W.state === 'crossing' ? step((W.end - g.t) / Math.max(WALK_INS.crossTime, Number.EPSILON)) : 1;
  const fadeIn = Math.max(WAVES.waveLineInterval * look.fadeInShare, Number.EPSILON);
  const lines = Math.max(1, Math.floor(WAVES.waveLines));
  const slot = (bottom - top) / lines;
  const bh = Math.max(look.minBar, Math.round(slot * look.barShare));
  const drawn = telegraphBars(g);
  for (let k = 0; k < drawn; k++) {
    // Bar k is drawn once k + 1 intervals have passed since the crosswalk appeared
    const shown = g.t - W.start - (k + 1) * WAVES.waveLineInterval;
    ctx.globalAlpha = Math.min(step(Math.max(shown / fadeIn, STEP_EPSILON)), out) * look.barAlpha;
    px.r(x0 + 1, Math.round(bottom - (k + 1) * slot + (slot - bh) / 2), x1 - x0 - 2, bh, PALETTE.zebra);
  }
  ctx.globalAlpha = 1;
}
