import type { GameState, Shop } from '@walking-shops/sim';
import { shopFillCss, shopHue } from '../render/colors.ts';

const SECONDS_PER_MINUTE = 60;
const PERCENT = 100;
// Rows on the results card; the board shows everyone
const RESULTS_SHOWN = 10;

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / SECONDS_PER_MINUTE)}:${String(s % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

// Phase 1 earnings are weighted, so scores carry a decimal
function amount(v: number): string {
  return v.toFixed(1);
}

/** Shops by income, best first, each with its index (for its color). */
function ranked(g: GameState): { s: Shop; index: number }[] {
  return g.shops.map((s, index) => ({ s, index })).sort((a, b) => b.s.income - a.s.income);
}

/** Phase, clock, round progress with the phase 2 mark, and your score. */
export function Hud({ g, you }: { g: GameState; you: string }) {
  const { ROUND } = g.config;
  const phase2 = g.t >= ROUND.paraStart;
  const mine = g.shops.find((s) => s.id === you);
  return (
    <header className="hud">
      <span className={phase2 ? 'pill phase2' : 'pill'}>{g.over ? 'Results' : phase2 ? 'Parachutes' : 'Walk-ins'}</span>
      <span className="timer">{clock(ROUND.roundTime - g.t)}</span>
      <div className="progress">
        <i style={{ width: `${Math.min(PERCENT, (PERCENT * g.t) / ROUND.roundTime)}%` }} />
        <b style={{ left: `${Math.min(PERCENT, (PERCENT * ROUND.paraStart) / ROUND.roundTime)}%` }} />
      </div>
      {mine && (
        <span className="you">
          {mine.label} <strong>{amount(mine.income)}</strong>
        </span>
      )}
      <span className="hint">
        <kbd>A</kbd> <kbd>D</kbd> walk · <kbd>Space</kbd> pause · <kbd>B</kbd> board · <kbd>T</kbd> tuning · <kbd>R</kbd> restart
      </span>
    </header>
  );
}

/** Every shop's earnings, live. A debugging aid; the stage show uses the results card. */
export function Board({ g, you }: { g: GameState; you: string }) {
  return (
    <div className="board">
      <table>
        <thead>
          <tr>
            <th>Shop</th>
            <th>Player</th>
            <th className="num">Walk-ins</th>
            <th className="num">Chutes</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {ranked(g).map(({ s, index }) => (
            <tr key={s.id} className={s.id === you ? 'me' : s.closed ? 'closed' : undefined}>
              <td>
                <span className="swatch" style={{ background: shopFillCss(shopHue(index)) }} />
                {s.label}
              </td>
              <td>{s.controller}</td>
              <td className="num">{amount(s.incGround)}</td>
              <td className="num">{amount(s.incPara)}</td>
              <td className="num">{amount(s.income)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Results({ g, you }: { g: GameState; you: string }) {
  const rows = ranked(g);
  const myRank = rows.findIndex((r) => r.s.id === you);
  const [best] = rows;
  return (
    <div className="overlay dim">
      <div className="card">
        <h2>{best ? `${best.s.label} wins` : 'Round over'}</h2>
        <table>
          <tbody>
            {rows.slice(0, RESULTS_SHOWN).map(({ s, index }, i) => (
              <tr key={s.id} className={s.id === you ? 'me' : undefined}>
                <td className="num">{i + 1}</td>
                <td>
                  <span className="swatch" style={{ background: shopFillCss(shopHue(index)) }} />
                  {s.label}
                </td>
                <td className="num">{amount(s.income)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {myRank >= RESULTS_SHOWN && (
          <p>
            You: #{myRank + 1} with {amount(rows[myRank].s.income)}
          </p>
        )}
        <p>
          Press <kbd>R</kbd> for another round
        </p>
      </div>
    </div>
  );
}

export function Paused() {
  return (
    <div className="overlay">
      <h2>Paused</h2>
    </div>
  );
}
