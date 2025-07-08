"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/contexts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dice6,
  Clock,
  Trophy,
  Wallet,
  History,
  TrendingUp,
  Calendar,
  Zap,
  Star,
  Target
} from "lucide-react"
import Link from "next/link"
import { Footer } from "@/components/footer"

// Lottery ball component
function LotteryBall({ number, isSelected, onClick, isWinning = false }: {
  number: number
  isSelected?: boolean
  onClick?: () => void
  isWinning?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`
        w-12 h-12 rounded-full border-2 font-bold text-sm transition-all
        flex items-center justify-center
        ${isSelected
          ? 'bg-primary text-primary-foreground border-primary shadow-lg scale-110'
          : isWinning
            ? 'bg-yellow-500 text-white border-yellow-400 shadow-lg'
            : 'bg-background border-border hover:bg-accent hover:border-primary/50 hover:scale-105'
        }
        ${onClick ? 'cursor-pointer' : 'cursor-default'}
      `}
    >
      {number}
    </button>
  )
}

// Number selection grid component
function NumberGrid({ selectedNumbers, onNumberToggle, maxNumbers = 6 }: {
  selectedNumbers: number[]
  onNumberToggle: (number: number) => void
  maxNumbers?: number
}) {
  return (
    <div className="grid grid-cols-7 gap-3 p-4">
      {Array.from({ length: 49 }, (_, i) => i + 1).map((number) => (
        <LotteryBall
          key={number}
          number={number}
          isSelected={selectedNumbers.includes(number)}
          onClick={() => {
            if (selectedNumbers.includes(number)) {
              onNumberToggle(number)
            } else if (selectedNumbers.length < maxNumbers) {
              onNumberToggle(number)
            }
          }}
        />
      ))}
    </div>
  )
}

// Countdown component
function DrawCountdown({ targetDate }: { targetDate: Date }) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = targetDate.getTime() - now

      if (distance > 0) {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000)
        })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [targetDate])

  return (
    <div className="flex justify-center gap-4">
      {Object.entries(timeLeft).map(([unit, value]) => (
        <div key={unit} className="text-center">
          <div className="bg-primary text-primary-foreground rounded-lg p-3 font-bold text-2xl min-w-[60px]">
            {value.toString().padStart(2, '0')}
          </div>
          <div className="text-xs text-muted-foreground mt-1 capitalize">
            {unit}
          </div>
        </div>
      ))}
    </div>
  )
}

// Mock data
const mockWinningNumbers = [7, 14, 21, 28, 35, 42]
const mockJackpot = 125000000 // 125M STONE
const mockTicketPrice = 5 // 5 STONE

const mockPastDraws = [
  { date: '2025-01-01', numbers: [3, 16, 22, 29, 38, 45], jackpot: 98000000, winners: 2 },
  { date: '2024-12-28', numbers: [8, 15, 23, 31, 39, 44], jackpot: 87000000, winners: 1 },
  { date: '2024-12-25', numbers: [1, 12, 18, 27, 33, 41], jackpot: 76000000, winners: 0 },
]

const mockUserTickets = [
  { id: 1, numbers: [5, 12, 19, 26, 33, 40], purchaseDate: '2025-01-05', cost: 5 },
  { id: 2, numbers: [2, 9, 16, 23, 30, 37], purchaseDate: '2025-01-05', cost: 5 },
]

export default function LotteryPage() {
  const { walletState, connectWallet, isConnecting } = useWallet()
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("play")

  // Next draw date (3 days from now)
  const nextDraw = new Date()
  nextDraw.setDate(nextDraw.getDate() + 3)
  nextDraw.setHours(20, 0, 0, 0) // 8 PM

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleNumberToggle = (number: number) => {
    setSelectedNumbers(prev =>
      prev.includes(number)
        ? prev.filter(n => n !== number)
        : [...prev, number]
    )
  }

  const handleQuickPick = () => {
    const numbers: number[] = []
    while (numbers.length < 6) {
      const num = Math.floor(Math.random() * 49) + 1
      if (!numbers.includes(num)) {
        numbers.push(num)
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b))
  }

  const handleClearSelection = () => {
    setSelectedNumbers([])
  }

  const handlePurchaseTicket = () => {
    if (!walletState.connected) {
      connectWallet()
      return
    }
    // Mock purchase logic
    alert(`Ticket purchased with numbers: ${selectedNumbers.join(', ')}`)
    setSelectedNumbers([])
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto p-6 space-y-8 flex-1 relative">
        {/* Background Effects */}
        <div className="fixed inset-0 bg-casino-texture pointer-events-none"></div>
        <div className="fixed inset-0 bg-circuit-pattern opacity-20 pointer-events-none"></div>
        <div className="fixed top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full filter blur-3xl opacity-30 pointer-events-none animate-pulse"></div>
        <div className="fixed bottom-1/4 left-0 w-80 h-80 bg-accent/10 rounded-full filter blur-3xl opacity-20 pointer-events-none" style={{ animationDelay: '5s' }}></div>
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <Dice6 className="h-10 w-10 text-primary" />
            Stone Lottery
          </h1>
          <p className="text-muted-foreground text-lg">
            Win big with blockchain-powered lottery draws
          </p>
        </div>

        {/* Current Jackpot */}
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 glow-primary relative overflow-hidden">
          {/* Animated background for jackpot */}
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 animate-pulse"></div>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-accent to-primary animate-pulse"></div>
          
          <CardContent className="text-center py-8 relative z-10">
            <div className="space-y-4">
              <Badge variant="default" className="text-lg py-2 px-4 glow-secondary">
                <Trophy className="h-5 w-5 mr-2" />
                Current Jackpot
              </Badge>
              <div className="text-5xl font-bold text-primary font-vegas-numbers">
                {mockJackpot.toLocaleString()} STONE
              </div>
              <div className="text-muted-foreground">
                Next draw in:
              </div>
              <DrawCountdown targetDate={nextDraw} />
            </div>
          </CardContent>
        </Card>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full gap-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="play" className="flex items-center gap-2">
              <Dice6 className="h-4 w-4" />
              <span className="hidden sm:inline">Play</span>
            </TabsTrigger>
            <TabsTrigger value="tickets" className="flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">My Tickets</span>
            </TabsTrigger>
            <TabsTrigger value="results" className="flex items-center gap-2">
              <Trophy className="h-4 w-4" />
              <span className="hidden sm:inline">Results</span>
            </TabsTrigger>
            <TabsTrigger value="stats" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Stats</span>
            </TabsTrigger>
          </TabsList>

          {/* Play Tab */}
          <TabsContent value="play" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Select Your Numbers
                </CardTitle>
                <CardDescription>
                  Choose 6 numbers from 1 to 49. Each ticket costs {mockTicketPrice} STONE tokens.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Selected Numbers Display */}
                <div className="text-center space-y-4">
                  <div className="text-sm font-medium text-muted-foreground">
                    Selected Numbers ({selectedNumbers.length}/6)
                  </div>
                  <div className="flex justify-center gap-2 flex-wrap">
                    {Array.from({ length: 6 }, (_, i) => (
                      <div
                        key={i}
                        className={`
                          w-12 h-12 rounded-full border-2 font-bold text-sm
                          flex items-center justify-center
                          ${selectedNumbers[i]
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-muted border-muted-foreground/20 text-muted-foreground'
                          }
                        `}
                      >
                        {selectedNumbers[i] || '?'}
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Number Grid */}
                <NumberGrid
                  selectedNumbers={selectedNumbers}
                  onNumberToggle={handleNumberToggle}
                />

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button
                    variant="outline"
                    onClick={handleQuickPick}
                    className="flex items-center gap-2"
                  >
                    <Zap className="h-4 w-4" />
                    Quick Pick
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClearSelection}
                    disabled={selectedNumbers.length === 0}
                  >
                    Clear Selection
                  </Button>
                  <Button
                    onClick={handlePurchaseTicket}
                    disabled={selectedNumbers.length !== 6}
                    className="flex items-center gap-2"
                  >
                    <Wallet className="h-4 w-4" />
                    {walletState.connected ? `Buy Ticket (${mockTicketPrice} STONE)` : 'Connect Wallet'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* My Tickets Tab */}
          <TabsContent value="tickets" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  My Tickets
                </CardTitle>
                <CardDescription>
                  Your purchased tickets for upcoming draws
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!walletState.connected ? (
                  <div className="text-center py-8">
                    <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">Connect your wallet to view tickets</p>
                    <Button onClick={connectWallet} disabled={isConnecting}>
                      {isConnecting ? "Connecting..." : "Connect Wallet"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {mockUserTickets.map((ticket) => (
                      <div key={ticket.id} className="p-4 border rounded-lg space-y-3 border-border">
                        <div className="flex justify-between items-center">
                          <Badge variant="outline">Ticket #{ticket.id}</Badge>
                          <div className="text-sm text-muted-foreground">
                            {ticket.purchaseDate}
                          </div>
                        </div>
                        <div className="flex gap-2 justify-center">
                          {ticket.numbers.map((number) => (
                            <LotteryBall key={number} number={number} />
                          ))}
                        </div>
                        <div className="text-center text-sm text-muted-foreground">
                          Cost: {ticket.cost} STONE
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5" />
                  Latest Winning Numbers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center space-y-4">
                  <div className="text-sm text-muted-foreground">Last Draw</div>
                  <div className="flex gap-2 justify-center">
                    {mockWinningNumbers.map((number) => (
                      <LotteryBall key={number} number={number} isWinning />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Past Draws
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {mockPastDraws.map((draw, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3 border-border">
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-medium">{draw.date}</div>
                        <Badge variant="secondary">
                          {draw.winners} winner{draw.winners !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="flex gap-2 justify-center">
                        {draw.numbers.map((number) => (
                          <LotteryBall key={number} number={number} />
                        ))}
                      </div>
                      <div className="text-center text-sm text-muted-foreground">
                        Jackpot: {draw.jackpot.toLocaleString()} STONE
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Ticket Price</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mockTicketPrice} STONE</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Draw Frequency</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">2x</div>
                  <div className="text-sm text-muted-foreground">per week</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Jackpot Odds</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1 in 14M</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Next Draw</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    <Calendar className="h-6 w-6 inline mr-2" />
                    {nextDraw.toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Prize Tiers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>6 numbers</span>
                      <span className="font-bold">Jackpot</span>
                    </div>
                    <div className="flex justify-between">
                      <span>5 numbers</span>
                      <span>50,000 STONE</span>
                    </div>
                    <div className="flex justify-between">
                      <span>4 numbers</span>
                      <span>1,000 STONE</span>
                    </div>
                    <div className="flex justify-between">
                      <span>3 numbers</span>
                      <span>50 STONE</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Most Drawn</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-1 flex-wrap">
                    {[7, 14, 21, 28, 35].map((number) => (
                      <div key={number} className="w-8 h-8 rounded-full bg-primary/20 text-primary text-xs font-bold flex items-center justify-center">
                        {number}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Footer />
    </div>
  )
}