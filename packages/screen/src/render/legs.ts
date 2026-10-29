import { GRID, LEG_LOOK } from './look.ts';
import type { Pix } from './pix.ts';

/** A foot: sideways from its hip, and lifted off the ground, in art pixels. */
interface Foot {
  dx: number;
  up: number;
}

/** How high the body sits over the ground, and where the feet go (none when sitting). */
export interface LegPose {
  raise: number;
  feet: [Foot, Foot] | null;
}

/** n mod m, never negative: a shop leaning off column 0 has a negative x. */
function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

/** The stride frame for a column position: frames advance with distance walked, not time. */
export function strideFrame(x: number): number {
  return mod(Math.floor(x * LEG_LOOK.stridesPerCell * LEG_LOOK.framesPerStride), LEG_LOOK.framesPerStride);
}

// Contact, passing, contact, passing: where each foot is per frame, as [reach, lift] steps
const LEFT_STEPS = [
  [1, 0],
  [0, 0],
  [-1, 0],
  [0, 1],
];
const RIGHT_STEPS = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, 0],
];

/**
 * The legs for a body `W` art pixels wide, standing `lift` art pixels tall. A moving shop strides (seen from the side,
 * body up a pixel on each pass); walking left runs the frames backward along the column, so they're flipped to keep
 * the stride moving forward.
 */
export function legPose(lift: number, W: number, moving: boolean, frame: number, dir: 1 | -1): LegPose {
  const raise = Math.round(lift);
  if (lift < LEG_LOOK.minLift) return { raise, feet: null };
  if (!moving) return { raise, feet: [{ dx: 0, up: 0 }, { dx: 0, up: 0 }] };
  const n = LEG_LOOK.framesPerStride;
  const f = mod(dir > 0 ? frame : -frame, n);
  const reach = Math.max(1, Math.round(W * LEG_LOOK.reach));
  const up = Math.max(1, Math.round(GRID.cellH * LEG_LOOK.footRaise));
  const foot = ([r, u]: number[]): Foot => ({ dx: r * reach * dir, up: u * up });
  return { raise: raise + (f % 2), feet: [foot(LEFT_STEPS[f]), foot(RIGHT_STEPS[f])] };
}

/** Two-segment leg: the knee sits off the hip-to-foot line on the outer side, keeping both segments their full length. */
export function kneeIK(hx: number, hy: number, fx: number, fy: number, seg: number, side: number): { x: number; y: number } {
  const dx = fx - hx;
  const dy = fy - hy;
  const d = Math.hypot(dx, dy) || 1;
  const k = Math.sqrt(Math.max(0, seg * seg - (d / 2) * (d / 2)));
  let nx = -dy / d;
  let ny = dx / d;
  if (nx * side < 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: hx + dx / 2 + nx * k, y: hy + dy / 2 + ny * k };
}

/**
 * Both legs, from the underside of a body centered on x = 0 down to the ground at y = 0. Segments are sized to reach a
 * floor with the knees barely out, so a shorter lift folds them out sideways.
 */
export function drawLegs(px: Pix, pose: LegPose, W: number, dir: 1 | -1, ink: string): void {
  if (!pose.feet) return;
  const lw = Math.max(1, Math.round(GRID.cellW * LEG_LOOK.legShare));
  const knee = Math.max(1, Math.round(W * LEG_LOOK.kneeOut));
  const seg = Math.hypot(GRID.cellH / 2, knee);
  const hipY = -pose.raise;
  // Shoes point along the walk, toes ahead
  const shoeW = lw + 2;
  const shoeH = lw > 2 ? 2 : 1;
  const toeBack = dir > 0 ? 0 : shoeW - lw;
  const half = Math.floor((lw - 1) / 2);
  for (const [i, side] of [-1, 1].entries()) {
    const f = pose.feet[i];
    const hx = Math.round(side * W * LEG_LOOK.hipSpread);
    const sole = -1 - f.up;
    const fx = hx + f.dx;
    const fy = sole - half;
    const k = kneeIK(hx, hipY, fx, fy, seg, side);
    const kx = Math.round(k.x);
    const ky = Math.round(k.y);
    px.line(hx, hipY, kx, ky, ink, lw);
    px.line(kx, ky, fx, fy, ink, lw);
    px.r(fx - half - toeBack, sole - shoeH + 1, shoeW, shoeH, ink);
  }
}
