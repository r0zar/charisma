import React from 'react';
import { ArrowRight, Sparkles, RefreshCw, Shield, Coins, Layers, Activity } from 'lucide-react';
import { Header } from "../components/layout/header";
import { Footer } from "@/components/layout/footer";
import Link from 'next/link';
import CharismaQuote from "../components/charisma-quote";
import { getPlatformStats } from '@/lib/analytics/platform-stats';
import { count, usd } from '@/components/analytics/AnalyticsPage';

// Platform numbers refresh with the Analytics page (every 15 minutes)
export const revalidate = 900;

/** A small live number from Analytics, tucked into a feature card */
function Proof({ children }: { children: React.ReactNode }) {
  return (
    <Link href="/analytics" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface border border-line px-2.5 py-1 text-xs text-ink-muted hover:text-ink hover:border-line-strong transition-colors">
      <span className="w-1.5 h-1.5 rounded-full bg-success" />
      {children}
    </Link>
  );
}

export default async function SwapHomePage() {
  const stats = await getPlatformStats();
  const since = new Date(stats.firstTradeAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="relative flex flex-col min-h-screen bg-bg">
      <Header />

      {/* Hero Section */}
      <section className="relative pb-16 pt-8 md:pt-16 overflow-hidden">
        {/* Background glass effect */}
        
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            {/* Glass morphism badge */}
            <div className="inline-flex items-center justify-center px-4 py-2 mb-8 text-sm rounded-full bg-surface border border-line backdrop-blur-sm text-ink-body gap-x-2 transition-all duration-200 hover:bg-surface-hover hover:border-line-strong hover:text-ink">
              <Coins className="h-3.5 w-3.5 text-accent-text" />
              <span>Open source · Built on Stacks</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 text-ink">
              The open exchange for
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-accent to-accent/80 ml-2 inline-block">
                Stacks
              </span>
            </h1>

            <p className="text-lg md:text-xl text-ink-body leading-relaxed mb-8 max-w-2xl mx-auto">
              Open-source pools and routing that belong to no one and work for everyone.
              Swap from your wallet, or off chain in an instant.
            </p>

            {/* Enhanced Buy CHARISMA Button and Price Quote */}
            <div className="mt-8 mb-12 flex flex-col items-center space-y-4">
              <Link href="/swap?fromSymbol=STX&toSymbol=CHA&amount=1" className="inline-flex items-center justify-center rounded-xl h-12 px-8 gap-2 bg-accent text-on-accent font-semibold transition-all duration-200 hover:bg-accent-hover active:scale-[0.98] shadow-[var(--shadow-cta)]">
                Buy CHA Tokens
                <ArrowRight className="h-4 w-4" />
              </Link>
              
              {/* Price quote with glass effect */}
              <div className="flex items-center px-3 py-1.5 rounded-lg bg-surface-sunken border border-line-soft backdrop-blur-sm text-sm text-ink-muted transition-all duration-200 hover:bg-surface hover:text-ink-body">
                <CharismaQuote />
              </div>
            </div>

            {/* Proof of life: live platform numbers */}
            <Link href="/analytics" className="group mx-auto grid max-w-2xl grid-cols-3 divide-x divide-line-soft rounded-2xl bg-surface border border-line backdrop-blur-sm transition-all duration-200 hover:bg-surface-hover hover:border-line-strong">
              {[
                [count(stats.trades), 'trades'],
                [count(stats.traders), 'traders'],
                [usd(stats.tvlUsd), 'in liquidity'],
              ].map(([value, label]) => (
                <div key={label} className="px-4 py-5">
                  <div className="font-mono text-2xl md:text-3xl font-semibold text-ink">{value}</div>
                  <div className="mt-1 text-xs md:text-sm text-ink-muted">{label}</div>
                </div>
              ))}
            </Link>
            <p className="mt-3 text-xs text-ink-muted">
              Every trade since {since}, straight from the chain · <Link href="/analytics" className="underline underline-offset-4 hover:text-ink-body">See the numbers</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 relative overflow-hidden">
        {/* Background glass effect */}
        
        <div className="container relative z-10">
          {/* Section header with glass morphism */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-ink">
              How it works
            </h2>
            <p className="text-ink-body max-w-2xl mx-auto text-lg">
              Open contracts, open standards, and no one taking a cut
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 - Best Exchange Rates */}
            <div className="group bg-surface border border-line rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-surface-hover hover:border-line-strong cursor-default">
              <div className="h-12 w-12 rounded-xl bg-success/20 border border-success/30 flex items-center justify-center mb-5 group-hover:bg-success/30 transition-all duration-200">
                <Coins className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-ink group-hover:text-ink transition-all duration-200">Best price, every swap</h3>
              <p className="text-ink-muted group-hover:text-ink-body transition-all duration-200 leading-relaxed">
                The router checks every pool and path, and takes the one that gives you the most.
              </p>
              <Proof>{usd(stats.tvlUsd)} across Charisma pools</Proof>
            </div>

            {/* Feature 2 - Secure Transactions */}
            <div className="group bg-surface border border-line rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-surface-hover hover:border-line-strong cursor-default">
              <div className="h-12 w-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center mb-5 group-hover:bg-accent/30 transition-all duration-200">
                <Shield className="h-6 w-6 text-accent-text" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-ink group-hover:text-ink transition-all duration-200">Isolated pools</h3>
              <p className="text-ink-muted group-hover:text-ink-body transition-all duration-200 leading-relaxed">
                Each pool is its own <span className="text-ink-body font-medium">open-source Clarity contract</span>. A flaw in one can't touch funds in another.
              </p>
            </div>

            {/* Feature 3 - Advanced Order Types */}
            <div className="group bg-surface border border-line rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-surface-hover hover:border-line-strong cursor-default">
              <div className="h-12 w-12 rounded-xl bg-blaze/20 border border-blaze/30 flex items-center justify-center mb-5 group-hover:bg-blaze/30 transition-all duration-200">
                <Activity className="h-6 w-6 text-blaze" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-ink group-hover:text-ink transition-all duration-200">Orders that run for you</h3>
              <p className="text-ink-muted group-hover:text-ink-body transition-all duration-200 leading-relaxed">
                <span className="text-ink-body font-medium">Limit orders</span>, DCA, In &amp; Out and range swaps. Sign once, and they carry out on their own, even while you&apos;re away.
              </p>
            </div>

            {/* Feature 4 - Unified LP Interface */}
            <div className="group bg-surface border border-line rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-surface-hover hover:border-line-strong cursor-default">
              <div className="h-12 w-12 rounded-xl bg-warning/20 border border-warning/30 flex items-center justify-center mb-5 group-hover:bg-warning/30 transition-all duration-200">
                <Layers className="h-6 w-6 text-warning" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-ink group-hover:text-ink transition-all duration-200">Open pool standard</h3>
              <p className="text-ink-muted group-hover:text-ink-body transition-all duration-200 leading-relaxed">
                Every pool follows the open <span className="text-ink-body font-medium">Liquidity-Pool SIP</span>, so any AMM that implements it can plug in, no custom code needed.
              </p>
            </div>

            {/* Feature 5 - Best-Path Routing */}
            <div className="group bg-surface border border-line rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-surface-hover hover:border-line-strong cursor-default">
              <div className="h-12 w-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center mb-5 group-hover:bg-accent/30 transition-all duration-200">
                <RefreshCw className="h-6 w-6 text-accent-text" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-ink group-hover:text-ink transition-all duration-200">Multi-hop routing</h3>
              <p className="text-ink-muted group-hover:text-ink-body transition-all duration-200 leading-relaxed">
                A single swap can route through up to 9 pools to reach the best output.
              </p>
              <Proof>{count(stats.trades)} trades routed</Proof>
            </div>

            {/* Feature 6 - Zero Protocol Fees */}
            <div className="group bg-surface border border-line rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-surface-hover hover:border-line-strong cursor-default">
              <div className="h-12 w-12 rounded-xl bg-danger/20 border border-danger/30 flex items-center justify-center mb-5 group-hover:bg-danger/30 transition-all duration-200">
                <Sparkles className="h-6 w-6 text-danger" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-ink group-hover:text-ink transition-all duration-200">Zero protocol fees</h3>
              <p className="text-ink-muted group-hover:text-ink-body transition-all duration-200 leading-relaxed">
                No cut is taken. Swap fees stay in the pools, with the people who provide their liquidity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 relative overflow-hidden mt-auto">
        {/* Enhanced background glass effect */}
        <div className="absolute inset-0 backdrop-blur-[1px] opacity-50" />

        <div className="container relative z-10">
          {/* Glass container for the CTA content */}
          <div className="mx-auto max-w-3xl bg-surface border border-line rounded-2xl p-8 md:p-12 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6 text-ink">
                Start swapping
              </h2>
              <p className="text-lg text-ink-body mb-8 max-w-2xl mx-auto leading-relaxed">
                Join {count(stats.traders)} traders swapping on Charisma.
                <br />
                <span className="text-ink-muted">Connect your wallet. No registration required.</span>
              </p>

              {/* Enhanced CTA button with glass morphism */}
              <Link href="/swap" className="group inline-flex items-center justify-center rounded-xl h-12 px-8 gap-2 bg-accent text-on-accent font-semibold transition-all duration-200 hover:bg-accent-hover active:scale-[0.98] shadow-[var(--shadow-cta)] focus:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
                Start Swapping
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Link>
              
              {/* Subtle feature highlights */}
              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-ink-muted">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-success/50" />
                  <span>Open source</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-accent/50" />
                  <span>Non-custodial</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blaze/50" />
                  <span>No protocol fees</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
