import { crosswalkWidth, telegraphBars, type GameState } from '@walking-shops/sim';
import type { Layout } from './layout.ts';
import { CROSSWALK_LOOK, STREET_LOOK } from './look.ts';
import type { Theme } from './theme.ts';

export function drawStreet(ctx: CanvasRenderingContext2D, g: GameState, L: Layout, theme: Theme, now: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, L.groundY);
  sky.addColorStop(0, theme['sky-top']);
  sky.addColorStop(1, theme['sky-bot']);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, L.width, L.groundY);
  ctx.fillStyle = theme.curb;
  ctx.fillRect(0, L.groundY, L.width, L.sidewalkH);
  ctx.fillStyle = theme.asphalt;
  ctx.fillRect(0, L.groundY + L.sidewalkH, L.width, L.streetH - L.sidewalkH);

  // Column marks on the curb: the grid the shops stand on
  ctx.fillStyle = theme.muted;
  ctx.globalAlpha = STREET_LOOK.curbTickAlpha;
  for (let c = 1; c < g.C; c++) ctx.fillRect(c * L.cellW - 0.5, L.groundY, 1, L.sidewalkH * STREET_LOOK.curbTickHeight);
  ctx.globalAlpha = 1;

  drawCrosswalk(ctx, g, L, theme, now);
}

/**
 * The crosswalk telegraph: it appears empty (a pulsing outline), then its bars are drawn bottom to top, one per
 * waveLineInterval. The wave steps off with the last bar, and the crosswalk fades while the last shoppers cross.
 */
function drawCrosswalk(ctx: CanvasRenderingContext2D, g: GameState, L: Layout, theme: Theme, now: number): void {
  const W = g.wave;
  if (W.state === 'pause') return;
  const { WAVES, WALK_INS } = g.config;
  const look = CROSSWALK_LOOK;
  const x0 = (W.col0 + look.insetX) * L.cellW;
  const w = (crosswalkWidth(g) - 2 * look.insetX) * L.cellW;
  const band = L.streetH - L.sidewalkH;
  const y0 = L.groundY + L.sidewalkH + band * look.insetY;
  const h = band * (1 - 2 * look.insetY);

  const fade = W.state === 'crossing' ? Math.max(look.fadeFloor, (W.end - g.t) / Math.max(WALK_INS.crossTime, Number.EPSILON)) : 1;

  if (W.state === 'telegraph') {
    ctx.save();
    ctx.setLineDash(look.dash);
    ctx.lineWidth = look.outlineWidth;
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = look.outlineAlpha + (1 - look.outlineAlpha) * Math.abs(Math.sin(now * look.pulseRate));
    ctx.strokeRect(x0, y0, w, h);
    ctx.restore();
  }

  const lines = Math.max(1, Math.floor(WAVES.waveLines));
  const slot = h / (2 * lines - 1);
  const drawn = telegraphBars(g);
  ctx.fillStyle = theme.accent;
  for (let i = 0; i < drawn; i++) {
    // Bar i appears at the end of interval i + 1, and grows in from the middle
    const appeared = W.start + (i + 1) * WAVES.waveLineInterval;
    const grow = Math.max(0, Math.min(1, (g.t - appeared) / look.barGrowTime));
    ctx.globalAlpha = look.barAlpha * fade;
    const bw = w * grow;
    ctx.fillRect(x0 + (w - bw) / 2, y0 + h - (2 * i + 1) * slot, bw, slot);
  }
  ctx.globalAlpha = 1;
}
