/** localStorage key for the visitor's pick. Absent means "follow the device". */
export const THEME_KEY = 'charisma-theme';

export type ThemeChoice = 'system' | 'light' | 'dark';

/**
 * Inline this in <head> (before first paint). It applies a saved light/dark pick;
 * with no pick, <html> keeps no data-theme and tokens.css follows prefers-color-scheme.
 */
export const THEME_SCRIPT = `try{var t=localStorage.getItem('${THEME_KEY}');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}`;
