import { PALETTE, shopHue, shopTint } from '@walking-shops/render/colors.ts';
import { SHOP, shopSprite } from '@walking-shops/render/shopArt.ts';
import { drawSignName } from '@walking-shops/render/signs.ts';
import type { Look } from '@walking-shops/sim';
import { useEffect, useRef, type PointerEvent } from 'react';

const MS_PER_SECOND = 1000;
// The street's sky behind the shop, so it stands out from a page in its own color
const BACKDROP = PALETTE.sky[1];
// Dragged this far, as a share of its width, the shop lets go of the finger and slides out on its own
const SWIPE_COMMIT = 0.5;
// Seconds for a shop to slide out from the middle, for the next one to slide in, and to ease back when let go early
const OUT_S = 0.16;
const IN_S = 0.22;
const BACK_S = 0.15;
// A placeholder name on the sign, faded like the field's own placeholder
const PLACEHOLDER_ALPHA = 0.45;

const easeOut = (p: number) => 1 - (1 - p) ** 3;
const now = () => performance.now() / MS_PER_SECOND;

/** Where the shop on show is, in device pixels from the middle, and how it's moving. */
interface Motion {
  x: number;
  // A finger holding the shop: where it went down (CSS pixels) and where the shop was then
  drag: { from: number; x: number } | null;
  // out: the old shop leaves toward -dir, then in: the next one arrives from +dir; back: let go early, it returns
  slide: { kind: 'out' | 'in' | 'back'; dir: number; x: number; start: number } | null;
  // The way the last turn went, and the shop's width, for the swipe to measure against
  dir: number;
  shopW: number;
}

/**
 * The shop as the big screen draws it: the same sprite and sign, at the largest whole scale that fits, animated, on a
 * patch of sky. Dragging it sideways moves it with the finger; past halfway it slides out and the next type slides in
 * from the other side, as the arrows do at once.
 */
export function Preview({ name, look, placeholder, onTurn }: { name: string; look: Look; placeholder: boolean; onTurn: (by: number) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const slot = useRef<HTMLDivElement>(null);
  // Read by the frame loop, so typing doesn't restart it
  const props = useRef({ name, look, placeholder });
  props.current = { name, look, placeholder };
  const m = useRef<Motion>({ x: 0, drag: null, slide: null, dir: 1, shopW: 0 });

  const turn = (by: number) => {
    m.current.dir = by;
    m.current.drag = null;
    onTurn(by);
  };
  const down = (e: PointerEvent) => {
    const s = m.current;
    // The arrows are buttons of their own, and a shop already on its way can't be caught
    if ((e.target as Element).closest('button') || (s.slide && s.slide.kind !== 'back')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    s.slide = null;
    s.drag = { from: e.clientX, x: s.x };
  };
  const move = (e: PointerEvent) => {
    const s = m.current;
    if (!s.drag) return;
    s.x = s.drag.x + (e.clientX - s.drag.from) * devicePixelRatio;
    // Dragged left, it's the next type that comes in, from the right
    if (Math.abs(s.x) >= SWIPE_COMMIT * s.shopW) turn(s.x < 0 ? 1 : -1);
  };
  const up = () => {
    const s = m.current;
    if (!s.drag) return;
    s.drag = null;
    s.slide = { kind: 'back', dir: 0, x: s.x, start: now() };
  };

  useEffect(() => {
    const canvas = ref.current!;
    const s = m.current;
    // The type in the middle of the turn's way: drawn until the old shop is out
    let drawn = props.current.look.design;
    let shown = drawn;
    let raf = 0;

    const frame = (ms: number) => {
      const { name, look, placeholder } = props.current;
      const t = ms / MS_PER_SECOND;
      if (look.design !== shown) {
        // A turn mid-way sends out whichever shop is on show, from where it is
        s.slide = { kind: 'out', dir: s.dir, x: s.x, start: t };
        shown = look.design;
      }

      const r = canvas.getBoundingClientRect();
      const box = slot.current!.getBoundingClientRect();
      const cw = Math.round(r.width * devicePixelRatio);
      const ch = Math.round(r.height * devicePixelRatio);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      const P = Math.max(1, Math.floor(Math.min(box.width / SHOP.spriteW, box.height / SHOP.spriteH) * devicePixelRatio));
      const w = SHOP.spriteW * P;
      const h = SHOP.spriteH * P;
      s.shopW = w;
      const cx = (box.left - r.left + box.width / 2) * devicePixelRatio;
      const top = Math.round((box.top - r.top + box.height / 2) * devicePixelRatio - h / 2);
      // Far enough from the middle that no part of the shop shows
      const exit = Math.max(cx, cw - cx) + w / 2;

      const slide = s.slide;
      if (slide?.kind === 'out') {
        // The rest of the way out at the pace of a full slide, so a long drag doesn't make it crawl
        const to = -slide.dir * exit;
        const p = (t - slide.start) / (OUT_S * Math.max(Math.abs(to - slide.x) / exit, Number.EPSILON));
        s.x = slide.x + (to - slide.x) * Math.min(p, 1);
        if (p >= 1) {
          drawn = shown;
          s.slide = { kind: 'in', dir: slide.dir, x: slide.dir * exit, start: t };
          s.x = slide.dir * exit;
        }
      } else if (slide) {
        const p = Math.min((t - slide.start) / (slide.kind === 'in' ? IN_S : BACK_S), 1);
        s.x = slide.x * (1 - easeOut(p));
        if (p >= 1) s.slide = null;
      }

      const ctx = canvas.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, cw, ch);
      const left = Math.round(cx - w / 2 + s.x);
      ctx.drawImage(shopSprite({ design: drawn, tint: shopTint(shopHue(look.hue)), shutter: 0, danger: false, t }), left, top, w, h);
      ctx.globalAlpha = placeholder ? PLACEHOLDER_ALPHA : 1;
      drawSignName(ctx, name, left, top, P);
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="stand" style={{ background: BACKDROP }} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <canvas ref={ref} className="preview" aria-label={name} />
      <button type="button" className="turn" onClick={() => turn(-1)} aria-label="Previous shop type">
        ◀
      </button>
      <div ref={slot} className="slot" />
      <button type="button" className="turn" onClick={() => turn(1)} aria-label="Next shop type">
        ▶
      </button>
    </div>
  );
}
