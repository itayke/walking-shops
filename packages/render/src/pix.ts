export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

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
