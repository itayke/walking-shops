import type { GameState, Shop } from './types.ts';

/** A customer pays the shop it enters; nothing is shared. */
export function pay(g: GameState, catcher: Shop, value: number, kind: 'ground' | 'para'): void {
  catcher.income += value;
  if (kind === 'para') catcher.incPara += value;
  else catcher.incGround += value;
  g.events.push({ type: 'paid', shop: catcher.id, value, kind });
  if (kind === 'para') {
    g.stats.paraCaught++;
    if (g.cols[catcher.col].length > 1) g.stats.paraByTower++;
  }
}

/** A score as players see it: whole, unless a tuned value made it fractional. */
export function scoreText(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}
