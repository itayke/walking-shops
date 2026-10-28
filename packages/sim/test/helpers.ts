import { checkInvariants, createGame, makeConfig, step, TICK, type ConfigOverrides, type GameState, type Inputs, type Shop, type SimEvent } from '../src/index.ts';
import { reindex } from '../src/street.ts';

// Far beyond any test's run time
export const NEVER = 1e9;

// A quiet street: no customers, no parachutes, no shutters, no end, unless a test turns them on
export const QUIET: ConfigOverrides = {
  ROUND: { roundTime: NEVER, paraStart: NEVER },
  WAVES: { firstWave: NEVER },
  WALK_INS: { trickleRate: 0 },
  PARACHUTES: { paraRate: 0 },
  IDLE: { idleOn: false },
};

function merge(a: ConfigOverrides, b: ConfigOverrides): ConfigOverrides {
  const out: Record<string, object> = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = { ...(out[k] ?? {}), ...v };
  return out as ConfigOverrides;
}

/** A street of human shops laid out by id, one array per column, bottom to top: [['A'], ['B', 'C'], []]. */
export function street(layout: string[][], over: ConfigOverrides = {}): GameState {
  const ids = layout.flat();
  const g = createGame(makeConfig(merge(QUIET, over)), ids.map((id) => ({ id, label: id, controller: 'human' })), 1);
  g.C = layout.length;
  g.cols = layout.map((col) => col.map((id) => ids.indexOf(id)));
  for (let c = 0; c < g.C; c++) reindex(g, c);
  checkInvariants(g);
  return g;
}

export function shop(g: GameState, id: string): Shop {
  const s = g.shops.find((x) => x.id === id);
  if (!s) throw new Error(`No shop ${id}`);
  return s;
}

/** Ids in column c, bottom to top. */
export function column(g: GameState, c: number): string[] {
  return g.cols[c].map((i) => g.shops[i].id);
}

/** Step for `seconds` with fixed or per-tick inputs, checking invariants after every tick. Returns all events. */
export function run(g: GameState, seconds: number, inputs: Inputs | ((g: GameState) => Inputs) = {}): SimEvent[] {
  const events: SimEvent[] = [];
  const ticks = Math.round(seconds / TICK);
  for (let i = 0; i < ticks; i++) {
    events.push(...step(g, typeof inputs === 'function' ? inputs(g) : inputs));
    checkInvariants(g);
  }
  return events;
}

/** Step until an event of `type` happens (or `limit` seconds pass); returns the time it happened, or null. */
export function runUntil(g: GameState, type: SimEvent['type'], inputs: Inputs, limit: number): number | null {
  const ticks = Math.round(limit / TICK);
  for (let i = 0; i < ticks; i++) {
    const ev = step(g, inputs);
    checkInvariants(g);
    if (ev.some((e) => e.type === type)) return g.t;
  }
  return null;
}

export const ofType = <T extends SimEvent['type']>(events: SimEvent[], type: T) =>
  events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
