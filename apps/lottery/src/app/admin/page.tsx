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
import { Carousel } from "@/components/ui/carousel"

export default function AdminPage() {
  const [config, setConfig] = useState<LotteryConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [manualWinnerLoading, setManualWinnerLoading] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [adminKey, setAdminKey] = useState("")
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [analytics, setAnalytics] = useState<any>({})
  const [winningTicketId, setWinningTicketId] = useState("")

  // Form states
  const [jackpotForm, setJackpotForm] = useState<PhysicalJackpot>({
    title: "",
    imageUrls: [],
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
        fetchAnalytics()
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
        // Handle backward compatibility: convert old imageUrl to new imageUrls array
        const currentJackpot = result.data.currentJackpot
        const migratedJackpot = {
          ...currentJackpot,
          imageUrls: currentJackpot.imageUrls || (currentJackpot.imageUrl ? [currentJackpot.imageUrl] : [])
        }
        
        setJackpotForm(migratedJackpot)
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


  const fetchAnalytics = async () => {
    setAnalyticsLoading(true)
    
    try {
      const [ticketsResponse, drawsResponse] = await Promise.all([
        fetch('/api/admin/lottery-tickets', {
          headers: { 'x-admin-key': adminKey }
        }),
        fetch('/api/admin/lottery-results', {
          headers: { 'x-admin-key': adminKey }
        })
      ])

      if (!ticketsResponse.ok || !drawsResponse.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const [ticketsData, drawsData] = await Promise.all([
        ticketsResponse.json(),
        drawsResponse.json()
      ])

      const tickets = ticketsData.data || []
      const draws = drawsData.data || []

      // Calculate analytics
      const totalTickets = tickets.length
      const confirmedTickets = tickets.filter((t: any) => t.status === 'confirmed').length
      const pendingTickets = tickets.filter((t: any) => t.status === 'pending').length
      const cancelledTickets = tickets.filter((t: any) => t.status === 'cancelled').length
      const archivedTickets = tickets.filter((t: any) => t.status === 'archived').length
      
      const uniqueWallets = new Set(tickets.map((t: any) => t.walletAddress)).size
      const totalDraws = draws.length
      const completedDraws = draws.filter((d: any) => d.status === 'completed').length
      

      // Recent activity (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      
      // Prioritize confirmed tickets for main metric
      const recentConfirmedTickets = tickets.filter((t: any) => 
        new Date(t.purchaseDate) > thirtyDaysAgo && t.status === 'confirmed'
      ).length
      
      // Also track all new tickets for additional context
      const recentAllTickets = tickets.filter((t: any) => 
        new Date(t.purchaseDate) > thirtyDaysAgo
      ).length

      const recentDraws = draws.filter((d: any) => 
        new Date(d.drawDate) > thirtyDaysAgo
      ).length

      // Current draw analytics (non-archived tickets)
      const currentDrawTickets = tickets.filter((t: any) => t.status !== 'archived')
      const currentDrawConfirmed = currentDrawTickets.filter((t: any) => t.status === 'confirmed').length
      const currentDrawPending = currentDrawTickets.filter((t: any) => t.status === 'pending').length
      const currentDrawCancelled = currentDrawTickets.filter((t: any) => t.status === 'cancelled').length
      const currentDrawUniqueWallets = new Set(currentDrawTickets.map((t: any) => t.walletAddress)).size

      setAnalytics({
        totalTickets,
        confirmedTickets,
        pendingTickets,
        cancelledTickets,
        archivedTickets,
        uniqueWallets,
        totalDraws,
        completedDraws,
        recentConfirmedTickets,
        recentAllTickets,
        recentDraws,
        averageTicketsPerDraw: totalDraws > 0 ? Math.round(confirmedTickets / totalDraws) : 0,
        // Current draw analytics
        currentDrawTickets: currentDrawTickets.length,
        currentDrawConfirmed,
        currentDrawPending,
        currentDrawCancelled,
        currentDrawUniqueWallets
      })

    } catch (err) {
      console.error('Failed to fetch analytics:', err)
      setError('Failed to load analytics data')
    } finally {
      setAnalyticsLoading(false)
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

      // Filter to only confirmed tickets for external drawing
      const tickets = allTickets.filter((ticket: any) =>
        ticket.status === 'confirmed'
      )

      if (tickets.length === 0) {
        setError('No confirmed tickets available for export')
        return
      }

      // Create CSV export for external lottery drawing
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')

      // CSV format optimized for external lottery drawing
      // Quote ticket IDs to preserve leading zeros in Excel/Sheets
      const csvData = [
        'Ticket ID,Wallet Address,Purchase Date,Status',
        ...tickets.map((ticket: any) =>
          `"${ticket.id}","${ticket.walletAddress}","${ticket.purchaseDate}","${ticket.status}"`
        )
      ].join('\n')

      // Create and download CSV file
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lottery-tickets-${timestamp}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setSuccess(`Successfully exported ${tickets.length} confirmed tickets as CSV for external drawing`)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export tickets')
    } finally {
      setExportLoading(false)
    }
  }

  const selectManualWinner = async () => {
    setManualWinnerLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (!winningTicketId.trim()) {
        setError('Please enter a winning ticket ID')
        return
      }

      const response = await fetch('/api/admin/manual-winner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': adminKey
        },
        body: JSON.stringify({
          winningTicketId: winningTicketId.trim()
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to select manual winner')
      }

      const result = await response.json()
      setSuccess(`Manual winner selected! Ticket ${result.metadata.winningTicketId} (${result.metadata.winnerWallet}) has won the jackpot. Draw ${result.data.id} created and ${result.metadata.ticketsArchived} tickets archived.`)
      setWinningTicketId('') // Clear the input
      fetchAnalytics() // Refresh analytics
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select manual winner')
    } finally {
      setManualWinnerLoading(false)
    }
  }

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImageUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', file)

      const response = await fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to upload image')
      }

      const result = await response.json()
      
      // Add the new image URL to the array (max 3 images)
      setJackpotForm(prev => ({
        ...prev,
        imageUrls: prev.imageUrls.length < 3 
          ? [...prev.imageUrls, result.data.url]
          : [...prev.imageUrls.slice(1), result.data.url] // Replace oldest if at max
      }))
      setSuccess(`Image uploaded successfully (${(result.data.size / 1024).toFixed(1)} KB) - ${jackpotForm.imageUrls.length + 1}/3 images`)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image')
    } finally {
      setImageUploading(false)
      // Clear the input so the same file can be uploaded again if needed
      event.target.value = ''
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

        {/* External Drawing Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ExternalLink className="h-5 w-5" />
              External Drawing
            </CardTitle>
            <CardDescription>
              Export tickets and select winners from external draws
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
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

            <Separator />

            <div className="space-y-3">
              <div className="text-sm font-medium text-muted-foreground">Manual Winner Selection</div>
              <div className="space-y-2">
                <Label htmlFor="winning-ticket-id">Winning Ticket ID</Label>
                <Input
                  id="winning-ticket-id"
                  value={winningTicketId}
                  onChange={(e) => setWinningTicketId(e.target.value)}
                  placeholder="e.g., 000042"
                  className="font-mono"
                />
                <div className="text-xs text-muted-foreground">
                  Enter the ticket ID from external drawing (live stream, random picker, etc.)
                </div>
              </div>
              
              <Button
                onClick={selectManualWinner}
                disabled={manualWinnerLoading || !winningTicketId.trim()}
                className="w-full"
                variant="destructive"
              >
                {manualWinnerLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Selecting Winner...
                  </>
                ) : (
                  <>
                    <Trophy className="h-4 w-4 mr-2" />
                    Select Manual Winner
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

      {/* Analytics Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Lifetime Analytics
              </CardTitle>
              <CardDescription>
                Application-wide statistics and activity metrics
              </CardDescription>
            </div>
            <Button
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
              variant="outline"
              size="sm"
            >
              {analyticsLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analyticsLoading && !analytics ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <div className="text-muted-foreground">Loading analytics...</div>
            </div>
          ) : analytics ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Ticket Statistics */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Ticket Activity</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Total Tickets</span>
                    <span className="font-mono font-medium">{analytics.totalTickets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Confirmed</span>
                    <span className="font-mono text-green-600">{analytics.confirmedTickets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Pending</span>
                    <span className="font-mono text-yellow-600">{analytics.pendingTickets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Cancelled</span>
                    <span className="font-mono text-red-600">{analytics.cancelledTickets.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* User & Draw Statistics */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Users & Draws</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Unique Wallets</span>
                    <span className="font-mono font-medium">{analytics.uniqueWallets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Total Draws</span>
                    <span className="font-mono font-medium">{analytics.totalDraws.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Completed</span>
                    <span className="font-mono text-green-600">{analytics.completedDraws.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Avg Tickets/Draw</span>
                    <span className="font-mono font-medium">{analytics.averageTicketsPerDraw.toLocaleString()}</span>
                  </div>
                </div>
              </div>


              {/* Recent Activity */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Last 30 Days</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Confirmed Tickets</span>
                    <span className="font-mono font-medium text-blue-600">{analytics.recentConfirmedTickets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">All New Tickets</span>
                    <span className="font-mono text-gray-600">{analytics.recentAllTickets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">New Draws</span>
                    <span className="font-mono font-medium text-blue-600">{analytics.recentDraws.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Activity Rate</span>
                    <span className="font-mono text-sm">
                      {analytics.recentConfirmedTickets > 0 ? `${(analytics.recentConfirmedTickets / 30).toFixed(1)}/day` : '0/day'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Analytics data not available. Click refresh to load.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current Draw Analytics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="h-5 w-5" />
                Current Draw Analytics
              </CardTitle>
              <CardDescription>
                Active tickets for the current draw (resets after winner selection)
              </CardDescription>
            </div>
            <Button
              onClick={fetchAnalytics}
              disabled={analyticsLoading}
              variant="outline"
              size="sm"
            >
              {analyticsLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analyticsLoading && !analytics ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
              <div className="text-muted-foreground">Loading current draw analytics...</div>
            </div>
          ) : analytics ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Current Draw Tickets */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Active Tickets</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-medium">Total Active</span>
                    <span className="font-mono font-bold text-lg text-blue-600">{analytics.currentDrawTickets.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Confirmed</span>
                    <span className="font-mono text-green-600">{analytics.currentDrawConfirmed.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Pending</span>
                    <span className="font-mono text-yellow-600">{analytics.currentDrawPending.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Cancelled</span>
                    <span className="font-mono text-red-600">{analytics.currentDrawCancelled.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Current Draw Participants */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Current Draw Participants</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Unique Wallets</span>
                    <span className="font-mono font-medium">{analytics.currentDrawUniqueWallets.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Current Draw Status */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Draw Status</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Ready for Export</span>
                    <Badge variant={analytics.currentDrawConfirmed > 0 ? "default" : "secondary"}>
                      {analytics.currentDrawConfirmed > 0 ? "Yes" : "No tickets"}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Confirmation Rate</span>
                    <span className="font-mono text-sm">
                      {analytics.currentDrawTickets > 0 ? `${((analytics.currentDrawConfirmed / analytics.currentDrawTickets) * 100).toFixed(1)}%` : '0%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Current draw analytics not available. Click refresh to load.
            </div>
          )}
        </CardContent>
      </Card>

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
                <Label htmlFor="jackpot-image">Prize Images (Carousel)</Label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      id="jackpot-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={imageUploading || jackpotForm.imageUrls.length >= 3}
                      className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                    />
                    {imageUploading && (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )}
                  </div>
                  
                  {/* Display current images */}
                  {jackpotForm.imageUrls.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground">
                        Current images ({jackpotForm.imageUrls.length}/3):
                      </div>
                      {jackpotForm.imageUrls.map((url, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Input
                            value={url}
                            onChange={(e) => {
                              const newUrls = [...jackpotForm.imageUrls]
                              newUrls[index] = e.target.value
                              setJackpotForm(prev => ({ ...prev, imageUrls: newUrls }))
                            }}
                            placeholder={`Image ${index + 1} URL`}
                            className="text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newUrls = jackpotForm.imageUrls.filter((_, i) => i !== index)
                              setJackpotForm(prev => ({ ...prev, imageUrls: newUrls }))
                            }}
                            className="text-xs"
                          >
                            Remove
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-xs text-muted-foreground">
                    Upload up to 3 images for carousel (JPEG, PNG, WebP, GIF) up to 5MB each. Auto-slides every 5 seconds.
                  </div>
                </div>
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
                <Label htmlFor="jackpot-value">Estimated Value (USD)</Label>
                <Input
                  id="jackpot-value"
                  type="number"
                  value={jackpotForm.estimatedValue ? jackpotForm.estimatedValue / 1000 : ''}
                  onChange={(e) => setJackpotForm(prev => ({ ...prev, estimatedValue: (parseInt(e.target.value) || 0) * 1000 }))}
                  placeholder="125000"
                />
                <div className="text-xs text-muted-foreground">
                  Enter value in USD (e.g., 125000 for $125,000)
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="text-sm font-medium">Preview</div>
              {jackpotForm.imageUrls.length > 0 ? (
                <Carousel 
                  images={jackpotForm.imageUrls}
                  alt={jackpotForm.title}
                  autoSlideInterval={5000}
                  className="border"
                />
              ) : (
                <div className="w-full h-48 bg-gray-100 rounded-lg border flex items-center justify-center">
                  <span className="text-gray-400 text-sm">No images uploaded</span>
                </div>
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