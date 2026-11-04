import { PALETTE, washOut, type Washed } from './colors.ts';
import { lane, PARA_TALL, PERSON_ROWS, sidewalkFeet } from './drawPeople.ts';
import { colX, device, floorY, type Layout } from './layout.ts';
import { FX_LOOK, GRID, TAU } from './look.ts';
import { Pix } from './pix.ts';
import { crispPx } from './signs.ts';
import { BANNERS, lifetime, type Banner, type CalloutColor, type StreetView } from './view.ts';

const CALLOUT_COLORS: Record<CalloutColor, string> = { danger: PALETTE.danger, ok: PALETTE.ok, muted: PALETTE.grey };
// The countdown goes amber to green, like a starting light
const BANNER_COLORS: Record<Banner, string> = { ready: PALETTE.yellow, go: PALETTE.ok, phase2: PALETTE.blue };

/** The wash keyframe to draw, 0 at full strength: steps through every keyframe over the last `span` before `left` runs out. */
function washStep(left: number, span: number): number {
  const n = FX_LOOK.wash.length;
  return left >= span ? 0 : n - Math.floor((left / span) * n);
}

/** Full strength, then washing out over the end of its life. u runs 0 to 1. */
function fadeOut(u: number): number {
  return washStep(1 - u, 1 - FX_LOOK.fadeHold);
}

// Text is measured at this size, then scaled to fit
const MEASURE_PX = 100;

function font(px: number, family: string = FX_LOOK.displayFont): string {
  return `${px}px ${family}`;
}

/** Text centered on device x with its baseline at device y (whole pixels, so the font's pixels land on the device's), outlined by a stroke of `line` device pixels. */
function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, line: number, join: CanvasLineJoin, w: Washed, family?: string): void {
  ctx.save();
  ctx.font = font(px, family);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = join;
  ctx.lineWidth = line;
  ctx.strokeStyle = w.outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = w.fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/**
 * A banner centered on device (x, y) in title type, with a rounded outline. Every banner is set at one size, the one
 * where the widest of them spans `width` device pixels, so the countdown and phase 2 read as a set whatever their words.
 */
function title(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, w: Washed): void {
  const { bannerFont, bannerGrid } = FX_LOOK;
  ctx.font = font(MEASURE_PX, bannerFont);
  const widest = Math.max(...Object.values(BANNERS).map((b) => ctx.measureText(b.text).width));
  const px = crispPx((MEASURE_PX * width) / widest, Math.floor, bannerGrid);
  const m = ctx.measureText(text);
  // Centered on its capitals
  const mid = ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 / MEASURE_PX) * px;
  outlined(ctx, text, Math.round(x), Math.round(y + mid), px, px * FX_LOOK.titleOutline, 'round', w, bannerFont);
}

/** Small text standing on art (x, y): capitals `cap` art pixels tall in a square ring `ring` art pixels thick. */
function small(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, y: number, cap: number, ring: number, w: Washed): void {
  ctx.font = font(MEASURE_PX);
  const px = crispPx((MEASURE_PX * cap * L.P) / ctx.measureText(text).actualBoundingBoxAscent, Math.round);
  const [dx, dy] = device(L, x, y);
  // The stroke is centered on the glyph edge, so it is twice the ring
  outlined(ctx, text, Math.round(dx), Math.round(dy), px, 2 * ring * L.P, 'miter', w);
}

/** Callouts, coins and the phase banner in display type, bump bursts in art pixels. Leavers and buyers are drawn with the people. */
export function drawEffects(ctx: CanvasRenderingContext2D, view: StreetView, L: Layout): void {
  const look = FX_LOOK;
  const px = new Pix(ctx, L.P, L.ox, L.groundY);
  for (const e of view.effects) {
    switch (e.kind) {
      case 'callout': {
        const u = e.age / look.calloutTime;
        const w = washOut(CALLOUT_COLORS[e.color], fadeOut(u));
        small(ctx, L, e.text, colX(e.x), floorY(e.y + u * look.calloutRise), look.calloutCap, look.calloutRing, w);
        break;
      }
      case 'coin': {
        const u = e.age / look.coinTime;
        const w = washOut(PALETTE.yellow, fadeOut(u));
        const x = e.shopper === null ? e.x : e.x + lane(e.shopper);
        const head = e.shopper === null ? floorY(e.y) - PARA_TALL : sidewalkFeet(L) - PERSON_ROWS;
        const y = head - look.coinAbove + floorY(u * look.coinRise);
        small(ctx, L, e.text, colX(x), y, look.coinCap, look.coinRing, w);
        break;
      }
      case 'burst': {
        const u = e.age / look.burstTime;
        const x = colX(e.x);
        const y = floorY(e.y);
        const len = look.burstSize * GRID.cellW;
        const inner = len * look.burstStart;
        const outer = len * (look.burstStart + (1 - look.burstStart) * u);
        const ray = washOut(PALETTE.accent, fadeOut(u)).fill;
        for (let k = 0; k < look.burstRays; k++) {
          const ang = (k * TAU) / look.burstRays;
          px.line(x + Math.cos(ang) * inner, y + Math.sin(ang) * inner, x + Math.cos(ang) * outer, y + Math.sin(ang) * outer, ray);
        }
        break;
      }
      case 'banner': {
        const u = e.age / lifetime(e);
        // Washes in and out through the same keyframes
        const w = washOut(BANNER_COLORS[e.banner], washStep(Math.min(u, 1 - u), look.bannerFade));
        const [x, y] = device(L, L.gridW / 2, L.top / 2);
        title(ctx, BANNERS[e.banner].text, x, y, L.gridW * look.bannerWidth * L.P, w);
        break;
      }
      case 'leaver':
      case 'buyer':
        break;
    }
  }
}
