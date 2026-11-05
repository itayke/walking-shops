import { describe, expect, it, vi } from 'vitest';
import { PALETTE, shopHue, shopTint } from '../src/colors.ts';
import { DESIGN_COUNT, SHOP, shopSprite, shutterRows, type ShopLook } from '../src/shopArt.ts';

/** A canvas stand-in that records each filled rect, so sprites can be compared without a real canvas. */
class RecordingCanvas {
  width: number;
  height: number;
  readonly rects: string[] = [];
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
  }
  getContext() {
    const rects = this.rects;
    return {
      fillStyle: '',
      imageSmoothingEnabled: false,
      setTransform() {},
      clearRect() {},
      fillRect(x: number, y: number, w: number, h: number) {
        rects.push(`${this.fillStyle} ${x},${y},${w},${h}`);
      },
    };
  }
}
vi.stubGlobal('OffscreenCanvas', RecordingCanvas);

/** A recorded rect's x, y, w, h (its color can hold spaces). */
function box(r: string): number[] {
  return r.slice(r.lastIndexOf(' ') + 1).split(',').map(Number);
}

function drawn(o: ShopLook): string[] {
  return (shopSprite(o) as unknown as RecordingCanvas).rects;
}

/** A short fingerprint of a draw list, so a snapshot shows which sprite changed without listing every rect. */
function fingerprint(rects: readonly string[]): string {
  let h = 0x811c9dc5;
  for (const ch of rects.join('|')) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
  return `${rects.length}:${(h >>> 0).toString(16)}`;
}

// Times that land on every animation frame of the pole, steam, record glint and marquee chase
const TIMES = [0, 0.17, 0.34, 0.51, 0.68, 0.85];
const DESIGNS = [...Array(DESIGN_COUNT).keys()];

describe('shop art', () => {
  const tint = shopTint(shopHue(3));
  const states = { open: 0, half: Math.round(shutterRows() / 2), shut: shutterRows() };

  it('draws every design exactly as before', () => {
    const prints: Record<string, string> = {};
    for (const design of DESIGNS) {
      for (const [state, shutter] of Object.entries(states)) prints[`${design + 1} ${state}`] = fingerprint(drawn({ design, tint, shutter, danger: false, t: 0 }));
      prints[`${design + 1} danger`] = fingerprint(drawn({ design, tint, shutter: 0, danger: true, t: 0 }));
    }
    expect(prints).toMatchSnapshot();
  });

  it('keeps every design inside its sprite, on every animation frame', () => {
    for (const design of DESIGNS) {
      for (const t of TIMES) {
        for (const r of drawn({ design, tint, shutter: 0, danger: false, t })) {
          const [x, y, w, h] = box(r);
          expect(x >= 0 && y >= 0 && x + w <= SHOP.spriteW && y + h <= SHOP.spriteH, `design ${design + 1}: ${r}`).toBe(true);
        }
      }
    }
  });

  it('draws every design at a time just below zero', () => {
    const justBefore = -0.01;
    for (const design of DESIGNS) expect(() => drawn({ design, tint, shutter: 0, danger: false, t: justBefore }), `design ${design + 1}`).not.toThrow();
  });

  it('pulls the shutters over the whole front of every design', () => {
    const top = SHOP.roof + SHOP.lowTop;
    for (const design of DESIGNS) {
      const rects = drawn({ design, tint, shutter: shutterRows(), danger: false, t: 0 });
      // The shutter goes on after the front and before the edges and the awning, so nothing of the front shows over it
      const shutter = rects.findIndex((r) => r.endsWith(` 2,${top},${SHOP.W - 2},${shutterRows()}`));
      expect(shutter, `design ${design + 1}`).toBeGreaterThan(0);
      const after = rects.slice(shutter + 1).filter((r) => {
        const [, y, , h] = box(r);
        return y + h > top + 1 && y < top + shutterRows() - 1;
      });
      const allowed = [PALETTE.shutter, PALETTE.shutterLo, PALETTE.ink];
      expect(after.every((r) => allowed.some((c) => r.startsWith(`${c} `))), `design ${design + 1}`).toBe(true);
    }
  });
});
