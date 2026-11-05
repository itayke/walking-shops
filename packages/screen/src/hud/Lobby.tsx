import type { CSSProperties } from 'react';
import { COPY } from '@walking-shops/render/copy.ts';
import { PixelText } from '@walking-shops/render/PixelText.tsx';
import { encode } from 'uqr';
import { Qr, qrSpan } from './Qr.tsx';
import { joinUrl } from '../net/room.ts';

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
