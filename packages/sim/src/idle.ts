import type { GameState, Shop } from './types.ts';

/** Idle shutters: any press reopens; no input for idleTime closes the shop. */
export function updateShutters(g: GameState, dt: number): void {
  const { IDLE } = g.config;
  for (const s of g.shops) {
    if (s.input !== 0) s.idleT = 0;
    else s.idleT += dt;
    const was = s.closed;
    s.closed = IDLE.idleOn && s.idleT >= IDLE.idleTime;
    if (s.closed && !was) {
      g.stats.closures++;
      g.events.push({ type: 'closed', shop: s.id });
    } else if (was && !s.closed) g.events.push({ type: 'reopened', shop: s.id });
    if (s.closed) s.closedTicks++;
  }
}

/** How far the shutters have dropped, 0 (open) to 1 (closed), for rendering the warning. */
export function shutterDrop(g: GameState, s: Shop): number {
  const { IDLE } = g.config;
  if (!IDLE.idleOn) return 0;
  const warnFrom = IDLE.idleTime - IDLE.idleWarn;
  if (s.idleT <= warnFrom) return 0;
  return Math.min(1, (s.idleT - warnFrom) / Math.max(IDLE.idleWarn, Number.EPSILON));
}
