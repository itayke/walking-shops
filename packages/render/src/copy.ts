// Every line of text the players, the audience and the presenter see, in one place. Lines marked "in capitals" are
// set in capitals by the screen's style, whatever their case here. Titles, banners and signs size to fit their text,
// so a much longer line can come out smaller or wrap: check it on the big screen.

export const COPY = {
  // The tab title, and the lobby's (in capitals)
  game: 'Shop Shuffle',

  // Drawn across the street, as written
  street: {
    ready: 'READY?',
    walkIns: 'WALK-INS!',
    parachutes: 'PARACHUTES!',
    topple: 'TOPPLE!',
    blocked: 'BLOCKED',
    closed: 'CLOSED',
  },

  lobby: {
    tagline: 'Get your business moving',
    // In capitals
    begin: 'Begin',
  },

  // Under the phone's shop setup, one line each
  credit: { by: 'A game by Itay Keren', rights: '© 2026 Untame' },

  // The bar along the top of the big screen
  hud: {
    // In capitals
    phase: { lobby: 'Lobby', walkIns: 'Walk-ins', parachutes: 'Parachutes', results: 'Results' },
    phones: (n: number) => `${n} ${n === 1 ? 'phone' : 'phones'}`,
    // In capitals
    botsPlaying: 'bots playing',
    // In capitals: the sound waiting for the presenter's first click, or muted
    sound: { locked: 'click for sound', muted: 'muted' },
    // The presenter's keys, each after its key
    keys: { walk: 'walk', begin: 'begin', pause: 'pause', skip: 'skip', restart: 'restart', bots: 'bots', shops: 'shops', mute: 'mute', tuning: 'tuning', lobby: 'lobby' },
  },

  // The presenter's shop list
  shops: {
    open: (n: number) => `${n} ${n === 1 ? 'shop' : 'shops'} open`,
    ranking: 'Live ranking',
    // Tags, in capitals
    bot: 'bot',
    offline: 'offline',
    pending: (n: number, lobby: boolean) => `${n} ${n === 1 ? 'phone' : 'phones'} ${lobby ? 'setting up…' : 'waiting for the next game'}`,
  },

  // In capitals
  paused: 'Paused',

  results: {
    // In capitals
    wins: (name: string) => `${name} wins!`,
    noWinner: 'Round over',
    // The screen's own shop, when it places below the card
    you: (place: number, money: string) => `You: #${place} with ${money}`,
    // In capitals
    again: 'Play again',
  },

  phone: {
    noRoom: 'Open the link shown on the big screen to join.',
    // The one status line, by what the phone is doing
    connecting: 'Connecting…',
    noScreen: 'Waiting for the big screen',
    joining: 'Joining…',
    setup: 'Set up your shop!',
    waiting: "Game running: you're in the next one!",
    lobby: 'Warm up! Game starting soon...',
    over: 'Game over',
    playing: 'Tap to step · hold to walk',
    closed: 'Shutters down: tap to open',
    // Setting up, or editing, a shop
    editing: 'Edit your shop',
    nextRound: 'Set up now, and it opens next round',
    // Also shown faded on the sign until a name is typed
    namePlaceholder: 'Shop name',
    open: 'Open my shop',
    save: 'Save',
    // In capitals
    cancel: 'Cancel',
    // Over the shop while playing and in the lobby
    place: (place: number, of: number) => `#${place} of ${of}`,
    edit: 'Edit shop',
  },
};
