"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Settings, 
  Database, 
  Camera, 
  Clock, 
  Trash2,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle,
  XCircle,
  HardDrive,
  Zap
} from "lucide-react"

type SchedulerConfig = {
  enabled: boolean
  interval: number
  maxRetries: number
  retryDelay: number
  maxSnapshotAge: number
}

type SchedulerStats = {
  lastSnapshotTime: number
  lastSnapshotDuration: number
  totalSnapshots: number
  failedSnapshots: number
  averageProcessingTime: number
  averageCompressionRatio: number
  nextSnapshotTime: number
}

type SchedulerStatus = {
  isRunning: boolean
  config: SchedulerConfig
  stats: SchedulerStats
  nextSnapshotIn: number
}

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false)
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus | null>(null)
  const [tempConfig, setTempConfig] = useState<SchedulerConfig | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  useEffect(() => {
    setMounted(true)
    loadSchedulerStatus()
  }, [])

  const loadSchedulerStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/snapshots/scheduler')
      const result = await response.json()
      
      if (result.success) {
        setSchedulerStatus(result.status)
        setTempConfig(result.status.config)
      } else {
        showMessage('error', result.error || 'Failed to load scheduler status')
      }
    } catch (error) {
      console.error('Load scheduler error:', error)
      showMessage('error', 'Failed to load scheduler status')
    } finally {
      setLoading(false)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  const handleSchedulerAction = async (action: string, config?: any) => {
    setSaving(true)
    try {
      const response = await fetch('/api/snapshots/scheduler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, config })
      })
      
      const result = await response.json()
      
      if (result.success) {
        showMessage('success', result.message)
        await loadSchedulerStatus()
      } else {
        showMessage('error', result.error || 'Action failed')
      }
    } catch (error) {
      console.error('Scheduler action error:', error)
      showMessage('error', 'Failed to execute action')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!tempConfig) return
    await handleSchedulerAction('updateConfig', tempConfig)
  }

  const handleClearCache = async () => {
    setSaving(true)
    try {
      const response = await fetch('/api/service/cache', { method: 'DELETE' })
      const result = await response.json()
      
      if (result.success) {
        showMessage('success', 'Cache cleared successfully')
      } else {
        showMessage('error', result.error || 'Failed to clear cache')
      }
    } catch (error) {
      console.error('Clear cache error:', error)
      showMessage('error', 'Failed to clear cache')
    } finally {
      setSaving(false)
    }
  }

  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60))
    return `${hours}h ${minutes}m`
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure balance collection and snapshot settings
          </p>
        </div>
        <Button 
          onClick={loadSchedulerStatus}
          disabled={loading}
          variant="outline"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Message */}
      {message && (
        <Card className={`border-l-4 ${message.type === 'success' ? 'border-l-green-500' : 'border-l-red-500'}`}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
              <span className={message.type === 'success' ? 'text-green-700' : 'text-red-700'}>
                {message.text}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Tabs */}
      <Tabs defaultValue="scheduler" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scheduler">Scheduler</TabsTrigger>
          <TabsTrigger value="service">Service</TabsTrigger>
          <TabsTrigger value="storage">Storage</TabsTrigger>
        </TabsList>
        
        <TabsContent value="scheduler" className="space-y-6">
          {/* Scheduler Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Scheduler Status</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {loading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">Loading scheduler status...</p>
                </div>
              ) : schedulerStatus ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Status</span>
                      <Badge variant={schedulerStatus.config.enabled ? 'default' : 'secondary'}>
                        {schedulerStatus.config.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Running</span>
                      <Badge variant={schedulerStatus.isRunning ? 'default' : 'outline'}>
                        {schedulerStatus.isRunning ? 'Yes' : 'No'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Next Snapshot</span>
                      <span className="text-sm text-muted-foreground">
                        {schedulerStatus.nextSnapshotIn > 0 ? formatDuration(schedulerStatus.nextSnapshotIn) : 'Now'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Total Snapshots</span>
                      <span className="text-sm">{schedulerStatus.stats.totalSnapshots}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Failed Snapshots</span>
                      <span className="text-sm">{schedulerStatus.stats.failedSnapshots}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Success Rate</span>
                      <span className="text-sm">
                        {schedulerStatus.stats.totalSnapshots > 0 
                          ? Math.round(((schedulerStatus.stats.totalSnapshots - schedulerStatus.stats.failedSnapshots) / schedulerStatus.stats.totalSnapshots) * 100)
                          : 0}%
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Failed to load scheduler status
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scheduler Controls */}
          <Card>
            <CardHeader>
              <CardTitle>Scheduler Controls</CardTitle>
              <CardDescription>
                Enable/disable the automatic snapshot scheduler
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Enable Scheduler</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create snapshots at regular intervals
                  </p>
                </div>
                <Switch 
                  checked={schedulerStatus?.config.enabled || false}
                  onCheckedChange={(checked) => 
                    handleSchedulerAction(checked ? 'enable' : 'disable')
                  }
                  disabled={saving}
                />
              </div>
              
              <Separator />
              
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleSchedulerAction('initialize')}
                  disabled={saving}
                  variant="outline"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Initialize
                </Button>
                <Button 
                  onClick={() => window.location.href = '/snapshots'}
                  variant="outline"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  View Snapshots
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scheduler Configuration */}
          {tempConfig && (
            <Card>
              <CardHeader>
                <CardTitle>Scheduler Configuration</CardTitle>
                <CardDescription>
                  Configure snapshot creation intervals and retry settings
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="interval">Snapshot Interval (hours)</Label>
                    <Input
                      id="interval"
                      type="number"
                      value={Math.floor(tempConfig.interval / (1000 * 60 * 60))}
                      onChange={(e) => setTempConfig(prev => prev ? {
                        ...prev,
                        interval: parseInt(e.target.value) * 1000 * 60 * 60
                      } : null)}
                      min="1"
                      max="168"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxRetries">Max Retries</Label>
                    <Input
                      id="maxRetries"
                      type="number"
                      value={tempConfig.maxRetries}
                      onChange={(e) => setTempConfig(prev => prev ? {
                        ...prev,
                        maxRetries: parseInt(e.target.value)
                      } : null)}
                      min="0"
                      max="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retryDelay">Retry Delay (seconds)</Label>
                    <Input
                      id="retryDelay"
                      type="number"
                      value={Math.floor(tempConfig.retryDelay / 1000)}
                      onChange={(e) => setTempConfig(prev => prev ? {
                        ...prev,
                        retryDelay: parseInt(e.target.value) * 1000
                      } : null)}
                      min="1"
                      max="300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxAge">Max Snapshot Age (days)</Label>
                    <Input
                      id="maxAge"
                      type="number"
                      value={Math.floor(tempConfig.maxSnapshotAge / (1000 * 60 * 60 * 24))}
                      onChange={(e) => setTempConfig(prev => prev ? {
                        ...prev,
                        maxSnapshotAge: parseInt(e.target.value) * 1000 * 60 * 60 * 24
                      } : null)}
                      min="1"
                      max="365"
                    />
                  </div>
                </div>
                
                <Button 
                  onClick={handleSaveConfig}
                  disabled={saving}
                  className="w-full"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Configuration
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="service" className="space-y-6">
          {/* Service Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Database className="h-5 w-5" />
                <span>Service Controls</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  onClick={handleClearCache}
                  disabled={saving}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear Cache
                </Button>
                <Button 
                  onClick={() => window.location.href = '/collection'}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Zap className="h-4 w-4" />
                  Start Collection
                </Button>
              </div>
              
              <Separator />
              
              <div className="text-sm text-muted-foreground">
                <p>• Clear Cache: Remove all cached balance data</p>
                <p>• Start Collection: Begin collecting balance data from configured targets</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="storage" className="space-y-6">
          {/* Storage Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <HardDrive className="h-5 w-5" />
                <span>Storage Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>Storage configuration is managed automatically by the balance service.</p>
                <p>Snapshot data is stored in Vercel Blob Storage with automatic compression.</p>
                <p>Balance data is cached in Vercel KV for fast access.</p>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Current Storage:</p>
                  <p className="text-muted-foreground">KV + Blob Storage</p>
                </div>
                <div>
                  <p className="font-medium">Compression:</p>
                  <p className="text-muted-foreground">gzip (Level 6)</p>
                </div>
                <div>
                  <p className="font-medium">Retention:</p>
                  <p className="text-muted-foreground">Configurable per snapshot</p>
                </div>
                <div>
                  <p className="font-medium">Cache TTL:</p>
                  <p className="text-muted-foreground">1 hour (configurable)</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}