import { PALETTE, washOut, type Washed } from './colors.ts';
import { colX, device, floorY, type Layout } from './layout.ts';
import { FX_LOOK, GRID, TAU } from './look.ts';
import { GLYPH_H, Pix } from './pix.ts';
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

// Titles are measured at this size, then scaled to fit their width
const MEASURE_PX = 100;

/** A title in smooth display type, centered on device (x, y), sized to span `width` device pixels, with an outline. */
function title(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, w: Washed): void {
  const font = (px: number) => `${px}px ${FX_LOOK.titleFont}`;
  ctx.save();
  ctx.font = font(MEASURE_PX);
  const size = (MEASURE_PX * width) / ctx.measureText(text).width;
  ctx.font = font(size);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * FX_LOOK.titleOutline;
  ctx.strokeStyle = w.outline;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = w.fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Callouts, coins and bump bursts in the pixel font; the phase banner as a title. Leavers are drawn with the shoppers. */
export function drawEffects(ctx: CanvasRenderingContext2D, view: StreetView, L: Layout): void {
  const look = FX_LOOK;
  const px = new Pix(ctx, L.P, L.ox, L.groundY);
  for (const e of view.effects) {
    switch (e.kind) {
      case 'callout': {
        const u = e.age / look.calloutTime;
        const s = look.calloutScale;
        const w = washOut(CALLOUT_COLORS[e.color], fadeOut(u));
        px.label(e.text, colX(e.x), Math.round(floorY(e.y + u * look.calloutRise)) - GLYPH_H * s, s, w.fill, w.outline);
        break;
      }
      case 'coin': {
        const u = e.age / look.coinTime;
        const s = look.coinScale;
        const w = washOut(PALETTE.yellow, fadeOut(u));
        px.label(e.text, colX(e.x), Math.round(floorY(e.y + u * look.coinRise)) - GLYPH_H * s, s, w.fill, w.outline);
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
