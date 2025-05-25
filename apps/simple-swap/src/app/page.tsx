import React from 'react';
import { ArrowRight, Sparkles, RefreshCw, Shield, Coins, Layers, Wallet } from 'lucide-react';
import { listTokens, getQuote } from "./actions";
import { Header } from "../components/layout/header";
import Link from 'next/link';
import CharismaQuote from "../components/charisma-quote";

export default async function SwapHomePage() {
  // Prefetch tokens on the server
  const { success, tokens = [] } = await listTokens();

  console.log(tokens);

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
    <div className="relative flex flex-col min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative pb-16 pt-8 md:pt-16 overflow-hidden">
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 text-sm rounded-full border border-border bg-muted/50 text-foreground/80 gap-x-2">
              <Coins className="h-3.5 w-3.5 text-primary" />
              <span>Fast and secure token swaps</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Swap tokens with
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70 ml-2 inline-block">
                confidence
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
              Exchange tokens on Stacks with competitive rates and minimal fees.
              Just connect your wallet and start trading.
            </p>

            {/* Buy CHARISMA Button and Price Quote */}
            <div className="mt-8 mb-12 flex flex-col items-center">
              <a href="/swap?fromSymbol=STX&toSymbol=CHA&amount=1" className="inline-flex items-center justify-center rounded-md h-11 px-8 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 text-white font-medium shadow-md">
                Buy CHA Tokens
                <ArrowRight className="h-4 w-4" />
              </a>
              <div className="flex items-center mt-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center">
                  <CharismaQuote />
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gradient-to-br from-secondary/5 to-primary/1">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Why use our exchange?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We provide a seamless trading experience with advanced features and security
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Coins className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Best Exchange Rates</h3>
              <p className="text-muted-foreground">
                Get competitive rates with our optimized routing algorithm that finds the best prices across liquidity pools.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure Transactions</h3>
              <p className="text-muted-foreground">Each vault is an <strong>isolated Clarity contract</strong>. A flaw in one pool can't affect funds from another.</p>
            </div>

            {/* Feature 3 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Wallet Integration</h3>
              <p className="text-muted-foreground">
                Seamlessly connect with your Stacks wallet for a smooth trading experience without sharing private keys.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Unified LP Interface</h3>
              <p className="text-muted-foreground">Every pool follows the open <strong>Liquidity-Pool SIP</strong>, so new AMMs are supported automatically &mdash; no custom adapters.</p>
            </div>

            {/* Feature 5 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <RefreshCw className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Best-Path Routing</h3>
              <p className="text-muted-foreground">Our router simulates up to 9-hop paths across all pools to secure the best possible output for your swap.</p>
            </div>

            {/* Feature 6 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Zero Protocol Fees</h3>
              <p className="text-muted-foreground">
                All trading fees go back to the community, so you can swap with confidence knowing that you're supporting the network.
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
              Ready to start trading?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Connect your wallet and swap tokens with just a few clicks.
              <br />
              No registration required.
            </p>

            <a href="/swap">
              <button className="inline-flex items-center justify-center rounded-md text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background h-11 px-8 gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300 text-white">
                Start Swapping
                <ArrowRight className="h-4 w-4" />
              </button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
