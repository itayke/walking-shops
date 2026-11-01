import { FX_LOOK, SHOP_LOOK } from './look.ts';

// The street's daylight palette. The canvas doesn't follow the page theme: the street is always daytime
export const PALETTE = {
  sky: ['#7cc6ea', '#97d2ee', '#b8e1f3', '#d9eff7'],
  cloud: '#ffffff',
  cloudLo: '#cbe6f1',
  skyline: '#b2d4e0',
  skylineWin: '#9fc7d6',
  curbTop: '#ece2cf',
  walk: '#cdbd9f',
  walkLine: '#b2a183',
  curb: '#857563',
  curbLo: '#5f5246',
  asphalt: '#3c414f',
  asphaltHi: '#4a5062',
  zebra: '#eeeae0',
  ink: '#1c1a26',
  glass: '#8ccfe5',
  glassHi: '#e6f7fc',
  glassLo: '#5b98b0',
  cream: '#f5ebd5',
  creamLo: '#d6c6a2',
  wood: '#94603f',
  woodLo: '#623e29',
  shutter: '#a0a6b1',
  shutterLo: '#6e7480',
  leaf: '#52a65e',
  leafLo: '#2f6b3a',
  red: '#e04a3d',
  yellow: '#f5c746',
  white: '#ffffff',
  blue: '#4a86d8',
  pink: '#ee7fb0',
  accent: '#ffd23f',
  danger: '#e8483a',
  ok: '#52a65e',
  grey: '#9a9ca6',
  greyLo: '#6f717b',
  line: '#f4f4f4',
};

export type PaletteColor = Exclude<keyof typeof PALETTE, 'sky'>;

// A player tint is a three-shade ramp: saturation and lightness of the light, base and dark shades
const TINT_SAT = [72, 62, 55];
const TINT_LIGHT = [70, 54, 38];

export interface Tint {
  hi: string;
  base: string;
  lo: string;
}

/** A shop's hue from its place in the shop list, snapped to a step. Placeholder until players pick a tint (Milestone 4). */
export function shopHue(index: number): number {
  const { hueSpread, hueOffset, hueSnap } = SHOP_LOOK;
  return (Math.round(((index * hueSpread + hueOffset) % 360) / hueSnap) * hueSnap) % 360;
}

/** The three shades of a hue. `base` is the shop's color everywhere else too: its phone, the scoreboard. */
export function shopTint(hue: number): Tint {
  const [hi, base, lo] = TINT_SAT.map((s, i) => `hsl(${hue} ${s}% ${TINT_LIGHT[i]}%)`);
  return { hi, base, lo };
}

// People: hair, skin, shirt and trousers, picked per person
const HAIR = ['#2b1d16', '#6b3f22', '#d9a441', '#1c1a26', '#8a8f99', '#a8432c'];
export const SKIN = ['#f2c9a0', '#d9a07a', '#a86f4c', '#6e4630'];
const SHIRT = ['#e04a3d', '#4a86d8', '#52a65e', '#c39a1c', '#c64f88', '#8b6fd6', '#ffa24d'];
const PANTS = ['#2f3a56', '#4b3a2f', '#3c414f', '#5a4a6b'];
// A shirt closer than this to a skin tone (RGB distance) is never paired with it, so a face reads against its shirt
export const SHIRT_SKIN_MIN = 100;

/** A '#rrggbb' color's channels. */
function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

function toHex(c: readonly number[]): string {
  return '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

export function colorDistance(a: string, b: string): number {
  const x = rgb(a);
  const y = rgb(b);
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

/** A share t of the way from color a to color b. */
export function mixColor(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
}

// Perceived brightness weights of red, green and blue (Rec. 601)
const LUMA = [0.299, 0.587, 0.114];

/** The gray of the same brightness. */
export function grayOf(hex: string): string {
  const y = rgb(hex).reduce((sum, v, i) => sum + v * LUMA[i], 0);
  return toHex([y, y, y]);
}

export interface Washed {
  fill: string;
  outline: string;
}

const washCache = new Map<string, Washed>();

/**
 * Text and marks fade out through palette keyframes instead of alpha, the 8-bit way: the fill washes toward white and
 * loses its color while the ink outline lightens. Step 0 is full strength; steps run up to the last wash keyframe.
 */
export function washOut(fill: string, step: number): Washed {
  if (step <= 0) return { fill, outline: PALETTE.ink };
  const key = `${fill}|${step}`;
  let w = washCache.get(key);
  if (!w) {
    const k = FX_LOOK.wash[Math.min(step, FX_LOOK.wash.length) - 1];
    w = { fill: mixColor(mixColor(fill, grayOf(fill), k.gray), PALETTE.white, k.light), outline: PALETTE[k.outline] };
    washCache.set(key, w);
  }
  return w;
}

export const SHIRTS_FOR_SKIN = SKIN.map((s) => SHIRT.filter((c) => colorDistance(c, s) >= SHIRT_SKIN_MIN));

/** Colors for a person's pixel map, keyed by map letter: hair, skin, eyes, clothes, pants, feet. */
export type PersonColors = Record<'h' | 's' | 'e' | 'c' | 'p' | 'f', string>;

/** An integer hash that scatters consecutive ids. */
export function hash(n: number): number {
  n = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  n ^= n >>> 13;
  n = Math.imul(n, 0xc2b2ae35);
  n ^= n >>> 16;
  return n >>> 0;
}

// Each hashed field takes its own bits, so hair, skin, shirt and pants don't move together
const HAIR_BITS = 0;
const SKIN_BITS = 4;
const SHIRT_BITS = 8;
const PANTS_BITS = 12;

/** A steady look for one person, from its id. */
export function personColors(id: number): PersonColors {
  const h = hash(id);
  const si = (h >>> SKIN_BITS) % SKIN.length;
  const shirts = SHIRTS_FOR_SKIN[si];
  return {
    h: HAIR[(h >>> HAIR_BITS) % HAIR.length],
    s: SKIN[si],
    e: PALETTE.ink,
    c: shirts[(h >>> SHIRT_BITS) % shirts.length],
    p: PANTS[(h >>> PANTS_BITS) % PANTS.length],
    f: PALETTE.ink,
  };
}

// Underwear: a print, in a tacky base and print color pair
export const UNDIES_PRINTS = ['dots', 'stripes'] as const;
export const UNDIES_COLORS = [
  ['#ffffff', '#e04a3d'],
  ['#ff6ec7', '#b6ff3b'],
  ['#ffe14d', '#8b3fd6'],
  ['#3fe0ff', '#ff8a1f'],
  ['#b6ff3b', '#ff3fa4'],
  ['#ff8a1f', '#2f6bff'],
];
// The usual multiplier for folding a string into an integer
const STRING_MULT = 31;
const PRINT_BITS = 8;

export interface Undies {
  print: (typeof UNDIES_PRINTS)[number];
  base: string;
  ink: string;
}

/** A shop's underwear, from its name: the same name always wears the same pair. */
export function undiesFor(name: string): Undies {
  let n = 0;
  for (const ch of name) n = (Math.imul(n, STRING_MULT) + ch.charCodeAt(0)) | 0;
  const h = hash(n);
  const [base, ink] = UNDIES_COLORS[h % UNDIES_COLORS.length];
  return { print: UNDIES_PRINTS[(h >>> PRINT_BITS) % UNDIES_PRINTS.length], base, ink };
}

/** A shopper who gave up: all grey. */
export const GREY_PERSON: PersonColors = { h: PALETTE.greyLo, s: PALETTE.grey, e: PALETTE.greyLo, c: PALETTE.grey, p: PALETTE.greyLo, f: PALETTE.greyLo };
