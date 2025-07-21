"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { 
  Activity, 
  TrendingUp, 
  RefreshCw,
  BarChart3,
  Database,
  Clock,
  Zap,
  Settings,
  CheckCircle,
  AlertCircle,
  XCircle,
  ArrowUpDown,
  TrendingDown,
  History
} from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts"
import Link from "next/link"

// Combined interface for system status and engine health
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
    BLOB_URL: string | null;
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

export default function UnifiedDashboard() {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null)
  const [engineHealth, setEngineHealth] = useState<EngineHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSystemData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSystemData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchSystemData = async () => {
    setRefreshing(true)
    setError(null)
    
    try {
      // Fetch system status
      const statusResponse = await fetch('/api/status')
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setSystemStatus(statusData)
      } else {
        setError('Failed to fetch system status')
        setSystemStatus(null)
      }

      // Fetch engine health
      const healthResponse = await fetch('/api/engine-health')
      if (healthResponse.ok) {
        const healthData = await healthResponse.json()
        if (healthData.success && healthData.engines) {
          setEngineHealth(healthData.engines)
        } else {
          setError('Engine health data unavailable')
          setEngineHealth([])
        }
      } else {
        setError('Failed to fetch engine health')
        setEngineHealth([])
      }

    } catch (error) {
      console.error('Error fetching system data:', error)
      setError('Failed to connect to service')
      setSystemStatus(null)
      setEngineHealth([])
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

  const handleTestBlobUpload = async () => {
    try {
      const response = await fetch('/api/test-blob', { method: 'POST' })
      const result = await response.json()
      if (result.success) {
        alert(`Blob URL discovered!\n\nFull URL: ${result.fullUrl}\n\nBase URL: ${result.baseUrl}\n\nAdd this to your .env.local:\nBLOB_BASE_URL="${result.baseUrl}/"`)
      } else {
        alert(`Error: ${result.error}`)
      }
    } catch (error) {
      console.error('Test blob upload failed:', error)
      alert('Test blob upload failed - check console')
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Price Service Dashboard</h1>
            <p className="text-muted-foreground">
              Three-Engine Architecture • 5-minute intervals
            </p>
          </div>
          
          {/* Quick Actions & Navigation */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2">
              <Button onClick={fetchSystemData} disabled={refreshing} variant="outline" className="hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button onClick={handleManualTrigger} className="hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary">
                <Zap className="h-4 w-4 mr-2" />
                Manual Trigger
              </Button>
            </div>
            
            {/* Main Navigation */}
            <div className="flex gap-2">
              <Link href="/history">
                <Button variant="outline" className="hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                  <History className="h-4 w-4 mr-2" />
                  Price History
                </Button>
              </Link>
              <Link href="/series">
                <Button variant="outline" className="hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Series Analysis
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Status Banner */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus?.status || 'unknown')}
                  <Badge className={getStatusColor(systemStatus?.status || 'unknown')}>
                    {systemStatus?.status ? (systemStatus.status.charAt(0).toUpperCase() + systemStatus.status.slice(1)) : 'Unknown'}
                  </Badge>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="text-sm text-muted-foreground">
                  Last Update: {formatDuration(systemStatus?.lastUpdateAge || null)}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                {systemStatus?.latestSnapshot?.tokenCount || 0} tokens priced
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Status Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Last Update */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Last Update</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Clock className="h-4 w-4 text-primary" />
            </div>
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
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Tokens Priced</CardTitle>
            <div className="p-2 rounded-lg bg-accent/10 border border-accent/20">
              <BarChart3 className="h-4 w-4 text-accent" />
            </div>
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

        {/* Arbitrage Opportunities */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Arbitrage Opportunities</CardTitle>
            <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20">
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="text-2xl font-bold mb-2 text-orange-600">
              {systemStatus?.latestSnapshot?.arbitrageOpportunities || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Profitable trades
            </p>
          </CardContent>
        </Card>

        {/* Storage Used */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
              <Database className="h-4 w-4 text-secondary" />
            </div>
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
          {/* Left Column - Engine Health */}
          <div className="lg:col-span-2 space-y-6">
            {/* Engine Health Summary */}
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Engine Health Summary
              </CardTitle>
              <CardDescription>
                Status of the three pricing engines
              </CardDescription>
            </CardHeader>
            <CardContent>
              {error && engineHealth.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-center">
                  <div className="space-y-3">
                    <div className="p-3 rounded-full bg-destructive/10 border border-destructive/20 w-fit mx-auto">
                      <Activity className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-destructive mb-1">Engine Health Unavailable</div>
                      <div className="text-xs text-muted-foreground max-w-sm">{error}</div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchSystemData}
                      disabled={refreshing}
                      className="mt-2"
                    >
                      <RefreshCw className={`h-3 w-3 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {engineHealth.map((engine) => (
                    <div key={engine.engine} className="group flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/60 transition-all duration-200 hover:shadow-md">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(engine.status)}
                        <div>
                          <div className="font-medium">{engine.engine}</div>
                          <div className="text-sm text-muted-foreground">
                            {Math.round((1 - engine.errorRate) * 100)}% success
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {engine.averageResponseTime}ms
                        </div>
                        <div className="text-xs text-muted-foreground">
                          avg response
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Engine Distribution */}
          {engineData.length > 0 && (
            <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Engine Usage Distribution
                </CardTitle>
                <CardDescription>
                  Latest snapshot engine usage breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Pie
                          data={engineData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          dataKey="value"
                          strokeWidth={2}
                          label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                        >
                          {engineData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-4">
                    {engineData.map((item) => (
                      <div key={item.name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border/30">
                        <div className="flex items-center gap-3">
                          <div 
                            className="w-4 h-4 rounded-full" 
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium">{item.name} Engine</span>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold">{item.value}</div>
                          <div className="text-sm text-muted-foreground">tokens</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Configuration & Actions */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={handleTestBlobUpload} variant="outline" className="w-full justify-start">
                <Database className="mr-2 h-4 w-4" />
                Test Blob Storage
              </Button>
              <Link href="/api/status" className="w-full block">
                <Button variant="outline" className="w-full justify-start">
                  <Activity className="mr-2 h-4 w-4" />
                  API Status
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Environment Info */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Environment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Mode</div>
                <Badge variant="outline">
                  {systemStatus?.environment.NODE_ENV || 'unknown'}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium mb-2">Storage</div>
                <div className="text-xs text-muted-foreground">
                  {systemStatus?.environment.BLOB_URL ? (
                    <span className="text-green-600">✓ Configured</span>
                  ) : (
                    <span className="text-yellow-600">⚠ Not configured</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
    </div>
  )
}