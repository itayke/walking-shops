import { DEV_PORTS, isRoomCode, randomId, type PhoneMsg, type PhoneState } from '@walking-shops/net';
import { connectPhone, type Link } from '@walking-shops/net/client';
import { FX_LOOK } from '@walking-shops/render/look.ts';
import { scoreText, type Dir } from '@walking-shops/sim';
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Arrow } from './Arrow.tsx';
import { Badge } from './Badge.tsx';
import { Setup, type Draft } from './Setup.tsx';
import { BACKDROP } from './shop.ts';

// The reconnect token: the same token reclaims the same shop after a dropped connection or a reload
const TOKEN_KEY = 'walking-shops.token';
// The shop being set up, so a reload mid-form keeps what was typed
const DRAFT_KEY = 'walking-shops.draft';
// The size the display font is loaded at before signs are measured; any size loads it
const FONT_PROBE = `16px ${FX_LOOK.displayFont}`;
const ROOM = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
const PARTY_HOST: string = import.meta.env.VITE_PARTY_HOST || `${location.hostname}:${DEV_PORTS.server}`;
// Short buzzes where supported (not iOS): a press, and the shutters coming down
const PRESS_BUZZ_MS = 12;
const CLOSED_BUZZ = [80, 60, 80];
// A finger past the middle by this share of the width takes the other direction, so one resting on it doesn't flicker
const CROSS_MARGIN = 0.04;
// Phases with a street to be ranked on: the money made so far and the place it puts the shop
const SCORED: PhoneState['phase'][] = ['walk-ins', 'parachutes', 'results'];

function token(): string {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) return t;
    const fresh = randomId();
    localStorage.setItem(TOKEN_KEY, fresh);
    return fresh;
  } catch {
    // No storage (private mode): this page load keeps one token, but a reload is a new player
    return randomId();
  }
}

function storedDraft(): Draft | null {
  try {
    const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? 'null') as Draft | null;
    return d && typeof d.name === 'string' && Number.isInteger(d.design) ? d : null;
  } catch {
    return null;
  }
}

function storeDraft(d: Draft): void {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    // No storage: a reload starts the form over
  }
}

const buzz = (pattern: number | number[]) => navigator.vibrate?.(pattern);

/** Signs are measured in the display font, so the form waits for it. */
function useFontReady(): boolean {
  const [ready, setReady] = useState(() => document.fonts.check(FONT_PROBE));
  useEffect(() => {
    if (ready) return;
    // A font that fails to load still lets the form open, measured in the fallback
    document.fonts.load(FONT_PROBE).finally(() => setReady(true));
  }, [ready]);
  return ready;
}

/** Keep the phone awake while it is a controller. Not available on plain http (LAN dev) or every browser: fine. */
function useWakeLock(): () => void {
  const lock = useRef<WakeLockSentinel | null>(null);
  const request = () => {
    if (lock.current || document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
    navigator.wakeLock
      .request('screen')
      .then((l) => {
        lock.current = l;
        l.addEventListener('release', () => (lock.current = null));
      })
      .catch(() => {});
  };
  useEffect(() => {
    document.addEventListener('visibilitychange', request);
    return () => document.removeEventListener('visibilitychange', request);
  });
  return request;
}

/** Where an element's bottom edge is, kept current as it changes size: the controller's card, for the arrows to clear. */
function useBottom(): [(el: HTMLElement | null) => void, number] {
  const [bottom, setBottom] = useState(0);
  const watch = useRef<ResizeObserver | null>(null);
  const ref = useCallback((el: HTMLElement | null) => {
    watch.current?.disconnect();
    watch.current = null;
    if (!el) return setBottom(0);
    watch.current = new ResizeObserver(() => setBottom(el.getBoundingClientRect().bottom));
    watch.current.observe(el);
  }, []);
  return [ref, bottom];
}

/** One line on the phone, kept short: the screen carries the game. */
function status(online: boolean, host: boolean, s: PhoneState | null): string {
  if (!online) return 'Connecting…';
  if (!host) return 'Waiting for the big screen';
  if (!s) return 'Joining…';
  switch (s.phase) {
    case 'setup':
      return 'Set up your shop!';
    case 'waiting':
      return "Game running: you're in the next one!";
    case 'lobby':
      return 'Warm up! The game starts soon';
    case 'results':
      return 'Game over';
    default:
      return s.closed ? 'Shutters down: tap to open' : 'Tap to step · hold to walk';
  }
}

/** The direction a finger at clientX asks for: its own side of the middle, kept until it crosses well past it. */
function sideOf(x: number, width: number, was: Dir): Dir {
  const off = x / width - 1 / 2;
  if (was !== 0 && Math.abs(off) < CROSS_MARGIN) return was;
  return off < 0 ? -1 : 1;
}

/**
 * The controller: the whole phone is two halves under the player's shop. Tap left or right to step, hold to keep
 * walking, and slide a held finger across to turn without letting go.
 */
export function App() {
  const link = useRef<Link<PhoneMsg> | null>(null);
  // Fingers down, oldest first: the newest decides the direction
  const fingers = useRef(new Map<number, Dir>());
  const dir = useRef<Dir>(0);
  // Starts at the clock so it stays ahead of the last session's numbers after a reload
  const seq = useRef(Date.now());
  const [held, setHeld] = useState<Dir>(0);
  const [online, setOnline] = useState(false);
  const [host, setHost] = useState(false);
  const [state, setState] = useState<PhoneState | null>(null);
  // Editing an open shop's name or type, in the lobby
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(storedDraft);
  const fontReady = useFontReady();
  const wake = useWakeLock();
  const [card, cardBottom] = useBottom();

  const send = () => link.current?.send({ t: 'input', seq: ++seq.current, dir: dir.current });

  useEffect(() => {
    if (!isRoomCode(ROOM)) return;
    link.current = connectPhone({
      host: PARTY_HOST,
      room: ROOM,
      id: token(),
      onStatus: (up) => {
        setOnline(up);
        // Whatever is held now holds after a reconnect
        if (up) send();
      },
      onMessage: (m) => {
        if (m.t === 'host') setHost(m.online);
        else if (m.t === 'state') {
          setHost(true);
          setState((prev) => {
            if (m.state.closed && !prev?.closed) buzz(CLOSED_BUZZ);
            return m.state;
          });
        }
      },
    });
    return () => link.current?.close();
  }, []);

  const update = () => {
    const next = [...fingers.current.values()].at(-1) ?? 0;
    if (next === dir.current) return;
    dir.current = next;
    setHeld(next);
    send();
  };
  // The newest finger to press or turn decides, so sliding one across takes over from one resting
  const press = (id: number, d: Dir) => {
    fingers.current.delete(id);
    fingers.current.set(id, d);
    buzz(PRESS_BUZZ_MS);
    update();
  };
  const down = (e: PointerEvent) => {
    if ((e.target as Element).closest('button')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    wake();
    press(e.pointerId, sideOf(e.clientX, e.currentTarget.clientWidth, 0));
  };
  const move = (e: PointerEvent) => {
    const was = fingers.current.get(e.pointerId);
    if (was === undefined) return;
    const d = sideOf(e.clientX, e.currentTarget.clientWidth, was);
    if (d !== was) press(e.pointerId, d);
  };
  const up = (e: PointerEvent) => {
    fingers.current.delete(e.pointerId);
    update();
  };

  // An edit can't outlast the lobby: the round started, so it's dropped and the phone is the controller again
  useEffect(() => {
    if (editing && state?.phase !== 'lobby') setEditing(false);
  }, [editing, state?.phase]);

  const changeDraft = (d: Draft) => {
    setDraft(d);
    storeDraft(d);
  };
  const submit = (d: Draft) => {
    link.current?.send({ t: 'profile', name: d.name, design: d.design });
    changeDraft(d);
    setEditing(false);
    wake();
  };
  const startEdit = () => {
    if (!state) return;
    setDraft({ name: state.label, design: state.look.design });
    setEditing(true);
  };

  if (!isRoomCode(ROOM)) {
    return (
      <main className="message">
        <p>Open the link shown on the big screen to join.</p>
      </main>
    );
  }
  const settingUp = state && (state.phase === 'setup' || (state.phase === 'waiting' && !state.label) || editing);
  if (state && settingUp) {
    return (
      <main className="setup-page" style={{ background: state.tint }}>
        <header className="status">
          <span>{editing ? 'Edit your shop' : status(online, host, state)}</span>
          {state.phase === 'waiting' && <span>Set up now, and it opens next round</span>}
        </header>
        {fontReady && (
          <Setup
            draft={draft ?? { name: '', design: state.look.design }}
            hue={state.look.hue}
            editing={editing}
            onChange={changeDraft}
            onSubmit={submit}
            onCancel={() => setEditing(false)}
          />
        )}
      </main>
    );
  }
  const half = (d: Dir) => (
    <div className={held === d ? 'half held' : 'half'}>
      <Arrow dir={d < 0 ? -1 : 1} className="arrow" />
    </div>
  );
  const scored = state && state.rank > 0 && SCORED.includes(state.phase);
  return (
    <main
      className="pad"
      style={{ background: state?.tint, '--card-bottom': `${cardBottom}px` } as CSSProperties}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
    >
      {half(-1)}
      {half(1)}
      <header className="status">
        {state?.label ? (
          <div ref={card} className="card" style={{ backgroundColor: BACKDROP }}>
            {scored && (
              <p className="score">
                <strong>{scoreText(state.income)}</strong>
                <span>
                  #{state.rank} of {state.of}
                </span>
              </p>
            )}
            {state.phase === 'lobby' && (
              <button type="button" className="edit" onClick={startEdit}>
                Edit shop
              </button>
            )}
            <Badge name={state.label} look={state.look} closed={state.closed} />
            <span>{status(online, host, state)}</span>
          </div>
        ) : (
          <span>{status(online, host, state)}</span>
        )}
      </header>
    </main>
  );
}
