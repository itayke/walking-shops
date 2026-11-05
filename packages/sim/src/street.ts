import type { GameState, Shop } from './types.ts';

// Marks "no column" and "not yet" in plain-number fields
export const NONE = -1;

export function shopAt(g: GameState, col: number, level: number): Shop {
  return g.shops[g.cols[col][level]];
}

/** Immovable floors at the bottom of a column: the podium's blocks, once the round is over. */
export function baseOf(g: GameState, col: number): number {
  return g.podium?.blocks[col] ?? 0;
}

/** The floor a shop stands on: its place in its column, over any blocks. */
export function floorOf(g: GameState, s: Shop): number {
  return baseOf(g, s.col) + s.level;
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

/** The tallest column's height, blocks and all. */
export function maxHeight(g: GameState): number {
  let h = 0;
  for (let c = 0; c < g.C; c++) h = Math.max(h, baseOf(g, c) + g.cols[c].length);
  return h;
}

/** Parachutes are falling: the round's second phase. Never in the lobby, whose clock runs on its own. */
export function isPhase2(g: GameState): boolean {
  return !g.lobby && g.t >= g.config.ROUND.paraStart;
}
