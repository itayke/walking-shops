import { useEffect, useRef } from 'react';

// Smooth text at least this opaque (of 255) becomes solid, the rest clear
const INK_ALPHA = 128;
const RGBA = 4;
const ALPHA = 3;
const OPAQUE = 255;

// Reads a CSS color as bytes, by painting one pixel
const swatch = new OffscreenCanvas(1, 1).getContext('2d', { willReadFrequently: true })!;

function rgba(color: string): Uint8ClampedArray {
  swatch.clearRect(0, 0, 1, 1);
  swatch.fillStyle = color;
  swatch.fillRect(0, 0, 1, 1);
  return swatch.getImageData(0, 0, 1, 1).data;
}

/** The mask grown by r pixels every way, square like a pixel outline: across each row, then down each column. */
function grow(mask: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const across = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) across[y * w + i] = 1;
    }
  }
  const out = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      if (!across[y * w + x]) continue;
      for (let j = Math.max(0, y - r); j <= Math.min(h - 1, y + r); j++) out[j * w + x] = 1;
    }
  }
  return out;
}

/** Words in lines no wider than `max`, a word longer than that on a line of its own. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Type drawn hard-edged, like the shop names: every pixel solid or clear. Takes its font, size, spacing, line height,
 * alignment, case and color from its CSS, plus an optional outline (--pixel-outline wide, in --pixel-outline-color).
 * Wraps to its parent's width and is trimmed to its ink and outline, so its margins are the visible gaps. Redraws when
 * the font loads or the parent resizes.
 */
export function PixelText({ text, className }: { text: string; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current!;
    const parent = cv.parentElement!;
    const ctx = cv.getContext('2d')!;
    const draw = () => {
      const css = getComputedStyle(cv);
      const ratio = devicePixelRatio || 1;
      const shown = css.textTransform === 'uppercase' ? text.toUpperCase() : text;
      const pad = Math.round((parseFloat(css.getPropertyValue('--pixel-outline')) || 0) * ratio);
      const size = parseFloat(css.fontSize) * ratio;
      // Resizing the canvas resets its state, so the font is set again after
      const setFont = () => {
        ctx.font = `${css.fontWeight} ${size}px ${css.fontFamily}`;
        ctx.letterSpacing = `${(parseFloat(css.letterSpacing) || 0) * ratio}px`;
        ctx.textBaseline = 'alphabetic';
      };
      setFont();
      const lines = wrap(ctx, shown, parent.clientWidth * ratio - 2 * pad);
      if (!lines.length) return;
      const metrics = lines.map((ln) => ctx.measureText(ln));
      const lineH = (parseFloat(css.lineHeight) || parseFloat(css.fontSize)) * ratio;
      const top = Math.ceil(metrics[0].actualBoundingBoxAscent);
      const textW = Math.ceil(Math.max(...metrics.map((m) => m.width)));
      const w = Math.max(1, textW + 2 * pad);
      const h = Math.max(1, top + Math.round((lines.length - 1) * lineH) + Math.ceil(metrics[metrics.length - 1].actualBoundingBoxDescent) + 2 * pad);
      cv.width = w;
      cv.height = h;
      cv.style.width = `${w / ratio}px`;
      cv.style.height = `${h / ratio}px`;
      setFont();
      const centered = css.textAlign === 'center';
      lines.forEach((ln, i) => ctx.fillText(ln, pad + (centered ? Math.round((textW - metrics[i].width) / 2) : 0), pad + top + Math.round(i * lineH)));
      // Every pixel the smooth text covers enough is ink, then the outline grows around the ink
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      const ink = new Uint8Array(w * h);
      for (let i = 0; i < ink.length; i++) ink[i] = d[i * RGBA + ALPHA] >= INK_ALPHA ? 1 : 0;
      const ring = pad > 0 ? grow(ink, w, h, pad) : ink;
      const fill = rgba(css.color);
      const edge = rgba(css.getPropertyValue('--pixel-outline-color') || css.color);
      for (let i = 0; i < ink.length; i++) {
        const c = ink[i] ? fill : ring[i] ? edge : null;
        for (let k = 0; k < ALPHA; k++) d[i * RGBA + k] = c ? c[k] : 0;
        d[i * RGBA + ALPHA] = c ? OPAQUE : 0;
      }
      ctx.putImageData(img, 0, 0);
    };
    draw();
    document.fonts.ready.then(draw);
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [text]);
  return <canvas ref={ref} className={className} role="img" aria-label={text} />;
}
