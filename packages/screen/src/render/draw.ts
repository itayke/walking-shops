import type { GameState } from '@walking-shops/sim';
import { drawEffects } from './drawEffects.ts';
import { drawParachuters, drawShoppers } from './drawPeople.ts';
import { drawShops } from './drawShops.ts';
import { drawStreet } from './drawStreet.ts';
import { layoutStreet, type Layout } from './layout.ts';
import type { Theme } from './theme.ts';
import type { StreetView } from './view.ts';

/** Draw one frame of the street into a canvas sized width × height CSS pixels. `now` is in seconds. */
export function drawFrame(ctx: CanvasRenderingContext2D, g: GameState, view: StreetView, width: number, height: number, theme: Theme, now: number): Layout {
  const L = layoutStreet(width, height, g.C, view.floors);
  ctx.clearRect(0, 0, width, height);
  drawStreet(ctx, g, L, theme, now);
  drawShops(ctx, g, view, L, theme, now);
  drawShoppers(ctx, g, view, L, theme);
  drawParachuters(ctx, g, L, theme, now);
  drawEffects(ctx, view, L, theme);
  return L;
}
