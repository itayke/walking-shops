import { PALETTE } from './colors.ts';
import { FX_LOOK, SHOP_LOOK } from './look.ts';
import { scratch } from './pix.ts';
import { SHOP } from './shopArt.ts';

// Shop names are drawn at full resolution over the sprite, in the display font, as large as their sign allows.
// Like everything else on the street they are hard-edged: each name is set once into a bitmap whose every pixel is
// solid ink or clear, then stamped over the sprite one bitmap pixel per device pixel

// Names are measured at this size, then scaled to fit
const MEASURE_PX = 100;

/** A name set on its sign: its lines, the font size in art pixels, a capital's height per font pixel, and whether it was cut short. */
interface SignSet {
  lines: string[];
  size: number;
  cap: number;
  cut: boolean;
}

type Measurer = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const sets = new Map<string, SignSet>();

// A name's bitmap is redrawn as the scale changes in steps this fine, so a zoom doesn't redraw every name every frame
const SCALE_STEPS = 8;
// Smooth text at least this opaque (of 255) becomes ink, the rest clear
const INK_ALPHA = 128;
// Room around the name area, in art pixels, for glyphs that reach past it
const BITMAP_PAD = 1;
const RGBA = 4;
const ALPHA = 3;
const OPAQUE = 255;

interface SignBitmap {
  scale: number;
  cv: OffscreenCanvas;
}

const bitmaps = new Map<string, SignBitmap>();

function font(px: number): string {
  return `${px}px ${FX_LOOK.displayFont}`;
}

/**
 * A font size in device pixels, at whole device pixels per font pixel (at least one) so it stays crisp: rounded down by
 * default, so text that fits still fits. `grid` is the font's pixels per em, the display font's unless given.
 */
export function crispPx(px: number, snap: (n: number) => number = Math.floor, grid: number = FX_LOOK.displayGrid): number {
  return Math.max(1, snap(px / grid)) * grid;
}

/**
 * Greedy word wrap into at most `maxLines` lines that each pass `fits`, breaking a word too long for a line. A name
 * that runs out of lines ends in a dot.
 */
export function fitLines(str: string, fits: (line: string) => boolean, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (let w of words(str)) {
    while (!fits(w)) {
      if (cur) lines.push(cur);
      cur = '';
      // At least one letter a line, so a sign too narrow for any still ends
      let k = Math.max(1, w.length - 1);
      while (k > 1 && !fits(w.slice(0, k))) k--;
      lines.push(w.slice(0, k));
      w = w.slice(k);
      if (!w) break;
    }
    if (!w) continue;
    if (!cur) cur = w;
    else if (fits(`${cur} ${w}`)) cur += ` ${w}`;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  let last = kept[maxLines - 1];
  while (last.length > 1 && !fits(`${last}.`)) last = last.slice(0, -1);
  kept[maxLines - 1] = `${last.trimEnd()}.`;
  return kept;
}

function words(str: string): string[] {
  return str.toUpperCase().split(/\s+/).filter(Boolean);
}

/** Every way to set the words on up to `lines` lines, breaking only between words. */
function groupings(words: string[], lines: number): string[][] {
  const out = [[words.join(' ')]];
  if (lines <= 1) return out;
  for (let k = 1; k < words.length; k++) {
    for (const rest of groupings(words.slice(k), lines - 1)) out.push([words.slice(0, k).join(' '), ...rest]);
  }
  return out;
}

/**
 * The grouping that sets the name largest within the sign's name area (fewer lines win a tie). A name that would
 * come out smaller than the smallest readable size is set at that size instead, wrapped and cut to fit.
 */
function setName(ctx: Measurer, label: string): SignSet {
  const L = SHOP_LOOK;
  const { w, h } = SHOP.name;
  ctx.save();
  ctx.font = font(MEASURE_PX);
  const em = (s: string) => ctx.measureText(s).width / MEASURE_PX;
  const cap = ctx.measureText('H').actualBoundingBoxAscent / MEASURE_PX;
  let best: SignSet | null = null;
  for (const lines of groupings(words(label), L.signLines)) {
    const widest = Math.max(...lines.map(em));
    const tall = cap * (lines.length + (lines.length - 1) * L.signLineGap);
    const size = Math.min(w / widest, h / tall);
    if (!best || size > best.size) best = { lines, size, cap, cut: false };
  }
  if (best!.size * cap < L.signMinCap) {
    const size = L.signMinCap / cap;
    const fits = (s: string) => em(s) * size <= w;
    best = { lines: fitLines(label, fits, L.signLines), size, cap, cut: fitLines(label, fits, Infinity).length > L.signLines };
  }
  ctx.restore();
  return best!;
}

/** A name set into a hard-edged bitmap at `scale` device pixels per art pixel, centered in the name area. */
function nameBitmap(set: SignSet, scale: number): OffscreenCanvas {
  const { name } = SHOP;
  const w = Math.ceil((name.w + 2 * BITMAP_PAD) * scale);
  const h = Math.ceil((name.h + 2 * BITMAP_PAD) * scale);
  const { cv, ctx } = scratch(null, w, h);
  const px = crispPx(set.size * scale);
  const cap = set.cap * px;
  const gap = cap * SHOP_LOOK.signLineGap;
  const tall = set.lines.length * cap + (set.lines.length - 1) * gap;
  let base = h / 2 - tall / 2 + cap;
  ctx.font = font(px);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.ink;
  // Each line starts on a whole device pixel, so its font pixels land on device pixels
  for (const ln of set.lines) {
    ctx.fillText(ln, Math.round((w - ctx.measureText(ln).width) / 2), Math.round(base));
    base += cap + gap;
  }
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = ALPHA; i < d.length; i += RGBA) d[i] = d[i] >= INK_ALPHA ? OPAQUE : 0;
  ctx.putImageData(img, 0, 0);
  return cv;
}

let measurer: Measurer | null = null;

/** Whether a name fits its sign whole: set no smaller than the smallest readable size, or wrapped without being cut. */
export function nameFits(label: string): boolean {
  measurer ??= scratch(null, 1, 1).ctx;
  return !setName(measurer, label).cut;
}

/** A shop's name on its sign, for a sprite drawn at device (x, y) with P device pixels per art pixel. */
export function drawSignName(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, P: number): void {
  if (!label.trim()) return;
  const scale = Math.round(P * SCALE_STEPS) / SCALE_STEPS;
  let bm = bitmaps.get(label);
  if (!bm || bm.scale !== scale) {
    let set = sets.get(label);
    // Measured in a fallback font until the display font loads, so only kept once it has
    const loaded = document.fonts.check(font(MEASURE_PX));
    if (!set) {
      set = setName(ctx, label);
      if (loaded) sets.set(label, set);
    }
    bm = { scale, cv: nameBitmap(set, scale) };
    if (loaded) bitmaps.set(label, bm);
  }
  const { name } = SHOP;
  const cx = x + (name.x + name.w / 2) * P;
  const cy = y + (name.y + name.h / 2) * P;
  ctx.drawImage(bm.cv, Math.round(cx - bm.cv.width / 2), Math.round(cy - bm.cv.height / 2));
}
