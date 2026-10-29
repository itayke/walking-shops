import type { Dir, GameState, Shop, SimEvent } from '@walking-shops/sim';
import { floorsNeeded } from './layout.ts';
import { climbEase } from './legs.ts';
import { FX_LOOK, LEG_LOOK, MOTION_LOOK, PEOPLE_LOOK, SHOP_LOOK, STREET_LOOK } from './look.ts';

/** A toppled shop flying from where it was drawn to its new place. */
interface Arc {
  fromX: number;
  fromY: number;
  age: number;
  dir: Exclude<Dir, 0>;
}

/** A shop stepping up onto the next column, from one floor to another, and how far along it is (0 to 1). */
export interface Climb {
  from: number;
  to: number;
  u: number;
  dir: Exclude<Dir, 0>;
}

/**
 * How a shop is drawn right now: smoothed toward its grid position. x in columns, y (feet) in floors counting one per
 * shop below; `carried` adds what the walkers below stand up on their legs, live, so riders never lag their walker.
 */
export interface ShopAnim {
  x: number;
  y: number;
  // The floor it's heading for, and the climb up to it
  level: number;
  climb: Climb | null;
  carried: number;
  // Leg extension, 0 sitting to 1 standing
  legs: number;
  // Facing, and whether the legs are striding
  dir: Exclude<Dir, 0>;
  moving: boolean;
  spin: number;
  flash: number;
  squash: number;
  arc: Arc | null;
}

export type CalloutColor = 'danger' | 'ok' | 'muted';

// Effects live in world units (columns, floors), so they stay put while the view zooms
export type Effect =
  | { kind: 'callout'; text: string; color: CalloutColor; x: number; y: number; age: number }
  | { kind: 'coin'; text: string; x: number; y: number; age: number }
  | { kind: 'burst'; x: number; y: number; age: number }
  | { kind: 'leaver'; x: number; shopper: number; age: number }
  | { kind: 'banner'; text: string; age: number };

export const CALLOUT_TEXT = { topple: 'TOPPLE!', pushback: 'BLOCKED', closed: 'CLOSED' };
export const PHASE2_BANNER = 'PARACHUTES!';

const LIFETIME: Record<Effect['kind'], number> = {
  callout: FX_LOOK.calloutTime,
  coin: FX_LOOK.coinTime,
  burst: FX_LOOK.burstTime,
  leaver: PEOPLE_LOOK.leaveTime,
  banner: FX_LOOK.bannerTime,
};

/** Fraction of the way from a to b, eased to slow into the landing. */
function easeOut(u: number): number {
  return 1 - (1 - u) * (1 - u);
}

/** Exponential approach factor for a rate over dt, frame-rate independent. */
function follow(rate: number, dt: number): number {
  return 1 - Math.exp(-rate * dt);
}

/**
 * Everything the renderer animates on top of the sim state. Only reads the game; the sim never sees any of it.
 * Feed it each tick's events, then update once per frame.
 */
export class StreetView {
  readonly anims = new Map<string, ShopAnim>();
  effects: Effect[] = [];
  // Floors of sky shown, eased toward what the street needs
  floors = 0;
  private phase2 = false;

  reset(g: GameState): void {
    this.anims.clear();
    this.effects = [];
    this.floors = floorsNeeded(g);
    this.phase2 = g.t >= g.config.ROUND.paraStart;
  }

  anim(s: Shop): ShopAnim {
    let a = this.anims.get(s.id);
    if (!a) {
      a = { x: s.col, y: s.level, level: s.level, climb: null, carried: 0, legs: 0, dir: 1, moving: false, spin: 0, flash: 0, squash: 0, arc: null };
      this.anims.set(s.id, a);
    }
    return a;
  }

  /** The middle of a shop's body, in floors, for effects that start on it. A shop with its roof is one floor tall. */
  private bodyMid(g: GameState, a: ShopAnim): number {
    return this.roof(g, a) - 1 / 2;
  }

  private roof(g: GameState, a: ShopAnim): number {
    return a.y + a.carried + a.legs * g.config.MOVEMENT.walkLift + 1;
  }

  private add(e: Effect): void {
    this.effects.push(e);
    if (this.effects.length > FX_LOOK.maxEffects) this.effects.splice(0, this.effects.length - FX_LOOK.maxEffects);
  }

  /** Turn one tick's sim events into animation. */
  onEvents(g: GameState, events: readonly SimEvent[]): void {
    const byId = (id: string) => this.anim(g.shops.find((s) => s.id === id)!);
    for (const e of events) {
      switch (e.type) {
        case 'topple':
          for (const id of e.fallen) {
            const a = byId(id);
            a.climb = null;
            a.arc = { fromX: a.x, fromY: a.y, age: 0, dir: e.to > e.col ? 1 : -1 };
          }
          this.add({ kind: 'callout', text: CALLOUT_TEXT.topple, color: 'danger', x: e.col, y: e.level + FX_LOOK.calloutAbove, age: 0 });
          break;
        case 'pushback': {
          const a = byId(e.by);
          this.add({ kind: 'callout', text: CALLOUT_TEXT.pushback, color: 'ok', x: a.x, y: this.roof(g, a) + FX_LOOK.calloutAbove, age: 0 });
          break;
        }
        case 'bump': {
          const a = byId(e.a);
          const b = byId(e.b);
          this.add({ kind: 'burst', x: (a.x + b.x) / 2, y: (this.bodyMid(g, a) + this.bodyMid(g, b)) / 2, age: 0 });
          break;
        }
        case 'closed': {
          const a = byId(e.shop);
          this.add({ kind: 'callout', text: CALLOUT_TEXT.closed, color: 'muted', x: a.x, y: this.roof(g, a) + FX_LOOK.calloutAbove, age: 0 });
          break;
        }
        case 'paid': {
          const a = byId(e.shop);
          a.flash = SHOP_LOOK.flashTime;
          // Counted in walk-ins, the way the street teaches it
          const worth = e.kind === 'para' ? g.config.SCORING.paraValue : 1;
          this.add({ kind: 'coin', text: `+${worth}`, x: a.x, y: this.roof(g, a), age: 0 });
          break;
        }
        case 'lost':
          this.add({ kind: 'leaver', x: e.x, shopper: e.shopper, age: 0 });
          break;
        case 'reopened':
          // The shutters snapping up says it
          break;
      }
    }
  }

  /** Ease every shop toward its grid position, fly toppled ones, age effects. */
  update(g: GameState, dt: number): void {
    const { MOVEMENT, ROUND } = g.config;
    const stand = dt / SHOP_LOOK.standTime;
    const xK = follow(SHOP_LOOK.followRate, dt);
    const yK = follow(SHOP_LOOK.dropRate, dt);
    const climbStep = dt / (MOVEMENT.cellTime * SHOP_LOOK.climbShare);
    for (let c = 0; c < g.C; c++) {
      // Riders move with the walker under them, and stand on its legs
      let offSum = 0;
      let carried = 0;
      for (const [ty, i] of g.cols[c].entries()) {
        const s = g.shops[i];
        const a = this.anim(s);
        offSum += s.off;
        a.legs = s.walking ? Math.min(1, a.legs + stand) : Math.max(0, a.legs - stand);
        a.carried = carried;
        carried += a.legs * MOVEMENT.walkLift;
        const tx = c + offSum;
        const ahead = tx - a.x;
        // Strides start once the legs are fully up: standing up and sitting down keep the feet planted
        a.moving = s.walking && a.legs >= 1 && Math.abs(ahead) > LEG_LOOK.moveSettle;
        if (a.moving) a.dir = ahead > 0 ? 1 : -1;
        if (s.pushT > 0 && s.pushCol >= 0) a.dir = s.pushCol > s.col ? 1 : -1;
        // Going up a floor is a climb, timed so the legs can step up with it; anything else drops back to following
        if (ty !== a.level) a.climb = ty > a.level && !a.arc ? { from: a.y, to: ty, u: 0, dir: a.dir } : null;
        a.level = ty;
        if (a.arc) {
          a.arc.age += dt;
          const u = Math.min(1, a.arc.age / MOTION_LOOK.arcTime);
          const e = easeOut(u);
          a.x = a.arc.fromX + (tx - a.arc.fromX) * e;
          a.y = a.arc.fromY + (ty - a.arc.fromY) * e + Math.sin(Math.PI * u) * MOTION_LOOK.arcHeight;
          a.spin = a.arc.dir * u * MOTION_LOOK.arcSpin;
          if (u >= 1) {
            a.arc = null;
            a.spin = 0;
            a.squash = MOTION_LOOK.squashTime;
          }
        } else if (a.climb) {
          const c = a.climb;
          c.u = Math.min(1, c.u + climbStep);
          a.x += (tx - a.x) * xK;
          a.y = c.from + (c.to - c.from) * climbEase(c.u);
          if (c.u >= 1) a.climb = null;
        } else {
          a.x += (tx - a.x) * xK;
          a.y += (ty - a.y) * yK;
        }
        a.flash = Math.max(0, a.flash - dt);
        a.squash = Math.max(0, a.squash - dt);
      }
    }

    for (const e of this.effects) e.age += dt;
    this.effects = this.effects.filter((e) => e.age < LIFETIME[e.kind]);

    const phase2 = g.t >= ROUND.paraStart;
    if (phase2 && !this.phase2 && !g.over) this.add({ kind: 'banner', text: PHASE2_BANNER, age: 0 });
    this.phase2 = phase2;

    this.floors += (floorsNeeded(g) - this.floors) * follow(STREET_LOOK.zoomRate, dt);
  }
}
