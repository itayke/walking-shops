import { botPlayers, makeConfig, step, TICK, type PlayerSpec } from '@walking-shops/sim';
import { describe, expect, it } from 'vitest';
import { Host, Latch, parsePhoneMsg, parseToScreen, type ScreenMsg } from '../src/index.ts';

const SEED = 7;
const LOCAL: PlayerSpec[] = [{ id: 'you', label: 'YOU', controller: 'human' }];
const PHONE = 'phone-token-1';
const OTHER = 'phone-token-2';

function host(local: PlayerSpec[] = LOCAL) {
  const sent: ScreenMsg[] = [];
  const h = new Host({ config: makeConfig(), local, seed: () => SEED, tint: (i) => `tint-${i}`, send: (m) => sent.push(m) });
  return { h, sent };
}

const shopOf = (h: Host, phone: string) => h.game.shops.find((s) => s.id === h.seats.get(phone)?.shop);

describe('latch', () => {
  it('reports a held direction every read', () => {
    const l = new Latch();
    l.set(1);
    expect([l.read(), l.read()]).toEqual([1, 1]);
  });

  it('reports a tap released before the read once', () => {
    const l = new Latch();
    l.set(-1);
    l.set(0);
    expect([l.read(), l.read()]).toEqual([-1, 0]);
  });
});

describe('protocol', () => {
  it('accepts only well-formed phone input', () => {
    expect(parsePhoneMsg('{"t":"input","seq":3,"dir":-1}')).toEqual({ t: 'input', seq: 3, dir: -1 });
    for (const bad of ['{"t":"input","seq":3,"dir":2}', '{"t":"input","seq":-1,"dir":1}', 'nope', '{"t":"states"}', `{"t":"input","seq":1,"dir":1,"x":"${'a'.repeat(300)}"}`]) {
      expect(parsePhoneMsg(bad)).toBeNull();
    }
  });

  it('drops relay messages naming an invalid phone id', () => {
    expect(parseToScreen('{"t":"joined","phone":"x"}')).toBeNull();
    expect(parseToScreen(`{"t":"joined","phone":"${PHONE}"}`)).toEqual({ t: 'joined', phone: PHONE });
  });
});

describe('host', () => {
  it('fills the street with bots, one fewer per phone connected at the start of a round', () => {
    const { h } = host();
    const bots = botPlayers(h.game.config.BOT_MIX).length;
    expect(h.game.shops).toHaveLength(LOCAL.length + bots);
    h.receive({ t: 'roster', phones: [PHONE, OTHER] });
    h.restart();
    expect(h.game.shops).toHaveLength(LOCAL.length + bots);
    expect(h.game.shops.filter((s) => s.controller === 'human')).toHaveLength(LOCAL.length + 2);
    expect(shopOf(h, PHONE)?.label).toBe('P1');
  });

  it("seats a phone joining mid-round in a bot's shop", () => {
    const { h } = host();
    h.receive({ t: 'joined', phone: PHONE });
    const shop = shopOf(h, PHONE)!;
    expect(shop.controller).toBe('human');
    expect(shop.label).toBe('P1');
  });

  it('turns phone input into sim input, keeps a quick tap, and acknowledges it', () => {
    const { h, sent } = host();
    h.receive({ t: 'joined', phone: PHONE });
    h.receive({ t: 'input', phone: PHONE, seq: 1, dir: 1 });
    h.receive({ t: 'input', phone: PHONE, seq: 2, dir: 0 });
    // A stale input is dropped
    h.receive({ t: 'input', phone: PHONE, seq: 1, dir: -1 });
    const shop = shopOf(h, PHONE)!;
    expect(h.inputs()).toEqual({ [shop.id]: 1 });
    expect(h.inputs()).toEqual({ [shop.id]: 0 });
    h.flush();
    const [msg] = sent;
    expect(msg.states).toHaveLength(1);
    expect(msg.states[0][1]).toMatchObject({ label: 'P1', ack: 2, phase: 'walk-ins', tint: `tint-${h.game.shops.indexOf(shop)}` });
    // Nothing changed, nothing sent
    h.flush();
    expect(sent).toHaveLength(1);
  });

  it('gives a reconnecting phone its own shop back', () => {
    const { h } = host();
    h.receive({ t: 'joined', phone: PHONE });
    const id = h.seats.get(PHONE)!.shop;
    h.receive({ t: 'input', phone: PHONE, seq: 1, dir: 1 });
    h.receive({ t: 'left', phone: PHONE });
    // A dropped phone's shop sits still (its shutters will close)
    expect(h.inputs()).toEqual({ [id!]: 0 });
    h.receive({ t: 'joined', phone: PHONE });
    expect(h.seats.get(PHONE)!.shop).toBe(id);
    expect(h.seats.size).toBe(1);
  });

  it('leaves a phone out of a round it was offline for, and seats it again when it returns', () => {
    const { h } = host();
    h.receive({ t: 'joined', phone: PHONE });
    h.receive({ t: 'left', phone: PHONE });
    h.restart();
    expect(h.seats.get(PHONE)!.shop).toBeNull();
    h.receive({ t: 'joined', phone: PHONE });
    expect(shopOf(h, PHONE)?.controller).toBe('human');
  });

  it('makes a phone wait for the next round when every shop is taken', () => {
    const { h, sent } = host();
    const ids = Array.from({ length: h.game.shops.length }, (_, i) => `phone-token-${i + 10}`);
    for (const p of ids) h.receive({ t: 'joined', phone: p });
    const last = ids.at(-1)!;
    expect(h.seats.get(last)!.shop).toBeNull();
    h.flush();
    expect(sent[0].states.find(([p]) => p === last)?.[1].phase).toBe('waiting');
  });

  it('marks phones absent from a roster as gone', () => {
    const { h } = host();
    h.receive({ t: 'joined', phone: PHONE });
    h.receive({ t: 'roster', phones: [OTHER] });
    expect(h.seats.get(PHONE)!.online).toBe(false);
    expect(h.seats.get(OTHER)!.online).toBe(true);
  });

  it('plays a round driven by phone input', () => {
    const { h } = host([]);
    h.receive({ t: 'joined', phone: PHONE });
    let seq = 0;
    while (!h.game.over) {
      if (Math.round(h.game.t / TICK) % 20 === 0) h.receive({ t: 'input', phone: PHONE, seq: ++seq, dir: 1 });
      step(h.game, h.inputs(), TICK);
    }
    expect(h.phoneState(h.seats.get(PHONE)!).phase).toBe('results');
  });
});
