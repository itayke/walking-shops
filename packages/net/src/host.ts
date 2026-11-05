import {
  addShop,
  beginRound,
  botPlayers,
  createLobby,
  isPhase2,
  ranking,
  removeShop,
  setController,
  skipTo,
  toLobby,
  type Config,
  type Controller,
  type Dir,
  type GameState,
  type Look,
  type PlayerSpec,
} from '@walking-shops/sim';
import { Latch } from './latch.ts';
import { NET } from './config.ts';
import { cleanName, type Phase, type PhoneState, type ScreenMsg, type ToScreen } from './protocol.ts';

// Phone shops get ids P1, P2, … in join order; their names are the players' own
const PHONE_ID = 'P';
// A hue already worn by the same shop type counts as this many more shops wearing it, so it's handed out last
const SAME_TYPE_PENALTY = 1000;

/** A phone's place in the session. It keeps its seat, its look and its shop across disconnects. */
export interface Seat {
  phone: string;
  // Its shop's id, fixed for the session
  id: string;
  // The shop's name, once the phone has opened it
  name: string | null;
  // Assigned when the phone first connects, so its preview shows its color; the phone picks the type
  look: Look;
  // Its shop on the street, or null before it opens or while it waits for the next lobby
  shop: string | null;
  online: boolean;
  latch: Latch;
  // Last input received, and the last one the sim has read (sent back to the phone)
  seq: number;
  ack: number;
  // The state last sent, so only changes go out
  sent: string;
}

export interface HostOptions {
  // Held by reference, so tuning applies live; STREET is read for a new street, BOT_MIX when a round begins
  config: Config;
  // Shops played on this machine (the keyboard), always on the street
  local: readonly PlayerSpec[];
  seed: () => number;
  // How many shop types and colors the renderer has, and a look's color for its phone
  looks: { designs: number; hues: number };
  tint: (look: Look) => string;
  send: (msg: ScreenMsg) => void;
}

/**
 * The screen's side of the room: owns the game, seats phones, turns their messages into sim input and sends each
 * phone its state. A phone opens its shop by sending its name and type; that puts it on the street in the lobby, or
 * in the next lobby if a round is under way. Colors are handed out so a repeated one goes to a different shop type.
 * Pure: no DOM, no sockets.
 */
export class Host {
  game: GameState;
  readonly seats = new Map<string, Seat>();
  // Bots play the phones' shops while the round is on (the network-down fallback)
  fallback = false;
  private readonly opts: HostOptions;
  private joins = 0;

  constructor(opts: HostOptions) {
    this.opts = opts;
    this.game = this.newStreet();
  }

  /** A new street in the lobby: local players and every connected phone that opened its shop drop in again. */
  reset(): GameState {
    this.game = this.newStreet();
    return this.game;
  }

  /** Close the lobby and start the round; bots fill the street up to minPlayers. */
  begin(): void {
    const g = this.game;
    if (!g.lobby) return;
    const need = Math.max(0, this.opts.config.ROUND.minPlayers - g.N);
    const bots: PlayerSpec[] = [];
    for (const p of botPlayers(this.opts.config.BOT_MIX).slice(0, need)) bots.push({ ...p, look: this.newLook(bots) });
    beginRound(g, bots);
    for (const s of this.seats.values()) s.latch.clear();
    this.handOver();
  }

  /** The presenter skips ahead: from the walk-ins to the parachutes, from the parachutes to the results. */
  skip(): void {
    const g = this.game;
    const { roundTime, paraStart } = this.opts.config.ROUND;
    skipTo(g, isPhase2(g) ? roundTime : paraStart);
  }

  /** The presenter restarts: a fresh round straight away, shops where they stand, bots filled in again. */
  restart(): void {
    if (this.game.lobby) return;
    this.replay();
    this.begin();
  }

  /** Bots take over every phone's shop for the round, or hand them back to their phones. */
  setFallback(on: boolean): void {
    if (this.fallback === on) return;
    this.fallback = on;
    this.handOver();
  }

  /** Who plays each phone's shop: a bot while the fallback is on and a round is under way, its phone otherwise. */
  private handOver(bots = this.fallback && !this.game.lobby): void {
    const g = this.game;
    // One of each type in the bot mix in turn, so the phones' shops play like the bots around them
    const types: Controller[] = [...new Set(botPlayers(this.opts.config.BOT_MIX).map((p) => p.controller))];
    if (types.length === 0) bots = false;
    let i = 0;
    for (const seat of this.seats.values()) {
      if (seat.shop === null || !g.shops.some((s) => s.id === seat.shop)) continue;
      setController(g, seat.shop, bots ? types[i++ % types.length] : 'human');
    }
  }

  /** Back to the lobby after (or during) a round: the bots leave, and phones that waited get their shops. */
  replay(): void {
    if (this.game.lobby) return;
    // Phones' shops are back in their hands first, or the lobby would clear them out with the bots
    this.handOver(false);
    toLobby(this.game);
    for (const s of this.seats.values()) {
      s.latch.clear();
      if (s.online && s.shop === null) this.open(s);
    }
  }

  private newStreet(): GameState {
    const { config, local, seed } = this.opts;
    const g = createLobby(config, seed());
    this.game = g;
    for (const p of local) addShop(g, { ...p, look: p.look ?? this.newLook() });
    for (const s of this.seats.values()) {
      s.latch.clear();
      s.shop = null;
      if (s.online) this.open(s);
    }
    return g;
  }

  /** The presenter renames a shop in the lobby; a phone's shop keeps the new name. False if the name is blank or too long. */
  rename(id: string, raw: string): boolean {
    const name = cleanName(raw);
    const shop = this.game.shops.find((s) => s.id === id);
    if (!this.game.lobby || !shop || !name || name.length > NET.nameMax) return false;
    shop.label = name;
    const seat = this.seatOf(id);
    if (seat) seat.name = name;
    return true;
  }

  /** The presenter takes a shop off the street in the lobby. Its phone, if any, goes back to setting up. */
  remove(id: string): void {
    if (!this.game.lobby) return;
    removeShop(this.game, id);
    const seat = this.seatOf(id);
    if (!seat) return;
    seat.shop = null;
    seat.name = null;
    seat.latch.clear();
  }

  /** The seat whose shop this is, if a phone's. */
  seatOf(id: string): Seat | undefined {
    for (const s of this.seats.values()) if (s.shop === id) return s;
    return undefined;
  }

  /** Put a phone's shop on the street, if it has a name and the lobby is open. */
  private open(seat: Seat): void {
    const g = this.game;
    if (seat.name === null || !g.lobby) return;
    if (!g.shops.some((s) => s.id === seat.id)) addShop(g, { id: seat.id, label: seat.name, controller: 'human', look: seat.look });
    seat.shop = seat.id;
  }

  /**
   * A color for a new look: the one fewest shops (and phones still setting up) wear, earliest in the list on a tie. With
   * a shop type, a color already worn by that type comes last. `extra` counts looks not on the street yet.
   */
  private newLook(extra: readonly PlayerSpec[] = [], design = this.opts.seed() % this.opts.looks.designs): Look {
    const worn: Look[] = [...this.game.shops.flatMap((s) => (s.look ? [s.look] : [])), ...extra.flatMap((p) => (p.look ? [p.look] : []))];
    for (const s of this.seats.values()) if (s.online && s.shop === null) worn.push(s.look);
    let best = 0;
    let bestScore = Infinity;
    for (let hue = 0; hue < this.opts.looks.hues; hue++) {
      const on = worn.filter((l) => l.hue === hue);
      const score = on.length + (on.some((l) => l.design === design) ? SAME_TYPE_PENALTY : 0);
      if (score < bestScore) {
        best = hue;
        bestScore = score;
      }
    }
    return { design, hue: best };
  }

  receive(msg: ToScreen): void {
    switch (msg.t) {
      case 'roster': {
        const present = new Set(msg.phones);
        for (const s of this.seats.values()) if (!present.has(s.phone)) this.leave(s.phone);
        for (const p of msg.phones) this.join(p);
        break;
      }
      case 'joined':
        // A new connection, often a reload, has none of the phone's state: send it again
        this.join(msg.phone).sent = '';
        break;
      case 'left':
        this.leave(msg.phone);
        break;
      case 'input': {
        // Input can beat its join notice after a reconnect
        const seat = this.join(msg.phone);
        if (msg.seq <= seat.seq) return;
        seat.seq = msg.seq;
        seat.latch.set(msg.dir);
        break;
      }
      case 'profile':
        this.profile(this.join(msg.phone), msg.name, msg.design);
        break;
    }
  }

  /** A phone's name and shop type: opens its shop, or edits it while the lobby is open. */
  private profile(seat: Seat, name: string, design: number): void {
    if (design >= this.opts.looks.designs) return;
    const shop = seat.shop === null ? null : this.game.shops.find((s) => s.id === seat.shop);
    // Once the round is under way a shop on the street keeps its name and type
    if (shop && !this.game.lobby) return;
    seat.name = name;
    if (design !== seat.look.design) {
      // Its own color doesn't count against it
      const hue = seat.look.hue;
      seat.look = { design, hue: -1 };
      const clash = this.game.shops.some((s) => s !== shop && s.look?.hue === hue && s.look.design === design);
      seat.look = clash ? this.newLook([], design) : { design, hue };
    }
    if (shop) {
      shop.label = name;
      shop.look = seat.look;
    } else this.open(seat);
  }

  private join(phone: string): Seat {
    let seat = this.seats.get(phone);
    if (!seat) {
      const look = this.newLook();
      seat = { phone, id: `${PHONE_ID}${++this.joins}`, name: null, look, shop: null, online: true, latch: new Latch(), seq: 0, ack: 0, sent: '' };
      this.seats.set(phone, seat);
    }
    seat.online = true;
    return seat;
  }

  private leave(phone: string): void {
    const seat = this.seats.get(phone);
    if (!seat) return;
    // The shop stays the phone's: idle shutters close it until the phone comes back
    seat.online = false;
    seat.latch.clear();
  }

  /** This tick's direction for every phone's shop. Reading a phone's input acknowledges it. */
  inputs(): Record<string, Dir> {
    const out: Record<string, Dir> = {};
    for (const s of this.seats.values()) {
      if (s.shop === null) continue;
      out[s.shop] = s.latch.read();
      s.ack = s.seq;
    }
    return out;
  }

  /** Send each phone its state if it changed since the last flush. Call a few times a second. */
  flush(): void {
    const states: [string, PhoneState][] = [];
    for (const s of this.seats.values()) {
      if (!s.online) continue;
      const state = this.phoneState(s);
      const key = JSON.stringify(state);
      if (key === s.sent) continue;
      s.sent = key;
      states.push([s.phone, state]);
    }
    if (states.length > 0) this.opts.send({ t: 'states', states });
  }

  phoneState(seat: Seat): PhoneState {
    const g = this.game;
    const shop = seat.shop === null ? null : (g.shops.find((s) => s.id === seat.shop) ?? null);
    const phase: Phase = !shop ? (g.lobby ? 'setup' : 'waiting') : g.lobby ? 'lobby' : g.over ? 'results' : isPhase2(g) ? 'parachutes' : 'walk-ins';
    return {
      label: seat.name ?? '',
      look: seat.look,
      tint: this.opts.tint(seat.look),
      phase,
      income: shop ? shop.income : 0,
      rank: !shop ? 0 : g.over ? ranking(g).indexOf(shop) + 1 : 1 + g.shops.filter((s) => s.income > shop.income).length,
      of: g.shops.length,
      closed: shop ? shop.closed : false,
      served: shop ? shop.served : 0,
      topples: shop ? shop.topples : 0,
      ack: seat.ack,
    };
  }
}
