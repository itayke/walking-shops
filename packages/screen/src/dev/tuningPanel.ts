import { CONFIG, type SectionName } from '@walking-shops/sim';
import { Pane } from 'tweakpane';
import { TUNING_SAVE_ENDPOINT } from './tuningEndpoint.ts';

const TOGGLE_KEY = 't';
const LOBBY_KEY = 'r';
// Sections read only at some point, not every tick: when that is, for the folder's title
const READ_AT: Partial<Record<SectionName, string>> = { STREET: 'on a new street', BOT_MIX: 'on begin' };
// Counts, edited in whole steps
const INTEGER_KEYS = new Set(['minPlayers', 'colsMin', 'colsCap', 'colsExtra', 'sidestep', 'waveWidth', 'waveLines', 'waveSize', 'huntMinHeight', 'firstBlocks', 'secondBlocks', 'thirdBlocks', ...Object.keys(CONFIG.BOT_MIX)]);
const INTEGER_STEP = 1;

/**
 * Live tuning of every sim tunable. Edits the CONFIG sections in place, so the running round picks changes up next
 * tick. In dev, Save writes them back into packages/sim/src/config.ts (which reloads the page with them). `lobby`
 * goes back to the lobby, `newStreet` lays the street out again. Returns a cleanup that removes the panel.
 */
export function createTuningPanel(lobby: () => void, newStreet: () => void): () => void {
  const pane = new Pane({ title: `Tuning (${TOGGLE_KEY.toUpperCase()})`, expanded: false });
  // Out of the audience's sight until called up; it comes back as it was left, folded or open
  pane.hidden = true;
  pane.addButton({ title: `Back to the lobby (${LOBBY_KEY.toUpperCase()})` }).on('click', lobby);
  pane.addButton({ title: 'New street' }).on('click', newStreet);

  for (const name of Object.keys(CONFIG) as SectionName[]) {
    const section = CONFIG[name] as Record<string, number | boolean>;
    const title = READ_AT[name] ? `${name} (${READ_AT[name]})` : name;
    const folder = pane.addFolder({ title, expanded: false });
    for (const key of Object.keys(section)) folder.addBinding(section, key, INTEGER_KEYS.has(key) ? { step: INTEGER_STEP } : {});
  }

  if (import.meta.env.DEV) {
    const save = pane.addButton({ title: 'Save to config.ts' });
    save.on('click', async () => {
      const res = await fetch(TUNING_SAVE_ENDPOINT, { method: 'POST', body: JSON.stringify(CONFIG) });
      // Reload so the round and the panel both use the re-evaluated config module (hot update would split them)
      if (res.ok) location.reload();
      else save.title = `Save failed: ${await res.text()}`;
    });
  }

  const onKey = (e: KeyboardEvent) => {
    // Typing in a field isn't a shortcut
    if (e.target instanceof HTMLInputElement) return;
    const key = e.key.toLowerCase();
    if (key === TOGGLE_KEY) pane.hidden = !pane.hidden;
    if (key === LOBBY_KEY) lobby();
  };
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    pane.dispose();
  };
}
