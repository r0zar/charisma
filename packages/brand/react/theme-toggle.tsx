'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { THEME_KEY, type ThemeChoice } from './theme-script';

/** Cycle order: follow the device, then opt into light, then dark */
const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemeChoice, string> = { system: 'System', light: 'Light · Bitcoin', dark: 'Dark · RPG' };
const ICON = { system: Monitor, light: Sun, dark: Moon };

function apply(choice: ThemeChoice) {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  try {
    if (choice === 'system') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch { /* storage blocked: the pick lasts for this visit only */ }
}

/** The header theme toggle: System → Light → Dark → System */
export function ThemeToggle({ className = 'cx-theme-toggle' }: { className?: string }) {
  const [choice, setChoice] = useState<ThemeChoice>('system');

  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setChoice(t === 'light' || t === 'dark' ? t : 'system');
  }, []);

  const next = ORDER[(ORDER.indexOf(choice) + 1) % ORDER.length];
  const Icon = ICON[choice];
  return (
    <button
      type="button"
      className={className}
      onClick={() => { apply(next); setChoice(next); }}
      aria-label={`Theme: ${LABEL[choice]}. Switch to ${LABEL[next]}`}
      title={`Theme: ${LABEL[choice]}`}
    >
      <Icon width={20} height={20} aria-hidden />
    </button>
  );
}
