import { cleanName, NET } from '@walking-shops/net';
import { PALETTE } from '@walking-shops/render/colors.ts';
import { DESIGN_COUNT } from '@walking-shops/render/shopArt.ts';
import { nameFits } from '@walking-shops/render/signs.ts';
import type { Look } from '@walking-shops/sim';
import { useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { Preview } from './Preview.tsx';

// Pun names for a blank sign, so nobody stalls on a name: the placeholder, and the name if the field is left empty
const SUGGESTIONS = ['Bean There', 'Knead Dough', 'Lettuce Eat', 'Wok This Way', 'Sofa So Good', 'Tea Rex', 'Brew Ha Ha', 'Thyme Out', 'Curl Up & Dye', 'Nacho Average'];
// A drag across the preview this far (CSS pixels) turns to the next shop type
const SWIPE_PX = 40;
const REJECT_BUZZ_MS = 30;
// The street's sky behind the preview, so the shop stands out from a page in its own color
const BACKDROP = PALETTE.sky[1];

const suggestion = () => SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)];
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
  const [placeholder] = useState(suggestion);
  const swipe = useRef<number | null>(null);
  // Set when a letter didn't fit: the sign takes nothing more until something is deleted, so a narrower letter typed
  // after it can't slip in
  const full = useRef(false);
  const look: Look = { design: draft.design, hue };

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
  const down = (e: PointerEvent) => (swipe.current = e.clientX);
  const up = (e: PointerEvent) => {
    if (swipe.current === null) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) >= SWIPE_PX) turn(dx < 0 ? 1 : -1);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ name: cleanName(draft.name) || placeholder, design: draft.design });
  };

  return (
    <form className="setup" onSubmit={submit}>
      <div className="stand" style={{ background: BACKDROP }} onPointerDown={down} onPointerUp={up} onPointerCancel={() => (swipe.current = null)}>
        <button type="button" className="turn" onClick={() => turn(-1)} aria-label="Previous shop type">
          ◀
        </button>
        <Preview name={cleanName(draft.name) || placeholder} look={look} />
        <button type="button" className="turn" onClick={() => turn(1)} aria-label="Next shop type">
          ▶
        </button>
      </div>
      <input
        className="name"
        value={draft.name}
        placeholder={placeholder}
        onChange={(e) => type(e.target.value)}
        maxLength={NET.nameMax}
        autoCapitalize="words"
        autoComplete="off"
        enterKeyHint="go"
        aria-label="Your shop's name"
      />
      <button type="submit" className="go">
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
