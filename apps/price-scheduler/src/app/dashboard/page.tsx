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
  RefreshCw,
  BarChart3,
  Database,
  Clock,
  Zap,
  Settings,
  Calendar,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowUpDown
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import Link from "next/link"

// Types for real price service data
interface SystemStatus {
  status: 'healthy' | 'degraded' | 'error';
  timestamp: number;
  lastUpdate: number | null;
  lastUpdateAge: number | null;
  storage: {
    totalSnapshots: number;
    estimatedStorageGB: number;
  };
  latestSnapshot: {
    timestamp: number;
    tokenCount: number;
    arbitrageOpportunities: number;
    engineStats: {
      oracle: number;
      market: number;
      intrinsic: number;
      hybrid: number;
    };
  } | null;
  environment: {
    INVEST_URL: string;
    SWAP_URL: string;
    NODE_ENV: string;
  };
}

interface EngineHealth {
  engine: string;
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  lastSuccess: number;
  errorRate: number;
  averageResponseTime: number;
  details?: any;
}

// Custom tooltip component
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

export default function DashboardPage() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [engineHealth, setEngineHealth] = useState<EngineHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    fetchSystemData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSystemData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchSystemData = async () => {
    setRefreshing(true)
    try {
      // Fetch real system status
      const statusResponse = await fetch('/api/status')
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setSystemStatus(statusData)
      }

      // Fetch real engine health
      const healthResponse = await fetch('/api/engine-health')
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        if (healthData.success && healthData.engines) {
          setEngineHealth(healthData.engines)
        }
      } else {
        // Fallback engine health data
        setEngineHealth([
          { engine: 'Oracle', status: 'unknown', lastSuccess: Date.now() - 60000, errorRate: 0, averageResponseTime: 0 },
          { engine: 'CPMM', status: 'unknown', lastSuccess: Date.now() - 30000, errorRate: 0, averageResponseTime: 0 },
          { engine: 'Intrinsic', status: 'unknown', lastSuccess: Date.now() - 180000, errorRate: 0, averageResponseTime: 0 }
        ])
      }

    } catch (error) {
      console.error('Error fetching system data:', error)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleManualTrigger = async () => {
    try {
      const response = await fetch('/api/trigger', { method: 'POST' })
      const result = await response.json()
      console.log('Manual trigger result:', result)
      // Refresh data after trigger
      setTimeout(fetchSystemData, 2000)
    } catch (error) {
      console.error('Manual trigger failed:', error)
    }
  }

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'Never'
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60)
      return `${hours}h ${minutes % 60}m ago`
    }
    return `${minutes}m ${seconds}s ago`
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'degraded': return <AlertCircle className="h-4 w-4 text-yellow-600" />
      case 'failed': 
      case 'error': return <XCircle className="h-4 w-4 text-red-600" />
      case 'unknown': return <Activity className="h-4 w-4 text-gray-400" />
      default: return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600'
      case 'degraded': return 'text-yellow-600'
      case 'failed':
      case 'error': return 'text-red-600'
      case 'unknown': return 'text-gray-400'
      default: return 'text-gray-600'
    }
  }

  // Generate engine distribution chart data
  const engineData = systemStatus?.latestSnapshot ? [
    { name: 'Oracle', value: systemStatus.latestSnapshot.engineStats.oracle, color: '#3b82f6' },
    { name: 'Market', value: systemStatus.latestSnapshot.engineStats.market, color: '#10b981' },
    { name: 'Intrinsic', value: systemStatus.latestSnapshot.engineStats.intrinsic, color: '#f59e0b' },
    { name: 'Hybrid', value: systemStatus.latestSnapshot.engineStats.hybrid, color: '#ef4444' }
  ].filter(item => item.value > 0) : []

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading price service dashboard...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold">Price Service Dashboard</h1>
          <p className="text-muted-foreground">
            Monitor the three-engine price discovery system
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchSystemData} disabled={refreshing} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleManualTrigger} variant="outline">
            <Zap className="h-4 w-4 mr-2" />
            Manual Trigger
          </Button>
        </div>
      </div>

      {/* System Status Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* System Health */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">System Health</CardTitle>
            {getStatusIcon(systemStatus?.status || 'unknown')}
          </CardHeader>
          <CardContent className="pt-0">
            <div className={`text-2xl font-bold mb-3 ${getStatusColor(systemStatus?.status || 'unknown')}`}>
              {systemStatus?.status?.charAt(0).toUpperCase() + systemStatus?.status?.slice(1) || 'Unknown'}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">
                {systemStatus?.environment.NODE_ENV || 'unknown'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Last Update */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">
              {formatDuration(systemStatus?.lastUpdateAge || null)}
            </div>
            <p className="text-xs text-muted-foreground">
              {systemStatus?.lastUpdate ? new Date(systemStatus.lastUpdate).toLocaleString() : 'Never'}
            </p>
          </CardContent>
        </Card>

        {/* Tokens Priced */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Tokens Priced</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">
              {systemStatus?.latestSnapshot?.tokenCount || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Last snapshot
            </p>
          </CardContent>
        </Card>

        {/* Storage Used */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2">
              {systemStatus?.storage.estimatedStorageGB.toFixed(2) || '0.00'} GB
            </div>
            <p className="text-xs text-muted-foreground">
              {systemStatus?.storage.totalSnapshots || 0} snapshots
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Engine Status */}
        <div className="lg:col-span-2 space-y-8">
          {/* Engine Health */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5" />
                <span>Engine Health</span>
              </CardTitle>
              <CardDescription>
                Status of the three pricing engines
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-4">
                {engineHealth.map((engine) => (
                  <div key={engine.engine} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(engine.status)}
                      <div>
                        <div className="font-medium">{engine.engine} Engine</div>
                        <div className="text-sm text-muted-foreground">
                          Last success: {formatDuration(Date.now() - engine.lastSuccess)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {Math.round((1 - engine.errorRate) * 100)}% success
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {engine.averageResponseTime}ms avg
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Latest Snapshot Details */}
          {systemStatus?.latestSnapshot && (
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Latest Price Snapshot</span>
                </CardTitle>
                <CardDescription>
                  {new Date(systemStatus.latestSnapshot.timestamp).toLocaleString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">
                      {systemStatus.latestSnapshot.tokenCount}
                    </div>
                    <div className="text-sm text-muted-foreground">Tokens Priced</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">
                      {systemStatus.latestSnapshot.arbitrageOpportunities}
                    </div>
                    <div className="text-sm text-muted-foreground">Arbitrage Opps</div>
                  </div>
                  <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">
                      {Object.values(systemStatus.latestSnapshot.engineStats).reduce((a, b) => a + b, 0)}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Calculations</div>
                  </div>
                </div>

                {/* Engine Distribution Chart */}
                {engineData.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-4">Engine Usage Distribution</h4>
                    <div className="flex items-center gap-8">
                      <div className="h-[200px] w-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Tooltip content={<CustomTooltip />} />
                            <Pie
                              data={engineData}
                              cx="50%"
                              cy="50%"
                              innerRadius={40}
                              outerRadius={80}
                              dataKey="value"
                              strokeWidth={2}
                            >
                              {engineData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2">
                        {engineData.map((item) => (
                          <div key={item.name} className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-sm font-medium">{item.name}</span>
                            <span className="text-sm text-muted-foreground">({item.value})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Actions & System Info */}
        <div className="space-y-8">
          {/* Price System Actions */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5" />
                <span>System Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Link href="/dashboard/history">
                <Button className="w-full justify-start" size="lg">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  View Price History & Export Data
                </Button>
              </Link>
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={handleManualTrigger}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Manual Price Update
                </Button>
                <Link href="/api/status">
                  <Button variant="outline" className="w-full justify-start">
                    <Activity className="mr-2 h-4 w-4" />
                    View System Status
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Environment Info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Environment</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Environment</div>
                <Badge variant="outline">
                  {systemStatus?.environment.NODE_ENV || 'unknown'}
                </Badge>
              </div>
              <Separator />
              <div>
                <div className="text-sm font-medium mb-2">Service URLs</div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Invest:</span>
                    <span className="font-mono text-muted-foreground">
                      {systemStatus?.environment.INVEST_URL || 'Not configured'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Swap:</span>
                    <span className="font-mono text-muted-foreground">
                      {systemStatus?.environment.SWAP_URL || 'Not configured'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Quick Actions</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <Link href="/settings">
                <Button variant="outline" className="w-full justify-start">
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Button>
              </Link>
              <Link href="/docs">
                <Button variant="outline" className="w-full justify-start">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Documentation
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}