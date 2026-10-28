import { rand } from './rng.ts';
import { pay } from './scoring.ts';
import { entryShop, maxHeight, NONE } from './street.ts';
import type { GameState, Shop } from './types.ts';

// Attempts to place a crosswalk at least one width from the last before settling for wherever it lands
const PLACE_TRIES = 30;
// Floor on waveSpawn when pacing a wave, so a zero spawn time steps everyone off at once
const MIN_SPAWN_TIME = 0.05;
// A shopper choosing among equally near shops prefers the one straight ahead
const SIDESTEP_TIEBREAK = 0.01;
const SECONDS_PER_MINUTE = 60;
// Slack when comparing accumulated tick time against bar boundaries
const TIME_EPSILON = 1e-9;

function crossShopper(g: GameState, c: number): void {
  const { WALK_INS } = g.config;
  g.shoppers.push({ x: c, origin: c, rise: WALK_INS.crossTime, cross: WALK_INS.crossTime, life: WALK_INS.shopperLife });
  g.stats.spawned++;
}

/** A shopper already at street level in column c (a parachuter that found no open shop). */
function landShopper(g: GameState, c: number): void {
  const { WALK_INS } = g.config;
  g.stats.spawned++;
  g.shoppers.push({ x: c, origin: c, rise: 0, cross: WALK_INS.crossTime, life: WALK_INS.shopperLife });
}

/** Crosswalk cycle: pause -> telegraph (bars drawn) -> active (shoppers step off) -> crossing -> pause. Plus trickle. */
export function spawnWalkIns(g: GameState, dt: number, groundOn: boolean): void {
  const { WAVES, WALK_INS } = g.config;
  const rng = g.rng.world;
  const W = g.wave;
  const width = crosswalkWidth(g);
  if (W.state === 'pause' && g.t >= W.end && groundOn) {
    let c0 = 0;
    for (let k = 0; k < PLACE_TRIES; k++) {
      c0 = Math.floor(rand(rng) * (g.C - width + 1));
      if (W.col0 === NONE || Math.abs(c0 - W.col0) >= width) break;
    }
    W.col0 = c0;
    W.state = 'telegraph';
    W.start = g.t;
    W.end = g.t + WAVES.waveLines * WAVES.waveLineInterval;
    W.spawned = 0;
  } else if (W.state === 'telegraph' && g.t >= W.end) {
    W.state = 'active';
    W.end = g.t + WAVES.waveSpawn;
  } else if (W.state === 'active') {
    const progress = 1 - Math.max(0, W.end - g.t) / Math.max(MIN_SPAWN_TIME, WAVES.waveSpawn);
    const due = Math.min(WAVES.waveSize, Math.ceil(WAVES.waveSize * progress));
    while (W.spawned < due) {
      crossShopper(g, W.col0 + Math.floor(rand(rng) * width));
      W.spawned++;
    }
    if (W.spawned >= WAVES.waveSize) {
      W.state = 'crossing';
      W.end = g.t + WALK_INS.crossTime;
    }
  } else if (W.state === 'crossing' && g.t >= W.end) {
    W.state = 'pause';
    W.end = g.t + WAVES.wavePause;
  }
  if (groundOn) {
    const n = Math.floor(((g.N * WALK_INS.trickleRate) / SECONDS_PER_MINUTE) * dt + rand(rng));
    for (let k = 0; k < n; k++) crossShopper(g, Math.floor(rand(rng) * g.C));
  }
}

/** Columns a crosswalk spans, starting at wave.col0. */
export function crosswalkWidth(g: GameState): number {
  return Math.max(1, Math.min(g.C, Math.floor(g.config.WAVES.waveWidth)));
}

/** Telegraph bars drawn on the current crosswalk, bottom to top: one per waveLineInterval, all of them once it's live. */
export function telegraphBars(g: GameState): number {
  const { WAVES } = g.config;
  const W = g.wave;
  if (W.state === 'pause') return 0;
  if (W.state !== 'telegraph') return WAVES.waveLines;
  const drawn = Math.floor((g.t - W.start) / WAVES.waveLineInterval + TIME_EPSILON);
  return Math.max(0, Math.min(WAVES.waveLines, drawn));
}

/** Where parachuters start (before jitter): sky floors up, or skyClearance above the tallest tower. */
export function parachuteSky(g: GameState): number {
  const { PARACHUTES: P } = g.config;
  return Math.max(P.sky, maxHeight(g) + P.skyClearance);
}

export function spawnParachuters(g: GameState, dt: number): void {
  const { PARACHUTES: P } = g.config;
  const rng = g.rng.world;
  const n = Math.floor(((g.N * P.paraRate) / SECONDS_PER_MINUTE) * dt + rand(rng));
  const sky = parachuteSky(g);
  for (let k = 0; k < n; k++) {
    const x = rand(rng) * (g.C - 1);
    const y = sky + rand(rng) * P.skyJitter;
    const speed = P.wind * (P.windMin + rand(rng) * (1 - P.windMin));
    g.paras.push({ x, y, vx: rand(rng) < 0.5 ? -speed : speed });
  }
}

/** Shoppers cross, then enter the open sitting shop in front of them (or a sidestep away), else leave. */
export function updateShoppers(g: GameState, dt: number): void {
  const { WALK_INS } = g.config;
  const entries: (Shop | null)[] = [];
  for (let c = 0; c < g.C; c++) entries.push(entryShop(g, c));
  const keep = [];
  for (const sh of g.shoppers) {
    if (sh.rise > 0) {
      sh.rise -= dt;
      keep.push(sh);
      continue;
    }
    let best: Shop | null = null;
    let bd = Infinity;
    const lo = Math.max(0, sh.origin - WALK_INS.sidestep);
    const hi = Math.min(g.C - 1, sh.origin + WALK_INS.sidestep);
    for (let c = lo; c <= hi; c++) {
      const e = entries[c];
      if (!e) continue;
      const d = Math.abs(c - sh.x) + Math.abs(c - sh.origin) * SIDESTEP_TIEBREAK;
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    sh.life -= dt;
    if (!best || sh.life <= 0) {
      g.stats.lost++;
      g.events.push({ type: 'lost', x: sh.x });
      continue;
    }
    const dx = best.col - sh.x;
    const stp = WALK_INS.shopperSpeed * dt;
    if (Math.abs(dx) <= stp) pay(g, best, 1, 'ground');
    else {
      sh.x += Math.sign(dx) * stp;
      keep.push(sh);
    }
  }
  g.shoppers = keep;
}

/** Parachuters enter the first open shop they touch, from the top; walking shops stand walkLift taller. */
export function updateParachuters(g: GameState, dt: number): void {
  const { PARACHUTES: P, MOVEMENT, SCORING } = g.config;
  const keep = [];
  for (const pa of g.paras) {
    pa.y -= P.paraSpeed * dt;
    pa.x += pa.vx * dt;
    if (pa.x < 0) {
      pa.x = 0;
      pa.vx = -pa.vx;
    }
    if (pa.x > g.C - 1) {
      pa.x = g.C - 1;
      pa.vx = -pa.vx;
    }
    const pc = Math.round(pa.x);
    const col = g.cols[pc];
    const H = col.length;
    if (H > 0) {
      const top = H + (col.some((i) => g.shops[i].walking) ? MOVEMENT.walkLift : 0);
      if (pa.y <= top) {
        let catcher: Shop | null = null;
        for (let L = H - 1; L >= 0; L--) {
          const s = g.shops[col[L]];
          if (!s.closed) {
            catcher = s;
            break;
          }
        }
        // Every shop in the column is shuttered: the parachuter lands on the sidewalk and walks
        if (catcher) pay(g, catcher, SCORING.paraValue, 'para');
        else landShopper(g, pc);
        continue;
      }
    } else if (pa.y <= 0) {
      landShopper(g, pc);
      continue;
    }
    keep.push(pa);
  }
  g.paras = keep;
}
