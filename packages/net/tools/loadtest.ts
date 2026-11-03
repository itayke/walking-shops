// Load test: a headless screen (the real Host and sim) plus N scripted phones, all through the relay.
// Reports how many phones got seated and the input-to-sim latency each phone sees (send -> the screen's ack).
//   npm run loadtest -w @walking-shops/net -- [--phones 50] [--seconds 30] [--host localhost:7322]
import { makeConfig, step, TICK, type Dir } from '@walking-shops/sim';
import { parseArgs } from 'node:util';
import { connectPhone, connectScreen, type Link } from '../src/client.ts';
import { DEV_PORTS, NET } from '../src/config.ts';
import { Host } from '../src/host.ts';
import { makeRoomCode, randomId, type PhoneMsg, type ScreenMsg } from '../src/protocol.ts';

const MS = 1000;
const PERCENT = 100;
// Phone behaviour: a pause, then a tap or a hold in a random direction
const PAUSE_MIN = 0.3;
const PAUSE_SPAN = 1.7;
const TAP_TIME = 0.08;
const HOLD_MIN = 0.4;
const HOLD_SPAN = 1.1;
const TAP_SHARE = 0.6;
// Phones connect over this long, like a room joining
const JOIN_SPREAD = 2;
// Inputs sent in the last moments may not be acked before the end; they don't count as lost
const TAIL_GRACE = 1;
// Seconds for the last phones to get their setup state and open their shops before the round begins
const SETUP_GRACE = 1;
const PERCENTILES = [50, 95, 99];

const { values } = parseArgs({
  options: {
    phones: { type: 'string', default: '50' },
    seconds: { type: 'string', default: '30' },
    host: { type: 'string', default: `localhost:${DEV_PORTS.server}` },
  },
});
const PHONES = Number(values.phones);
const SECONDS = Number(values.seconds);
const HOST = values.host;
const room = makeRoomCode(Math.random);
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * MS));

// The screen: same Host the browser runs, minus the canvas. No keyboard player
let screenLink: Link<ScreenMsg> | null = null;
let screenUp = false;
// Any counts do: nothing is drawn
const LOOKS = { designs: 1, hues: 1 };
const host = new Host({ config: makeConfig(), local: [], seed: () => Math.floor(Math.random() * 2 ** 32), looks: LOOKS, tint: () => '', send: (m) => screenLink?.send(m) });
let received = 0;
screenLink = connectScreen({
  host: HOST,
  room,
  key: randomId(),
  id: randomId(),
  onStatus: (up) => (screenUp = up),
  onMessage: (m) => {
    received++;
    host.receive(m);
  },
  onRefused: (code) => {
    console.error(`Relay refused the screen (close ${code})`);
    process.exit(1);
  },
});
const tick = setInterval(() => {
  if (host.game.over) {
    host.replay();
    host.begin();
  }
  step(host.game, host.inputs(), TICK);
}, TICK * MS);
const flush = setInterval(() => host.flush(), NET.stateInterval * MS);

interface FakePhone {
  link: Link<PhoneMsg>;
  seq: number;
  sentAt: Map<number, number>;
  seated: boolean;
  waiting: boolean;
  drops: number;
  up: boolean;
  named: boolean;
}

const latencies: number[] = [];
let sent = 0;
let lostEarly = 0;
let named = 0;
const end = Date.now() + (JOIN_SPREAD + SECONDS) * MS;

function phone(): FakePhone {
  const p: FakePhone = { link: null!, seq: Date.now(), sentAt: new Map(), seated: false, waiting: false, drops: 0, up: false, named: false };
  const send = (dir: Dir) => {
    if (!p.up) return;
    p.seq++;
    p.sentAt.set(p.seq, performance.now());
    sent++;
    p.link.send({ t: 'input', seq: p.seq, dir });
  };
  p.link = connectPhone({
    host: HOST,
    room,
    id: randomId(),
    onStatus: (up) => {
      if (p.up && !up) p.drops++;
      p.up = up;
    },
    onMessage: (m) => {
      if (m.t !== 'state') return;
      // Opens its shop as soon as it's asked to, like a player who doesn't bother with a name
      if (m.state.phase === 'setup' && !p.named) {
        p.named = true;
        p.link.send({ t: 'profile', name: `Load ${++named}`, design: 0 });
      }
      p.seated = m.state.phase !== 'waiting' && m.state.phase !== 'setup';
      p.waiting = m.state.phase === 'waiting';
      const now = performance.now();
      for (const [seq, at] of p.sentAt) {
        if (seq > m.state.ack) continue;
        latencies.push(now - at);
        p.sentAt.delete(seq);
      }
    },
  });
  void (async () => {
    while (Date.now() < end) {
      await sleep(PAUSE_MIN + Math.random() * PAUSE_SPAN);
      const dir: Dir = Math.random() < 0.5 ? -1 : 1;
      send(dir);
      await sleep(Math.random() < TAP_SHARE ? TAP_TIME : HOLD_MIN + Math.random() * HOLD_SPAN);
      send(0);
    }
  })();
  return p;
}

const percentile = (sorted: number[], q: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((q / PERCENT) * sorted.length))] : NaN);

async function main(): Promise<void> {
  console.log(`Room ${room} on ${HOST}: ${PHONES} phones for ${SECONDS}s`);
  while (!screenUp) await sleep(NET.stateInterval);
  const phones: FakePhone[] = [];
  for (let i = 0; i < PHONES; i++) {
    phones.push(phone());
    await sleep(JOIN_SPREAD / PHONES);
  }
  // Like the presenter starting the round once the room has opened its shops in the lobby
  await sleep(SETUP_GRACE);
  host.begin();
  await sleep(SECONDS + TAIL_GRACE);
  const cutoff = performance.now() - TAIL_GRACE * MS;
  for (const p of phones) for (const at of p.sentAt.values()) if (at < cutoff) lostEarly++;

  const sorted = latencies.sort((a, b) => a - b);
  const online = [...host.seats.values()].filter((s) => s.online).length;
  console.log(`Phones seen by the screen: ${online}/${PHONES} online; seated ${phones.filter((p) => p.seated).length}, waiting ${phones.filter((p) => p.waiting).length}`);
  console.log(`Inputs: ${sent} sent, ${latencies.length} acked, ${lostEarly} never acked; screen received ${received} relay messages`);
  console.log(`Input -> ack latency (includes the ${NET.stateInterval * MS} ms state flush): ${PERCENTILES.map((q) => `p${q} ${percentile(sorted, q).toFixed(0)} ms`).join(', ')}, max ${(sorted.at(-1) ?? NaN).toFixed(0)} ms`);
  console.log(`Reconnects: ${phones.reduce((n, p) => n + p.drops, 0)}`);

  clearInterval(tick);
  clearInterval(flush);
  for (const p of phones) p.link.close();
  screenLink?.close();
  process.exit(lostEarly > 0 ? 1 : 0);
}

void main();
