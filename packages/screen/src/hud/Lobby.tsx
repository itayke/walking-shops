import type { GameState } from '@walking-shops/sim';
import { encode } from 'uqr';
import { joinUrl } from '../net/room.ts';
import { PixelText } from './PixelText.tsx';

// Light modules around the code, so a scanner finds its edge against the card, with corners rounded inside that margin
const QR_QUIET = 2;
const QR_CORNER = 1;

/** The join link as square modules, one SVG path, drawn hard-edged at any size. */
function Qr({ text }: { text: string }) {
  const { data, size } = encode(text);
  const span = size + 2 * QR_QUIET;
  let d = '';
  data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x + QR_QUIET} ${y + QR_QUIET}h1v1h-1z`)));
  return (
    <svg className="qr" viewBox={`0 0 ${span} ${span}`} shapeRendering="crispEdges" role="img" aria-label={text}>
      <rect width={span} height={span} rx={QR_CORNER} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

/** Before the round: the title, its tagline and where to join, over the street where shops brawl as they arrive. */
export function Lobby({ g, room, onBegin }: { g: GameState; room: string; onBegin: () => void }) {
  const url = joinUrl(room);
  const shops = g.shops.length;
  return (
    <div className="lobby">
      <header className="masthead">
        <h1 className="title">Shop Shuffle</h1>
        <PixelText className="tagline" text="Get your business moving" />
      </header>
      <div className="join-card">
        <Qr text={url} />
        <p className="join-url">{url.replace(/^https?:\/\//, '')}</p>
        <p>Scan to open your shop</p>
        <p className="join-count">
          {shops} {shops === 1 ? 'shop' : 'shops'} open
        </p>
        <button type="button" onClick={onBegin}>
          Begin <kbd>Enter</kbd>
        </button>
      </div>
    </div>
  );
}
