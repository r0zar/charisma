"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Play, 
  Square, 
  Plus, 
  Trash2, 
  CheckCircle,
  XCircle,
  Clock,
  Users,
  AlertCircle,
  Activity,
  Fish,
  Building2,
  Zap,
  Search
} from "lucide-react"

type CollectionTarget = {
  id: string
  type: 'address' | 'contract'
  value: string
  name?: string
  enabled: boolean
  lastCollection?: number
  status: 'idle' | 'collecting' | 'success' | 'error'
  errorMessage?: string
}

type CollectionProgress = {
  isRunning: boolean
  current: number
  total: number
  stage: string
  startTime?: number
  estimatedCompletion?: number
  errors: string[]
}

type DiscoveredAddress = {
  address: string
  source: 'token_holders' | 'whale_detection' | 'contract_addresses' | 'manual'
  whaleClassification?: 'small' | 'medium' | 'large' | 'mega'
  contractType?: 'sip-010' | 'sip-009' | 'defi' | 'dao' | 'other'
  discoveredAt?: number
}

export default function CollectionPage() {
  const [mounted, setMounted] = useState(false)
  const [targets, setTargets] = useState<CollectionTarget[]>([
    {
      id: '1',
      type: 'address',
      value: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9',
      name: 'Main Address',
      enabled: true,
      lastCollection: Date.now() - 2 * 60 * 60 * 1000,
      status: 'idle'
    },
    {
      id: '2',
      type: 'contract',
      value: 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.token-contract',
      name: 'Token Contract',
      enabled: true,
      lastCollection: Date.now() - 30 * 60 * 1000,
      status: 'success'
    }
  ])
  
  const [progress, setProgress] = useState<CollectionProgress>({
    isRunning: false,
    current: 0,
    total: 0,
    stage: 'idle',
    errors: []
  })
  
  const [newTarget, setNewTarget] = useState({
    type: 'address' as 'address' | 'contract',
    value: '',
    name: ''
  })
  
  const [discoveredAddresses, setDiscoveredAddresses] = useState<DiscoveredAddress[]>([])
  const [discoveryLoading, setDiscoveryLoading] = useState(false)
  const [discoveryError, setDiscoveryError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
    loadDiscoveredAddresses()
  }, [])

  const loadDiscoveredAddresses = async () => {
    try {
      setDiscoveryLoading(true)
      setDiscoveryError(null)

      const response = await fetch('/api/discovery/stats')
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to load discovered addresses')
      }

      // Transform discovered addresses into the format we need
      const allDiscovered: DiscoveredAddress[] = []
      
      if (result.addresses) {
        // Add auto-discovered addresses
        if (result.addresses.autoDiscovered) {
          result.addresses.autoDiscovered.forEach((address: string) => {
            allDiscovered.push({
              address,
              source: 'token_holders', // Default source for auto-discovered
              discoveredAt: Date.now()
            })
          })
        }

        // Add whale addresses with classifications
        if (result.addresses.whales) {
          Object.entries(result.addresses.whales).forEach(([classification, addresses]) => {
            (addresses as string[]).forEach((address: string) => {
              allDiscovered.push({
                address,
                source: 'whale_detection',
                whaleClassification: classification as 'small' | 'medium' | 'large' | 'mega',
                discoveredAt: Date.now()
              })
            })
          })
        }
      }

      setDiscoveredAddresses(allDiscovered)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred'
      setDiscoveryError(`Failed to load discovered addresses: ${errorMessage}`)
      console.error('Discovery load error:', err)
    } finally {
      setDiscoveryLoading(false)
    }
  }

  const handleStartCollection = async () => {
    const enabledTargets = targets.filter(t => t.enabled)
    if (enabledTargets.length === 0) return

    setProgress({
      isRunning: true,
      current: 0,
      total: enabledTargets.length,
      stage: 'Starting collection...',
      startTime: Date.now(),
      estimatedCompletion: Date.now() + enabledTargets.length * 5000,
      errors: []
    })

    // Update target statuses
    setTargets(prev => prev.map(t => 
      t.enabled ? { ...t, status: 'collecting' } : t
    ))

    // Collect from each target using real API
    for (let i = 0; i < enabledTargets.length; i++) {
      const target = enabledTargets[i]
      
      setProgress(prev => ({
        ...prev,
        current: i + 1,
        stage: `Collecting ${target.type}: ${target.name || target.value}...`
      }))

      try {
        let result
        if (target.type === 'address') {
          // Get all balances for address
          const response = await fetch(`/api/balances/all?address=${encodeURIComponent(target.value)}`)
          result = await response.json()
        } else {
          // For contract, we need to parse address and contract parts
          const parts = target.value.split('.')
          if (parts.length === 2) {
            const [address, contractName] = parts
            const response = await fetch(`/api/balance?address=${encodeURIComponent(address)}&contractId=${encodeURIComponent(target.value)}`)
            result = await response.json()
          } else {
            throw new Error('Invalid contract format')
          }
        }

        if (result.success) {
          setTargets(prev => prev.map(t => 
            t.id === target.id ? {
              ...t,
              status: 'success',
              lastCollection: Date.now(),
              errorMessage: undefined
            } : t
          ))
        } else {
          throw new Error(result.error || 'Collection failed')
        }
      } catch (error) {
        console.error('Collection error:', error)
        setTargets(prev => prev.map(t => 
          t.id === target.id ? {
            ...t,
            status: 'error',
            lastCollection: Date.now(),
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          } : t
        ))

        setProgress(prev => ({
          ...prev,
          errors: [...prev.errors, `Failed to collect ${target.name || target.value}: ${error instanceof Error ? error.message : 'Unknown error'}`]
        }))
      }

      // Small delay between collections
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    setProgress(prev => ({
      ...prev,
      isRunning: false,
      stage: 'Collection completed'
    }))
  }

  const handleStopCollection = () => {
    setProgress(prev => ({
      ...prev,
      isRunning: false,
      stage: 'Collection stopped'
    }))
    
    setTargets(prev => prev.map(t => 
      t.status === 'collecting' ? { ...t, status: 'idle' } : t
    ))
  }

  const handleAddTarget = () => {
    if (!newTarget.value.trim()) return

    // Basic validation
    const value = newTarget.value.trim()
    if (newTarget.type === 'address') {
      if (!/^S[PTM][0-9A-Z]{36,44}$/.test(value)) {
        alert('Invalid Stacks address format')
        return
      }
    } else {
      const parts = value.split('.')
      if (parts.length !== 2 || parts[0].length === 0 || parts[1].length === 0) {
        alert('Invalid contract format. Expected: address.contract-name')
        return
      }
      if (!/^S[PTM][0-9A-Z]{36,44}$/.test(parts[0])) {
        alert('Invalid Stacks address in contract ID')
        return
      }
    }

    const target: CollectionTarget = {
      id: Date.now().toString(),
      type: newTarget.type,
      value: value,
      name: newTarget.name.trim() || undefined,
      enabled: true,
      status: 'idle'
    }

    setTargets(prev => [...prev, target])
    setNewTarget({ type: 'address', value: '', name: '' })
  }

  const handleRemoveTarget = (id: string) => {
    setTargets(prev => prev.filter(t => t.id !== id))
  }

  const handleToggleTarget = (id: string) => {
    setTargets(prev => prev.map(t => 
      t.id === id ? { ...t, enabled: !t.enabled } : t
    ))
  }

  const getStatusIcon = (status: CollectionTarget['status']) => {
    switch (status) {
      case 'collecting': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <div className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: CollectionTarget['status']) => {
    switch (status) {
      case 'collecting': return <Badge variant="secondary">Collecting</Badge>
      case 'success': return <Badge variant="default">Success</Badge>
      case 'error': return <Badge variant="destructive">Error</Badge>
      default: return <Badge variant="outline">Idle</Badge>
    }
  }

  const getSourceIcon = (source: DiscoveredAddress['source']) => {
    switch (source) {
      case 'token_holders': return <Zap className="h-4 w-4 text-yellow-500" />
      case 'whale_detection': return <Fish className="h-4 w-4 text-blue-500" />
      case 'contract_addresses': return <Building2 className="h-4 w-4 text-purple-500" />
      case 'manual': return <Search className="h-4 w-4 text-gray-500" />
      default: return <Search className="h-4 w-4 text-gray-400" />
    }
  }

  const getWhaleIcon = (classification?: string) => {
    if (!classification) return null
    switch (classification) {
      case 'small': return <Fish className="h-4 w-4 text-blue-500" />
      case 'medium': return <Fish className="h-4 w-4 text-green-500" />
      case 'large': return <Fish className="h-4 w-4 text-orange-500" />
      case 'mega': return <Fish className="h-4 w-4 text-red-500" />
      default: return null
    }
  }

  const addDiscoveredToTargets = (discovered: DiscoveredAddress) => {
    // Check if address is already in targets
    const exists = targets.some(t => t.value === discovered.address)
    if (exists) return

    const newTarget: CollectionTarget = {
      id: Date.now().toString(),
      type: discovered.address.includes('.') ? 'contract' : 'address',
      value: discovered.address,
      name: discovered.whaleClassification 
        ? `${discovered.whaleClassification.charAt(0).toUpperCase() + discovered.whaleClassification.slice(1)} Whale`
        : discovered.source === 'contract_addresses' ? 'Contract Address' : 'Auto-discovered',
      enabled: true,
      status: 'idle'
    }

    setTargets(prev => [...prev, newTarget])
  }

  const enabledTargets = targets.filter(t => t.enabled)
  const successfulTargets = targets.filter(t => t.status === 'success')
  const errorTargets = targets.filter(t => t.status === 'error')
  const whaleAddresses = discoveredAddresses.filter(d => d.whaleClassification)
  const contractAddresses = discoveredAddresses.filter(d => d.source === 'contract_addresses')

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Balance Collection</h1>
            <p className="text-muted-foreground">
              Collect and track balances from Stacks addresses and smart contracts
            </p>
          </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleStartCollection}
            disabled={progress.isRunning || enabledTargets.length === 0}
            className="flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
          >
            <Play className="h-4 w-4" />
            Start Collection
          </Button>
          <Button 
            onClick={handleStopCollection}
            disabled={!progress.isRunning}
            variant="outline"
            className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80"
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      </div>

      {/* Collection Progress */}
      {(progress.isRunning || progress.stage !== 'idle') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Activity className="h-5 w-5" />
              <span>Collection Progress</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.stage}</span>
                <span>{progress.current}/{progress.total}</span>
              </div>
              <Progress value={(progress.current / Math.max(progress.total, 1)) * 100} className="h-2" />
            </div>
            
            {progress.startTime && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Started: {new Date(progress.startTime).toLocaleTimeString()}</span>
                {progress.estimatedCompletion && progress.isRunning && (
                  <span>ETA: {new Date(progress.estimatedCompletion).toLocaleTimeString()}</span>
                )}
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
            <CardTitle className="text-sm font-medium">Collection Targets</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{targets.length}</div>
            <p className="text-xs text-muted-foreground">
              {enabledTargets.length} enabled
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{successfulTargets.length}</div>
            <p className="text-xs text-muted-foreground">
              Last collection
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{errorTargets.length}</div>
            <p className="text-xs text-muted-foreground">
              Need attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {targets.length > 0 ? Math.round((successfulTargets.length / targets.length) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              Success rate
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Discovery Stats Cards */}
      {discoveredAddresses.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Discovered Addresses</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{discoveredAddresses.length}</div>
              <p className="text-xs text-muted-foreground">
                Auto-discovered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Whale Addresses</CardTitle>
              <Fish className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">{whaleAddresses.length}</div>
              <p className="text-xs text-muted-foreground">
                High-value addresses
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium">Contract Addresses</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{contractAddresses.length}</div>
              <p className="text-xs text-muted-foreground">
                Smart contracts
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <Tabs defaultValue="targets" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="targets">Collection Targets</TabsTrigger>
          <TabsTrigger value="discovered">Discovered</TabsTrigger>
          <TabsTrigger value="add">Add Target</TabsTrigger>
        </TabsList>
        
        <TabsContent value="targets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Collection Targets</CardTitle>
              <CardDescription>
                Manage addresses and contracts for balance collection
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {targets.map((target) => (
                  <div key={target.id} className="flex items-center justify-between p-4 rounded-lg border border-border">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={target.enabled}
                          onChange={() => handleToggleTarget(target.id)}
                          className="w-4 h-4"
                        />
                        {getStatusIcon(target.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline">{target.type}</Badge>
                            {target.name && (
                              <span className="font-medium">{target.name}</span>
                            )}
                            {getStatusBadge(target.status)}
                          </div>
                          <code className="text-xs bg-muted p-1 rounded break-all">
                            {target.value}
                          </code>
                        </div>
                      </div>
                      
                      {target.lastCollection && (
                        <p className="text-xs text-muted-foreground pl-7">
                          Last collected: {new Date(target.lastCollection).toLocaleString()}
                        </p>
                      )}
                      
                      {target.errorMessage && (
                        <p className="text-xs text-red-600 pl-7">
                          Error: {target.errorMessage}
                        </p>
                      )}
                    </div>
                    
                    <Button
                      onClick={() => handleRemoveTarget(target.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                
                {targets.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No collection targets added yet. Use the "Add Target" tab to get started.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discovered" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Auto-Discovered Addresses
              </CardTitle>
              <CardDescription>
                Addresses found through automated discovery - promote them to collection targets
              </CardDescription>
            </CardHeader>
            <CardContent>
              {discoveryLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <span className="ml-3 text-muted-foreground">Loading discovered addresses...</span>
                </div>
              ) : discoveryError ? (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="h-6 w-6 text-red-600" />
                    <div>
                      <h3 className="font-semibold text-red-800 dark:text-red-200">Discovery Error</h3>
                      <p className="text-red-700 dark:text-red-300 mt-1">{discoveryError}</p>
                    </div>
                  </div>
                  <Button 
                    onClick={loadDiscoveredAddresses}
                    className="mt-4"
                    variant="outline"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Retry
                  </Button>
                </div>
              ) : discoveredAddresses.length > 0 ? (
                <div className="space-y-4">
                  {discoveredAddresses.map((discovered, index) => (
                    <div key={`${discovered.address}-${index}`} className="flex items-center justify-between p-4 rounded-lg border border-border">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          {getSourceIcon(discovered.source)}
                          {getWhaleIcon(discovered.whaleClassification)}
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline" className="text-xs">
                                {discovered.source.replace('_', ' ')}
                              </Badge>
                              {discovered.whaleClassification && (
                                <Badge 
                                  variant="outline" 
                                  className={
                                    discovered.whaleClassification === 'mega' ? 'border-red-500 text-red-700' :
                                    discovered.whaleClassification === 'large' ? 'border-orange-500 text-orange-700' :
                                    discovered.whaleClassification === 'medium' ? 'border-green-500 text-green-700' :
                                    'border-blue-500 text-blue-700'
                                  }
                                >
                                  {discovered.whaleClassification} whale
                                </Badge>
                              )}
                            </div>
                            <code className="text-xs bg-muted p-1 rounded break-all">
                              {discovered.address}
                            </code>
                          </div>
                        </div>
                        
                        {discovered.discoveredAt && (
                          <p className="text-xs text-muted-foreground pl-7">
                            Discovered: {new Date(discovered.discoveredAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                      
                      <Button
                        onClick={() => addDiscoveredToTargets(discovered)}
                        size="sm"
                        className="ml-4"
                        disabled={targets.some(t => t.value === discovered.address)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        {targets.some(t => t.value === discovered.address) ? 'Added' : 'Add'}
                      </Button>
                    </div>
                  ))}
                  
                  <div className="flex justify-between items-center pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                      {discoveredAddresses.length} addresses discovered
                    </p>
                    <Button onClick={loadDiscoveredAddresses} variant="outline" size="sm">
                      <Search className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No auto-discovered addresses yet</p>
                  <p className="text-sm mt-1">Run address discovery to find addresses automatically</p>
                  <Button 
                    onClick={() => window.open('/discovery', '_blank')}
                    className="mt-4"
                    variant="outline"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    Go to Discovery
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="add" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Collection Target</CardTitle>
              <CardDescription>
                Add a new address or contract for balance collection
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <select
                  id="type"
                  value={newTarget.type}
                  onChange={(e) => setNewTarget(prev => ({ ...prev, type: e.target.value as 'address' | 'contract' }))}
                  className="w-full p-2 border border-border rounded-md bg-background"
                >
                  <option value="address">Address</option>
                  <option value="contract">Contract</option>
                </select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="value">
                  {newTarget.type === 'address' ? 'Address' : 'Contract'}
                </Label>
                <Input
                  id="value"
                  placeholder={newTarget.type === 'address' ? 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9' : 'SP2PABAF9FTAJYNFZH93XENAJ8FVY99RRM50D2JG9.contract-name'}
                  value={newTarget.value}
                  onChange={(e) => setNewTarget(prev => ({ ...prev, value: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="name">Name (optional)</Label>
                <Input
                  id="name"
                  placeholder="Human-readable name for this target"
                  value={newTarget.name}
                  onChange={(e) => setNewTarget(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              
              <Button onClick={handleAddTarget} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Target
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </div>
  )
}