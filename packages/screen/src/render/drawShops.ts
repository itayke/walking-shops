import { shutterDrop, type GameState, type Shop } from '@walking-shops/sim';
import { shopFill, shopHue } from './colors.ts';
import { colX, floorY, type Layout } from './layout.ts';
import { MOTION_LOOK, SHOP_LOOK, TAU } from './look.ts';
import { strainsByColumn } from './strain.ts';
import type { Theme } from './theme.ts';
import type { ShopAnim, StreetView } from './view.ts';

// Draw order: still shops, then pressing ones (and what they carry), then shops in the air; yours on top of each
const LAYER_STILL = 0;
const LAYER_PRESSING = 1;
const LAYER_FLYING = 2;

/** A strained tower rotates as one piece about the bottom corner it will fall over. */
interface Tilt {
  x: number;
  y: number;
  angle: number;
}

interface Item {
  s: Shop;
  index: number;
  a: ShopAnim;
  layer: number;
  tilt: Tilt | null;
}

export function drawShops(ctx: CanvasRenderingContext2D, g: GameState, view: StreetView, L: Layout, theme: Theme, now: number): void {
  const strains = strainsByColumn(g);
  const bw = L.cellW * SHOP_LOOK.bodyWidth;
  const items: Item[] = [];
  for (let c = 0; c < g.C; c++) {
    const st = strains.get(c);
    let tilt: Tilt | null = null;
    let layer = LAYER_STILL;
    for (const i of g.cols[c]) {
      const s = g.shops[i];
      const a = view.anim(s);
      // A walker brings its riders forward with it
      if (s.pressing) layer = LAYER_PRESSING;
      if (st && s.level >= st.level && !tilt) {
        const wobble = Math.sin(now * MOTION_LOOK.strainRate) * MOTION_LOOK.strainWobble;
        tilt = { x: colX(L, a.x) + (st.dir * bw) / 2, y: floorY(L, a.y), angle: st.dir * st.amount * MOTION_LOOK.strainLean + wobble * st.amount };
      }
      items.push({ s, index: i, a, layer: a.arc ? LAYER_FLYING : layer, tilt: st && s.level >= st.level ? tilt : null });
    }
  }
  const mine = (s: Shop) => (s.controller === 'human' ? 1 : 0);
  items.sort((p, q) => p.layer - q.layer || mine(p.s) - mine(q.s));
  for (const it of items) drawShop(ctx, g, it, L, theme, now);
}

function drawShop(ctx: CanvasRenderingContext2D, g: GameState, it: Item, L: Layout, theme: Theme, now: number): void {
  const { s, a, tilt } = it;
  const { MOVEMENT } = g.config;
  const look = SHOP_LOOK;
  const human = s.controller === 'human';
  const bw = L.cellW * look.bodyWidth;
  const bh = L.cellH * look.bodyHeight;
  const lift = a.legs * MOVEMENT.walkLift * L.cellH;
  const y0 = -lift - bh;
  let cx = colX(L, a.x);
  if (s.stunT > 0) cx += Math.sin(now * MOTION_LOOK.stunRate) * MOTION_LOOK.stunShake * L.cellW;

  ctx.save();
  if (tilt) {
    ctx.translate(tilt.x, tilt.y);
    ctx.rotate(tilt.angle);
    ctx.translate(-tilt.x, -tilt.y);
  }
  // Origin at the feet, centered
  ctx.translate(cx, floorY(L, a.y));
  if (a.spin) {
    ctx.translate(0, y0 + bh / 2);
    ctx.rotate(a.spin);
    ctx.translate(0, -(y0 + bh / 2));
  }
  if (s.immuneT > 0 && !a.arc) ctx.rotate(Math.sin(now * MOTION_LOOK.dizzyRate) * MOTION_LOOK.dizzyAngle);
  if (a.squash > 0) {
    const q = (a.squash / MOTION_LOOK.squashTime) * MOTION_LOOK.squash;
    ctx.scale(1 + q / 2, 1 - q);
  }

  if (lift > look.minLegPixels) drawLegs(ctx, a, bw, lift, L, theme);

  const hue = shopHue(it.index);
  ctx.fillStyle = shopFill(theme, hue);
  ctx.fillRect(-bw / 2, y0, bw, bh);
  const awningH = bh * look.awningShare;
  drawAwning(ctx, theme, hue, bw, y0, awningH);

  const inset = bw * look.windowInset;
  const winTop = y0 + bh * look.windowTop;
  const winH = y0 + bh - inset - winTop;
  ctx.globalAlpha = look.windowAlpha;
  ctx.fillStyle = theme.panel;
  ctx.fillRect(-bw / 2 + inset, winTop, bw - 2 * inset, winH);
  ctx.globalAlpha = 1;

  // Shutters drop over the last idleWarn seconds, and stay down while closed
  const drop = shutterDrop(g, s);
  if (drop > 0) {
    const top = y0 + awningH;
    const hh = (bh - awningH) * drop;
    ctx.fillStyle = theme.shutter;
    ctx.fillRect(-bw / 2, top, bw, hh);
    ctx.strokeStyle = theme['shutter-line'];
    ctx.lineWidth = 1;
    ctx.beginPath();
    const gap = (bh - awningH) / look.shutterSlats;
    for (let y = top + gap; y < top + hh; y += gap) {
      ctx.moveTo(-bw / 2, y);
      ctx.lineTo(bw / 2, y);
    }
    ctx.stroke();
  }

  // The name stays readable over the shutters, so a closed shop can still find itself
  ctx.fillStyle = theme.ink;
  ctx.font = `600 ${Math.min(L.cellW * look.labelSize, bh * look.labelMaxShare)}px ${theme['font-data']}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s.label, 0, winTop + winH / 2, bw - 2 * inset);

  ctx.lineWidth = human ? look.humanOutline : look.outline;
  ctx.strokeStyle = it.tilt ? theme.danger : human ? theme.accent : theme.ink;
  ctx.strokeRect(-bw / 2, y0, bw, bh);

  if (a.flash > 0) {
    ctx.globalAlpha = a.flash / look.flashTime;
    ctx.strokeStyle = theme.accent;
    ctx.lineWidth = look.flashWidth;
    const pad = look.flashWidth + look.outline;
    ctx.strokeRect(-bw / 2 - pad, y0 - pad, bw + 2 * pad, bh + 2 * pad);
    ctx.globalAlpha = 1;
  }

  // Push meter over the attacker: full means the tower goes
  if (s.pushT > 0) {
    const mh = L.cellH * look.pushMeterHeight;
    const my = y0 - L.cellH * look.pushMeterGap - mh;
    ctx.globalAlpha = look.pushTrackAlpha;
    ctx.fillStyle = theme.ink;
    ctx.fillRect(-bw / 2, my, bw, mh);
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.danger;
    ctx.fillRect(-bw / 2, my, bw * Math.min(1, s.pushT / MOVEMENT.pushTime), mh);
  }

  if (s.immuneT > 0) drawDizzy(ctx, theme, bw, y0, L, now);
  if (human) drawMarker(ctx, theme, y0, L, now);
  ctx.restore();
}

/** Two legs from the underside of the body to the feet, swinging with the distance walked. */
function drawLegs(ctx: CanvasRenderingContext2D, a: ShopAnim, bw: number, lift: number, L: Layout, theme: Theme): void {
  const look = SHOP_LOOK;
  const swing = Math.sin(a.x * TAU * look.stridesPerCell);
  const lw = Math.max(look.legMinWidth, L.cellW * look.legWidth);
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = lw;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const side of [-1, 1]) {
    const hipX = side * bw * look.hipSpread;
    const footX = hipX + side * swing * bw * look.strideReach;
    const kneeX = (hipX + footX) / 2 + side * bw * look.kneeOut;
    ctx.moveTo(hipX, -lift);
    ctx.lineTo(kneeX, -lift / 2);
    ctx.lineTo(footX, 0);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Striped awning with a scalloped edge. */
function drawAwning(ctx: CanvasRenderingContext2D, theme: Theme, hue: number, bw: number, y0: number, h: number): void {
  const n = SHOP_LOOK.awningStripes;
  const sw = bw / n;
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = k % 2 === 0 ? shopFill(theme, hue, SHOP_LOOK.stripeDarken) : theme.awning;
    const x = -bw / 2 + k * sw;
    ctx.fillRect(x, y0, sw, h);
    ctx.beginPath();
    ctx.arc(x + sw / 2, y0 + h, sw / 2, 0, Math.PI);
    ctx.fill();
  }
}

/** Dots circling the roof while a toppled shop can't be pushed again. */
function drawDizzy(ctx: CanvasRenderingContext2D, theme: Theme, bw: number, y0: number, L: Layout, now: number): void {
  const m = MOTION_LOOK;
  const cy = y0 - L.cellH * m.dizzyHeight;
  const r = Math.max(1, L.cellW * m.dizzyDotSize);
  ctx.fillStyle = theme.accent;
  for (let k = 0; k < m.dizzyDots; k++) {
    const ang = now * m.dizzyRate + (k * TAU) / m.dizzyDots;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * bw * m.dizzyOrbitX, cy + Math.sin(ang) * L.cellH * m.dizzyOrbitY, r, 0, TAU);
    ctx.fill();
  }
}

/** A bouncing arrow over your own shop, so you can find it in a crowd. */
function drawMarker(ctx: CanvasRenderingContext2D, theme: Theme, y0: number, L: Layout, now: number): void {
  const look = SHOP_LOOK;
  const size = L.cellW * look.markerSize;
  const tip = y0 - L.cellH * look.markerGap - Math.abs(Math.sin(now * look.markerBobRate)) * L.cellH * look.markerBob;
  ctx.beginPath();
  ctx.moveTo(0, tip);
  ctx.lineTo(-size, tip - size * look.markerAspect);
  ctx.lineTo(size, tip - size * look.markerAspect);
  ctx.closePath();
  ctx.fillStyle = theme.accent;
  ctx.fill();
  ctx.lineWidth = look.outline;
  ctx.strokeStyle = theme.ink;
  ctx.stroke();
}
