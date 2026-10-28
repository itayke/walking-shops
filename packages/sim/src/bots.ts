import { rand } from './rng.ts';
import { entryShop, NONE, shopAt } from './street.ts';
import type { Dir, GameState, Shop } from './types.ts';

// Think time for a bot that never moves: longer than any round
const NEVER = 1e9;
// Columns scoring at or below this aren't worth leaving for; the bot stays where it is
const NOT_WORTH = -1;

/** Can a bot take column c for walk-ins? Empty, already mine, or a lone closed shop it can climb onto. */
function canTake(g: GameState, c: number, s: Shop): boolean {
  const col = g.cols[c];
  if (col.length === 0) return true;
  if (s.col === c) return entryShop(g, c) === s || shopAt(g, c, 0) === s;
  return col.length === 1 && shopAt(g, c, 0).closed;
}

/**
 * Reactive: look only at shoppers already crossing and at a crosswalk once noticed. A shopper is worth chasing if I
 * can sit within its sidestep range before it reaches the sidewalk.
 */
function reactiveTarget(g: GameState, s: Shop): number {
  const { BOTS, MOVEMENT, WALK_INS, WAVES } = g.config;
  const val = new Float64Array(g.C);
  for (const sh of g.shoppers) {
    if (sh.rise <= 0) continue;
    // Not noticed yet
    if (sh.cross - sh.rise < BOTS.botPerception) continue;
    const lo = Math.max(0, sh.origin - WALK_INS.sidestep);
    const hi = Math.min(g.C - 1, sh.origin + WALK_INS.sidestep);
    for (let c = lo; c <= hi; c++) {
      const travel = Math.abs(c - s.col) * MOVEMENT.cellTime + (c === s.col ? 0 : BOTS.stepOffDelay);
      if (travel <= sh.rise) val[c] += c === sh.origin ? BOTS.aheadValue : BOTS.sideValue;
    }
  }
  // A crosswalk that has appeared (and been noticed) pulls bots toward it
  const w = g.wave;
  if ((w.state === 'telegraph' || w.state === 'active') && g.t - w.start >= BOTS.botPerception) {
    const left =
      w.state === 'telegraph'
        ? w.end - g.t + WAVES.waveSpawn + WALK_INS.crossTime
        : ((WAVES.waveSize - w.spawned) / Math.max(1, WAVES.waveSize)) * WAVES.waveSpawn + WALK_INS.crossTime;
    for (let c = w.col0; c < w.col0 + WAVES.waveWidth; c++) {
      if (c < 0 || c >= g.C) continue;
      if (Math.abs(c - s.col) * MOVEMENT.cellTime + BOTS.stepOffDelay <= left) val[c] += BOTS.crosswalkValue;
    }
  }
  let best = s.col;
  let bv = NOT_WORTH;
  for (let c = 0; c < g.C; c++) {
    if (!canTake(g, c, s)) continue;
    const mine = c === s.col && entryShop(g, c) === s;
    const v = val[c] - BOTS.distanceCost * Math.abs(c - s.col) + (mine ? BOTS.holdBonus : 0) + rand(g.rng.bots) * BOTS.choiceJitter;
    if (v > bv) {
      bv = v;
      best = c;
    }
  }
  return best;
}

/** Be the top of the tallest column reachable (joining a column makes it one taller). */
function towerTarget(g: GameState, s: Shop): number {
  const { BOTS } = g.config;
  const own = g.cols[s.col];
  const ownTop = own.length - 1 === s.level;
  let best = s.col;
  let bv = ownTop ? own.length + BOTS.towerStayBias : NOT_WORTH;
  for (let c = 0; c < g.C; c++) {
    if (c === s.col) continue;
    const v = g.cols[c].length + 1 - BOTS.towerDistanceCost * Math.abs(c - s.col);
    if (v > bv) {
      bv = v;
      best = c;
    }
  }
  return best;
}

function nearestTower(g: GameState, s: Shop, minH: number): number {
  let best = NONE;
  let bd = Infinity;
  for (let c = 0; c < g.C; c++) {
    if (c === s.col || g.cols[c].length < minH) continue;
    const d = Math.abs(c - s.col) + rand(g.rng.bots) * g.config.BOTS.towerJitter;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}

function botThink(g: GameState, s: Shop): void {
  const { BOTS, ROUND } = g.config;
  const b = s.mind;
  const rng = g.rng.bots;
  const phase2 = g.t >= ROUND.paraStart;
  let next = NEVER;
  switch (s.controller) {
    case 'newcomer':
      b.target = reactiveTarget(g, s);
      next = BOTS.newcomerThink + rand(rng) * BOTS.newcomerThinkJitter;
      break;
    case 'climber':
      b.target = phase2 ? towerTarget(g, s) : reactiveTarget(g, s);
      next = BOTS.plannerThink + rand(rng) * BOTS.plannerThinkJitter;
      break;
    case 'aggressor': {
      if (phase2) b.target = towerTarget(g, s);
      else {
        const tower = rand(rng) < BOTS.huntChance ? nearestTower(g, s, BOTS.huntMinHeight) : NONE;
        b.target = tower >= 0 ? tower : reactiveTarget(g, s);
      }
      next = BOTS.plannerThink + rand(rng) * BOTS.plannerThinkJitter;
      break;
    }
    case 'sitter':
      b.target = NONE;
      break;
    case 'random':
      b.target = rand(rng) < BOTS.randomRestChance ? NONE : Math.floor(rand(rng) * g.C);
      next = BOTS.randomThink + rand(rng) * BOTS.randomThinkJitter;
      break;
    case 'human':
      return;
  }
  b.think = g.t + next * BOTS.botReaction;
}

/** Set a bot shop's input for this tick: defend, keep the shutters open, yield after a bump, or head for its target. */
export function botUpdate(g: GameState, s: Shop, dt: number): void {
  const { BOTS, IDLE } = g.config;
  const b = s.mind;
  const rng = g.rng.bots;
  if (g.t >= b.think && g.t >= b.commitUntil) botThink(g, s);

  // Defend: if I'm the shop directly above someone being pushed, push back after a reaction delay
  if (s.controller === 'climber' || s.controller === 'aggressor') {
    const attacker = g.shops.find((a) => a.pushT > 0 && a.pushCol === s.col && a.level + 1 === s.level);
    if (attacker) {
      if (b.reactAt < 0) b.reactAt = g.t + (BOTS.defendDelay + rand(rng) * BOTS.defendDelayJitter) * BOTS.botReaction;
      if (g.t >= b.reactAt && b.defendUntil < g.t) {
        b.defendUntil = g.t + BOTS.defendHold;
        b.defendDir = Math.sign(attacker.col - s.col) as Dir;
      }
    } else b.reactAt = NONE;
  }
  if (g.t < b.defendUntil) {
    s.input = b.defendDir;
    return;
  }

  // Keep-alive: notice the shutters starting to drop and tap a direction (a lean that springs back)
  if (s.controller !== 'sitter' && IDLE.idleOn && s.idleT > IDLE.idleTime - IDLE.idleWarn) {
    if (b.wakeAt < 0) b.wakeAt = g.t + (BOTS.wakeDelay + rand(rng) * BOTS.wakeDelayJitter) * BOTS.botReaction;
    if (g.t >= b.wakeAt) {
      b.wakeAt = NONE;
      b.tapUntil = g.t + BOTS.tapTime;
      b.tapDir = s.col === 0 ? 1 : s.col === g.C - 1 ? -1 : rand(rng) < 0.5 ? -1 : 1;
    }
  } else b.wakeAt = NONE;
  if (g.t < b.tapUntil) {
    s.input = b.tapDir;
    return;
  }

  if (g.t < b.yieldUntil) {
    s.input = 0;
    return;
  }

  s.input = b.target < 0 ? 0 : (Math.sign(b.target - s.col) as Dir);

  // Stuck: pressing but not getting anywhere and not mid-push
  if (s.input !== 0 && s.col === b.lastCol && s.pushT === 0) b.stuckT += dt;
  else b.stuckT = 0;
  b.lastCol = s.col;
  if (b.stuckT > BOTS.stuckTime && s.controller !== 'aggressor') {
    b.stuckT = 0;
    b.target = Math.floor(rand(rng) * g.C);
    b.commitUntil = g.t + BOTS.stuckCommit;
  }
}
