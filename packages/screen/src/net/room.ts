import { CLOSE, DEV_PORTS, isRoomCode, makeRoomCode, randomId } from '@walking-shops/net';

// The room this screen hosts, kept across reloads so phones stay connected. ?room=CODE picks one by hand
const STORAGE_KEY = 'walking-shops.room';
const ROOM_PARAM = 'room';

export interface RoomInfo {
  code: string;
  // Proves to the relay that this screen opened the room
  key: string;
}

/** The relay's host:port: VITE_PARTY_HOST when deployed, else this machine's dev relay. */
export const PARTY_HOST: string = import.meta.env.VITE_PARTY_HOST || `${location.hostname}:${DEV_PORTS.server}`;

/** Where phones open the controller: VITE_PHONE_URL when deployed, else the dev phone app on this machine's LAN address. */
export function joinUrl(code: string): string {
  const base: string = import.meta.env.VITE_PHONE_URL || `http://${import.meta.env.VITE_LAN_HOST}:${DEV_PORTS.phone}`;
  return `${base.replace(/\/$/, '')}/?${ROOM_PARAM}=${code}`;
}

function stored(): RoomInfo | null {
  try {
    const info = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as RoomInfo | null;
    return info && isRoomCode(info.code) && typeof info.key === 'string' ? info : null;
  } catch {
    return null;
  }
}

function store(info: RoomInfo): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(info));
  } catch {
    // Private mode: the room just won't survive a reload
  }
}

/** This screen's room: from the URL, else the one it opened before, else a new one. */
export function currentRoom(): RoomInfo {
  const fromUrl = new URLSearchParams(location.search).get(ROOM_PARAM)?.toUpperCase();
  const prev = stored();
  if (fromUrl && isRoomCode(fromUrl)) {
    const info = { code: fromUrl, key: prev?.code === fromUrl ? prev.key : randomId() };
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

export const isRoomTaken = (code: number) => code === CLOSE.roomTaken;
