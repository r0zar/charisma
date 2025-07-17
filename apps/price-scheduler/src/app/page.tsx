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

  useEffect(() => {
    fetchSystemData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchSystemData, 30000)
    return () => clearInterval(interval)
  }, [])

  const fetchSystemData = async () => {
    setRefreshing(true)
    try {
      // Fetch system status
      const statusResponse = await fetch('/api/status')
      if (statusResponse.ok) {
        const statusData = await statusResponse.json()
        setSystemStatus(statusData)
      }

      // Fetch engine health
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
    <div className="container mx-auto p-6 space-y-8">
      {/* Header with Status Indicator */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Price Service Dashboard</h1>
            <p className="text-muted-foreground">
              Three-Engine Architecture • 5-minute intervals
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(systemStatus?.status || 'unknown')}
            <Badge className={getStatusColor(systemStatus?.status || 'unknown')}>
              {systemStatus?.status ? (systemStatus.status.charAt(0).toUpperCase() + systemStatus.status.slice(1)) : 'Unknown'}
            </Badge>
          </div>
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

        {/* Arbitrage Opportunities */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Arbitrage Opportunities</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
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

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engines">Engines</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Engine Health Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Engine Health Summary
              </CardTitle>
              <CardDescription>
                Status of the three pricing engines
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {engineHealth.map((engine) => (
                  <div key={engine.engine} className="flex items-center justify-between p-4 rounded-lg border border-border">
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
            </CardContent>
          </Card>

          {/* Engine Distribution */}
          {engineData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
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
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
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
                      <div key={item.name} className="flex items-center justify-between p-3 bg-muted rounded-lg">
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
        </TabsContent>

        <TabsContent value="engines" className="space-y-6">
          {/* Detailed Engine Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Detailed Engine Health
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {engineHealth.map((engine) => (
                  <div key={engine.engine} className="p-4 rounded-lg border border-border">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(engine.status)}
                        <div>
                          <div className="font-medium">{engine.engine} Engine</div>
                          <div className="text-sm text-muted-foreground">
                            Last success: {formatDuration(Date.now() - engine.lastSuccess)}
                          </div>
                        </div>
                      </div>
                      <Badge variant={engine.status === 'healthy' ? 'default' : engine.status === 'degraded' ? 'secondary' : 'destructive'}>
                        {engine.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Success Rate</div>
                        <div className="font-medium">{Math.round((1 - engine.errorRate) * 100)}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg Response</div>
                        <div className="font-medium">{engine.averageResponseTime}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Error Rate</div>
                        <div className="font-medium">{Math.round(engine.errorRate * 100)}%</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-6">
          {/* Environment Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Environment Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm font-medium mb-2">Environment</div>
                <Badge variant="outline">
                  {systemStatus?.environment.NODE_ENV || 'unknown'}
                </Badge>
              </div>
              <Separator />
              <div>
                <div className="text-sm font-medium mb-2">Service URLs</div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Invest Service:</span>
                    <span className="font-mono text-muted-foreground">
                      {systemStatus?.environment.INVEST_URL || 'Not configured'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Swap Service:</span>
                    <span className="font-mono text-muted-foreground">
                      {systemStatus?.environment.SWAP_URL || 'Not configured'}
                    </span>
                  </div>
                </div>
              </div>
              <Separator />
              <div>
                <div className="text-sm font-medium mb-2">Blob Storage</div>
                <div className="space-y-2">
                  <div className="p-2 bg-muted rounded text-xs font-mono break-all">
                    {systemStatus?.environment.BLOB_URL ? (
                      <a 
                        href={systemStatus.environment.BLOB_URL} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline"
                      >
                        {systemStatus.environment.BLOB_URL}
                      </a>
                    ) : (
                      'Not configured'
                    )}
                  </div>
                  {!systemStatus?.environment.BLOB_URL && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleTestBlobUpload}
                      className="w-full"
                    >
                      <Database className="mr-2 h-3 w-3" />
                      Test Upload & Get URL
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions" className="space-y-6">
          {/* System Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                System Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  onClick={handleManualTrigger}
                  className="w-full justify-start"
                  size="lg"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Manual Price Update
                </Button>
                <Button 
                  onClick={fetchSystemData}
                  variant="outline"
                  className="w-full justify-start"
                  size="lg"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh System Data
                </Button>
                <Link href="/history" className="w-full">
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <History className="mr-2 h-4 w-4" />
                    View Price History
                  </Button>
                </Link>
                <Link href="/api/status" className="w-full">
                  <Button variant="outline" className="w-full justify-start" size="lg">
                    <Activity className="mr-2 h-4 w-4" />
                    API Status Endpoint
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}