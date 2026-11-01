import { Host, NET, randomId, type ScreenMsg } from '@walking-shops/net';
import { connectScreen, type Link } from '@walking-shops/net/client';
import { CONFIG, step, TICK, type GameState, type PlayerSpec } from '@walking-shops/sim';
import { useEffect, useRef, useState } from 'react';
import { createTuningPanel } from './dev/tuningPanel.ts';
import { Board, Hud, Paused, Results } from './hud/Hud.tsx';
import { createKeyboard } from './input/keyboard.ts';
import { currentRoom, isRoomTaken, newRoom, PARTY_HOST, type RoomInfo } from './net/room.ts';
import { shopHue, shopTint } from './render/colors.ts';
import { drawFrame } from './render/draw.ts';
import { StreetView } from './render/view.ts';

// Most ticks run in one frame after a stall (a background tab), so the sim never spirals
const MAX_TICKS_PER_FRAME = 10;
// Longest frame the animations advance by, for the same reason
const MAX_FRAME_SECONDS = 0.25;
const MS_PER_SECOND = 1000;
const HUD_REFRESH_MS = 100;
// Sharper than this costs fill rate on a 4K projector for nothing
const MAX_PIXEL_RATIO = 2;
const SEED_RANGE = 2 ** 32;
const PAUSE_KEY = ' ';
const BOARD_KEY = 'b';
// URL parameters for debugging: ?seed=N replays a round, ?at=S fast-forwards the first round to S seconds
const params = new URLSearchParams(location.search);
const SEED_PARAM = params.get('seed');
const START_AT = Number(params.get('at') ?? 0);

// The keyboard always plays one shop; phones take over bots' shops as they join, and bots play the rest
const YOU: PlayerSpec = { id: 'you', label: 'YOU', controller: 'human' };

const seed = () => (SEED_PARAM === null ? Math.floor(Math.random() * SEED_RANGE) : Number(SEED_PARAM));

/** The room link, or none yet. Host sends through it; a closed or missing link drops state packets until reconnect. */
interface Net {
  link: Link<ScreenMsg> | null;
  room: RoomInfo;
  online: boolean;
}

/** Run the round (and its animations) ahead with no input, as if watched. */
function fastForward(g: GameState, view: StreetView, seconds: number): void {
  while (g.t < seconds && !g.over) {
    view.onEvents(g, step(g, {}, TICK));
    view.update(g, TICK);
  }
}

/** The big screen, offline: the street on a canvas, the HUD above it. */
export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const net = useRef<Net>(null!);
  net.current ??= { link: null, room: currentRoom(), online: false };
  // The game holds CONFIG by reference, so tuning applies live
  const host = useRef<Host>(null!);
  // Phones get their shop's tint as a plain color, the same one the street draws it in
  host.current ??= new Host({ config: CONFIG, local: [YOU], seed, tint: (i) => shopTint(shopHue(i)).base, send: (m) => net.current.link?.send(m) });
  const paused = useRef(false);
  const [board, setBoard] = useState(false);
  // Re-renders the HUD a few times a second; the canvas redraws every frame on its own
  const [, setHudTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const view = new StreetView();
    // A fast-forwarded round is already under way, so it skips the countdown
    view.reset(host.current.game, START_AT === 0);
    fastForward(host.current.game, view, START_AT);
    const connect = () => {
      const n = net.current;
      n.link = connectScreen({
        host: PARTY_HOST,
        room: n.room.code,
        key: n.room.key,
        id: randomId(),
        onMessage: (m) => host.current.receive(m),
        onStatus: (online) => (n.online = online),
        onRefused: (code) => {
          // Someone else's room under this code: open a new one
          if (!isRoomTaken(code)) return;
          n.room = newRoom();
          connect();
        },
      });
    };
    connect();

    // The street draws in device pixels, so art pixels land on whole ones
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const ratio = Math.min(MAX_PIXEL_RATIO, devicePixelRatio || 1);
      canvas.width = Math.round(r.width * ratio);
      canvas.height = Math.round(r.height * ratio);
    };
    // Resizing clears the canvas, so redraw straight away rather than wait for the next frame
    const observer = new ResizeObserver(() => {
      resize();
      draw();
    });
    observer.observe(canvas);
    resize();

    let acc = 0;
    const restart = () => {
      view.reset(host.current.restart(), true);
      acc = 0;
      paused.current = false;
      setHudTick((t) => t + 1);
    };
    const disposePanel = createTuningPanel(restart);
    const keyboard = createKeyboard();
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === PAUSE_KEY) {
        e.preventDefault();
        paused.current = !paused.current;
        setHudTick((t) => t + 1);
      }
      if (key === BOARD_KEY) setBoard((b) => !b);
    };
    window.addEventListener('keydown', onKey);

    let last = performance.now();
    let lastHud = last;
    let lastFlush = last;
    // Animation clock: stands still while paused, so wobbles and bobs freeze too
    let clock = 0;
    let raf = 0;
    const draw = () => drawFrame(ctx, host.current.game, view, canvas.width, canvas.height, clock);
    const frame = (now: number) => {
      const dt = Math.min(MAX_FRAME_SECONDS, (now - last) / MS_PER_SECOND);
      last = now;
      const g = host.current.game;
      if (!paused.current) {
        if (view.holding) {
          // Taps during the countdown are dropped, so play starts on what's held at GO!
          host.current.inputs();
          keyboard.dir();
        } else if (!g.over) {
          acc += dt;
          for (let n = 0; acc >= TICK && n < MAX_TICKS_PER_FRAME; n++) {
            view.onEvents(g, step(g, { ...host.current.inputs(), [YOU.id]: keyboard.dir() }, TICK));
            acc -= TICK;
          }
          acc = Math.min(acc, TICK);
        }
        view.update(g, dt);
        clock += dt;
      }
      draw();
      if (now - lastFlush >= NET.stateInterval * MS_PER_SECOND) {
        lastFlush = now;
        host.current.flush();
      }
      if (now - lastHud >= HUD_REFRESH_MS) {
        lastHud = now;
        setHudTick((t) => t + 1);
      }
      raf = requestAnimationFrame(frame);
    };
    // First frame now, not on the next animation frame (a headless screenshot may never get one)
    draw();
    setHudTick((t) => t + 1);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      disposePanel();
      keyboard.dispose();
      net.current.link?.close();
      net.current.link = null;
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const g = host.current.game;
  return (
    <div className="screen">
      <Hud g={g} you={YOU.id} room={{ code: net.current.room.code, online: net.current.online, phones: host.current.seats }} />
      <div className="stage">
        <canvas ref={canvasRef} />
        {board && <Board g={g} you={YOU.id} />}
        {g.over ? <Results g={g} you={YOU.id} /> : paused.current && <Paused />}
      </div>
    </div>
  );
}
