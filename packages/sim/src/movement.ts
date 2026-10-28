import { rand } from './rng.ts';
import { NONE, reindex, shopAt } from './street.ts';
import type { Dir, GameState, Shop } from './types.ts';

// Released before crossing this much of a cell, a shop springs back; past it, the step commits
const COMMIT_AT = 0.5;

// A pushed tower topples away from the pusher, onto column f
export type MoveResult =
  | { type: 'wall' }
  | { type: 'free' }
  | { type: 'wait' }
  | { type: 'bump'; other: Shop }
  | { type: 'push'; B: Shop; t: number; f: number };

// Heights are measured from the surface S the walker stands on (its level). Neighbor column height H:
//   H <= S      step down / walk across  (land on top)
//   H == S + 1  climb                    (land on top)
//   H >= S + 2  push the shops at S+1 and above; a sustained push topples them to the far column
// Walkers pressing toward each other within one floor bump (so a pushed shop can bump its attacker below it).
export function classify(g: GameState, s: Shop, d: Dir): MoveResult {
  const t = s.col + d;
  if (t < 0 || t >= g.C) return { type: 'wall' };
  const S = s.level;
  const colT = g.cols[t];
  const H = colT.length;

  // Head-on: someone in the target column pressing toward us, bodies overlapping
  for (const i of colT) {
    const x = g.shops[i];
    if (x.pressing && x.input === -d && Math.abs(x.level - S) <= 1) {
      const gap = Math.abs(t + x.off - (s.col + s.off));
      return gap <= g.config.MOVEMENT.bumpGap ? { type: 'bump', other: x } : { type: 'wait' };
    }
  }
  if (H <= S) return { type: 'free' };
  if (shopAt(g, t, S).walking) return { type: 'wait' };
  if (H === S + 1) return { type: 'free' };
  const B = shopAt(g, t, S + 1);
  if (B.walking || B.immuneT > 0) return { type: 'wait' };
  const f = t + d;
  // Edge towers can't be toppled: nowhere to fall
  if (f < 0 || f >= g.C) return { type: 'wall' };
  return { type: 'push', B, t, f };
}

/** Move s and everything it carries one column. */
function doMove(g: GameState, s: Shop, d: Dir): void {
  const from = s.col;
  const to = s.col + d;
  const moving = g.cols[from].splice(s.level);
  g.cols[to].push(...moving);
  reindex(g, from);
  reindex(g, to);
}

function topple(g: GameState, s: Shop, c: { t: number; f: number }): void {
  const { MOVEMENT } = g.config;
  const S = s.level;
  const fallen = g.cols[c.t].splice(S + 1);
  for (const i of fallen) {
    const x = g.shops[i];
    x.off = 0;
    x.walking = false;
    x.pressing = false;
    x.pushT = 0;
    x.stunT = MOVEMENT.stunTime;
    x.immuneT = MOVEMENT.immuneTime;
  }
  g.cols[c.f].push(...fallen);
  reindex(g, c.t);
  reindex(g, c.f);
  g.stats.topples++;
  s.contest = false;
  g.events.push({ type: 'topple', by: s.id, col: c.t, level: S + 1, fallen: fallen.map((i) => g.shops[i].id), to: c.f });
}

function bump(g: GameState, s: Shop, x: Shop, d: Dir): void {
  const { MOVEMENT, BOTS } = g.config;
  // A real push-back is the pushed shop bumping its attacker (or the reverse); any other bump abandons a push
  const real = (s.contest && s.contestTarget === x.id) || (x.contest && x.contestTarget === s.id);
  if (real) {
    s.contest = x.contest = false;
    g.stats.pushbacks++;
    g.events.push({ type: 'pushback', by: x.id, col: x.col, level: x.level });
  } else {
    if (s.contest) {
      s.contest = false;
      g.stats.abandoned++;
    }
    if (x.contest) {
      x.contest = false;
      g.stats.abandoned++;
    }
  }
  s.off = -d * MOVEMENT.bumpKnock;
  x.off = d * MOVEMENT.bumpKnock;
  s.stunT = x.stunT = MOVEMENT.bumpStun;
  s.pushT = x.pushT = 0;
  s.pressing = x.pressing = false;
  g.stats.bumps++;
  g.events.push({ type: 'bump', a: s.id, b: x.id });
  for (const y of [s, x]) {
    if (y.controller === 'human') continue;
    const chance = y.controller === 'newcomer' ? BOTS.newcomerYieldChance : BOTS.yieldChance;
    if (rand(g.rng.bots) < chance) y.mind.yieldUntil = g.t + BOTS.yieldTime + rand(g.rng.bots) * BOTS.yieldTimeJitter;
  }
}

/** Advance one shop's walk: lean, step, climb, push or bump; spring back when released. */
export function moveShop(g: GameState, s: Shop, dt: number): void {
  const { MOVEMENT } = g.config;
  const inp: Dir = s.stunT > 0 ? 0 : s.input;
  s.pressing = inp !== 0;
  if (s.contest && inp !== s.lastDir) {
    s.contest = false;
    g.stats.abandoned++;
  }
  if (inp !== 0) {
    s.lastDir = inp;
    let off = s.off + (inp * dt) / MOVEMENT.cellTime;
    let pushing = false;
    if (off * inp > MOVEMENT.lean) {
      const c = classify(g, s, inp);
      if (c.type === 'free') {
        if (s.contest) {
          s.contest = false;
          g.stats.dodged++;
        }
        if (off * inp >= COMMIT_AT) {
          doMove(g, s, inp);
          off -= inp;
        }
      } else if (c.type === 'bump') {
        bump(g, s, c.other, inp);
        s.walking = true;
        c.other.walking = true;
        return;
      } else if (c.type === 'push') {
        off = inp * MOVEMENT.lean;
        pushing = true;
        if (s.pushCol !== c.t) {
          s.pushT = 0;
          s.pushCol = c.t;
        }
        if (s.contest && s.contestTarget !== c.B.id) {
          g.stats.abandoned++;
          s.contest = false;
        }
        if (!s.contest) {
          s.contest = true;
          s.contestTarget = c.B.id;
          g.stats.pushStarts++;
        }
        s.pushT += dt;
        if (s.pushT >= MOVEMENT.pushTime) {
          topple(g, s, c);
          s.pushT = 0;
          pushing = false;
        }
      } else {
        off = inp * MOVEMENT.lean;
      }
    }
    if (!pushing) {
      s.pushT = 0;
      s.pushCol = NONE;
    }
    s.off = off;
  } else {
    s.pushT = 0;
    s.pushCol = NONE;
    const sp = (dt / MOVEMENT.cellTime) * MOVEMENT.springBack;
    s.off = Math.abs(s.off) <= sp ? 0 : s.off - Math.sign(s.off) * sp;
  }
  s.walking = inp !== 0 || s.off !== 0;
}
