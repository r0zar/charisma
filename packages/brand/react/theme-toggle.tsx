'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { THEME_KEY, type ThemeChoice } from './theme-script';

/** Cycle order: follow the device, then opt into light, then dark */
const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemeChoice, string> = { system: 'System', light: 'Light · Bitcoin', dark: 'Dark · RPG' };
const ICON = { system: Monitor, light: Sun, dark: Moon };

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

/** The header theme toggle: System → Light → Dark → System */
export function ThemeToggle({ className = 'cx-theme-toggle' }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>('system');

  useEffect(() => setChoice(readTheme()), []);

  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
  const Icon = ICON[choice];
  return (
    <button
      type="button"
      className={className}
      onClick={() => { applyTheme(next); setChoice(next); }}
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[choice]}`}
    >
      <Icon width={20} height={20} aria-hidden />
    </button>
  );
}
