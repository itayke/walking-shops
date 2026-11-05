import { MOTION_LOOK } from '@walking-shops/render/look.ts';
import type { SoundId } from './sounds.ts';

const SECOND = 1;
// How long a coin rings
const COIN_RING = 0.25;

// How a street of thirty shops stays listenable. Times in seconds
export const MIX = {
  // Most plays of a sound within a span: footfalls across the whole street in a second (one walking shop stays under
  // it, a crowd can't bury the rest), topples through their flight, coins ringing at once
  caps: {
    step: { span: SECOND, max: 10 },
    topple: { span: MOTION_LOOK.arcTime, max: 2 },
    coin: { span: COIN_RING, max: 4 },
    paraCoin: { span: COIN_RING, max: 4 },
  } as Partial<Record<SoundId, { span: number; max: number }>>,
  // Shortest time between two plays of one sound; sounds not listed use gapDefault. Coins stay under the sim's tick, so
  // coins on successive ticks all sound
  gaps: { step: 0.04, coin: 0.04, paraCoin: 0.04, bump: 0.08, topple: 0.15, land: 0.08, drop: 0.1, lost: 0.25 } as Partial<Record<SoundId, number>>,
  gapDefault: 0.05,
  // How far toward each side the end columns pan
  panWidth: 0.7,
};

/** Decides which sounds play when many happen at once. Pure: time comes in as a number. */
export class Mixer {
  private readonly last = new Map<SoundId, number>();
  // Recent plays of each capped sound
  private readonly plays = new Map<SoundId, number[]>();

  /** Whether a sound may play at time t, counting it as played if so. */
  admit(id: SoundId, t: number): boolean {
    if (t - (this.last.get(id) ?? -Infinity) < (MIX.gaps[id] ?? MIX.gapDefault)) return false;
    const cap = MIX.caps[id];
    if (cap) {
      const live = (this.plays.get(id) ?? []).filter((p) => t - p < cap.span);
      if (live.length >= cap.max) return false;
      this.plays.set(id, [...live, t]);
    }
    this.last.set(id, t);
    return true;
  }
}
