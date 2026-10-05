/**
 * Blaze Wallet on the Charisma brand (@repo/brand): every color is a brand token, so each realm
 * (Dark · RPG by night, Light · Bitcoin by day) fills it in. The realm knobs (--glow, --shade) and the
 * saved theme pick live in style.css and applySavedTheme.
 */
import { applyTheme, readTheme, THEME_KEY, type ThemeChoice } from "@repo/brand/react/theme-script"

export { applyTheme, readTheme, type ThemeChoice }

export const colors = {
  /** The HUD's tint: crimson by night, Stacks orange by day */
  accent: "var(--hud-accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  /** Text */
  ink: "var(--ink)",
  inkBody: "var(--ink-body)",
  inkMuted: "var(--ink-muted)",
  /** The page behind everything, and the panels on it */
  bg: "var(--bg)",
  surfaceRaised: "var(--surface-raised)",
  /** Header and footer bars: black in both realms */
  chrome: "var(--chrome)",
  onChrome: "var(--on-chrome)",
  onChromeMuted: "var(--on-chrome-muted)",
  chromeAccent: "var(--chrome-accent)",
}

/** A color at the given opacity (0-1) */
export const tint = (color: string, alpha: number) => `color-mix(in srgb, ${color} ${+(alpha * 100).toFixed(1)}%, transparent)`

/** A neon glow color: full strength by night, none by day (Light · Bitcoin is flat) */
export const glow = (color: string, alpha: number) =>
  `color-mix(in srgb, ${color} calc(${+(alpha * 100).toFixed(1)}% * var(--glow)), transparent)`

/** Apply the saved pick before the first paint. Every wallet page shares one origin, so one pick covers them all. */
export function applySavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    if (saved === "light" || saved === "dark") document.documentElement.dataset.theme = saved
  } catch { /* storage blocked: follow the device */ }
}

export const keyframes = {
  slideInUp: `
    @keyframes slideInUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `,
  slideInRight: `
    @keyframes slideInRight {
      from { transform: translateX(20px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `,
  spin: `
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
  `,
  scanLine: `
    @keyframes scanLine {
      0% { transform: translateY(0%); }
      100% { transform: translateY(100%); }
    }
  `,
  shimmer: `
    @keyframes shimmer {
      0% { transform: translateX(-100%); }
      100% { transform: translateX(100%); }
    }
  `,
}
