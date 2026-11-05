import { telegraphBars, crosswalkWidth, type GameState, type SimEvent } from '@walking-shops/sim';
import { TAU, MOTION_LOOK } from '@walking-shops/render/look.ts';
import { shutterShown } from '@walking-shops/render/shopArt.ts';
import { strainsByColumn } from '@walking-shops/render/strain.ts';
import type { Banner, Cue, StreetView } from '@walking-shops/render/view.ts';
import { MIX, Mixer } from './mixer.ts';
import type { SoundId, SoundOpts } from './sounds.ts';

// The round's last seconds tick
export const TICK_FROM = 5;
// Push grunts climb this many steps as the push nears its topple
const STRAIN_STEPS = 4;

const BANNER_SOUND: Record<Banner, SoundId> = { ready: 'ready', walkIns: 'walkIns', phase2: 'parachutes' };

/** Where a sound goes: an id, what it varies by, and its pan from -1 (left) to 1 (right). */
export type Play = (id: SoundId, o: SoundOpts, pan: number) => void;

/**
 * Turns the street into sounds: the sim's events, the view's cues, and changes it watches for in the state (shutters
 * dropping, a push's wobble, crosswalk bars, the clock). Only reads the game. Time is the screen's animation clock.
 */
export class StreetSound {
  private readonly mixer = new Mixer();
  // Off until the next update has taken the street as it stands, so a jump (fast-forward, restart) makes no sound
  private primed = false;
  private readonly rows = new Map<string, number>();
  private bars = 0;
  private secondsLeft = 0;
  private over = false;
  private pulse: number | null = null;
  private readonly play: Play;

  constructor(play: Play) {
    this.play = play;
  }

  /** Take the street as it stands on the next update, without a sound. */
  prime(): void {
    this.primed = false;
  }

  onEvents(g: GameState, events: readonly SimEvent[], t: number): void {
    for (const e of events) {
      switch (e.type) {
        case 'topple':
          this.emit(g, 'topple', e.col, t);
          break;
        case 'bump':
          this.emit(g, 'bump', (shopCol(g, e.a) + shopCol(g, e.b)) / 2, t);
          break;
        case 'pushback':
          this.emit(g, 'pushback', e.col, t);
          break;
        case 'closed':
          this.emit(g, 'shutDown', shopCol(g, e.shop), t);
          break;
        case 'paid':
          this.emit(g, e.kind === 'para' ? 'paraCoin' : 'coin', e.x, t);
          break;
        case 'lost':
          this.emit(g, 'lost', e.x, t);
          break;
        case 'reopened':
          // Heard from the shutter itself, which also covers one raised mid-drop
          break;
        case 'landed':
          break;
      }
    }
  }

  /** Once a frame, after the view has updated: its cues, then what changed on the street. */
  update(g: GameState, view: StreetView, t: number): void {
    const cues = view.cues.splice(0);
    // Once the round is over the winner has the stage: the street keeps moving, but quietly
    if (g.over) {
      if (this.primed && !this.over) this.emit(g, 'winner', null, t);
      this.primed = true;
      this.over = true;
      return;
    }
    for (const c of cues) this.cue(g, c, t);
    const quiet = !this.primed;
    this.primed = true;
    this.shutters(g, t, quiet);
    this.strain(g, t, quiet);
    const bars = telegraphBars(g);
    if (!quiet && bars > this.bars) this.emit(g, 'bar', g.wave.col0 + (crosswalkWidth(g) - 1) / 2, t, { last: bars >= g.config.WAVES.waveLines });
    this.bars = bars;
    const left = Math.ceil(g.config.ROUND.roundTime - g.t);
    if (!quiet && !g.lobby && left !== this.secondsLeft && left > 0 && left <= TICK_FROM) this.emit(g, 'tick', null, t);
    this.secondsLeft = left;
    this.over = false;
  }

  private cue(g: GameState, c: Cue, t: number): void {
    if (c.kind === 'footfall') this.emit(g, 'step', c.x, t, { level: c.level, foot: c.foot });
    else if (c.kind === 'banner') this.emit(g, BANNER_SOUND[c.banner], null, t);
    else this.emit(g, c.kind, c.x, t);
  }

  /** A click per shutter row as it drops, and the snap when it goes back up. Closing itself is the closed event. */
  private shutters(g: GameState, t: number, quiet: boolean): void {
    for (const s of g.shops) {
      const rows = shutterShown(g, s);
      const was = this.rows.get(s.id) ?? rows;
      this.rows.set(s.id, rows);
      if (quiet) continue;
      if (rows > was) this.emit(g, 'shutRow', s.col, t, { row: rows - 1 });
      else if (rows === 0 && was > 0) this.emit(g, 'shutUp', s.col, t);
    }
  }

  /** One grunt per wobble of the furthest-along push on the street, in time with the drawn wobble. */
  private strain(g: GameState, t: number, quiet: boolean): void {
    let top: { col: number; amount: number } | null = null;
    for (const [col, st] of strainsByColumn(g)) if (!top || st.amount > top.amount) top = { col, amount: st.amount };
    if (!top) {
      this.pulse = null;
      return;
    }
    const pulse = Math.floor((t * MOTION_LOOK.strainRate) / TAU);
    if (!quiet && pulse !== this.pulse) this.emit(g, 'strain', top.col, t, { step: Math.min(STRAIN_STEPS - 1, Math.floor(top.amount * STRAIN_STEPS)) });
    this.pulse = pulse;
  }

  private emit(g: GameState, id: SoundId, x: number | null, t: number, o: SoundOpts = {}): void {
    if (!this.mixer.admit(id, t)) return;
    this.play(id, o, x === null ? 0 : pan(g, x));
  }
}

function shopCol(g: GameState, id: string): number {
  return g.shops.find((s) => s.id === id)?.col ?? 0;
}

/** A column's place in the stereo field, the street's ends toward the sides. */
export function pan(g: GameState, x: number): number {
  return g.C > 1 ? ((x / (g.C - 1)) * 2 - 1) * MIX.panWidth : 0;
}
