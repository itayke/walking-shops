import { PALETTE, washOut, type Washed } from './colors.ts';
import { colX, device, floorY, type Layout } from './layout.ts';
import { FX_LOOK, GRID, TAU } from './look.ts';
import { Pix } from './pix.ts';
import type { CalloutColor, StreetView } from './view.ts';

const CALLOUT_COLORS: Record<CalloutColor, string> = { danger: PALETTE.danger, ok: PALETTE.ok, muted: PALETTE.grey };

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

function font(px: number): string {
  return `${px}px ${FX_LOOK.displayFont}`;
}

/** Display text centered on device x with its baseline at device y, outlined by a stroke of `line` device pixels. */
function outlined(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, px: number, line: number, join: CanvasLineJoin, w: Washed): void {
  ctx.save();
  ctx.font = font(px);
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

/** A title centered on device (x, y), sized to span `width` device pixels, with a rounded outline. */
function title(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, w: Washed): void {
  ctx.font = font(MEASURE_PX);
  const m = ctx.measureText(text);
  const px = (MEASURE_PX * width) / m.width;
  // Centered on its capitals
  const mid = ((m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2 / MEASURE_PX) * px;
  outlined(ctx, text, x, y + mid, px, px * FX_LOOK.titleOutline, 'round', w);
}

/** Small text standing on art (x, y): capitals `cap` art pixels tall in a square ring `ring` art pixels thick. */
function small(ctx: CanvasRenderingContext2D, L: Layout, text: string, x: number, y: number, cap: number, ring: number, w: Washed): void {
  ctx.font = font(MEASURE_PX);
  const px = (MEASURE_PX * cap * L.P) / ctx.measureText(text).actualBoundingBoxAscent;
  const [dx, dy] = device(L, x, y);
  // The stroke is centered on the glyph edge, so it is twice the ring
  outlined(ctx, text, dx, dy, px, 2 * ring * L.P, 'miter', w);
}

/** Callouts, coins and the phase banner in display type, bump bursts in art pixels. Leavers are drawn with the shoppers. */
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
        small(ctx, L, e.text, colX(e.x), floorY(e.y + u * look.coinRise), look.coinCap, look.coinRing, w);
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
        const u = e.age / look.bannerTime;
        // Washes in and out through the same keyframes
        const w = washOut(PALETTE.blue, washStep(Math.min(u, 1 - u), look.bannerFade));
        const [x, y] = device(L, L.gridW / 2, L.top / 2);
        title(ctx, e.text, x, y, L.gridW * look.bannerWidth * L.P, w);
        break;
      }
      case 'leaver':
        break;
    }
  }
}
