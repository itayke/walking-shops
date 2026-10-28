// Headless balance bench. Usage: node packages/sim/bench/bench.ts [rounds] [--compare]
// Prints income by bot type (1.00 = breaks even with the round average) for the comparisons that shaped the design.
// Bots: newcomer = walk & sit toward visible customers, climber = seeks towers in phase 2, aggressor = hunts towers to
// topple, random = wanders, sitter = never touches the phone. --compare also runs reference/sim.js on each row.
import { createRequire } from 'node:module';
import { BOT_MIX, botPlayers, checkInvariants, makeConfig, runRound, type Config, type ConfigOverrides } from '../src/index.ts';

const DEFAULT_ROUNDS = 30;
const FIRST_SEED = 1000;
const LABEL_WIDTH = 34;
const SIZE_WIDTH = 10;

type Mix = typeof BOT_MIX;
type Row = { label: string; mix: Mix; over?: ConfigOverrides; refOnly?: Record<string, unknown> };
type Result = { N: number; C: number; ratios: Record<string, number>; lost: number; luck: number | null; topples: number };
type RoundSummary = { meanIncome: number; lostShare: number; topplesPerMin: number; newcomerCV: number | null; types: Record<string, { n: number; income: number } | undefined> };

const args = process.argv.slice(2);
const ROUNDS = Number(args.find((a) => /^\d+$/.test(a))) || DEFAULT_ROUNDS;
const COMPARE = args.includes('--compare');

function aggregate(rounds: { N: number; C: number; sum: RoundSummary }[]): Result {
  const T: Record<string, { n: number; i: number }> = {};
  let mean = 0, lost = 0, luck = 0, luckN = 0, topples = 0;
  for (const { sum: s } of rounds) {
    mean += s.meanIncome;
    lost += s.lostShare;
    topples += s.topplesPerMin;
    if (s.newcomerCV != null) {
      luck += s.newcomerCV;
      luckN++;
    }
    for (const [k, v] of Object.entries(s.types)) {
      if (!v) continue;
      const a = (T[k] ??= { n: 0, i: 0 });
      a.n += v.n;
      a.i += v.income;
    }
  }
  mean /= rounds.length;
  const ratios = Object.fromEntries(Object.entries(T).map(([k, a]) => [k, a.i / a.n / mean]));
  const last = rounds[rounds.length - 1];
  return { N: last.N, C: last.C, ratios, lost: lost / rounds.length, luck: luckN ? luck / luckN : null, topples: topples / rounds.length };
}

function runPort(row: Row): Result {
  const rounds = [];
  for (let r = 0; r < ROUNDS; r++) {
    const { g, sum } = runRound(makeConfig(row.over), botPlayers(row.mix), FIRST_SEED + r);
    checkInvariants(g);
    rounds.push({ N: g.N, C: g.C, sum: sum as RoundSummary });
  }
  return aggregate(rounds);
}

// The reference takes one flat params object; our section keys are unique, so flattening the config matches it
function flatten(cfg: Config): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [name, section] of Object.entries(cfg)) if (name !== 'BOT_MIX') Object.assign(flat, section);
  flat.waveAnnounce = cfg.WAVES.waveLines * cfg.WAVES.waveLineInterval;
  return flat;
}

function runReference(row: Row): Result {
  const require = createRequire(import.meta.url);
  const R = require('../../../reference/sim.js');
  const rounds = [];
  for (let r = 0; r < ROUNDS; r++) {
    const p = { ...R.DEFAULTS, ...flatten(makeConfig(row.over)), ...row.refOnly, bots: { ...row.mix }, seed: FIRST_SEED + r };
    const g = R.createGame(p, { noHumans: true });
    while (!g.over) R.step(g);
    R.checkInvariants(g);
    rounds.push({ N: g.N, C: g.C, sum: R.summarize(g) as RoundSummary });
  }
  return aggregate(rounds);
}

function line(label: string, r: Result): string {
  const ratios = Object.entries(r.ratios).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  ');
  const luck = r.luck == null ? '-' : r.luck.toFixed(2);
  return `  ${label.padEnd(LABEL_WIDTH)} ${`N=${r.N} C=${r.C}`.padEnd(SIZE_WIDTH)} ${ratios} | lost ${Math.round(100 * r.lost)}% | luck ${luck} | topples/min ${r.topples.toFixed(1)}`;
}

function table(title: string, rows: Row[]): void {
  console.log('\n' + title);
  for (const row of rows) {
    if (!row.refOnly) console.log(line(row.label, runPort(row)));
    if (COMPARE) console.log(line(row.refOnly ? `${row.label} (reference only)` : '  reference', runReference(row)));
  }
}

const b16: Mix = { newcomer: 5, climber: 4, aggressor: 2, random: 2, sitter: 3 };
const b30: Mix = { newcomer: 10, climber: 8, aggressor: 4, random: 3, sitter: 5 };
const phase1: ConfigOverrides = { ROUND: { paraStart: 999, roundTime: 60 }, SCORING: { phase1Weight: 1 } };
const withPhase1 = (over: ConfigOverrides): ConfigOverrides => ({ ...phase1, ...over });

console.log(`Walking Shops bench, ${ROUNDS} rounds per row${COMPARE ? ', port vs reference' : ''}`);
table('Idle shutters, phase 1 only (sitter vs everyone)', [
  { label: '16 players, idle off', mix: b16, over: withPhase1({ IDLE: { idleOn: false } }) },
  { label: '16 players, idle on', mix: b16, over: phase1 },
  { label: '30 players, idle off', mix: b30, over: withPhase1({ IDLE: { idleOn: false } }) },
  { label: '30 players, idle on', mix: b30, over: phase1 },
]);
if (COMPARE) {
  // The drifting band was dropped from the game; the reference still shows the luck it was rejected for
  table('Walk-in arrivals, phase 1 only (luck = income spread between identical bots)', [
    { label: 'drifting band, 16', mix: b16, over: phase1, refOnly: { arrivalMode: 'street' } },
    { label: 'drifting band, 30', mix: b30, over: phase1, refOnly: { arrivalMode: 'street' } },
  ]);
}
table('Full round, current defaults (top-only pay)', [
  { label: '16 players', mix: b16 },
  { label: '30 players', mix: b30 },
]);
table('Phase 2 balance levers (16 players, open question)', [
  { label: 'defaults', mix: b16 },
  { label: 'walk-ins stop in phase 2', mix: b16, over: { WALK_INS: { groundInPhase2: false } } },
  { label: 'parachuters worth 5', mix: b16, over: { SCORING: { paraValue: 5 } } },
  { label: 'twice the parachuters', mix: b16, over: { PARACHUTES: { paraRate: 24 } } },
  { label: 'all three', mix: b16, over: { WALK_INS: { groundInPhase2: false }, SCORING: { paraValue: 5 }, PARACHUTES: { paraRate: 24 } } },
]);
