import { ArrowUpRight, Download } from 'lucide-react';
import Link from 'next/link';
import { SectionTitle } from '@/components/page-intro';
import { Realms, SpecimenHtml } from '@/components/realms';
import { specimen } from '@/lib/tokens';

const swap = specimen('SwapCard');

const DOWNLOADS = [
  { title: 'The crest', note: 'Primary mark · PNG, 500px', href: '/brand/logos/charisma-mark.png', img: '/brand/logos/charisma-mark.png' },
  { title: 'The 8-bit crest', note: 'Game moments only · PNG', href: '/brand/logos/charisma-mark-pixel.png', img: '/brand/logos/charisma-mark-pixel.png', pixel: true },
  { title: 'Favicon set', note: '.ico, 16, 32, 180, 192, 512', href: '/brand/favicons/favicon.ico', img: '/brand/favicons/android-chrome-192x192.png' },
  { title: 'Tokens', note: 'tokens.json · tokens.css', href: '/brand/tokens.json' },
];

const PRINCIPLES = [
  ['One crest, two realms', 'The crimson mark never changes. Everything else is a semantic token that swaps with the theme, so the same markup is right in both.'],
  ['Glass in the dark, ink on paper', 'Dark builds depth from translucent layers and a crimson bloom. Light builds it from hairlines and solid white, with no glow.'],
  ['Numbers are mono', 'Amounts, prices, addresses and stats are set in DM Mono with tabular figures. Words are set in Ysabeau Infant by night and Matter by day.'],
  ['Blaze is teal', 'The instant subnet has one colour everywhere: subnet pills, the flame on a token, the Triggered dot and Blaze Wallet.'],
  ['Plain words, real numbers', 'Say what happens, in the user’s terms, and only show figures read from the chain.'],
];

export default function Overview() {
  return (
    <>
      <section className="relative grid items-center gap-10 py-20 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative z-10">
          <p className="eyebrow">Charisma brand</p>
          <h1 className="mt-4 text-[52px] leading-[54px] sm:text-[72px] sm:leading-[72px] font-black tracking-[-0.02em]">One crest,<br />two realms.</h1>
          <p className="mt-6 max-w-[520px] text-[19px] leading-[30px] text-ink-body">
            Charisma is an open exchange and toolset on Stacks. Every app shares one crest, one type system and one set of components.
            By night it is <b className="text-ink">Dark · RPG</b>, black and crimson. By day it is <b className="text-ink">Light · Bitcoin</b>, paper and Stacks orange.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a className="cx-btn cx-btn-primary cx-btn-lg" href="/brand/logos/charisma-mark.png" download><Download className="size-4" />Download the crest</a>
            <Link className="cx-btn cx-btn-lg" href="/color">See the colours</Link>
          </div>
          <p className="mt-5 text-[14px] text-ink-muted">It follows your device. Use the toggle in the header to pick System, Light or Dark.</p>
        </div>
        <div className="relative flex justify-center">
          <div className="hero-glow absolute inset-[-20%]" aria-hidden />
          <div className="grid-texture absolute inset-0 rounded-[28px] opacity-60" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logos/charisma-mark.png" alt="The Charisma crest" className="relative w-[220px] sm:w-[260px] drop-shadow-[0_24px_48px_rgba(0,0,0,.45)]" />
        </div>
      </section>

      <SectionTitle note="The same swap card, the same markup. Only the realm changes.">The two realms</SectionTitle>
      <Realms><SpecimenHtml html={swap.html} /></Realms>

      <SectionTitle note="Everything here comes straight from @repo/brand, the package every app builds from.">Downloads</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DOWNLOADS.map(d => (
          <a key={d.title} href={d.href} download className="cx-card flex flex-col gap-4 no-underline text-ink hover:border-line-strong transition-colors">
            <div className="flex h-24 items-center justify-center rounded-xl bg-surface-sunken">
              {d.img
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={d.img} alt="" className="h-16 w-16" style={d.pixel ? { imageRendering: 'pixelated' } : undefined} />
                : <span className="mono text-[13px] text-ink-muted">{'{ "color": … }'}</span>}
            </div>
            <div>
              <p className="flex items-center justify-between font-bold">{d.title}<Download className="size-4 text-ink-muted" /></p>
              <p className="text-[13px] text-ink-muted">{d.note}</p>
            </div>
          </a>
        ))}
      </div>

      <SectionTitle>Principles</SectionTitle>
      <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {PRINCIPLES.map(([title, body]) => (
          <div key={title}>
            <h3 className="text-[19px] leading-[24px] font-bold">{title}</h3>
            <p className="mt-2 text-[15px] leading-[22px] text-ink-body">{body}</p>
          </div>
        ))}
        <Link href="/components" className="cx-card flex items-center justify-between no-underline text-ink">
          <span><span className="font-bold">20 components</span><br /><span className="text-[14px] text-ink-muted">Drawn from the live apps</span></span>
          <ArrowUpRight className="size-5 text-accent-text" />
        </Link>
      </div>
    </>
  );
}
