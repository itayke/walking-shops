import { describe, expect, it } from 'vitest';
import { BOT_MIX, botPlayers, checkInvariants, createGame, makeConfig, setController, step, type Dir, type GameState, type PlayerSpec } from '../src/index.ts';

const SEEDS = 12;
const FIRST_SEED = 500;
const HUMANS: PlayerSpec[] = [
  { id: 'H1', label: 'H1', controller: 'human' },
  { id: 'H2', label: 'H2', controller: 'human' },
];
const BIG_MIX = { newcomer: 10, climber: 8, aggressor: 4, random: 3, sitter: 3 };

// Scripted human: holds of different lengths with idle gaps, different per player
function scripted(g: GameState): Record<string, Dir> {
  const out: Record<string, Dir> = {};
  HUMANS.forEach((h, i) => {
    const beat = Math.floor(g.t * (1 + i * 0.4)) % 17;
    out[h.id] = beat < 3 ? 1 : beat < 6 ? -1 : beat === 9 ? 1 : 0;
  });
  return out;
}

function play(g: GameState, untilT = Infinity, each?: (g: GameState) => void): void {
  while (!g.over && g.t < untilT) {
    step(g, scripted(g));
    each?.(g);
  }
}

describe('whole rounds', () => {
  it('keep every shop indexed exactly once after every tick', () => {
    for (let seed = FIRST_SEED; seed < FIRST_SEED + SEEDS; seed++) {
      const mix = seed % 2 ? BIG_MIX : BOT_MIX;
      const g = createGame(makeConfig(), [...HUMANS, ...botPlayers(mix)], seed);
      play(g, Infinity, checkInvariants);
      expect(g.over).toBe(true);
    }
  });

  it('are deterministic: the same seed and inputs give the same state', () => {
    const a = createGame(makeConfig(), [...HUMANS, ...botPlayers()], 77);
    const b = createGame(makeConfig(), [...HUMANS, ...botPlayers()], 77);
    play(a);
    play(b);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('survive a JSON round trip mid-round and carry on identically', () => {
    const a = createGame(makeConfig(), [...HUMANS, ...botPlayers()], 78);
    play(a, 70);
    const b = JSON.parse(JSON.stringify(a)) as GameState;
    play(a);
    play(b);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it("don't let human input change where customers appear", () => {
    const players = [...HUMANS, ...botPlayers()];
    const crosswalks = (inputs: (g: GameState) => Record<string, Dir>) => {
      const g = createGame(makeConfig(), players, 9);
      const placed: number[] = [];
      while (g.t < g.config.ROUND.paraStart) {
        const was = g.wave.state;
        step(g, inputs(g));
        if (was === 'pause' && g.wave.state === 'telegraph') placed.push(g.wave.col0);
      }
      return { placed, spawned: g.stats.spawned };
    };
    expect(crosswalks(scripted)).toEqual(crosswalks(() => ({})));
  });

  it('let a bot take over a phone mid-round (and hand it back)', () => {
    const g = createGame(makeConfig(), [...HUMANS, ...botPlayers()], 31);
    play(g, 30);
    setController(g, 'H1', 'newcomer');
    play(g, 60, checkInvariants);
    expect(g.shops[0].controller).toBe('newcomer');
    setController(g, 'H1', 'human');
    play(g, Infinity, checkInvariants);
    expect(g.over).toBe(true);
  });

  it('reject duplicate player ids', () => {
    expect(() => createGame(makeConfig(), [HUMANS[0], HUMANS[0]], 1)).toThrow(/Duplicate/);
  });
});
