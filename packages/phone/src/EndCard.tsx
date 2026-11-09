import { COPY } from '@walking-shops/render/copy.ts';
import { useEffect, useState } from 'react';
import { contactLinks, vCard, vCardName } from './contact.ts';

/** A saved file's URL for the vCard, freed when the card goes. */
function useVCardUrl(): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(new Blob([vCard()], { type: 'text/vcard' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, []);
  return url;
}

/** How the round went, on the end card under the player's shop. */
export function RoundStats({ served, topples }: { served: number; topples: number }) {
  return (
    <p className="stats">
      {COPY.phone.served(served)} · {COPY.phone.toppled(topples)}
    </p>
  );
}

/** Who made the game and every way to reach them, in its own frame along the bottom. brief is the quiet version for
 * pages that need the player's attention: the game's name, who made it and the email, with no buttons. */
export function Contact({ brief = false }: { brief?: boolean }) {
  const c = COPY.contact;
  const url = useVCardUrl();
  const name = [c.name, c.company].filter(Boolean).join(' · ');
  return (
    <>
      {brief && <p className="contact-game">{COPY.game}</p>}
      <p className="contact-name">
        {brief && <span className="contact-by">{COPY.phone.madeBy} </span>}
        {name}
      </p>
      {c.role && <p>{c.role}</p>}
      {c.email && <p className="contact-email">{c.email}</p>}
      {!brief && (
        <div className="contact-links">
          {url && (
            <a className="contact-save" href={url} download={vCardName()}>
              {COPY.phone.saveContact}
            </a>
          )}
          {contactLinks().map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener">
              {l.label}
            </a>
          ))}
        </div>
      )}
    </>
  );
}
