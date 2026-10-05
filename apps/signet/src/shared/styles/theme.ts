/**
 * Blaze Wallet on the Charisma brand (@repo/brand): Dark · RPG by night, Light · Bitcoin by day, following the
 * device until the person picks one. Colors are brand tokens, so each realm fills them in.
 */
import { applyTheme, readTheme, THEME_KEY, type ThemeChoice } from "@repo/brand/react/theme-script"

export { applyTheme, readTheme, type ThemeChoice }

/** Brand colors for inline styles */
export const colors = {
  ink: "var(--ink)",
  inkBody: "var(--ink-body)",
  inkMuted: "var(--ink-muted)",
  accentText: "var(--accent-text)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
}

/** Apply the saved pick before the first paint. Every wallet page shares one origin, so one pick covers them all. */
export function applySavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved
  } catch { /* storage blocked: follow the device */ }
}
