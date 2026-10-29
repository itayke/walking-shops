import { shutterDrop, type GameState, type Shop } from '@walking-shops/sim';
import { PALETTE, shopHue, shopTint } from './colors.ts';
import { drawLegs, legPose, strideFrame, type ClimbStep, type LegPose } from './legs.ts';
import { colX, device, floorY, type Layout } from './layout.ts';
import { GRID, MOTION_LOOK, SHOP_LOOK, TAU } from './look.ts';
import { Pix } from './pix.ts';
import { SHOP, shopDesign, shopSprite, shutterRows } from './shopArt.ts';
import { strainsByColumn, type Strain } from './strain.ts';
import type { ShopAnim, StreetView } from './view.ts';

// Draw order: still shops, then pressing ones (and what they carry), then shops in the air
const LAYER_STILL = 0;
const LAYER_PRESSING = 1;
const LAYER_FLYING = 2;

/** A leaning stack rotates as one piece about a point on the ground under it, in art pixels. */
interface Lean {
  x: number;
  y: number;
  angle: number;
}

interface Item {
  s: Shop;
  index: number;
  a: ShopAnim;
  layer: number;
  lean: Lean | null;
  // Part of a tower about to fall
  danger: boolean;
  // Feet in art pixels, with the body raised over them on its legs, facing dir
  fx: number;
  fy: number;
  pose: LegPose;
  dir: 1 | -1;
}

/** Where a standing shop is in its climb, if it's climbing: the front foot needs the step's height. */
function climbStep(a: ShopAnim): ClimbStep | null {
  const c = a.climb;
  if (!c || a.legs < 1 || c.to <= c.from) return null;
  return { u: c.u, rest: (c.to - a.y) * GRID.cellH, rise: (c.to - c.from) * GRID.cellH };
}

/** How far a strained tower leans toward its fall, shaking harder as the push nears its end. */
function strainAngle(st: Strain, now: number): number {
  const m = MOTION_LOOK;
  return st.dir * st.amount * m.strainLean + Math.sin(now * m.strainRate) * m.strainWobble * st.amount;
}

export function drawShops(ctx: CanvasRenderingContext2D, g: GameState, view: StreetView, L: Layout, now: number): void {
  const strains = strainsByColumn(g);
  const { walkLift } = g.config.MOVEMENT;
  const items: Item[] = [];
  for (let c = 0; c < g.C; c++) {
    const st = strains.get(c);
    let lean: Lean | null = null;
    let danger = false;
    let layer = LAYER_STILL;
    // A striding walker bobs a pixel on each pass, and what it carries bobs with it
    let bob = 0;
    for (const i of g.cols[c]) {
      const s = g.shops[i];
      const a = view.anim(s);
      // A walker brings its riders forward with it
      if (s.pressing) layer = LAYER_PRESSING;
      const shake = s.stunT > 0 ? Math.sin(now * MOTION_LOOK.stunRate) * MOTION_LOOK.stunShake * GRID.cellW : 0;
      const fx = Math.round(colX(a.x) + shake);
      const fy = Math.round(floorY(a.y + a.carried)) - bob;
      const lift = a.legs * walkLift * GRID.cellH;
      const climb = climbStep(a);
      const dir = climb ? a.climb!.dir : a.dir;
      // Facing left mirrors the right-facing legs, so its frames count distance walked leftward
      const pose = legPose(lift, SHOP.W, a.moving, strideFrame(a.x * dir), climb);
      bob += pose.raise - Math.round(lift);
      if (st && s.level >= st.level && !danger) {
        // The tower turns about the bottom corner it falls over
        lean = { x: fx + SHOP.left + (st.dir > 0 ? SHOP.W : 0), y: fy, angle: strainAngle(st, now) };
        danger = true;
      }
      // A pusher leans into the tower pulse for pulse, carrying its riders with it
      const pushing = s.pushT > 0 ? strains.get(s.pushCol) : undefined;
      if (pushing && !lean) lean = { x: fx, y: fy, angle: strainAngle(pushing, now) };
      items.push({ s, index: i, a, layer: a.arc ? LAYER_FLYING : layer, lean, danger, fx, fy, pose, dir });
    }
  }
  items.sort((p, q) => p.layer - q.layer);
  const halfText = L.P >= GRID.halfPixelMinScale;
  for (const it of items) drawShop(ctx, g, it, L, halfText, now);
  // Meters and dizzy stars stay upright, over every shop
  const px = new Pix(ctx, L.P, L.ox, L.groundY);
  for (const it of items) {
    const top = it.fy - it.pose.raise - SHOP.spriteH;
    if (it.s.pushT > 0) drawPushMeter(px, it.fx, top, it.s.pushT / g.config.MOVEMENT.pushTime);
    if (it.s.immuneT > 0) drawDizzy(px, it.fx, top, now);
  }
}

function drawShop(ctx: CanvasRenderingContext2D, g: GameState, it: Item, L: Layout, halfText: boolean, now: number): void {
  const { s, a, lean, pose, dir } = it;
  const { P } = L;
  ctx.save();
  if (lean) {
    const [x, y] = device(L, lean.x, lean.y);
    ctx.translate(x, y);
    ctx.rotate(lean.angle);
    ctx.translate(-x, -y);
  }
  // Origin at the feet, centered; spin about the body's middle, sway and squash about the feet
  ctx.translate(...device(L, it.fx, it.fy));
  if (a.spin) {
    const mid = (-pose.raise - GRID.cellH / 2) * P;
    ctx.translate(0, mid);
    ctx.rotate(a.spin);
    ctx.translate(0, -mid);
  }
  if (s.immuneT > 0 && !a.arc) ctx.rotate(Math.sin(now * MOTION_LOOK.dizzyRate) * MOTION_LOOK.dizzyAngle);
  if (a.squash > 0) {
    const q = (a.squash / MOTION_LOOK.squashTime) * MOTION_LOOK.squash;
    ctx.scale(1 + q / 2, 1 - q);
  }

  const px = new Pix(ctx, P);
  drawLegs(dir > 0 ? px : px.mirrored(), pose, SHOP.W, PALETTE.ink);
  const sprite = shopSprite({
    design: shopDesign(it.index),
    tint: shopTint(shopHue(it.index)),
    label: s.label,
    shutter: Math.round(shutterRows() * Math.min(1, shutterDrop(g, s))),
    danger: it.danger,
    halfText,
    t: now,
  });
  const x0 = SHOP.left - 1;
  const y0 = -pose.raise - SHOP.spriteH;
  const X = Math.round(x0 * P);
  const Y = Math.round(y0 * P);
  ctx.drawImage(sprite, X, Y, Math.round((x0 + SHOP.spriteW) * P) - X, Math.round((y0 + SHOP.spriteH) * P) - Y);

  if (a.flash > 0) {
    ctx.globalAlpha = a.flash / SHOP_LOOK.flashTime;
    frame(px, x0 - 1, y0 - 1, SHOP.spriteW + 2, SHOP.spriteH + 1, PALETTE.accent);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/** A one-pixel ring just inside the box. */
function frame(px: Pix, x: number, y: number, w: number, h: number, col: string): void {
  px.r(x, y, w, 1, col);
  px.r(x, y + h - 1, w, 1, col);
  px.r(x, y, 1, h, col);
  px.r(x + w - 1, y, 1, h, col);
}

/** Push meter over the attacker: full means the tower goes. */
function drawPushMeter(px: Pix, cx: number, top: number, frac: number): void {
  const L = SHOP_LOOK;
  const h = Math.max(L.minPushMeter, Math.round(GRID.cellH * L.pushMeterHeight));
  const y = top - Math.round(GRID.cellH * L.pushMeterGap) - h;
  const x = cx + SHOP.left;
  px.r(x - 1, y - 1, SHOP.W + 2, h + 2, PALETTE.ink);
  px.r(x, y, SHOP.W, h, PALETTE.shutterLo);
  px.r(x, y, Math.round(SHOP.W * Math.min(1, frac)), h, PALETTE.danger);
}

/** Stars circling the roof while a toppled shop can't be pushed again; the ones in front catch the light. */
function drawDizzy(px: Pix, cx: number, top: number, now: number): void {
  const m = MOTION_LOOK;
  const cy = top - Math.round(GRID.cellH * m.dizzyHeight);
  for (let k = 0; k < m.dizzyStars; k++) {
    const ang = now * m.dizzyRate + (k * TAU) / m.dizzyStars;
    const sx = Math.round(cx + Math.cos(ang) * SHOP.W * m.dizzyOrbitX);
    const sy = Math.round(cy + Math.sin(ang) * GRID.cellH * m.dizzyOrbitY);
    px.r(sx - 1, sy, 3, 1, PALETTE.accent);
    px.r(sx, sy - 1, 1, 3, PALETTE.accent);
    if (Math.sin(ang) > 0) px.r(sx, sy, 1, 1, PALETTE.white);
  }
}
