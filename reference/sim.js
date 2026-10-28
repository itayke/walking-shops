// Walking Shops — pure grid simulation. No DOM. Fixed tick.
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const BOT_TYPES = ['newcomer', 'climber', 'aggressor', 'random', 'sitter'];
  const LETTER = { human: 'P', newcomer: 'N', climber: 'C', aggressor: 'A', random: 'R', sitter: 'S' };
  const DT = 0.05;      // 20 Hz logic
  const LEAN = 0.3;     // how far a blocked store leans into the next cell
  const BUMP_GAP = 0.45;
  const SKY = 7.2;      // parachute spawn height, in floors
  const SHOPPER_SPEED = 5;   // cells per second along the sidewalk
  const PARA_SPEED = 1.5;    // floors per second

  const DEFAULTS = {
    seed: 7,
    humans: 1,
    bots: { newcomer: 5, climber: 4, aggressor: 2, random: 2, sitter: 2 },
    colsMode: 'auto',   // 'auto' = max(players + 4, players × 1.5), capped
    colsCap: 18,
    cols: 18,
    roundTime: 120,
    paraStart: 60,
    groundInPhase2: true,
    entries: 2,
    entryLife: 16,
    telegraph: 3,
    shopperRate: 12,    // ground shoppers per player per minute
    paraRate: 12,       // parachuters per player per minute (phase 2)
    cellTime: 0.45,     // seconds to walk one cell
    pushTime: 0.9,      // sustained push needed to topple
    immuneTime: 2.0,
    stunTime: 0.5,
    bumpStun: 0.35,
    botReaction: 1.0,   // multiplier on bot reaction delays
    wind: 0.8,          // parachute sideways drift, cells per second (0 = straight down)
    arrivalMode: 'waves', // 'waves' = crosswalk waves + background trickle; 'street' = drifting crowd band; 'crosswalk' = old point sources
    bandWidth: 3,       // crowd band spread in columns (>= 12 means uniform)
    bandDrift: 0.5,     // crowd band drift speed, cells per second
    crossTime: 2.5,     // seconds a shopper takes to cross the street
    sidestep: 0,        // columns a shopper will sidestep to find a sitting shop, else leaves
    walkLift: 1.0,      // extra floors a walking store stands on its legs
    botsSeeBand: false, // street mode: true = bots aim for the crowd band; false = bots react only to shoppers they can see crossing
    botPerception: 0.4, // seconds before a bot notices a new shopper (reactive bots)
    phase1Weight: 0.3,    // multiplier on everything earned before parachutes start
    paraValue: 3,       // a parachuter is worth this many walk-ins
    towerPay: 'top',    // who gets paid when a tower catches a parachuter: 'top' | 'split' (shared equally) | 'all' (every floor gets the full value)
    shareWalkIns: false,// walk-ins entering a tower's ground shop pay the tower the same way
    waveWidth: 4,       // columns a crosswalk wave spans
    waveSize: 20,       // shoppers per wave
    waveAnnounce: 2,    // seconds the crosswalk shows before shoppers step off
    waveSpawn: 3,       // seconds over which the wave's shoppers step off
    wavePause: 4,       // seconds between one wave's last shopper arriving and the next crosswalk appearing
    trickleRate: 4,     // background walk-ins per player per minute, anywhere on the street (waves mode)
    idleOn: true,       // shops with no input for idleTime pull their shutters down
    idleTime: 12,       // seconds of no input before shutters close
    idleWarn: 4,        // seconds of visible warning before they close
  };

  function shuffle(a, rng) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function reindex(g, c) {
    const col = g.cols[c];
    for (let i = 0; i < col.length; i++) { col[i].col = c; col[i].level = i; }
  }

  // The shop a walk-in enters in a column: the lowest open shop, going upstairs past closed ones.
  // A walking shop blocks the way (shoppers pass under its legs), so the column is skipped.
  function entryStore(col) {
    for (const s of col) {
      if (s.walking) return null;
      if (!s.closed) return s;
    }
    return null;
  }

  // Can a bot take this column for walk-ins? Empty, already mine, or a lone closed shop it can climb onto.
  function canTake(g, c, s) {
    const col = g.cols[c];
    if (col.length === 0) return true;
    if (s.col === c) return entryStore(col) === s || col[0] === s;
    return col.length === 1 && col[0].closed;
  }

  function makeStore(id, kind, label) {
    return {
      id, kind, label,
      col: 0, level: 0, off: 0, input: 0, lastDir: 1,
      walking: false, pressing: false,
      stunT: 0, immuneT: 0, pushT: 0, pushCol: -1, contest: false, contestTarget: -1,
      income: 0, incGround: 0, incPara: 0, idleT: 0, closed: false, closedTicks: 0,
      sitGround: 0, ticks: 0,
      hue: 0, flash: 0, popT: 0, vx: null, vy: null,
      bot: kind === 'human' ? null : {
        think: 0, target: -1, stuckT: 0, lastCol: -1,
        reactAt: -1, defendUntil: -1, defendDir: 0, commitUntil: -1, yieldUntil: -1, wakeAt: -1, tapUntil: -1, tapDir: 1,
      },
    };
  }

  function createGame(p, opts) {
    opts = opts || {};
    const rng = mulberry32((p.seed >>> 0) || 1);
    const stores = [];
    let id = 0;
    const humans = opts.noHumans ? 0 : (p.humans | 0);
    for (let h = 0; h < humans; h++) stores.push(makeStore(id++, 'human', 'P' + (h + 1)));
    for (const type of BOT_TYPES) {
      const n = (p.bots[type] | 0);
      for (let i = 0; i < n; i++) stores.push(makeStore(id++, type, LETTER[type] + (i + 1)));
    }
    const N = stores.length;
    const C = p.colsMode === 'auto'
      ? Math.max(6, Math.min(p.colsCap | 0, Math.max(N + 4, Math.round(N * 1.5))))
      : Math.max(4, p.cols | 0);
    stores.forEach((s, i) => { s.hue = Math.round((i * 137.508 + 20) % 360); });

    const g = {
      p, rng, t: 0, N, C, over: false,
      cols: Array.from({ length: C }, () => []),
      stores, entries: [], shoppers: [], paras: [],
      humanInput: [0, 0],
      band: { x: 0, v: 0 }, leavers: [],
      wave: { state: 'pause', end: 1, col0: -99, start: 0, spawned: 0 },
      stats: { closures: 0, paraCaught: 0, paraByTower: 0, spawned: 0, topples: 0, bumps: 0, pushbacks: 0, pushStarts: 0, dodged: 0, abandoned: 0, lost: 0, maxHeight: 0, toppleLog: [] },
      fx: [],
    };

    // Spread players evenly; overflow stacks on top.
    const order = shuffle(stores.slice(), rng);
    order.forEach((s, i) => {
      const c = N <= C ? Math.floor((i + 0.5) * C / N) : i % C;
      g.cols[c].push(s);
    });
    for (let c = 0; c < C; c++) reindex(g, c);

    g.band.x = rng() * (C - 1);
    g.band.v = (rng() < 0.5 ? -1 : 1);

    // Entry points, staggered so they don't all switch together.
    const E = Math.max(1, p.entries | 0);
    for (let i = 0; i < E; i++) {
      const avoid = g.entries.map(e => e.col);
      g.entries.push({ col: pickEntryCol(g, avoid), open: 0, close: p.entryLife * (i + 1) / E, next: false, acc: 0 });
    }
    return g;
  }

  function pickEntryCol(g, avoid) {
    const gap = Math.max(2, Math.floor(g.C / (2 * Math.max(1, g.p.entries))));
    for (let k = 0; k < 40; k++) {
      const c = Math.floor(g.rng() * g.C);
      if (avoid.every(a => Math.abs(a - c) >= gap)) return c;
    }
    return Math.floor(g.rng() * g.C);
  }

  // ---------- movement rules ----------
  // Measured from the surface S the walker stands on (its level).
  // Neighbor column height H:
  //   H <= S      step down / walk across  (land on top)
  //   H == S + 1  climb                    (land on top)
  //   H >= S + 2  push the stores at S+1 and above; sustained push topples them to the far column
  // Walkers pressing toward each other within one floor bump.
  function classify(g, s, d) {
    const t = s.col + d;
    if (t < 0 || t >= g.C) return { type: 'wall' };
    const S = s.level;
    const colT = g.cols[t];
    const H = colT.length;

    // head-on: someone in the target column pressing toward us, bodies overlapping
    for (const x of colT) {
      if (x.pressing && x.input === -d && Math.abs(x.level - S) <= 1) {
        const gap = Math.abs((t + x.off) - (s.col + s.off));
        return gap <= BUMP_GAP ? { type: 'bump', other: x } : { type: 'wait' };
      }
    }
    if (H <= S) return { type: 'free' };
    const A = colT[S];
    if (A.walking) return { type: 'wait' };
    if (H === S + 1) return { type: 'free' };
    const B = colT[S + 1];
    if (B.walking || B.immuneT > 0) return { type: 'wait' };
    const f = t + d;
    if (f < 0 || f >= g.C) return { type: 'wall' };   // edge towers can't be toppled
    return { type: 'push', B, t, f };
  }

  // ---------- scoring ----------
  function pay(g, col, catcher, value, kind) {
    const p = g.p;
    const w = g.t < p.paraStart ? p.phase1Weight : 1;
    const shared = p.towerPay !== 'top' && (kind === 'para' || p.shareWalkIns) && col.length > 1;
    const who = shared ? col.filter(x => !x.closed) : [catcher];   // shuttered shops earn nothing
    const each = value * w * (shared && p.towerPay === 'split' ? 1 / who.length : 1);
    for (const x of who) {
      x.income += each;
      if (kind === 'para') x.incPara += each; else x.incGround += each;
      x.flash = 0.4;
    }
    if (kind === 'para') {
      g.stats.paraCaught++;
      if (col.length > 1) g.stats.paraByTower++;
    }
  }

  function doMove(g, s, d) {
    const from = s.col, to = s.col + d;
    const moving = g.cols[from].splice(s.level);
    for (const m of moving) g.cols[to].push(m);
    reindex(g, from); reindex(g, to);
  }

  function topple(g, s, c) {
    const S = s.level;
    const fallen = g.cols[c.t].splice(S + 1);
    for (const x of fallen) {
      x.off = 0; x.walking = false; x.pressing = false; x.pushT = 0;
      x.stunT = g.p.stunTime; x.immuneT = g.p.immuneTime; x.popT = 0.45;
    }
    for (const x of fallen) g.cols[c.f].push(x);
    reindex(g, c.t); reindex(g, c.f);
    g.stats.topples++;
    s.contest = false;
    g.stats.toppleLog.push(g.t);
    g.fx.push({ type: 'topple', col: c.t, level: S + 1, t: g.t });
  }

  function bump(g, s, x, d) {
    const real = (s.contest && s.contestTarget === x.id) || (x.contest && x.contestTarget === s.id);
    if (!real) {
      if (s.contest) { s.contest = false; g.stats.abandoned++; }
      if (x.contest) { x.contest = false; g.stats.abandoned++; }
    }
    if (real) {
      s.contest = x.contest = false;
      g.stats.pushbacks++;
      g.fx.push({ type: 'pushback', col: x.col, level: x.level, t: g.t });
    }
    s.off = -d * 0.3; x.off = d * 0.3;
    s.stunT = x.stunT = g.p.bumpStun;
    s.pushT = x.pushT = 0;
    s.pressing = x.pressing = false;
    g.stats.bumps++;
    for (const y of [s, x]) {
      if (y.bot && g.rng() < (y.kind === 'newcomer' ? 0.6 : 0.3)) y.bot.yieldUntil = g.t + 0.5 + g.rng() * 0.6;
    }
  }

  function moveStore(g, s, dt) {
    const p = g.p;
    const inp = s.stunT > 0 ? 0 : s.input;
    s.pressing = inp !== 0;
    if (s.contest && inp !== s.lastDir) { s.contest = false; g.stats.abandoned++; }
    if (inp !== 0) {
      s.lastDir = inp;
      let off = s.off + inp * dt / p.cellTime;
      let pushing = false;
      if (off * inp > LEAN) {
        const c = classify(g, s, inp);
        if (c.type === 'free') {
          if (s.contest) { s.contest = false; g.stats.dodged++; }
          if (off * inp >= 0.5) { doMove(g, s, inp); off -= inp; }
        } else if (c.type === 'bump') {
          bump(g, s, c.other, inp);
          s.walking = true; c.other.walking = true;
          return;
        } else if (c.type === 'push') {
          off = inp * LEAN;
          pushing = true;
          if (s.pushCol !== c.t) { s.pushT = 0; s.pushCol = c.t; }
          if (s.contest && s.contestTarget !== c.B.id) { g.stats.abandoned++; s.contest = false; }
          if (!s.contest) { s.contest = true; s.contestTarget = c.B.id; g.stats.pushStarts++; }
          s.pushT += dt;
          if (s.pushT >= p.pushTime) { topple(g, s, c); s.pushT = 0; pushing = false; }
        } else {
          off = inp * LEAN;
        }
      }
      if (!pushing) { s.pushT = 0; s.pushCol = -1; }
      s.off = off;
    } else {
      s.pushT = 0; s.pushCol = -1;
      const sp = dt / p.cellTime * 1.6;
      s.off = Math.abs(s.off) <= sp ? 0 : s.off - Math.sign(s.off) * sp;
    }
    s.walking = inp !== 0 || s.off !== 0;
  }

  // ---------- bots ----------
  function liveEntries(g) {
    // active or announced, excluding ones about to close
    return g.entries.filter(e => !e.next && e.close > g.t);
  }

  // Reactive: look only at shoppers already crossing. A shopper is worth chasing if I can sit within
  // its sidestep range before it reaches the sidewalk.
  function reactiveTarget(g, s) {
    const p = g.p;
    const val = new Float64Array(g.C);
    for (const sh of g.shoppers) {
      if (!sh.street || sh.rise <= 0) continue;
      if (sh.cross - sh.rise < p.botPerception) continue;           // not noticed yet
      for (let c = Math.max(0, sh.origin - p.sidestep); c <= Math.min(g.C - 1, sh.origin + p.sidestep); c++) {
        const travel = Math.abs(c - s.col) * p.cellTime + (c === s.col ? 0 : 0.15);
        if (travel <= sh.rise) val[c] += c === sh.origin ? 1 : 0.6;
      }
    }
    // a crosswalk that has appeared (and been noticed) pulls bots toward it
    const w = g.wave;
    if (p.arrivalMode === 'waves' && (w.state === 'announce' || w.state === 'active') && g.t - w.start >= p.botPerception) {
      const left = w.state === 'announce' ? (w.end - g.t) + p.waveSpawn + p.crossTime : (p.waveSize - w.spawned) / Math.max(1, p.waveSize) * p.waveSpawn + p.crossTime;
      for (let c = w.col0; c < w.col0 + p.waveWidth; c++) {
        if (c < 0 || c >= g.C) continue;
        if (Math.abs(c - s.col) * p.cellTime + 0.15 <= left) val[c] += 2.5;
      }
    }
    let best = s.col, bv = -1;
    for (let c = 0; c < g.C; c++) {
      if (!canTake(g, c, s)) continue;
      const mine = c === s.col && entryStore(g.cols[c]) === s;
      const v = val[c] - 0.15 * Math.abs(c - s.col) + (mine ? 0.6 : 0) + g.rng() * 0.05;
      if (v > bv) { bv = v; best = c; }
    }
    return best;
  }

  function groundTarget(g, s) {
    let score;
    if (g.p.arrivalMode === 'waves' || (g.p.arrivalMode === 'street' && !g.p.botsSeeBand)) return reactiveTarget(g, s);
    if (g.p.arrivalMode === 'street') {
      const uniform = g.p.bandWidth >= 12;
      const lead = g.band.x + g.band.v * g.p.bandDrift * (g.p.crossTime + 1);
      score = c => (uniform ? 0 : Math.abs(c - lead) / Math.max(1, g.p.bandWidth * 0.5)) + 0.12 * Math.abs(c - s.col);
    } else {
      const ents = liveEntries(g);
      score = c => {
        let m = 0;
        if (ents.length) { m = 1e9; for (const e of ents) m = Math.min(m, Math.abs(e.col - c)); }
        return m + 0.12 * Math.abs(c - s.col);
      };
    }
    let best = -1, bs = 1e9;
    for (let c = 0; c < g.C; c++) {
      if (!canTake(g, c, s)) continue;
      const sc = score(c) + g.rng() * 0.5;
      if (sc < bs) { bs = sc; best = c; }
    }
    if (s.level === 0 && score(s.col) <= bs + 1.0) return s.col;
    return best < 0 ? s.col : best;
  }

  function towerTarget(g, s) {
    // 'top' pay: be the top of the tallest column. Shared pay: being anywhere in a tall tower counts.
    const shared = g.p.towerPay !== 'top';
    const own = g.cols[s.col];
    const ownTop = own.length - 1 === s.level;
    let best = s.col;
    let bv = (shared || ownTop) ? own.length + 0.3 : -1;   // small bias to stay put
    for (let c = 0; c < g.C; c++) {
      if (c === s.col) continue;
      const v = g.cols[c].length + 1 - 0.15 * Math.abs(c - s.col);
      if (v > bv) { bv = v; best = c; }
    }
    return best;
  }

  function nearestTower(g, s, minH) {
    let best = -1, bd = 1e9;
    for (let c = 0; c < g.C; c++) {
      if (c === s.col) continue;
      if (g.cols[c].length >= minH) {
        const d = Math.abs(c - s.col) + g.rng() * 0.3;
        if (d < bd) { bd = d; best = c; }
      }
    }
    return best;
  }

  function botThink(g, s) {
    const b = s.bot, p = g.p, rng = g.rng;
    const phase2 = g.t >= p.paraStart;
    const r = p.botReaction;
    let next;
    switch (s.kind) {
      case 'newcomer':
        b.target = groundTarget(g, s);
        next = (p.arrivalMode === 'waves' || (p.arrivalMode === 'street' && !p.botsSeeBand)) ? 0.3 + rng() * 0.3 : 1.2 + rng() * 0.8;
        break;
      case 'climber':
        b.target = phase2 ? towerTarget(g, s) : groundTarget(g, s);
        next = 0.5 + rng() * 0.4;
        break;
      case 'aggressor': {
        if (phase2) b.target = towerTarget(g, s);
        else {
          const tw = rng() < 0.6 ? nearestTower(g, s, 2) : -1;
          b.target = tw >= 0 ? tw : groundTarget(g, s);
        }
        next = 0.5 + rng() * 0.4;
        break;
      }
      case 'sitter':
        b.target = -1;
        next = 1e9;
        break;
      case 'random': {
        const roll = rng();
        b.target = roll < 0.3 ? -1 : Math.floor(rng() * g.C);
        next = 0.4 + rng() * 2.0;
        break;
      }
    }
    b.think = g.t + next * r;
  }

  function botUpdate(g, s, dt) {
    const b = s.bot;
    if (g.t >= b.think && g.t >= b.commitUntil) botThink(g, s);

    // defend: if I'm the store directly above someone being pushed, push back after a reaction delay
    if (s.kind === 'climber' || s.kind === 'aggressor') {
      let attacker = null;
      for (const a of g.stores) {
        if (a.pushT > 0 && a.pushCol === s.col && a.level + 1 === s.level) { attacker = a; break; }
      }
      if (attacker) {
        if (b.reactAt < 0) b.reactAt = g.t + (0.45 + g.rng() * 0.6) * g.p.botReaction;
        if (g.t >= b.reactAt && b.defendUntil < g.t) {
          b.defendUntil = g.t + 0.4;
          b.defendDir = Math.sign(attacker.col - s.col);
        }
      } else b.reactAt = -1;
    }

    if (g.t < b.defendUntil) { s.input = b.defendDir; return; }

    // keep-alive: notice the shutters starting to drop and tap a direction (a lean that springs back)
    if (s.kind !== 'sitter' && g.p.idleOn && s.idleT > g.p.idleTime - g.p.idleWarn) {
      if (b.wakeAt < 0) b.wakeAt = g.t + (0.5 + g.rng() * 2.5) * g.p.botReaction;
      if (g.t >= b.wakeAt) { b.wakeAt = -1; b.tapUntil = g.t + 0.12; b.tapDir = s.col === 0 ? 1 : s.col === g.C - 1 ? -1 : (g.rng() < 0.5 ? -1 : 1); }
    } else b.wakeAt = -1;
    if (g.t < b.tapUntil) { s.input = b.tapDir; return; }

    if (g.t < b.yieldUntil) { s.input = 0; return; }

    s.input = b.target < 0 ? 0 : Math.sign(b.target - s.col);

    // stuck: pressing but not getting anywhere and not mid-push
    if (s.input !== 0 && s.col === b.lastCol && s.pushT === 0) b.stuckT += dt; else b.stuckT = 0;
    b.lastCol = s.col;
    if (b.stuckT > 3 && s.kind !== 'aggressor') {
      b.stuckT = 0;
      b.target = Math.floor(g.rng() * g.C);
      b.commitUntil = g.t + 1.5;
    }
  }

  // ---------- step ----------
  function step(g, dt) {
    if (g.over) return;
    dt = dt || DT;
    const p = g.p, rng = g.rng;
    g.t += dt;
    if (g.t >= p.roundTime) g.over = true;
    const phase2 = g.t >= p.paraStart;

    for (const s of g.stores) {
      if (s.stunT > 0) s.stunT = Math.max(0, s.stunT - dt);
      if (s.immuneT > 0) s.immuneT = Math.max(0, s.immuneT - dt);
    }

    const street = p.arrivalMode !== 'crosswalk';   // shoppers cross toward the shop in front of them
    const band = p.arrivalMode === 'street';
    const waves = p.arrivalMode === 'waves';
    // crowd band drifts along the street, bouncing at the ends and sometimes turning around
    const B = g.band;
    B.x += B.v * p.bandDrift * dt;
    if (B.x < 0) { B.x = 0; B.v = 1; }
    if (B.x > g.C - 1) { B.x = g.C - 1; B.v = -1; }
    if (rng() < dt / 14) B.v = -B.v;

    // entries: announce a replacement `telegraph` seconds before one closes
    for (const e of (street ? [] : g.entries)) {
      if (!e.next && g.t >= e.close - p.telegraph) {
        e.next = true;
        const avoid = g.entries.filter(x => x.close > g.t).map(x => x.col);
        g.entries.push({ col: pickEntryCol(g, avoid), open: e.close, close: e.close + p.entryLife, next: false, acc: 0 });
      }
    }
    g.entries = g.entries.filter(e => g.t < e.close);

    // inputs
    let hi = 0;
    for (const s of g.stores) {
      if (s.kind === 'human') s.input = g.humanInput[hi++] || 0;
      else botUpdate(g, s, dt);
    }
    // idle shutters: any press reopens; no input for idleTime closes the shop
    for (const s of g.stores) {
      if (s.input !== 0) s.idleT = 0; else s.idleT += dt;
      const was = s.closed;
      s.closed = !!p.idleOn && s.idleT >= p.idleTime;
      if (s.closed && !was) { g.stats.closures++; g.fx.push({ type: 'closed', col: s.col, level: s.level, t: g.t }); }
      if (s.closed) s.closedTicks++;
    }

    // movement, fair order
    const order = shuffle(g.stores.slice(), rng);
    for (const s of order) moveStore(g, s, dt);

    // ground shoppers
    const groundOn = !phase2 || p.groundInPhase2;
    const crossShopper = c => {
      g.shoppers.push({ x: c, origin: c, rise: p.crossTime, cross: p.crossTime, street: true, life: 3 });
      g.stats.spawned++;
    };
    const W = g.wave;
    if (waves) {
      // crosswalk wave cycle: pause -> announce -> active (shoppers step off) -> crossing -> pause
      const width = Math.max(1, Math.min(g.C, p.waveWidth | 0));
      if (W.state === 'pause' && g.t >= W.end && groundOn) {
        let c0 = 0;
        for (let k = 0; k < 30; k++) {
          c0 = Math.floor(rng() * (g.C - width + 1));
          if (Math.abs(c0 - W.col0) >= width) break;
        }
        W.col0 = c0; W.state = 'announce'; W.start = g.t; W.end = g.t + p.waveAnnounce; W.spawned = 0;
      } else if (W.state === 'announce' && g.t >= W.end) {
        W.state = 'active'; W.end = g.t + p.waveSpawn;
      } else if (W.state === 'active') {
        const due = Math.min(p.waveSize, Math.ceil(p.waveSize * (1 - Math.max(0, W.end - g.t) / Math.max(0.05, p.waveSpawn))));
        while (W.spawned < due) { crossShopper(W.col0 + Math.floor(rng() * width)); W.spawned++; }
        if (W.spawned >= p.waveSize) { W.state = 'crossing'; W.end = g.t + p.crossTime; }
      } else if (W.state === 'crossing' && g.t >= W.end) {
        W.state = 'pause'; W.end = g.t + p.wavePause;
      }
      if (groundOn) {
        const n = Math.floor(g.N * p.trickleRate / 60 * dt + rng());
        for (let k = 0; k < n; k++) crossShopper(Math.floor(rng() * g.C));
      }
    } else if (band && groundOn) {
      const n = Math.floor(g.N * p.shopperRate / 60 * dt + rng());
      for (let k = 0; k < n; k++) {
        let c;
        if (p.bandWidth >= 12) c = Math.floor(rng() * g.C);
        else {
          const gs = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
          c = Math.round(B.x + gs * p.bandWidth);
          while (c < 0 || c >= g.C) c = c < 0 ? -c - 1 : 2 * g.C - c - 1;
          c = Math.max(0, Math.min(g.C - 1, c));
        }
        crossShopper(c);
      }
    } else if (!street && groundOn) {
      const act = g.entries.filter(e => e.open <= g.t);
      const rate = g.N * p.shopperRate / 60 / Math.max(1, act.length);
      for (const e of act) {
        const n = Math.floor(rate * dt + rng());
        for (let k = 0; k < n; k++) { g.shoppers.push({ x: e.col, rise: 0.6, life: 8, bias: rng() < 0.5 ? -1 : 1 }); g.stats.spawned++; }
      }
    }
    // parachuters
    if (phase2) {
      const n = Math.floor(g.N * p.paraRate / 60 * dt + rng());
      let maxH = 0; for (const col of g.cols) maxH = Math.max(maxH, col.length);
      const sky = Math.max(SKY, maxH + 2.2);
      for (let k = 0; k < n; k++) g.paras.push({
        x: rng() * (g.C - 1), y: sky + rng() * 0.6,
        vx: p.wind * (0.5 + rng() * 0.5) * (rng() < 0.5 ? -1 : 1),
      });
    }

    // shoppers walk to the nearest column with an open, sitting shop to enter (upstairs past closed ones)
    const entries = g.cols.map(entryStore);
    const keep = [];
    for (const sh of g.shoppers) {
      if (sh.rise > 0) { sh.rise -= dt; keep.push(sh); continue; }
      if (sh.street) {
        // enter the shop in front if it's sitting on the ground; else sidestep up to `sidestep` columns; else leave
        let best = null, bd = 1e9;
        for (let c = Math.max(0, sh.origin - p.sidestep); c <= Math.min(g.C - 1, sh.origin + p.sidestep); c++) {
          const e = entries[c];
          if (!e) continue;
          const d = Math.abs(c - sh.x) + Math.abs(c - sh.origin) * 0.01;
          if (d < bd) { bd = d; best = e; }
        }
        sh.life -= dt;
        if (!best || sh.life <= 0) {
          g.stats.lost++;
          g.leavers.push({ x: sh.x, t: 0 });
          continue;
        }
        const dx = best.col - sh.x, stp = SHOPPER_SPEED * dt;
        if (Math.abs(dx) <= stp) pay(g, g.cols[best.col], best, 1, 'ground');
        else { sh.x += Math.sign(dx) * stp; keep.push(sh); }
        continue;
      }
      sh.life -= dt;
      let best = null, bd = 1e9;
      for (let c = 0; c < g.C; c++) {
        const e = entries[c];
        if (!e) continue;
        const d = Math.abs(c - sh.x) + ((c - sh.x) * sh.bias >= 0 ? 0 : 0.001);
        if (d < bd) { bd = d; best = e; }
      }
      if (!best) {
        if (sh.life > 0) keep.push(sh); else g.stats.lost++;
        continue;
      }
      const dx = best.col - sh.x, stp = SHOPPER_SPEED * dt;
      if (Math.abs(dx) <= stp) {
        pay(g, g.cols[best.col], best, 1, 'ground');
      } else { sh.x += Math.sign(dx) * stp; keep.push(sh); }
    }
    g.shoppers = keep;

    // parachuters land on the first (highest) store they touch; walkers stand one floor taller
    const keepP = [];
    for (const pa of g.paras) {
      pa.y -= PARA_SPEED * dt;
      pa.x += pa.vx * dt;
      if (pa.x < 0) { pa.x = 0; pa.vx = -pa.vx; }
      if (pa.x > g.C - 1) { pa.x = g.C - 1; pa.vx = -pa.vx; }
      const pc = Math.round(pa.x);
      const col = g.cols[pc];
      const H = col.length;
      if (H > 0) {
        const top = H + (col.some(s => s.walking) ? p.walkLift : 0);
        if (pa.y <= top) {
          let c = null;
          for (let L = H - 1; L >= 0; L--) if (!col[L].closed) { c = col[L]; break; }
          if (c) { pay(g, col, c, p.paraValue, 'para'); continue; }
          // every shop in the column is shuttered: the parachuter lands on the sidewalk and walks
          g.stats.spawned++;
          g.shoppers.push(street ? { x: pc, origin: pc, rise: 0, cross: p.crossTime, street: true, life: 3 } : { x: pc, rise: 0, life: 8, bias: rng() < 0.5 ? -1 : 1 });
          continue;
        }
      } else if (pa.y <= 0) {
        g.stats.spawned++;
        if (street) g.shoppers.push({ x: pc, origin: pc, rise: 0, cross: p.crossTime, street: true, life: 3 });
        else g.shoppers.push({ x: pc, rise: 0, life: 8, bias: rng() < 0.5 ? -1 : 1 });
        continue;
      }
      keepP.push(pa);
    }
    g.paras = keepP;

    for (const l of g.leavers) l.t += dt;
    g.leavers = g.leavers.filter(l => l.t < 1);

    // stats
    let maxH = 0;
    for (const col of g.cols) maxH = Math.max(maxH, col.length);
    g.stats.maxHeight = Math.max(g.stats.maxHeight, maxH);
    for (const s of g.stores) {
      s.ticks++;
      if (s.level === 0 && !s.walking) s.sitGround++;
    }
    if (g.fx.length > 40) g.fx.splice(0, g.fx.length - 40);
  }

  function checkInvariants(g) {
    const seen = new Set();
    for (let c = 0; c < g.C; c++) {
      g.cols[c].forEach((s, i) => {
        if (s.col !== c || s.level !== i) throw new Error('index mismatch ' + s.label);
        if (seen.has(s.id)) throw new Error('duplicate ' + s.label);
        seen.add(s.id);
      });
    }
    if (seen.size !== g.N) throw new Error('lost a store: ' + seen.size + '/' + g.N);
  }

  function summarize(g) {
    const types = {};
    for (const s of g.stores) {
      const k = s.kind;
      const T = types[k] || (types[k] = { n: 0, income: 0, ground: 0, para: 0, sit: 0, ticks: 0, closed: 0 });
      T.n++; T.income += s.income; T.ground += s.incGround; T.para += s.incPara;
      T.sit += s.sitGround; T.ticks += s.ticks; T.closed += s.closedTicks;
    }
    const mins = Math.max(1e-9, g.t / 60);
    let total = 0; for (const s of g.stores) total += s.income;
    const nw = g.stores.filter(s => s.kind === 'newcomer').map(s => s.income);
    let newcomerCV = null;
    if (nw.length > 1) {
      const m = nw.reduce((a, b) => a + b, 0) / nw.length;
      const sd = Math.sqrt(nw.reduce((a, v) => a + (v - m) * (v - m), 0) / (nw.length - 1));
      newcomerCV = m > 0 ? sd / m : 0;
    }
    return {
      newcomerCV,
      types,
      totalIncome: total,
      meanIncome: total / g.N,
      topplesPerMin: g.stats.topples / mins,
      closuresPerMin: g.stats.closures / mins,
      bumpsPerMin: g.stats.bumps / mins,
      pushbacksPerMin: g.stats.pushbacks / mins,
      pushStartsPerMin: g.stats.pushStarts / mins,
      dodgedPerMin: g.stats.dodged / mins,
      abandonedPerMin: g.stats.abandoned / mins,
      maxHeight: g.stats.maxHeight,
      lost: g.stats.lost,
      lostShare: g.stats.lost / Math.max(1, g.stats.spawned),
      towerCatchShare: g.stats.paraCaught ? g.stats.paraByTower / g.stats.paraCaught : 0,
      minutes: mins,
    };
  }

  function runRound(p, opts) {
    const g = createGame(p, opts);
    while (!g.over) step(g, DT);
    return { g, sum: summarize(g) };
  }

  const api = { DEFAULTS, BOT_TYPES, LETTER, DT, LEAN, SKY, entryStore, createGame, step, summarize, runRound, checkInvariants, classify };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.WalkSim = api;
})(typeof window !== 'undefined' ? window : globalThis);
