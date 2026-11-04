import { cleanName, Host, NET, randomId, type ScreenMsg } from '@walking-shops/net';
import { connectScreen, type Link } from '@walking-shops/net/client';
import { CONFIG, step, TICK, type GameState, type PlayerSpec } from '@walking-shops/sim';
import { useEffect, useRef, useState } from 'react';
import { createTuningPanel } from './dev/tuningPanel.ts';
import { Board, Hud, Paused, Results } from './hud/Hud.tsx';
import { Lobby } from './hud/Lobby.tsx';
import { createKeyboard } from './input/keyboard.ts';
import { currentRoom, isRoomTaken, newRoom, PARTY_HOST, type RoomInfo } from './net/room.ts';
import { HUES, shopHue, shopTint } from '@walking-shops/render/colors.ts';
import { drawFrame } from '@walking-shops/render/draw.ts';
import { DESIGN_COUNT } from '@walking-shops/render/shopArt.ts';
import { StreetView } from '@walking-shops/render/view.ts';

// Most ticks run in one frame after a stall (a background tab), so the sim never spirals
const MAX_TICKS_PER_FRAME = 10;
// Longest frame the animations advance by, for the same reason
const MAX_FRAME_SECONDS = 0.25;
const MS_PER_SECOND = 1000;
const HUD_REFRESH_MS = 100;
// Drawn at CSS pixels at most: a retina screen scales it up hard-edged, rather than filling several times the pixels
const MAX_PIXEL_RATIO = 1;
const SEED_RANGE = 2 ** 32;
const PAUSE_KEY = ' ';
const BOARD_KEY = 'b';
const BEGIN_KEY = 'enter';
// URL parameters for debugging: ?seed=N replays a round, ?at=S skips the lobby and fast-forwards the round to S seconds
const params = new URLSearchParams(location.search);
const SEED_PARAM = params.get('seed');
const START_AT = Number(params.get('at') ?? 0);

// Phones open their shops in the lobby, and bots fill the rest when the round begins. ?screenShop=NAME also seats a
// shop played from the screen's keyboard under that name (?screenShop alone gives it the default name)
const SCREEN_SHOP_PARAM = params.get('screenShop');
const SCREEN_SHOP_NAME = 'YOU';
const SCREEN_SHOP: PlayerSpec | null =
  SCREEN_SHOP_PARAM === null
    ? null
    : { id: 'screen', label: cleanName(SCREEN_SHOP_PARAM).slice(0, NET.nameMax) || SCREEN_SHOP_NAME, controller: 'human' };

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
  host.current ??= new Host({
    config: CONFIG,
    local: SCREEN_SHOP ? [SCREEN_SHOP] : [],
    seed,
    looks: { designs: DESIGN_COUNT, hues: HUES.length },
    tint: (look) => shopTint(shopHue(look.hue)).base,
    send: (m) => net.current.link?.send(m),
  });
  const paused = useRef(false);
  // Set once the frame loop is running: starts the round from a button or a key
  const begin = useRef<() => void>(() => {});
  const [board, setBoard] = useState(false);
  // Re-renders the HUD a few times a second; the canvas redraws every frame on its own
  const [, setHudTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const view = new StreetView();
    // A fast-forwarded round is already under way, so it skips the lobby and the countdown
    if (START_AT > 0) host.current.begin();
    view.reset(host.current.game);
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

    // The street draws in canvas pixels, so art pixels land on whole ones
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
    const refresh = () => {
      acc = 0;
      paused.current = false;
      setHudTick((t) => t + 1);
    };
    begin.current = () => {
      if (!host.current.game.lobby) return;
      host.current.begin();
      view.countdown();
      refresh();
    };
    // The street stays as it is: the bots leave and everyone else stays put
    const lobby = () => {
      host.current.replay();
      refresh();
    };
    const newStreet = () => {
      view.reset(host.current.reset());
      refresh();
    };
    const disposePanel = createTuningPanel(lobby, newStreet);
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
      if (key === BEGIN_KEY) begin.current();
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
            const inputs = host.current.inputs();
            const dir = keyboard.dir();
            if (SCREEN_SHOP) inputs[SCREEN_SHOP.id] = dir;
            view.onEvents(g, step(g, inputs, TICK));
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
      <Hud g={g} you={SCREEN_SHOP?.id} room={{ code: net.current.room.code, online: net.current.online, phones: host.current.seats }} />
      <div className="stage">
        <canvas ref={canvasRef} />
        {g.lobby && (
          <Lobby
            g={g}
            room={net.current.room.code}
            seats={host.current.seats}
            onBegin={() => begin.current()}
            onRename={(id, name) => host.current.rename(id, name) && setHudTick((t) => t + 1)}
            onRemove={(id) => {
              host.current.remove(id);
              setHudTick((t) => t + 1);
            }}
          />
        )}
        {board && <Board g={g} you={SCREEN_SHOP?.id} />}
        {g.over ? <Results g={g} you={SCREEN_SHOP?.id} /> : paused.current && <Paused />}
      </div>
    </div>
  );
}
