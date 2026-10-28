import { BOT_MIX, botPlayers, CONFIG, createGame, step, telegraphBars, TICK, type GameState } from '@walking-shops/sim';
import { useEffect, useRef, useState } from 'react';
import { createTuningPanel } from './dev/tuningPanel.ts';

// Most ticks run in one frame after a stall (a background tab), so the sim never spirals
const MAX_TICKS_PER_FRAME = 10;
const MS_PER_SECOND = 1000;
const SEED_RANGE = 2 ** 32;
const NO_INPUT = {};

// Bots only until the phones arrive (Milestone 3). The game holds CONFIG by reference, so tuning applies live
function newGame(): GameState {
  return createGame(CONFIG, botPlayers(BOT_MIX), Math.floor(Math.random() * SEED_RANGE));
}

/** Stub: runs a bot round at the fixed tick and shows the scoreboard. Milestone 2 draws the street. */
export function App() {
  const game = useRef<GameState>(newGame());
  const [, setFrame] = useState(0);

  useEffect(() => {
    const disposePanel = createTuningPanel(() => (game.current = newGame()));
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    const frame = (now: number) => {
      acc += (now - last) / MS_PER_SECOND;
      last = now;
      for (let n = 0; acc >= TICK && n < MAX_TICKS_PER_FRAME; n++) {
        step(game.current, NO_INPUT, TICK);
        acc -= TICK;
      }
      acc = Math.min(acc, TICK);
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      disposePanel();
    };
  }, []);

  const g = game.current;
  const { ROUND } = g.config;
  const phase = g.over ? 'Results' : g.t < ROUND.paraStart ? 'Walk-ins' : 'Parachutes';
  const shops = [...g.shops].sort((a, b) => b.income - a.income);
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>Walking Shops</h1>
      <p>
        {phase} · {Math.max(0, ROUND.roundTime - g.t).toFixed(0)}s left · crosswalk {g.wave.state} ({telegraphBars(g)} bars) ·
        heights {g.cols.map((c) => c.length).join(' ')}
      </p>
      <table>
        <thead>
          <tr>
            <th align="left">Shop</th>
            <th align="left">Bot</th>
            <th align="right">Column</th>
            <th align="right">Floor</th>
            <th align="right">Customers</th>
          </tr>
        </thead>
        <tbody>
          {shops.map((s) => (
            <tr key={s.id} style={{ opacity: s.closed ? 0.4 : 1 }}>
              <td>{s.label}</td>
              <td>{s.controller}</td>
              <td align="right">{s.col}</td>
              <td align="right">{s.level}</td>
              <td align="right">{s.income.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
