import { maxHeight, parachuteSky, type GameState } from '@walking-shops/sim';
import { STREET_LOOK } from './look.ts';

/** Street geometry in CSS pixels. Columns run left to right; floors count up from groundY (the sidewalk's top edge). */
export interface Layout {
  width: number;
  height: number;
  cellW: number;
  cellH: number;
  groundY: number;
  sidewalkH: number;
  streetH: number;
}

/** Floors of sky the view needs: a walking shop on the tallest tower, and the highest a parachuter can start. */
export function floorsNeeded(g: GameState): number {
  const { PARACHUTES, MOVEMENT } = g.config;
  const tallest = maxHeight(g) + MOVEMENT.walkLift;
  const sky = parachuteSky(g) + PARACHUTES.skyJitter;
  return Math.max(tallest, sky) + STREET_LOOK.skyHeadroom;
}

export function layoutStreet(width: number, height: number, columns: number, floors: number): Layout {
  const cellW = width / columns;
  const cellH = Math.min(cellW * STREET_LOOK.cellAspect, height / (floors + STREET_LOOK.streetDepth));
  const streetH = cellH * STREET_LOOK.streetDepth;
  return { width, height, cellW, cellH, streetH, sidewalkH: streetH * STREET_LOOK.sidewalkShare, groundY: height - streetH };
}

/** Pixel x of a column position's center (fractional columns while walking). */
export function colX(L: Layout, x: number): number {
  return (x + 0.5) * L.cellW;
}

/** Pixel y of a height in floors above the sidewalk. */
export function floorY(L: Layout, y: number): number {
  return L.groundY - y * L.cellH;
}
