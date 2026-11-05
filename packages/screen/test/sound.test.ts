import { TICK, type GameState, type Inputs } from '@walking-shops/sim';
import { MOTION_LOOK } from '@walking-shops/render/look.ts';
import { shutterRows } from '@walking-shops/render/shopArt.ts';
import { StreetView } from '@walking-shops/render/view.ts';
import { describe, expect, it } from 'vitest';
import { run, street } from '../../sim/test/helpers.ts';
import { MIX, Mixer } from '../src/sound/mixer.ts';
import { soundTones, type SoundId, type SoundOpts } from '../src/sound/sounds.ts';
import { StreetSound, TICK_FROM } from '../src/sound/streetSound.ts';

const IDS: SoundId[] = ['step', 'strain', 'topple', 'land', 'bump', 'pushback', 'coin', 'paraCoin', 'lost', 'drop', 'shutRow', 'shutDown', 'shutUp', 'bar', 'ready', 'walkIns', 'parachutes', 'tick', 'winner'];

interface Heard {
  id: SoundId;
  o: SoundOpts;
  pan: number;
}

/** A street played tick by tick through the view and the sound, collecting what would be heard. */
function listen(g: GameState) {
  const heard: Heard[] = [];
  const view = new StreetView();
  view.reset(g);
  const sound = new StreetSound((id, o, pan) => heard.push({ id, o, pan }));
  let t = 0;
  const play = (seconds: number, inputs: Inputs = {}) => {
    for (let i = 0; i < Math.round(seconds / TICK); i++) {
      const ev = run(g, TICK, inputs);
      view.onEvents(g, ev);
      sound.onEvents(g, ev, t);
      view.update(g, TICK);
      t += TICK;
      sound.update(g, view, t);
    }
  };
  return { heard, view, sound, play, ids: () => heard.map((h) => h.id) };
}

describe('sounds', () => {
  it('builds every sound from real notes', () => {
    for (const id of IDS) {
      const tones = soundTones(id, { level: 2, foot: 1, step: 9, row: 7, last: true });
      expect(tones.length).toBeGreaterThan(0);
      for (const t of tones) {
        expect(t.f).toBeGreaterThan(0);
        expect(t.d).toBeGreaterThan(0);
      }
    }
  });
});

describe('mixer', () => {
  it('lets one walking shop sound every footfall, but caps a crowd', () => {
    const one = new Mixer();
    const stride = 0.225;
    expect([0, 1, 2, 3, 4, 5, 6, 7].every((i) => one.admit('step', i * stride))).toBe(true);

    const crowd = new Mixer();
    const spacing = 0.05;
    let heard = 0;
    for (let i = 0; i * spacing < 1; i++) if (crowd.admit('step', i * spacing)) heard++;
    expect(heard).toBe(MIX.caps.step!.max);
  });

  it('plays one of a sound at a time, then the next after its gap', () => {
    const m = new Mixer();
    expect(m.admit('bump', 0)).toBe(true);
    expect(m.admit('bump', 0)).toBe(false);
    expect(m.admit('lost', 0)).toBe(true);
    expect(m.admit('bump', MIX.gaps.bump!)).toBe(true);
  });

  it('caps the topples sounding at once', () => {
    const m = new Mixer();
    const gap = MIX.gaps.topple!;
    const admitted = [0, 1, 2].map((i) => m.admit('topple', i * gap));
    expect(admitted.filter(Boolean)).toHaveLength(MIX.caps.topple!.max);
    expect(m.admit('topple', MOTION_LOOK.arcTime + gap)).toBe(true);
  });

  it('sounds coins on successive ticks, up to a few ringing at once', () => {
    const m = new Mixer();
    const cap = MIX.caps.coin!;
    const admitted = Array.from({ length: cap.max + 1 }, (_, i) => m.admit('coin', i * TICK));
    expect(admitted).toEqual([...Array(cap.max).fill(true), false]);
    expect(m.admit('coin', cap.span)).toBe(true);
  });
});

describe('street sound', () => {
  it('pans each sound to its column', () => {
    const g = street([['A'], [], ['B']]);
    const { heard, sound } = listen(g);
    sound.onEvents(g, [{ type: 'lost', x: 0, shopper: 0 }, { type: 'pushback', by: 'B', col: 2, level: 0 }], 0);
    expect(heard.map((h) => [h.id, h.pan])).toEqual([
      ['lost', -MIX.panWidth],
      ['pushback', MIX.panWidth],
    ]);
  });

  it('steps twice per column walked, alternating feet', () => {
    const g = street([['A'], [], [], [], []]);
    const { heard, play } = listen(g);
    play(g.config.MOVEMENT.cellTime * 3, { A: 1 });
    play(1);
    const steps = heard.filter((h) => h.id === 'step');
    expect(steps.length).toBeGreaterThanOrEqual(4);
    expect(steps.every((h, i) => i === 0 || h.o.foot !== steps[i - 1].o.foot)).toBe(true);
  });

  it('clicks once per shutter row as an idle shop closes, then snaps up on a press', () => {
    const g = street([['A'], ['B']], { IDLE: { idleOn: true } });
    const { ids, play } = listen(g);
    play(g.config.IDLE.idleTime + TICK);
    expect(ids().filter((id) => id === 'shutRow')).toHaveLength(shutterRows());
    expect(ids().filter((id) => id === 'shutDown')).toHaveLength(1);
    play(TICK, { A: 1 });
    expect(ids().at(-1)).toBe('shutUp');
  });

  it('says nothing about a jump it was primed for', () => {
    const g = street([['A'], ['B']], { IDLE: { idleOn: true } });
    const { heard, sound, view, play } = listen(g);
    run(g, g.config.IDLE.idleTime - TICK);
    view.update(g, TICK);
    sound.prime();
    sound.update(g, view, 0);
    expect(heard.filter((h) => h.id === 'shutRow')).toHaveLength(0);
    play(TICK);
    expect(heard.filter((h) => h.id === 'shutRow').length).toBeLessThanOrEqual(1);
  });

  it('ticks through the last seconds, then plays the winner and nothing more', () => {
    const roundTime = 8;
    const g = street([['A'], ['B'], []], { ROUND: { roundTime } });
    const { ids, play } = listen(g);
    // The round ends on the tick after its clock runs out
    play(roundTime + 2 * TICK);
    expect(ids().filter((id) => id === 'tick')).toHaveLength(TICK_FROM);
    expect(ids().at(-1)).toBe('winner');
    const heard = ids().length;
    play(1, { A: 1 });
    expect(ids()).toHaveLength(heard);
  });
});
