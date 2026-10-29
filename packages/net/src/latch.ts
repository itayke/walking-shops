import type { Dir } from '@walking-shops/sim';

/**
 * One controller's direction as the sim reads it each tick: the held direction, or a press already released before
 * the tick read it. A press counts once, so a quick tap is never lost between ticks.
 */
export class Latch {
  private held: Dir = 0;
  private tapped: Dir = 0;

  set(dir: Dir): void {
    this.held = dir;
    if (dir !== 0) this.tapped = dir;
  }

  read(): Dir {
    const dir = this.held !== 0 ? this.held : this.tapped;
    this.tapped = 0;
    return dir;
  }

  clear(): void {
    this.held = this.tapped = 0;
  }
}
