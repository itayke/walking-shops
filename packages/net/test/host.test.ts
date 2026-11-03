import { makeConfig, step, TICK, type PlayerSpec } from '@walking-shops/sim';
import { describe, expect, it } from 'vitest';
import { cleanName, Host, Latch, NET, parsePhoneMsg, parseToScreen, type ScreenMsg } from '../src/index.ts';

const SEED = 7;
const LOCAL: PlayerSpec[] = [{ id: 'you', label: 'YOU', controller: 'human' }];
const PHONE = 'phone-token-1';
const OTHER = 'phone-token-2';
const LOOKS = { designs: 6, hues: 24 };

function host(local: PlayerSpec[] = LOCAL, looks = LOOKS) {
  const sent: ScreenMsg[] = [];
  const h = new Host({ config: makeConfig(), local, seed: () => SEED, looks, tint: (l) => `tint-${l.hue}`, send: (m) => sent.push(m) });
  return { h, sent };
}

const shopOf = (h: Host, phone: string) => h.game.shops.find((s) => s.id === h.seats.get(phone)?.shop);

/** A phone connects and opens its shop. */
function open(h: Host, phone: string, name = 'Shop', design = 0): void {
  h.receive({ t: 'joined', phone });
  h.receive({ t: 'profile', phone, name, design });
}

const phoneToken = (i: number) => `phone-token-${i + 10}`;

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

  it('accepts a shop name and type, cleaned up, and drops a blank or overlong name', () => {
    expect(parsePhoneMsg('{"t":"profile","name":"  Joe\'s\\n  Pizza ","design":2}')).toEqual({ t: 'profile', name: "Joe's Pizza", design: 2 });
    for (const name of ['', '   ', 'x'.repeat(NET.nameMax + 1)]) expect(parsePhoneMsg(JSON.stringify({ t: 'profile', name, design: 0 }))).toBeNull();
    expect(parsePhoneMsg('{"t":"profile","name":"Joe","design":-1}')).toBeNull();
  });

  it('drops relay messages naming an invalid phone id', () => {
    expect(parseToScreen('{"t":"joined","phone":"x"}')).toBeNull();
    expect(parseToScreen(`{"t":"joined","phone":"${PHONE}"}`)).toEqual({ t: 'joined', phone: PHONE });
  });
});

describe('host', () => {
  it('opens on a lobby with only the local players, each with a look', () => {
    const { h } = host();
    expect(h.game.lobby).toBe(true);
    expect(h.game.shops.map((s) => s.id)).toEqual(LOCAL.map((p) => p.id));
    expect(h.game.shops[0].look).not.toBeNull();
  });

  it('gives a connecting phone a color to preview, but no shop until it opens one', () => {
    const { h } = host();
    h.receive({ t: 'joined', phone: PHONE });
    expect(h.seats.get(PHONE)!.shop).toBeNull();
    expect(h.phoneState(h.seats.get(PHONE)!)).toMatchObject({ phase: 'setup', label: '' });
    h.receive({ t: 'profile', phone: PHONE, name: "Joe's Pizza", design: 3 });
    expect(shopOf(h, PHONE)).toMatchObject({ label: "Joe's Pizza", controller: 'human', look: { design: 3, hue: h.seats.get(PHONE)!.look.hue } });
    expect(h.phoneState(h.seats.get(PHONE)!)).toMatchObject({ phase: 'lobby', label: "Joe's Pizza" });
  });

  it('hands out every color once before repeating one, and repeats it on a different shop type', () => {
    const { h } = host([]);
    for (let i = 0; i < LOOKS.hues; i++) open(h, phoneToken(i), `Shop ${i}`, 0);
    expect(new Set(h.game.shops.map((s) => s.look!.hue)).size).toBe(LOOKS.hues);
    // Every color is taken by type 0: other types can still each get a look nobody has
    open(h, phoneToken(LOOKS.hues), 'Twin', 1);
    open(h, phoneToken(LOOKS.hues + 1), 'Other twin', 2);
    const looks = h.game.shops.map((s) => `${s.look!.hue}/${s.look!.design}`);
    expect(new Set(looks).size).toBe(looks.length);
  });

  it('lets a phone rename its shop and change its type in the lobby, but not once the round is under way', () => {
    const { h } = host();
    open(h, PHONE, 'First', 0);
    h.receive({ t: 'profile', phone: PHONE, name: 'Second', design: 2 });
    expect(shopOf(h, PHONE)).toMatchObject({ label: 'Second', look: { design: 2 } });
    expect(h.game.shops.filter((s) => s.controller === 'human')).toHaveLength(LOCAL.length + 1);
    h.begin();
    h.receive({ t: 'profile', phone: PHONE, name: 'Third', design: 1 });
    expect(shopOf(h, PHONE)).toMatchObject({ label: 'Second', look: { design: 2 } });
  });

  it('ignores a shop type the screen has no art for', () => {
    const { h } = host();
    open(h, PHONE, 'Joe', LOOKS.designs);
    expect(h.seats.get(PHONE)!.shop).toBeNull();
  });

  it('fills the street with bots up to minPlayers when the round begins, each with a look', () => {
    const { h } = host();
    open(h, PHONE);
    open(h, OTHER);
    h.begin();
    expect(h.game.lobby).toBe(false);
    expect(h.game.shops).toHaveLength(h.game.config.ROUND.minPlayers);
    expect(h.game.shops.filter((s) => s.controller === 'human')).toHaveLength(LOCAL.length + 2);
    expect(h.game.shops.every((s) => s.look !== null)).toBe(true);
  });

  it('leaves out a phone still setting up when the round begins', () => {
    const { h } = host();
    h.receive({ t: 'joined', phone: PHONE });
    h.begin();
    expect(h.phoneState(h.seats.get(PHONE)!).phase).toBe('waiting');
  });

  it('makes a phone that opens its shop during the round wait, then drops it in at the next lobby', () => {
    const { h, sent } = host();
    h.begin();
    open(h, PHONE, 'Late');
    expect(h.seats.get(PHONE)!.shop).toBeNull();
    h.flush();
    expect(sent[0].states[0][1]).toMatchObject({ phase: 'waiting', label: 'Late' });
    h.replay();
    expect(h.game.lobby).toBe(true);
    expect(shopOf(h, PHONE)).toMatchObject({ label: 'Late', controller: 'human' });
    expect(h.game.shops.every((s) => s.controller === 'human')).toBe(true);
  });

  it('turns phone input into sim input, keeps a quick tap, and acknowledges it', () => {
    const { h, sent } = host();
    open(h, PHONE, 'Joe');
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
    expect(msg.states[0][1]).toMatchObject({ label: 'Joe', ack: 2, phase: 'lobby', tint: `tint-${shop.look!.hue}` });
    // Nothing changed, nothing sent
    h.flush();
    expect(sent).toHaveLength(1);
  });

  it('gives a reconnecting phone its own shop back, even mid-round', () => {
    const { h } = host();
    open(h, PHONE);
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
    open(h, PHONE);
    h.receive({ t: 'left', phone: PHONE });
    h.begin();
    expect(shopOf(h, PHONE)?.controller).toBe('human');
  });

  it('lays out a new street with every connected phone that opened its shop, and none that left', () => {
    const { h } = host();
    open(h, PHONE);
    open(h, OTHER);
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
    open(h, PHONE);
    h.begin();
    let seq = 0;
    while (!h.game.over) {
      if (Math.round(h.game.t / TICK) % 20 === 0) h.receive({ t: 'input', phone: PHONE, seq: ++seq, dir: 1 });
      step(h.game, h.inputs(), TICK);
    }
    expect(h.phoneState(h.seats.get(PHONE)!).phase).toBe('results');
  });
});

describe('names', () => {
  it('drop control characters and extra spaces', () => {
    expect(cleanName('  Big\t\tBrew\u0007  Co ')).toBe('Big Brew Co');
  });
});
