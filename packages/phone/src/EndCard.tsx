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

/** Who made the game and every way to reach them, in its own frame along the bottom of the end card. */
export function Contact() {
  const c = COPY.contact;
  const url = useVCardUrl();
  return (
    <>
      <p className="contact-name">{[c.name, c.company].filter(Boolean).join(' · ')}</p>
      {c.role && <p>{c.role}</p>}
      {c.email && <p className="contact-email">{c.email}</p>}
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
    </>
  );
}
