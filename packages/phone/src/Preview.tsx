import { shopHue, shopTint } from '@walking-shops/render/colors.ts';
import { SHOP, shopSprite } from '@walking-shops/render/shopArt.ts';
import { drawSignName } from '@walking-shops/render/signs.ts';
import type { Look } from '@walking-shops/sim';
import { useEffect, useRef } from 'react';

const MS_PER_SECOND = 1000;

/** The shop as the big screen draws it: the same sprite and sign, at the largest whole scale that fits, animated. */
export function Preview({ name, look }: { name: string; look: Look }) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read by the frame loop, so typing doesn't restart it
  const now = useRef({ name, look });
  now.current = { name, look };

  useEffect(() => {
    const canvas = ref.current!;
    let raf = 0;
    const frame = (ms: number) => {
      const { name, look } = now.current;
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
      const sprite = shopSprite({ design: look.design, tint: shopTint(shopHue(look.hue)), shutter: 0, danger: false, t: ms / MS_PER_SECOND });
      ctx.drawImage(sprite, 0, 0, w, h);
      drawSignName(ctx, name, 0, 0, P);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className="preview" aria-label={name} />;
}
