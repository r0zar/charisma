"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Trophy, Ticket, RefreshCw, Loader2, TrendingUp } from "lucide-react"
import { LotteryConfig } from "@/types/lottery"

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-muted rounded ${className}`} />
)

interface Analytics {
  currentDrawTickets?: number
  currentDrawConfirmed?: number
  currentDrawPending?: number
  currentDrawCancelled?: number
  currentDrawUniqueWallets?: number
  totalTickets?: number
  confirmedTickets?: number
  pendingTickets?: number
  cancelledTickets?: number
  uniqueWallets?: number
  totalDraws?: number
  completedDraws?: number
  averageTicketsPerDraw?: number
}

export default function AdminDashboard() {
  const [config, setConfig] = useState<LotteryConfig | null>(null)
  const [analytics, setAnalytics] = useState<Analytics>({})
  const [configLoading, setConfigLoading] = useState(true)
  const [currentDrawLoading, setCurrentDrawLoading] = useState(true)
  const [lifetimeStatsLoading, setLifetimeStatsLoading] = useState(true)

  const adminKey = typeof window !== 'undefined' ? localStorage.getItem('admin-key') || '' : ''

  useEffect(() => {
    fetchConfig()
    fetchCurrentDrawStats()
    fetchLifetimeStats()
  }, [])

  const fetchConfig = async () => {
    setConfigLoading(true)
    try {
      const response = await fetch('/api/admin/lottery-config', {
        headers: { 'x-admin-key': adminKey }
      })
      if (response.ok) {
        const result = await response.json()
        setConfig(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch config:', err)
    } finally {
      setConfigLoading(false)
    }
  }

  const fetchCurrentDrawStats = async () => {
    setCurrentDrawLoading(true)
    try {
      // Fast KV-only query for current draw stats (loads instantly)
      const statsResponse = await fetch('/api/admin/stats?currentOnly=true', {
        headers: { 'x-admin-key': adminKey }
      })

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch current draw stats')
      }

      const statsData = await statsResponse.json()
      const stats = statsData.data || {}

      // Update only current draw stats immediately
      setAnalytics(prev => ({
        ...prev,
        currentDrawTickets: stats.currentDrawTickets || 0,
        currentDrawConfirmed: stats.currentDrawConfirmed || 0,
        currentDrawPending: stats.currentDrawPending || 0,
        currentDrawCancelled: stats.currentDrawCancelled || 0,
        currentDrawUniqueWallets: stats.currentDrawUniqueWallets || 0,
      }))
    } catch (err) {
      console.error('Failed to fetch current draw stats:', err)
    } finally {
      setCurrentDrawLoading(false)
    }
  }

  const fetchLifetimeStats = async () => {
    setLifetimeStatsLoading(true)
    try {
      // Slower blob storage query for lifetime stats
      const statsResponse = await fetch('/api/admin/stats', {
        headers: { 'x-admin-key': adminKey }
      })

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch lifetime stats')
      }

      const statsData = await statsResponse.json()
      const stats = statsData.data || {}

      // Update with full stats including lifetime data
      setAnalytics(prev => ({
        ...prev,
        // Lifetime stats from blob storage
        totalTickets: stats.totalTickets || 0,
        confirmedTickets: stats.confirmedTickets || 0,
        uniqueWallets: stats.uniqueWallets || 0,
        totalDraws: stats.totalDraws || 0,
        completedDraws: stats.completedDraws || 0,
        averageTicketsPerDraw: stats.averageTicketsPerDraw || 0,

        // Update current draw stats again (in case they changed)
        currentDrawTickets: stats.currentDrawTickets || 0,
        currentDrawConfirmed: stats.currentDrawConfirmed || 0,
        currentDrawPending: stats.currentDrawPending || 0,
        currentDrawCancelled: stats.currentDrawCancelled || 0,
        currentDrawUniqueWallets: stats.currentDrawUniqueWallets || 0,
      }))
    } catch (err) {
      console.error('Failed to fetch lifetime stats:', err)
    } finally {
      setLifetimeStatsLoading(false)
    }
  }

  const fetchAnalytics = async () => {
    // Refresh both current draw and lifetime stats
    await Promise.all([fetchCurrentDrawStats(), fetchLifetimeStats()])
  }

  const currentDrawRevenue = (analytics.currentDrawConfirmed || 0) * (config?.ticketPrice || 0)
  const conversionRate = (analytics.currentDrawTickets || 0) > 0
    ? (((analytics.currentDrawConfirmed || 0) / (analytics.currentDrawTickets || 0)) * 100).toFixed(1)
    : '0'
  const avgTicketsPerWallet = (analytics.currentDrawUniqueWallets || 0) > 0
    ? ((analytics.currentDrawTickets || 0) / (analytics.currentDrawUniqueWallets || 0)).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      {/* Current Draw Metrics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Current Draw Overview</CardTitle>
              <CardDescription>Active tickets and participation metrics</CardDescription>
            </div>
            {currentDrawLoading ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <Badge variant="outline" className="text-base">
                {analytics.currentDrawTickets?.toLocaleString() || 0} Current Draw Tickets
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {currentDrawLoading ? (
            <div className="grid md:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-32" />
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-4 gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Trophy className="h-4 w-4" />
                  Draw Revenue
                </div>
                <div className="text-2xl font-bold">
                  {currentDrawRevenue.toLocaleString()} <span className="text-sm text-muted-foreground">STONE</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  From {analytics.currentDrawConfirmed?.toLocaleString() || 0} confirmed
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Ticket className="h-4 w-4" />
                  Conversion Rate
                </div>
                <div className="text-2xl font-bold">
                  {conversionRate}%
                </div>
                <div className="text-xs text-muted-foreground">
                  {analytics.currentDrawConfirmed} / {analytics.currentDrawTickets} confirmed
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Active Wallets
                </div>
                <div className="text-2xl font-bold">
                  {analytics.currentDrawUniqueWallets?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  {avgTicketsPerWallet} avg tickets/wallet in current draw
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Pending Tickets
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {analytics.currentDrawPending?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  Awaiting confirmation
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats Overview */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {configLoading ? (
              <>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-full" />
                <Separator />
                <Skeleton className="h-10 w-full" />
              </>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Lottery Status</span>
                  <Badge variant={config?.isActive ? "default" : "secondary"}>
                    {config?.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Ticket Price</span>
                  <span className="font-mono">{config?.ticketPrice} STONE</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Next Draw</span>
                  <span className="text-sm">
                    {config?.nextDrawDate ? new Date(config.nextDrawDate).toLocaleDateString() : 'Not set'}
                  </span>
                </div>

                <Separator />

                <div className="space-y-1">
                  <span className="text-sm font-medium">Current Jackpot</span>
                  <div className="text-sm text-muted-foreground">
                    {config?.currentJackpot?.title || 'No jackpot set'}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Ticket className="h-5 w-5" />
              Key Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {lifetimeStatsLoading ? (
              <>
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-sm">Total Tickets</span>
                  <span className="font-mono font-medium">{analytics.totalTickets?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Confirmed</span>
                  <span className="font-mono text-green-600">{analytics.confirmedTickets?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Unique Wallets</span>
                  <span className="font-mono font-medium">{analytics.uniqueWallets?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Total Draws</span>
                  <span className="font-mono font-medium">{analytics.totalDraws?.toLocaleString() || 0}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Current Draw Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Current Draw Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentDrawLoading ? (
              <>
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-sm">Total Tickets</span>
                  <span className="font-mono font-medium">{analytics.currentDrawTickets?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Confirmed</span>
                  <span className="font-mono font-medium text-green-600">{analytics.currentDrawConfirmed?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Pending</span>
                  <span className="font-mono font-medium text-yellow-600">{analytics.currentDrawPending?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Cancelled</span>
                  <span className="font-mono text-red-600">{analytics.currentDrawCancelled?.toLocaleString() || 0}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Lifetime Tickets Analytics
              </CardTitle>
              <CardDescription>
                All-time statistics including archived tickets
              </CardDescription>
            </div>
            <Button
              onClick={fetchAnalytics}
              disabled={currentDrawLoading || lifetimeStatsLoading}
              variant="outline"
              size="sm"
            >
              {(currentDrawLoading || lifetimeStatsLoading) ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {lifetimeStatsLoading ? (
            <div className="grid md:grid-cols-2 gap-6">
              {[1, 2].map(i => (
                <div key={i} className="space-y-4">
                  <Skeleton className="h-4 w-32" />
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map(j => (
                      <Skeleton key={j} className="h-5 w-full" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-4 gap-6">
              {/* Ticket Statistics */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Ticket Activity</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Tickets</span>
                    <span className="font-mono font-medium">{analytics.totalTickets?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Confirmed</span>
                    <span className="font-mono text-green-600">{analytics.confirmedTickets?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Pending</span>
                    <span className="font-mono text-yellow-600">{analytics.pendingTickets?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Cancelled</span>
                    <span className="font-mono text-red-600">{analytics.cancelledTickets?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>

              {/* User & Draw Statistics */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Users & Draws</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Unique Wallets</span>
                    <span className="font-mono font-medium">{analytics.uniqueWallets?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Draws</span>
                    <span className="font-mono font-medium">{analytics.totalDraws?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Completed</span>
                    <span className="font-mono text-green-600">{analytics.completedDraws?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg Tickets/Draw</span>
                    <span className="font-mono font-medium">{analytics.averageTicketsPerDraw?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
