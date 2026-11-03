import { maxHeight, parachuteSky, type GameState } from '@walking-shops/sim';
import { GRID, STREET_LOOK } from './look.ts';

/**
 * Street geometry. The street is drawn in art pixels (GRID per cell) and scaled up by P device pixels per art pixel.
 * Art x = 0 is the left edge of column 0 and art y = 0 the sidewalk's top edge, with floors going up (negative y).
 */
export interface Layout {
  // The canvas, in device pixels
  width: number;
  height: number;
  P: number;
  // Device pixel of art (0, 0)
  ox: number;
  groundY: number;
  // Art pixels: the columns' width, the street below the ground line and its sidewalk
  gridW: number;
  streetH: number;
  sidewalkH: number;
  // The canvas edges in art pixels
  left: number;
  right: number;
  top: number;
}

/** Floors of sky the view needs: a walking shop on the tallest tower, and the highest a parachuter can start. */
export function floorsNeeded(g: GameState): number {
  const { PARACHUTES, MOVEMENT } = g.config;
  const tallest = maxHeight(g) + MOVEMENT.walkLift;
  const sky = parachuteSky(g) + PARACHUTES.skyJitter;
  return Math.max(tallest, sky) + STREET_LOOK.skyHeadroom;
}

/** The largest scale that fits every column across and `floors` of sky over the street, centered across. */
export function layoutStreet(width: number, height: number, columns: number, floors: number): Layout {
  const { cellW, cellH } = GRID;
  const streetH = Math.round(STREET_LOOK.streetDepth * cellH);
  const gridW = columns * cellW;
  const P = Math.min(width / gridW, height / (floors * cellH + streetH));
  const ox = Math.round((width - gridW * P) / 2);
  const groundY = Math.round(height - streetH * P);
  return {
    width,
    height,
    P,
    ox,
    groundY,
    gridW,
    streetH,
    sidewalkH: Math.round(streetH * STREET_LOOK.sidewalkShare),
    left: -ox / P,
    right: (width - ox) / P,
    top: -groundY / P,
  };
}

/** Art x of a column position's center (fractional columns while walking). */
export function colX(x: number): number {
  return (x + 0.5) * GRID.cellW;
}

/** Art y of a height in floors above the sidewalk. */
export function floorY(y: number): number {
  return -y * GRID.cellH;
}

/** The device pixel of an art position, rounded. */
export function device(L: Layout, x: number, y: number): [number, number] {
  return [Math.round(L.ox + x * L.P), Math.round(L.groundY + y * L.P)];
}
