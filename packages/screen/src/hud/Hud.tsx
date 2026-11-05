import type { Seat } from '@walking-shops/net';
import { isPhase2, scoreText, type GameState, type Shop } from '@walking-shops/sim';
import { shopHue, shopTint } from '@walking-shops/render/colors.ts';
import { COPY } from '@walking-shops/render/copy.ts';
import { PixelText } from '@walking-shops/render/PixelText.tsx';
import { lookOf } from '@walking-shops/render/shopArt.ts';
import type { CSSProperties } from 'react';
import { encode } from 'uqr';
import type { SoundState } from '../sound/synth.ts';
import { Qr, qrSpan } from './Qr.tsx';

const SECONDS_PER_MINUTE = 60;
const PERCENT = 100;

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

/**
 * Phase, clock, round progress with the phase 2 mark, connected phones, the screen shop's score if there is one, and a
 * tag while the sound is waiting for a click or muted.
 */
export function Hud({ g, you, room, sound, onUnlock }: { g: GameState; you?: string; room: RoomStatus; sound: SoundState; onUnlock: () => void }) {
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
      {sound === 'locked' && (
        <button type="button" className="sound locked" onClick={onUnlock}>
          {COPY.hud.sound.locked}
        </button>
      )}
      {sound === 'muted' && <span className="sound muted">{COPY.hud.sound.muted}</span>}
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
        <kbd>B</kbd> {keys.shops} · <kbd>M</kbd> {keys.mute} · <kbd>T</kbd> {keys.tuning} · <kbd>R</kbd> {keys.lobby}
      </span>
    </header>
  );
}

/**
 * The end card, over the podium and laid out like the lobby: who to reach and the way back to the lobby where the join
 * card was, the winner's banner where the title was once the winner is up, and the ranking (the shop list) on the right.
 */
export function Results({ g, onReplay }: { g: GameState; onReplay: () => void }) {
  const p = g.podium;
  const up = p && (p.stage === 'crowned' || p.stage === 'free');
  const index = up ? g.shops.findIndex((s) => s.id === p.top[0]) : -1;
  const best = index >= 0 ? g.shops[index] : null;
  const c = COPY.contact;
  const qr = c.site ? encode(c.site) : null;
  return (
    <div className="lobby end" style={qr ? ({ '--qr-modules': qrSpan(qr) } as CSSProperties) : undefined}>
      <div className="lobby-side">
        <div className="join-card contact">
          {qr && <Qr text={c.site} qr={qr} />}
          {c.site && <p className="join-url">{c.site.replace(/^https?:\/\//, '')}</p>}
          <p className="contact-name">{[c.name, c.company].filter(Boolean).join(' · ')}</p>
          {c.email && <p>{c.email}</p>}
          <button type="button" className="pill-button" onClick={onReplay}>
            {COPY.results.again} <kbd>R</kbd>
          </button>
        </div>
      </div>
      <header className="masthead">
        {best && (
          <h2 className="title" style={{ color: shopTint(shopHue(lookOf(best, index).hue)).base }}>
            <PixelText text={COPY.results.wins(best.label)} />
          </h2>
        )}
      </header>
      {/* Where the ranking sits, kept as wide as the contact card's side so the banner stays centered */}
      <div className="lobby-side" />
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
