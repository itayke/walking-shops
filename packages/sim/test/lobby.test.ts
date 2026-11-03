import { describe, expect, it } from 'vitest';
import { addShop, beginRound, botPlayers, checkInvariants, columnCount, createLobby, makeConfig, removeShop, toLobby, type ConfigOverrides, type GameState, type PlayerSpec } from '../src/index.ts';
import { column, ofType, run, shop } from './helpers.ts';

const human = (id: string): PlayerSpec => ({ id, label: id, controller: 'human' });

/** A lobby with the default config: customers, shutters and the round clock would all be on outside it. */
function lobby(ids: string[] = [], seed = 1, over: ConfigOverrides = {}): GameState {
  const g = createLobby(makeConfig(over), seed);
  for (const id of ids) addShop(g, human(id));
  checkInvariants(g);
  return g;
}

describe('lobby', () => {
  it('is laid out for at least minPlayers, so the first shops fit without widening', () => {
    const g = lobby();
    const { STREET, ROUND } = g.config;
    expect(g.N).toBe(0);
    expect(g.C).toBe(columnCount(STREET, ROUND.minPlayers));
    for (let i = 0; i < ROUND.minPlayers; i++) addShop(g, human(`H${i}`));
    expect(g.C).toBe(columnCount(STREET, ROUND.minPlayers));
  });

  it('drops each new shop into an empty column while there is one', () => {
    const g = lobby(['A', 'B', 'C', 'D']);
    expect(g.cols.filter((col) => col.length > 0)).toHaveLength(4);
    expect(g.shops.every((s) => s.level === 0)).toBe(true);
  });

  it('stacks new shops on the lowest columns once every column is taken', () => {
    const g = lobby();
    for (let i = 0; i < g.C + 1; i++) addShop(g, human(`H${i}`));
    checkInvariants(g);
    expect(Math.max(...g.cols.map((col) => col.length))).toBe(2);
  });

  it('widens past minPlayers by adding columns at the right edge, without moving anyone', () => {
    // A cap far above minPlayers' street, so a few more shops need more columns
    const g = lobby([], 1, { STREET: { colsCap: 100 } });
    const { STREET, ROUND } = g.config;
    const many = ROUND.minPlayers + 1;
    for (let i = 0; i < many; i++) addShop(g, human(`H${i}`));
    const before = g.shops.map((s) => [s.id, s.col, s.level]);
    const extra = many + 1;
    const was = g.C;
    addShop(g, human('late'));
    expect(g.C).toBe(columnCount(STREET, extra));
    expect(g.C).toBeGreaterThan(was);
    expect(g.shops.slice(0, -1).map((s) => [s.id, s.col, s.level])).toEqual(before);
  });

  it('plays the movement rules but brings no customers, shutters or end', () => {
    const g = lobby(['A', 'B']);
    const { ROUND, IDLE } = g.config;
    const start = shop(g, 'A').col;
    const events = run(g, ROUND.roundTime + IDLE.idleTime, (g) => ({ A: g.t < 1 ? (start === 0 ? 1 : -1) : 0 }));
    expect(shop(g, 'A').col).not.toBe(start);
    expect(g.shoppers).toHaveLength(0);
    expect(g.paras).toHaveLength(0);
    expect(ofType(events, 'paid')).toHaveLength(0);
    expect(ofType(events, 'closed')).toHaveLength(0);
    expect(g.over).toBe(false);
  });

  it('removes a shop and drops what it carried a floor', () => {
    const g = lobby();
    const [A, B, C] = ['A', 'B', 'C'].map((id) => addShop(g, human(id)));
    // Stack B and C on A by hand
    for (const s of [B, C]) g.cols[s.col] = [];
    g.cols[A.col] = [0, 1, 2];
    g.cols.forEach((_, c) => g.cols[c].forEach((i, level) => Object.assign(g.shops[i], { col: c, level })));
    checkInvariants(g);
    removeShop(g, 'A');
    checkInvariants(g);
    expect(column(g, B.col)).toEqual(['B', 'C']);
    expect([shop(g, 'B').level, shop(g, 'C').level]).toEqual([0, 1]);
  });
});

describe('beginning a round', () => {
  it('fills with bots up to minPlayers, keeps every shop in place and starts from zero', () => {
    const g = lobby(['A', 'B', 'C']);
    run(g, 2, { A: 1 });
    const places = g.shops.map((s) => [s.id, s.col, s.level]);
    const { minPlayers } = g.config.ROUND;
    beginRound(g, botPlayers(g.config.BOT_MIX));
    checkInvariants(g);
    expect(g.N).toBe(minPlayers);
    expect(g.shops.slice(0, places.length).map((s) => [s.id, s.col, s.level])).toEqual(places);
    expect(g.shops.slice(places.length).every((s) => s.controller !== 'human')).toBe(true);
    expect(g.t).toBe(0);
    expect(g.lobby).toBe(false);
    expect(g.stats.bumps + g.stats.topples).toBe(0);
  });

  it('spreads the bots out: each lands in the middle of the widest empty gap', () => {
    const g = lobby();
    // One shop at each end: the first bot belongs in the middle
    addShop(g, human('L'));
    addShop(g, human('R'));
    g.cols = g.cols.map(() => []);
    g.cols[0] = [0];
    g.cols[g.C - 1] = [1];
    g.cols.forEach((_, c) => g.cols[c].forEach((i, level) => Object.assign(g.shops[i], { col: c, level })));
    beginRound(g, botPlayers(g.config.BOT_MIX).slice(0, 1));
    const bot = g.shops[2];
    expect(Math.abs(bot.col - (g.C - 1) / 2)).toBeLessThanOrEqual(0.5);
  });

  it('leaves a full lobby without bots', () => {
    const g = lobby();
    const { minPlayers } = g.config.ROUND;
    for (let i = 0; i < minPlayers + 2; i++) addShop(g, human(`H${i}`));
    beginRound(g, botPlayers(g.config.BOT_MIX));
    expect(g.N).toBe(minPlayers + 2);
  });

  it('brings customers once begun, and keeps who walked first in order', () => {
    const g = lobby(['A', 'B']);
    run(g, 1, { A: 1 });
    const before = shop(g, 'A').moveSince - g.t;
    beginRound(g, []);
    expect(shop(g, 'A').moveSince).toBeCloseTo(before);
    run(g, g.config.WAVES.firstWave + g.config.WAVES.waveLines * g.config.WAVES.waveLineInterval + 1);
    expect(g.stats.spawned).toBeGreaterThan(0);
  });

  it('goes back to the lobby: bots leave, players keep their places and scores reset', () => {
    const g = lobby(['A', 'B']);
    beginRound(g, botPlayers(g.config.BOT_MIX));
    run(g, 30);
    shop(g, 'A').income = 1;
    const places = ['A', 'B'].map((id) => [shop(g, id).col, shop(g, id).level]);
    toLobby(g);
    checkInvariants(g);
    expect(g.shops.map((s) => s.id)).toEqual(['A', 'B']);
    expect(g.lobby).toBe(true);
    expect(shop(g, 'A').income).toBe(0);
    // Levels can drop where a bot was underneath
    expect(['A', 'B'].map((id) => shop(g, id).col)).toEqual(places.map(([c]) => c));
  });

  it('is deterministic for a seed', () => {
    const play = () => {
      const g = lobby(['A', 'B', 'C'], 7);
      run(g, 3, { B: -1 });
      beginRound(g, botPlayers(g.config.BOT_MIX));
      run(g, 20);
      return JSON.stringify(g.shops.map((s) => [s.id, s.col, s.level, s.income]));
    };
    expect(play()).toBe(play());
  });
});
