import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles, Code, Shield, Database, Layers, GitBranch, Rocket } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative pb-20 pt-12 md:pt-24 overflow-hidden">

        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center justify-center px-4 py-1.5 mb-6 text-sm rounded-full border border-border bg-muted/50 text-foreground/80 gap-x-2">
              <Rocket className="h-3.5 w-3.5 text-primary" />
              <span>Smart contract deployment made simple</span>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
              Deploy smart contracts with
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70 ml-2 inline-block">
                Charisma
              </span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground leading-relaxed mb-8 max-w-2xl mx-auto">
              Launch SIP10 tokens and liquidity pools on Stacks with just a few clicks.
              No coding required, just connect your wallet and choose a template.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link href="/contracts">
                <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300">
                  Launch Your Contract
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/docs">
                <Button size="lg" variant="outline">
                  View Templates
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gradient-to-br from-secondary/5 to-primary/1 -z-10">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
              Smart Contract Templates
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Deploy production-ready contracts without writing a single line of code
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {/* Feature 1 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Code className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">SIP10 Tokens</h3>
              <p className="text-muted-foreground">
                Deploy standard-compliant fungible tokens with customizable supply, name, symbol, and decimals.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Liquidity Pools</h3>
              <p className="text-muted-foreground">
                Launch automated market maker (AMM) pools for your tokens with customizable fees and parameters.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <GitBranch className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Template Customization</h3>
              <p className="text-muted-foreground">
                Choose from different token and pool implementations with various features and security models.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Wallet-Based Deployment</h3>
              <p className="text-muted-foreground">
                Deploy directly from your wallet with secure transaction signing. No need to share your private keys.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Database className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Contract Management</h3>
              <p className="text-muted-foreground">
                Easily track all your deployed contracts in one dashboard with transaction history and status updates.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="bg-background border border-border/50 rounded-xl p-6 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-5">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Metadata Integration</h3>
              <p className="text-muted-foreground">
                Seamlessly connect with Charisma Metadata to add rich token information after deployment.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-muted/1 -z-10"></div>

        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-6">
              Ready to launch your token or liquidity pool?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Deploy secure smart contracts in minutes without writing code.
              <br />
              Connect your wallet to get started.
            </p>

            <Link href="/contracts">
              <Button size="lg" className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-300">
                Deploy Your First Contract
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
