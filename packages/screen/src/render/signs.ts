import { PALETTE } from './colors.ts';
import { FX_LOOK, SHOP_LOOK } from './look.ts';
import { SHOP } from './shopArt.ts';

// Shop names are drawn at full resolution over the sprite, in the display font, as large as their sign allows

// Names are measured at this size, then scaled to fit
const MEASURE_PX = 100;

/** A name set on its sign: its lines, the font size in art pixels, and a capital's height per font pixel. */
interface SignSet {
  lines: string[];
  size: number;
  cap: number;
}

const sets = new Map<string, SignSet>();

function font(px: number): string {
  return `${px}px ${FX_LOOK.displayFont}`;
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
function setName(ctx: CanvasRenderingContext2D, label: string): SignSet {
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
    if (!best || size > best.size) best = { lines, size, cap };
  }
  if (best!.size * cap < L.signMinCap) {
    const size = L.signMinCap / cap;
    best = { lines: fitLines(label, (s) => em(s) * size <= w, L.signLines), size, cap };
  }
  ctx.restore();
  return best!;
}

/** A shop's name on its sign, for a sprite drawn at device (x, y) with P device pixels per art pixel. */
export function drawSignName(ctx: CanvasRenderingContext2D, label: string, x: number, y: number, P: number): void {
  if (!label.trim()) return;
  let set = sets.get(label);
  if (!set) {
    set = setName(ctx, label);
    // Measured in a fallback font until the display font loads, so only kept once it has
    if (document.fonts.check(font(MEASURE_PX))) sets.set(label, set);
  }
  const { name } = SHOP;
  const px = set.size * P;
  const cap = set.cap * px;
  const gap = cap * SHOP_LOOK.signLineGap;
  const tall = set.lines.length * cap + (set.lines.length - 1) * gap;
  let base = y + (name.y + name.h / 2) * P - tall / 2 + cap;
  ctx.save();
  ctx.font = font(px);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = PALETTE.ink;
  for (const ln of set.lines) {
    ctx.fillText(ln, x + (name.x + name.w / 2) * P, base);
    base += cap + gap;
  }
  ctx.restore();
}
