// Canvas colors come from the CSS tokens in styles.css, so light and dark themes cover the street and the HUD alike
const TOKENS = [
  'panel',
  'ink',
  'muted',
  'accent',
  'asphalt',
  'curb',
  'sky-top',
  'sky-bot',
  'chute',
  'danger',
  'ok',
  'shutter',
  'shutter-line',
  'awning',
  'shopper',
  'shopper-line',
  'shop-sat',
  'shop-light',
  'font-display',
  'font-data',
] as const;

type Token = (typeof TOKENS)[number];
export type Theme = Record<Token, string>;

export function readTheme(): Theme {
  const css = getComputedStyle(document.documentElement);
  const theme = {} as Theme;
  for (const t of TOKENS) theme[t] = css.getPropertyValue(`--${t}`).trim();
  return theme;
}

/** Calls back when the system switches between light and dark. Returns the unsubscribe. */
export function onThemeChange(cb: () => void): () => void {
  const query = matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', cb);
  return () => query.removeEventListener('change', cb);
}
