import type { Dir, Look } from '@walking-shops/sim';
import { NET } from './config.ts';

// Messages between phones, the relay and the screen. All JSON. The relay only checks and forwards; the screen is the
// authority. Phone ids are the phones' reconnect tokens: the relay hands them to the screen, never to other phones.

export type Role = 'screen' | 'phone';

export type Phase = 'setup' | 'waiting' | 'lobby' | 'walk-ins' | 'parachutes' | 'results';

/**
 * What a phone shows. setup: the lobby is open and the phone hasn't opened its shop; waiting: the round started
 * without it. look is the phone's shop type and color (assigned before it opens, so the preview shows it), tint the
 * color as CSS. rank is shared on a tie during play; on the results it's the podium's order. ack is the last input seq
 * the sim has read.
 */
export interface PhoneState {
  label: string;
  look: Look;
  tint: string;
  phase: Phase;
  income: number;
  rank: number;
  of: number;
  closed: boolean;
  // The round so far: customers served and towers toppled, for the end card
  served: number;
  topples: number;
  // The round is over, for every phone in the room, with a shop or without
  over: boolean;
  ack: number;
}

/**
 * Phone -> relay: the held direction after each change, numbered so a stale one can be dropped; or the shop's name
 * and type, which opens it (or edits it, in the lobby).
 */
export type PhoneMsg = { t: 'input'; seq: number; dir: Dir } | { t: 'profile'; name: string; design: number };

/** Relay -> client, just before it closes the connection for good (a CLOSE code). Close codes alone don't always arrive. */
export type Refused = { t: 'refused'; code: number };

/** Relay -> screen. roster lists the connected phones when the screen (re)connects. */
export type ToScreen =
  | Refused
  | { t: 'roster'; phones: string[] }
  | { t: 'joined'; phone: string }
  | { t: 'left'; phone: string }
  | { t: 'input'; phone: string; seq: number; dir: Dir }
  | { t: 'profile'; phone: string; name: string; design: number };

/** Screen -> relay: changed phone states, batched into one message. */
export type ScreenMsg = { t: 'states'; states: [phone: string, state: PhoneState][] };

/** Relay -> phone. host says whether a screen is in the room. */
export type ToPhone = Refused | { t: 'state'; state: PhoneState } | { t: 'host'; online: boolean };

// Client ids: generated tokens, not names
const CLIENT_ID = /^[A-Za-z0-9_-]{8,64}$/;
const ROOM_CODE = /^[A-Z0-9]{3,16}$/;
const ROOM_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

export const isClientId = (id: unknown): id is string => typeof id === 'string' && CLIENT_ID.test(id);
export const isRoomCode = (code: unknown): code is string => typeof code === 'string' && ROOM_CODE.test(code);
const isDir = (d: unknown): d is Dir => d === -1 || d === 0 || d === 1;
const isSeq = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const isName = (n: unknown): n is string => typeof n === 'string' && cleanName(n).length > 0 && n.length <= NET.nameMax;
const isLook = (l: unknown): l is Look => isRecord(l) && isSeq(l.design) && isSeq(l.hue);

/** A shop name as it goes on the sign: no control characters, single spaces, trimmed. */
export function cleanName(raw: string): string {
  return raw.replace(/\p{Cc}/gu, ' ').replace(/\s+/g, ' ').trim();
}

// Bytes in a random id (hex, so twice as many characters)
const ID_BYTES = 16;
const HEX = 16;

/** A random client id or key. Uses getRandomValues, which unlike randomUUID works on plain http (phones on the LAN in dev). */
export function randomId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_BYTES));
  return Array.from(bytes, (b) => b.toString(HEX).padStart(2, '0')).join('');
}

/** A room code from letters that can't be mistaken for digits. `random` returns [0, 1). */
export function makeRoomCode(random: () => number): string {
  let code = '';
  for (let i = 0; i < NET.roomCodeLength; i++) code += ROOM_LETTERS[Math.floor(random() * ROOM_LETTERS.length)];
  return code;
}

function json(raw: unknown): unknown {
  if (typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Parse a phone's message strictly: anything else is dropped by the relay. */
export function parsePhoneMsg(raw: unknown): PhoneMsg | null {
  if (typeof raw !== 'string' || raw.length > NET.phoneMsgBytes) return null;
  const m = json(raw);
  if (!isRecord(m)) return null;
  if (m.t === 'input' && isSeq(m.seq) && isDir(m.dir)) return { t: 'input', seq: m.seq, dir: m.dir };
  if (m.t === 'profile' && isName(m.name) && isSeq(m.design)) return { t: 'profile', name: cleanName(m.name), design: m.design };
  return null;
}

function isPhoneState(s: unknown): s is PhoneState {
  return isRecord(s) && typeof s.label === 'string' && isLook(s.look) && typeof s.phase === 'string' && typeof s.income === 'number' && isSeq(s.ack);
}

export function parseScreenMsg(raw: unknown): ScreenMsg | null {
  const m = json(raw);
  if (!isRecord(m) || m.t !== 'states' || !Array.isArray(m.states)) return null;
  const states = m.states.filter((e): e is [string, PhoneState] => Array.isArray(e) && isClientId(e[0]) && isPhoneState(e[1]));
  return { t: 'states', states };
}

export function parseToScreen(raw: unknown): ToScreen | null {
  const m = json(raw);
  if (!isRecord(m)) return null;
  switch (m.t) {
    case 'refused':
      return isSeq(m.code) ? { t: 'refused', code: m.code } : null;
    case 'roster':
      return Array.isArray(m.phones) ? { t: 'roster', phones: m.phones.filter(isClientId) } : null;
    case 'joined':
    case 'left':
      return isClientId(m.phone) ? { t: m.t, phone: m.phone } : null;
    case 'input':
      return isClientId(m.phone) && isSeq(m.seq) && isDir(m.dir) ? { t: 'input', phone: m.phone, seq: m.seq, dir: m.dir } : null;
    case 'profile':
      return isClientId(m.phone) && isName(m.name) && isSeq(m.design) ? { t: 'profile', phone: m.phone, name: cleanName(m.name), design: m.design } : null;
  }
  return null;
}

export function parseToPhone(raw: unknown): ToPhone | null {
  const m = json(raw);
  if (!isRecord(m)) return null;
  if (m.t === 'refused' && isSeq(m.code)) return { t: 'refused', code: m.code };
  if (m.t === 'state' && isPhoneState(m.state)) return { t: 'state', state: m.state };
  if (m.t === 'host' && typeof m.online === 'boolean') return { t: 'host', online: m.online };
  return null;
}
