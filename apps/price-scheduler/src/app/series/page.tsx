"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  BarChart3,
  Clock,
  Zap,
  Database,
  Download,
  Eye,
  LineChart as LineChartIcon,
  ArrowUpDown,
  Filter,
  History
} from "lucide-react"
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine
} from "recharts"
import Link from "next/link"
import { TokenInfo, TokenInfoCard } from "@/components/token-info"

interface TokenData {
  tokenId: string
  symbol: string
  name: string
  image: string
  usdPrice: number
  confidence: number
  totalLiquidity: number
  isLpToken: boolean
  nestLevel: number
  priceSource: string
  isArbitrageOpportunity: boolean
  priceDeviation: number
  lastUpdated: number
}

interface TimeSeriesPoint {
  timestamp: number
  time: number
  value: number
  usdPrice: number
  confidence: number
  volume: number
  liquidity: number
}

interface SeriesData {
  tokenId: string
  symbol: string
  name: string
  image: string
  currentPrice: number
  confidence: number
  totalLiquidity: number
  isLpToken: boolean
  nestLevel: number
  priceSource: string
  isArbitrageOpportunity: boolean
  priceDeviation: number
  series: TimeSeriesPoint[]
  primaryPath?: any
  alternativePaths?: any[]
  calculationDetails?: any
}

// Custom tooltip component factory
const createCustomTooltip = (seriesDataMap: Record<string, SeriesData>) => ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground mb-2">
          {new Date(label).toLocaleString()}
        </p>
        {payload.map((entry: any, index: number) => {
          // Find the corresponding series data to get confidence
          const tokenSymbol = entry.name;
          const tokenSeries = Object.values(seriesDataMap).find(
            (series: any) => series.symbol === tokenSymbol
          ) as any;
          
          return (
            <div key={index} className="text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium" style={{ color: entry.color }}>
                  {entry.name}:
                </span>{' '}
                ${entry.value.toFixed(8)}
              </p>
              {tokenSeries && (
                <p className="text-xs text-muted-foreground">
                  Confidence: {Math.round((tokenSeries.confidence || 0) * 100)}%
                </p>
              )}
            </div>
          );
        })}
      </div>
    )
  }
  return null
}

export default function SeriesPage() {
  const [availableTokens, setAvailableTokens] = useState<TokenData[]>([])
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([])
  const [seriesData, setSeriesData] = useState<Record<string, SeriesData>>({})
  const [timeframe, setTimeframe] = useState('5m')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [useLogScale, setUseLogScale] = useState(false)
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setHours(date.getHours() - 24) // 24 hours ago
    return date.toISOString().slice(0, 16) // Format for datetime-local
  })
  const [endDate, setEndDate] = useState(() => {
    const date = new Date()
    return date.toISOString().slice(0, 16) // Format for datetime-local
  })

  // Fetch available tokens on component mount
  useEffect(() => {
    fetchAvailableTokens()
  }, [])

  // Fetch series data when tokens, timeframe, or date range changes
  useEffect(() => {
    if (selectedTokenIds.length > 0) {
      fetchSeriesData()
    }
  }, [selectedTokenIds, timeframe, startDate, endDate])

  const fetchAvailableTokens = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/v1/series/tokens?limit=100')
      const data = await response.json()
      
      if (data.status === 'success') {
        setAvailableTokens(data.data)
      } else {
        setError(data.message || 'Failed to fetch tokens')
        setAvailableTokens([])
      }
    } catch (err) {
      console.error('Error fetching tokens:', err)
      setError('Failed to fetch available tokens')
      setAvailableTokens([])
    } finally {
      setLoading(false)
    }
  }

  const fetchSeriesData = async () => {
    if (selectedTokenIds.length === 0) return
    
    try {
      setChartLoading(true)
      setError(null)
      
      const response = await fetch('/api/v1/series/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tokenIds: selectedTokenIds,
          timeframe,
          limit: 100,
          includeDetails: true,
          startDate: startDate ? new Date(startDate).getTime() : undefined,
          endDate: endDate ? new Date(endDate).getTime() : undefined
        })
      })
      
      const data = await response.json()
      
      if (data.status === 'success') {
        setSeriesData(data.data)
      } else {
        setError(data.message || 'Failed to fetch series data')
        setSeriesData({})
      }
    } catch (err) {
      console.error('Error fetching series data:', err)
      setError('Failed to fetch series data')
      setSeriesData({})
    } finally {
      setChartLoading(false)
    }
  }

  const handleTokenToggle = (tokenId: string) => {
    setSelectedTokenIds(prev => 
      prev.includes(tokenId) 
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId].slice(0, 5) // Limit to 5 tokens
    )
  }

  const exportData = async (format: 'json' | 'csv' = 'json') => {
    if (selectedTokenIds.length === 0) {
      alert('Please select at least one token to export')
      return
    }

    setExporting(true)
    try {
      const exportData = {
        tokens: selectedTokenIds.map(tokenId => {
          const series = seriesData[tokenId]
          if (!series) return null
          
          return {
            tokenId: series.tokenId,
            symbol: series.symbol,
            name: series.name,
            currentPrice: series.currentPrice,
            confidence: series.confidence,
            totalLiquidity: series.totalLiquidity,
            isLpToken: series.isLpToken,
            priceSource: series.priceSource,
            isArbitrageOpportunity: series.isArbitrageOpportunity,
            priceDeviation: series.priceDeviation,
            timeSeries: series.series
          }
        }).filter(Boolean),
        metadata: {
          timeframe,
          exportedAt: new Date().toISOString(),
          totalTokens: selectedTokenIds.length,
          dataPoints: Object.values(seriesData)[0]?.series.length || 0
        }
      }

      const jsonString = JSON.stringify(exportData, null, 2)
      const blob = new Blob([jsonString], { type: 'application/json' })
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl

      const timestamp = new Date().toISOString().split('T')[0]
      const filename = `price-series-${timeframe}-${timestamp}.${format}`

      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(downloadUrl)

    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed - check console for details')
    } finally {
      setExporting(false)
    }
  }

  const filteredTokens = availableTokens.filter(token => 
    searchTerm === '' || 
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Prepare chart data combining all selected tokens
  const chartData = selectedTokenIds.length > 0 && Object.keys(seriesData).length > 0
    ? (() => {
        const allTimestamps = new Set<number>()
        
        // Collect all timestamps
        Object.values(seriesData).forEach(series => {
          series.series.forEach(point => allTimestamps.add(point.timestamp))
        })
        
        // Sort timestamps
        const sortedTimestamps = Array.from(allTimestamps).sort()
        
        // Create combined data points
        return sortedTimestamps.map(timestamp => {
          const dataPoint: any = { timestamp }
          
          Object.entries(seriesData).forEach(([tokenId, series]) => {
            const point = series.series.find(p => p.timestamp === timestamp)
            if (point) {
              dataPoint[series.symbol] = point.value
            } else {
              // Find the closest previous point for interpolation
              const previousPoints = series.series.filter(p => p.timestamp < timestamp).sort((a, b) => b.timestamp - a.timestamp)
              if (previousPoints.length > 0) {
                dataPoint[series.symbol] = previousPoints[0].value
              }
            }
          })
          
          return dataPoint
        })
      })()
    : []

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="p-6 space-y-6 max-w-screen-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Price Series Analysis</h1>
            <p className="text-muted-foreground">Interactive price charts and arbitrage analysis</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2">
              <Button
                onClick={fetchAvailableTokens}
                variant="outline"
                disabled={loading}
                className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => exportData('json')}
                variant="outline"
                disabled={exporting || selectedTokenIds.length === 0}
                className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80"
              >
                <Download className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} />
                Export Data
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Link href="/">
                <Button variant="outline" className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                  <ArrowUpDown className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/history">
                <Button variant="outline" className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                  <History className="w-4 h-4" />
                  Price History
                </Button>
              </Link>
            </div>
          </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Token Selection */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Token Selection
            </CardTitle>
            <CardDescription>
              Select up to 5 tokens to analyze ({selectedTokenIds.length}/5)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search tokens..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {loading ? (
                <div className="space-y-2">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="skeleton-loading h-12 rounded-md" />
                  ))}
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-8 text-center">
                  <div className="space-y-3">
                    <div className="p-3 rounded-full bg-destructive/10 border border-destructive/20 w-fit mx-auto">
                      <Activity className="h-6 w-6 text-destructive" />
                    </div>
                    <div>
                      <div className="font-medium text-sm text-destructive mb-1">Failed to Load Tokens</div>
                      <div className="text-xs text-muted-foreground max-w-sm">{error}</div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={fetchAvailableTokens}
                      className="mt-2"
                    >
                      <RefreshCw className="h-3 w-3 mr-2" />
                      Retry
                    </Button>
                  </div>
                </div>
              ) : filteredTokens.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-center">
                  <div className="space-y-3">
                    <div className="p-3 rounded-full bg-muted/50 w-fit mx-auto">
                      <Search className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="font-medium text-sm mb-1">No Tokens Found</div>
                      <div className="text-xs text-muted-foreground">
                        {searchTerm ? `No tokens match "${searchTerm}"` : 'No tokens available'}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {filteredTokens.map((token) => (
                    <div
                      key={token.tokenId}
                      className={`p-3 rounded-lg border cursor-pointer transition-all duration-200 ${
                        selectedTokenIds.includes(token.tokenId)
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }`}
                      onClick={() => handleTokenToggle(token.tokenId)}
                    >
                      <div className="flex items-center justify-between">
                        <TokenInfo contractId={token.tokenId} />
                        <div className="text-right">
                          <div className="text-sm font-medium">${token.usdPrice.toFixed(6)}</div>
                          <div className="flex items-center gap-1 text-xs">
                            <div className={`font-medium ${
                              token.confidence > 0.8 ? 'text-green-500' :
                              token.confidence > 0.6 ? 'text-yellow-500' : 'text-red-500'
                            }`}>
                              {Math.round(token.confidence * 100)}%
                            </div>
                            {token.isLpToken && (
                              <Badge variant="outline" className="text-xs">LP</Badge>
                            )}
                            {token.isArbitrageOpportunity && (
                              <Badge variant="destructive" className="text-xs">ARB</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Timeframe Selection */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Timeframe & Range
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Interval</label>
                <Select value={timeframe} onValueChange={setTimeframe}>
                  <SelectTrigger className="bg-background border-accent/50 hover:border-accent transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1m">1 Minute</SelectItem>
                    <SelectItem value="5m">5 Minutes</SelectItem>
                    <SelectItem value="1h">1 Hour</SelectItem>
                    <SelectItem value="1d">1 Day</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Start Date</label>
                  <Input
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">End Date</label>
                  <Input
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Selected Tokens</span>
                <span className="font-medium">{selectedTokenIds.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Available Tokens</span>
                <span className="font-medium">{availableTokens.length}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Arbitrage Opportunities</span>
                <span className="font-medium text-orange-500">
                  {availableTokens.filter(t => t.isArbitrageOpportunity).length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chart Options */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Chart Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Logarithmic Scale</span>
                <Button
                  variant={useLogScale ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUseLogScale(!useLogScale)}
                  className="h-7 px-2 text-xs"
                >
                  {useLogScale ? 'ON' : 'OFF'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-500/20 bg-red-500/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-red-600">
              <Activity className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Chart */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LineChartIcon className="h-5 w-5 text-primary" />
            Price Series Chart
          </CardTitle>
          <CardDescription>
            {selectedTokenIds.length > 0 ? (
              `Showing ${selectedTokenIds.length} token${selectedTokenIds.length > 1 ? 's' : ''} over ${timeframe} intervals`
            ) : (
              'Select tokens to view price series'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {chartLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-6 w-6 animate-spin" />
                <span>Loading chart data...</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-96">
              <div className="text-center space-y-4">
                <div className="p-4 rounded-full bg-destructive/10 border border-destructive/20 mb-4 w-fit mx-auto">
                  <Activity className="h-8 w-8 text-destructive" />
                </div>
                <div>
                  <div className="text-sm font-medium text-destructive mb-2">Failed to Load Chart Data</div>
                  <div className="text-xs text-muted-foreground max-w-md mx-auto mb-4">{error}</div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setError(null)
                      fetchAvailableTokens()
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          ) : selectedTokenIds.length === 0 ? (
            <div className="flex items-center justify-center h-96 text-muted-foreground">
              <div className="text-center">
                <div className="p-4 rounded-full bg-accent/20 mb-4 w-fit mx-auto">
                  <LineChartIcon className="h-8 w-8 opacity-50" />
                </div>
                <div className="text-sm font-medium">Select tokens to view price series</div>
                <div className="text-xs text-muted-foreground mt-1">Choose up to 5 tokens from the selection panel</div>
              </div>
            </div>
          ) : (
            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="timestamp"
                    type="number"
                    scale="time"
                    domain={['dataMin', 'dataMax']}
                    tickFormatter={(timestamp) => new Date(timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                    stroke="white"
                    tick={{ fill: 'white' }}
                  />
                  <YAxis 
                    scale={useLogScale ? "log" : "linear"}
                    domain={useLogScale ? ['auto', 'auto'] : ['dataMin', 'dataMax']}
                    stroke="white"
                    tick={{ fill: 'white' }}
                    width={80}
                    tickFormatter={(value) => {
                      if (value >= 1) {
                        return `$${value.toFixed(2)}`;
                      } else if (value >= 0.01) {
                        return `$${value.toFixed(4)}`;
                      } else {
                        return `$${value.toFixed(8)}`;
                      }
                    }}
                  />
                  <Tooltip content={createCustomTooltip(seriesData)} />
                  
                  {Object.entries(seriesData).map(([tokenId, series], index) => (
                    <Line
                      key={tokenId}
                      type="monotone"
                      dataKey={series.symbol}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={false}
                      name={series.symbol}
                      connectNulls={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Selected Tokens Details */}
      {selectedTokenIds.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {selectedTokenIds.map((tokenId) => {
            const series = seriesData[tokenId]
            if (!series) return null
            
            const latestPoint = series.series[series.series.length - 1]
            const firstPoint = series.series[0]
            const priceChange = latestPoint && firstPoint ? 
              ((latestPoint.value - firstPoint.value) / firstPoint.value) * 100 : 0
            
            return (
              <Card key={tokenId} className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <TokenInfo contractId={tokenId} />
                    <div className="flex items-center gap-1">
                      {series.isLpToken && (
                        <Badge variant="outline" className="text-xs">LP</Badge>
                      )}
                      {series.isArbitrageOpportunity && (
                        <Badge variant="destructive" className="text-xs">ARB</Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Current Price</span>
                      <span className="font-medium">${series.currentPrice.toFixed(8)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Price Change</span>
                      <span className={`font-medium ${
                        priceChange > 0 ? 'text-green-500' : 
                        priceChange < 0 ? 'text-red-500' : 'text-muted-foreground'
                      }`}>
                        {priceChange > 0 ? '+' : ''}{priceChange.toFixed(2)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Confidence</span>
                      <span className={`font-medium ${
                        series.confidence > 0.8 ? 'text-green-500' :
                        series.confidence > 0.6 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        {Math.round(series.confidence * 100)}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Liquidity</span>
                      <span className="font-medium">${series.totalLiquidity.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Source</span>
                      <Badge variant="outline" className="text-xs">{series.priceSource}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}