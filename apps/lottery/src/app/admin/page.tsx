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

export default function AdminDashboard() {
  const [config, setConfig] = useState<LotteryConfig | null>(null)
  const [analytics, setAnalytics] = useState<any>({})
  const [configLoading, setConfigLoading] = useState(true)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)

  const adminKey = typeof window !== 'undefined' ? localStorage.getItem('admin-key') || '' : ''

  useEffect(() => {
    fetchConfig()
    fetchAnalytics()
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

  const fetchAnalytics = async () => {
    setAnalyticsLoading(true)
    try {
      // Use the fast stats endpoint that reads from KV counters
      const statsResponse = await fetch('/api/admin/stats', {
        headers: { 'x-admin-key': adminKey }
      })

      if (!statsResponse.ok) {
        throw new Error('Failed to fetch stats data')
      }

      const statsData = await statsResponse.json()
      const stats = statsData.data || {}

      setAnalytics({
        // Lifetime stats
        totalTickets: stats.totalTickets || 0,
        confirmedTickets: stats.confirmedTickets || 0,
        uniqueWallets: stats.uniqueWallets || 0,
        totalDraws: stats.totalDraws || 0,
        completedDraws: stats.completedDraws || 0,
        averageTicketsPerDraw: stats.averageTicketsPerDraw || 0,

        // Current draw stats
        currentDrawTickets: stats.currentDrawTickets || 0,
        currentDrawConfirmed: stats.currentDrawConfirmed || 0,
        currentDrawPending: stats.currentDrawPending || 0,
        currentDrawCancelled: stats.currentDrawCancelled || 0,
        currentDrawUniqueWallets: stats.currentDrawUniqueWallets || 0,

        // Recent activity (TODO)
        recentConfirmedTickets: stats.recentConfirmedTickets || 0,
        recentDraws: stats.recentDraws || 0
      })
    } catch (err) {
      console.error('Failed to fetch analytics:', err)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const currentDrawRevenue = analytics.currentDrawConfirmed * (config?.ticketPrice || 0)
  const conversionRate = analytics.currentDrawTickets > 0
    ? ((analytics.currentDrawConfirmed / analytics.currentDrawTickets) * 100).toFixed(1)
    : '0'
  const avgTicketsPerWallet = analytics.currentDrawUniqueWallets > 0
    ? (analytics.currentDrawTickets / analytics.currentDrawUniqueWallets).toFixed(1)
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
            {analyticsLoading ? (
              <Skeleton className="h-7 w-48" />
            ) : (
              <Badge variant="outline" className="text-base">
                {analytics.currentDrawTickets?.toLocaleString() || 0} Current Draw Tickets
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
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
                  <Trophy className="h-4 w-4" />
                  Total Draws
                </div>
                <div className="text-2xl font-bold">
                  {analytics.totalDraws?.toLocaleString() || 0}
                </div>
                <div className="text-xs text-muted-foreground">
                  {analytics.completedDraws?.toLocaleString() || 0} completed
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
            {analyticsLoading ? (
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

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="h-5 w-5" />
              Last 30 Days
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analyticsLoading ? (
              <>
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span className="text-sm">Confirmed Tickets</span>
                  <span className="font-mono font-medium text-blue-600">{analytics.recentConfirmedTickets?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">New Draws</span>
                  <span className="font-mono font-medium text-blue-600">{analytics.recentDraws?.toLocaleString() || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Activity Rate</span>
                  <span className="font-mono text-sm">
                    {analytics.recentConfirmedTickets > 0 ? `${(analytics.recentConfirmedTickets / 30).toFixed(1)}/day` : '0/day'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm">Current Draw</span>
                  <span className="font-mono font-medium">{analytics.currentDrawConfirmed?.toLocaleString() || 0} tickets</span>
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
                Active Tickets Analytics
              </CardTitle>
              <CardDescription>
                Statistics for all active (non-archived) tickets
              </CardDescription>
            </div>
            <Button
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
              variant="outline"
              size="sm"
            >
              {analyticsLoading ? (
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
          {analyticsLoading ? (
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
