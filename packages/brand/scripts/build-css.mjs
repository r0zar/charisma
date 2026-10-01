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
const themed = [...tokens.color.tokens, ...tokens.shadow.tokens];
const body = (theme, indent = '  ') =>
  [`${indent}color-scheme: ${theme};`, ...themed.map(t => `${indent}--${t.name}: ${resolve(t.value, theme)};`)].join('\n');

const fixed = [...tokens.spacing.tokens, ...tokens.radius.tokens].map(t => `  --${t.name}: ${t.value};`);
const fonts = Object.entries(tokens.type.families).map(([key, stack]) => `  --font-${key}: ${stack};`);

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

:root {
${[...fixed, ...fonts].join('\n')}
}
`;

writeFileSync(join(root, 'tokens.css'), css);
console.log(`tokens.css: ${themed.length} themed tokens, system default + light/dark overrides, ${fixed.length} scale tokens`);
