"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Footer } from "@/components/footer"
import { Dice6, Trophy, Shield, Flame, Clock, Users, TrendingUp, Star, ChevronRight } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-accent/10 animated-bg">
        {/* Layered Background Effects */}
        <div className="absolute inset-0 bg-luxury-texture"></div>
        <div className="absolute inset-0 bg-circuit-pattern opacity-40"></div>
        <div className="absolute inset-0 bg-layer-2"></div>
        <div className="absolute inset-0 bg-layer-3"></div>
        
        {/* Floating Gradient Orb */}
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary/10 rounded-full filter blur-3xl animate-pulse opacity-20"></div>
        
        <div className="container mx-auto px-4 py-20 lg:py-32 text-center relative z-10">
          <div className="max-w-5xl mx-auto">
            {/* Trust Badge */}
            <div className="flex justify-center mb-8">
              <Badge variant="secondary" className="px-4 py-2 text-sm font-medium bg-primary/10 text-primary border-primary/20">
                <Shield className="h-4 w-4 mr-2" />
                Blockchain Verified • Provably Fair
              </Badge>
            </div>

            <h1 className="text-6xl md:text-8xl font-bold mb-8 bg-gradient-to-r from-primary via-primary/80 to-primary/60 bg-clip-text text-transparent tracking-tight font-vegas-title">
              Win Big Daily
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground mb-6 max-w-4xl mx-auto leading-relaxed">
              The world's first deflationary lottery powered by blockchain technology. 
              Every ticket burns STONE tokens forever, making winners and holders richer.
            </p>

            <div className="flex justify-center mb-12">
              <p className="text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
                <Flame className="h-4 w-4 inline mr-2 text-orange-500" />
                <strong>5 STONE</strong> burned per ticket • <strong>125M STONE</strong> current jackpot
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
              <Link href="/lottery">
                <Button size="lg" className="text-lg px-10 py-6 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/80">
                  <Dice6 className="h-5 w-5 mr-2" />
                  Start Playing Now
                  <ChevronRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
              <Link href="/analytics">
                <Button variant="outline" size="lg" className="text-lg px-10 py-6 border-2 hover:bg-primary/5 transition-all duration-300">
                  <TrendingUp className="h-5 w-5 mr-2" />
                  View Analytics
                </Button>
              </Link>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto mb-20">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2 font-vegas-numbers">125M</div>
                <div className="text-sm text-muted-foreground">Current Jackpot</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2 font-vegas-numbers">2.5M</div>
                <div className="text-sm text-muted-foreground">Tokens Burned</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2 font-vegas-numbers">1,847</div>
                <div className="text-sm text-muted-foreground">Total Winners</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2 font-vegas-numbers">98.7%</div>
                <div className="text-sm text-muted-foreground">Uptime</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30 relative floating-orbs">
        {/* Background Patterns */}
        <div className="absolute inset-0 bg-honeycomb"></div>
        <div className="absolute inset-0 bg-casino-texture opacity-60"></div>
        <div className="absolute inset-0 bg-diagonal-lines opacity-30"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">Why Choose Stone Lottery?</h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Built on cutting-edge blockchain technology with features that traditional lotteries can't match.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Instant Payouts */}
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Clock className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Instant Payouts</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Winners receive payouts instantly via smart contracts. No waiting periods, no intermediaries, just pure automation.
                </p>
              </CardContent>
            </Card>

            {/* Provably Fair */}
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Provably Fair</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Every draw is verifiably random using blockchain cryptography. Complete transparency, zero manipulation possible.
                </p>
              </CardContent>
            </Card>

            {/* Deflationary */}
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-600/20 flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Flame className="w-8 h-8 text-orange-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Deflationary Model</h3>
                <p className="text-muted-foreground leading-relaxed">
                  STONE tokens are permanently burned with every ticket. Reduced supply benefits all holders automatically.
                </p>
              </CardContent>
            </Card>

            {/* Community Driven */}
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Community Driven</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Governance by token holders. The community decides on jackpot sizes, draw frequencies, and new features.
                </p>
              </CardContent>
            </Card>

            {/* High Security */}
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-indigo-600/20 flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Star className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Battle Tested</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Audited smart contracts with 99.9% uptime. Trusted by thousands of players worldwide since launch.
                </p>
              </CardContent>
            </Card>

            {/* Big Jackpots */}
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20">
              <CardContent className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 flex items-center justify-center mb-6 mx-auto group-hover:scale-110 transition-transform duration-300">
                  <Trophy className="w-8 h-8 text-yellow-600" />
                </div>
                <h3 className="text-2xl font-bold mb-4">Massive Jackpots</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Growing jackpots with multiple prize tiers. Match 3+ numbers to win, with life-changing top prizes.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 relative animated-bg">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-diamond-pattern"></div>
        <div className="absolute inset-0 bg-texture-grid opacity-50"></div>
        
        {/* Animated Glow Effect */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full max-w-4xl max-h-96 bg-primary/5 rounded-full filter blur-3xl animate-pulse"></div>
        
        <div className="container mx-auto px-4 text-center relative z-10">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 font-vegas-title">Ready to Win?</h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Join thousands of players in the world's most transparent lottery. Every ticket burns STONE forever.
            </p>
            <Link href="/lottery">
              <Button size="lg" className="text-xl px-12 py-6 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/80">
                <Dice6 className="h-6 w-6 mr-3" />
                Play Your First Ticket
                <ChevronRight className="h-6 w-6 ml-3" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}