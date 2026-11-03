import { DEV_PORTS, isRoomCode, randomId, type PhoneMsg, type PhoneState } from '@walking-shops/net';
import { connectPhone, type Link } from '@walking-shops/net/client';
import { scoreText, type Dir } from '@walking-shops/sim';
import { useEffect, useRef, useState, type PointerEvent } from 'react';

// The reconnect token: the same token reclaims the same shop after a dropped connection or a reload
const TOKEN_KEY = 'walking-shops.token';
const ROOM = new URLSearchParams(location.search).get('room')?.toUpperCase() ?? '';
const PARTY_HOST: string = import.meta.env.VITE_PARTY_HOST || `${location.hostname}:${DEV_PORTS.server}`;
// Short buzzes where supported (not iOS): a press, and the shutters coming down
const PRESS_BUZZ_MS = 12;
const CLOSED_BUZZ = [80, 60, 80];

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

const buzz = (pattern: number | number[]) => navigator.vibrate?.(pattern);

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

/** One line on the phone, kept short: the screen carries the game. */
function status(online: boolean, host: boolean, s: PhoneState | null): string {
  if (!online) return 'Connecting…';
  if (!host) return 'Waiting for the big screen';
  if (!s) return 'Joining…';
  switch (s.phase) {
    case 'waiting':
      return "Round under way: you're in the next one";
    case 'lobby':
      return 'Warm up! The round starts soon';
    case 'results':
      return `#${s.rank} of ${s.of} · ${scoreText(s.income)}`;
    default:
      return s.closed ? 'Shutters down: tap to open' : 'Tap to step · hold to walk';
  }
}

/** The controller: the whole phone is two halves. Tap left or right to step, hold to keep walking. */
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
  const wake = useWakeLock();

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
  const down = (d: Dir) => (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    fingers.current.delete(e.pointerId);
    fingers.current.set(e.pointerId, d);
    buzz(PRESS_BUZZ_MS);
    wake();
    update();
  };
  const up = (e: PointerEvent) => {
    fingers.current.delete(e.pointerId);
    update();
  };

  if (!isRoomCode(ROOM)) {
    return (
      <main className="message">
        <p>Open the link shown on the big screen to join.</p>
      </main>
    );
  }
  const half = (d: Dir) => (
    <div className={held === d ? 'half held' : 'half'} onPointerDown={down(d)} onPointerUp={up} onPointerCancel={up}>
      <span className="arrow">{d < 0 ? '◀' : '▶'}</span>
    </div>
  );
  return (
    <main className="pad" style={state?.tint ? { background: state.tint } : undefined} onContextMenu={(e) => e.preventDefault()}>
      {half(-1)}
      {half(1)}
      <header className="status">
        <strong>{state?.label ?? ''}</strong>
        <span>{status(online, host, state)}</span>
      </header>
    </main>
  );
}
