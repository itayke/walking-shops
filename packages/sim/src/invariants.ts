import type { GameState } from './types.ts';

/** Throws unless every shop sits in exactly one column slot and its col/level match that slot. */
export function checkInvariants(g: GameState): void {
  if (g.cols.length !== g.C) throw new Error(`column count ${g.cols.length} != ${g.C}`);
  const seen = new Set<number>();
  for (let c = 0; c < g.C; c++) {
    g.cols[c].forEach((i, level) => {
      const s = g.shops[i];
      if (!s) throw new Error(`column ${c} holds unknown shop ${i}`);
      if (s.col !== c || s.level !== level) throw new Error(`index mismatch ${s.label}: at ${c}/${level}, thinks ${s.col}/${s.level}`);
      if (seen.has(i)) throw new Error(`duplicate ${s.label}`);
      seen.add(i);
    });
  }
  if (seen.size !== g.N || g.shops.length !== g.N) throw new Error(`lost a shop: ${seen.size}/${g.N}`);
}
