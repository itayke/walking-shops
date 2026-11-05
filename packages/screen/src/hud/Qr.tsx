import { encode } from 'uqr';

// Light modules around the code, so a scanner finds its edge against the card, with corners rounded inside that margin
const QR_QUIET = 2;
const QR_CORNER = 1;

export type QrCode = ReturnType<typeof encode>;

/** Modules across the code, quiet margin included: CSS sizes the code, and the lobby's side columns, from it. */
export const qrSpan = (qr: QrCode) => qr.size + 2 * QR_QUIET;

/** A link as square modules, one SVG path, drawn hard-edged in whole pixels per module. */
export function Qr({ text, qr }: { text: string; qr: QrCode }) {
  const { data } = qr;
  const span = qrSpan(qr);
  let d = '';
  data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x + QR_QUIET} ${y + QR_QUIET}h1v1h-1z`)));
  return (
    <svg
      className="qr"
      viewBox={`0 0 ${span} ${span}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={text}
    >
      <rect width={span} height={span} rx={QR_CORNER} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}
