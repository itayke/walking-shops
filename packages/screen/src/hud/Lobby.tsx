import type { CSSProperties } from 'react';
import { COPY } from '@walking-shops/render/copy.ts';
import { encode } from 'uqr';
import { joinUrl } from '../net/room.ts';
import { PixelText } from './PixelText.tsx';

// Light modules around the code, so a scanner finds its edge against the card, with corners rounded inside that margin
const QR_QUIET = 2;
const QR_CORNER = 1;

type QrCode = ReturnType<typeof encode>;

/** Modules across the code, quiet margin included: CSS sizes the code, and the lobby's side columns, from it. */
const qrSpan = (qr: QrCode) => qr.size + 2 * QR_QUIET;

/** The join link as square modules, one SVG path, drawn hard-edged in whole pixels per module. */
function Qr({ text, qr }: { text: string; qr: QrCode }) {
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

/** Before the round: the title, its tagline and where to join, over the street where shops brawl as they arrive. */
export function Lobby({ room, onBegin }: { room: string; onBegin: () => void }) {
  const url = joinUrl(room);
  const qr = encode(url);
  return (
    <div className="lobby" style={{ '--qr-modules': qrSpan(qr) } as CSSProperties}>
      <div className="lobby-side">
        <div className="join-card">
          <Qr text={url} qr={qr} />
          <p className="join-url">{url.replace(/^https?:\/\//, '')}</p>
          <button type="button" className="pill-button" onClick={onBegin}>
            {COPY.lobby.begin} <kbd>Enter</kbd>
          </button>
        </div>
      </div>
      <header className="masthead">
        <h1 className="title">
          <PixelText text={COPY.game} />
        </h1>
        <PixelText className="tagline" text={COPY.lobby.tagline} />
      </header>
      {/* Where the shop list sits, kept as wide as the join card's side so the title stays centered */}
      <div className="lobby-side" />
    </div>
  );
}
