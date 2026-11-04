import { cleanName, NET, type Seat } from '@walking-shops/net';
import { shopHue, shopTint } from '@walking-shops/render/colors.ts';
import { COPY } from '@walking-shops/render/copy.ts';
import { lookOf } from '@walking-shops/render/shopArt.ts';
import { nameFits } from '@walking-shops/render/signs.ts';
import { scoreText, type GameState, type Shop } from '@walking-shops/sim';
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ranked } from './Hud.tsx';

// How long a row takes to slide to its new place when the order changes
const MOVE_MS = 400;

/** A name the presenter is typing over a shop's: kept only if it fits the sign. */
function Rename({ name, onDone }: { name: string; onDone: (name: string | null) => void }) {
  const [value, setValue] = useState(name);
  const clean = cleanName(value);
  const ok = clean.length > 0 && nameFits(clean);
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && ok) onDone(clean);
    if (e.key === 'Escape') onDone(null);
  };
  return (
    <input
      className={ok ? 'rename' : 'rename invalid'}
      value={value}
      maxLength={NET.nameMax}
      autoFocus
      onFocus={(e) => e.target.select()}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={key}
      onBlur={() => onDone(ok ? clean : null)}
      aria-label="New name"
    />
  );
}

/** Slides each row from where it was to where it is now, so a change of order is seen rather than jumped. */
function useSlide() {
  const list = useRef<HTMLOListElement>(null);
  const tops = useRef(new Map<string, number>());
  useLayoutEffect(() => {
    const next = new Map<string, number>();
    for (const li of list.current?.children ?? []) {
      if (!(li instanceof HTMLElement) || !li.dataset.id) continue;
      const top = li.offsetTop;
      const was = tops.current.get(li.dataset.id);
      if (was !== undefined && was !== top) li.animate([{ transform: `translateY(${was - top}px)` }, { transform: 'none' }], { duration: MOVE_MS, easing: 'ease-out' });
      next.set(li.dataset.id, top);
    }
    tops.current = next;
  });
  return list;
}

/** Why a shop's row is tagged: a bot plays it, or its phone dropped. */
function tagOf(s: Shop, seat: Seat | undefined): 'bot' | 'offline' | null {
  if (s.controller !== 'human') return 'bot';
  return seat?.online === false ? 'offline' : null;
}

/**
 * The shops, for the presenter. In the lobby, in the order they opened: click a name to rename it, × to take it off
 * the street (its phone goes back to setting up). In the round, the live ranking by money. Bots and dropped phones
 * are tagged, and phones without a shop yet are counted at the end.
 */
export function Shops({ g, seats, you, onRename, onRemove }: {
  g: GameState;
  seats: ReadonlyMap<string, Seat>;
  you?: string;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const list = useSlide();
  const lobby = g.lobby;
  const rows = lobby ? g.shops.map((s, index) => ({ s, index })) : ranked(g);
  const seatOf = new Map<string, Seat>();
  let pending = 0;
  for (const seat of seats.values()) {
    if (seat.shop !== null) seatOf.set(seat.shop, seat);
    else if (seat.online) pending++;
  }
  return (
    <div className="shops">
      <p className="shops-title">{lobby ? COPY.shops.open(g.shops.length) : COPY.shops.ranking}</p>
      <ol ref={list}>
        {rows.map(({ s, index }, place) => {
          const tag = tagOf(s, seatOf.get(s.id));
          const cls = [s.id === you && 'me', tag === 'offline' && 'offline', !lobby && s.closed && 'closed'].filter(Boolean).join(' ');
          return (
            <li key={s.id} data-id={s.id} className={cls || undefined}>
              {!lobby && <span className="shops-place">{place + 1}</span>}
              <span className="swatch" style={{ background: shopTint(shopHue(lookOf(s, index).hue)).base }} />
              {editing === s.id && lobby ? (
                <Rename
                  name={s.label}
                  onDone={(name) => {
                    if (name !== null) onRename(s.id, name);
                    setEditing(null);
                  }}
                />
              ) : lobby ? (
                <button type="button" className="shops-name" onClick={() => setEditing(s.id)} title="Rename">
                  {s.label}
                </button>
              ) : (
                <span className="shops-name">{s.label}</span>
              )}
              {tag && <span className="shops-tag">{COPY.shops[tag]}</span>}
              {lobby ? (
                <button type="button" className="shops-remove" onClick={() => onRemove(s.id)} title="Take off the street" aria-label={`Remove ${s.label}`}>
                  ×
                </button>
              ) : (
                <span className="shops-money" title={`Walk-ins ${scoreText(s.incGround)} · Parachuters ${scoreText(s.incPara)}`}>
                  {scoreText(s.income)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {pending > 0 && (
        <p className="shops-pending">{COPY.shops.pending(pending, lobby)}</p>
      )}
    </div>
  );
}
