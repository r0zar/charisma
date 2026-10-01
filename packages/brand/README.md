# @repo/brand

The Charisma brand in one package: design tokens for both themes, the fonts, the logos and the favicon set. Every Charisma app should take its colours, type and marks from here, not from its own copies.

- **Dark · RPG** (default): black and crimson, glass and glow.
- **Light · Bitcoin**: paper, black chrome and Stacks orange.
- Full guidelines: the Charisma design system (`tokens.json` is the same file it uses).

## Use it in an app (Next.js + Tailwind v4)

```jsonc
// package.json
"dependencies": { "@repo/brand": "workspace:*" }
```

```css
/* app/globals.css */
@import "tailwindcss";
@import "@repo/brand/tokens.css";   /* CSS variables for both themes */
@import "@repo/brand/fonts.css";    /* Ysabeau Infant + DM Mono */
@import "@repo/brand/theme.css";    /* utilities: bg-surface, text-ink-muted, bg-accent, text-blaze… */
@import "@repo/brand/shadcn.css";   /* only if the app uses shadcn/ui */
@import "@repo/brand/components.css"; /* optional: cx- component classes for marketing pages */
```

```tsx
// app/layout.tsx: no data-theme, so the site follows the device until the visitor picks
import { THEME_SCRIPT, ThemeToggle } from '@repo/brand/react';

<html lang="en" suppressHydrationWarning>
  <head><script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} /></head>
  …<ThemeToggle /> in the header: System → Light → Dark
```

```ts
// next.config.ts
transpilePackages: ['@repo/brand'],
```

- **Themes:** with no `data-theme`, tokens follow `prefers-color-scheme`. The toggle sets `data-theme="light"` or `"dark"` and remembers it; picking System clears it. Any element with `data-theme` pins its subtree.
- **Radius and spacing** already match Tailwind's scale: `rounded-lg` (8px), `rounded-xl` (12px) and `rounded-2xl` (16px) are `radius-sm`, `radius-md` and `radius-lg`.
- **Logos and favicons:** copy them from `logos/` and `favicons/` into the app's `public/`, or import them as files.

## What's inside

| Path | What |
|---|---|
| `tokens.json` | The source: 38 colours × 2 themes, type, spacing, radius, shadows |
| `tokens.css` | Generated from `tokens.json`. Never edit it by hand |
| `theme.css` | Tailwind v4 `@theme` mapping, one utility colour per token |
| `shadcn.css` | shadcn/ui names (`primary`, `card`, `border`, `ring`…) mapped to the tokens |
| `fonts.css`, `fonts/` | Ysabeau Infant (variable, plus italic) and DM Mono 400/500, as woff2, with OFL licences |
| `components/components.css` | The `cx-` component classes: static renditions of the real app widgets, for marketing pages and docs |
| `components/specimens.json` | The 20 component specimens (markup + guidelines), rendered by brand.charisma.rocks |
| `logos/` | The smooth crest (`charisma-mark.png`) and the pixel crests, for game moments only |
| `react/` | `ThemeToggle` (System → Light → Dark) and `THEME_SCRIPT`, the pre-paint script that applies a saved pick |
| `favicons/` | favicon.ico, 16/32 px, apple-touch, android 192/512, `site.webmanifest` |

## Changing a token

1. Edit `tokens.json`. Keep both theme values, and keep text contrast at 4.5:1 or higher.
2. Run `pnpm --filter @repo/brand generate`.
3. Commit `tokens.json` and `tokens.css` together, and update the design system with the same file.

There is no vector logo yet. When an SVG of the crest exists, add it to `logos/` and prefer it everywhere.
