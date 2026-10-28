// Headless balance bench for the Walking Shops prototype.
// Usage: node reference/bench.js [rounds]
// Prints income by bot type (1.00 = breaks even with the round average) for the comparisons
// that shaped the design. Bots: newcomer = walk & sit toward visible customers, climber = seeks towers in
// phase 2, aggressor = hunts towers to topple, random = wanders, sitter = never touches the phone.
const S = require('./sim.js');
const R = +process.argv[2] || 30;
const clone = o => JSON.parse(JSON.stringify(o));

function run(mod) {
  const T = {}; let mean = 0, lost = 0, luck = 0, luckN = 0, topples = 0, N = 0, C = 0;
  for (let r = 0; r < R; r++) {
    const p = clone(S.DEFAULTS);
    for (const k in mod) p[k] = k === 'bots' ? Object.assign({}, mod.bots) : mod[k];
    p.seed = 1000 + r;
    const g = S.createGame(p, { noHumans: true });
    while (!g.over) S.step(g);
    S.checkInvariants(g);
    N = g.N; C = g.C;
    const s = S.summarize(g);
    mean += s.meanIncome; lost += s.lostShare; topples += s.topplesPerMin;
    if (s.newcomerCV != null) { luck += s.newcomerCV; luckN++; }
    for (const k in s.types) { const a = T[k] || (T[k] = { n: 0, i: 0 }); a.n += s.types[k].n; a.i += s.types[k].income; }
  }
  mean /= R;
  const ratios = Object.fromEntries(Object.entries(T).map(([k, a]) => [k, +(a.i / a.n / mean).toFixed(2)]));
  return { N, C, ratios, walkInsLost: Math.round(100 * lost / R) + '%', luck: luckN ? +(luck / luckN).toFixed(2) : null, topplesPerMin: +(topples / R).toFixed(1) };
}

function table(title, rows) {
  console.log('\n' + title);
  for (const [label, mod] of rows) {
    const r = run(mod);
    console.log('  ' + label.padEnd(34), `N=${r.N} C=${r.C}`.padEnd(10),
      Object.entries(r.ratios).map(([k, v]) => `${k} ${v.toFixed(2)}`).join('  '),
      `| lost ${r.walkInsLost} | luck ${r.luck} | topples/min ${r.topplesPerMin}`);
  }
}

const b16 = { newcomer: 5, climber: 4, aggressor: 2, random: 2, sitter: 3 };
const b30 = { newcomer: 10, climber: 8, aggressor: 4, random: 3, sitter: 5 };
const phase1 = { paraStart: 999, roundTime: 60, phase1Weight: 1 };

console.log(`Walking Shops bench, ${R} rounds per row`);
table('Idle shutters, phase 1 only (sitter vs everyone)', [
  ['16 players, idle off', { bots: b16, idleOn: false, ...phase1 }],
  ['16 players, idle on', { bots: b16, idleOn: true, ...phase1 }],
  ['30 players, idle off', { bots: b30, idleOn: false, ...phase1 }],
  ['30 players, idle on', { bots: b30, idleOn: true, ...phase1 }],
]);
table('Walk-in arrivals, phase 1 only (luck = income spread between identical bots)', [
  ['waves + trickle, 16', { bots: b16, arrivalMode: 'waves', ...phase1 }],
  ['drifting band, 16', { bots: b16, arrivalMode: 'street', ...phase1 }],
  ['waves + trickle, 30', { bots: b30, arrivalMode: 'waves', ...phase1 }],
  ['drifting band, 30', { bots: b30, arrivalMode: 'street', ...phase1 }],
]);
table('Full round, current defaults (top-only pay)', [
  ['16 players', { bots: b16 }],
  ['30 players', { bots: b30 }],
]);
table('Phase 2 balance levers (16 players, open question)', [
  ['defaults', { bots: b16 }],
  ['walk-ins stop in phase 2', { bots: b16, groundInPhase2: false }],
  ['parachuters worth 5', { bots: b16, paraValue: 5 }],
  ['twice the parachuters', { bots: b16, paraRate: 24 }],
  ['all three', { bots: b16, groundInPhase2: false, paraValue: 5, paraRate: 24 }],
]);
