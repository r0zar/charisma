"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { 
  Settings, 
  Trophy, 
  Ticket, 
  Play, 
  Pause, 
  RefreshCw, 
  Save,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Loader2
} from "lucide-react"
import { LotteryConfig, PhysicalJackpot, LotteryFormat } from "@/types/lottery"

export default function AdminPage() {
  const [config, setConfig] = useState<LotteryConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [drawLoading, setDrawLoading] = useState(false)
  const [dryRunLoading, setDryRunLoading] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [adminKey, setAdminKey] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Form states
  const [jackpotForm, setJackpotForm] = useState<PhysicalJackpot>({
    title: "",
    imageUrl: "",
    linkUrl: "",
    estimatedValue: 0
  })
  const [configForm, setConfigForm] = useState({
    ticketPrice: 100,
    format: 'simple' as LotteryFormat,
    nextDrawDate: '',
    isActive: true
  })

  useEffect(() => {
    const savedKey = localStorage.getItem('admin-key')
    if (savedKey) {
      setAdminKey(savedKey)
      // Don't auto-authenticate, let user verify the key first
    }
  }, [])

  const handleAuthentication = async () => {
    try {
      console.log('Attempting authentication with key:', adminKey.substring(0, 10) + '...')
      const response = await fetch('/api/admin/lottery-config', {
        headers: {
          'x-admin-key': adminKey
        }
      })
      
      console.log('Auth response status:', response.status)
      if (response.ok) {
        console.log('Authentication successful')
        setIsAuthenticated(true)
        localStorage.setItem('admin-key', adminKey)
        fetchConfig()
      } else {
        const errorData = await response.text()
        console.log('Auth failed:', errorData)
        setError(`Invalid admin key (${response.status})`)
      }
    } catch (err) {
      console.error('Authentication error:', err)
      setError('Authentication failed')
    }
  }

  const fetchConfig = async () => {
    setLoading(true)
    setError(null)
    
    try {
      console.log('Fetching config with key:', adminKey.substring(0, 10) + '...')
      const response = await fetch('/api/admin/lottery-config', {
        headers: {
          'x-admin-key': adminKey
        }
      })
      
      console.log('Config fetch response status:', response.status)
      if (!response.ok) {
        const errorText = await response.text()
        console.log('Config fetch error:', errorText)
        throw new Error(`Failed to fetch config (${response.status}): ${errorText}`)
      }
      
      const result = await response.json()
      console.log('Config fetch result:', result)
      setConfig(result.data)
      
      // Populate forms
      if (result.data) {
        setJackpotForm(result.data.currentJackpot)
        setConfigForm({
          ticketPrice: result.data.ticketPrice,
          format: result.data.format,
          nextDrawDate: result.data.nextDrawDate ? new Date(result.data.nextDrawDate).toISOString().slice(0, 16) : '',
          isActive: result.data.isActive
        })
      }
    } catch (err) {
      console.error('Config fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load config')
    } finally {
      setLoading(false)
    }
  }

  const updateJackpot = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch('/api/admin/lottery-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          currentJackpot: jackpotForm
        })
      })
      
      if (!response.ok) {
        throw new Error('Failed to update jackpot')
      }
      
      setSuccess('Jackpot updated successfully!')
      fetchConfig()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update jackpot')
    } finally {
      setSaving(false)
    }
  }

  const updateConfig = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    
    try {
      // Convert datetime-local to ISO string
      const configData = {
        ...configForm,
        nextDrawDate: configForm.nextDrawDate ? new Date(configForm.nextDrawDate).toISOString() : undefined
      }
      
      const response = await fetch('/api/admin/lottery-config', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify(configData)
      })
      
      if (!response.ok) {
        throw new Error('Failed to update config')
      }
      
      setSuccess('Configuration updated successfully!')
      fetchConfig()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update config')
    } finally {
      setSaving(false)
    }
  }

  const triggerDraw = async () => {
    setDrawLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch('/api/admin/lottery-draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to trigger draw')
      }
      
      setSuccess('Lottery draw triggered successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger draw')
    } finally {
      setDrawLoading(false)
    }
  }

  const triggerDryRun = async () => {
    setDryRunLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch('/api/admin/lottery-draw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({ dryRun: true })
      })
      
      if (!response.ok) {
        throw new Error('Failed to run dry run test')
      }
      
      const result = await response.json()
      
      if (result.data) {
        setSuccess(`Dry run completed! ${result.data.totalTicketsSold} tickets processed, ${result.data.winners?.length || 0} winner(s) would be selected.`)
      } else {
        setSuccess('Dry run test completed successfully!')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run dry run test')
    } finally {
      setDryRunLoading(false)
    }
  }

  const exportTickets = async () => {
    setExportLoading(true)
    setError(null)
    setSuccess(null)
    
    try {
      const response = await fetch('/api/admin/lottery-tickets', {
        headers: {
          'x-admin-key': adminKey
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch tickets for export')
      }
      
      const result = await response.json()
      const allTickets = result.data || []
      
      // Filter to only active tickets (pending or confirmed, not archived)
      const tickets = allTickets.filter((ticket: any) => 
        ticket.status === 'pending' || ticket.status === 'confirmed'
      )
      
      if (tickets.length === 0) {
        setError('No active tickets available for export')
        return
      }

      // Create different export formats
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      
      // Format 1: Simple list (one ticket per line)
      const simpleList = tickets.map((ticket: any) => 
        `${ticket.id.slice(-6)} - ${ticket.walletAddress}`
      ).join('\n')
      
      // Format 2: CSV format
      const csvData = [
        'Ticket ID,Wallet Address,Purchase Date,Status,Full Ticket ID',
        ...tickets.map((ticket: any) => 
          `${ticket.id.slice(-6)},${ticket.walletAddress},${ticket.purchaseDate},${ticket.status},${ticket.id}`
        )
      ].join('\n')
      
      // Format 3: JSON format for advanced picker apps
      const jsonData = JSON.stringify({
        exportDate: new Date().toISOString(),
        totalTickets: tickets.length,
        format: 'lottery-export-v1',
        tickets: tickets.map((ticket: any) => ({
          shortId: ticket.id.slice(-6),
          fullId: ticket.id,
          walletAddress: ticket.walletAddress,
          purchaseDate: ticket.purchaseDate,
          status: ticket.status
        }))
      }, null, 2)

      // Create and download files
      const downloads = [
        { data: simpleList, filename: `lottery-tickets-simple-${timestamp}.txt`, type: 'text/plain' },
        { data: csvData, filename: `lottery-tickets-${timestamp}.csv`, type: 'text/csv' },
        { data: jsonData, filename: `lottery-tickets-${timestamp}.json`, type: 'application/json' }
      ]

      downloads.forEach(({ data, filename, type }) => {
        const blob = new Blob([data], { type })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })

      setSuccess(`Successfully exported ${tickets.length} tickets in 3 formats (TXT, CSV, JSON)`)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export tickets')
    } finally {
      setExportLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-6 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Settings className="h-5 w-5" />
              Admin Access
            </CardTitle>
            <CardDescription>
              Enter your admin key to access the lottery management panel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-key">Admin Key</Label>
              <Input
                id="admin-key"
                type="password"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                placeholder="Enter admin key"
                onKeyDown={(e) => e.key === 'Enter' && handleAuthentication()}
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}
            
            <div className="space-y-2">
              <Button onClick={handleAuthentication} className="w-full">
                Access Admin Panel
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  localStorage.removeItem('admin-key')
                  setAdminKey('')
                  setError(null)
                }} 
                className="w-full text-xs"
              >
                Clear Saved Key
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-8">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <div className="text-lg">Loading admin panel...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
          <Settings className="h-10 w-10 text-primary" />
          Lottery Admin Panel
        </h1>
        <p className="text-muted-foreground text-lg">
          Manage lottery configuration, jackpots, and draws
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          {error}
        </div>
      )}
      
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-md text-sm text-green-700 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Current Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Lottery Status</span>
              <Badge variant={config?.isActive ? "default" : "secondary"}>
                {config?.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Format</span>
              <Badge variant="outline">{config?.format}</Badge>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Ticket Price</span>
              <span className="font-mono">{config?.ticketPrice} STONE</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Next Draw</span>
              <span className="text-sm">
                {config?.nextDrawDate ? new Date(config.nextDrawDate).toLocaleString() : 'Not set'}
              </span>
            </div>

            <Separator />
            
            <div className="space-y-2">
              <span className="text-sm font-medium">Current Jackpot</span>
              <div className="text-sm text-muted-foreground">
                {config?.currentJackpot?.title || 'No jackpot set'}
              </div>
              {config?.currentJackpot?.estimatedValue && (
                <div className="text-sm font-mono">
                  ${(config.currentJackpot.estimatedValue / 1000).toLocaleString()} USD
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button 
                onClick={triggerDraw} 
                disabled={drawLoading || !config?.isActive}
                className="w-full"
                variant="default"
              >
                {drawLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Processing Draw...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Trigger Draw Now
                  </>
                )}
              </Button>
              
              <Button 
                onClick={triggerDryRun} 
                disabled={dryRunLoading || !config?.isActive}
                className="w-full"
                variant="outline"
              >
                {dryRunLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Running Test...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Dry Run Test Draw
                  </>
                )}
              </Button>
              
              <Button 
                onClick={exportTickets} 
                disabled={exportLoading}
                className="w-full"
                variant="secondary"
              >
                {exportLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Export for External Draw
                  </>
                )}
              </Button>
            </div>
            
            <Button 
              onClick={fetchConfig}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Data
            </Button>
            
            <Button
              onClick={() => {
                setIsAuthenticated(false)
                localStorage.removeItem('admin-key')
              }}
              variant="outline"
              className="w-full"
            >
              Logout
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Jackpot Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Jackpot Management
          </CardTitle>
          <CardDescription>
            Update the current jackpot prize details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="jackpot-title">Prize Title</Label>
                <Input
                  id="jackpot-title"
                  value={jackpotForm.title}
                  onChange={(e) => setJackpotForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Rare Collectible NFT"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jackpot-image">Image URL</Label>
                <Input
                  id="jackpot-image"
                  value={jackpotForm.imageUrl}
                  onChange={(e) => setJackpotForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jackpot-link">Details Link URL</Label>
                <Input
                  id="jackpot-link"
                  value={jackpotForm.linkUrl}
                  onChange={(e) => setJackpotForm(prev => ({ ...prev, linkUrl: e.target.value }))}
                  placeholder="https://example.com/prize-details"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="jackpot-value">Estimated Value (in STONE)</Label>
                <Input
                  id="jackpot-value"
                  type="number"
                  value={jackpotForm.estimatedValue}
                  onChange={(e) => setJackpotForm(prev => ({ ...prev, estimatedValue: parseInt(e.target.value) || 0 }))}
                  placeholder="125000000"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-sm font-medium">Preview</div>
              {jackpotForm.imageUrl && (
                <img 
                  src={jackpotForm.imageUrl} 
                  alt={jackpotForm.title}
                  className="w-full h-48 object-cover rounded-lg border"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              )}
              <div className="space-y-2">
                <div className="font-medium">{jackpotForm.title || 'Prize Title'}</div>
                {jackpotForm.estimatedValue && jackpotForm.estimatedValue > 0 && (
                  <div className="text-sm text-muted-foreground">
                    Est. ${(jackpotForm.estimatedValue / 1000).toLocaleString()} USD
                  </div>
                )}
                {jackpotForm.linkUrl && (
                  <Button variant="outline" size="sm" className="gap-2">
                    <ExternalLink className="h-3 w-3" />
                    View Details
                  </Button>
                )}
              </div>
            </div>
          </div>

          <Button onClick={updateJackpot} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Update Jackpot
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Lottery Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Lottery Configuration
          </CardTitle>
          <CardDescription>
            Update global lottery settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-price">Ticket Price (STONE)</Label>
                <Input
                  id="ticket-price"
                  type="number"
                  value={configForm.ticketPrice}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, ticketPrice: parseInt(e.target.value) || 100 }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lottery-format">Lottery Format</Label>
                <Select 
                  value={configForm.format} 
                  onValueChange={(value: LotteryFormat) => setConfigForm(prev => ({ ...prev, format: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="simple">Simple (Random Winner)</SelectItem>
                    <SelectItem value="traditional">Traditional (Number Selection)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="next-draw-date">Next Draw Date & Time</Label>
                <Input
                  id="next-draw-date"
                  type="datetime-local"
                  value={configForm.nextDrawDate}
                  onChange={(e) => setConfigForm(prev => ({ ...prev, nextDrawDate: e.target.value }))}
                  min={new Date().toISOString().slice(0, 16)}
                />
                <div className="text-xs text-muted-foreground">
                  Set when the next lottery draw should occur
                </div>
              </div>

              <div className="space-y-2">
                <Label>Lottery Status</Label>
                <div className="flex items-center space-x-4">
                  <Button
                    variant={configForm.isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConfigForm(prev => ({ ...prev, isActive: true }))}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Active
                  </Button>
                  <Button
                    variant={!configForm.isActive ? "default" : "outline"}
                    size="sm"
                    onClick={() => setConfigForm(prev => ({ ...prev, isActive: false }))}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Inactive
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Button onClick={updateConfig} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Update Configuration
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}