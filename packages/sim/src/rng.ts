import type { RngState } from './types.ts';

/** Seeded mulberry32 step: advances `r` and returns a float in [0, 1). State is one uint32, so it serializes. */
export function rand(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) | 0;
  let t = Math.imul(r.s ^ (r.s >>> 15), 1 | r.s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function makeRng(seed: number): RngState {
  return { s: (seed >>> 0) || 1 };
}

/** Fisher–Yates in place. */
export function shuffle<T>(a: T[], r: RngState): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand(r) * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}
