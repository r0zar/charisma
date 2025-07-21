"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Search, 
  Play, 
  RefreshCw, 
  Users, 
  Coins,
  Factory,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Clock,
  Fish,
  Building2,
  Zap
} from "lucide-react"

type DiscoveryStats = {
  totalAddresses: number
  autoDiscoveredCount: number
  manualAddressCount: number
  whaleStats: {
    total: number
    small: number
    medium: number
    large: number
    mega: number
  }
  discoverySourceStats: {
    token_holders: number
    whale_detection: number
    contract_addresses: number
    manual: number
  }
  coverageRate: number
  lastUpdate: string
}

type DiscoveredAddress = {
  address: string
  source: 'token_holders' | 'whale_detection' | 'contract_addresses' | 'manual'
  whaleClassification?: 'small' | 'medium' | 'large' | 'mega'
  contractType?: 'sip-010' | 'sip-009' | 'defi' | 'dao' | 'other'
  contractName?: string
  totalTokensHeld?: number
  discoveredAt?: number
}

type DiscoveryProgress = {
  isRunning: boolean
  currentPhase: string
  progress: number
  totalPhases: number
  startTime?: number
  estimatedCompletion?: number
  errors: string[]
}

export default function DiscoveryPage() {
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<DiscoveryStats | null>(null)
  const [addresses, setAddresses] = useState<{
    autoDiscovered: string[]
    whales: {
      small: string[]
      medium: string[]
      large: string[]
      mega: string[]
    }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<DiscoveryProgress>({
    isRunning: false,
    currentPhase: 'idle',
    progress: 0,
    totalPhases: 4,
    errors: []
  })

  useEffect(() => {
    setMounted(true)
    loadDiscoveryStats()
  }, [])

  const loadDiscoveryStats = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/discovery/stats')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load discovery stats')
      }

      setStats(result.stats)
      setAddresses(result.addresses)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setError(`Failed to load discovery statistics: ${errorMessage}`)
      console.error('Discovery stats load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const runDiscovery = async () => {
    try {
      setProgress({
        isRunning: true,
        currentPhase: 'Starting discovery...',
        progress: 0,
        totalPhases: 4,
        startTime: Date.now(),
        estimatedCompletion: Date.now() + 30000, // Estimate 30 seconds
        errors: []
      })

      // Start discovery with reasonable limits
      const discoveryConfig = {
        includeContractAddresses: true,
        contractTypes: ['defi', 'dao', 'sip-010'],
        maxContractsToScan: 10,
        maxHoldersPerToken: 20,
        topHolderPercentage: 20,
        enableAutoCollection: true,
        batchSize: 5
      }

      const response = await fetch('/api/discovery/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ config: discoveryConfig })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Discovery failed')
      }

      // Update progress to completion
      setProgress(prev => ({
        ...prev,
        isRunning: false,
        currentPhase: 'Discovery completed',
        progress: 100
      }))

      // Reload stats to show new discoveries
      await loadDiscoveryStats()

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setProgress(prev => ({
        ...prev,
        isRunning: false,
        currentPhase: 'Discovery failed',
        errors: [...prev.errors, errorMessage]
      }))
      setError(`Discovery failed: ${errorMessage}`)
    }
  }

  const getWhaleIcon = (classification: string) => {
    switch (classification) {
      case 'small': return <Fish className="h-4 w-4 text-blue-500" />
      case 'medium': return <Fish className="h-4 w-4 text-green-500" />
      case 'large': return <Fish className="h-4 w-4 text-orange-500" />
      case 'mega': return <Fish className="h-4 w-4 text-red-500" />
      default: return <Users className="h-4 w-4 text-gray-500" />
    }
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'token_holders': return <Coins className="h-4 w-4 text-yellow-500" />
      case 'whale_detection': return <Fish className="h-4 w-4 text-blue-500" />
      case 'contract_addresses': return <Building2 className="h-4 w-4 text-purple-500" />
      case 'manual': return <Users className="h-4 w-4 text-gray-500" />
      default: return <Search className="h-4 w-4 text-gray-400" />
    }
  }

  if (!mounted || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded-lg"></div>
            ))}
          </div>
          <div className="h-96 bg-muted rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">Discovery Error</h3>
              <p className="text-red-700 dark:text-red-300 mt-1">{error}</p>
            </div>
          </div>
          <Button 
            onClick={loadDiscoveryStats}
            className="mt-4"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!stats || !addresses) {
    return (
      <div className="container mx-auto p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">No Discovery Data</h3>
              <p className="text-yellow-700 dark:text-yellow-300 mt-1">
                No discovery statistics found. Run discovery to generate data.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Address Discovery
            </h1>
            <p className="text-muted-foreground">
              Automated discovery and classification of blockchain addresses
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={runDiscovery}
              disabled={progress.isRunning}
              className="flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/90"
            >
              <Play className="h-4 w-4" />
              Run Discovery
            </Button>
            <Button 
              onClick={loadDiscoveryStats}
              disabled={progress.isRunning}
              variant="outline"
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Discovery Progress */}
        {progress.isRunning && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-primary" />
                <span>Discovery Progress</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{progress.currentPhase}</span>
                  <span>{progress.progress}%</span>
                </div>
                <Progress value={progress.progress} className="h-2" />
              </div>
              
              {progress.startTime && progress.estimatedCompletion && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Started: {new Date(progress.startTime).toLocaleTimeString()}</span>
                  <span>ETA: {new Date(progress.estimatedCompletion).toLocaleTimeString()}</span>
                </div>
              )}

              {progress.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Errors ({progress.errors.length})</span>
                  </div>
                  <div className="space-y-1">
                    {progress.errors.map((error, index) => (
                      <p key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                        {error}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Total Addresses</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAddresses}</div>
              <p className="text-xs text-muted-foreground">
                {stats.autoDiscoveredCount} auto-discovered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Whales</CardTitle>
              <Fish className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.whaleStats.total}</div>
              <p className="text-xs text-muted-foreground">
                {stats.whaleStats.mega} mega, {stats.whaleStats.large} large
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Coverage Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.coverageRate.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground">
                Auto-discovery coverage
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Contracts</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.discoverySourceStats.contract_addresses}</div>
              <p className="text-xs text-muted-foreground">
                Smart contract addresses
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Discovery Sources */}
        <Card>
          <CardHeader>
            <CardTitle>Discovery Sources</CardTitle>
            <CardDescription>
              Breakdown of addresses by discovery method
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                {getSourceIcon('token_holders')}
                <div>
                  <p className="font-medium">Token Holders</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.discoverySourceStats.token_holders} addresses
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                {getSourceIcon('whale_detection')}
                <div>
                  <p className="font-medium">Whale Detection</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.discoverySourceStats.whale_detection} addresses
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20">
                {getSourceIcon('contract_addresses')}
                <div>
                  <p className="font-medium">Contracts</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.discoverySourceStats.contract_addresses} addresses
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/20">
                {getSourceIcon('manual')}
                <div>
                  <p className="font-medium">Manual</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.discoverySourceStats.manual} addresses
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address Lists */}
        <Tabs defaultValue="whales" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="whales">Whale Addresses</TabsTrigger>
            <TabsTrigger value="discovered">All Discovered</TabsTrigger>
          </TabsList>
          
          <TabsContent value="whales" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Whale Classifications</CardTitle>
                <CardDescription>
                  High-value addresses organized by whale tier
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {(['mega', 'large', 'medium', 'small'] as const).map((tier) => (
                  <div key={tier}>
                    <div className="flex items-center gap-2 mb-3">
                      {getWhaleIcon(tier)}
                      <span className="font-medium capitalize">{tier} Whales</span>
                      <Badge variant="secondary">
                        {addresses.whales[tier].length}
                      </Badge>
                    </div>
                    
                    {addresses.whales[tier].length > 0 ? (
                      <div className="space-y-2">
                        {addresses.whales[tier].map((address) => (
                          <div key={address} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                            <code className="text-sm font-mono">{address}</code>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={
                                tier === 'mega' ? 'border-red-500 text-red-700' :
                                tier === 'large' ? 'border-orange-500 text-orange-700' :
                                tier === 'medium' ? 'border-green-500 text-green-700' :
                                'border-blue-500 text-blue-700'
                              }>
                                {tier}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        No {tier} whales discovered yet
                      </p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="discovered" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Auto-Discovered Addresses</CardTitle>
                <CardDescription>
                  All addresses found through automated discovery
                </CardDescription>
              </CardHeader>
              <CardContent>
                {addresses.autoDiscovered.length > 0 ? (
                  <div className="space-y-2">
                    {addresses.autoDiscovered.map((address) => (
                      <div key={address} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <code className="text-sm font-mono">{address}</code>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">auto-discovered</Badge>
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No auto-discovered addresses yet</p>
                    <p className="text-sm mt-1">Run discovery to find addresses automatically</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Last Update Info */}
        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Last updated: {new Date(stats.lastUpdate).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <Factory className="h-4 w-4" />
                <span>Discovery system active</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}