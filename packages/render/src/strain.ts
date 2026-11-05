import { baseOf, floorOf, type Dir, type GameState } from '@walking-shops/sim';

/** A tower under a push: everything from `level` (its place in the column) up, how far along the push is, and where it falls. */
export interface Strain {
  level: number;
  amount: number;
  dir: Exclude<Dir, 0>;
}

/** Strained towers by column. Two attackers on one tower show the further push. */
export function strainsByColumn(g: GameState): Map<number, Strain> {
  const out = new Map<number, Strain>();
  const { pushTime } = g.config.MOVEMENT;
  for (const a of g.shops) {
    if (a.pushT <= 0 || a.pushCol < 0) continue;
    const amount = Math.min(1, a.pushT / pushTime);
    const prev = out.get(a.pushCol);
    if (prev && prev.amount >= amount) continue;
    // The tower starts a floor above the pusher's, over any blocks under it
    out.set(a.pushCol, { level: floorOf(g, a) + 1 - baseOf(g, a.pushCol), amount, dir: a.pushCol > a.col ? 1 : -1 });
  }
  return out;
}
