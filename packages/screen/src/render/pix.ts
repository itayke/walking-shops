export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

// 3×5 glyphs, row by row. A glyph advances 4 font pixels (one gap), a line 6
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111',
  F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010',
  K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010',
  Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010', 8: '111101111101111',
  9: '111101111001110', ' ': '000000000000000', '&': '010101010101011', "'": '010010000000000', '.': '000000000000010',
  '-': '000000111000000', '!': '010010010000010', '+': '000010111010000', '?': '110001010000010',
};
const GLYPH_W = 3;
export const GLYPH_H = 5;
export const ADVANCE = GLYPH_W + 1;
export const LINE = GLYPH_H + 1;
const UNKNOWN = '?';
// Outline offsets: a font pixel's four neighbors
const AROUND = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** Width of a line of text in font pixels. */
export function textWidth(str: string): number {
  return str.length * ADVANCE - 1;
}

/** Greedy word wrap into at most `maxLines` lines of `cols` glyphs. A cut-off last line ends in a dot. */
export function fitLines(str: string, cols: number, maxLines: number): string[] {
  if (cols < 1 || maxLines < 1) return [];
  const words = str
    .toUpperCase()
    .split(/\s+/)
    .map((w) => [...w].filter((c) => FONT[c]).join(''))
    .filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (let w of words) {
    while (w.length > cols) {
      if (cur) lines.push(cur);
      cur = '';
      lines.push(w.slice(0, cols));
      w = w.slice(cols);
    }
    if (!w) continue;
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= cols) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = (last.length < cols ? last : last.slice(0, cols - 1)) + '.';
  return kept;
}

/**
 * Draws in art pixels: P device pixels per art pixel, with art (0, 0) at device (ox, oy). Every edge rounds to a
 * device pixel, so neighboring rects tile without seams at any scale, and half pixels exist when P >= 2.
 */
export class Pix {
  readonly c: Ctx2D;
  readonly P: number;
  readonly ox: number;
  readonly oy: number;
  // Mirrored left to right about the middle of the art pixel at x = 0
  readonly flip: boolean;

  constructor(c: Ctx2D, P: number, ox = 0, oy = 0, flip = false) {
    this.c = c;
    this.P = P;
    this.ox = ox;
    this.oy = oy;
    this.flip = flip;
  }

  /** The same pen drawing mirrored, so a shape centered on x = 0 faces the other way pixel for pixel. */
  mirrored(): Pix {
    return new Pix(this.c, this.P, this.ox, this.oy, !this.flip);
  }

  r(x: number, y: number, w: number, h: number, col: string): void {
    if (w <= 0 || h <= 0) return;
    if (this.flip) x = 1 - x - w;
    const { P, ox, oy } = this;
    const X = Math.round(ox + x * P);
    const Y = Math.round(oy + y * P);
    this.c.fillStyle = col;
    this.c.fillRect(X, Y, Math.round(ox + (x + w) * P) - X, Math.round(oy + (y + h) * P) - Y);
  }

  /** A line of square t×t dots, so thick lines keep their width at any angle. */
  line(x0: number, y0: number, x1: number, y1: number, col: string, t = 1): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    const o = Math.ceil((t - 1) / 2);
    let err = dx + dy;
    for (;;) {
      this.r(x0 - o, y0 - o, t, t, col);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Text from its top-left corner; each font pixel is s art pixels. */
  text(str: string, x: number, y: number, s: number, col: string): void {
    let cx = x;
    for (const ch of str) {
      const g = FONT[ch] ?? FONT[UNKNOWN];
      for (let i = 0; i < g.length; i++) {
        if (g[i] === '1') this.r(cx + (i % GLYPH_W) * s, y + Math.floor(i / GLYPH_W) * s, s, s, col);
      }
      cx += ADVANCE * s;
    }
  }

  /** Text centered on x with its top at y, outlined so it reads over shops and sky alike. */
  label(str: string, x: number, y: number, s: number, col: string, outline: string): void {
    const left = Math.round(x - (textWidth(str) * s) / 2);
    for (const [dx, dy] of AROUND) this.text(str, left + dx * s, y + dy * s, s, outline);
    this.text(str, left, y, s, col);
  }

  /** A hand-drawn pixel map: one letter per pixel, '.' is clear. An outline color rings the drawn pixels. */
  map(rows: readonly string[], x: number, y: number, colors: Readonly<Record<string, string>>, outline: string | null): void {
    if (outline) {
      for (let j = 0; j < rows.length; j++) {
        for (let i = 0; i < rows[j].length; i++) {
          if (rows[j][i] === '.') continue;
          this.r(x + i - 1, y + j, 3, 1, outline);
          this.r(x + i, y + j - 1, 1, 3, outline);
        }
      }
    }
    for (let j = 0; j < rows.length; j++) {
      for (let i = 0; i < rows[j].length; i++) {
        const ch = rows[j][i];
        if (ch !== '.') this.r(x + i, y + j, 1, 1, colors[ch]);
      }
    }
  }
}

const UINT_RANGE = 2 ** 32;

/** A small seeded generator for fixed scenery (skyline, specks). Never used for anything the sim decides. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / UINT_RANGE;
  };
}

/** An offscreen canvas of w×h device pixels for offscreen drawing, cleared, with smoothing off. */
export function scratch(cv: OffscreenCanvas | null, w: number, h: number): { cv: OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D } {
  const out = cv ?? new OffscreenCanvas(w, h);
  if (out.width !== w || out.height !== h) {
    out.width = w;
    out.height = h;
  }
  const ctx = out.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  return { cv: out, ctx };
}
