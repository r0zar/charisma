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
  Filter
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

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-background border border-border rounded-lg shadow-lg p-3">
        <p className="text-sm font-medium text-foreground mb-2">
          {new Date(label).toLocaleString()}
        </p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="text-sm">
            <p className="text-muted-foreground">
              <span className="font-medium" style={{ color: entry.color }}>
                {entry.name}:
              </span>{' '}
              ${entry.value.toFixed(8)}
            </p>
            <p className="text-xs text-muted-foreground">
              Confidence: {Math.round(data.confidence * 100)}%
            </p>
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function SeriesPage() {
  const [availableTokens, setAvailableTokens] = useState<TokenData[]>([])
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([])
  const [seriesData, setSeriesData] = useState<Record<string, SeriesData>>({})
  const [timeframe, setTimeframe] = useState('1h')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [chartLoading, setChartLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  // Fetch available tokens on component mount
  useEffect(() => {
    fetchAvailableTokens()
  }, [])

  // Fetch series data when tokens or timeframe changes
  useEffect(() => {
    if (selectedTokenIds.length > 0) {
      fetchSeriesData()
    }
  }, [selectedTokenIds, timeframe])

  const fetchAvailableTokens = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch('/api/v1/series/tokens?limit=100')
      const data = await response.json()
      
      if (data.status === 'success') {
        setAvailableTokens(data.data)
        
        // Auto-select first few tokens for demo
        if (data.data.length > 0) {
          const autoSelected = data.data.slice(0, 3).map((token: TokenData) => token.tokenId)
          setSelectedTokenIds(autoSelected)
        }
      } else {
        setError(data.message || 'Failed to fetch tokens')
      }
    } catch (err) {
      console.error('Error fetching tokens:', err)
      setError('Failed to fetch available tokens')
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
          includeDetails: true
        })
      })
      
      const data = await response.json()
      
      if (data.status === 'success') {
        setSeriesData(data.data)
      } else {
        setError(data.message || 'Failed to fetch series data')
      }
    } catch (err) {
      console.error('Error fetching series data:', err)
      setError('Failed to fetch series data')
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
            }
          })
          
          return dataPoint
        })
      })()
    : []

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="p-6 space-y-6 bg-background min-h-screen max-w-screen-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Price Series Analysis</h1>
          <p className="text-muted-foreground">Interactive price charts and arbitrage analysis</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchAvailableTokens}
            variant="outline"
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => exportData('json')}
            variant="outline"
            disabled={exporting || selectedTokenIds.length === 0}
            className="flex items-center gap-2"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-spin' : ''}`} />
            Export Data
          </Button>
          <Link href="/">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowUpDown className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Token Selection */}
        <Card className="bg-gradient-to-r from-card to-card/50 border-border shadow-sm">
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
                        <div className="flex items-center gap-3">
                          {token.image && (
                            <img 
                              src={token.image} 
                              alt={token.symbol}
                              className="w-8 h-8 rounded-full"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )}
                          <div>
                            <div className="font-medium text-sm">{token.symbol}</div>
                            <div className="text-xs text-muted-foreground">{token.name}</div>
                          </div>
                        </div>
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
        <Card className="bg-gradient-to-r from-card to-card/50 border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Timeframe
            </CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="bg-gradient-to-r from-card to-card/50 border-border shadow-sm">
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
      <Card className="bg-gradient-to-br from-card to-card/80 border-border shadow-sm">
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
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))"
                    tickFormatter={(value) => `$${value.toFixed(6)}`}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  
                  {Object.entries(seriesData).map(([tokenId, series], index) => (
                    <Line
                      key={tokenId}
                      type="monotone"
                      dataKey={series.symbol}
                      stroke={colors[index % colors.length]}
                      strokeWidth={2}
                      dot={false}
                      name={series.symbol}
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
              <Card key={tokenId} className="bg-gradient-to-br from-card to-card/80 border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {series.image && (
                      <img 
                        src={series.image} 
                        alt={series.symbol}
                        className="w-6 h-6 rounded-full"
                      />
                    )}
                    <span>{series.symbol}</span>
                    {series.isLpToken && (
                      <Badge variant="outline" className="text-xs">LP</Badge>
                    )}
                    {series.isArbitrageOpportunity && (
                      <Badge variant="destructive" className="text-xs">ARB</Badge>
                    )}
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
  )
}