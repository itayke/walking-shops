import { moveShop } from './movement.ts';
import { shuffle } from './rng.ts';
import { NONE, reindex } from './street.ts';
import type { Dir, GameState, Inputs, PodiumStage, Shop } from './types.ts';

// The end card. The round is over and the street becomes a podium: the sim walks everyone to the sides, drops the
// blocks into the cleared middle and walks the winners up onto them, then hands the controls back for free play.

// Past this much of a cell, a walk moves the shop into the next column, as a step does
const COMMIT_AT = 0.5;

/** Shops ranked by money, best first; ties keep their order on the street's list. */
export function ranking(g: GameState): Shop[] {
  return g.shops
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.income - a.s.income || a.i - b.i)
    .map(({ s }) => s);
}

/**
 * Start the end card on a finished round: the customers and the crosswalk are gone, every shop is still, open and
 * steady, and sets off for the sides.
 */
export function startPodium(g: GameState): void {
  g.shoppers = [];
  g.paras = [];
  // No more waves: the crosswalk comes off the road
  g.wave.state = 'pause';
  const { PODIUM } = g.config;
  const top = ranking(g).slice(0, [PODIUM.firstBlocks, PODIUM.secondBlocks, PODIUM.thirdBlocks].length);
  // Second, first and third stand left to right around the middle of the street
  const mid = Math.floor(g.C / 2);
  const cols = [mid, mid - 1, mid + 1].slice(0, top.length);
  g.podium = { stage: 'clear', t: 0, top: top.map((s) => s.id), cols, blocks: g.cols.map(() => 0), targets: {} };
  for (const s of g.shops) {
    s.input = 0;
    s.stepDir = 0;
    s.pressing = false;
    s.stunT = s.immuneT = 0;
    s.pushT = 0;
    s.pushCol = NONE;
    s.contest = false;
    s.idleT = 0;
    s.closed = false;
  }
  // An empty street still gets a podium, with nobody to stand on it
  g.podium.targets = cols.length > 0 ? sideSlots(g, Math.min(...cols), Math.max(...cols)) : {};
}

/**
 * A column on either side of the podium for every shop, spread along each side and stacked when there are more shops
 * than columns. Shops keep their order along the street, so nobody has to cross anyone to get there.
 */
function sideSlots(g: GameState, lo: number, hi: number): Record<string, number> {
  const left = Array.from({ length: Math.max(0, lo) }, (_, c) => c);
  const right = Array.from({ length: Math.max(0, g.C - 1 - hi) }, (_, i) => hi + 1 + i);
  const order = g.shops.slice().sort((a, b) => a.col - b.col || a.level - b.level);
  const n = order.length;
  const toLeft = right.length === 0 ? n : Math.round((n * left.length) / (left.length + right.length));
  const out: Record<string, number> = {};
  const spread = (shops: Shop[], cols: number[]) =>
    shops.forEach((s, i) => (out[s.id] = cols[Math.floor(((i + 1 / 2) * cols.length) / shops.length)]));
  spread(order.slice(0, toLeft), left);
  spread(order.slice(toLeft), right);
  return out;
}

/** One tick of the end card. While the sim has the controls, inputs are ignored. */
export function stepPodium(g: GameState, inputs: Inputs, dt: number): void {
  const p = g.podium!;
  const { PODIUM } = g.config;
  p.t += dt;
  for (const s of g.shops) {
    if (s.stunT > 0) s.stunT = Math.max(0, s.stunT - dt);
    if (s.immuneT > 0) s.immuneT = Math.max(0, s.immuneT - dt);
  }
  if (p.stage === 'free') {
    // Free play, like the lobby: only the phones move; bots leave the podium to them
    for (const s of g.shops) {
      const v = s.controller === 'human' ? inputs[s.id] : 0;
      s.input = v === 1 || v === -1 ? v : 0;
    }
    for (const s of shuffle(g.shops.slice(), g.rng.world)) moveShop(g, s, dt);
    return;
  }
  const arrived = walkAll(g, dt);
  if (p.stage === 'clear' && ((arrived && p.cols.every((c) => g.cols[c].length === 0)) || p.t >= PODIUM.clearMax)) {
    const heights = [PODIUM.firstBlocks, PODIUM.secondBlocks, PODIUM.thirdBlocks];
    p.cols.forEach((c, place) => (p.blocks[c] = heights[place]));
    // Whoever is still in the middle is stopped and lifted onto the blocks
    for (const c of p.cols) for (const i of g.cols[c]) delete p.targets[g.shops[i].id];
    advance(g, 'blocks');
  } else if (p.stage === 'blocks' && p.t >= PODIUM.blockSettle) advance(g, 'winners');
  else if (p.stage === 'winners') {
    // Third place sets off first, the winner last
    const order = p.top.map((id, place) => ({ id, col: p.cols[place] })).reverse();
    order.forEach((w, k) => {
      if (p.t >= k * PODIUM.winnerGap && !(w.id in p.targets) && g.shops.find((s) => s.id === w.id)!.col !== w.col) p.targets[w.id] = w.col;
    });
    const sentAll = p.t >= (order.length - 1) * PODIUM.winnerGap;
    if (sentAll && arrived && Object.keys(p.targets).length === 0) advance(g, 'crowned');
  } else if (p.stage === 'crowned' && p.t >= PODIUM.freeAfter) advance(g, 'free');
}

function advance(g: GameState, stage: PodiumStage): void {
  g.podium!.stage = stage;
  g.podium!.t = 0;
  g.events.push({ type: 'podium', stage });
}

/** Walk every shop with somewhere to be; true once nobody is walking. */
function walkAll(g: GameState, dt: number): boolean {
  const p = g.podium!;
  let all = true;
  for (const s of g.shops) {
    const target = p.targets[s.id];
    if (target === undefined) continue;
    if (walkTo(g, s, target, dt)) {
      delete p.targets[s.id];
      s.walking = s.pressing = false;
      s.stepDir = 0;
    } else all = false;
  }
  return all;
}

/**
 * Walk a shop toward a column on the takeover's own terms: it climbs over whatever is in the way, never pushed or
 * bumped, and settles on top of its column. Only the top of a stack walks off; one held down by shops that stay put
 * climbs out on top first. It falls in behind a shop walking the same way. True once it's there.
 */
function walkTo(g: GameState, s: Shop, target: number, dt: number): boolean {
  const p = g.podium!;
  const step = dt / g.config.MOVEMENT.cellTime;
  if (s.col === target) {
    // Finish the step into the cell
    s.off = Math.abs(s.off) <= step ? 0 : s.off - Math.sign(s.off) * step;
    s.walking = s.off !== 0;
    return !s.walking;
  }
  const d: Dir = target > s.col ? 1 : -1;
  const col = g.cols[s.col];
  const i = col[s.level];
  if (s.level < col.length - 1) {
    const leaving = col.slice(s.level + 1).some((k) => g.shops[k].id in p.targets);
    if (leaving) return false;
    col.splice(s.level, 1);
    col.push(i);
    reindex(g, s.col);
  }
  s.stepDir = d;
  s.lastDir = d;
  s.pressing = s.walking = true;
  let off = s.off + d * step;
  if (off * d >= COMMIT_AT) {
    const next = g.cols[s.col + d];
    const ahead = next.length > 0 ? g.shops[next[next.length - 1]] : null;
    if (ahead && ahead.walking && ahead.stepDir === d) off = d * COMMIT_AT;
    else {
      const from = s.col;
      col.splice(s.level, 1);
      next.push(i);
      reindex(g, from);
      reindex(g, from + d);
      off -= d;
    }
  }
  s.off = off;
  return false;
}
