"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Camera, 
  Download, 
  Upload, 
  Trash2, 
  RefreshCw, 
  HardDrive,
  Clock,
  CheckCircle,
  XCircle,
  Archive
} from "lucide-react"

type Snapshot = {
  id: string
  timestamp: number
  size: number
  compressedSize: number
  compressionRatio: number
  balanceCount: number
  addressCount: number
  contractCount: number
  status: 'creating' | 'ready' | 'error' | 'uploading'
  errorMessage?: string
  url?: string
}

type SnapshotStats = {
  totalSnapshots: number
  totalSize: number
  averageSize: number
  compressionRatio: number
  oldestSnapshot: number
  newestSnapshot: number
  storageUsed: number
  storageLimit: number
}

export default function SnapshotsPage() {
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [stats, setStats] = useState<SnapshotStats>({
    totalSnapshots: 0,
    totalSize: 0,
    averageSize: 0,
    compressionRatio: 0,
    oldestSnapshot: 0,
    newestSnapshot: 0,
    storageUsed: 0,
    storageLimit: 100
  })

  const [isCreating, setIsCreating] = useState(false)
  const [creationProgress, setCreationProgress] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [isDemoMode, setIsDemoMode] = useState(true) // Start as demo until proven otherwise

  useEffect(() => {
    setMounted(true)
    // Load initial data
    handleRefresh()
  }, [])
  
  // Auto-refresh every 10 minutes when not in demo mode
  useEffect(() => {
    if (!isDemoMode && mounted) {
      const interval = setInterval(() => {
        handleRefresh()
      }, 10 * 60 * 1000) // 10 minutes
      
      return () => clearInterval(interval)
    }
  }, [isDemoMode, mounted])

  const handleCreateSnapshot = async () => {
    setIsCreating(true)
    setCreationProgress(0)

    // Add a new snapshot in creating state
    const newSnapshot: Snapshot = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      size: 0,
      compressedSize: 0,
      compressionRatio: 0,
      balanceCount: 0,
      addressCount: 0,
      contractCount: 0,
      status: 'creating'
    }

    setSnapshots(prev => [newSnapshot, ...prev])

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setCreationProgress(prev => Math.min(prev + 10, 90))
      }, 500)

      // Create snapshot via API
      const response = await fetch('/api/snapshots', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          addresses: ['*'], // Use wildcard to snapshot all addresses
          tokens: [] // Optional: specify specific tokens or leave empty for all
        })
      })
      
      const result = await response.json()
      
      clearInterval(progressInterval)
      setCreationProgress(100)
      
      if (result.success) {
        const snapshotResult = result.snapshot
        const isDemo = result.demo
        
        if (isDemo) {
          // Demo mode - update with placeholder data
          setSnapshots(prev => prev.map(s => 
            s.id === newSnapshot.id ? {
              ...s,
              timestamp: Date.now(),
              size: 0,
              compressedSize: 0,
              compressionRatio: 0,
              balanceCount: 0,
              addressCount: 0,
              contractCount: 0,
              status: 'ready',
              url: undefined
            } : s
          ))
          
          alert('Demo snapshot created! Configure BLOB_READ_WRITE_TOKEN and KV_URL environment variables for real storage.')
        } else {
          // Real snapshot created - update with actual data from API
          setSnapshots(prev => prev.map(s => 
            s.id === newSnapshot.id ? {
              ...s,
              timestamp: new Date(snapshotResult.createdAt).getTime(),
              size: snapshotResult.size || 0,
              compressedSize: snapshotResult.compressedSize || 0,
              compressionRatio: snapshotResult.compressionRatio || 0.73,
              balanceCount: snapshotResult.balanceCount || 0,
              addressCount: snapshotResult.addressCount || 0,
              contractCount: snapshotResult.contractCount || 0,
              status: 'ready',
              url: snapshotResult.url
            } : s
          ))
        }
        
        // Refresh stats to get updated data
        await handleRefresh()
      } else {
        throw new Error(result.error || 'Failed to create snapshot')
      }
    } catch (error) {
      console.error('Snapshot creation error:', error)
      
      // Update snapshot with error state
      setSnapshots(prev => prev.map(s => 
        s.id === newSnapshot.id ? {
          ...s,
          status: 'error',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        } : s
      ))
      
      // Show appropriate error message
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      if (errorMsg.includes('configuration')) {
        alert('Demo mode: Vercel Blob storage not configured. Set BLOB_READ_WRITE_TOKEN environment variable for real storage.')
      } else {
        alert(`Failed to create snapshot: ${errorMsg}`)
      }
    } finally {
      setIsCreating(false)
      setCreationProgress(0)
    }
  }

  const handleDownload = async (snapshot: Snapshot) => {
    try {
      // Use the download API endpoint to get the actual file
      window.open(`/api/snapshots/download/${snapshot.timestamp}`, '_blank')
    } catch (error) {
      console.error('Download failed:', error)
      alert('Failed to download snapshot')
    }
  }

  const handleDelete = (id: string) => {
    setSnapshots(prev => prev.filter(s => s.id !== id))
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    
    try {
      // Fetch current snapshot data from API
      const response = await fetch('/api/snapshots')
      const result = await response.json()
      
      console.log('API Response:', result)
      
      // Check if we're in demo mode - handle nested response structure
      const actualSnapshots = result.snapshots?.snapshots || result.snapshots
      const isDemo = !result.success || result.demo || result.snapshots?.demo || 
                     result.error?.includes('not configured') || 
                     !Array.isArray(actualSnapshots)
      
      console.log('Demo mode:', isDemo)
      console.log('Actual snapshots:', actualSnapshots)
      setIsDemoMode(isDemo)
      
      if (!isDemo && result.success) {
        // Handle nested response structure
        const apiSnapshots = actualSnapshots
        
        console.log('API Snapshots:', apiSnapshots)
        
        if (apiSnapshots && Array.isArray(apiSnapshots)) {
          // Convert API snapshots to our format
          const convertedSnapshots: Snapshot[] = apiSnapshots.map((snap: any) => {
            console.log('Converting snapshot:', snap)
            return {
              id: snap.id,
              timestamp: new Date(snap.createdAt).getTime(),
            size: snap.size || 0,
            compressedSize: snap.compressedSize || Math.round((snap.size || 0) * 0.73),
              compressionRatio: snap.compressionRatio || 0.73,
              balanceCount: snap.balanceCount || 0,
              addressCount: snap.addressCount || 0,
              contractCount: snap.contractCount || 0,
              status: snap.status === 'completed' ? 'ready' : snap.status || 'ready',
              url: snap.url,
              errorMessage: snap.error
            }
          })
          
          setSnapshots(convertedSnapshots)
          
          // Calculate stats from real snapshots
          if (convertedSnapshots.length > 0) {
            const totalSize = convertedSnapshots.reduce((sum, s) => sum + s.size, 0)
            const averageSize = totalSize / convertedSnapshots.length
            const timestamps = convertedSnapshots.map(s => s.timestamp)
            
            setStats({
              totalSnapshots: convertedSnapshots.length,
              totalSize,
              averageSize,
              compressionRatio: convertedSnapshots.reduce((sum, s) => sum + s.compressionRatio, 0) / convertedSnapshots.length,
              oldestSnapshot: Math.min(...timestamps),
              newestSnapshot: Math.max(...timestamps),
              storageUsed: totalSize / (1024 * 1024 * 1024), // Convert to GB
              storageLimit: 100 // This would come from Vercel Blob limits
            })
          }
        } else {
          // No snapshots found
          setSnapshots([])
          setStats(prev => ({
            ...prev,
            totalSnapshots: 0,
            totalSize: 0,
            averageSize: 0
          }))
        }
      } else {
        // Demo mode or error
        setSnapshots([])
        setStats(prev => ({
          ...prev,
          totalSnapshots: 0,
          totalSize: 0,
          averageSize: 0
        }))
      }
      
    } catch (error) {
      console.error('Refresh error:', error)
      setError(error instanceof Error ? error.message : 'Failed to load snapshots')
      setIsDemoMode(true)
      setSnapshots([])
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days} day${days === 1 ? '' : 's'} ago`
    if (hours > 0) return `${hours} hour${hours === 1 ? '' : 's'} ago`
    if (minutes > 0) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
    return 'Just now'
  }

  const getStatusIcon = (status: Snapshot['status']) => {
    switch (status) {
      case 'creating': return <Clock className="h-4 w-4 text-blue-500 animate-spin" />
      case 'uploading': return <Upload className="h-4 w-4 text-blue-500 animate-pulse" />
      case 'ready': return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error': return <XCircle className="h-4 w-4 text-red-500" />
      default: return <div className="h-4 w-4" />
    }
  }

  const getStatusBadge = (status: Snapshot['status']) => {
    switch (status) {
      case 'creating': return <Badge variant="secondary">Creating</Badge>
      case 'uploading': return <Badge variant="secondary">Uploading</Badge>
      case 'ready': return <Badge variant="default">Ready</Badge>
      case 'error': return <Badge variant="destructive">Error</Badge>
      default: return <Badge variant="outline">Unknown</Badge>
    }
  }

  if (!mounted || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-muted rounded w-48"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted rounded-lg"></div>
            ))}
          </div>
          <div className="h-64 bg-muted rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10">
      <div className="container mx-auto p-6 space-y-8" data-testid="snapshots-page">
      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span className="font-medium text-red-800 dark:text-red-200">Connection Error</span>
          </div>
          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
            {error}
          </p>
        </div>
      )}
      
      {/* Demo Mode Banner */}
      {isDemoMode && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500" />
            <span className="font-medium text-amber-800 dark:text-amber-200">Demo Mode</span>
          </div>
          <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
            Snapshot service not configured. Set BLOB_READ_WRITE_TOKEN and KV_URL environment variables for real storage.
          </p>
        </div>
      )}

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Snapshots</h1>
            <p className="text-muted-foreground">
              Manage balance snapshots and historical data
            </p>
          </div>
        <div className="flex gap-2">
          <Button 
            onClick={handleCreateSnapshot}
            disabled={isCreating}
            className="flex items-center gap-2 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary"
            data-testid="create-snapshot-btn"
          >
            <Camera className="h-4 w-4" />
            Create Snapshot
          </Button>
          <Button 
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
            className="flex items-center gap-2 hover:scale-105 transition-all duration-300 bg-background/50 backdrop-blur-sm hover:bg-background/80"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Creation Progress */}
      {isCreating && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Camera className="h-5 w-5 text-primary" />
              <span>Creating Snapshot</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Collecting and compressing balance data...</span>
                <span>{creationProgress}%</span>
              </div>
              <Progress value={creationProgress} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Total Snapshots</CardTitle>
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Archive className="h-4 w-4 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-snapshots">{stats.totalSnapshots}</div>
            <p className="text-xs text-muted-foreground">
              {formatBytes(stats.totalSize)} total
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Average Size</CardTitle>
            <div className="p-2 rounded-lg bg-accent/10 border border-accent/20">
              <HardDrive className="h-4 w-4 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="compression-ratio">{formatBytes(stats.averageSize)}</div>
            <p className="text-xs text-muted-foreground">
              {(stats.compressionRatio * 100).toFixed(1)}% compression
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <div className="p-2 rounded-lg bg-secondary/10 border border-secondary/20">
              <HardDrive className="h-4 w-4 text-secondary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="storage-used">{stats.storageUsed.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              of {stats.storageLimit} GB limit
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-medium">Latest Snapshot</CardTitle>
            <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
              <Clock className="h-4 w-4 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDuration(stats.newestSnapshot)}</div>
            <p className="text-xs text-muted-foreground">
              Created {new Date(stats.newestSnapshot).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Storage Usage */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <span>Storage Usage</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Used Storage</span>
              <span>{stats.storageUsed.toFixed(1)} GB / {stats.storageLimit} GB</span>
            </div>
            <Progress value={stats.storageUsed} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Oldest: {new Date(stats.oldestSnapshot).toLocaleDateString()}</span>
              <span>Newest: {new Date(stats.newestSnapshot).toLocaleDateString()}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Snapshots List */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 shadow-lg">
        <CardHeader>
          <CardTitle>Snapshot History</CardTitle>
          <CardDescription>
            View and manage your balance snapshots
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {snapshots.map((snapshot) => (
              <div key={snapshot.id} className="group flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/60 transition-all duration-200 hover:shadow-md">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(snapshot.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline">
                          {new Date(snapshot.timestamp).toLocaleDateString()}
                        </Badge>
                        <span className="text-sm font-medium">
                          {new Date(snapshot.timestamp).toLocaleTimeString()}
                        </span>
                        {getStatusBadge(snapshot.status)}
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-muted-foreground">
                        <div>
                          <span className="font-medium">Size:</span> {formatBytes(snapshot.size)}
                        </div>
                        <div>
                          <span className="font-medium">Compressed:</span> {formatBytes(snapshot.compressedSize)}
                        </div>
                        <div>
                          <span className="font-medium">Balances:</span> {snapshot.balanceCount.toLocaleString()}
                        </div>
                        <div>
                          <span className="font-medium">Addresses:</span> {snapshot.addressCount}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pl-7">
                    <span>Created {formatDuration(snapshot.timestamp)}</span>
                    {snapshot.compressionRatio > 0 && (
                      <>
                        <span>•</span>
                        <span>{(snapshot.compressionRatio * 100).toFixed(1)}% compression</span>
                      </>
                    )}
                  </div>
                  
                  {snapshot.errorMessage && (
                    <p className="text-xs text-red-600 pl-7">
                      Error: {snapshot.errorMessage}
                    </p>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {snapshot.status === 'ready' && (
                    <Button
                      onClick={() => handleDownload(snapshot)}
                      variant="ghost"
                      size="sm"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                  
                  <Button
                    onClick={() => handleDelete(snapshot.id)}
                    variant="ghost"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {snapshots.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Archive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">No snapshots available</p>
                <p className="text-xs mt-1">
                  {isDemoMode 
                    ? 'Configure storage services to create real snapshots' 
                    : 'Click "Create Snapshot" to get started'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}