import { CLOSE, NET, isClientId, isRoomCode, parsePhoneMsg, parseScreenMsg, type Role, type ToPhone, type ToScreen } from '@walking-shops/net';
import { routePartykitRequest, Server, type Connection, type ConnectionContext, type WSMessage } from 'partyserver';

// The relay: one Durable Object per room. It checks and forwards; the big screen runs the game.
// Phones -> screen: joins, leaves and inputs. Screen -> each phone: its state. The first screen to open a room
// claims it with a key, so a phone can't pose as the screen.

const HOST_KEY = 'hostKey';
const MS_PER_SECOND = 1000;

interface ConnState {
  role: Role;
  // Tells two sockets with the same id apart (a phone reconnecting before its old socket closed)
  nonce: string;
}

type Conn = Connection<ConnState>;

export class Room extends Server {
  static options = { hibernate: true };

  // Per-socket message counts for the rate limit; lost on hibernation, which only resets the counts
  private readonly rates = new Map<string, { start: number; count: number }>();

  getConnectionTags(_conn: Connection, ctx: ConnectionContext): string[] {
    return [new URL(ctx.request.url).searchParams.get('role') ?? ''];
  }

  async onConnect(conn: Conn, ctx: ConnectionContext): Promise<void> {
    const params = new URL(ctx.request.url).searchParams;
    const role = params.get('role');
    if (!isRoomCode(this.name) || !isClientId(conn.id) || (role !== 'screen' && role !== 'phone')) {
      this.refuse(conn, CLOSE.badRequest);
      return;
    }
    conn.setState({ role, nonce: crypto.randomUUID() });
    if (role === 'screen') await this.onScreen(conn, params.get('key'));
    else this.onPhone(conn);
  }

  private async onScreen(conn: Conn, key: string | null): Promise<void> {
    if (!isClientId(key)) {
      this.refuse(conn, CLOSE.badRequest);
      return;
    }
    const held = await this.ctx.storage.get<string>(HOST_KEY);
    if (held === undefined) await this.ctx.storage.put(HOST_KEY, key);
    else if (held !== key) {
      this.refuse(conn, CLOSE.roomTaken);
      return;
    }
    // One screen per room: a reloaded screen replaces the old one
    for (const other of this.screens()) if (other.state?.nonce !== conn.state?.nonce) this.refuse(other, CLOSE.replaced);
    const phones = new Set([...this.phones()].map((p) => p.id));
    this.send(conn, { t: 'roster', phones: [...phones] } satisfies ToScreen);
    this.toPhones({ t: 'host', online: true });
  }

  // A phone reconnecting before its old socket closed briefly has two: both get its state, and it only leaves with the last
  private onPhone(conn: Conn): void {
    this.send(conn, { t: 'host', online: this.hasScreen() } satisfies ToPhone);
    this.toScreen({ t: 'joined', phone: conn.id });
  }

  onMessage(conn: Conn, message: WSMessage): void {
    const state = conn.state;
    if (!state) return;
    if (state.role === 'phone') {
      if (!this.allow(state.nonce)) return;
      const msg = parsePhoneMsg(message);
      if (msg?.t === 'input') this.toScreen({ t: 'input', phone: conn.id, seq: msg.seq, dir: msg.dir });
      else if (msg?.t === 'profile') this.toScreen({ t: 'profile', phone: conn.id, name: msg.name, design: msg.design });
      return;
    }
    const msg = parseScreenMsg(message);
    if (!msg) return;
    for (const [phone, phoneState] of msg.states) {
      for (const p of this.getConnections<ConnState>(phone)) if (p.state?.role === 'phone') this.send(p, { t: 'state', state: phoneState } satisfies ToPhone);
    }
  }

  onClose(conn: Conn): void {
    const state = conn.state;
    if (!state) return;
    this.rates.delete(state.nonce);
    if (state.role === 'screen') {
      if (!this.hasScreen()) this.toPhones({ t: 'host', online: false });
      return;
    }
    // Only gone when its last socket is
    const open = [...this.getConnections<ConnState>(conn.id)].some((c) => c.state?.nonce !== state.nonce && c.readyState === WebSocket.OPEN);
    if (!open) this.toScreen({ t: 'left', phone: conn.id });
  }

  /** Fixed-window rate limit per socket. */
  private allow(nonce: string): boolean {
    const now = Date.now();
    const r = this.rates.get(nonce);
    if (!r || now - r.start >= MS_PER_SECOND) {
      this.rates.set(nonce, { start: now, count: 1 });
      return true;
    }
    r.count++;
    return r.count <= NET.phoneMsgsPerSecond;
  }

  /** Tell the client why, then close. Some clients never see a close code from a hibernating socket; they see this. */
  private refuse(conn: Conn, code: number): void {
    this.send(conn, { t: 'refused', code } satisfies ToScreen);
    try {
      conn.close(code);
    } catch {
      // Already closing
    }
  }

  private screens(): Iterable<Conn> {
    return this.getConnections<ConnState>('screen');
  }

  private phones(): Iterable<Conn> {
    return this.getConnections<ConnState>('phone');
  }

  private hasScreen(): boolean {
    for (const s of this.screens()) if (s.readyState === WebSocket.OPEN) return true;
    return false;
  }

  private send(conn: Conn, msg: ToScreen | ToPhone): void {
    try {
      conn.send(JSON.stringify(msg));
    } catch {
      // Closing under us; its onClose handles the rest
    }
  }

  private toScreen(msg: ToScreen): void {
    for (const s of this.screens()) this.send(s, msg);
  }

  private toPhones(msg: ToPhone): void {
    for (const p of this.phones()) this.send(p, msg);
  }
}

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    return (await routePartykitRequest(request, env)) ?? new Response('Not found', { status: 404 });
  },
} satisfies ExportedHandler<Record<string, unknown>>;
