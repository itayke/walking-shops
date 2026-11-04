import { cleanName, NET, type Seat } from '@walking-shops/net';
import { shopHue, shopTint } from '@walking-shops/render/colors.ts';
import { lookOf } from '@walking-shops/render/shopArt.ts';
import { nameFits } from '@walking-shops/render/signs.ts';
import type { GameState } from '@walking-shops/sim';
import { useState, type CSSProperties, type KeyboardEvent } from 'react';
import { encode } from 'uqr';
import { joinUrl } from '../net/room.ts';
import { PixelText } from './PixelText.tsx';

// Light modules around the code, so a scanner finds its edge against the card, with corners rounded inside that margin
const QR_QUIET = 2;
const QR_CORNER = 1;

/** The join link as square modules, one SVG path, drawn hard-edged; its module count goes to CSS, which sizes it in whole pixels per module. */
function Qr({ text }: { text: string }) {
  const { data, size } = encode(text);
  const span = size + 2 * QR_QUIET;
  let d = '';
  data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x + QR_QUIET} ${y + QR_QUIET}h1v1h-1z`)));
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${span} ${span}`}
      style={{ '--qr-modules': span } as CSSProperties}
      shapeRendering="crispEdges"
      role="img"
      aria-label={text}
    >
      <rect width={span} height={span} rx={QR_CORNER} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

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

/**
 * How many shops are open and which, in the order they opened, for the presenter: click a name to rename it, × to take it off
 * the street (its phone goes back to setting up). A shop whose phone dropped is marked, and phones still setting up
 * are counted at the end.
 */
function Roster({ g, seats, onRename, onRemove }: { g: GameState; seats: ReadonlyMap<string, Seat>; onRename: (id: string, name: string) => void; onRemove: (id: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const shops = g.shops.length;
  const seatOf = new Map<string, Seat>();
  let settingUp = 0;
  for (const s of seats.values()) {
    if (s.shop !== null) seatOf.set(s.shop, s);
    else if (s.online) settingUp++;
  }
  return (
    <div className="roster">
      <p className="roster-count">
        {shops} {shops === 1 ? 'shop' : 'shops'} open
      </p>
      <ol>
        {g.shops.map((s, index) => {
          const offline = seatOf.get(s.id)?.online === false;
          return (
            <li key={s.id} className={offline ? 'offline' : undefined}>
              <span className="swatch" style={{ background: shopTint(shopHue(lookOf(s, index).hue)).base }} />
              {editing === s.id ? (
                <Rename
                  name={s.label}
                  onDone={(name) => {
                    if (name !== null) onRename(s.id, name);
                    setEditing(null);
                  }}
                />
              ) : (
                <button type="button" className="roster-name" onClick={() => setEditing(s.id)} title="Rename">
                  {s.label}
                </button>
              )}
              {offline && <span className="roster-tag">offline</span>}
              <button type="button" className="roster-remove" onClick={() => onRemove(s.id)} title="Take off the street" aria-label={`Remove ${s.label}`}>
                ×
              </button>
            </li>
          );
        })}
      </ol>
      {settingUp > 0 && (
        <p className="roster-pending">
          {settingUp} {settingUp === 1 ? 'phone' : 'phones'} setting up…
        </p>
      )}
    </div>
  );
}

/** Before the round: the title, its tagline and where to join, over the street where shops brawl as they arrive. */
export function Lobby({ g, room, seats, onBegin, onRename, onRemove }: {
  g: GameState;
  room: string;
  seats: ReadonlyMap<string, Seat>;
  onBegin: () => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
}) {
  const url = joinUrl(room);
  return (
    <div className="lobby">
      <div className="lobby-side">
        <div className="join-card">
          <Qr text={url} />
          <p className="join-url">{url.replace(/^https?:\/\//, '')}</p>
          <button type="button" className="pill-button" onClick={onBegin}>
            Begin <kbd>Enter</kbd>
          </button>
        </div>
      </div>
      <header className="masthead">
        <h1 className="title">
          <PixelText text="Shop Shuffle" />
        </h1>
        <PixelText className="tagline" text="Get your business moving" />
      </header>
      <div className="lobby-side end">
        <Roster g={g} seats={seats} onRename={onRename} onRemove={onRemove} />
      </div>
    </div>
  );
}
