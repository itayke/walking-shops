import { addShop, beginRound, botPlayers, createLobby, isPhase2, toLobby, type Config, type Dir, type GameState, type PlayerSpec } from '@walking-shops/sim';
import { Latch } from './latch.ts';
import type { Phase, PhoneState, ScreenMsg, ToScreen } from './protocol.ts';

// Phone shops are labelled P1, P2, … in join order until the join flow gives them names (Milestone 4)
const PHONE_LABEL = 'P';

/** A phone's place in the session. It keeps its seat (and its shop, this round) across disconnects. */
export interface Seat {
  phone: string;
  label: string;
  // The shop this phone plays, or null when it joined after the lobby closed and waits for the next one
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
  // Shops played on this machine (the keyboard), always in the round
  local: readonly PlayerSpec[];
  seed: () => number;
  // A shop's tint for its phone, by index in game.shops
  tint: (shopIndex: number) => string | null;
  send: (msg: ScreenMsg) => void;
}

/**
 * The screen's side of the room: owns the game, seats phones in shops, turns their messages into sim input and sends
 * each phone its state. Phones get a shop only in the lobby; one that joins during a round waits for the replay. A
 * phone keeps its shop across disconnects. Pure: no DOM, no sockets.
 */
export class Host {
  game: GameState;
  readonly seats = new Map<string, Seat>();
  private readonly opts: HostOptions;
  private joins = 0;

  constructor(opts: HostOptions) {
    this.opts = opts;
    this.game = this.newStreet();
  }

  /** A new street in the lobby: local players and every connected phone drop in again. */
  reset(): GameState {
    this.game = this.newStreet();
    return this.game;
  }

  /** Close the lobby and start the round; bots fill the street up to minPlayers. */
  begin(): void {
    if (!this.game.lobby) return;
    beginRound(this.game, botPlayers(this.opts.config.BOT_MIX));
    for (const s of this.seats.values()) s.latch.clear();
  }

  /** Back to the lobby after (or during) a round: the bots leave, and phones that waited get their shops. */
  replay(): void {
    if (this.game.lobby) return;
    toLobby(this.game);
    for (const s of this.seats.values()) {
      s.latch.clear();
      if (s.online && s.shop === null) s.shop = this.seat(s);
    }
  }

  private newStreet(): GameState {
    const { config, local, seed } = this.opts;
    const g = createLobby(config, seed());
    this.game = g;
    for (const p of local) addShop(g, p);
    for (const s of this.seats.values()) {
      s.latch.clear();
      s.shop = s.online ? this.seat(s) : null;
    }
    return g;
  }

  /** A shop for this phone, if the lobby is open. */
  private seat(seat: Seat): string | null {
    const g = this.game;
    if (!g.lobby) return null;
    if (!g.shops.some((s) => s.id === seat.label)) addShop(g, { id: seat.label, label: seat.label, controller: 'human' });
    return seat.label;
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
        this.join(msg.phone);
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
    }
  }

  private join(phone: string): Seat {
    let seat = this.seats.get(phone);
    if (!seat) {
      seat = { phone, label: `${PHONE_LABEL}${++this.joins}`, shop: null, online: true, latch: new Latch(), seq: 0, ack: 0, sent: '' };
      this.seats.set(phone, seat);
    }
    seat.online = true;
    if (seat.shop === null) seat.shop = this.seat(seat);
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
    const index = seat.shop === null ? -1 : g.shops.findIndex((s) => s.id === seat.shop);
    const shop = index < 0 ? null : g.shops[index];
    const phase: Phase = !shop ? 'waiting' : g.lobby ? 'lobby' : g.over ? 'results' : isPhase2(g) ? 'parachutes' : 'walk-ins';
    return {
      label: seat.label,
      tint: shop ? this.opts.tint(index) : null,
      phase,
      income: shop ? shop.income : 0,
      rank: shop ? 1 + g.shops.filter((s) => s.income > shop.income).length : 0,
      of: g.shops.length,
      closed: shop ? shop.closed : false,
      ack: seat.ack,
    };
  }
}
