import { describe, expect, it } from 'vitest';
import { baseOf, botPlayers, checkInvariants, classify, columnCount, createGame, floorOf, makeConfig, ranking, step, toLobby, type GameState } from '../src/index.ts';
import { column, ofType, run, shop, street } from './helpers.ts';

// Long enough for the whole takeover, crowned included
const TAKEOVER = 30;
// A packed street: more shops than columns, so the sides stack
const CROWD = 30;
const SEED = 7;
// Past the column cap, so every street width is tried
const MANY = 40;
// A short round, so a test reaches the end card quickly
const ROUND_END = { ROUND: { roundTime: 0.5 } };
const WALK = 0.6;
const LONG_PUSH = 1.5;

/** A finished round on this street with its podium in free play, blocks set by column. */
function freePodium(layout: string[][], blocks: number[]): GameState {
  const g = street(layout);
  g.over = true;
  g.podium = { stage: 'free', t: 0, top: [], cols: [], blocks, targets: {} };
  return g;
}

describe('end card podium', () => {
  it('lays every street out odd-wide, so first place stands in the middle', () => {
    const { STREET } = makeConfig();
    for (let n = 0; n <= MANY; n++) {
      const C = columnCount(STREET, n);
      expect(C % 2).toBe(1);
      expect(C).toBeGreaterThanOrEqual(STREET.colsMin);
      expect(C).toBeLessThanOrEqual(STREET.colsCap);
    }
  });

  it('ranks by money, ties kept in street order', () => {
    const g = street([['A'], ['B'], ['C']]);
    shop(g, 'B').income = 10;
    shop(g, 'C').income = 10;
    expect(ranking(g).map((s) => s.id)).toEqual(['B', 'C', 'A']);
  });

  it('walks everyone aside, drops the blocks, then walks the winners up from third to first', () => {
    const g = street([['A', 'B'], ['C'], [], ['D'], ['E', 'F'], [], [], [], []], ROUND_END);
    const money: Record<string, number> = { A: 10, B: 40, C: 0, D: 30, E: 50, F: 20 };
    for (const [id, m] of Object.entries(money)) shop(g, id).income = m;
    // The order the winners reach their places in
    const up: string[] = [];
    const events = run(g, TAKEOVER, (g) => {
      for (const [place, id] of (g.podium?.top ?? []).entries()) {
        const s = shop(g, id);
        if (g.podium!.stage !== 'clear' && s.col === g.podium!.cols[place] && !s.walking && !up.includes(id)) up.push(id);
      }
      return {};
    });
    const stages = ofType(events, 'podium').map((e) => e.stage);
    expect(stages).toEqual(['blocks', 'winners', 'crowned', 'free']);
    const p = g.podium!;
    expect(p.top).toEqual(['E', 'B', 'D']);
    // Second, first and third, left to right in the middle, each standing on its place's blocks
    const { firstBlocks, secondBlocks, thirdBlocks } = g.config.PODIUM;
    expect(p.cols).toEqual([4, 3, 5]);
    expect([3, 4, 5].map((c) => baseOf(g, c))).toEqual([secondBlocks, firstBlocks, thirdBlocks]);
    expect([3, 4, 5].map((c) => column(g, c))).toEqual([['B'], ['E'], ['D']]);
    expect(floorOf(g, shop(g, 'E'))).toBe(firstBlocks);
    // Everyone else stands at the sides
    for (const id of ['A', 'C', 'F']) expect([3, 4, 5]).not.toContain(shop(g, id).col);
    expect(up).toEqual(['D', 'B', 'E']);
  });

  it('gets a packed street of bots through the takeover to free play, every shop indexed every tick', () => {
    const players = botPlayers({ newcomer: CROWD });
    const g = createGame(makeConfig(), players, SEED);
    while (!g.over) step(g, {});
    const top = ranking(g).slice(0, g.podium!.top.length).map((s) => s.id);
    expect(g.podium!.top).toEqual(top);
    run(g, TAKEOVER);
    expect(g.podium!.stage).toBe('free');
    g.podium!.top.forEach((id, place) => {
      expect(shop(g, id).col).toBe(g.podium!.cols[place]);
      expect(floorOf(g, shop(g, id))).toBe(baseOf(g, g.podium!.cols[place]));
    });
    checkInvariants(g);
  });

  it('ignores the phones while it has the controls, and hands them back for free play', () => {
    const g = street([['A'], [], [], [], [], [], []], ROUND_END);
    run(g, 1);
    expect(g.podium?.stage).not.toBe('free');
    const before = shop(g, 'A').col;
    run(g, WALK, { A: -1 });
    // Only the sim moves it: toward the podium's middle as the winner, never left as the phone asks
    expect(shop(g, 'A').col).toBeGreaterThanOrEqual(before);
    run(g, TAKEOVER);
    expect(g.podium?.stage).toBe('free');
    const top = shop(g, 'A').col;
    run(g, WALK, { A: 1 });
    expect(shop(g, 'A').col).toBeGreaterThan(top);
  });

  it("lets a shop climb onto a block but not push one", () => {
    const g = freePodium([['A'], [], ['B'], []], [0, 2, 0, 1]);
    // Two floors up from the ground: a wall
    expect(classify(g, shop(g, 'A'), 1).type).toBe('wall');
    // One floor up: a climb onto the block
    expect(classify(g, shop(g, 'B'), 1).type).toBe('free');
    run(g, WALK, { B: 1 });
    expect(column(g, 3)).toEqual(['B']);
    expect(floorOf(g, shop(g, 'B'))).toBe(1);
  });

  it('topples a shop off the podium, never the block under it', () => {
    const g = freePodium([['A'], ['B'], []], [0, 1, 0]);
    expect(classify(g, shop(g, 'A'), 1).type).toBe('push');
    const events = run(g, LONG_PUSH, { A: 1 });
    expect(ofType(events, 'topple')).toHaveLength(1);
    expect(column(g, 2)).toEqual(['B']);
    expect(baseOf(g, 1)).toBe(1);
  });

  it('counts customers served and towers toppled for the end card', () => {
    const g = freePodium([['A'], ['B', 'C'], []], [0, 0, 0]);
    run(g, LONG_PUSH, { A: 1 });
    expect(shop(g, 'A').topples).toBe(1);
  });

  it('clears the podium on the way back to the lobby', () => {
    const g = freePodium([['A'], ['B']], [0, 2]);
    toLobby(g);
    expect(g.podium).toBeNull();
    expect(baseOf(g, 1)).toBe(0);
  });
});
