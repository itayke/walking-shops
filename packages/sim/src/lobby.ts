import { columnCount, type Config } from './config.ts';
import { createGame, freshMind, freshStats, freshWave, makeShop } from './create.ts';
import { rand } from './rng.ts';
import { reindex } from './street.ts';
import type { GameState, PlayerSpec, Shop } from './types.ts';

// The lobby: shops join one by one and brawl under the movement rules alone, then the round carries on from there.

/** An empty street waiting for players, laid out for at least minPlayers so it rarely widens as they join. */
export function createLobby(config: Config, seed: number): GameState {
  const g = createGame(config, [], seed);
  g.lobby = true;
  widen(g);
  return g;
}

/** Add a shop on top of a column: a random empty one, else one of the lowest. */
export function addShop(g: GameState, p: PlayerSpec): Shop {
  return place(g, p, randomOf(g, emptyOrLowest(g)));
}

/** Take a shop off the street; whatever it carried drops a floor. */
export function removeShop(g: GameState, id: string): void {
  const i = g.shops.findIndex((s) => s.id === id);
  if (i < 0) return;
  const c = g.shops[i].col;
  g.cols[c].splice(g.cols[c].indexOf(i), 1);
  g.shops.splice(i, 1);
  g.N--;
  // Every later shop moved down one index
  for (const col of g.cols) for (let k = 0; k < col.length; k++) if (col[k] > i) col[k]--;
  reindex(g, c);
}

/**
 * Start the round from the lobby's street: bots from `bots` (in order) drop into the widest empty gaps until there are
 * minPlayers shops, and the clock, stats and scores start from zero.
 */
export function beginRound(g: GameState, bots: readonly PlayerSpec[]): void {
  const fill = bots.slice(0, Math.max(0, g.config.ROUND.minPlayers - g.N));
  // Full width first, so the gaps are measured on the street the round is played on
  widen(g, g.N + fill.length);
  for (const p of fill) place(g, p, randomOf(g, farthestEmpty(g)));
  // Walk start times stay in order, now before zero
  for (const s of g.shops) s.moveSince -= g.t;
  g.t = 0;
  g.lobby = false;
  g.over = false;
  g.podium = null;
  g.wave = freshWave(g.config);
  g.stats = freshStats();
  g.shoppers = [];
  g.paras = [];
  for (const s of g.shops) resetRound(s);
}

/**
 * The presenter skips ahead: the round clock jumps forward to `t`. Whatever the clock times (the waves, phase 2, the
 * round's end) catches up on the next tick; shops, shoppers and scores stay as they are.
 */
export function skipTo(g: GameState, t: number): void {
  if (g.lobby || g.over || t <= g.t) return;
  g.t = t;
}

/** Back to the lobby after a round: the bots leave, everyone else keeps their place and starts from zero. */
export function toLobby(g: GameState): void {
  for (const s of g.shops.filter((x) => x.controller !== 'human')) removeShop(g, s.id);
  g.lobby = true;
  g.over = false;
  g.podium = null;
  g.shoppers = [];
  g.paras = [];
  for (const s of g.shops) resetRound(s);
}

function resetRound(s: Shop): void {
  s.income = s.incGround = s.incPara = 0;
  s.idleT = 0;
  s.closed = false;
  s.closedTicks = s.sitGround = s.ticks = 0;
  s.served = s.topples = 0;
  s.mind = freshMind();
}

function place(g: GameState, p: PlayerSpec, c: number): Shop {
  if (g.shops.some((s) => s.id === p.id)) throw new Error(`Duplicate player id ${p.id}`);
  const s = makeShop(p);
  g.shops.push(s);
  g.N++;
  widen(g);
  // A wider street has new empty columns at its right edge; c is still a valid column
  g.cols[c].push(g.shops.length - 1);
  reindex(g, c);
  return s;
}

/** Grow the street (never shrink it, so nobody moves) to fit `players` shops, counting at least minPlayers. */
function widen(g: GameState, players = g.N): void {
  const want = columnCount(g.config.STREET, Math.max(players, g.config.ROUND.minPlayers));
  while (g.cols.length < want) g.cols.push([]);
  g.C = g.cols.length;
}

function randomOf(g: GameState, cols: number[]): number {
  return cols[Math.floor(rand(g.rng.world) * cols.length)];
}

/** Empty columns, else the lowest stacks. */
function emptyOrLowest(g: GameState): number[] {
  const low = Math.min(...g.cols.map((col) => col.length));
  return g.cols.flatMap((col, c) => (col.length === low ? [c] : []));
}

/** The empty columns farthest from any shop (the middle of the widest gap, or the street's end), else the lowest stacks. */
function farthestEmpty(g: GameState): number[] {
  const taken = g.cols.flatMap((col, c) => (col.length > 0 ? [c] : []));
  if (taken.length === 0 || taken.length === g.C) return emptyOrLowest(g);
  const gap = g.cols.map((col, c) => (col.length > 0 ? 0 : Math.min(...taken.map((t) => Math.abs(t - c)))));
  const widest = Math.max(...gap);
  return gap.flatMap((d, c) => (d === widest ? [c] : []));
}
