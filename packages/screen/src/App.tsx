import { cleanName, Host, NET, randomId, type ScreenMsg } from '@walking-shops/net';
import { connectScreen, type Link } from '@walking-shops/net/client';
import { CONFIG, step, TICK, type GameState, type PlayerSpec } from '@walking-shops/sim';
import { useEffect, useRef, useState } from 'react';
import { createTuningPanel } from './dev/tuningPanel.ts';
import { Hud, Paused, Results, RoomLost } from './hud/Hud.tsx';
import { Lobby } from './hud/Lobby.tsx';
import { Shops } from './hud/Shops.tsx';
import { createKeyboard } from './input/keyboard.ts';
import { soundTones } from './sound/sounds.ts';
import { StreetSound } from './sound/streetSound.ts';
import { Synth } from './sound/synth.ts';
import { currentRoom, isReplaced, isRoomTaken, moveToNewRoom, newRoom, PARTY_HOST, type RoomInfo, type RoomLost as Lost } from './net/room.ts';
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
const PAUSE_KEY = 'p';
const SHOPS_KEY = 'b';
const BEGIN_KEY = 'enter';
// The presenter's controls mid-round: skip to the next phase, restart the round, bots take the phones' shops
const SKIP_KEY = 's';
const RESTART_KEY = 'n';
const FALLBACK_KEY = 'f';
const MUTE_KEY = 'm';
// Reloads on a new room, in the lobby only so a stray key never cuts players off mid-round (or any time once another
// tab has taken this one's room)
const NEW_ROOM_KEY = 'o';
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
  // Cut off from the room (another tab took it, or it's another screen's) until this screen moves to a new one
  lost: Lost | null;
}

/** Run the round (and its animations) ahead with no input, as if watched. */
function fastForward(g: GameState, view: StreetView, seconds: number): void {
  while (g.t < seconds && !g.over) {
    view.onEvents(g, step(g, {}, TICK));
    view.update(g, TICK);
  }
  // Nothing is heard from the part skipped
  view.cues = [];
}

/** The big screen, offline: the street on a canvas, the HUD above it. */
export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const net = useRef<Net>(null!);
  net.current ??= { link: null, room: currentRoom(), online: false, lost: null };
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
  // Sound tries to start at load; a browser that holds it starts it on the presenter's first key or click
  const synth = useRef<Synth>(null!);
  synth.current ??= new Synth();
  // Set once the frame loop is running: starts the round from a button or a key
  const begin = useRef<() => void>(() => {});
  const replay = useRef<() => void>(() => {});
  // The shop list, shown or hidden on its own in the lobby and in the round: open in the lobby, for the presenter to
  // see who's in, and hidden while the street plays unless called up
  const [shops, setShops] = useState({ lobby: true, round: false });
  // Re-renders the HUD a few times a second; the canvas redraws every frame on its own
  const [, setHudTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const view = new StreetView();
    const sound = new StreetSound((id, o, pan) => synth.current.play(soundTones(id, o), pan));
    synth.current.unlock();
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
          // Someone else's room under a random code: open a new one. One asked for by URL is said, not swapped
          const taken = isRoomTaken(code);
          if (isReplaced(code) || (taken && n.room.asked)) {
            n.lost = taken ? 'taken' : 'replaced';
            setHudTick((t) => t + 1);
            return;
          }
          if (!taken) return;
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
      synth.current.pause(false);
      sound.prime();
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
    replay.current = lobby;
    const restart = () => {
      if (host.current.game.lobby) return;
      host.current.restart();
      view.countdown();
      refresh();
    };
    const skip = () => {
      const g = host.current.game;
      if (g.lobby || g.over || view.holding) return;
      host.current.skip();
      setHudTick((t) => t + 1);
    };
    // Bots take the phones' shops while the presenter asks, or once the relay has been out of reach a while
    let manualFallback = false;
    let offlineSince: number | null = null;
    const newStreet = () => {
      view.reset(host.current.reset());
      refresh();
    };
    const disposePanel = createTuningPanel(lobby, newStreet);
    const keyboard = createKeyboard();
    const unlock = () => synth.current.unlock();
    const onKey = (e: KeyboardEvent) => {
      unlock();
      if (e.target instanceof HTMLInputElement) return;
      const key = e.key.toLowerCase();
      if (key === PAUSE_KEY) {
        paused.current = !paused.current;
        synth.current.pause(paused.current);
        setHudTick((t) => t + 1);
      }
      if (key === SHOPS_KEY) {
        const phase = host.current.game.lobby ? 'lobby' : 'round';
        setShops((v) => ({ ...v, [phase]: !v[phase] }));
      }
      if (key === BEGIN_KEY) begin.current();
      if (key === SKIP_KEY) skip();
      if (key === RESTART_KEY) restart();
      if (key === NEW_ROOM_KEY && (host.current.game.lobby || net.current.lost)) moveToNewRoom();
      if (key === MUTE_KEY) {
        synth.current.toggleMute();
        setHudTick((t) => t + 1);
      }
      if (key === FALLBACK_KEY) {
        manualFallback = !manualFallback;
        setHudTick((t) => t + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', unlock);

    let last = performance.now();
    let lastHud = last;
    // Animation clock: stands still while paused, so wobbles and bobs freeze too
    let clock = 0;
    let raf = 0;
    const draw = () => drawFrame(ctx, host.current.game, view, canvas.width, canvas.height, clock);
    const frame = (now: number) => {
      // The next frame is asked for first: an error in this one is logged, but never stops the screen, or the sound
      // and the phones' updates that run on it
      raf = requestAnimationFrame(frame);
      // The first frame's timestamp can come before the loop started, so time never runs backward
      const dt = Math.max(0, Math.min(MAX_FRAME_SECONDS, (now - last) / MS_PER_SECOND));
      last = now;
      const g = host.current.game;
      if (net.current.online) offlineSince = null;
      else offlineSince ??= now;
      host.current.setFallback(manualFallback || (offlineSince !== null && now - offlineSince >= NET.fallbackAfter * MS_PER_SECOND));
      if (!paused.current) {
        if (view.holding) {
          // Taps during the countdown are dropped, so play starts on what's held at WALK-INS!
          host.current.inputs();
          keyboard.dir();
        } else {
          // Through the round, then its end card: the podium plays on until the next round
          acc += dt;
          for (let n = 0; acc >= TICK && n < MAX_TICKS_PER_FRAME; n++) {
            const inputs = host.current.inputs();
            const dir = keyboard.dir();
            if (SCREEN_SHOP) inputs[SCREEN_SHOP.id] = dir;
            const events = step(g, inputs, TICK);
            view.onEvents(g, events);
            sound.onEvents(g, events, clock);
            acc -= TICK;
          }
          acc = Math.min(acc, TICK);
        }
        view.update(g, dt);
        clock += dt;
        sound.update(g, view, clock);
      }
      draw();
      if (now - lastHud >= HUD_REFRESH_MS) {
        lastHud = now;
        setHudTick((t) => t + 1);
      }
    };
    // Phones hear from the screen on a timer of their own, not the frame loop: a browser stops drawing a hidden or covered
    // window (the presenter on another tab or app), and phones still have to get in
    const flushTimer = setInterval(() => host.current.flush(), NET.stateInterval * MS_PER_SECOND);
    // First frame now, not on the next animation frame (a headless screenshot may never get one)
    draw();
    setHudTick((t) => t + 1);
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(flushTimer);
      observer.disconnect();
      disposePanel();
      keyboard.dispose();
      net.current.link?.close();
      net.current.link = null;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', unlock);
    };
  }, []);

  const g = host.current.game;
  return (
    <div className="screen">
      <Hud
        g={g}
        you={SCREEN_SHOP?.id}
        room={{ code: net.current.room.code, online: net.current.online, phones: host.current.seats, fallback: host.current.fallback }}
        sound={synth.current.state}
        onUnlock={() => {
          synth.current.unlock();
          setHudTick((t) => t + 1);
        }}
      />
      <div className="stage">
        <canvas ref={canvasRef} />
        {g.lobby && <Lobby room={net.current.room.code} onBegin={() => begin.current()} />}
        {/* The end card always shows the ranking */}
        {(g.over || shops[g.lobby ? 'lobby' : 'round']) && (
          <Shops
            g={g}
            seats={host.current.seats}
            you={SCREEN_SHOP?.id}
            onRename={(id, name) => host.current.rename(id, name) && setHudTick((t) => t + 1)}
            onRemove={(id) => {
              host.current.remove(id);
              setHudTick((t) => t + 1);
            }}
          />
        )}
        {g.over ? <Results g={g} onReplay={() => replay.current()} /> : paused.current && <Paused />}
        {net.current.lost && <RoomLost why={net.current.lost} />}
      </div>
    </div>
  );
}
