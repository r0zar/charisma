'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { applyTheme, readTheme, type ThemeChoice } from './theme-script';

/** Cycle order: follow the device, then opt into light, then dark */
const ORDER: ThemeChoice[] = ['system', 'light', 'dark'];
const LABEL: Record<ThemeChoice, string> = { system: 'System', light: 'Light · Bitcoin', dark: 'Dark · RPG' };
const ICON = { system: Monitor, light: Sun, dark: Moon };

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
