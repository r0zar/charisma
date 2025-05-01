import React from 'react';
import { ArrowRight, TrendingUp, Zap, ShieldCheck, Layers, HandCoins, Bot } from 'lucide-react';
import Link from 'next/link';

export default function CharismaInvestLandingPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative pb-16 pt-8 md:pt-16 overflow-hidden">
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 text-sm rounded-full border border-border bg-muted/50 text-foreground/80 gap-x-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <span>Stacks Yield Generation & Automation</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Put Your Money to Work with
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70 ml-2 inline-block">
                Charisma
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
              The destination on Stacks for earning yield. Explore liquidity pools and leverage automated multi-protocol strategies.
            </p>

            {/* Explore Opportunities Button */}
            <div className="mt-8 mb-12 flex flex-col items-center">
              <Link href="/pools" className="inline-flex items-center justify-center rounded-md h-11 px-8 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 text-white font-medium shadow-md">
                Explore Yield Opportunities
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gradient-to-br from-secondary/5 to-primary/1">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Maximize Your Stacks Yield
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Charisma Invest offers powerful tools and strategies for every investor.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1: Diverse Yield Pools */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <HandCoins className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Diverse Yield Pools</h3>
              <p className="text-muted-foreground">
                Access a wide range of liquidity pools across the Stacks ecosystem to find the best fit for your assets.
              </p>
            </div>

            {/* Feature 2: Automated Strategies */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Automated Strategies</h3>
              <p className="text-muted-foreground">
                Utilize cutting-edge, multi-protocol automation to optimize your yield generation effortlessly. (Coming Soon)
              </p>
            </div>

            {/* Feature 3: Secure & Audited */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <ShieldCheck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure & Battle Tested</h3>
              <p className="text-muted-foreground">
                Invest with confidence. Our platform and the underlying protocols prioritize security and transparency.
              </p>
            </div>

            {/* Feature 4: Manual LP Management */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Direct LP Management</h3>
              <p className="text-muted-foreground">Prefer hands-on control? Easily add or remove liquidity directly into individual pools.</p>
            </div>

            {/* Feature 5: Optimized Execution */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Optimized Execution</h3>
              <p className="text-muted-foreground">Leverage efficient routing and interaction with underlying protocols for better results.</p>
            </div>

            {/* Feature 6: Comprehensive Analytics */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Performance Insights</h3>
              <p className="text-muted-foreground">
                Track your portfolio performance and analyze pool data to make informed investment decisions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 relative overflow-hidden mt-auto">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-muted/1 -z-10"></div>

        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Start Earning Yield Today
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connect your wallet and explore the liquidity pools and strategies available on Charisma Invest.
            </p>

            <Link href="/pools">
              <button className="inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background h-11 px-8 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 text-white">
                Explore Pools & Strategies
                <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
