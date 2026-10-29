import { Latch } from '@walking-shops/net';
import type { Dir } from '@walking-shops/sim';

const LEFT_KEYS = new Set(['a', 'arrowleft']);
const RIGHT_KEYS = new Set(['d', 'arrowright']);

export interface Keyboard {
  /** The held direction (the most recently pressed side that is still down), else a tap not yet read. */
  dir(): Dir;
  dispose(): void;
}

/** The phone's two halves on the keyboard: tap to step, hold to keep walking. Typing in a field doesn't count. */
export function createKeyboard(): Keyboard {
  // Held walk keys, most recent last
  const held: string[] = [];
  // Same tap handling as a phone's input: a press released before the sim reads it still counts once
  const latch = new Latch();
  const sideOf = (key: string): Dir => (LEFT_KEYS.has(key) ? -1 : RIGHT_KEYS.has(key) ? 1 : 0);
  const release = (key: string) => {
    const i = held.indexOf(key);
    if (i >= 0) held.splice(i, 1);
    latch.set(sideOf(held.at(-1) ?? ''));
  };

  const onDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    const key = e.key.toLowerCase();
    if (sideOf(key) === 0) return;
    e.preventDefault();
    if (e.repeat) return;
    release(key);
    held.push(key);
    latch.set(sideOf(key));
  };
  const onUp = (e: KeyboardEvent) => release(e.key.toLowerCase());
  // Keys released while the window is in the background never send keyup
  const onBlur = () => {
    held.length = 0;
    latch.clear();
  };

  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);
  window.addEventListener('blur', onBlur);
  return {
    dir: () => latch.read(),
    dispose: () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    },
  };
}
