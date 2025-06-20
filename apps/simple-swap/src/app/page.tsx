import React from 'react';
import { ArrowRight, Sparkles, RefreshCw, Shield, Coins, Layers, Wallet, Activity, Twitter, Github, MessageSquare, Mail, ExternalLink } from 'lucide-react';
import { listTokens, getQuote } from "./actions";
import { Header } from "../components/layout/header";
import Link from 'next/link';
import CharismaQuote from "../components/charisma-quote";

export default async function SwapHomePage() {
  // Prefetch tokens on the server
  const { success, tokens = [] } = await listTokens();


  // Get real-time CHARISMA quote server-side
  let charismaExchangeRate: string | null = null;

  const chaContractId = 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token';

  try {
    // Get quote for 1 STX (1000000 microSTX) to CHARISMA
    const quoteResult = await getQuote(
      '.stx',                   // STX contract ID
      chaContractId, // CHARISMA contract ID
      '1000000'                 // 1 STX in micro units
    );

    if (quoteResult.success && quoteResult.data) {
      // Determine decimals from token metadata (default to 6)
      const chaToken = tokens.find(t => t.contractId === chaContractId);
      const decimals = chaToken?.decimals ?? 6;
      const chaAmount = Number(quoteResult.data.amountOut) / 10 ** decimals; // Convert from micro units
      const formatted = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(chaAmount);
      charismaExchangeRate = `1 STX = ${formatted} CHA`;
    }
  } catch (error) {
    console.error("Error fetching CHARISMA quote:", error);
    charismaExchangeRate = null;
  }

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
              <span>Fast and secure token swaps</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight mb-6 text-white/95">
              Swap tokens with
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-orange-500/80 ml-2 inline-block">
                confidence
              </span>
            </h1>

            <p className="text-lg md:text-xl text-white/70 leading-relaxed mb-8 max-w-2xl mx-auto">
              Exchange tokens on Stacks with competitive rates and minimal fees.
              Just connect your wallet and start trading.
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
              Why use our exchange?
            </h2>
            <p className="text-white/70 max-w-2xl mx-auto text-lg">
              We provide a seamless trading experience with advanced features and security
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 - Best Exchange Rates */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center mb-5 group-hover:bg-green-500/30 transition-all duration-200">
                <Coins className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Best Exchange Rates</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                Get competitive rates with our optimized routing algorithm that finds the best prices across liquidity pools.
              </p>
            </div>

            {/* Feature 2 - Secure Transactions */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-5 group-hover:bg-blue-500/30 transition-all duration-200">
                <Shield className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Secure Transactions</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                Each vault is an <span className="text-white/80 font-medium">isolated Clarity contract</span>. A flaw in one pool can't affect funds from another.
              </p>
            </div>

            {/* Feature 3 - Advanced Order Types */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center mb-5 group-hover:bg-purple-500/30 transition-all duration-200">
                <Activity className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Advanced Order Types</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                Execute sophisticated trading strategies with <span className="text-white/80 font-medium">limit orders</span>, DCA, and sandwich trades for maximum control over your positions.
              </p>
            </div>

            {/* Feature 4 - Unified LP Interface */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center mb-5 group-hover:bg-yellow-500/30 transition-all duration-200">
                <Layers className="h-6 w-6 text-yellow-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Unified LP Interface</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                Every pool follows the open <span className="text-white/80 font-medium">Liquidity-Pool SIP</span>, so new AMMs are supported automatically — no custom adapters.
              </p>
            </div>

            {/* Feature 5 - Best-Path Routing */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mb-5 group-hover:bg-orange-500/30 transition-all duration-200">
                <RefreshCw className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Best-Path Routing</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                Our router simulates up to 9-hop paths across all pools to secure the best possible output for your swap.
              </p>
            </div>

            {/* Feature 6 - Zero Protocol Fees */}
            <div className="group bg-white/[0.02] border border-white/[0.06] rounded-xl p-6 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.05] hover:border-white/[0.12] cursor-default">
              <div className="h-12 w-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mb-5 group-hover:bg-red-500/30 transition-all duration-200">
                <Sparkles className="h-6 w-6 text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-white/90 group-hover:text-white/95 transition-all duration-200">Zero Protocol Fees</h3>
              <p className="text-white/60 group-hover:text-white/70 transition-all duration-200 leading-relaxed">
                All trading fees go back to the community, so you can swap with confidence knowing that you're supporting the network.
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
                Ready to start trading?
              </h2>
              <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto leading-relaxed">
                Connect your wallet and swap tokens with just a few clicks.
                <br />
                <span className="text-white/60">No registration required.</span>
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
                  <span>Secure</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400/50" />
                  <span>Fast</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-400/50" />
                  <span>No fees</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Professional Footer */}
      <footer className="relative mt-16 border-t border-white/[0.06]">
        {/* Background glass effect */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/[0.01] to-transparent pointer-events-none" />
        
        <div className="container relative z-10 py-16">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
            {/* Company Info */}
            <div className="lg:col-span-1">
              <Link href="/" className="flex items-center gap-3 group mb-4">
                <div className="h-8 w-8 rounded-xl bg-white/[0.08] border border-white/[0.12] flex items-center justify-center backdrop-blur-sm group-hover:bg-white/[0.12] transition-all duration-200">
                  <Coins className="h-4 w-4 text-white/90" />
                </div>
                <span className="text-white/95 font-semibold tracking-tight">
                  Charisma Swap
                </span>
              </Link>
              <p className="text-white/60 text-sm leading-relaxed mb-6 max-w-xs">
                The next generation DEX for Stacks. Trade tokens with confidence using our advanced routing and security features.
              </p>
              {/* Social Links */}
              <div className="flex items-center gap-3">
                <a 
                  href="https://twitter.com/charisma_btc" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/60 hover:text-white/90 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200 backdrop-blur-sm"
                >
                  <Twitter className="h-4 w-4" />
                </a>
                <a 
                  href="https://github.com/pointblankdev/charisma-web" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/60 hover:text-white/90 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200 backdrop-blur-sm"
                >
                  <Github className="h-4 w-4" />
                </a>
                <a 
                  href="https://discord.gg/charisma" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-white/60 hover:text-white/90 hover:bg-white/[0.08] hover:border-white/[0.12] transition-all duration-200 backdrop-blur-sm"
                >
                  <MessageSquare className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-white/90 font-semibold mb-4">Product</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/swap" className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm">
                    Token Swap
                  </Link>
                </li>
                <li>
                  <Link href="/orders" className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm">
                    Limit Orders
                  </Link>
                </li>
                <li>
                  <Link href="/tokens" className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm">
                    Token Explorer
                  </Link>
                </li>
                <li>
                  <a href="#" className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm flex items-center gap-1">
                    Analytics
                    <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      Soon
                    </span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-white/90 font-semibold mb-4">Resources</h3>
              <ul className="space-y-3">
                <li>
                  <a 
                    href="https://docs.charisma.rocks" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm flex items-center gap-1"
                  >
                    Documentation
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a 
                    href="https://github.com/pointblankdev/charisma-web/blob/main/apps/simple-swap/README.md" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm flex items-center gap-1"
                  >
                    API Guide
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <a 
                    href="https://explorer.hiro.so" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm flex items-center gap-1"
                  >
                    Stacks Explorer
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </li>
                <li>
                  <Link href="#" className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm">
                    Help Center
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company */}
            <div>
              <h3 className="text-white/90 font-semibold mb-4">Company</h3>
              <ul className="space-y-3">
                <li>
                  <Link href="#" className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm">
                    Careers
                  </Link>
                </li>
                <li>
                  <a 
                    href="mailto:hello@charisma.rocks" 
                    className="text-white/60 hover:text-white/90 transition-colors duration-200 text-sm flex items-center gap-1"
                  >
                    <Mail className="h-3 w-3" />
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="mt-12 pt-8 border-t border-white/[0.06]">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="flex flex-col md:flex-row items-center gap-4 text-sm text-white/50">
                <span>© 2024 Charisma. All rights reserved.</span>
                <div className="flex items-center gap-4">
                  <Link href="#" className="hover:text-white/70 transition-colors duration-200">
                    Privacy Policy
                  </Link>
                  <Link href="#" className="hover:text-white/70 transition-colors duration-200">
                    Terms of Service
                  </Link>
                  <Link href="#" className="hover:text-white/70 transition-colors duration-200">
                    Cookie Policy
                  </Link>
                </div>
              </div>
              
              {/* Status Badge */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] backdrop-blur-sm">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-sm text-white/60">All systems operational</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
