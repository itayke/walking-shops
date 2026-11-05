import { COPY } from '@walking-shops/render/copy.ts';

// The end card's contact, as links and as a vCard the phone can save. Empty fields in the copy are left out.

/** Escapes a vCard value: backslashes, commas, semicolons and line breaks are special. */
const esc = (v: string) => v.replace(/[\\,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');

/** The contact as a vCard 3.0, which every phone's contacts app reads. */
export function vCard(): string {
  const c = COPY.contact;
  const words = c.name.trim().split(/\s+/);
  const last = words.length > 1 ? words.pop()! : '';
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${esc(last)};${esc(words.join(' '))};;;`,
    `FN:${esc(c.name)}`,
    c.company && `ORG:${esc(c.company)}`,
    c.role && `TITLE:${esc(c.role)}`,
    c.email && `EMAIL;TYPE=INTERNET:${esc(c.email)}`,
    c.phone && `TEL;TYPE=CELL:${esc(c.phone)}`,
    c.site && `URL:${esc(c.site)}`,
    c.linkedin && `URL:${esc(c.linkedin)}`,
    'END:VCARD',
  ];
  // Line ends are CRLF in a vCard
  return lines.filter(Boolean).join('\r\n');
}

/** The vCard's file name: the contact's name, safe for any file system. */
export function vCardName(): string {
  return `${COPY.contact.name.replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'contact'}.vcf`;
}

/** Where each filled-in way to reach the contact goes, with its button's label. */
export function contactLinks(): { href: string; label: string }[] {
  const c = COPY.contact;
  const p = COPY.phone;
  const links = [
    { value: c.site, href: c.site, label: p.site },
    { value: c.linkedin, href: c.linkedin, label: p.linkedin },
    { value: c.email, href: `mailto:${c.email}`, label: p.email },
    { value: c.phone, href: `tel:${c.phone}`, label: p.call },
  ];
  return links.filter((l) => l.value).map(({ href, label }) => ({ href, label }));
}
