// NES-style channels on Web Audio: three pulse widths, a triangle and a shift-register noise. Pitch slides and fades
// move in frame steps, like the NES frame counter, which is what makes a sweep sound 8-bit
const FRAME = 1 / 60;
const HARMONICS = 64;
// The noise channel's 15-bit shift register: the long tap hisses, the short one loops quickly and sounds metallic
const LFSR_BITS = 15;
const LONG_TAP = 1;
const SHORT_TAP = 6;
const NOISE_LEVEL = 0.5;
// A note's attack, and the fade at the end of a held note, short enough to stay hard-edged without clicking
const ATTACK = 0.002;
const RELEASE = 0.004;
// Oscillators run a little past their note so the fade finishes
const TAIL = 0.02;
const VOLUME = 0.6;

export type Channel = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle' | 'noise';
// Playing, waiting for a key or click before the browser lets it start, or muted
export type SoundState = 'on' | 'locked' | 'muted';

const DUTY: Record<Exclude<Channel, 'triangle' | 'noise'>, number> = { pulse12: 0.125, pulse25: 0.25, pulse50: 0.5 };

/** One note of a sound. */
export interface Tone {
  ch: Channel;
  // Hz; for noise, how fast the shift register runs, as a share of the sample rate. Slides to f2 when given
  f: number;
  f2?: number;
  // Start within the sound, and length, in seconds
  at?: number;
  d: number;
  v: number;
  // Fades out in steps over its length, rather than holding
  decay?: boolean;
  // Noise only: the short, metallic loop
  short?: boolean;
}

interface Voices {
  ctx: AudioContext;
  out: GainNode;
  waves: Record<keyof typeof DUTY, PeriodicWave>;
  noise: { long: AudioBuffer; short: AudioBuffer };
}

/** The screen's sound output. Browsers may hold it silent until a key or click; it starts on the first one. */
export class Synth {
  private v: Voices | null = null;
  private paused = false;
  muted = false;

  get state(): SoundState {
    if (this.muted) return 'muted';
    return this.v && (this.paused || this.v.ctx.state === 'running') ? 'on' : 'locked';
  }

  /** Start audio: at load (the browser may allow it then) and again from every key or click until it runs. */
  unlock(): void {
    this.v ??= voices();
    if (!this.paused && this.v.ctx.state === 'suspended') void this.v.ctx.resume();
  }

  /** Freeze sounds mid-note with the game, and carry on with it. */
  pause(on: boolean): void {
    this.paused = on;
    if (!this.v) return;
    void (on ? this.v.ctx.suspend() : this.v.ctx.resume());
  }

  toggleMute(): void {
    this.muted = !this.muted;
    if (this.v) this.v.out.gain.value = this.muted ? 0 : VOLUME;
  }

  /** Play a sound now, panned from -1 (left) to 1 (right). */
  play(tones: readonly Tone[], pan: number): void {
    const v = this.v;
    if (!v || this.muted || v.ctx.state !== 'running') return;
    const t0 = v.ctx.currentTime;
    const panner = v.ctx.createStereoPanner();
    panner.pan.value = pan;
    panner.connect(v.out);
    for (const o of tones) {
      const t = t0 + (o.at ?? 0);
      const gain = v.ctx.createGain();
      let src: AudioBufferSourceNode | OscillatorNode;
      if (o.ch === 'noise') {
        const b = v.ctx.createBufferSource();
        b.buffer = o.short ? v.noise.short : v.noise.long;
        b.loop = true;
        stepped(b.playbackRate, o.f, o.f2 ?? o.f, t, o.d);
        src = b;
      } else {
        const osc = v.ctx.createOscillator();
        if (o.ch === 'triangle') osc.type = 'triangle';
        else osc.setPeriodicWave(v.waves[o.ch]);
        stepped(osc.frequency, o.f, o.f2 ?? o.f, t, o.d);
        src = osc;
      }
      envelope(gain.gain, o.v, t, o.d, o.decay ?? false);
      src.connect(gain);
      gain.connect(panner);
      src.start(t);
      src.stop(t + o.d + TAIL);
    }
  }
}

function voices(): Voices {
  const ctx = new AudioContext();
  const comp = ctx.createDynamicsCompressor();
  const out = ctx.createGain();
  out.gain.value = VOLUME;
  out.connect(comp);
  comp.connect(ctx.destination);
  const waves = { pulse12: pulseWave(ctx, DUTY.pulse12), pulse25: pulseWave(ctx, DUTY.pulse25), pulse50: pulseWave(ctx, DUTY.pulse50) };
  return { ctx, out, waves, noise: { long: lfsr(ctx, LONG_TAP), short: lfsr(ctx, SHORT_TAP) } };
}

/** A pulse wave high for `duty` of each cycle, from its Fourier series. */
function pulseWave(ctx: AudioContext, duty: number): PeriodicWave {
  const re = new Float32Array(HARMONICS);
  const im = new Float32Array(HARMONICS);
  for (let k = 1; k < HARMONICS; k++) {
    re[k] = Math.sin(2 * Math.PI * k * duty) / (k * Math.PI);
    im[k] = (1 - Math.cos(2 * Math.PI * k * duty)) / (k * Math.PI);
  }
  return ctx.createPeriodicWave(re, im);
}

/** A second of the shift register's output, one step per sample; playback rate sets its pitch. */
function lfsr(ctx: AudioContext, tap: number): AudioBuffer {
  const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let r = 1;
  for (let i = 0; i < d.length; i++) {
    const fb = (r & 1) ^ ((r >> tap) & 1);
    r = (r >> 1) | (fb << (LFSR_BITS - 1));
    d[i] = r & 1 ? -NOISE_LEVEL : NOISE_LEVEL;
  }
  return buf;
}

/** Hold a, or slide from a to b over d seconds in frame steps. */
function stepped(param: AudioParam, a: number, b: number, t: number, d: number): void {
  param.setValueAtTime(a, t);
  if (a === b) return;
  const n = Math.max(1, Math.round(d / FRAME));
  for (let i = 1; i < n; i++) param.setValueAtTime(a * Math.pow(b / a, i / n), t + i * FRAME);
}

function envelope(g: AudioParam, v: number, t: number, d: number, decay: boolean): void {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(v, t + ATTACK);
  if (decay) {
    const n = Math.max(1, Math.round(d / FRAME));
    for (let i = 1; i < n; i++) g.setValueAtTime(v * (1 - i / n), t + i * FRAME);
  } else g.setValueAtTime(v, Math.max(t + ATTACK, t + d - RELEASE));
  g.linearRampToValueAtTime(0, t + d);
}
