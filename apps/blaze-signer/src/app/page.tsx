import React from 'react'
import { Button } from '@repo/ui/button'
import { ChevronRight, Zap, Lock, Layers, Check, ArrowRight, Github } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@repo/ui/utils'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-7xl items-center">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center rounded-lg bg-primary/10 p-1">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <span className="text-xl font-bold">Blaze Protocol</span>
          </div>
          <nav className="hidden flex-1 justify-center md:flex">
            <div className="flex items-center gap-6 text-sm">
              <a href="#features" className="text-muted-foreground transition-colors hover:text-foreground">Features</a>
              <a href="#how-it-works" className="text-muted-foreground transition-colors hover:text-foreground">How it Works</a>
              <a href="#use-cases" className="text-muted-foreground transition-colors hover:text-foreground">Use Cases</a>
            </div>
          </nav>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/r0zar/charisma"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:flex"
            >
              <Github className="h-4 w-4" />
              GitHub
            </a>
            <Link href="/signer">
              <Button variant="default" size="sm" className="gap-2 shadow-sm">
                Launch App
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-background py-20 md:py-32">
          <div className="container relative z-10 max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Zap className="h-4 w-4" />
                <span>Fast & Secure Off-Chain Signatures</span>
              </div>
              <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-6xl">
                Secure Off-Chain Signing for{' '}
                <span className="text-primary">Stacks Blockchain</span>
              </h1>
              <p className="mt-6 text-xl leading-relaxed text-muted-foreground">
                Blaze Protocol enables secure off-chain message signing with on-chain verification,
                powering efficient and low-cost transactions on Stacks.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
                <Link href="/signer">
                  <Button size="lg" className="w-full gap-2 shadow-md transition-all hover:shadow-lg sm:w-auto">
                    Get Started
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <a href="#how-it-works">
                  <Button variant="outline" size="lg" className="w-full gap-2 sm:w-auto">
                    Learn More
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
          {/* Background Pattern */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        </section>

        {/* Features Section */}
        <section id="features" className="relative bg-muted/[0.025] py-20">
          <div className="container max-w-7xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Layers className="h-4 w-4" />
                Features
              </div>
              <h2 className="mt-6 text-3xl font-bold">Why Choose Blaze Protocol</h2>
            </div>

            <div className="mt-12 grid gap-8 md:grid-cols-3">
              {[
                {
                  icon: Zap,
                  title: "Fast & Efficient",
                  description: "Sign transactions off-chain and submit them when needed, reducing blockchain congestion and costs."
                },
                {
                  icon: Lock,
                  title: "Secure Verification",
                  description: "Built on SIP-018 standards with cryptographic verification guaranteeing transaction integrity."
                },
                {
                  icon: Layers,
                  title: "Flexible Integration",
                  description: "Easily integrate with existing Stacks applications, tokens, and smart contracts."
                }
              ].map((feature, i) => (
                <div
                  key={feature.title}
                  className={cn(
                    "group relative overflow-hidden rounded-2xl border border-border/40 bg-background p-6 transition-all hover:border-primary/20 hover:shadow-lg",
                    "before:absolute before:inset-0 before:-z-10 before:bg-gradient-to-b before:from-primary/5 before:to-transparent before:opacity-0 before:transition-opacity hover:before:opacity-100"
                  )}
                >
                  <div className="mb-4 inline-flex rounded-xl bg-primary/10 p-3 transition-colors group-hover:bg-primary/20">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-3 text-xl font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="relative bg-background py-20">
          <div className="container max-w-7xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Lock className="h-4 w-4" />
                Process
              </div>
              <h2 className="mt-6 text-3xl font-bold">How It Works</h2>
            </div>

            <div className="mx-auto mt-12 max-w-3xl">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-5 top-0 h-full w-0.5 bg-gradient-to-b from-primary via-primary/50 to-transparent" />

                <div className="space-y-12">
                  {[
                    {
                      title: "Generate Hash",
                      description: "Create a structured data hash with the necessary transaction details (contract, operation, etc.)"
                    },
                    {
                      title: "Sign Message",
                      description: "Sign the generated hash with your wallet using SIP-018 structured data signing"
                    },
                    {
                      title: "Share or Store",
                      description: "Share the signature and details with a recipient, or store it for later submission"
                    },
                    {
                      title: "Submit On-Chain",
                      description: "The signature is verified and processed on-chain when submitted to the Blaze Protocol contract"
                    }
                  ].map((step, i) => (
                    <div key={step.title} className="relative flex gap-4">
                      {/* Number */}
                      <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-semibold text-white shadow-md">
                        {i + 1}
                      </div>
                      {/* Content */}
                      <div className="w-[calc(100%-3.5rem)] rounded-2xl border border-border/40 bg-background p-6 transition-all hover:border-primary/20 hover:shadow-md">
                        <h3 className="mb-2 text-xl font-semibold">{step.title}</h3>
                        <p className="text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Background Pattern */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        </section>

        {/* Use Cases Section */}
        <section id="use-cases" className="relative bg-muted/[0.025] py-20">
          <div className="container max-w-7xl">
            <div className="text-center">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
                <Check className="h-4 w-4" />
                Applications
              </div>
              <h2 className="mt-6 text-3xl font-bold">Common Use Cases</h2>
            </div>

            <div className="mx-auto mt-12 max-w-3xl space-y-4">
              {[
                {
                  title: "Deferred Transactions",
                  description: "Sign a transaction now, but execute it later when certain conditions are met."
                },
                {
                  title: "Gasless Transactions",
                  description: "Allow users to sign transactions while a separate entity covers the gas fees."
                },
                {
                  title: "Offline Signing",
                  description: "Create and sign transactions while offline, submitting them later when connected."
                }
              ].map((useCase) => (
                <div
                  key={useCase.title}
                  className="group relative overflow-hidden rounded-2xl border border-border/40 bg-background p-6 transition-all hover:border-primary/20 hover:shadow-lg"
                >
                  <div className="flex items-start gap-4">
                    <div className="rounded-full bg-primary/10 p-2 transition-colors group-hover:bg-primary/20">
                      <Check className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="mb-2 text-xl font-semibold">{useCase.title}</h3>
                      <p className="text-muted-foreground">{useCase.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative bg-background py-20">
          <div className="container max-w-7xl">
            <div className="mx-auto max-w-3xl overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/[0.075] to-transparent p-8 text-center shadow-xl md:p-12">
              <h2 className="text-3xl font-bold">Ready to Start?</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Try Blaze Protocol today and experience the power of secure off-chain signatures
              </p>
              <div className="mt-8 flex justify-center gap-4">
                <Link href="/signer">
                  <Button size="lg" className="gap-2 shadow-md transition-all hover:shadow-lg">
                    Launch App
                    <ArrowRight className="h-5 w-5" />
                  </Button>
                </Link>
                <a
                  href="https://github.com/r0zar/charisma"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Button variant="outline" size="lg" className="gap-2">
                    <Github className="h-5 w-5" />
                    GitHub
                  </Button>
                </a>
              </div>
            </div>
          </div>
          {/* Background Pattern */}
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-background py-8">
        <div className="container max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center rounded-lg bg-primary/10 p-1">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold">Blaze Protocol</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Powered by Stacks Blockchain Technology
            </p>
            <div className="flex items-center gap-6">
              <a
                href="https://github.com/r0zar/charisma"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                GitHub
              </a>
              <a
                href="https://x.com/lordrozar"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                X (Twitter)
              </a>
              {/* <a
                href="https://discord.gg/charisma"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                Discord
              </a> */}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
