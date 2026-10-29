import { PartySocket } from 'partysocket';
import { NET } from './config.ts';
import { parseToPhone, parseToScreen, type PhoneMsg, type Refused, type Role, type ScreenMsg, type ToPhone, type ToScreen } from './protocol.ts';

/** A link to a room through the relay. PartySocket reconnects on its own; onStatus reports each change. */
export interface Link<Out> {
  send(msg: Out): void;
  close(): void;
}

interface LinkOptions<In> {
  // The relay's host:port (ws:// for localhost and LAN addresses, wss:// otherwise)
  host: string;
  room: string;
  id: string;
  // Every message but a refusal, which ends the link and goes to onRefused
  onMessage: (msg: In) => void;
  onStatus: (online: boolean) => void;
  // Called when the relay refuses the connection for good (a close code, e.g. the room is taken)
  onRefused?: (code: number) => void;
}

// Close codes at or above this are the relay's refusals (see CLOSE): retrying won't help
const REFUSAL_CODES = 4000;

function connect<In extends { t: string }, Out>(role: Role, opts: LinkOptions<In>, parse: (raw: unknown) => In | null, query: Record<string, string> = {}): Link<Out> {
  const socket = new PartySocket({ host: opts.host, party: NET.party, room: opts.room, id: opts.id, query: { role, ...query } });
  let refused = false;
  // The relay says so in a message before closing, since a close code isn't always delivered (hibernating sockets)
  const refuse = (code: number) => {
    if (refused) return;
    refused = true;
    socket.close();
    opts.onStatus(false);
    opts.onRefused?.(code);
  };
  socket.addEventListener('open', () => opts.onStatus(true));
  socket.addEventListener('close', (e) => {
    if (e.code >= REFUSAL_CODES) refuse(e.code);
    else if (!refused) opts.onStatus(false);
  });
  socket.addEventListener('message', (e) => {
    const msg = parse(e.data);
    if (!msg) return;
    if (msg.t === 'refused') refuse((msg as unknown as Refused).code);
    else opts.onMessage(msg);
  });
  return {
    send: (msg) => {
      // PartySocket queues sends while reconnecting; a stale input is worse than a lost one, so skip them instead
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(msg));
    },
    close: () => socket.close(),
  };
}

/** The big screen: the room's host. key proves it is the screen that opened the room. */
export function connectScreen(opts: LinkOptions<ToScreen> & { key: string }): Link<ScreenMsg> {
  return connect<ToScreen, ScreenMsg>('screen', opts, parseToScreen, { key: opts.key });
}

/** A phone. id is its reconnect token: the same id reclaims the same shop. */
export function connectPhone(opts: LinkOptions<ToPhone>): Link<PhoneMsg> {
  return connect<ToPhone, PhoneMsg>('phone', opts, parseToPhone);
}
