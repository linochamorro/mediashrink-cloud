export type Theme = 'light' | 'dark';
const KEY = 'mediashrink-theme';

export function readTheme(): Theme {
  return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light';
}

export function saveTheme(theme: Theme): void {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, theme);
}
