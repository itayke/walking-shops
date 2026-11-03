import { useEffect, useRef } from 'react';

// Smooth text at least this opaque (of 255) becomes solid, the rest clear
const INK_ALPHA = 128;
const RGBA = 4;
const ALPHA = 3;
const OPAQUE = 255;

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
 * alignment and color from its CSS, wraps to its parent's width, and is trimmed to its ink, so its margins are the
 * visible gaps. Redraws when the font loads or the parent resizes.
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
      const size = parseFloat(css.fontSize) * ratio;
      // Resizing the canvas resets its state, so the font is set again after
      const setFont = () => {
        ctx.font = `${css.fontWeight} ${size}px ${css.fontFamily}`;
        ctx.letterSpacing = `${(parseFloat(css.letterSpacing) || 0) * ratio}px`;
        ctx.textBaseline = 'alphabetic';
      };
      setFont();
      const lines = wrap(ctx, text, parent.clientWidth * ratio);
      if (!lines.length) return;
      const metrics = lines.map((ln) => ctx.measureText(ln));
      const lineH = (parseFloat(css.lineHeight) || parseFloat(css.fontSize)) * ratio;
      const top = Math.ceil(metrics[0].actualBoundingBoxAscent);
      const w = Math.max(1, Math.ceil(Math.max(...metrics.map((m) => m.width))));
      const h = Math.max(1, top + Math.round((lines.length - 1) * lineH) + Math.ceil(metrics[metrics.length - 1].actualBoundingBoxDescent));
      cv.width = w;
      cv.height = h;
      cv.style.width = `${w / ratio}px`;
      cv.style.height = `${h / ratio}px`;
      setFont();
      const centered = css.textAlign === 'center';
      lines.forEach((ln, i) => ctx.fillText(ln, centered ? Math.round((w - metrics[i].width) / 2) : 0, top + Math.round(i * lineH)));
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = ALPHA; i < d.length; i += RGBA) d[i] = d[i] >= INK_ALPHA ? OPAQUE : 0;
      ctx.putImageData(img, 0, 0);
      // Then colored in solid, over the pixels that stayed
      ctx.globalCompositeOperation = 'source-in';
      ctx.fillStyle = css.color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';
    };
    draw();
    document.fonts.ready.then(draw);
    const observer = new ResizeObserver(draw);
    observer.observe(parent);
    return () => observer.disconnect();
  }, [text]);
  return <canvas ref={ref} className={className} role="img" aria-label={text} />;
}
