import { makeConfig, step, TICK, type PlayerSpec } from '@walking-shops/sim';
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
  it('opens on a lobby with only the local players', () => {
    const { h } = host();
    expect(h.game.lobby).toBe(true);
    expect(h.game.shops.map((s) => s.id)).toEqual(LOCAL.map((p) => p.id));
  });

  it('gives each phone that joins the lobby its own shop', () => {
    const { h } = host();
    h.receive({ t: 'roster', phones: [PHONE, OTHER] });
    expect(shopOf(h, PHONE)).toMatchObject({ label: 'P1', controller: 'human' });
    expect(shopOf(h, OTHER)).toMatchObject({ label: 'P2', controller: 'human' });
  });

  it('fills the street with bots up to minPlayers when the round begins', () => {
    const { h } = host();
    h.receive({ t: 'roster', phones: [PHONE, OTHER] });
    h.begin();
    expect(h.game.lobby).toBe(false);
    expect(h.game.shops).toHaveLength(h.game.config.ROUND.minPlayers);
    expect(h.game.shops.filter((s) => s.controller === 'human')).toHaveLength(LOCAL.length + 2);
  });

  it('makes a phone that joins during the round wait, then seats it in the lobby after', () => {
    const { h, sent } = host();
    h.begin();
    h.receive({ t: 'joined', phone: PHONE });
    expect(h.seats.get(PHONE)!.shop).toBeNull();
    h.flush();
    expect(sent[0].states[0][1].phase).toBe('waiting');
    h.replay();
    expect(h.game.lobby).toBe(true);
    expect(shopOf(h, PHONE)?.controller).toBe('human');
    expect(h.game.shops.every((s) => s.controller === 'human')).toBe(true);
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
    expect(msg.states[0][1]).toMatchObject({ label: 'P1', ack: 2, phase: 'lobby', tint: `tint-${h.game.shops.indexOf(shop)}` });
    // Nothing changed, nothing sent
    h.flush();
    expect(sent).toHaveLength(1);
  });

  it('gives a reconnecting phone its own shop back, even mid-round', () => {
    const { h } = host();
    h.receive({ t: 'joined', phone: PHONE });
    const id = h.seats.get(PHONE)!.shop;
    h.begin();
    h.receive({ t: 'input', phone: PHONE, seq: 1, dir: 1 });
    h.receive({ t: 'left', phone: PHONE });
    // A dropped phone's shop sits still (its shutters will close)
    expect(h.inputs()).toEqual({ [id!]: 0 });
    h.receive({ t: 'joined', phone: PHONE });
    expect(h.seats.get(PHONE)!.shop).toBe(id);
    expect(h.seats.size).toBe(1);
  });

  it('keeps a shop on the street for a phone that drops in the lobby', () => {
    const { h } = host();
    h.receive({ t: 'joined', phone: PHONE });
    h.receive({ t: 'left', phone: PHONE });
    h.begin();
    expect(shopOf(h, PHONE)?.controller).toBe('human');
  });

  it('lays out a new street with every connected phone, and none that left', () => {
    const { h } = host();
    h.receive({ t: 'roster', phones: [PHONE, OTHER] });
    h.receive({ t: 'left', phone: OTHER });
    h.reset();
    expect(shopOf(h, PHONE)?.controller).toBe('human');
    expect(h.seats.get(OTHER)!.shop).toBeNull();
    expect(h.game.shops).toHaveLength(LOCAL.length + 1);
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
    h.begin();
    let seq = 0;
    while (!h.game.over) {
      if (Math.round(h.game.t / TICK) % 20 === 0) h.receive({ t: 'input', phone: PHONE, seq: ++seq, dir: 1 });
      step(h.game, h.inputs(), TICK);
    }
    expect(h.phoneState(h.seats.get(PHONE)!).phase).toBe('results');
  });
});
