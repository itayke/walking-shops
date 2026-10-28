import type { Dir } from '@walking-shops/sim';
import { useState, type PointerEvent } from 'react';

// Stand-in tint until the join flow assigns one (Milestone 4)
const TINT = 'hsl(200 70% 45%)';
const HELD_BRIGHTNESS = 1.35;

/** Stub controller: the whole phone is two halves, hold left or right to walk. Milestone 3 sends the input. */
export function App() {
  const [dir, setDir] = useState<Dir>(0);
  const hold = (d: Dir) => (e: PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setDir(d);
  };
  const release = () => setDir(0);
  const half = (d: Dir) => (
    <div
      onPointerDown={hold(d)}
      onPointerUp={release}
      onPointerCancel={release}
      style={{ flex: 1, background: TINT, filter: dir === d ? `brightness(${HELD_BRIGHTNESS})` : 'none', touchAction: 'none' }}
    />
  );
  return (
    <div style={{ display: 'flex', height: '100%', gap: 2, background: '#000' }} onContextMenu={(e) => e.preventDefault()}>
      {half(-1)}
      {half(1)}
    </div>
  );
}
