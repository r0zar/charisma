"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/contexts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  TrendingUp,
  Wallet,
  Trophy,
  Dice6,
  Flame,
  RefreshCw,
  BarChart3,
  PieChart,
  Calendar,
  Clock,
  Globe,
  Settings,
  Zap,
  Target,
  Users,
  DollarSign,
  Percent
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RechartsPieChart, Cell, Pie, AreaChart, Area } from "recharts"
import Link from "next/link"
import { Footer } from "@/components/footer"

// Custom tooltip component that uses theme styles
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-sm text-muted-foreground">
            <span className="font-medium" style={{ color: entry.color }}>
              {entry.dataKey}:
            </span>{' '}
            {entry.value}
          </p>
        ))}
      </div>
    )
  }
  return null
}

// Custom pie chart tooltip
const CustomPieTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground">
          {payload[0].name}: {payload[0].value}%
        </p>
      </div>
    )
  }
  return null
}

// Lottery analytics data generators
const generateJackpotHistory = () => {
  const data = []
  const now = new Date()
  let jackpot = 50000000 // Start at 50M

  for (let i = 29; i >= 0; i--) {
    const date = new Date(now)
    date.setDate(date.getDate() - i)

    // Simulate jackpot growth and resets
    const isDrawDay = i % 7 === 0 && i !== 0 // Every 7 days
    if (isDrawDay) {
      jackpot = Math.random() > 0.3 ? 25000000 + Math.random() * 50000000 : jackpot + Math.random() * 10000000 // 70% chance of win/reset
    } else {
      jackpot += Math.random() * 2000000 + 500000 // Daily growth
    }

    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      jackpot: Math.floor(jackpot),
      tickets: Math.floor(Math.random() * 10000) + 2000,
      burned: Math.floor((Math.random() * 10000 + 2000) * 5), // tickets * 5 STONE
    })
  }
  return data
}

const generateTicketSalesData = () => {
  const data = []
  const now = new Date()

  for (let i = 23; i >= 0; i--) { // Last 24 hours
    const hour = new Date(now)
    hour.setHours(hour.getHours() - i)

    data.push({
      hour: hour.getHours(),
      tickets: Math.floor(Math.random() * 500) + 100,
      revenue: Math.floor((Math.random() * 500 + 100) * 5), // tickets * 5 STONE
    })
  }
  return data
}

const generateWinningNumbers = () => {
  const frequencies: Record<number, number> = {}

  // Generate frequency data for numbers 1-49
  for (let i = 1; i <= 49; i++) {
    frequencies[i] = Math.floor(Math.random() * 50) + 10
  }

  return Object.entries(frequencies)
    .map(([number, frequency]) => ({ number: parseInt(number), frequency }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 10)
}

const generatePrizeDistribution = () => [
  { tier: '6 Numbers', winners: 2, amount: 125000000, color: '#ffd700' },
  { tier: '5 Numbers', winners: 24, amount: 50000, color: '#c0c0c0' },
  { tier: '4 Numbers', winners: 847, amount: 1000, color: '#cd7f32' },
  { tier: '3 Numbers', winners: 15632, amount: 50, color: '#3b82f6' },
]

const generatePlayerStats = () => [
  { metric: 'Active Players', value: 45672, change: 12.5 },
  { metric: 'Total Tickets Sold', value: 2847593, change: 8.2 },
  { metric: 'STONE Burned', value: 14237965, change: 15.3 },
  { metric: 'Avg Ticket/Player', value: 62.3, change: -2.1 },
]

export default function AnalyticsPage() {
  const { walletState, network, connectWallet, disconnectWallet, isConnecting } = useWallet()
  const [mounted, setMounted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Lottery analytics data
  const [jackpotData] = useState(generateJackpotHistory())
  const [ticketSalesData] = useState(generateTicketSalesData())
  const [hotNumbers] = useState(generateWinningNumbers())
  const [prizeDistribution] = useState(generatePrizeDistribution())
  const [playerStats] = useState(generatePlayerStats())

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 1000)
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="flex flex-col min-h-screen relative">
      {/* Subtle background effects for analytics */}
      <div className="fixed inset-0 bg-texture-grid opacity-40 pointer-events-none"></div>
      <div className="fixed inset-0 bg-honeycomb opacity-20 pointer-events-none"></div>
      <div className="fixed top-1/3 right-1/4 w-72 h-72 bg-primary/5 rounded-full filter blur-3xl opacity-20 pointer-events-none animate-pulse" style={{ animationDuration: '8s' }}></div>
      
      <div className="container mx-auto p-6 space-y-8 flex-1 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-primary" />
              Lottery Analytics
            </h1>
            <p className="text-muted-foreground">
              Real-time lottery performance metrics and player insights
            </p>
          </div>
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Current Jackpot */}
          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Current Jackpot</CardTitle>
              <Trophy className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold mb-2">
                125,000,000 STONE
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +12.5%
                </Badge>
                <span className="text-xs text-muted-foreground">vs last draw</span>
              </div>
            </CardContent>
          </Card>

          {/* Tickets Sold Today */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Tickets Today</CardTitle>
              <Dice6 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold mb-2">8,429</div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">
                  <TrendingUp className="h-3 w-3 mr-1" />
                  +8.2%
                </Badge>
                <span className="text-xs text-muted-foreground">vs yesterday</span>
              </div>
            </CardContent>
          </Card>

          {/* STONE Burned */}
          <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">STONE Burned</CardTitle>
              <Flame className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold mb-2">42,145</div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">
                  <Flame className="h-3 w-3 mr-1" />
                  Today
                </Badge>
                <span className="text-xs text-muted-foreground">5 per ticket</span>
              </div>
            </CardContent>
          </Card>

          {/* Active Players */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Active Players</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-2xl font-bold mb-2">45,672</div>
              <div className="flex items-center gap-2">
                <Badge variant="default" className="text-xs">
                  <Users className="h-3 w-3 mr-1" />
                  +12.5%
                </Badge>
                <span className="text-xs text-muted-foreground">this week</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Charts */}
          <div className="lg:col-span-2 space-y-8">
            {/* Jackpot History */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5" />
                  <span>Jackpot History</span>
                </CardTitle>
                <CardDescription>
                  Jackpot growth and winning patterns over the last 30 days
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={jackpotData}>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" fontSize={12} className="text-muted-foreground" />
                      <YAxis
                        fontSize={12}
                        className="text-muted-foreground"
                        tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`}
                      />
                      <Tooltip content={<CustomTooltip />} />
                      <Area
                        type="monotone"
                        dataKey="jackpot"
                        stroke="#ffd700"
                        fill="#ffd700"
                        fillOpacity={0.2}
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Ticket Sales Activity */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>24h Ticket Sales</span>
                </CardTitle>
                <CardDescription>
                  Hourly ticket sales and STONE burned
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs defaultValue="tickets" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="tickets">Tickets Sold</TabsTrigger>
                    <TabsTrigger value="burned">STONE Burned</TabsTrigger>
                  </TabsList>
                  <TabsContent value="tickets" className="space-y-4">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ticketSalesData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis
                            dataKey="hour"
                            fontSize={12}
                            className="text-muted-foreground"
                            tickFormatter={(value) => `${value}:00`}
                          />
                          <YAxis fontSize={12} className="text-muted-foreground" />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="tickets" fill="#3b82f6" opacity={0.8} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                  <TabsContent value="burned" className="space-y-4">
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ticketSalesData}>
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis
                            dataKey="hour"
                            fontSize={12}
                            className="text-muted-foreground"
                            tickFormatter={(value) => `${value}:00`}
                          />
                          <YAxis fontSize={12} className="text-muted-foreground" />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="revenue" fill="#ef4444" opacity={0.8} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Sidebar Analytics */}
          <div className="space-y-8">
            {/* Hot Numbers */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Hot Numbers</span>
                </CardTitle>
                <CardDescription>Most frequently drawn numbers</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {hotNumbers.slice(0, 5).map((item, index) => (
                    <div key={item.number} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center">
                          {item.number}
                        </div>
                        <span className="text-sm font-medium">Number {item.number}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{item.frequency}</div>
                        <div className="text-xs text-muted-foreground">draws</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Prize Distribution */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="h-5 w-5" />
                  <span>Last Draw Prizes</span>
                </CardTitle>
                <CardDescription>Winner distribution by tier</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-4">
                  {prizeDistribution.map((prize) => (
                    <div key={prize.tier} className="flex items-center justify-between p-3 border rounded-lg border-border">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: prize.color }}
                        />
                        <div>
                          <div className="text-sm font-medium">{prize.tier}</div>
                          <div className="text-xs text-muted-foreground">
                            {prize.amount.toLocaleString()} STONE
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold">{prize.winners}</div>
                        <div className="text-xs text-muted-foreground">winners</div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}