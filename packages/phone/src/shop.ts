import { PALETTE, shopHue, shopTint } from '@walking-shops/render/colors.ts';
import { SHOP, shopSprite, shutterRows } from '@walking-shops/render/shopArt.ts';
import { drawSignName } from '@walking-shops/render/signs.ts';
import type { Look } from '@walking-shops/sim';

// The street's sky behind a shop, so it stands out from a page in its own color
export const BACKDROP = PALETTE.sky[1];

/** The largest whole scale at which a shop fits a box of CSS pixels, in device pixels per art pixel. */
export function fitScale(boxW: number, boxH: number): number {
  return Math.max(1, Math.floor(Math.min(boxW / SHOP.spriteW, boxH / SHOP.spriteH) * devicePixelRatio));
}

/** A shop as the big screen draws it, its top-left at (left, top): the sprite, shutters down when closed, and the sign. */
export function drawShop(
  ctx: CanvasRenderingContext2D,
  o: { name: string; look: Look; t: number; closed?: boolean; signAlpha?: number },
  left: number,
  top: number,
  P: number,
): void {
  const tint = shopTint(shopHue(o.look.hue));
  const sprite = shopSprite({ design: o.look.design, tint, shutter: o.closed ? shutterRows() : 0, danger: false, t: o.t });
  ctx.drawImage(sprite, left, top, SHOP.spriteW * P, SHOP.spriteH * P);
  ctx.globalAlpha = o.signAlpha ?? 1;
  drawSignName(ctx, o.name, left, top, P);
  ctx.globalAlpha = 1;
}
