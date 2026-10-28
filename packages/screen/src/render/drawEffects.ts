import { colX, floorY, type Layout } from './layout.ts';
import { FX_LOOK, TAU } from './look.ts';
import type { Theme } from './theme.ts';
import type { StreetView } from './view.ts';

// Text keeps an outline of the panel color so it reads over shops and sky alike
const TEXT_OUTLINE = 0.18;
const COIN_LINE = 1;
const BURST_LINE = 2;
// A burst's rays start this far out and grow to full length
const BURST_START = 0.4;

/** Callouts, coins, bump bursts and the phase banner. Leavers are drawn with the shoppers. */
export function drawEffects(ctx: CanvasRenderingContext2D, view: StreetView, L: Layout, theme: Theme): void {
  const look = FX_LOOK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  for (const e of view.effects) {
    switch (e.kind) {
      case 'callout': {
        const u = e.age / look.calloutTime;
        const size = Math.max(look.calloutMinSize, L.cellW * look.calloutSize);
        ctx.globalAlpha = 1 - u;
        ctx.font = `400 ${size}px ${theme['font-display']}`;
        outlinedText(ctx, theme, e.text, colX(L, e.x), floorY(L, e.y + u * look.calloutRise), theme[e.color], size);
        break;
      }
      case 'coin': {
        const u = e.age / look.coinTime;
        ctx.globalAlpha = 1 - u;
        ctx.fillStyle = e.para ? theme.chute : theme.accent;
        ctx.strokeStyle = theme.ink;
        ctx.lineWidth = COIN_LINE;
        ctx.beginPath();
        ctx.arc(colX(L, e.x), floorY(L, e.y + u * look.coinRise), L.cellW * look.coinSize, 0, TAU);
        ctx.fill();
        ctx.stroke();
        break;
      }
      case 'burst': {
        const u = e.age / look.burstTime;
        const x = colX(L, e.x);
        const y = floorY(L, e.y);
        const len = L.cellW * look.burstSize * (BURST_START + (1 - BURST_START) * u);
        ctx.globalAlpha = 1 - u;
        ctx.strokeStyle = theme.accent;
        ctx.lineWidth = BURST_LINE;
        ctx.beginPath();
        for (let k = 0; k < look.burstRays; k++) {
          const ang = (k * TAU) / look.burstRays;
          ctx.moveTo(x + Math.cos(ang) * len * BURST_START, y + Math.sin(ang) * len * BURST_START);
          ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
        }
        ctx.stroke();
        break;
      }
      case 'banner': {
        const u = e.age / look.bannerTime;
        const size = L.width * look.bannerSize;
        ctx.globalAlpha = Math.sin(Math.PI * u);
        ctx.font = `400 ${size}px ${theme['font-display']}`;
        outlinedText(ctx, theme, e.text, L.width / 2, L.groundY / 2, theme.chute, size);
        break;
      }
      case 'leaver':
        break;
    }
  }
  ctx.globalAlpha = 1;
}

function outlinedText(ctx: CanvasRenderingContext2D, theme: Theme, text: string, x: number, y: number, color: string, size: number): void {
  ctx.lineWidth = size * TEXT_OUTLINE;
  ctx.strokeStyle = theme.panel;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}
