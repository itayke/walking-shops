import type { Dir, GameState, Shop, SimEvent } from '@walking-shops/sim';
import { floorsNeeded } from './layout.ts';
import { FX_LOOK, MOTION_LOOK, PEOPLE_LOOK, SHOP_LOOK, STREET_LOOK } from './look.ts';

/** A toppled shop flying from where it was drawn to its new place. */
interface Arc {
  fromX: number;
  fromY: number;
  age: number;
  dir: Exclude<Dir, 0>;
}

/** How a shop is drawn right now: smoothed toward its grid position. x in columns, y (feet) in floors. */
export interface ShopAnim {
  x: number;
  y: number;
  // Leg extension, 0 sitting to 1 standing
  legs: number;
  spin: number;
  flash: number;
  squash: number;
  arc: Arc | null;
}

export type CalloutColor = 'danger' | 'ok' | 'muted';

// Effects live in world units (columns, floors), so they stay put while the view zooms
export type Effect =
  | { kind: 'callout'; text: string; color: CalloutColor; x: number; y: number; age: number }
  | { kind: 'coin'; para: boolean; x: number; y: number; age: number }
  | { kind: 'burst'; x: number; y: number; age: number }
  | { kind: 'leaver'; x: number; age: number }
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
      a = { x: s.col, y: s.level, legs: 0, spin: 0, flash: 0, squash: 0, arc: null };
      this.anims.set(s.id, a);
    }
    return a;
  }

  /** The middle of a shop's body, in floors, for effects that start on it. */
  private bodyMid(g: GameState, a: ShopAnim): number {
    return a.y + a.legs * g.config.MOVEMENT.walkLift + SHOP_LOOK.bodyHeight / 2;
  }

  private roof(g: GameState, a: ShopAnim): number {
    return a.y + a.legs * g.config.MOVEMENT.walkLift + SHOP_LOOK.bodyHeight;
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
          this.add({ kind: 'coin', para: e.kind === 'para', x: a.x, y: this.roof(g, a), age: 0 });
          break;
        }
        case 'lost':
          this.add({ kind: 'leaver', x: e.x, age: 0 });
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
    const legK = follow(SHOP_LOOK.legRate, dt);
    const xK = follow(SHOP_LOOK.followRate, dt);
    const yK = follow(SHOP_LOOK.climbRate, dt);
    for (let c = 0; c < g.C; c++) {
      // Riders move with the walker under them, and stand on its legs
      let offSum = 0;
      let base = 0;
      for (const i of g.cols[c]) {
        const s = g.shops[i];
        const a = this.anim(s);
        offSum += s.off;
        a.legs += ((s.walking ? 1 : 0) - a.legs) * legK;
        const tx = c + offSum;
        const ty = base;
        base += a.legs * MOVEMENT.walkLift + 1;
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
