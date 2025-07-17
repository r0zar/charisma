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
  BarChart3
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
  const [timeFilter, setTimeFilter] = useState("24h")
  const [sourceFilter, setSourceFilter] = useState("all")
  const [exporting, setExporting] = useState<string | null>(null)

  useEffect(() => {
    fetchSnapshots()
  }, [timeFilter])

  const fetchSnapshots = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/history/snapshots?timeRange=${timeFilter}`)
      if (response.ok) {
        const data = await response.json()
        console.log('SNAPSHOT LIST RESPONSE:', data.snapshots)
        setSnapshots(data.snapshots || [])
      }
    } catch (error) {
      console.error('Failed to fetch snapshots:', error)
      // Mock data for demonstration
      setSnapshots(generateMockSnapshots())
    }
    setLoading(false)
  }

  const fetchSnapshotDetail = async (snapshotId: string) => {
    try {
      const response = await fetch(`/api/history/snapshots/${snapshotId}`)
      if (response.ok) {
        const data = await response.json()

        // Debug: Log the raw price data to see what we're working with
        console.log('Raw price data from API:', data.prices?.slice(0, 3))

        setSelectedSnapshot(data)
      }
    } catch (error) {
      console.error('Failed to fetch snapshot detail:', error)
      // Mock data
      setSelectedSnapshot(generateMockSnapshotDetail(snapshotId))
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
    <div className="p-6 space-y-6 bg-background min-h-screen max-w-screen-3xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Price History</h1>
          <p className="text-muted-foreground">View and export price calculation history from all engines</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={fetchSnapshots}
            variant="outline"
            className="flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => exportData('json')}
            variant="outline"
            disabled={!!exporting}
            className="flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export All
          </Button>
        </div>
      </div>
      {/* Time Range Filter */}
      <Card className="bg-gradient-to-r from-card to-card/50 border-border shadow-sm">
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
        <Card className="flex flex-col bg-gradient-to-br from-card to-card/80 border-border shadow-sm">
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
                <div className="skeleton-loading w-full h-8 rounded-md" />
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
        <Card className="flex flex-col bg-gradient-to-br col-span-1 sm:col-span-2 from-card to-card/80 border-border shadow-sm">
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
                  <div className="p-4 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-lg">
                    <div className="text-xl font-bold text-blue-500 mb-1">{selectedSnapshot.snapshot.totalTokens}</div>
                    <div className="text-xs text-muted-foreground font-medium">Total Tokens</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-lg">
                    <div className="text-xl font-bold text-green-500 mb-1">{selectedSnapshot.snapshot.successfulPrices}</div>
                    <div className="text-xs text-muted-foreground font-medium">Success</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-lg">
                    <div className="text-xl font-bold text-red-500 mb-1">{selectedSnapshot.snapshot.failedPrices}</div>
                    <div className="text-xs text-muted-foreground font-medium">Failed</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-lg">
                    <div className="text-xl font-bold text-orange-500 mb-1">{selectedSnapshot.snapshot.calculationTimeMs}ms</div>
                    <div className="text-xs text-muted-foreground font-medium">Calc Time</div>
                  </div>
                </div>

                {/* Engine Distribution */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Engine Distribution</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {generateEngineDistributionData(selectedSnapshot.snapshot.engineStats).map((item) => (
                      <div key={item.name} className="flex items-center justify-between p-3 bg-gradient-to-r from-accent/50 to-accent/20 border border-accent rounded-lg">
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
                          <TableRow key={price.tokenId} className="hover:bg-accent/30 transition-colors">
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
                      className="flex-1 bg-gradient-to-r from-accent/30 to-accent/10 hover:from-accent/50 hover:to-accent/20 border-accent/50 transition-all duration-200"
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
                    <Database className="h-8 w-8 opacity-50" />
                  </div>
                  <div className="text-sm font-medium">Select a snapshot from the left panel to preview it</div>
                  <div className="text-xs text-muted-foreground mt-1">Click on any snapshot to view detailed price information</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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

// Mock data generators for demonstration
function generateMockSnapshots(): PriceSnapshot[] {
  const snapshots: PriceSnapshot[] = []
  const now = Date.now()

  for (let i = 0; i < 50; i++) {
    const timestamp = now - (i * 5 * 60 * 1000) // Every 5 minutes
    const totalTokens = Math.floor(Math.random() * 20) + 80
    const successfulPrices = Math.floor(totalTokens * (0.85 + Math.random() * 0.15))
    const failedPrices = totalTokens - successfulPrices

    snapshots.push({
      id: String(timestamp),
      timestamp,
      totalTokens,
      successfulPrices,
      failedPrices,
      engineStats: {
        oracle: Math.floor(Math.random() * 5) + 1,
        market: Math.floor(Math.random() * 30) + 20,
        intrinsic: Math.floor(Math.random() * 20) + 10,
        hybrid: Math.floor(Math.random() * 10)
      },
      calculationTimeMs: Math.floor(Math.random() * 3000) + 500,
      arbitrageOpportunities: Math.floor(Math.random() * 5),
      btcPrice: 45000 + Math.random() * 10000,
      storageSize: Math.floor(Math.random() * 1000000) + 500000
    })
  }

  return snapshots
}

function generateMockSnapshotDetail(snapshotId: string): SnapshotDetail {
  const snapshot = generateMockSnapshots().find(s => s.id === snapshotId) || generateMockSnapshots()[0]

  const tokens = [
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.beri',
    'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope',
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nope-subnet',
    'SP3WPNAEBYMX06RQNNYTH5PTJ5EYF6KBQ.dogwifhat-token',
    'SP4M2C88EE8RQZPYTC4PZ88CE15EYF6KBQ.stacks-rock',
    'SP22KATK6MJF40987KB2KSZQ6E027HQ0CPP73C9Y.b-fakfun-v1',
    'SP25DP4A9QDM42KC40EXTYQPM243GWEGS.wif-rock-v1',
    'SP22KATK6MJF40987KB2KSZQ6E027HQ0CPP73C9Y.rock-fakfun-v1',
    'SP3HNEXSXJK2RYNG5P6YSEE53JJ5FBFA.meme-stxcity',
    'SP3BRXZ9Y7P5YP28PSR8YJT39GR.skullcoin-stxcity',
    'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-alex'
  ]

  const sources: Array<'oracle' | 'market' | 'intrinsic' | 'hybrid'> = ['oracle', 'market', 'intrinsic', 'hybrid']
  const symbols = ['BERI', 'NOT', 'NOT', 'WIF', 'ROCK', 'LP', 'LP', 'LP', 'MEME', 'SKULL', 'sBTC', 'ALEX']

  const prices: TokenPrice[] = tokens.map((tokenId, i) => {
    let usdPrice: number

    // Generate realistic micro-cap token prices
    if (i < 6) {
      // Very small tokens (like NOT, BERI, etc.)
      usdPrice = Math.random() * 0.00001 + 0.0000001 // Between 0.0000001 and 0.00001
    } else if (i < 9) {
      // Small tokens  
      usdPrice = Math.random() * 0.001 + 0.0001 // Between 0.0001 and 0.001
    } else if (i < 11) {
      // Medium tokens
      usdPrice = Math.random() * 1 + 0.01 // Between 0.01 and 1
    } else {
      // Larger tokens (sBTC, ALEX)
      usdPrice = Math.random() * 1000 + 1 // Between 1 and 1000
    }

    return {
      tokenId,
      symbol: symbols[i] || `TOKEN${i}`,
      usdPrice,
      sbtcRatio: usdPrice / 50000, // Assuming sBTC is around $50k
      source: sources[Math.floor(Math.random() * sources.length)],
      reliability: Math.random() * 0.3 + 0.7,
      lastUpdated: snapshot.timestamp
    }
  })

  return { snapshot, prices }
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

function generatePriceTrendsData(prices: TokenPrice[]) {
  // Generate mock time series data for demonstration
  const timePoints = Array.from({ length: 24 }, (_, i) => {
    const hour = 23 - i;
    const avgPrice = prices.reduce((sum, p) => sum + p.usdPrice, 0) / prices.length;
    const medianPrice = prices.sort((a, b) => a.usdPrice - b.usdPrice)[Math.floor(prices.length / 2)]?.usdPrice || 0;

    return {
      time: `${hour}:00`,
      avgPrice: avgPrice * (0.9 + Math.random() * 0.2),
      medianPrice: medianPrice * (0.9 + Math.random() * 0.2)
    };
  }).reverse();

  return timePoints;
}

function generateSnapshotsTimelineData(snapshots: PriceSnapshot[]) {
  return snapshots.map(snapshot => ({
    time: snapshot.timestamp,
    tokenCount: snapshot.successfulPrices,
    successRate: Math.round((snapshot.successfulPrices / snapshot.totalTokens) * 100),
    calculationTime: snapshot.calculationTimeMs,
    arbitrageOpportunities: snapshot.arbitrageOpportunities
  })).reverse(); // Reverse to show oldest first (left to right)
}

function generateEngineDistributionData(engineStats: { oracle: number; market: number; intrinsic: number; hybrid: number }) {
  return [
    { name: 'Oracle', value: engineStats.oracle, color: '#3b82f6' },
    { name: 'Market', value: engineStats.market, color: '#10b981' },
    { name: 'Intrinsic', value: engineStats.intrinsic, color: '#f59e0b' },
    { name: 'Hybrid', value: engineStats.hybrid, color: '#ef4444' }
  ].filter(item => item.value > 0);
}