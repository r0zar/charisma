import { ArrowRight, BookOpen, Github, Palette, Webhook } from 'lucide-react';
import specimens from '@repo/brand/specimens.json';
import { AppIndex } from '@/components/app-index';
import { StatsStrip } from '@/components/stats-strip';
import { TokenCluster, type Coin } from '@/components/token-cluster';
import { LINKS } from '@/lib/site';

export const revalidate = 900;

const specimen = (name: string) => {
  const s = specimens.find(x => x.name === name);
  if (!s) throw new Error(`Specimen ${name} missing from @repo/brand`);
  return s.html;
};

/** Hero coins. Later entries sit on top; negative delays offset each coin's bob. */
const DARK_COINS: Coin[] = [
  { src: '/tokens/leo.png', label: 'LEO', style: { width: '27%', right: '6%', top: '2%', animationDelay: '-1.1s' } },
  { src: '/tokens/welsh.png', label: 'WELSH', style: { width: '30%', left: '2%', top: '9%', animationDelay: '-2.4s' } },
  { src: '/tokens/shark.png', label: 'SHARK', style: { width: '28%', left: '6%', bottom: '5%', animationDelay: '-3.5s' } },
  { src: '/tokens/pepe.png', label: 'PEPE', style: { width: '30%', right: '1%', bottom: '11%', animationDelay: '-0.6s' } },
  { src: '/tokens/cha.png', label: 'CHA', pixel: true, style: { width: '46%', left: '27%', top: '26%', animationDelay: '0s' } },
];
const LIGHT_COINS: Coin[] = [
  { src: '/tokens/stx.png', label: 'STX', style: { width: '38%', left: '4%', top: '6%', animationDelay: '-1.6s' } },
  { src: '/tokens/usdcx.png', label: 'USDCx', style: { width: '42%', right: '2%', bottom: '6%', animationDelay: '-3.2s' } },
  { src: '/tokens/sbtc.png', label: 'sBTC', style: { width: '54%', left: '23%', top: '22%', animationDelay: '0s' } },
];

const BLAZE_POINTS = [
  ['Sign once', 'Approve an order with one signature. Charisma’s solver executes it when your price hits.'],
  ['Instant and gasless', 'Blaze is a Stacks subnet: transfers settle in a moment and cost you nothing.'],
  ['Orders that run for you', 'Limit, DCA, range and social-trigger orders keep working while you’re away.'],
];

const BUILD = [
  { icon: BookOpen, title: 'Docs', body: 'Guides and API references.', href: LINKS.docs },
  { icon: Webhook, title: 'Open APIs', body: 'Quotes, tokens and transactions.', href: 'https://tokens.charisma.rocks' },
  { icon: Github, title: 'Open source', body: 'One public monorepo.', href: LINKS.github },
  { icon: Palette, title: 'Brand kit', body: 'Crest, colours, type.', href: LINKS.brand },
];

export default function Home() {
  return (
    <main>
      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 pt-20 pb-16 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:pt-28">
          <div className="relative z-10">
            <p className="eyebrow">Open source · Built on Stacks</p>
            <h1 className="mt-5 text-[46px] leading-[48px] sm:text-[64px] sm:leading-[66px] font-black tracking-[-0.02em]">
              Belongs to no one.<br /><span className="text-accent-text">Works for everyone.</span>
            </h1>
            <p className="mt-6 max-w-[560px] text-[19px] leading-[30px] text-ink-body">
              Charisma is a family of open-source apps on Stacks. Swap any token at the best price, earn from liquidity,
              launch your own token, and trade instantly on the Blaze subnet.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a className="cx-btn cx-btn-primary cx-btn-lg" href={LINKS.swap}>Launch Swap<ArrowRight className="size-4" /></a>
              <a className="cx-btn cx-btn-lg" href="#apps">Explore the apps</a>
            </div>
          </div>
          <div className="relative flex justify-center py-6">
            <div className="grid-texture absolute inset-[-10%]" aria-hidden />
            <div className="hero-glow absolute inset-[-25%]" aria-hidden />
            {/* Dark · RPG: the community coins around the 8-bit CHA */}
            <div className="cx-dark-only"><TokenCluster coins={DARK_COINS} /></div>
            {/* Light · Bitcoin: the tokens Charisma trades most */}
            <div className="cx-light-only"><TokenCluster coins={LIGHT_COINS} /></div>
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-8"><StatsStrip /></div>
        <div className="edge-bar" aria-hidden />
      </section>

      {/* spotlight: the flagship, shown with the real swap card */}
      <section className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="eyebrow">Charisma Swap</p>
          <h2 className="mt-3 text-[40px] leading-[46px] font-extrabold tracking-[-0.015em]">Best price,<br />every swap.</h2>
          <p className="mt-5 max-w-[440px] text-[17px] leading-[26px] text-ink-body">Every pool and every route, checked on every trade. Swap from your wallet, or instantly on Blaze.</p>
          <a className="cx-btn cx-btn-primary cx-btn-lg mt-8" href={LINKS.swap}>Launch Swap<ArrowRight className="size-4" /></a>
        </div>
        <div className="flex min-w-0 justify-center lg:justify-end" dangerouslySetInnerHTML={{ __html: specimen('SwapCard') }} />
      </section>

      {/* every app, as an index */}
      <section id="apps" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 pb-24 sm:px-8">
        <h2 className="mb-10 text-[26px] leading-[32px] font-bold">Every Charisma app</h2>
        <AppIndex />
      </section>

      {/* blaze */}
      <section id="blaze" className="scroll-mt-20 border-y border-line bg-surface-sunken">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-24 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">Blaze</p>
            <h2 className="mt-3 text-[40px] leading-[46px] font-extrabold tracking-[-0.015em]">Sign once.<br /><span className="font-[400] italic">It just happens.</span></h2>
            <div className="mt-8 grid gap-6">
              {BLAZE_POINTS.map(([t, b]) => (
                <div key={t} className="flex gap-4">
                  <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-blaze" aria-hidden />
                  <div><p className="text-[17px] font-bold">{t}</p><p className="mt-1 text-[15px] leading-[22px] text-ink-body">{b}</p></div>
                </div>
              ))}
            </div>
            <div className="mt-9 flex flex-wrap gap-3">
              <a className="cx-btn" href={`${LINKS.swap}/orders`}>See your orders</a>
              <a className="cx-btn cx-btn-quiet" href="https://wallet.charisma.rocks">Blaze Wallet<ArrowRight className="size-4" /></a>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <div className="cx-segment self-start" role="group" aria-label="Swap mode">
              <button type="button" aria-pressed="false"><span className="cx-dot" />Instant</button>
              <button type="button" aria-pressed="true"><span className="cx-dot cx-dot-blaze" />Triggered</button>
            </div>
            <div dangerouslySetInnerHTML={{ __html: specimen('StrategyCard') }} />
          </div>
        </div>
      </section>

      {/* build */}
      <section id="build" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-24 sm:px-8">
        <p className="eyebrow">Build with Charisma</p>
        <h2 className="mt-3 max-w-[720px] text-[40px] leading-[46px] font-extrabold tracking-[-0.015em]">Open code, open APIs, open brand.</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BUILD.map(({ icon: Icon, title, body, href }) => (
            <a key={title} href={href} className="cx-card group flex items-center gap-4 no-underline text-ink hover:border-line-strong">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text"><Icon className="size-5" /></span>
              <span className="min-w-0"><span className="block text-[17px] font-bold group-hover:text-accent-text">{title}</span><span className="block text-[14px] text-ink-muted">{body}</span></span>
            </a>
          ))}
        </div>
      </section>

      {/* closing call */}
      <section className="relative overflow-hidden border-t border-line">
        <div className="hero-glow absolute left-1/2 top-0 h-[480px] w-[900px] -translate-x-1/2 -translate-y-1/2" aria-hidden />
        <div className="relative mx-auto flex max-w-[1200px] flex-col items-center px-5 py-24 text-center sm:px-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logos/charisma-mark.png" alt="" className="size-16" />
          <h2 className="mt-6 text-[40px] leading-[46px] font-extrabold tracking-[-0.015em]">Start with a swap.</h2>
          <p className="mt-3 max-w-[480px] text-[17px] leading-[26px] text-ink-body">Connect a Stacks wallet and trade any token at the best price, with zero protocol fees.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a className="cx-btn cx-btn-primary cx-btn-lg" href={LINKS.swap}>Launch Swap<ArrowRight className="size-4" /></a>
            <a className="cx-btn cx-btn-lg" href={LINKS.discord}>Join the Discord</a>
          </div>
        </div>
      </section>
    </main>
  );
}
