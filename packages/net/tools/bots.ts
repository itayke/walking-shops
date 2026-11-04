// Bot phones: N fake players join a room the real big screen is hosting, open shops and play at random, so a
// rehearsal with a few real phones still fills the street. No visuals; a status line every few seconds.
//   npm run bots -- --room ABCD [--phones 20] [--host localhost:7322] [--flaky] [--seconds 0]
// Ids come from the room and the bot's number, so running it again reclaims the same shops.
import type { Dir } from '@walking-shops/sim';
import { parseArgs } from 'node:util';
import { connectPhone, type Link } from '../src/client.ts';
import { DEV_PORTS } from '../src/config.ts';
import { isRoomCode, type Phase, type PhoneMsg, type PhoneState } from '../src/protocol.ts';

const MS = 1000;
// Short enough for the sign: two short words at most
const NAMES = [
  "Joe's Pizza", "Bob's Deli", 'Taco Town', 'Nail Bar', 'Bike Fix', 'Book Nook', 'Pet Spa', 'Hot Dogs', 'Bagel Co', 'Fish Fry',
  'Tea Time', 'Gym Rats', 'Vinyl Hut', 'Cafe Ole', 'Shoe Fix', 'Toy Box', 'Sushi Go', 'Dog Wash', 'Key Cut', 'Ink Shop',
  'Wine Bar', 'Bake Shop', 'Hat Rack', 'Yarn Barn', 'Juice Bar', 'Lamp Lab', 'Soap Co', 'Card Shop', 'Fix It', 'Car Wash',
  'Pie Hole', 'Map Shop', 'Gold Fox', 'Tool Shed', 'Plant Co', 'Pho Bowl', 'Gelato', 'Barber', 'Florist', 'Optics',
];
// Phones arrive over this many seconds, and each takes a while to type its name
const JOIN_SPREAD = 10;
const TYPE_MIN = 2;
const TYPE_SPAN = 6;
// Share of phones that edit their shop once in the lobby, after this long
const EDIT_SHARE = 0.15;
const EDIT_AFTER = 5;
// Playing: a pause, then a tap or a hold in a random direction
const PAUSE_MIN = 0.2;
const PAUSE_SPAN = 1.5;
const TAP_TIME = 0.08;
const HOLD_MIN = 0.4;
const HOLD_SPAN = 1.6;
const TAP_SHARE = 0.6;
// Now and then a phone looks away long enough for its shutters to come down
const AFK_CHANCE = 0.02;
const AFK_MIN = 14;
const AFK_SPAN = 10;
// --flaky: each phone drops about this often (seconds, on average) and comes back after a short while
const DROP_EVERY = 60;
const DROP_MIN = 2;
const DROP_SPAN = 6;
const REPORT_EVERY = 5;
const PLAYING: Phase[] = ['lobby', 'walk-ins', 'parachutes'];

const { values } = parseArgs({
  options: {
    room: { type: 'string' },
    phones: { type: 'string', default: '20' },
    host: { type: 'string', default: `localhost:${DEV_PORTS.server}` },
    flaky: { type: 'boolean', default: false },
    // 0 runs until Ctrl-C
    seconds: { type: 'string', default: '0' },
  },
});
const ROOM = values.room?.toUpperCase() ?? '';
if (!isRoomCode(ROOM)) {
  console.error('Pass the room code the big screen shows: npm run bots -- --room ABCD');
  process.exit(1);
}
const PHONES = Number(values.phones);
const HOST = values.host;
const sleep = (s: number) => new Promise((r) => setTimeout(r, s * MS));
const pick = <T>(list: T[]) => list[Math.floor(Math.random() * list.length)];

interface Bot {
  n: number;
  link: Link<PhoneMsg> | null;
  up: boolean;
  state: PhoneState | null;
  // Typing a name: asked to set up and not done yet
  typing: boolean;
  edited: boolean;
  drops: number;
  seq: number;
}

const bots: Bot[] = [];
let stopping = false;
let reporter: ReturnType<typeof setInterval> | undefined;
const names = [...NAMES].sort(() => Math.random() - 0.5);
const nameOf = (n: number) => names[n % names.length] ?? `Shop ${n + 1}`;

function connect(b: Bot): void {
  b.link = connectPhone({
    host: HOST,
    room: ROOM,
    id: `bot-${ROOM}-${b.n}`,
    onStatus: (up) => (b.up = up),
    onRefused: (code) => console.error(`Bot ${b.n + 1} refused (close ${code})`),
    onMessage: (m) => {
      if (m.t !== 'state') return;
      b.state = m.state;
      // Asked for a shop: on joining, after the presenter took it off the street, or joining mid-round for the next one
      const asked = m.state.phase === 'setup' || (m.state.phase === 'waiting' && !m.state.label);
      if (asked && !b.typing) {
        b.typing = true;
        void setUp(b, m.state.look.design);
      }
    },
  });
}

/** Types a name for a while, then opens the shop in the type the screen picked; some edit it once in the lobby. */
async function setUp(b: Bot, design: number): Promise<void> {
  await sleep(TYPE_MIN + Math.random() * TYPE_SPAN);
  b.link?.send({ t: 'profile', name: nameOf(b.n), design });
  b.typing = false;
  if (b.edited || Math.random() >= EDIT_SHARE) return;
  b.edited = true;
  await sleep(EDIT_AFTER);
  if (b.state?.phase === 'lobby') b.link?.send({ t: 'profile', name: pick(NAMES), design });
}

/** Taps and holds at random while there's a street to play on; sometimes wanders off. */
async function play(b: Bot): Promise<void> {
  const send = (dir: Dir) => b.up && b.link?.send({ t: 'input', seq: ++b.seq, dir });
  while (!stopping) {
    await sleep(PAUSE_MIN + Math.random() * PAUSE_SPAN);
    if (!b.state || !PLAYING.includes(b.state.phase)) continue;
    if (Math.random() < AFK_CHANCE) {
      await sleep(AFK_MIN + Math.random() * AFK_SPAN);
      continue;
    }
    send(Math.random() < 0.5 ? -1 : 1);
    await sleep(Math.random() < TAP_SHARE ? TAP_TIME : HOLD_MIN + Math.random() * HOLD_SPAN);
    send(0);
  }
}

/** --flaky: drops the connection now and then and comes back with the same id, like a phone losing signal. */
async function flake(b: Bot): Promise<void> {
  while (!stopping) {
    await sleep(-Math.log(1 - Math.random()) * DROP_EVERY);
    if (stopping) return;
    b.link?.close();
    b.drops++;
    await sleep(DROP_MIN + Math.random() * DROP_SPAN);
    if (!stopping) connect(b);
  }
}

function report(): void {
  const count = new Map<string, number>();
  for (const b of bots) {
    const key = !b.up ? 'offline' : (b.state?.phase ?? 'joining');
    count.set(key, (count.get(key) ?? 0) + 1);
  }
  const closed = bots.filter((b) => b.up && b.state?.closed).length;
  const drops = bots.reduce((n, b) => n + b.drops, 0);
  const parts = [...count].map(([k, v]) => `${v} ${k}`);
  if (closed) parts.push(`${closed} closed`);
  if (values.flaky) parts.push(`${drops} drops`);
  console.log(`${new Date().toLocaleTimeString()}  ${parts.join(' · ')}`);
}

function stop(): void {
  if (stopping) return;
  stopping = true;
  clearInterval(reporter);
  for (const b of bots) b.link?.close();
  console.log('Bots left the room; their shops stay on the street as offline until removed or reclaimed.');
  // Lets the closes go out before exiting
  setTimeout(() => process.exit(0), MS);
}

async function main(): Promise<void> {
  console.log(`${PHONES} bot phones joining room ${ROOM} on ${HOST}${values.flaky ? ', flaky' : ''}. Ctrl-C to leave.`);
  process.on('SIGINT', stop);
  const seconds = Number(values.seconds);
  if (seconds > 0) setTimeout(stop, seconds * MS);
  reporter = setInterval(report, REPORT_EVERY * MS);
  for (let n = 0; n < PHONES && !stopping; n++) {
    const b: Bot = { n, link: null, up: false, state: null, typing: false, edited: false, drops: 0, seq: Date.now() };
    bots.push(b);
    connect(b);
    void play(b);
    if (values.flaky) void flake(b);
    await sleep(Math.random() * ((2 * JOIN_SPREAD) / PHONES));
  }
}

void main();
