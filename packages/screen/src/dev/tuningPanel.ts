import { CONFIG, type SectionName } from '@walking-shops/sim';
import { Pane } from 'tweakpane';
import { TUNING_SAVE_ENDPOINT } from './tuningEndpoint.ts';

const TOGGLE_KEY = 't';
const RESTART_KEY = 'r';
// Read only when a round starts; every other section applies on the next tick
const RESTART_SECTIONS: readonly SectionName[] = ['STREET', 'BOT_MIX'];
// Counts, edited in whole steps
const INTEGER_KEYS = new Set(['colsMin', 'colsCap', 'colsExtra', 'sidestep', 'waveWidth', 'waveLines', 'waveSize', 'huntMinHeight', ...Object.keys(CONFIG.BOT_MIX)]);
const INTEGER_STEP = 1;

/**
 * Live tuning of every sim tunable. Edits the CONFIG sections in place, so the running round picks changes up next
 * tick. In dev, Save writes them back into packages/sim/src/config.ts (which reloads the page with them). Returns a
 * cleanup that removes the panel.
 */
export function createTuningPanel(restart: () => void): () => void {
  const pane = new Pane({ title: `Tuning (${TOGGLE_KEY.toUpperCase()})`, expanded: false });
  pane.addButton({ title: `Restart round (${RESTART_KEY.toUpperCase()})` }).on('click', restart);

  for (const name of Object.keys(CONFIG) as SectionName[]) {
    const section = CONFIG[name] as Record<string, number | boolean>;
    const title = RESTART_SECTIONS.includes(name) ? `${name} (on restart)` : name;
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
    if (key === TOGGLE_KEY) pane.expanded = !pane.expanded;
    if (key === RESTART_KEY) restart();
  };
  window.addEventListener('keydown', onKey);
  return () => {
    window.removeEventListener('keydown', onKey);
    pane.dispose();
  };
}
