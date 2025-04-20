import React from 'react'
import { Link } from '@repo/ui/link'
import { Button } from '@repo/ui/button'
import { ChevronRight, Zap, Lock, Layers, Check } from '@repo/ui/icons'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Navigation */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Blaze Signer</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How it Works</a>
            <a href="#use-cases" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Use Cases</a>
            <Link href="/signer">
              <Button variant="primary" size="sm">
                Open App
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </nav>
          <div className="md:hidden">
            <Link href="/signer">
              <Button variant="primary" size="sm">Open App</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 md:py-32">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              Secure Off-Chain Signing for <span className="text-primary">Stacks Blockchain</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-10 leading-relaxed">
              Blaze Signer enables secure off-chain message signing with on-chain verification,
              powering efficient and low-cost transactions on Stacks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signer">
                <Button variant="primary" size="lg" className="font-medium">
                  Get Started
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button variant="outline" size="lg" className="font-medium">
                  Learn How It Works
                </Button>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Fast & Efficient</h3>
              <p className="text-muted-foreground">
                Sign transactions off-chain and submit them when needed, reducing blockchain congestion and costs.
              </p>
            </div>

            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Secure Verification</h3>
              <p className="text-muted-foreground">
                Built on SIP-018 standards with cryptographic verification guaranteeing transaction integrity.
              </p>
            </div>

            <div className="bg-card border border-border p-6 rounded-lg">
              <div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
                <Layers className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Flexible Integration</h3>
              <p className="text-muted-foreground">
                Easily integrate with existing Stacks applications, tokens, and smart contracts.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20">
        <div className="container max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>

          <div className="max-w-3xl mx-auto">
            <ol className="relative border-l border-muted-foreground/20">
              <li className="mb-10 ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full -left-4">
                  1
                </span>
                <h3 className="flex items-center mb-2 text-xl font-semibold">Generate Hash</h3>
                <p className="mb-4 text-muted-foreground">
                  Create a structured data hash with the necessary transaction details (contract, operation, etc.)
                </p>
              </li>

              <li className="mb-10 ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full -left-4">
                  2
                </span>
                <h3 className="flex items-center mb-2 text-xl font-semibold">Sign Message</h3>
                <p className="mb-4 text-muted-foreground">
                  Sign the generated hash with your wallet using SIP-018 structured data signing
                </p>
              </li>

              <li className="mb-10 ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full -left-4">
                  3
                </span>
                <h3 className="flex items-center mb-2 text-xl font-semibold">Share or Store</h3>
                <p className="mb-4 text-muted-foreground">
                  Share the signature and details with a recipient, or store it for later submission
                </p>
              </li>

              <li className="ml-6">
                <span className="absolute flex items-center justify-center w-8 h-8 bg-primary text-white rounded-full -left-4">
                  4
                </span>
                <h3 className="flex items-center mb-2 text-xl font-semibold">Submit On-Chain</h3>
                <p className="mb-4 text-muted-foreground">
                  The signature is verified and processed on-chain when submitted to the Blaze Signer contract
                </p>
              </li>
            </ol>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="py-20 bg-muted/30">
        <div className="container max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Common Use Cases</h2>

          <div className="max-w-3xl mx-auto space-y-4">
            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-start">
                <Check className="text-primary flex-shrink-0 mr-4 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Deferred Transactions</h3>
                  <p className="text-muted-foreground">
                    Sign a transaction now, but execute it later when certain conditions are met.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-start">
                <Check className="text-primary flex-shrink-0 mr-4 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Gasless Transactions</h3>
                  <p className="text-muted-foreground">
                    Allow users to sign transactions while a separate entity covers the gas fees.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6">
              <div className="flex items-start">
                <Check className="text-primary flex-shrink-0 mr-4 mt-1" />
                <div>
                  <h3 className="text-xl font-semibold mb-2">Offline Signing</h3>
                  <p className="text-muted-foreground">
                    Create and sign transactions while offline, submitting them later when connected.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">Ready to Start Blazing?</h2>
            <p className="text-xl text-muted-foreground mb-8">
              Try Blaze Signer today and experience the power of secure off-chain signatures
            </p>
            <Link href="/signer">
              <Button variant="primary" size="lg" className="font-medium">
                Launch App
                <ChevronRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 bg-background">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              <span className="font-semibold">Blaze Signer</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Powered by Stacks Blockchain Technology
            </p>
            <div className="flex items-center gap-4">
              <Link href="#" variant="hover" className="text-sm text-muted-foreground">Docs</Link>
              <Link href="#" variant="hover" className="text-sm text-muted-foreground">GitHub</Link>
              <Link href="#" variant="hover" className="text-sm text-muted-foreground">Discord</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
