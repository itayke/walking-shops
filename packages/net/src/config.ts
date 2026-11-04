// Network settings shared by the screen, the phones and the relay. Gameplay numbers stay in the sim config.

export const NET = {
  // The relay's Durable Object binding (Room), kebab-cased by routePartykitRequest
  party: 'room',
  // Seconds between phone state flushes from the screen; only changed states are sent
  stateInterval: 0.1,
  // Relay guards against a misbehaving phone: messages per second and bytes per message beyond these are dropped
  phoneMsgsPerSecond: 40,
  phoneMsgBytes: 200,
  // Longest shop name the relay passes on, in characters; the sign is what really limits a name
  nameMax: 40,
  roomCodeLength: 4,
  // Seconds the screen can be cut off from the relay mid-round before bots take over the phones' shops
  fallbackAfter: 5,
};

// Local dev ports (Vite defaults are taken on this host). The relay's port is also set in packages/server/wrangler.jsonc
export const DEV_PORTS = { screen: 7320, phone: 7321, server: 7322 };

// WebSocket close codes the relay uses (4000–4999 are free for applications)
export const CLOSE = {
  // Another screen holds this room
  roomTaken: 4003,
  // A newer screen took over the room
  replaced: 4001,
  badRequest: 4000,
};
