import { cleanName, NET } from '@walking-shops/net';
import { PALETTE } from '@walking-shops/render/colors.ts';
import { DESIGN_COUNT } from '@walking-shops/render/shopArt.ts';
import { nameFits } from '@walking-shops/render/signs.ts';
import type { Look } from '@walking-shops/sim';
import { useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { Preview } from './Preview.tsx';

// Shown on the field and, faded, on the sign until a name is typed; the shop can't open without one
const PLACEHOLDER = 'Shop name';
// A drag across the preview this far (CSS pixels) turns to the next shop type
const SWIPE_PX = 40;
const REJECT_BUZZ_MS = 30;
// The street's sky behind the preview, so the shop stands out from a page in its own color
const BACKDROP = PALETTE.sky[1];

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
  // The way the last turn went, so the preview spins the right way
  const [dir, setDir] = useState(1);
  const swipe = useRef<number | null>(null);
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
  const turn = (by: number) => {
    setDir(by);
    onChange({ ...draft, design: wrap(draft.design + by) });
  };
  const down = (e: PointerEvent) => (swipe.current = e.clientX);
  const up = (e: PointerEvent) => {
    if (swipe.current === null) return;
    const dx = e.clientX - swipe.current;
    swipe.current = null;
    if (Math.abs(dx) >= SWIPE_PX) turn(dx < 0 ? 1 : -1);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (name) onSubmit({ name, design: draft.design });
  };

  return (
    <form className="setup" onSubmit={submit}>
      <div className="stand" style={{ background: BACKDROP }} onPointerDown={down} onPointerUp={up} onPointerCancel={() => (swipe.current = null)}>
        <button type="button" className="turn" onClick={() => turn(-1)} aria-label="Previous shop type">
          ◀
        </button>
        <Preview name={name || PLACEHOLDER} look={look} dir={dir} placeholder={!name} />
        <button type="button" className="turn" onClick={() => turn(1)} aria-label="Next shop type">
          ▶
        </button>
      </div>
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
