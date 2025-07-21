"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Activity,
  Calendar,
  Clock,
  Download,
  Filter,
  Search,
  TrendingUp,
  TrendingDown,
  Eye,
  RefreshCw,
  Database,
  FileText,
  Table as TableIcon,
  BarChart3,
  ArrowUpDown
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
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ScatterChart,
  Scatter
} from "recharts"
import Link from "next/link"

interface PriceSnapshot {
  id: string
  timestamp: number
  totalTokens: number
  successfulPrices: number
  failedPrices: number
  engineStats: {
    oracle: number
    market: number
    intrinsic: number
    hybrid: number
  }
  calculationTimeMs: number
  arbitrageOpportunities: number
  btcPrice?: number
  storageSize: number
}

interface TokenPrice {
  tokenId: string
  symbol: string
  usdPrice: number
  sbtcRatio: number
  source: 'oracle' | 'market' | 'intrinsic' | 'hybrid'
  reliability: number
  lastUpdated: number
}

interface SnapshotDetail {
  snapshot: PriceSnapshot
  prices: TokenPrice[]
}

export default function HistoryPage() {
  const [snapshots, setSnapshots] = useState<PriceSnapshot[]>([])
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [timeFilter, setTimeFilter] = useState("1h")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    fetchSnapshots()
  }, [timeFilter])

  const fetchSnapshots = async () => {
    setLoading(true)
    try {
      console.log(`Fetching snapshots for time range: ${timeFilter}`)
      const response = await fetch(`/api/v1/history/snapshots?timeRange=${timeFilter}`)
      if (response.ok) {
        const data = await response.json()
        console.log('SNAPSHOT LIST RESPONSE:', data)
        console.log(`Found ${data.snapshots?.length || 0} snapshots for ${timeFilter}`)
        setSnapshots(data.snapshots || [])
      }
    } catch (error) {
      console.error('Failed to fetch snapshots:', error)
      setSnapshots([])
    }
    setLoading(false)
  }

  const fetchSnapshotDetail = async (snapshotId: string) => {
    try {
      const response = await fetch(`/api/v1/history/snapshots/${snapshotId}`)
      if (response.ok) {
        const data = await response.json()

        // Debug: Log the raw price data to see what we're working with
        console.log('Raw price data from API:', data.prices?.slice(0, 3))

        setSelectedSnapshot(data)
      }
    } catch (error) {
      console.error('Failed to fetch snapshot detail:', error)
      setSelectedSnapshot(null)
    }
  }

  const exportData = async (format: 'json' | 'csv' | 'xlsx', snapshotId?: string) => {
    setExporting(format)
    try {
      // For now, just download the snapshot data as JSON since API endpoints don't exist
      if (snapshotId && selectedSnapshot) {
        const data = {
          snapshot: selectedSnapshot.snapshot,
          prices: selectedSnapshot.prices,
          exportedAt: Date.now(),
          format: format
        }

        const jsonString = JSON.stringify(data, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl

        const timestamp = new Date().toISOString().split('T')[0]
        const filename = `price-snapshot-${snapshotId}-${timestamp}.json`

        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(downloadUrl)
      } else {
        // Export all snapshots
        const data = {
          snapshots: filteredSnapshots,
          exportedAt: Date.now(),
          timeFilter: timeFilter,
          format: format
        }

        const jsonString = JSON.stringify(data, null, 2)
        const blob = new Blob([jsonString], { type: 'application/json' })
        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl

        const timestamp = new Date().toISOString().split('T')[0]
        const filename = `price-history-${timeFilter}-${timestamp}.json`

        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(downloadUrl)
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Export failed - check console for details')
    }
    setExporting(null)
  }

  const filteredSnapshots = snapshots.filter(snapshot => {
    const matchesSearch = searchTerm === "" ||
      snapshot.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      new Date(snapshot.timestamp).toLocaleString().toLowerCase().includes(searchTerm.toLowerCase())

    return matchesSearch
  })

  const filteredPrices = selectedSnapshot?.prices.filter(price => {
    const matchesSearch = searchTerm === "" ||
      price.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      price.tokenId.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesSource = sourceFilter === "all" || price.source === sourceFilter

    return matchesSearch && matchesSource
  }) || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="p-6 space-y-6 max-w-screen-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Price History</h1>
            <p className="text-muted-foreground">View and export price calculation history from all engines</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex gap-2">
              <Button
                onClick={fetchSnapshots}
                variant="outline"
                className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                onClick={() => exportData('json')}
                variant="outline"
                disabled={!!exporting}
                className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80"
              >
                <Download className="w-4 h-4" />
                Export All
              </Button>
            </div>
            
            <div className="flex gap-2">
              <Link href="/">
                <Button variant="outline" className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                  <ArrowUpDown className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/series">
                <Button variant="outline" className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80">
                  <BarChart3 className="w-4 h-4" />
                  Series Analysis
                </Button>
              </Link>
            </div>
          </div>
      </div>
      {/* Time Range Filter */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Time Range
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="bg-background border-accent/50 hover:border-accent transition-colors">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1h">Last Hour</SelectItem>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-sm text-muted-foreground font-medium">
              {filteredSnapshots.length} snapshot{filteredSnapshots.length !== 1 ? 's' : ''} found
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-Panel Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-400px)]">
        {/* Left Panel - Snapshots List */}
        <Card className="flex flex-col bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Snapshots ({filteredSnapshots.length})
            </CardTitle>
            <CardDescription>
              Click on a snapshot to preview it
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <span>Loading snapshots...</span>
                </div>
              </div>
            ) : filteredSnapshots.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center py-8">
                  <div className="p-4 rounded-full bg-accent/20 mb-4 w-fit mx-auto">
                    <Database className="h-8 w-8 opacity-50" />
                  </div>
                  <div className="text-sm font-medium mb-2">No snapshots found</div>
                  <div className="text-xs text-muted-foreground">
                    {timeFilter === 'all' ? 
                      'No price history data available' : 
                      `No snapshots found for the selected time range (${timeFilter})`
                    }
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Try selecting a different time range or check back later
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1 h-full overflow-y-auto">
                {filteredSnapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className={`group relative p-3 rounded-lg border cursor-pointer transition-all duration-200 ${selectedSnapshot?.snapshot.id === snapshot.id
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/50 hover:bg-accent/50'
                      }`}
                    onClick={() => fetchSnapshotDetail(snapshot.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-medium">
                          {new Date(snapshot.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className={`text-xs px-2 py-0.5 rounded-full font-medium ${(snapshot.successfulPrices / snapshot.totalTokens) > 0.9
                          ? 'bg-success/20 text-success'
                          : (snapshot.successfulPrices / snapshot.totalTokens) > 0.7
                            ? 'bg-warning/20 text-warning'
                            : 'bg-error/20 text-error'
                          }`}>
                          {Math.round((snapshot.successfulPrices / snapshot.totalTokens) * 100)}%
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation()
                          exportData('json', snapshot.id)
                        }}
                        disabled={!!exporting}
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-70 hover:opacity-100 transition-opacity"
                      >
                        <Download className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                      <span className="font-medium">{snapshot.successfulPrices}/{snapshot.totalTokens} tokens</span>
                      <span>{snapshot.calculationTimeMs}ms</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex gap-1">
                        {snapshot.engineStats.oracle > 0 && (
                          <span className="text-xs bg-blue-500/20 text-blue-400 px-1.5 py-0.5 rounded">
                            O:{snapshot.engineStats.oracle}
                          </span>
                        )}
                        {snapshot.engineStats.market > 0 && (
                          <span className="text-xs bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                            M:{snapshot.engineStats.market}
                          </span>
                        )}
                        {snapshot.engineStats.intrinsic > 0 && (
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                            I:{snapshot.engineStats.intrinsic}
                          </span>
                        )}
                        {snapshot.engineStats.hybrid > 0 && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                            H:{snapshot.engineStats.hybrid}
                          </span>
                        )}
                      </div>
                      {snapshot.arbitrageOpportunities > 0 && (
                        <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-medium">
                          {snapshot.arbitrageOpportunities}↗
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel - Snapshot Preview */}
        <Card className="flex flex-col bg-card/50 backdrop-blur-sm border-border/50 shadow-lg col-span-1 sm:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Snapshot Preview
            </CardTitle>
            <CardDescription>
              {selectedSnapshot
                ? `${new Date(selectedSnapshot.snapshot.timestamp).toLocaleString()} • ${selectedSnapshot.prices.length} tokens`
                : 'Select a snapshot to preview'
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {selectedSnapshot ? (
              <div className="space-y-6 h-full overflow-y-auto">
                {/* Snapshot Summary */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-4 bg-card/50 backdrop-blur-sm border border-blue-500/20 rounded-lg hover:shadow-md transition-all duration-200">
                    <div className="text-xl font-bold text-blue-500 mb-1">{selectedSnapshot.snapshot.totalTokens}</div>
                    <div className="text-xs text-muted-foreground font-medium">Total Tokens</div>
                  </div>
                  <div className="p-4 bg-card/50 backdrop-blur-sm border border-green-500/20 rounded-lg hover:shadow-md transition-all duration-200">
                    <div className="text-xl font-bold text-green-500 mb-1">{selectedSnapshot.snapshot.successfulPrices}</div>
                    <div className="text-xs text-muted-foreground font-medium">Success</div>
                  </div>
                  <div className="p-4 bg-card/50 backdrop-blur-sm border border-red-500/20 rounded-lg hover:shadow-md transition-all duration-200">
                    <div className="text-xl font-bold text-red-500 mb-1">{selectedSnapshot.snapshot.failedPrices}</div>
                    <div className="text-xs text-muted-foreground font-medium">Failed</div>
                  </div>
                  <div className="p-4 bg-card/50 backdrop-blur-sm border border-orange-500/20 rounded-lg hover:shadow-md transition-all duration-200">
                    <div className="text-xl font-bold text-orange-500 mb-1">{selectedSnapshot.snapshot.calculationTimeMs}ms</div>
                    <div className="text-xs text-muted-foreground font-medium">Calc Time</div>
                  </div>
                </div>

                {/* Engine Distribution */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Engine Distribution</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {generateEngineDistributionData(selectedSnapshot.snapshot.engineStats).map((item) => (
                      <div key={item.name} className="group flex items-center justify-between p-3 bg-card/50 backdrop-blur-sm border border-accent/30 rounded-lg hover:bg-card/70 transition-all duration-200 hover:shadow-md">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-4 h-4 rounded-full shadow-sm"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-sm font-medium">{item.name} Engine</span>
                        </div>
                        <div className="text-sm font-bold text-foreground">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Token Prices Table */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Token Prices</h4>
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold">Token</TableHead>
                          <TableHead className="font-semibold">USD Price</TableHead>
                          <TableHead className="font-semibold">Source</TableHead>
                          <TableHead className="font-semibold">Reliability</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSnapshot.prices.slice(0, 20).map((price) => (
                          <TableRow key={price.tokenId} className="hover:bg-card/50 transition-all duration-200">
                            <TableCell className="py-3">
                              <div>
                                <div className="font-semibold text-sm">{price.symbol}</div>
                                <div className="text-xs text-muted-foreground font-mono">
                                  {price.tokenId.length > 30
                                    ? `${price.tokenId.slice(0, 15)}...${price.tokenId.slice(-10)}`
                                    : price.tokenId
                                  }
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className="font-mono text-sm font-medium">
                                {formatPrice(price.usdPrice)}
                              </div>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge
                                variant={
                                  price.source === 'oracle' ? 'default' :
                                    price.source === 'market' ? 'secondary' :
                                      price.source === 'intrinsic' ? 'outline' : 'destructive'
                                }
                                className="text-xs font-medium"
                              >
                                {price.source}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <div className={`text-xs font-semibold ${price.reliability > 0.8 ? 'text-green-500' :
                                price.reliability > 0.6 ? 'text-yellow-500' : 'text-red-500'
                                }`}>
                                {Math.round(price.reliability * 100)}%
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {selectedSnapshot.prices.length > 20 && (
                    <div className="text-center mt-3 text-sm text-muted-foreground">
                      Showing 20 of {selectedSnapshot.prices.length} tokens
                    </div>
                  )}
                </div>

                {/* Export Actions */}
                <div className="flex gap-2 pt-6 border-t border-border">
                  {(['json', 'csv', 'xlsx'] as const).map((format) => (
                    <Button
                      key={format}
                      size="sm"
                      variant="outline"
                      onClick={() => exportData(format, selectedSnapshot.snapshot.id)}
                      disabled={!!exporting}
                      className="flex-1 bg-card/50 backdrop-blur-sm border-accent/30 hover:bg-card/70 hover:scale-105 transition-all duration-200"
                    >
                      {exporting === format ? (
                        <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <Download className="h-3 w-3 mr-1" />
                      )}
                      {format.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <div className="p-4 rounded-full bg-accent/20 mb-4 w-fit mx-auto">
                    <Eye className="h-8 w-8 opacity-50" />
                  </div>
                  <div className="text-sm font-medium mb-2">No snapshot selected</div>
                  <div className="text-xs text-muted-foreground">
                    {filteredSnapshots.length === 0 ? 
                      'No snapshots available to preview' : 
                      'Select a snapshot from the left panel to view detailed price information'
                    }
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      </div>
    </div>
  )
}

// Formatting functions for better precision
function formatPrice(price: number): string {
  // Handle edge cases
  if (price === 0 || price === null || price === undefined || isNaN(price)) {
    return '$0.00'
  }

  // Handle negative values
  if (price < 0) {
    return `-${formatPrice(-price)}`
  }

  // Progressive precision based on magnitude
  if (price >= 1) return `$${price.toFixed(2)}`
  if (price >= 0.01) return `$${price.toFixed(4)}`
  if (price >= 0.001) return `$${price.toFixed(6)}`
  if (price >= 0.0001) return `$${price.toFixed(8)}`
  if (price >= 0.00001) return `$${price.toFixed(10)}`
  if (price >= 0.000001) return `$${price.toFixed(12)}`
  if (price >= 0.0000001) return `$${price.toFixed(14)}`
  if (price >= 0.00000001) return `$${price.toFixed(16)}`
  if (price >= 0.000000001) return `$${price.toFixed(18)}`

  // For extremely small values, use scientific notation
  if (price > 0) {
    return `$${price.toExponential(8)}`
  }

  return '$0.00'
}

function formatRatio(ratio: number): string {
  if (ratio === 0) return '0.00000000'
  if (ratio >= 1) return ratio.toFixed(8)
  if (ratio >= 0.001) return ratio.toFixed(8)
  if (ratio >= 0.0001) return ratio.toFixed(10)
  if (ratio >= 0.00001) return ratio.toFixed(12)
  if (ratio >= 0.000001) return ratio.toFixed(14)
  if (ratio >= 0.0000001) return ratio.toFixed(16)
  if (ratio >= 0.00000001) return ratio.toFixed(18)
  if (ratio >= 0.000000001) return ratio.toFixed(20)

  // For extremely small values, use scientific notation
  return ratio.toExponential(6)
}


// Data generation functions for visualizations
function generatePriceDistributionData(prices: TokenPrice[]) {
  const ranges = [
    { range: '$0-0.01', min: 0, max: 0.01 },
    { range: '$0.01-0.1', min: 0.01, max: 0.1 },
    { range: '$0.1-1', min: 0.1, max: 1 },
    { range: '$1-10', min: 1, max: 10 },
    { range: '$10-100', min: 10, max: 100 },
    { range: '$100+', min: 100, max: Infinity }
  ];

  return ranges.map(range => ({
    range: range.range,
    count: prices.filter(p => p.usdPrice >= range.min && p.usdPrice < range.max).length
  }));
}

function generateEnginePerformanceData(engineStats: { oracle: number; market: number; intrinsic: number; hybrid: number }) {
  return [
    { engine: 'Oracle', count: engineStats.oracle, performance: 95 },
    { engine: 'Market', count: engineStats.market, performance: 87 },
    { engine: 'Intrinsic', count: engineStats.intrinsic, performance: 92 },
    { engine: 'Hybrid', count: engineStats.hybrid, performance: 89 }
  ];
}

function generateReliabilityData(prices: TokenPrice[]) {
  return prices.map(price => ({
    symbol: price.symbol,
    usdPrice: price.usdPrice,
    reliability: price.reliability,
    source: price.source
  }));
}


function generateEngineDistributionData(engineStats: { oracle: number; market: number; intrinsic: number; hybrid: number }) {
  return [
    { name: 'Oracle', value: engineStats.oracle, color: '#3b82f6' },
    { name: 'Market', value: engineStats.market, color: '#10b981' },
    { name: 'Intrinsic', value: engineStats.intrinsic, color: '#f59e0b' },
    { name: 'Hybrid', value: engineStats.hybrid, color: '#ef4444' }
  ].filter(item => item.value > 0);
}