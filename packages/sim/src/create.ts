import { BOT_MIX, columnCount, type Config } from './config.ts';
import { makeRng, shuffle } from './rng.ts';
import { NONE, reindex } from './street.ts';
import { BOT_TYPES, type BotMind, type Controller, type GameState, type PlayerSpec, type Shop } from './types.ts';

// Mixed into the seed for the bot stream, so it differs from the world stream
const BOT_STREAM_SALT = 0x9e3779b9;

const BOT_LETTER: Record<Controller, string> = { human: 'P', newcomer: 'N', climber: 'C', aggressor: 'A', random: 'R', sitter: 'S' };

export function freshMind(): BotMind {
  return {
    think: 0,
    target: NONE,
    stuckT: 0,
    lastCol: NONE,
    reactAt: NONE,
    defendUntil: NONE,
    defendDir: 0,
    commitUntil: NONE,
    yieldUntil: NONE,
    wakeAt: NONE,
    tapUntil: NONE,
    tapDir: 1,
  };
}

function makeShop(p: PlayerSpec): Shop {
  return {
    id: p.id,
    label: p.label,
    controller: p.controller,
    col: 0,
    level: 0,
    off: 0,
    input: 0,
    lastDir: 1,
    walking: false,
    pressing: false,
    stunT: 0,
    immuneT: 0,
    pushT: 0,
    pushCol: NONE,
    contest: false,
    contestTarget: null,
    income: 0,
    incGround: 0,
    incPara: 0,
    idleT: 0,
    closed: false,
    closedTicks: 0,
    sitGround: 0,
    ticks: 0,
    mind: freshMind(),
  };
}

/** Bot players for a mix like BOT_MIX, labeled N1, N2, C1… in BOT_TYPES order. */
export function botPlayers(mix: Partial<typeof BOT_MIX> = BOT_MIX): PlayerSpec[] {
  const players: PlayerSpec[] = [];
  for (const type of BOT_TYPES) {
    const n = Math.floor(mix[type] ?? 0);
    for (let i = 1; i <= n; i++) players.push({ id: BOT_LETTER[type] + i, label: BOT_LETTER[type] + i, controller: type });
  }
  return players;
}

/**
 * A new round. Shops spread evenly along the street in a shuffled order; overflow stacks on top. The state holds
 * `config` by reference: pass a makeConfig() copy for isolated runs, or the live CONFIG for tuning.
 */
export function createGame(config: Config, players: readonly PlayerSpec[], seed: number): GameState {
  const ids = new Set(players.map((p) => p.id));
  if (ids.size !== players.length) throw new Error('Duplicate player id');
  const shops = players.map(makeShop);
  const N = shops.length;
  const C = columnCount(config.STREET, N);
  const g: GameState = {
    config,
    t: 0,
    over: false,
    N,
    C,
    shops,
    cols: Array.from({ length: C }, () => []),
    shoppers: [],
    paras: [],
    wave: { state: 'pause', end: config.WAVES.firstWave, col0: NONE, start: 0, spawned: 0 },
    stats: { closures: 0, paraCaught: 0, paraByTower: 0, spawned: 0, topples: 0, bumps: 0, pushbacks: 0, pushStarts: 0, dodged: 0, abandoned: 0, lost: 0, maxHeight: 0 },
    rng: { world: makeRng(seed), bots: makeRng((seed ^ BOT_STREAM_SALT) >>> 0) },
    events: [],
  };
  const order = shuffle(shops.map((_, i) => i), g.rng.world);
  order.forEach((shop, i) => {
    const c = N <= C ? Math.floor(((i + 0.5) * C) / N) : i % C;
    g.cols[c].push(shop);
  });
  for (let c = 0; c < C; c++) reindex(g, c);
  return g;
}

/** Hand a shop to a phone or a bot mid-round (e.g. the bot fallback when the network dies). */
export function setController(g: GameState, shopId: string, controller: Controller): void {
  const s = g.shops.find((x) => x.id === shopId);
  if (!s) throw new Error(`No shop ${shopId}`);
  if (s.controller === controller) return;
  s.controller = controller;
  s.mind = freshMind();
  s.mind.think = g.t;
}
