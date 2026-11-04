// A triangle pointing left in a 24-unit box, its corners rounded by a stroke of its own color
const TRIANGLE = 'M17 4 L5 12 L17 20 Z';
const CORNER = 4;

/** A round-cornered triangle pointing the way it steps, sized and colored by its CSS. */
export function Arrow({ dir, className }: { dir: -1 | 1; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" style={dir > 0 ? { transform: 'scaleX(-1)' } : undefined}>
      <path d={TRIANGLE} fill="currentColor" stroke="currentColor" strokeWidth={CORNER} strokeLinejoin="round" />
    </svg>
  );
}
