import { cleanName, NET } from '@walking-shops/net';
import { DESIGN_COUNT } from '@walking-shops/render/shopArt.ts';
import { nameFits } from '@walking-shops/render/signs.ts';
import type { Look } from '@walking-shops/sim';
import { useRef, type FormEvent } from 'react';
import { Preview } from './Preview.tsx';

// Shown on the field and, faded, on the sign until a name is typed; the shop can't open without one
const PLACEHOLDER = 'Shop name';
const REJECT_BUZZ_MS = 30;

const wrap = (design: number) => (design + DESIGN_COUNT) % DESIGN_COUNT;

export interface Draft {
  name: string;
  design: number;
}

/**
 * Setting up a shop: its name, typed straight onto the sign, and its type, swiped through on the preview. The color
 * is the screen's to give. A letter that would make the name too long for the sign isn't taken.
 */
export function Setup({ draft, hue, editing, onChange, onSubmit, onCancel }: {
  draft: Draft;
  hue: number;
  editing: boolean;
  onChange: (d: Draft) => void;
  onSubmit: (d: Draft) => void;
  onCancel: () => void;
}) {
  // Set when a letter didn't fit: the sign takes nothing more until something is deleted, so a narrower letter typed
  // after it can't slip in
  const full = useRef(false);
  const look: Look = { design: draft.design, hue };
  const name = cleanName(draft.name);

  const type = (raw: string) => {
    const name = cleanName(raw);
    const shorter = raw.length < draft.name.length;
    if (shorter) full.current = false;
    else if (full.current || name.length > NET.nameMax || (name && !nameFits(name))) {
      full.current = true;
      navigator.vibrate?.(REJECT_BUZZ_MS);
      return;
    }
    onChange({ ...draft, name: raw });
  };
  const turn = (by: number) => onChange({ ...draft, design: wrap(draft.design + by) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name) onSubmit({ name, design: draft.design });
  };

  return (
    <form className="setup" onSubmit={submit}>
      <Preview name={name || PLACEHOLDER} look={look} placeholder={!name} onTurn={turn} />
      <input
        className="name"
        value={draft.name}
        placeholder={PLACEHOLDER}
        onChange={(e) => type(e.target.value)}
        maxLength={NET.nameMax}
        autoCapitalize="words"
        autoComplete="off"
        enterKeyHint="go"
        aria-label="Your shop's name"
      />
      <button type="submit" className="go" disabled={!name}>
        {editing ? 'Save' : 'Open my shop'}
      </button>
      {editing && (
        <button type="button" className="cancel" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}
