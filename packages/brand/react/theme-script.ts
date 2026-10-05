/** localStorage key for the visitor's pick. Absent means "follow the device". */
export const THEME_KEY = 'charisma-theme';

export type ThemeChoice = 'system' | 'light' | 'dark';

/**
 * Inline this in <head> (before first paint). It applies a saved light/dark pick;
 * with no pick, <html> keeps no data-theme and tokens.css follows prefers-color-scheme.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;

/** Apply and remember a pick ('system' forgets it). For pickers beyond the header toggle, e.g. a settings page. */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch { /* storage blocked: the pick lasts for this visit only */ }
}

/** The visitor's current pick, read from <html> (call it after mount) */
export function readTheme(): ThemeChoice {
  const t = document.documentElement.dataset.theme;
  return t === 'light' || t === 'dark' ? t : 'system';
}
