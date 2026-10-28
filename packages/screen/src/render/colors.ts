import { SHOP_LOOK } from './look.ts';
import type { Theme } from './theme.ts';

/** A shop's hue from its place in the shop list. Placeholder until players pick a design and tint (Milestone 4). */
export function shopHue(index: number): number {
  return (index * SHOP_LOOK.hueStep + SHOP_LOOK.hueOffset) % 360;
}

/** The shop's tint, optionally darkened by some lightness points. */
export function shopFill(theme: Theme, hue: number, darken = 0): string {
  return `hsl(${hue} ${theme['shop-sat']} ${parseFloat(theme['shop-light']) - darken}%)`;
}

/** The same tint for DOM elements, straight from the CSS tokens. */
export function shopFillCss(hue: number): string {
  return `hsl(${hue} var(--shop-sat) var(--shop-light))`;
}
