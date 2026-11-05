import { MOTION_LOOK } from '@walking-shops/render/look.ts';
import type { Channel, Tone } from './synth.ts';

// Every sound on the street, as notes. Auditioned on the sound board; change them there first

export type SoundId =
  | 'step'
  | 'sit'
  | 'strain'
  | 'topple'
  | 'land'
  | 'bump'
  | 'pushback'
  | 'coin'
  | 'paraCoin'
  | 'lost'
  | 'drop'
  | 'shutRow'
  | 'shutDown'
  | 'shutUp'
  | 'bar'
  | 'ready'
  | 'walkIns'
  | 'parachutes'
  | 'tick'
  | 'winner';

/** What a sound varies by: the floor a footfall is on and which foot, a push grunt's step, a shutter row, the last crosswalk bar. */
export interface SoundOpts {
  level?: number;
  foot?: number;
  step?: number;
  row?: number;
  last?: boolean;
}

const A4 = 440;
const A4_MIDI = 69;
const OCTAVE = 12;
const NOTE_STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A note's frequency from its name, as 'C5'. */
export function note(name: string): number {
  const midi = NOTE_STEPS[name[0]] + OCTAVE * (Number(name.slice(1)) + 1);
  return A4 * semi(midi - A4_MIDI);
}

/** The frequency ratio of k semitones. */
function semi(k: number): number {
  return 2 ** (k / OCTAVE);
}

/** Notes one after another, `step` apart; the last lasts `last` and fades out. */
function arp(ch: Channel, notes: readonly (string | number)[], step: number, v: number, at = 0, last = step): Tone[] {
  return notes.map((nm, i) => {
    const end = i === notes.length - 1;
    return { ch, f: typeof nm === 'number' ? nm : note(nm), at: at + i * step, d: end ? last : step, v, decay: end };
  });
}

// Footfalls alternate a and b, apart in pitch and grit so a walk reads as tik-tok; a shop up a tower walks higher
const FOOT = [
  { k: 0, noise: 0.7 },
  { k: -5, noise: 0.45 },
];
const FLOOR_STEP = 4;
const FIFTH = 7;
// Push grunts climb a whole tone per step
const STRAIN_STEP = 2;
// Each shutter row clicks a little lower than the last
const ROW_DROP = 0.04;
// The push-back's second voice is detuned against the first, which is what makes it rough
const ROUGH = semi(0.4);

const SOUNDS: Record<SoundId, (o: SoundOpts) => Tone[]> = {
  step: ({ level = 0, foot = 0 }) => {
    const f = FOOT[foot & 1];
    return [
      { ch: 'pulse12', f: note('G3') * semi(level * FLOOR_STEP + f.k), d: 0.04, v: 0.14, decay: true },
      { ch: 'noise', f: f.noise, d: 0.018, v: 0.08, decay: true },
    ];
  },
  // Subtle, and softer than a landing: the shop settles as its legs fold
  sit: () => [
    { ch: 'triangle', f: note('A2'), f2: note('D2'), d: 0.06, v: 0.25, decay: true },
    { ch: 'noise', f: 0.07, d: 0.04, v: 0.12, decay: true },
  ],
  strain: ({ step = 0 }) => [
    { ch: 'pulse25', f: note('F2') * semi(step * STRAIN_STEP), d: 0.1, v: 0.2, decay: true },
    { ch: 'noise', short: true, f: 0.3, d: 0.05, v: 0.08, decay: true },
  ],
  // The fall lasts the flight; the crash is the landing's own sound
  topple: () => [
    { ch: 'pulse12', f: note('C6'), f2: note('C3'), d: MOTION_LOOK.arcTime, v: 0.2 },
    { ch: 'pulse25', f: note('G6'), f2: note('G3'), d: MOTION_LOOK.arcTime, v: 0.07 },
  ],
  land: () => [
    { ch: 'noise', f: 0.06, d: 0.2, v: 0.5, decay: true },
    { ch: 'triangle', f: note('A2'), f2: note('A1'), d: 0.14, v: 0.45, decay: true },
  ],
  bump: () => [{ ch: 'noise', short: true, f: 0.45, d: 0.05, v: 0.28, decay: true }, ...arp('pulse50', ['G4', 'C4'], 0.04, 0.22, 0, 0.09)],
  // The lost customer's two falling notes, rougher: the attacker is turned away
  pushback: () => [
    ...arp('pulse12', ['A3', 'E3'], 0.13, 0.2, 0, 0.22),
    ...arp('pulse50', [note('A3') * ROUGH, note('E3') * ROUGH], 0.13, 0.12, 0, 0.22),
    { ch: 'noise', short: true, f: 0.22, d: 0.1, v: 0.1, decay: true },
    { ch: 'noise', short: true, f: 0.16, at: 0.13, d: 0.18, v: 0.1, decay: true },
  ],
  coin: () => [
    { ch: 'pulse25', f: note('E5'), d: 0.04, v: 0.18 },
    { ch: 'pulse25', f: note('E5') * semi(FIFTH), at: 0.04, d: 0.2, v: 0.18, decay: true },
  ],
  paraCoin: () => arp('pulse25', ['G5', 'B5', 'D6', 'G6'], 0.035, 0.18, 0, 0.25),
  lost: () => arp('triangle', ['E4', 'C4'], 0.13, 0.3, 0, 0.22),
  // The whistle lasts the fall; the thud is the landing's own sound
  drop: () => [{ ch: 'pulse12', f: note('C7'), f2: note('C5'), d: MOTION_LOOK.dropTime, v: 0.1 }],
  shutRow: ({ row = 0 }) => [
    { ch: 'noise', short: true, f: 0.55 - row * ROW_DROP, d: 0.03, v: 0.2, decay: true },
    { ch: 'noise', short: true, f: 0.5 - row * ROW_DROP, at: 0.04, d: 0.02, v: 0.12, decay: true },
  ],
  shutDown: () => [
    { ch: 'noise', f: 0.09, d: 0.12, v: 0.4, decay: true },
    { ch: 'triangle', f: note('E2'), d: 0.1, v: 0.35, decay: true },
  ],
  shutUp: () => [
    ...[0, 1, 2, 3, 4].map((i): Tone => ({ ch: 'noise', short: true, f: 0.3 + i * 0.06, at: i * 0.025, d: 0.015, v: 0.2, decay: true })),
    { ch: 'pulse25', f: note('G5'), at: 0.14, d: 0.07, v: 0.14, decay: true },
  ],
  // Kept low: a cue to look, not an alarm
  bar: ({ last = false }) =>
    last ? [{ ch: 'pulse50', f: note('A5'), d: 0.35, v: 0.09, decay: true }] : [{ ch: 'pulse50', f: note('A4'), d: 0.1, v: 0.08 }],
  ready: () => arp('pulse50', ['G4', 'D5'], 0.16, 0.18, 0, 0.2),
  walkIns: () => [
    ...arp('pulse25', ['C5', 'E5', 'G5', 'C6'], 0.07, 0.18, 0, 0.4),
    ...arp('pulse12', ['G4', 'C5', 'E5', 'G5'], 0.07, 0.07, 0, 0.4),
    { ch: 'triangle', f: note('C3'), d: 0.6, v: 0.3, decay: true },
  ],
  // A whistle falls from the sky, then the fanfare a key higher than WALK-INS!
  parachutes: () => [
    { ch: 'pulse12', f: note('C7'), f2: note('G5'), d: 0.35, v: 0.1 },
    ...arp('pulse25', ['G5', 'B5', 'D6', 'G6'], 0.07, 0.18, 0.38, 0.45),
    { ch: 'triangle', f: note('G2'), at: 0.38, d: 0.6, v: 0.3, decay: true },
  ],
  tick: () => [{ ch: 'triangle', f: note('A5'), d: 0.03, v: 0.22 }],
  // A run up two octaves to a held high C, over a quiet harmony an octave down and a bass
  winner: () => {
    const run = ['C5', 'E5', 'G5', 'C6', 'E6', 'G6', 'C7'];
    return [
      ...arp('pulse25', run, 0.06, 0.18, 0, 0.5),
      ...arp('pulse12', run.map((nm) => note(nm) / 2), 0.06, 0.06, 0, 0.5),
      { ch: 'triangle', f: note('C3'), d: 0.36, v: 0.3, decay: true },
      { ch: 'triangle', f: note('C3'), at: 0.36, d: 0.5, v: 0.3, decay: true },
    ];
  },
};

export function soundTones(id: SoundId, o: SoundOpts = {}): Tone[] {
  return SOUNDS[id](o);
}
