import type { GameState } from '@walking-shops/sim';
import { colX, floorY, type Layout } from './layout.ts';
import { PEOPLE_LOOK, TAU } from './look.ts';
import type { Theme } from './theme.ts';
import type { StreetView } from './view.ts';

// A person's proportions, in units of its size: head radius and center height, body width, height and rounding
const HEAD_R = 0.7;
const HEAD_Y = 2.75;
const BODY_W = 1.4;
const BODY_H = 2;
const BODY_ROUND = 0.6;

/** A little person standing at (x, y): head over a rounded body, outlined so it reads on asphalt and sidewalk. */
function drawPerson(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, line: string | null): void {
  ctx.beginPath();
  ctx.roundRect(x - (BODY_W * r) / 2, y - BODY_H * r, BODY_W * r, BODY_H * r, [BODY_ROUND * r, BODY_ROUND * r, 0, 0]);
  ctx.moveTo(x + HEAD_R * r, y - HEAD_Y * r);
  ctx.arc(x, y - HEAD_Y * r, HEAD_R * r, 0, TAU);
  if (line) {
    ctx.strokeStyle = line;
    ctx.lineWidth = PEOPLE_LOOK.shopperLine;
    ctx.stroke();
  }
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Walk-ins crossing up from the bottom edge, then walking the sidewalk; and the ones who gave up, walking back. */
export function drawShoppers(ctx: CanvasRenderingContext2D, g: GameState, view: StreetView, L: Layout, theme: Theme): void {
  const look = PEOPLE_LOOK;
  const r = Math.max(look.shopperMinSize, L.cellW * look.shopperSize);
  const sidewalk = L.groundY + L.sidewalkH * look.sidewalkFeet;
  const far = L.height;
  for (const sh of g.shoppers) {
    const across = sh.cross > 0 ? Math.max(0, sh.rise) / sh.cross : 0;
    drawPerson(ctx, colX(L, sh.x), sidewalk + across * (far - sidewalk), r, theme.shopper, theme['shopper-line']);
  }
  for (const e of view.effects) {
    if (e.kind !== 'leaver') continue;
    const u = e.age / look.leaveTime;
    ctx.globalAlpha = look.leaveAlpha * (1 - u);
    drawPerson(ctx, colX(L, e.x), sidewalk + u * (far - sidewalk), r, theme.muted, null);
  }
  ctx.globalAlpha = 1;
}

/** Parachuters: a canopy swaying over a person, feet at the height the sim tracks. */
export function drawParachuters(ctx: CanvasRenderingContext2D, g: GameState, L: Layout, theme: Theme, now: number): void {
  const look = PEOPLE_LOOK;
  const r = Math.max(look.shopperMinSize, L.cellW * look.shopperSize);
  const cr = Math.max(look.canopyMinSize, L.cellW * look.canopySize);
  for (const pa of g.paras) {
    const x = colX(L, pa.x);
    const y = floorY(L, pa.y);
    ctx.save();
    ctx.translate(x, y);
    // Each parachuter sways on its own phase
    ctx.rotate(Math.sin(now * look.swayRate + pa.x) * look.swayAngle);
    const top = -cr * look.canopyLift - HEAD_Y * r;
    ctx.fillStyle = theme.chute;
    ctx.beginPath();
    ctx.arc(0, top, cr, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = theme.chute;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-cr, top);
    ctx.lineTo(0, -BODY_H * r);
    ctx.moveTo(cr, top);
    ctx.lineTo(0, -BODY_H * r);
    ctx.stroke();
    drawPerson(ctx, 0, 0, r, theme.shopper, theme['shopper-line']);
    ctx.restore();
  }
}
