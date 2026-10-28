import type { Controller, GameState } from './types.ts';

const SECONDS_PER_MINUTE = 60;

export interface TypeSummary {
  n: number;
  income: number;
  ground: number;
  para: number;
  sit: number;
  ticks: number;
  closed: number;
}

export interface Summary {
  types: Partial<Record<Controller, TypeSummary>>;
  // Income spread (coefficient of variation) between newcomer bots: position luck
  newcomerCV: number | null;
  totalIncome: number;
  meanIncome: number;
  topplesPerMin: number;
  closuresPerMin: number;
  bumpsPerMin: number;
  pushbacksPerMin: number;
  pushStartsPerMin: number;
  dodgedPerMin: number;
  abandonedPerMin: number;
  maxHeight: number;
  lost: number;
  lostShare: number;
  towerCatchShare: number;
  minutes: number;
}

export function summarize(g: GameState): Summary {
  const types: Summary['types'] = {};
  for (const s of g.shops) {
    const T = (types[s.controller] ??= { n: 0, income: 0, ground: 0, para: 0, sit: 0, ticks: 0, closed: 0 });
    T.n++;
    T.income += s.income;
    T.ground += s.incGround;
    T.para += s.incPara;
    T.sit += s.sitGround;
    T.ticks += s.ticks;
    T.closed += s.closedTicks;
  }
  const mins = Math.max(Number.EPSILON, g.t / SECONDS_PER_MINUTE);
  const total = g.shops.reduce((a, s) => a + s.income, 0);
  const nw = g.shops.filter((s) => s.controller === 'newcomer').map((s) => s.income);
  let newcomerCV: number | null = null;
  if (nw.length > 1) {
    const m = nw.reduce((a, b) => a + b, 0) / nw.length;
    const sd = Math.sqrt(nw.reduce((a, v) => a + (v - m) * (v - m), 0) / (nw.length - 1));
    newcomerCV = m > 0 ? sd / m : 0;
  }
  const st = g.stats;
  return {
    types,
    newcomerCV,
    totalIncome: total,
    meanIncome: total / g.N,
    topplesPerMin: st.topples / mins,
    closuresPerMin: st.closures / mins,
    bumpsPerMin: st.bumps / mins,
    pushbacksPerMin: st.pushbacks / mins,
    pushStartsPerMin: st.pushStarts / mins,
    dodgedPerMin: st.dodged / mins,
    abandonedPerMin: st.abandoned / mins,
    maxHeight: st.maxHeight,
    lost: st.lost,
    lostShare: st.lost / Math.max(1, st.spawned),
    towerCatchShare: st.paraCaught ? st.paraByTower / st.paraCaught : 0,
    minutes: mins,
  };
}
