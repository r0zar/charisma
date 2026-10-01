import { Download } from 'lucide-react';
import type { Metadata } from 'next';
import { PageIntro, SectionTitle } from '@/components/page-intro';
import { Realms } from '@/components/realms';

export const metadata: Metadata = { title: 'Logo' };

const MARKS = [
  { file: 'charisma-mark.png', title: 'The crest', use: 'The primary mark. Headers, footers, lockups and OG images, on any ground in either realm.' },
  { file: 'charisma-mark-pixel.png', title: '8-bit crest', use: 'Game and RPG moments only: Meme Roulette, the lottery, quests, loading and 404 screens.', pixel: true },
  { file: 'charisma-mark-pixel-square.png', title: '8-bit tile', use: 'Square avatars on game surfaces.', pixel: true },
  { file: 'charisma-glyph-pixel.png', title: 'Pixel glyph', use: 'Decoration only, never the logo.', pixel: true },
];
const CORE = ['Swap', 'Invest', 'Launchpad', 'Docs'];
const ENDORSED = ['Zesty', 'Meme Roulette', 'Blaze Wallet', 'Tokemon'];
const RULES = [
  'Keep clear space of a quarter of the disc’s diameter on every side. The smallest size is 20px (16px as a favicon).',
  'Never recolour, outline, rotate, stretch, add effects to, or crop the disc. In dark, a glow behind it is allowed; a glow on it is not.',
  'Never put the crest on an accent fill, because crimson on crimson disappears. Use it on bg, a surface or the chrome bar.',
  'There is no vector logo yet. Display the 500px PNG at 250 CSS px or smaller, and never trace or redraw it.',
];

export default function LogoPage() {
  return (
    <>
      <PageIntro eyebrow="Logo" title="The crest">A blackletter C inside a crimson disc. It is the one element that looks the same in both realms, and every Charisma app shows it.</PageIntro>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {MARKS.map(m => (
          <div key={m.file} className="cx-card flex flex-col gap-4">
            <div className="grid-texture flex h-40 items-center justify-center rounded-xl bg-surface-sunken">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/brand/logos/${m.file}`} alt={m.title} className="h-24 w-24 object-contain" style={m.pixel ? { imageRendering: 'pixelated' } : undefined} />
            </div>
            <div className="flex-1">
              <p className="font-bold">{m.title}</p>
              <p className="mt-1 text-[14px] leading-[20px] text-ink-muted">{m.use}</p>
            </div>
            <a className="cx-btn" href={`/brand/logos/${m.file}`} download><Download className="size-4" />PNG</a>
          </div>
        ))}
      </div>

      <SectionTitle note="On chrome, the app name uses chrome-accent; on a page ground, accent-text.">App lockups</SectionTitle>
      <Realms>
        <div className="flex flex-col gap-3 p-5">
          {CORE.map(app => (
            <div key={app} className="cx-header rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="cx-lockup"><img src="/brand/logos/charisma-mark.png" alt="" />Charisma <b>{app}</b></span>
            </div>
          ))}
        </div>
      </Realms>

      <SectionTitle note="Products with their own personality keep their name and add “by Charisma” with the crest.">Endorsed products</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {ENDORSED.map(name => (
          <div key={name} className="cx-card">
            <p className="text-[22px] leading-[28px] font-extrabold">{name}</p>
            <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logos/charisma-mark.png" alt="" className="size-4" />by Charisma
            </p>
          </div>
        ))}
      </div>

      <SectionTitle>Rules</SectionTitle>
      <ul className="grid max-w-[760px] gap-3">
        {RULES.map(r => <li key={r} className="cx-card text-[15px] leading-[22px] text-ink-body">{r}</li>)}
      </ul>

      <SectionTitle note="1200×630. The crest at top left, the title in display, one line of lead text.">Open Graph images</SectionTitle>
      <Realms label={false}>
        <div className="relative aspect-[1200/630] overflow-hidden">
          <div className="hero-glow absolute -left-1/4 -top-1/2 h-[140%] w-[90%]" aria-hidden />
          <div className="absolute inset-0 flex flex-col justify-between p-[6%]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logos/charisma-mark.png" alt="" className="w-[11%]" />
            <div>
              <p className="text-[clamp(20px,4vw,40px)] leading-[1.05] font-extrabold tracking-[-0.015em]">The open exchange for Stacks</p>
              <p className="mt-2 text-[clamp(11px,1.6vw,16px)] text-ink-body">22,711 trades · $6.8M in liquidity · 0% protocol fees</p>
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 h-[2%] bg-[var(--edge)]" aria-hidden />
        </div>
      </Realms>
    </>
  );
}
