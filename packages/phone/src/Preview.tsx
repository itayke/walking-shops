import { shopHue, shopTint } from '@walking-shops/render/colors.ts';
import { SHOP, shopSprite } from '@walking-shops/render/shopArt.ts';
import { drawSignName } from '@walking-shops/render/signs.ts';
import type { Look } from '@walking-shops/sim';
import { useEffect, useRef } from 'react';

const MS_PER_SECOND = 1000;
// Turning to another shop type: the shop spins like a box on a turntable, the next type on the face coming round
const TURN_S = 0.35;
// How dark a face gets as it turns side-on
const SIDE_SHADE = 0.45;
// A placeholder name on the sign, faded like the field's own placeholder
const PLACEHOLDER_ALPHA = 0.45;
const QUARTER_TURN = Math.PI / 2;

const smooth = (p: number) => p * p * (3 - 2 * p);

interface Turn {
  from: number;
  dir: number;
  start: number;
}

/**
 * The shop as the big screen draws it: the same sprite and sign, at the largest whole scale that fits, animated. A new
 * shop type turns in from the side `dir` points to.
 */
export function Preview({ name, look, dir, placeholder }: { name: string; look: Look; dir: number; placeholder: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read by the frame loop, so typing doesn't restart it
  const now = useRef({ name, look, dir, placeholder });
  now.current = { name, look, dir, placeholder };

  useEffect(() => {
    const canvas = ref.current!;
    const faces = [document.createElement('canvas'), document.createElement('canvas')];
    let shown = now.current.look.design;
    let turn: Turn | null = null;
    let raf = 0;

    // One face of the box: a shop type with its sign, darkened by how far it has turned away
    const face = (cv: HTMLCanvasElement, design: number, P: number, t: number, shade: number) => {
      const { name, look, placeholder } = now.current;
      const ctx = cv.getContext('2d')!;
      if (cv.width !== SHOP.spriteW * P || cv.height !== SHOP.spriteH * P) {
        cv.width = SHOP.spriteW * P;
        cv.height = SHOP.spriteH * P;
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(shopSprite({ design, tint: shopTint(shopHue(look.hue)), shutter: 0, danger: false, t }), 0, 0, cv.width, cv.height);
      ctx.globalAlpha = placeholder ? PLACEHOLDER_ALPHA : 1;
      drawSignName(ctx, name, 0, 0, P);
      if (shade > 0) {
        ctx.globalAlpha = shade;
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillRect(0, 0, cv.width, cv.height);
      }
      return cv;
    };

    const frame = (ms: number) => {
      const { look, dir } = now.current;
      const t = ms / MS_PER_SECOND;
      if (look.design !== shown) {
        // A turn mid-way starts over from the type it was turning to
        turn = { from: shown, dir, start: t };
        shown = look.design;
      }
      const r = canvas.getBoundingClientRect();
      const P = Math.max(1, Math.floor(Math.min(r.width / SHOP.spriteW, r.height / SHOP.spriteH) * devicePixelRatio));
      const w = SHOP.spriteW * P;
      const h = SHOP.spriteH * P;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, w, h);

      const p = turn ? (t - turn.start) / TURN_S : 1;
      if (!turn || p >= 1) {
        turn = null;
        ctx.drawImage(face(faces[0], shown, P, t, 0), 0, 0);
      } else {
        // Seen from the front, a turning box is wider than one face, so it's drawn smaller to fit, standing on the ground
        const a = smooth(p) * QUARTER_TURN;
        const fit = 1 / (Math.cos(a) + Math.sin(a));
        const oldW = Math.round(w * Math.cos(a) * fit);
        const newW = Math.round(w * Math.sin(a) * fit);
        const fh = Math.round(h * fit);
        const left = Math.round((w - oldW - newW) / 2);
        const top = h - fh;
        const old = face(faces[0], turn.from, P, t, SIDE_SHADE * (1 - Math.cos(a)));
        const next = face(faces[1], shown, P, t, SIDE_SHADE * (1 - Math.sin(a)));
        // Turning forward, the old face goes off to the left and the next comes round from the right
        if (turn.dir > 0) {
          ctx.drawImage(old, left, top, oldW, fh);
          ctx.drawImage(next, left + oldW, top, newW, fh);
        } else {
          ctx.drawImage(next, left, top, newW, fh);
          ctx.drawImage(old, left + newW, top, oldW, fh);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="preview" aria-label={name} />;
}
