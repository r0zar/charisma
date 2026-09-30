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
    <Link href="/analytics" className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] px-2.5 py-1 text-xs text-white/60 hover:text-white/90 hover:border-white/[0.15] transition-colors">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
      {children}
    </Link>
  );
}

export default async function SwapHomePage() {
  const stats = await getPlatformStats();
  const since = new Date(stats.firstTradeAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });

  return (
    <div className="relative flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-black to-slate-900">
      <Header />

      {/* Hero Section */}
      <section className="relative pb-16 pt-8 md:pt-16 overflow-hidden">
        {/* Background glass effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
        
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            {/* Glass morphism badge */}
            <div className="inline-flex items-center justify-center px-4 py-2 mb-8 text-sm rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm text-white/70 gap-x-2 transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] hover:text-white/90">
              <Coins className="h-3.5 w-3.5 text-orange-400" />
              <span>Open source · Built on Stacks</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 text-white/95">
              The open exchange for
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-orange-500/80 ml-2 inline-block">
                Stacks
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-8 max-w-2xl mx-auto">
              Open-source pools and routing that belong to no one and work for everyone.
              Swap from your wallet, or off chain in an instant.
            </p>

            {/* Enhanced Buy CHARISMA Button and Price Quote */}
            <div className="mt-8 mb-12 flex flex-col items-center space-y-4">
              <Link href="/swap?fromSymbol=STX&toSymbol=CHA&amount=1" className="inline-flex items-center justify-center rounded-xl h-12 px-8 gap-2 bg-white/[0.1] border border-white/[0.08] backdrop-blur-sm text-white/95 font-medium transition-all duration-200 hover:bg-white/[0.15] hover:border-white/[0.12] hover:text-white shadow-lg shadow-black/20">
                Buy CHA Tokens
                <ArrowRight className="h-4 w-4" />
              </Link>
              
              {/* Price quote with glass effect */}
              <div className="flex items-center px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm text-sm text-white/60 transition-all duration-200 hover:bg-white/[0.03] hover:text-white/70">
                <CharismaQuote />
              </div>
            </div>

            {/* Proof of life: live platform numbers */}
            <Link href="/analytics" className="group mx-auto grid max-w-2xl grid-cols-3 divide-x divide-white/[0.06] rounded-2xl bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.04] hover:border-white/[0.12]">
              {[
                [count(stats.trades), 'trades'],
                [count(stats.traders), 'traders'],
                [usd(stats.tvlUsd), 'in liquidity'],
              ].map(([value, label]) => (
                <div key={label} className="px-4 py-5">
                  <div className="font-mono text-2xl md:text-3xl font-semibold text-white/95">{value}</div>
                  <div className="mt-1 text-xs md:text-sm text-white/50">{label}</div>
                </div>
              ))}
            </Link>
            <p className="mt-3 text-xs text-white/40">
              Every trade since {since}, straight from the chain · <Link href="/analytics" className="underline underline-offset-4 hover:text-white/70">See the numbers</Link>
            </p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 relative overflow-hidden">
        {/* Background glass effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.005] to-transparent pointer-events-none" />
        
        <div className="container relative z-10">
          {/* Section header with glass morphism */}
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4 text-white/95">
              How it works
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto text-lg">
              Open contracts, open standards, and no one taking a cut
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 - Best Exchange Rates */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-5 group-hover:bg-green-500/30 transition-all duration-200">
                <Coins className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Best price, every swap</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                The router checks every pool and path, and takes the one that gives you the most.
              </p>
              <Proof>{usd(stats.tvlUsd)} across Charisma pools</Proof>
            </div>

            {/* Feature 2 - Secure Transactions */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-5 group-hover:bg-blue-500/30 transition-all duration-200">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Isolated pools</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                Each pool is its own <span className="text-white/80 font-medium">open-source Clarity contract</span>. A flaw in one can't touch funds in another.
              </p>
            </div>

            {/* Feature 3 - Advanced Order Types */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-5 group-hover:bg-purple-500/30 transition-all duration-200">
                <Activity className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Orders that run for you</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                <span className="text-white/80 font-medium">Limit orders</span>, DCA, In &amp; Out and range swaps. Sign once, and they carry out on their own, even while you&apos;re away.
              </p>
            </div>

            {/* Feature 4 - Unified LP Interface */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center mb-5 group-hover:bg-yellow-500/30 transition-all duration-200">
                <Layers className="h-6 w-6 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Open pool standard</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                Every pool follows the open <span className="text-white/80 font-medium">Liquidity-Pool SIP</span>, so any AMM that implements it can plug in, no custom code needed.
              </p>
            </div>

            {/* Feature 5 - Best-Path Routing */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-5 group-hover:bg-orange-500/30 transition-all duration-200">
                <RefreshCw className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Multi-hop routing</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                A single swap can route through up to 9 pools to reach the best output.
              </p>
              <Proof>{count(stats.trades)} trades routed</Proof>
            </div>

            {/* Feature 6 - Zero Protocol Fees */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-5 group-hover:bg-red-500/30 transition-all duration-200">
                <Sparkles className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Zero protocol fees</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                No cut is taken. Swap fees stay in the pools, with the people who provide their liquidity.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 relative overflow-hidden mt-auto">
        {/* Enhanced background glass effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] via-transparent to-orange-500/[0.005] pointer-events-none" />
        <div className="absolute inset-0 backdrop-blur-[1px] opacity-50" />

        <div className="container relative z-10">
          {/* Glass container for the CTA content */}
          <div className="mx-auto max-w-3xl bg-white/[0.02] border border-white/[0.06] rounded-2xl p-8 md:p-12 backdrop-blur-sm">
            <div className="text-center">
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6 text-white/95">
                Start swapping
              </h2>
              <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto leading-relaxed">
                Join {count(stats.traders)} traders swapping on Charisma.
                <br />
                <span className="text-white/60">Connect your wallet. No registration required.</span>
              </p>

              {/* Enhanced CTA button with glass morphism */}
              <Link href="/swap" className="group inline-flex items-center justify-center rounded-xl h-12 px-8 gap-2 bg-white/[0.1] border border-white/[0.08] backdrop-blur-sm text-white/95 font-medium transition-all duration-200 hover:bg-white/[0.15] hover:border-white/[0.12] hover:text-white shadow-lg shadow-black/20 focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-transparent">
                Start Swapping
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Link>
              
              {/* Subtle feature highlights */}
              <div className="flex items-center justify-center gap-6 mt-8 text-sm text-white/50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400/50" />
                  <span>Open source</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400/50" />
                  <span>Non-custodial</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400/50" />
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
