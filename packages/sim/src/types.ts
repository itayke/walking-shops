import type { Config } from './config.ts';

export type Dir = -1 | 0 | 1;

export const BOT_TYPES = ['newcomer', 'climber', 'aggressor', 'random', 'sitter'] as const;
export type BotType = (typeof BOT_TYPES)[number];
export type Controller = 'human' | BotType;

/** Who plays a shop. Human shops take their input from step(); bots compute their own. */
export interface PlayerSpec {
  id: string;
  label: string;
  controller: Controller;
}

/** A bot's plan and timers. Every shop carries one so a phone can hand its shop to a bot mid-round. */
export interface BotMind {
  think: number;
  target: number;
  stuckT: number;
  lastCol: number;
  reactAt: number;
  defendUntil: number;
  defendDir: Dir;
  commitUntil: number;
  yieldUntil: number;
  wakeAt: number;
  tapUntil: number;
  tapDir: Dir;
}

export interface Shop {
  id: string;
  label: string;
  controller: Controller;
  // Grid position: column and stack level, plus the offset into the next cell while walking (-1..1)
  col: number;
  level: number;
  off: number;
  input: Dir;
  lastDir: Dir;
  walking: boolean;
  pressing: boolean;
  stunT: number;
  immuneT: number;
  // Sustained push on the tower in pushCol; contest tracks the shop being pushed, for push-back stats
  pushT: number;
  pushCol: number;
  contest: boolean;
  contestTarget: string | null;
  income: number;
  incGround: number;
  incPara: number;
  idleT: number;
  closed: boolean;
  closedTicks: number;
  sitGround: number;
  ticks: number;
  mind: BotMind;
}

/** A walk-in: crosses the street toward `origin` for `rise` seconds, then walks the sidewalk at `x`. */
export interface Shopper {
  x: number;
  origin: number;
  rise: number;
  cross: number;
  life: number;
}

export interface Parachuter {
  x: number;
  y: number;
  vx: number;
}

export type WaveState = 'pause' | 'telegraph' | 'active' | 'crossing';

/** The crosswalk cycle: pause, telegraph (bars drawn), active (shoppers step off), crossing (last ones in flight). */
export interface Wave {
  state: WaveState;
  // When the current state ends
  end: number;
  col0: number;
  start: number;
  spawned: number;
}

export interface Stats {
  closures: number;
  paraCaught: number;
  paraByTower: number;
  spawned: number;
  topples: number;
  bumps: number;
  pushbacks: number;
  pushStarts: number;
  dodged: number;
  abandoned: number;
  lost: number;
  maxHeight: number;
}

export interface RngState {
  s: number;
}

export type SimEvent =
  | { type: 'topple'; by: string; col: number; level: number; fallen: string[]; to: number }
  | { type: 'bump'; a: string; b: string }
  | { type: 'pushback'; by: string; col: number; level: number }
  | { type: 'closed'; shop: string }
  | { type: 'reopened'; shop: string }
  | { type: 'paid'; shop: string; value: number; kind: 'ground' | 'para' }
  | { type: 'lost'; x: number };

/**
 * The whole game. Plain data: shops are referenced by index into `shops`, so the state survives JSON round trips.
 * `config` is held by reference, so tuning it live applies on the next tick.
 */
export interface GameState {
  config: Config;
  t: number;
  over: boolean;
  N: number;
  C: number;
  shops: Shop[];
  // Shop indices per column, bottom to top
  cols: number[][];
  shoppers: Shopper[];
  paras: Parachuter[];
  wave: Wave;
  stats: Stats;
  // World events (spawns, waves, parachutes) and bot decisions draw from separate streams, so a human's input or a
  // bot tweak doesn't reshuffle where customers appear
  rng: { world: RngState; bots: RngState };
  // This tick's events, also returned by step()
  events: SimEvent[];
}

/** Held direction per human shop id; a missing id means no input. */
export type Inputs = Readonly<Record<string, Dir>>;
