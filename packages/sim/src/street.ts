import type { GameState, Shop } from './types.ts';

// Marks "no column" and "not yet" in plain-number fields
export const NONE = -1;

export function shopAt(g: GameState, col: number, level: number): Shop {
  return g.shops[g.cols[col][level]];
}

/** Sync each shop's col/level with its place in the column. */
export function reindex(g: GameState, c: number): void {
  const col = g.cols[c];
  for (let i = 0; i < col.length; i++) {
    const s = g.shops[col[i]];
    s.col = c;
    s.level = i;
  }
}

/**
 * The shop a walk-in enters in a column: the lowest open shop, going upstairs past closed ones. A walking shop blocks
 * the way (shoppers pass under its legs), so riders on its roof don't catch walk-ins.
 */
export function entryShop(g: GameState, c: number): Shop | null {
  for (const i of g.cols[c]) {
    const s = g.shops[i];
    if (s.walking) return null;
    if (!s.closed) return s;
  }
  return null;
}

/** The tallest column's height. */
export function maxHeight(g: GameState): number {
  let h = 0;
  for (const col of g.cols) h = Math.max(h, col.length);
  return h;
}
