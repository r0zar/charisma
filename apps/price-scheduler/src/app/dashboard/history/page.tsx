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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
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
      const url = snapshotId 
        ? `/api/history/export/${snapshotId}?format=${format}`
        : `/api/history/export?format=${format}&timeRange=${timeFilter}`
      
      const response = await fetch(url)
      if (response.ok) {
        const blob = await response.blob()
        const downloadUrl = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = downloadUrl
        
        const timestamp = new Date().toISOString().split('T')[0]
        const filename = snapshotId 
          ? `price-snapshot-${snapshotId}-${timestamp}.${format}`
          : `price-history-${timeFilter}-${timestamp}.${format}`
        
        link.download = filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(downloadUrl)
      }
    } catch (error) {
      console.error('Export failed:', error)
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
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">Price History</span>
          </div>
          <h1 className="text-3xl font-bold">Historic Price Snapshots</h1>
          <p className="text-muted-foreground">
            View and export price calculation history from all engines
          </p>
        </div>
        <div className="flex gap-3">
          <Button onClick={fetchSnapshots} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => exportData('json')} disabled={!!exporting} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search snapshots..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Time Range</label>
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger>
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
            {selectedSnapshot && (
              <div>
                <label className="text-sm font-medium mb-2 block">Price Source</label>
                <Select value={sourceFilter} onValueChange={setSourceFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    <SelectItem value="oracle">Oracle</SelectItem>
                    <SelectItem value="market">Market</SelectItem>
                    <SelectItem value="intrinsic">Intrinsic</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-end">
              <Button variant="outline" className="w-full">
                <Calendar className="h-4 w-4 mr-2" />
                Custom Range
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="snapshots" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="snapshots">Snapshots Overview</TabsTrigger>
          <TabsTrigger value="detail" disabled={!selectedSnapshot}>
            Snapshot Detail
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="snapshots" className="space-y-6">
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Snapshots</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredSnapshots.length}</div>
                <p className="text-xs text-muted-foreground">
                  {timeFilter === '24h' ? 'Last 24 hours' : `Last ${timeFilter}`}
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Tokens Priced</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(filteredSnapshots.reduce((sum, s) => sum + s.successfulPrices, 0) / Math.max(filteredSnapshots.length, 1))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Per snapshot
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {filteredSnapshots.length > 0 
                    ? Math.round((filteredSnapshots.reduce((sum, s) => sum + s.successfulPrices, 0) / 
                        filteredSnapshots.reduce((sum, s) => sum + s.totalTokens, 0)) * 100)
                    : 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Pricing success rate
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg Calc Time</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.round(filteredSnapshots.reduce((sum, s) => sum + s.calculationTimeMs, 0) / Math.max(filteredSnapshots.length, 1))}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  Per calculation
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Snapshots Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Snapshots</CardTitle>
              <CardDescription>
                Click on a snapshot to view detailed price data
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                  Loading snapshots...
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Tokens</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Calculation Time</TableHead>
                        <TableHead>Engine Distribution</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredSnapshots.map((snapshot) => (
                        <TableRow key={snapshot.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {new Date(snapshot.timestamp).toLocaleString()}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {snapshot.id}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {snapshot.successfulPrices} / {snapshot.totalTokens}
                              </div>
                              {snapshot.arbitrageOpportunities > 0 && (
                                <Badge variant="secondary" className="text-xs">
                                  {snapshot.arbitrageOpportunities} arbitrage
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className={`text-sm font-medium ${
                                (snapshot.successfulPrices / snapshot.totalTokens) > 0.9 
                                  ? 'text-green-600' 
                                  : (snapshot.successfulPrices / snapshot.totalTokens) > 0.7
                                  ? 'text-yellow-600'
                                  : 'text-red-600'
                              }`}>
                                {Math.round((snapshot.successfulPrices / snapshot.totalTokens) * 100)}%
                              </div>
                              {snapshot.failedPrices > 0 && (
                                <Badge variant="destructive" className="text-xs">
                                  {snapshot.failedPrices} failed
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {snapshot.calculationTimeMs}ms
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {snapshot.engineStats.oracle > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  O: {snapshot.engineStats.oracle}
                                </Badge>
                              )}
                              {snapshot.engineStats.market > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  M: {snapshot.engineStats.market}
                                </Badge>
                              )}
                              {snapshot.engineStats.intrinsic > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  I: {snapshot.engineStats.intrinsic}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => fetchSnapshotDetail(snapshot.id)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => exportData('json', snapshot.id)}
                                disabled={!!exporting}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detail" className="space-y-6">
          {selectedSnapshot && (
            <>
              {/* Snapshot Header */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div>Snapshot Detail</div>
                    <div className="flex gap-2">
                      {(['json', 'csv', 'xlsx'] as const).map((format) => (
                        <Button
                          key={format}
                          size="sm"
                          variant="outline"
                          onClick={() => exportData(format, selectedSnapshot.snapshot.id)}
                          disabled={!!exporting}
                        >
                          {exporting === format ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          <span className="ml-2">{format.toUpperCase()}</span>
                        </Button>
                      ))}
                    </div>
                  </CardTitle>
                  <CardDescription>
                    {new Date(selectedSnapshot.snapshot.timestamp).toLocaleString()} • 
                    {selectedSnapshot.prices.length} tokens priced
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Total Tokens</div>
                      <div className="text-2xl font-bold">{selectedSnapshot.snapshot.totalTokens}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Successful</div>
                      <div className="text-2xl font-bold text-green-600">{selectedSnapshot.snapshot.successfulPrices}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Failed</div>
                      <div className="text-2xl font-bold text-red-600">{selectedSnapshot.snapshot.failedPrices}</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Calc Time</div>
                      <div className="text-2xl font-bold">{selectedSnapshot.snapshot.calculationTimeMs}ms</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Price Data Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Price Data</CardTitle>
                  <CardDescription>
                    Detailed price information from all engines
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Token</TableHead>
                          <TableHead>USD Price</TableHead>
                          <TableHead>sBTC Ratio</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Reliability</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredPrices.map((price) => (
                          <TableRow key={price.tokenId}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{price.symbol}</div>
                                <div className="text-sm text-muted-foreground font-mono">
                                  {price.tokenId.length > 50 
                                    ? `${price.tokenId.slice(0, 25)}...${price.tokenId.slice(-20)}`
                                    : price.tokenId
                                  }
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-sm">
                                ${price.usdPrice.toFixed(6)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-mono text-sm">
                                {price.sbtcRatio.toFixed(8)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={
                                  price.source === 'oracle' ? 'default' :
                                  price.source === 'market' ? 'secondary' :
                                  price.source === 'intrinsic' ? 'outline' : 'destructive'
                                }
                              >
                                {price.source}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`text-sm font-medium ${
                                  price.reliability > 0.8 ? 'text-green-600' :
                                  price.reliability > 0.6 ? 'text-yellow-600' : 'text-red-600'
                                }`}>
                                  {Math.round(price.reliability * 100)}%
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-muted-foreground">
                                {new Date(price.lastUpdated).toLocaleTimeString()}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
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
      id: `snapshot_${timestamp}`,
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
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
    'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    'SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-alex',
    'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token'
  ]
  
  const sources: Array<'oracle' | 'market' | 'intrinsic' | 'hybrid'> = ['oracle', 'market', 'intrinsic', 'hybrid']
  const symbols = ['CHA', 'sBTC', 'ALEX', 'DIKO']
  
  const prices: TokenPrice[] = tokens.map((tokenId, i) => ({
    tokenId,
    symbol: symbols[i] || `TOKEN${i}`,
    usdPrice: Math.random() * 1000 + 0.01,
    sbtcRatio: Math.random() * 0.1 + 0.000001,
    source: sources[Math.floor(Math.random() * sources.length)],
    reliability: Math.random() * 0.3 + 0.7,
    lastUpdated: snapshot.timestamp
  }))
  
  return { snapshot, prices }
}