import { SHOP } from '@walking-shops/render/shopArt.ts';
import type { Look } from '@walking-shops/sim';
import { useEffect, useRef } from 'react';
import { drawShop, fitScale } from './shop.ts';

const MS_PER_SECOND = 1000;
// The most of the card's width and of the phone's height the shop may take; the canvas is then cut to the shop's
// height, and the sky around it is the CSS's
const MAX_W = 0.8;
const MAX_H = 0.18;

/** The player's own shop at the top of the controller, as the street shows it, shutters and all. */
export function Badge({ name, look, closed }: { name: string; look: Look; closed: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read by the frame loop, so a new state doesn't restart it
  const props = useRef({ name, look, closed });
  props.current = { name, look, closed };

  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0;
    const frame = (ms: number) => {
      const r = canvas.getBoundingClientRect();
      const P = fitScale(r.width * MAX_W, innerHeight * MAX_H);
      const cw = Math.round(r.width * devicePixelRatio);
      const ch = SHOP.spriteH * P;
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        canvas.style.height = `${ch / devicePixelRatio}px`;
      }
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, cw, ch);
      drawShop(ctx, { ...props.current, t: ms / MS_PER_SECOND }, Math.round((cw - SHOP.spriteW * P) / 2), 0, P);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="badge" aria-label={name} />;
}
