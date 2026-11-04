import type { Seat } from '@walking-shops/net';
import { isPhase2, scoreText, type GameState, type Shop } from '@walking-shops/sim';
import { shopHue, shopTint } from '@walking-shops/render/colors.ts';
import { COPY } from '@walking-shops/render/copy.ts';
import { lookOf } from '@walking-shops/render/shopArt.ts';
import { PixelText } from './PixelText.tsx';

const SECONDS_PER_MINUTE = 60;
const PERCENT = 100;
// Rows on the results card; the shop list shows everyone
const RESULTS_SHOWN = 10;

function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / SECONDS_PER_MINUTE)}:${String(s % SECONDS_PER_MINUTE).padStart(2, '0')}`;
}

/** Shops by income, best first, each with its index (for its color). */
export function ranked(g: GameState): { s: Shop; index: number }[] {
  return g.shops.map((s, index) => ({ s, index })).sort((a, b) => b.s.income - a.s.income);
}

export interface RoomStatus {
  code: string;
  // Connected to the relay
  online: boolean;
  phones: ReadonlyMap<string, Seat>;
  // Bots are playing the phones' shops
  fallback: boolean;
}

/**
 * How many phones are connected, whether the relay is reachable, and whether bots have the phones' shops. The lobby
 * shows where to join.
 */
function Join({ room, round }: { room: RoomStatus; round: boolean }) {
  let phones = 0;
  let shops = 0;
  for (const s of room.phones.values()) {
    if (s.online) phones++;
    if (s.shop !== null) shops++;
  }
  return (
    <span className="join" title={room.online ? 'Connected to the relay' : 'Relay unreachable: keyboard and bots only'}>
      <i className={room.online ? 'dot on' : 'dot'} />
      <span className="phones">{COPY.hud.phones(phones)}</span>
      {room.fallback && round && shops > 0 && <span className="fallback">{COPY.hud.botsPlaying}</span>}
    </span>
  );
}

/** Phase, clock, round progress with the phase 2 mark, connected phones, and the screen shop's score if there is one. */
export function Hud({ g, you, room }: { g: GameState; you?: string; room: RoomStatus }) {
  const { ROUND } = g.config;
  const phase2 = isPhase2(g);
  // The lobby's clock isn't the round's
  const t = g.lobby ? 0 : g.t;
  const mine = g.shops.find((s) => s.id === you);
  const { phase, keys } = COPY.hud;
  return (
    <header className="hud">
      <span className={phase2 ? 'phase phase2' : 'phase'}>{g.lobby ? phase.lobby : g.over ? phase.results : phase2 ? phase.parachutes : phase.walkIns}</span>
      <span className="timer">{clock(ROUND.roundTime - t)}</span>
      <div className="progress">
        <i style={{ width: `${Math.min(PERCENT, (PERCENT * t) / ROUND.roundTime)}%` }} />
        <b style={{ left: `${Math.min(PERCENT, (PERCENT * ROUND.paraStart) / ROUND.roundTime)}%` }} />
      </div>
      <Join room={room} round={!g.lobby && !g.over} />
      {mine && (
        <span className="you">
          {mine.label} <strong>{scoreText(mine.income)}</strong>
        </span>
      )}
      <span className="hint">
        {you && (
          <>
            <kbd>A</kbd> <kbd>D</kbd> {keys.walk} ·{' '}
          </>
        )}
        <kbd>Enter</kbd> {keys.begin} · <kbd>Space</kbd> {keys.pause} · <kbd>S</kbd> {keys.skip} · <kbd>N</kbd> {keys.restart} · <kbd>F</kbd> {keys.bots} ·{' '}
        <kbd>B</kbd> {keys.shops} · <kbd>T</kbd> {keys.tuning} · <kbd>R</kbd> {keys.lobby}
      </span>
    </header>
  );
}

/** The winner in banner type over the top of the ranking, and a way back to the lobby for another round. */
export function Results({ g, you, onReplay }: { g: GameState; you?: string; onReplay: () => void }) {
  const rows = ranked(g);
  const myRank = rows.findIndex((r) => r.s.id === you);
  const [best] = rows;
  return (
    <div className="overlay dim results">
      <h2 className="banner winner" style={best ? { color: shopTint(shopHue(lookOf(best.s, best.index).hue)).base } : undefined}>
        <PixelText text={best ? COPY.results.wins(best.s.label) : COPY.results.noWinner} />
      </h2>
      <div className="card">
        <table>
          <tbody>
            {rows.slice(0, RESULTS_SHOWN).map(({ s, index }, i) => (
              <tr key={s.id} className={s.id === you ? 'me' : undefined}>
                <td className="num">{i + 1}</td>
                <td>
                  <span className="swatch" style={{ background: shopTint(shopHue(lookOf(s, index).hue)).base }} />
                  {s.label}
                </td>
                <td className="num">{scoreText(s.income)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {myRank >= RESULTS_SHOWN && (
          <p>{COPY.results.you(myRank + 1, scoreText(rows[myRank].s.income))}</p>
        )}
        <button type="button" className="pill-button" onClick={onReplay}>
          {COPY.results.again} <kbd>R</kbd>
        </button>
      </div>
    </div>
  );
}

export function Paused() {
  return (
    <div className="overlay">
      <h2 className="banner">
        <PixelText text={COPY.paused} />
      </h2>
    </div>
  );
}
