import tokens from '@repo/brand/tokens.json';
import specimens from '@repo/brand/specimens.json';

export { tokens, specimens };
export type ColorToken = (typeof tokens.color.tokens)[number];
export type Specimen = (typeof specimens)[number];
export type ThemeId = 'dark' | 'light';
export const THEMES: { id: ThemeId; name: string }[] = [{ id: 'dark', name: 'Dark · RPG' }, { id: 'light', name: 'Light · Bitcoin' }];

const byName = new Map(tokens.color.tokens.map(t => [t.name, t]));

/** A token's value in one theme, with {alias} references followed */
export function colorValue(t: ColorToken, theme: ThemeId): string {
  const v = typeof t.value === 'string' ? t.value : (t.value as Record<ThemeId, string>)[theme];
  const alias = /^\{(.+)\}$/.exec(v);
  if (!alias) return v;
  const target = byName.get(alias[1]);
  if (!target) throw new Error(`Token ${t.name} aliases missing token ${alias[1]}`);
  return colorValue(target, theme);
}

function rgba(hex: string): [number, number, number, number] {
  const h = hex.replace('#', '');
  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(h)) throw new Error(`Not a hex colour: ${hex}`);
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16) / 255;
  return [n(0), n(2), n(4), h.length === 8 ? n(6) : 1];
}
function luminance([r, g, b]: number[]) {
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
/** WCAG contrast of a colour (translucent ones composited) over a theme's bg */
export function contrastOnBg(t: ColorToken, theme: ThemeId): number {
  const bg = rgba(colorValue(byName.get('bg')!, theme));
  const [r, g, b, a] = rgba(colorValue(t, theme));
  const fg = [r * a + bg[0] * (1 - a), g * a + bg[1] * (1 - a), b * a + bg[2] * (1 - a)];
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Color tokens grouped as the system lists them */
export const COLOR_GROUPS: { title: string; note: string; names: string[] }[] = [
  { title: 'Crest', note: 'The mark’s crimson. Identical in both realms, and never used for UI state.', names: ['brand'] },
  { title: 'Grounds and layers', note: 'Dark stacks translucent glass; light stacks white paper on hairlines.', names: ['bg', 'bg-glow', 'texture', 'edge', 'surface-sunken', 'surface', 'surface-hover', 'surface-selected', 'surface-raised', 'overlay'] },
  { title: 'Lines', note: '', names: ['line-soft', 'line', 'line-strong'] },
  { title: 'Ink', note: 'Every ink holds 4.5:1 or more on bg and every surface, except ink-faint (disabled only).', names: ['ink', 'ink-body', 'ink-muted', 'ink-faint'] },
  { title: 'Action', note: 'Crimson by night, Stacks orange by day. One accent fill per view.', names: ['accent', 'accent-hover', 'on-accent', 'accent-text', 'accent-soft', 'accent-line'] },
  { title: 'Chrome', note: 'Header and footer bars stay near-black in both realms.', names: ['chrome', 'on-chrome', 'on-chrome-muted', 'chrome-accent'] },
  { title: 'Blaze', note: 'The instant subnet, and Blaze Wallet. Teal everywhere.', names: ['blaze', 'blaze-soft'] },
  { title: 'Status and reward', note: 'Status always carries a word or icon. Gold is for games only.', names: ['success', 'success-soft', 'danger', 'danger-soft', 'warning', 'warning-soft', 'gold', 'focus'] },
];
export function specimen(name: string): Specimen {
  const s = specimens.find(x => x.name === name);
  if (!s) throw new Error(`Specimen ${name} missing from @repo/brand`);
  return s;
}

export const color = (name: string) => {
  const t = byName.get(name);
  if (!t) throw new Error(`Unknown colour token: ${name}`);
  return t;
};
