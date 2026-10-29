import { PALETTE } from './colors.ts';
import { colX, floorY, type Layout } from './layout.ts';
import { FX_LOOK, GRID, TAU } from './look.ts';
import { GLYPH_H, Pix, textWidth } from './pix.ts';
import type { CalloutColor, StreetView } from './view.ts';

const CALLOUT_COLORS: Record<CalloutColor, string> = { danger: PALETTE.danger, ok: PALETTE.ok, muted: PALETTE.grey };

/** Full strength, then a fade in steps over the end of its life. u runs 0 to 1. */
function steppedFade(u: number): number {
  const { fadeHold, fadeSteps } = FX_LOOK;
  if (u < fadeHold) return 1;
  return 1 - Math.ceil(((u - fadeHold) / (1 - fadeHold)) * fadeSteps) / fadeSteps;
}

/** Callouts, coins, bump bursts and the phase banner, in the pixel font. Leavers are drawn with the shoppers. */
export function drawEffects(ctx: CanvasRenderingContext2D, view: StreetView, L: Layout): void {
  const look = FX_LOOK;
  const px = new Pix(ctx, L.P, L.ox, L.groundY);
  for (const e of view.effects) {
    switch (e.kind) {
      case 'callout': {
        const u = e.age / look.calloutTime;
        const s = look.calloutScale;
        ctx.globalAlpha = steppedFade(u);
        px.label(e.text, colX(e.x), Math.round(floorY(e.y + u * look.calloutRise)) - GLYPH_H * s, s, CALLOUT_COLORS[e.color], PALETTE.ink);
        break;
      }
      case 'coin': {
        const u = e.age / look.coinTime;
        const s = look.coinScale;
        ctx.globalAlpha = steppedFade(u);
        px.label(e.text, colX(e.x), Math.round(floorY(e.y + u * look.coinRise)) - GLYPH_H * s, s, PALETTE.yellow, PALETTE.ink);
        break;
      }
      case 'burst': {
        const u = e.age / look.burstTime;
        const x = colX(e.x);
        const y = floorY(e.y);
        const len = look.burstSize * GRID.cellW;
        const inner = len * look.burstStart;
        const outer = len * (look.burstStart + (1 - look.burstStart) * u);
        ctx.globalAlpha = steppedFade(u);
        for (let k = 0; k < look.burstRays; k++) {
          const ang = (k * TAU) / look.burstRays;
          px.line(x + Math.cos(ang) * inner, y + Math.sin(ang) * inner, x + Math.cos(ang) * outer, y + Math.sin(ang) * outer, PALETTE.accent);
        }
        break;
      }
      case 'banner': {
        const u = e.age / look.bannerTime;
        // Font pixels sized so the text spans its share of the street
        const s = Math.max(1, Math.round((L.gridW * look.bannerWidth) / textWidth(e.text)));
        // Fades in and out in steps
        ctx.globalAlpha = Math.ceil(Math.sin(Math.PI * u) * look.fadeSteps) / look.fadeSteps;
        px.label(e.text, L.gridW / 2, Math.round(L.top / 2 - (GLYPH_H * s) / 2), s, PALETTE.blue, PALETTE.ink);
        break;
      }
      case 'leaver':
        break;
    }
  }
  ctx.globalAlpha = 1;
}
