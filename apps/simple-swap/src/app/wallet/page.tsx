import Link from 'next/link';
import { ArrowRight, Clock, Layers, Monitor, PenLine, Plug, ShieldCheck } from 'lucide-react';
import { BLAZE_WALLET_STORE_URL } from './links';

const FEATURES = [
  { icon: Clock, title: 'Sign once, it runs on its own', body: 'Limit orders and scheduled buys are signed ahead of time and run when their price or time arrives.' },
  { icon: Layers, title: 'A whole plan, one approval', body: 'Approve a month of buys with one card that shows how many orders there are, the total they can spend, and that they can only pay you.' },
  { icon: Plug, title: 'Works with any Stacks app', body: 'Speaks the standard Stacks wallet language, so it shows up in every app’s “Connect wallet” list.' },
  { icon: PenLine, title: 'Know exactly what you sign', body: 'Orders in plain words, the tokens a transaction can move, and a loud warning when a site asks for more.' },
  { icon: ShieldCheck, title: 'Your keys stay yours', body: 'Encrypted in your browser and never sent anywhere. It locks itself after 15 idle minutes.' },
  { icon: Monitor, title: 'Light or dark', body: 'Charisma’s Light · Bitcoin and Dark · RPG looks. It follows your device, or pick one.' },
];

export default function BlazeWalletLanding() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-20 px-4 py-14 sm:px-6 sm:py-20">
      <section className="grid items-center gap-12 lg:grid-cols-[1fr_auto]">
        <div className="flex max-w-xl flex-col gap-6">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-accent-text">Chrome extension · Stacks</span>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">Do more on Stacks.</h1>
          <p className="text-lg leading-relaxed text-ink-body sm:text-xl">
            Everything a Stacks wallet does, plus Blaze: sign an order once and it runs on its own when its moment comes,
            settled on-chain and paid only to you.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={BLAZE_WALLET_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 font-semibold text-on-accent shadow-[var(--shadow-cta)] transition-colors hover:bg-accent-hover">
              Add to Chrome <ArrowRight className="h-4 w-4" />
            </a>
            <Link href="/wallet/privacy" className="inline-flex h-12 items-center rounded-xl border border-line bg-surface px-6 font-semibold text-ink transition-colors hover:border-line-strong hover:bg-surface-hover">
              Privacy
            </Link>
          </div>
          <p className="text-sm text-ink-muted">Free · No account · Built by Charisma</p>
        </div>

        <div className="mx-auto w-full max-w-[400px] overflow-hidden rounded-2xl border border-line shadow-[var(--shadow-overlay)] lg:w-[400px]">
          {/* The real wallet, in whichever look the page is in */}
          <span className="cx-light-only">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wallet/tokens-light.png" alt="Blaze Wallet's Tokens tab: a $1.75 wallet holding STX, ALEX, CHA, DEX and MALi" width={400} height={720} className="block h-auto w-full" />
          </span>
          <span className="cx-dark-only">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/wallet/tokens-dark.png" alt="Blaze Wallet's Tokens tab: a $1.75 wallet holding STX, ALEX, CHA, DEX and MALi" width={400} height={720} className="block h-auto w-full" />
          </span>
        </div>
      </section>

      <section className="flex flex-col gap-8">
        <div className="flex max-w-2xl flex-col gap-3">
          <span className="font-mono text-xs font-medium uppercase tracking-[0.14em] text-accent-text">Fast where it can be. On-chain where it counts.</span>
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">More you can do, with your keys still yours</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-text"><Icon className="h-5 w-5" /></span>
              <h3 className="text-lg font-semibold">{title}</h3>
              <p className="leading-relaxed text-ink-body">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-5 rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/wallet/flame.svg" alt="" className="h-14 w-14" />
        <h2 className="text-3xl font-semibold tracking-tight">Get Blaze Wallet</h2>
        <p className="max-w-md text-ink-body">Free in the Chrome Web Store. Bring an existing seed phrase, or make a new one in a minute.</p>
        <a href={BLAZE_WALLET_STORE_URL} target="_blank" rel="noopener noreferrer" className="inline-flex h-12 items-center gap-2 rounded-xl bg-accent px-6 font-semibold text-on-accent shadow-[var(--shadow-cta)] transition-colors hover:bg-accent-hover">
          Add to Chrome <ArrowRight className="h-4 w-4" />
        </a>
      </section>
    </main>
  );
}
