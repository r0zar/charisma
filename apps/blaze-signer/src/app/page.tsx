import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronRight, Zap, Lock, Layers, Check, ArrowRight, Github } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import "./globals.css"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative py-20">
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
      <section id="features" className="relative py-20">
        <div className="container max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Key Features</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Blaze Protocol provides a comprehensive suite of features for secure off-chain operations
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: <Lock className="h-6 w-6" />,
                title: "Secure Signatures",
                description: "SIP-018 compliant structured data signing for maximum security and compatibility"
              },
              {
                icon: <Layers className="h-6 w-6" />,
                title: "Flexible Integration",
                description: "Easy integration with any Stacks-based application or service"
              },
              {
                icon: <Check className="h-6 w-6" />,
                title: "On-Chain Verification",
                description: "Trustless verification of signatures through smart contracts"
              }
            ].map((feature) => (
              <div key={feature.title} className="group relative rounded-2xl border border-border/40 bg-background p-6 transition-all hover:border-primary/20 hover:shadow-md">
                <div className="mb-4 inline-flex rounded-lg bg-primary/10 p-2.5 text-primary">
                  {feature.icon}
                </div>
                <h3 className="mb-2 text-xl font-semibold">{feature.title}</h3>
                <p className="text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="relative py-20">
        <div className="container max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">How It Works</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              A simple yet powerful process for handling off-chain signatures
            </p>
          </div>

          <div className="relative mt-16">
            <div className="absolute left-8 top-8 -bottom-8 border-l-2 border-dashed border-border md:left-1/2"></div>
            <div className="space-y-12 md:space-y-16">
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
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="relative py-20">
        <div className="container max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Use Cases</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Discover the various applications of Blaze Protocol
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-2">
            {[
              {
                title: "Token Gating",
                description: "Control access to exclusive content or features based on token ownership without requiring on-chain transactions for every check."
              },
              {
                title: "Batch Operations",
                description: "Collect multiple signatures off-chain and process them in a single on-chain transaction for improved efficiency."
              },
              {
                title: "Delayed Execution",
                description: "Sign transactions now and execute them later when specific conditions are met."
              },
              {
                title: "Cross-Chain Operations",
                description: "Enable secure interactions between different blockchain networks using off-chain signatures."
              }
            ].map((useCase) => (
              <div key={useCase.title} className="group relative rounded-2xl border border-border/40 bg-background p-6 transition-all hover:border-primary/20 hover:shadow-md">
                <h3 className="mb-2 text-xl font-semibold">{useCase.title}</h3>
                <p className="text-muted-foreground">{useCase.description}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      </section>

      {/* Token Subnet Section */}
      <section id="token-subnet" className="relative py-20">
        <div className="container max-w-7xl">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Token Subnet Messages</h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Explore the different types of messages supported by the token subnet contract
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              {
                title: "Bearer Redemption",
                subtitle: "x-redeem",
                description: "Allow token holders to redeem bearer tokens by providing a valid signature, amount, and UUID. Perfect for implementing token-gated features or delayed redemptions.",
                code: "(x-redeem signature amount uuid to)"
              },
              {
                title: "Exact Transfer",
                subtitle: "x-transfer",
                description: "Execute precise token transfers with a specified amount. The signature authorizes an exact transfer amount to a designated recipient.",
                code: "(x-transfer signature amount uuid to)"
              },
              {
                title: "Upper-bound Transfer",
                subtitle: "x-transfer-lte",
                description: "Enable flexible transfers with an upper bound. The actual transfer amount must not exceed the signed bound, providing more flexibility in execution.",
                code: "(x-transfer-lte signature bound actual uuid to)"
              }
            ].map((type) => (
              <div key={type.title} className="group relative rounded-2xl border border-border/40 bg-background p-6 transition-all hover:border-primary/20 hover:shadow-md">
                <h3 className="mb-1 text-xl font-semibold">{type.title}</h3>
                <div className="mb-4 text-sm font-mono text-primary">{type.subtitle}</div>
                <p className="mb-4 text-muted-foreground">{type.description}</p>
                <div className="rounded bg-muted/50 p-3">
                  <code className="text-sm text-muted-foreground">{type.code}</code>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Background Pattern */}
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]"></div>
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
    </div>
  )
}
