// All tunables live here, grouped in sections. The screen's tuning panel edits these objects in place, and its save
// button rewrites the `key: value,` lines below, so keep one key per line and keys unique across sections.
// Times are in seconds, positions in columns and floors.

// Fixed logic tick, in seconds. Not tunable: golden replays and the bench assume it
export const TICK = 0.05;

// Round length and when phase 2 (parachutes) begins
export const ROUND = {
  roundTime: 120,
  paraStart: 60,
};

// Column count is max(players + colsExtra, players × colsPerPlayer), clamped to [colsMin, colsCap].
// Read when a game is created; changes apply on restart
export const STREET = {
  colsMin: 6,
  colsCap: 18,
  colsExtra: 4,
  colsPerPlayer: 1.5,
};

// Walking, climbing, pushing and bumping. lean is how far a blocked shop leans into the next cell; bumpGap is how
// close two walkers get before they bump, and bumpKnock how far a bump throws each back; springBack is how much faster
// than walking a released shop snaps back to its cell
export const MOVEMENT = {
  cellTime: 0.45,
  walkLift: 1,
  pushTime: 0.9,
  stunTime: 0.5,
  immuneTime: 2,
  bumpStun: 0.35,
  lean: 0.3,
  bumpGap: 0.45,
  bumpKnock: 0.3,
  springBack: 1.6,
};

// Walk-ins cross from the bottom edge toward the shop in front of them. trickleRate is per player per minute;
// shopperSpeed is how fast a shopper walks along the sidewalk, in columns per second; shopperLife is how long one
// looks for a shop before leaving
export const WALK_INS = {
  crossTime: 2.5,
  sidestep: 0,
  trickleRate: 4,
  groundInPhase2: true,
  shopperSpeed: 5,
  shopperLife: 3,
};

// Crosswalk waves. A crosswalk appears, draws waveLines bars one per waveLineInterval (bottom to top), and the wave
// steps off with the last bar: waveSize shoppers over waveSpawn. After they cross it waits wavePause before the next.
// firstWave is when the first crosswalk can appear
export const WAVES = {
  waveWidth: 4,
  waveLines: 4,
  waveLineInterval: 0.5,
  waveSize: 20,
  waveSpawn: 3,
  wavePause: 4,
  firstWave: 1,
};

// Phase 2 parachuters. paraRate is per player per minute. Each drifts sideways at between windMin × wind and wind
// columns per second and falls at paraSpeed floors per second, starting at sky floors (or skyClearance above the
// tallest tower), plus up to skyJitter
export const PARACHUTES = {
  paraRate: 12,
  wind: 0.8,
  windMin: 0.5,
  paraSpeed: 1.5,
  sky: 7.2,
  skyClearance: 2.2,
  skyJitter: 0.6,
};

// Idle shutters: no input for idleTime closes a shop; the shutters drop visibly over the last idleWarn
export const IDLE = {
  idleOn: true,
  idleTime: 12,
  idleWarn: 4,
};

// A customer pays the shop it enters. Phase 1 earnings count × phase1Weight; a parachuter is worth paraValue walk-ins
export const SCORING = {
  phase1Weight: 0.3,
  paraValue: 3,
};

// Bots that fill the street when no phones are playing (bench, offline fallback). Read when a game is created
export const BOT_MIX = {
  newcomer: 5,
  climber: 4,
  aggressor: 2,
  random: 2,
  sitter: 2,
};

// Bot behavior. botReaction scales every bot delay; botPerception is how long before a bot notices a new shopper or
// crosswalk. <x>Jitter is the random extra on top of <x>. Planners are climbers and aggressors
export const BOTS = {
  botReaction: 1,
  botPerception: 0.4,
  newcomerThink: 0.3,
  newcomerThinkJitter: 0.3,
  plannerThink: 0.5,
  plannerThinkJitter: 0.4,
  randomThink: 0.4,
  randomThinkJitter: 2,
  // Chance a random bot decides to sit instead of picking a column
  randomRestChance: 0.3,
  // Chance an aggressor in phase 1 hunts a tower of at least huntMinHeight instead of chasing shoppers
  huntChance: 0.6,
  huntMinHeight: 2,
  defendDelay: 0.45,
  defendDelayJitter: 0.6,
  defendHold: 0.4,
  // Noticing the shutters dropping, then tapping a direction for tapTime to keep the shop open
  wakeDelay: 0.5,
  wakeDelayJitter: 2.5,
  tapTime: 0.12,
  // After a bump, a bot may hold still for yieldTime
  newcomerYieldChance: 0.6,
  yieldChance: 0.3,
  yieldTime: 0.5,
  yieldTimeJitter: 0.6,
  // Pressing without moving for stuckTime picks a random column and commits to it for stuckCommit
  stuckTime: 3,
  stuckCommit: 1.5,
  // Column scoring when chasing shoppers: aheadValue per shopper headed there (sideValue if a sidestep away),
  // crosswalkValue per crosswalk column, minus distanceCost per column away; holdBonus for staying where I already
  // catch walk-ins. stepOffDelay is extra travel time for leaving my column
  aheadValue: 1,
  sideValue: 0.6,
  crosswalkValue: 2.5,
  distanceCost: 0.15,
  holdBonus: 0.6,
  choiceJitter: 0.05,
  stepOffDelay: 0.15,
  // Tower seeking in phase 2: prefer the tallest column, minus towerDistanceCost per column away, with towerStayBias
  // for already topping my own
  towerDistanceCost: 0.15,
  towerStayBias: 0.3,
  towerJitter: 0.3,
};

export const CONFIG = { ROUND, STREET, MOVEMENT, WALK_INS, WAVES, PARACHUTES, IDLE, SCORING, BOT_MIX, BOTS };
export type Config = typeof CONFIG;
export type SectionName = keyof Config;
export type ConfigOverrides = { [S in SectionName]?: Partial<Config[S]> };

/** A detached copy of a config (the live one by default), with overrides applied per section. */
export function makeConfig(overrides: ConfigOverrides = {}, base: Config = CONFIG): Config {
  const copy = JSON.parse(JSON.stringify(base)) as Config;
  for (const name of Object.keys(overrides) as SectionName[]) Object.assign(copy[name], overrides[name]);
  return copy;
}

/** Columns for a street of `players` shops. */
export function columnCount(street: Config['STREET'], players: number): number {
  const wanted = Math.max(players + street.colsExtra, Math.round(players * street.colsPerPlayer));
  return Math.max(street.colsMin, Math.min(street.colsCap, wanted));
}
