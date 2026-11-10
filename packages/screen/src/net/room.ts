import { CLOSE, DEV_PORTS, isRoomCode, makeRoomCode, randomId } from '@walking-shops/net';

// The room this screen hosts, kept per tab: a reload (or a reopened tab) keeps it so phones stay connected, and another
// tab opens a room of its own. ?room=CODE picks one by hand
const STORAGE_KEY = 'walking-shops.room';
// Every room this browser opened, by code, so asking for one by URL in a new tab takes it back
const KEYS_KEY = 'walking-shops.room-keys';
const ROOM_PARAM = 'room';

export interface RoomInfo {
  code: string;
  // Proves to the relay that this screen opened the room
  key: string;
  // Asked for by URL, so losing it to another screen is said out loud rather than swapped for a new room
  asked?: boolean;
}

/** Why this screen lost its room: another tab took it, or the room asked for by URL is someone else's. */
export type RoomLost = 'replaced' | 'taken';

/** The relay's host:port: deployed, the screen's own host (or VITE_PARTY_HOST); in dev, this machine's dev relay. */
export const PARTY_HOST: string =
  import.meta.env.VITE_PARTY_HOST || (import.meta.env.DEV ? `${location.hostname}:${DEV_PORTS.server}` : location.host);

/** Where phones open the controller: deployed, the root of the screen's own site (or VITE_PHONE_URL); in dev, the dev
 * phone app on this machine's LAN address. */
export function joinUrl(code: string): string {
  const base: string =
    import.meta.env.VITE_PHONE_URL || (import.meta.env.DEV ? `http://${import.meta.env.VITE_LAN_HOST}:${DEV_PORTS.phone}` : location.origin);
  return `${base.replace(/\/$/, '')}/?${ROOM_PARAM}=${code}`;
}

function stored(): RoomInfo | null {
  try {
    const info = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null') as RoomInfo | null;
    return info && isRoomCode(info.code) && typeof info.key === 'string' ? info : null;
  } catch {
    return null;
  }
}

function knownKeys(): Record<string, string> {
  try {
    return (JSON.parse(localStorage.getItem(KEYS_KEY) ?? '{}') as Record<string, string>) ?? {};
  } catch {
    return {};
  }
}

function store(info: RoomInfo): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ code: info.code, key: info.key }));
    localStorage.setItem(KEYS_KEY, JSON.stringify({ ...knownKeys(), [info.code]: info.key }));
  } catch {
    // Private mode: the room just won't survive a reload
  }
}

/** This screen's room: from the URL (with its key, if this browser opened it), else this tab's, else a new one. */
export function currentRoom(): RoomInfo {
  const fromUrl = new URLSearchParams(location.search).get(ROOM_PARAM)?.toUpperCase();
  const prev = stored();
  if (fromUrl && isRoomCode(fromUrl)) {
    const key = prev?.code === fromUrl ? prev.key : (knownKeys()[fromUrl] ?? randomId());
    const info = { code: fromUrl, key, asked: true };
    store(info);
    return info;
  }
  return prev ?? newRoom();
}

/** A fresh room code and key, when the old code turns out to be someone else's. */
export function newRoom(): RoomInfo {
  const info = { code: makeRoomCode(Math.random), key: randomId() };
  store(info);
  return info;
}

/** Leave this room for a fresh one: the page reloads on a new code, and phones in the old room stay behind. */
export function moveToNewRoom(): void {
  newRoom();
  const url = new URL(location.href);
  url.searchParams.delete(ROOM_PARAM);
  location.replace(url);
}

export const isRoomTaken = (code: number) => code === CLOSE.roomTaken;
// This room's key was used by a newer screen (another tab), which now has the room
export const isReplaced = (code: number) => code === CLOSE.replaced;
