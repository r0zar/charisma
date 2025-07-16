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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts"
import { TransactionQueue } from '@/components/TransactionQueue'
import type { QueueStatsResponse, MetricsHistoryResponse, HealthCheckResponse } from '@/lib/types'

// Custom tooltip component that uses theme styles
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3 min-w-[200px]">
        <p className="text-sm font-medium text-foreground mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-muted-foreground">{entry.name || entry.dataKey}:</span>
              </div>
              <span className="font-medium text-foreground">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// Custom legend component
const CustomLegend = ({ payload }: any) => {
  if (payload && payload.length) {
    return (
      <div className="flex flex-wrap gap-2 sm:gap-4 justify-center mt-4">
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-1 sm:gap-2">
            <div 
              className="w-2 h-2 sm:w-3 sm:h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-xs sm:text-sm text-muted-foreground">{entry.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// Transform metrics data for charts
const transformMetricsForCharts = (metrics: MetricsHistoryResponse) => {
  return metrics.metrics.map(metric => {
    const date = new Date(metric.timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    // Show more detailed time formatting
    const timeFormat = isToday 
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
    
    return {
      time: timeFormat,
      // Transaction metrics
      queueSize: metric.queueSize,
      processed: metric.processed,
      successful: metric.successful,
      failed: metric.failed,
      // Activity metrics
      activityCompleted: metric.activities?.completed || 0,
      activityPending: metric.activities?.pending || 0,
      activityFailed: metric.activities?.failed || 0,
      activityCancelled: metric.activities?.cancelled || 0,
      activityProcessing: metric.activities?.processing || 0
    };
  });
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

// Calculate appropriate time range based on oldest transaction and activity data
function calculateTimeRange(oldestTransactionAge?: number, oldestActivityAge?: number): number {
  // Find the oldest data point between transactions and activities
  const ages = [oldestTransactionAge, oldestActivityAge].filter((age): age is number => age !== undefined);
  
  if (ages.length === 0) return 24; // Default to 24 hours
  
  const oldestAge = Math.max(...ages);
  const ageInHours = Math.ceil(oldestAge / (60 * 60 * 1000));
  
  // Add some buffer and cap at 7 days max
  const bufferedHours = Math.min(ageInHours + 2, 168);
  
  // More responsive minimum - use actual age if over 1 hour, otherwise 24 hours
  const minHours = ageInHours > 1 ? Math.max(ageInHours + 2, 6) : 24;
  
  const finalHours = Math.max(bufferedHours, minHours);
  
  // Debug logging
  console.log('[DASHBOARD] Time range calculation:', {
    oldestTransactionAge,
    oldestActivityAge,
    oldestAge,
    ageInHours,
    bufferedHours,
    minHours,
    finalHours
  });
  
  return finalHours;
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

async function fetchActivityStats(): Promise<any> {
  try {
    const response = await fetch('/api/v1/activities/stats');
    const data = await response.json();
    
    if (data.success) {
      return data.data;
    }
    
    throw new Error('Failed to fetch activity stats');
  } catch (error) {
    console.error('Failed to fetch activity stats:', error);
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
  const [activityStats, setActivityStats] = useState<any>(null)
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
      
      // First fetch queue stats and activity stats to determine appropriate time range
      const [statsData, activityData] = await Promise.all([
        fetchQueueStats(),
        fetchActivityStats().catch(() => null) // Don't fail if activity stats fail
      ])
      
      const timeRange = calculateTimeRange(
        statsData.oldestTransactionAge,
        activityData?.oldestActivityAge
      )
      
      console.log('[DASHBOARD] Calculated time range:', timeRange, 'hours')
      
      // Fetch remaining data in parallel with dynamic time range
      const [metricsData, healthData] = await Promise.all([
        fetchMetricsHistory(timeRange),
        fetchHealthCheck().catch(() => null), // Don't fail if health check fails
      ])
      
      setStats(statsData)
      setMetrics(metricsData)
      setHealth(healthData)
      setActivityStats(activityData)
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
        {/* Activity Creation Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Activity Rate</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-3">
              {activityStats?.pipeline?.activityCreationRate || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Activities per hour
            </p>
          </CardContent>
        </Card>

        {/* Pipeline Health Score */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Pipeline Health</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-2xl font-bold mb-2 ${
              (activityStats?.pipeline?.healthScore || 0) >= 80 ? 'text-green-600' : 
              (activityStats?.pipeline?.healthScore || 0) >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {Math.round(activityStats?.pipeline?.healthScore || 0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall health score
            </p>
          </CardContent>
        </Card>

        {/* Activity Success Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">
              {activityStats?.pipeline?.successRate !== undefined
                ? `${activityStats.pipeline.successRate.toFixed(1)}%`
                : '0%'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Activities completed successfully
            </p>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">
              {activityStats?.pipeline?.activeUsers || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Users active in 24h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Additional Pipeline Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Processing Lag */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Processing Lag</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">
              {activityStats?.pipeline?.processingLag 
                ? `${Math.round(activityStats.pipeline.processingLag / (60 * 1000))}m`
                : '0m'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Avg time to completion
            </p>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Error Rate</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-2xl font-bold mb-2 ${
              (activityStats?.pipeline?.errorRate || 0) < 5 ? 'text-green-600' : 
              (activityStats?.pipeline?.errorRate || 0) < 15 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {activityStats?.pipeline?.errorRate !== undefined
                ? `${activityStats.pipeline.errorRate.toFixed(1)}%`
                : '0%'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Failed/cancelled activities
            </p>
          </CardContent>
        </Card>

        {/* Total Activities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Total Activities</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">
              {activityStats?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Activities in system
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
                Transaction and activity processing metrics over the last {metrics?.period || '24h'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <Tabs defaultValue="transactions" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="transactions">Transactions</TabsTrigger>
                  <TabsTrigger value="activities">Activities</TabsTrigger>
                </TabsList>
                <TabsContent value="transactions" className="space-y-4">
                  <div className="h-[250px] sm:h-[300px]">
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
                          <Legend content={<CustomLegend />} />
                          {/* Queue Size - Blue solid line */}
                          <Line 
                            type="monotone" 
                            dataKey="queueSize" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                            name="Queue Size"
                          />
                          {/* Successful Transactions - Green solid line */}
                          <Line 
                            type="monotone" 
                            dataKey="successful" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                            name="Successful"
                          />
                          {/* Failed Transactions - Red solid line */}
                          <Line 
                            type="monotone" 
                            dataKey="failed" 
                            stroke="#ef4444" 
                            strokeWidth={3}
                            dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                            name="Failed"
                          />
                          {/* Total Processed - Purple dashed line */}
                          <Line 
                            type="monotone" 
                            dataKey="processed" 
                            stroke="#8b5cf6" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ fill: "#8b5cf6", strokeWidth: 2, r: 3 }}
                            name="Total Processed"
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </TabsContent>
                <TabsContent value="activities" className="space-y-4">
                  <div className="h-[250px] sm:h-[300px]">
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
                          <Legend content={<CustomLegend />} />
                          {/* Completed Activities - Green solid line */}
                          <Line 
                            type="monotone" 
                            dataKey="activityCompleted" 
                            stroke="#10b981" 
                            strokeWidth={3}
                            dot={{ fill: "#10b981", strokeWidth: 2, r: 4 }}
                            name="Completed"
                          />
                          {/* Pending Activities - Yellow/Orange solid line */}
                          <Line 
                            type="monotone" 
                            dataKey="activityPending" 
                            stroke="#f59e0b" 
                            strokeWidth={3}
                            dot={{ fill: "#f59e0b", strokeWidth: 2, r: 4 }}
                            name="Pending"
                          />
                          {/* Failed Activities - Red solid line */}
                          <Line 
                            type="monotone" 
                            dataKey="activityFailed" 
                            stroke="#ef4444" 
                            strokeWidth={3}
                            dot={{ fill: "#ef4444", strokeWidth: 2, r: 4 }}
                            name="Failed"
                          />
                          {/* Processing Activities - Blue solid line */}
                          <Line 
                            type="monotone" 
                            dataKey="activityProcessing" 
                            stroke="#3b82f6" 
                            strokeWidth={3}
                            dot={{ fill: "#3b82f6", strokeWidth: 2, r: 4 }}
                            name="Processing"
                          />
                          {/* Cancelled Activities - Brown dashed line */}
                          <Line 
                            type="monotone" 
                            dataKey="activityCancelled" 
                            stroke="#8b5a2b" 
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            dot={{ fill: "#8b5a2b", strokeWidth: 2, r: 3 }}
                            name="Cancelled"
                          />
                        </LineChart>
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
          {/* Activity Integration */}
          {activityStats && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5" />
                  <span>Activity Timeline</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Activities</span>
                  <span className="text-sm font-mono">{activityStats.total || 0}</span>
                </div>
                {activityStats.byType && Object.entries(activityStats.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground capitalize">{type.replace('_', ' ')}</span>
                    <span className="text-sm font-mono">{count as number}</span>
                  </div>
                ))}
                <Separator />
                {activityStats.byStatus && Object.entries(activityStats.byStatus).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground capitalize">{status}</span>
                    <span className={`text-sm font-mono ${
                      status === 'completed' ? 'text-green-600' : 
                      status === 'failed' ? 'text-red-600' : 
                      status === 'pending' ? 'text-yellow-600' : ''
                    }`}>
                      {count as number}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

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