import type { GameState, Shop } from './types.ts';

/** A customer pays the shop it enters; nothing is shared. Phase 1 earnings are weighted down. */
export function pay(g: GameState, catcher: Shop, value: number, kind: 'ground' | 'para'): void {
  const { ROUND, SCORING } = g.config;
  const earned = value * (g.t < ROUND.paraStart ? SCORING.phase1Weight : 1);
  catcher.income += earned;
  if (kind === 'para') catcher.incPara += earned;
  else catcher.incGround += earned;
  g.events.push({ type: 'paid', shop: catcher.id, value: earned, kind });
  if (kind === 'para') {
    g.stats.paraCaught++;
    if (g.cols[catcher.col].length > 1) g.stats.paraByTower++;
  }
}
