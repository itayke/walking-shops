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

/** The stride frame for a distance walked (in columns, forward counting up): frames advance with distance, not time. */
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

/** A climb in progress: how far along it is (0 to 1), and the rise still ahead of the body out of the whole, in art pixels. */
export interface ClimbStep {
  u: number;
  rest: number;
  rise: number;
}

/** 0 to 1, easing in and out: the body starts rising slowly while the front foot lifts. */
export function climbEase(u: number): number {
  return u * u * (3 - 2 * u);
}

/**
 * The legs for a body `W` art pixels wide, standing `lift` art pixels tall, facing right: facing left draws the same
 * pose mirrored. A moving shop strides (seen from the side, body up a pixel on each pass); a climbing one steps up.
 */
export function legPose(lift: number, W: number, moving: boolean, frame: number, climb: ClimbStep | null = null): LegPose {
  const raise = Math.round(lift);
  if (lift < LEG_LOOK.minLift) return { raise, feet: null };
  if (climb) return { raise, feet: climbFeet(W, climb) };
  if (!moving) return { raise, feet: [{ dx: 0, up: 0 }, { dx: 0, up: 0 }] };
  const f = mod(frame, LEG_LOOK.framesPerStride);
  const reach = Math.max(1, Math.round(W * LEG_LOOK.reach));
  const up = Math.max(1, Math.round(GRID.cellH * LEG_LOOK.footRaise));
  const foot = ([r, u]: number[]): Foot => ({ dx: r * reach, up: u * up });
  return { raise: raise + (f % 2), feet: [foot(LEFT_STEPS[f]), foot(RIGHT_STEPS[f])] };
}

/**
 * Stepping up: the front foot lifts and reaches forward until it meets the step, then stays on it, so it straightens
 * and comes back under the hip as the body rises. The back foot pushes off behind.
 */
function climbFeet(W: number, c: ClimbStep): [Foot, Foot] {
  const lift = Math.min(1, c.u / LEG_LOOK.climbLiftShare);
  const raised = GRID.cellH * LEG_LOOK.climbFootRaise * lift;
  const ahead = c.rise > 0 ? Math.min(lift, c.rest / c.rise) : 0;
  const front = { dx: Math.round(W * LEG_LOOK.climbReach * ahead), up: Math.round(Math.max(0, Math.min(raised, c.rest))) };
  const back = { dx: -Math.max(1, Math.round(W * LEG_LOOK.reach)), up: 0 };
  // Facing right, the right foot (second) leads
  return [back, front];
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
 * Both legs, from the underside of a body centered on x = 0 down to the ground at y = 0, facing right (pass a mirrored
 * pen to face left). Segments are sized to reach a floor with the knees barely out, so a shorter lift folds them out.
 */
export function drawLegs(px: Pix, pose: LegPose, W: number, ink: string): void {
  if (!pose.feet) return;
  const lw = Math.max(1, Math.round(GRID.cellW * LEG_LOOK.legShare));
  const knee = Math.max(1, Math.round(W * LEG_LOOK.kneeOut));
  const seg = Math.hypot(GRID.cellH / 2, knee);
  const hipY = -pose.raise;
  // Shoes point along the walk, toes ahead
  const shoeW = lw + 2;
  const shoeH = lw > 2 ? 2 : 1;
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
    px.r(fx - half, sole - shoeH + 1, shoeW, shoeH, ink);
  }
}
