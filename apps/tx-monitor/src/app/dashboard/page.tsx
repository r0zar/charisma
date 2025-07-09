"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Activity, 
  TrendingUp, 
  CheckCircle,
  XCircle,
  RefreshCw,
  BarChart3,
  Clock,
  Zap,
  Database,
  AlertCircle
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts"
import { TransactionMonitoringStats } from '@/components/TransactionMonitoringStats'
import { TransactionQueue } from '@/components/TransactionQueue'
import type { QueueStatsResponse, MetricsHistoryResponse, HealthCheckResponse } from '@/lib/types'

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

// Transform metrics data for charts
const transformMetricsForCharts = (metrics: MetricsHistoryResponse) => {
  return metrics.metrics.map(metric => ({
    time: new Date(metric.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    queueSize: metric.queueSize,
    processed: metric.processed,
    successful: metric.successful,
    failed: metric.failed
  }))
}

async function fetchQueueStats(): Promise<QueueStatsResponse> {
  try {
    const response = await fetch('/api/v1/queue/stats');
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
    
    throw new Error('Failed to fetch queue stats');
  } catch (error) {
    console.error('Failed to fetch queue stats:', error);
    throw error;
  }
}

async function fetchMetricsHistory(hours: number = 24): Promise<MetricsHistoryResponse> {
  try {
    const response = await fetch(`/api/v1/metrics/history?hours=${hours}`);
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
    
    throw new Error('Failed to fetch metrics history');
  } catch (error) {
    console.error('Failed to fetch metrics history:', error);
    throw error;
  }
}

async function fetchHealthCheck(): Promise<HealthCheckResponse> {
  try {
    const response = await fetch('/api/v1/health');
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
    
    throw new Error('Failed to fetch health check');
  } catch (error) {
    console.error('Failed to fetch health check:', error);
    throw error;
  }
}

async function processQueue(): Promise<void> {
  const response = await fetch('/api/v1/admin/trigger', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to process queue');
  }
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [stats, setStats] = useState<QueueStatsResponse | null>(null)
  const [metrics, setMetrics] = useState<MetricsHistoryResponse | null>(null)
  const [health, setHealth] = useState<HealthCheckResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [chartsLoading, setChartsLoading] = useState(true)

  useEffect(() => {
    setMounted(true)
    loadStats()
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const loadStats = async () => {
    try {
      setError(null)
      setChartsLoading(true)
      
      // Fetch all data in parallel
      const [statsData, metricsData, healthData] = await Promise.all([
        fetchQueueStats(),
        fetchMetricsHistory(24),
        fetchHealthCheck().catch(() => null) // Don't fail if health check fails
      ])
      
      setStats(statsData)
      setMetrics(metricsData)
      setHealth(healthData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setChartsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadStats()
    setRefreshing(false)
  }

  const handleProcessQueue = async () => {
    try {
      await processQueue()
      await loadStats()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process queue')
    }
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold">Transaction Monitor Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor queue status, processing metrics, and system health
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleProcessQueue} variant="outline">
            <Zap className="h-4 w-4 mr-2" />
            Process Queue
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Queue Size */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Queue Size</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-3">
              {stats?.queueSize || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Transactions pending
            </p>
          </CardContent>
        </Card>

        {/* Processing Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-2xl font-bold mb-2 ${
              stats?.processingHealth === 'healthy' ? 'text-green-600' : 
              stats?.processingHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {stats?.processingHealth || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              Current status
            </p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">
              {stats?.totalProcessed && stats.totalProcessed > 0 
                ? `${((stats.totalSuccessful / stats.totalProcessed) * 100).toFixed(1)}%`
                : '0%'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalSuccessful || 0} of {stats?.totalProcessed || 0} successful
            </p>
          </CardContent>
        </Card>

        {/* Oldest Transaction */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Oldest Transaction</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">
              {stats?.oldestTransactionAge 
                ? `${Math.round(stats.oldestTransactionAge / (60 * 1000))}m`
                : 'None'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Age of oldest pending
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Charts */}
        <div className="lg:col-span-2 space-y-8">
          {/* Queue Trends Chart */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5" />
                <span>Queue Trends</span>
              </CardTitle>
              <CardDescription>
                Transaction queue size and processing metrics over the last 24 hours
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs defaultValue="queue" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="queue">Queue Size</TabsTrigger>
                  <TabsTrigger value="processing">Processing</TabsTrigger>
                </TabsList>
                <TabsContent value="queue" className="space-y-4">
                  <div className="h-[300px]">
                    {chartsLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-muted-foreground">Loading chart data...</div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metrics ? transformMetricsForCharts(metrics) : []}>
                          <CartesianGrid 
                            strokeDasharray="3 3" 
                            className="opacity-30"
                          />
                          <XAxis 
                            dataKey="time" 
                            fontSize={12}
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            fontSize={12}
                            className="text-muted-foreground"
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Line 
                            type="monotone" 
                            dataKey="queueSize" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="processing" className="space-y-4">
                  <div className="h-[300px]">
                    {chartsLoading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-muted-foreground">Loading chart data...</div>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metrics ? transformMetricsForCharts(metrics) : []}>
                          <CartesianGrid 
                            strokeDasharray="3 3" 
                            className="opacity-30"
                          />
                          <XAxis 
                            dataKey="time" 
                            fontSize={12}
                            className="text-muted-foreground"
                          />
                          <YAxis 
                            fontSize={12}
                            className="text-muted-foreground"
                          />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar 
                            dataKey="successful" 
                            fill="#10b981"
                            opacity={0.8}
                          />
                          <Bar 
                            dataKey="failed" 
                            fill="#ef4444"
                            opacity={0.8}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Transaction Queue Component */}
          <TransactionQueue />
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-8">
          {/* Transaction Monitoring Stats */}
          <TransactionMonitoringStats />

          {/* System Status */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>System Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Cron Job</span>
                <Badge variant={
                  health?.cron === 'healthy' ? 'default' : 
                  health?.cron === 'warning' ? 'secondary' : 'destructive'
                }>
                  {health?.cron === 'healthy' ? 
                    <CheckCircle className="w-3 h-3 mr-1" /> : 
                    <XCircle className="w-3 h-3 mr-1" />
                  }
                  {health?.cron || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">API Health</span>
                <Badge variant={
                  health?.api === 'healthy' ? 'default' : 
                  health?.api === 'warning' ? 'secondary' : 'destructive'
                }>
                  {health?.api === 'healthy' ? 
                    <CheckCircle className="w-3 h-3 mr-1" /> : 
                    <XCircle className="w-3 h-3 mr-1" />
                  }
                  {health?.api || 'Unknown'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Queue Processing</span>
                <Badge variant={
                  health?.queue === 'healthy' ? 'default' : 
                  health?.queue === 'warning' ? 'secondary' : 'destructive'
                }>
                  {health?.queue === 'healthy' ? 
                    <CheckCircle className="w-3 h-3 mr-1" /> : 
                    <XCircle className="w-3 h-3 mr-1" />
                  }
                  {health?.queue || 'Unknown'}
                </Badge>
              </div>
              {health?.lastCronRun && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Last Cron Run</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    {Math.round((Date.now() - health.lastCronRun) / 60000)}m ago
                  </span>
                </div>
              )}
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Processed</span>
                  <span className="text-sm font-mono">{stats?.totalProcessed || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Successful</span>
                  <span className="text-sm font-mono text-green-600">{stats?.totalSuccessful || 0}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Failed</span>
                  <span className="text-sm font-mono text-red-600">{stats?.totalFailed || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>Quick Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Button 
                onClick={handleProcessQueue}
                variant="outline" 
                className="w-full justify-start"
              >
                <Zap className="mr-2 h-4 w-4" />
                Process Queue
              </Button>
              <Button 
                onClick={handleRefresh}
                variant="outline" 
                className="w-full justify-start"
                disabled={refreshing}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Data
              </Button>
              <Button 
                onClick={() => window.location.href = '/'}
                variant="outline" 
                className="w-full justify-start"
              >
                <Database className="mr-2 h-4 w-4" />
                View Queue
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}