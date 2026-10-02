// Generates tokens.css from tokens.json (the Charisma design system's token file).
// Run: pnpm --filter @repo/brand generate
//
// Theme rules:
// - No data-theme on <html> means follow the device (prefers-color-scheme).
// - data-theme="light" or "dark" (the visitor's pick, or a pinned subtree) wins over the device.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tokens = JSON.parse(readFileSync(join(root, 'tokens.json'), 'utf8'));
const themes = tokens.color.themes.map(t => t.id);
for (const required of ['dark', 'light']) {
  if (!themes.includes(required)) throw new Error(`tokens.json needs a "${required}" theme for the system toggle`);
}

const resolve = (value, theme) => {
  const v = typeof value === 'string' ? value : (value[theme] ?? value[themes[0]]);
  if (v === undefined) throw new Error(`Token value missing for theme "${theme}"`);
  return v.replace(/^\{(.+)\}$/, 'var(--$1)'); // {alias} → var(--alias)
};
// Font families are tokens too: a string is the same in both realms, a { dark, light } object is per realm.
const families = Object.entries(tokens.type.families).map(([key, value]) => ({ name: `font-${key}`, value }));
const themed = [...tokens.color.tokens, ...tokens.shadow.tokens, ...families.filter(f => typeof f.value !== 'string')];
const body = (theme, indent = '  ') =>
  [
    `${indent}color-scheme: ${theme};`,
    `${indent}font-family: var(--font-sans);`, // re-applied on a pinned subtree so it takes its realm's voice
    `${indent}font-synthesis-weight: ${resolve(tokens.type.weightSynthesis, theme)};`,
    ...themed.map(t => `${indent}--${t.name}: ${resolve(t.value, theme)};`),
  ].join('\n');

const fixed = [...tokens.spacing.tokens, ...tokens.radius.tokens].map(t => `  --${t.name}: ${t.value};`);
const fonts = families.filter(f => typeof f.value === 'string').map(f => `  --${f.name}: ${f.value};`);

const css = `/* GENERATED from tokens.json by scripts/build-css.mjs. Do not edit by hand. */
/* No data-theme on <html>: follow the device. data-theme="light" | "dark": the visitor's pick (or a pinned subtree). */

:root,
[data-theme="dark"] {
${body('dark')}
}

@media (prefers-color-scheme: light) {
  :root:not([data-theme]) {
${body('light', '    ')}
  }
}

[data-theme="light"] {
${body('light')}
}

/* Realm-only wrappers: show their contents in one realm. display: contents keeps the children's own layout. */
.cx-dark-only { display: contents; }
.cx-light-only { display: none; }
@media (prefers-color-scheme: light) {
  :root:not([data-theme]) .cx-dark-only { display: none; }
  :root:not([data-theme]) .cx-light-only { display: contents; }
}
[data-theme="light"] .cx-dark-only { display: none; }
[data-theme="light"] .cx-light-only { display: contents; }
[data-theme="dark"] .cx-dark-only { display: contents; }
[data-theme="dark"] .cx-light-only { display: none; }

:root {
${[...fixed, ...fonts].join('\n')}
}
`;

writeFileSync(join(root, 'tokens.css'), css);
console.log(`tokens.css: ${themed.length} themed tokens, system default + light/dark overrides, ${fixed.length} scale tokens`);
