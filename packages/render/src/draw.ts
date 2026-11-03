import type { GameState } from '@walking-shops/sim';
import { drawEffects } from './drawEffects.ts';
import { drawParachuters, drawShoppers } from './drawPeople.ts';
import { drawShops } from './drawShops.ts';
import { drawStreet } from './drawStreet.ts';
import { layoutStreet, type Layout } from './layout.ts';
import type { StreetView } from './view.ts';

/** Draw one frame of the street into a canvas of width × height device pixels. `now` is in seconds. */
export function drawFrame(ctx: CanvasRenderingContext2D, g: GameState, view: StreetView, width: number, height: number, now: number): Layout {
  const L = layoutStreet(width, height, g.C, view.floors);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  // Art pixels scale up as hard-edged blocks
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, width, height);
  drawStreet(ctx, g, L, now);
  drawShops(ctx, g, view, L, now);
  drawShoppers(ctx, g, view, L, now);
  drawParachuters(ctx, g, view, L, now);
  drawEffects(ctx, view, L);
  return L;
}
