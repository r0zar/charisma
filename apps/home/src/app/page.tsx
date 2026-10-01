import { ArrowRight, BookOpen, Github, Palette, Webhook } from 'lucide-react';
import specimens from '@repo/brand/specimens.json';
import { AppCard } from '@/components/app-card';
import { StatsStrip } from '@/components/stats-strip';
import { APP_GROUPS, LINKS } from '@/lib/site';

export const revalidate = 900;

const specimen = (name: string) => {
  const s = specimens.find(x => x.name === name);
  if (!s) throw new Error(`Specimen ${name} missing from @repo/brand`);
  return s.html;
};

const BLAZE_POINTS = [
  ['Sign once', 'Approve an order with one signature. Charisma’s solver executes it when your price hits.'],
  ['Instant and gasless', 'Blaze is a Stacks subnet: transfers settle in a moment and cost you nothing.'],
  ['Orders that run for you', 'Limit, DCA, range and social-trigger orders keep working while you’re away.'],
];

const BUILD = [
  { icon: BookOpen, title: 'Docs', body: 'Guides and API references for the DEX, Blaze and token tools.', href: LINKS.docs, cta: 'Read the docs' },
  { icon: Webhook, title: 'Open APIs', body: 'Quotes, token data, transaction status and network data, free to call.', href: 'https://tokens.charisma.rocks', cta: 'Browse the APIs' },
  { icon: Github, title: 'Open source', body: 'Every app, contract and SDK lives in one public monorepo.', href: LINKS.github, cta: 'View on GitHub' },
  { icon: Palette, title: 'Brand kit', body: 'The crest, the colours, the type and the components, for anyone building with Charisma.', href: LINKS.brand, cta: 'Open the brand kit' },
];

export default function Home() {
  const [trade, ...rest] = APP_GROUPS;
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/logos/charisma-mark.png" alt="The Charisma crest" className="relative w-[200px] sm:w-[280px] drop-shadow-[0_28px_56px_rgba(0,0,0,.5)]" />
          </div>
        </div>
        <div className="mx-auto max-w-[1200px] px-5 pb-20 sm:px-8"><StatsStrip /></div>
        <div className="edge-bar" aria-hidden />
      </section>

      {/* apps */}
      <section id="apps" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-24 sm:px-8">
        <p className="eyebrow">The apps</p>
        <h2 className="mt-3 max-w-[720px] text-[40px] leading-[46px] font-extrabold tracking-[-0.015em]">Every Charisma app, in one place.</h2>
        <div className="mt-12">
          <div className="mb-5 flex items-baseline justify-between gap-4"><h3 className="text-[22px] font-bold">{trade.title}</h3><p className="text-[15px] text-ink-muted">{trade.note}</p></div>
          <div className="grid gap-4 lg:grid-cols-3">{trade.apps.map(a => <AppCard key={a.href} app={a} big />)}</div>
        </div>
        {rest.map(group => (
          <div key={group.title} className="mt-14">
            <div className="mb-5 flex items-baseline justify-between gap-4"><h3 className="text-[22px] font-bold">{group.title}</h3><p className="text-[15px] text-ink-muted">{group.note}</p></div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{group.apps.map(a => <AppCard key={a.href} app={a} />)}</div>
          </div>
        ))}
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
            <div className="[&_.cx-segment:nth-child(n+2)]:hidden" dangerouslySetInnerHTML={{ __html: specimen('ModeToggle') }} />
            <div dangerouslySetInnerHTML={{ __html: specimen('StrategyCard') }} />
          </div>
        </div>
      </section>

      {/* build */}
      <section id="build" className="mx-auto max-w-[1200px] scroll-mt-20 px-5 py-24 sm:px-8">
        <p className="eyebrow">Build with Charisma</p>
        <h2 className="mt-3 max-w-[720px] text-[40px] leading-[46px] font-extrabold tracking-[-0.015em]">Open code, open APIs, open brand.</h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BUILD.map(({ icon: Icon, title, body, href, cta }) => (
            <a key={title} href={href} className="cx-card group flex flex-col gap-3 no-underline text-ink hover:border-line-strong">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text"><Icon className="size-5" /></span>
              <p className="text-[19px] font-bold">{title}</p>
              <p className="flex-1 text-[15px] leading-[22px] text-ink-body">{body}</p>
              <span className="inline-flex items-center gap-1 text-[14px] font-semibold text-accent-text">{cta}<ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
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
