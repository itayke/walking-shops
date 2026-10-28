import { BOT_MIX, botPlayers, CONFIG, createGame, step, TICK, type GameState, type PlayerSpec } from '@walking-shops/sim';
import { useEffect, useRef, useState } from 'react';
import { createTuningPanel } from './dev/tuningPanel.ts';
import { Board, Hud, Paused, Results } from './hud/Hud.tsx';
import { createKeyboard } from './input/keyboard.ts';
import { drawFrame } from './render/draw.ts';
import { onThemeChange, readTheme } from './render/theme.ts';
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

// The keyboard plays one shop until phones arrive (Milestone 3); bots play the rest
const YOU: PlayerSpec = { id: 'you', label: 'YOU', controller: 'human' };

// The game holds CONFIG by reference, so tuning applies live
function newGame(): GameState {
  const seed = SEED_PARAM === null ? Math.floor(Math.random() * SEED_RANGE) : Number(SEED_PARAM);
  return createGame(CONFIG, [YOU, ...botPlayers(BOT_MIX)], seed);
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
  const game = useRef<GameState>(null!);
  game.current ??= newGame();
  const paused = useRef(false);
  const [board, setBoard] = useState(false);
  // Re-renders the HUD a few times a second; the canvas redraws every frame on its own
  const [, setHudTick] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const view = new StreetView();
    view.reset(game.current);
    fastForward(game.current, view, START_AT);
    let theme = readTheme();
    const offTheme = onThemeChange(() => (theme = readTheme()));

    let width = 0;
    let height = 0;
    let ratio = 1;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      ratio = Math.min(MAX_PIXEL_RATIO, devicePixelRatio || 1);
      width = r.width;
      height = r.height;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();

    let acc = 0;
    const restart = () => {
      game.current = newGame();
      view.reset(game.current);
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
    // Animation clock: stands still while paused, so wobbles and bobs freeze too
    let clock = 0;
    let raf = 0;
    const draw = () => {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawFrame(ctx, game.current, view, width, height, theme, clock);
    };
    const frame = (now: number) => {
      const dt = Math.min(MAX_FRAME_SECONDS, (now - last) / MS_PER_SECOND);
      last = now;
      const g = game.current;
      if (!paused.current) {
        if (!g.over) {
          acc += dt;
          for (let n = 0; acc >= TICK && n < MAX_TICKS_PER_FRAME; n++) {
            view.onEvents(g, step(g, { [YOU.id]: keyboard.dir() }, TICK));
            acc -= TICK;
          }
          acc = Math.min(acc, TICK);
        }
        view.update(g, dt);
        clock += dt;
      }
      draw();
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
      offTheme();
      disposePanel();
      keyboard.dispose();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  const g = game.current;
  return (
    <div className="screen">
      <Hud g={g} you={YOU.id} />
      <div className="stage">
        <canvas ref={canvasRef} />
        {board && <Board g={g} you={YOU.id} />}
        {g.over ? <Results g={g} you={YOU.id} /> : paused.current && <Paused />}
      </div>
    </div>
  );
}
