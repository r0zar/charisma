"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Wrench, AlertTriangle, CheckCircle2, RefreshCw, Loader2, ExternalLink, Search, ArrowUpDown } from "lucide-react"
import { useAdmin } from "../admin-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface TicketVerification {
  ticketId: string
  walletAddress: string
  status: string
  purchasePrice: number
  purchaseDate: string
  transactionId: string | null
  explorerUrl: string | null
  hasIssue: boolean
  issueType: 'confirmed_no_txid' | 'pending_no_txid' | null
  issueMessage: string | null
}

interface VerificationStats {
  totalTickets: number
  ticketsWithIssues: number
  confirmedNoTxid: number
  pendingNoTxid: number
  ticketsWithTxid: number
}

export default function DebugPage() {
  const { adminKey, setSuccess, setError } = useAdmin()
  const [verifying, setVerifying] = useState(false)
  const [tickets, setTickets] = useState<TicketVerification[]>([])
  const [stats, setStats] = useState<VerificationStats | null>(null)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [progressLogs, setProgressLogs] = useState<string[]>([])
  const [progressStep, setProgressStep] = useState(0)
  const [totalSteps, setTotalSteps] = useState(0)

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState<'ticketId' | 'wallet' | 'date' | 'price'>('ticketId')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [walletFilter, setWalletFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'cancelled'>('all')
  const [showCount, setShowCount] = useState(50)

  useEffect(() => {
    const fetchTicketDateRange = async () => {
      try {
        const response = await fetch('/api/admin/lottery-tickets?activeOnly=true', {
          headers: { 'x-admin-key': adminKey }
        })
        if (response.ok) {
          const result = await response.json()
          const ticketData = result.data || []

          if (ticketData.length > 0) {
            const dates = ticketData.map((t: any) => new Date(t.purchaseDate).getTime())
            const earliest = new Date(Math.min(...dates))
            const latest = new Date(Math.max(...dates))

            setStartDate(earliest.toISOString().slice(0, 10))
            setEndDate(latest.toISOString().slice(0, 10))
          } else {
            const end = new Date()
            const start = new Date()
            start.setDate(start.getDate() - 30)
            setStartDate(start.toISOString().slice(0, 10))
            setEndDate(end.toISOString().slice(0, 10))
          }
        }
      } catch (err) {
        console.error('Failed to fetch ticket date range:', err)
        const end = new Date()
        const start = new Date()
        start.setDate(start.getDate() - 30)
        setStartDate(start.toISOString().slice(0, 10))
        setEndDate(end.toISOString().slice(0, 10))
      }
    }

    fetchTicketDateRange()
  }, [adminKey])

  const addProgressLog = (message: string) => {
    setProgressLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`])
  }

  const handleVerifyBlockchain = async () => {
    if (!startDate || !endDate) {
      setError('Please select a date range')
      return
    }

    setVerifying(true)
    setTickets([])
    setStats(null)
    setProgressLogs([])
    setProgressStep(0)
    setTotalSteps(7) // Setup + 5 chunks + final processing

    try {
      addProgressLog('Starting blockchain verification...')
      setProgressStep(1)

      // Calculate date chunks (5 equal chunks)
      const start = new Date(startDate)
      const end = new Date(endDate)
      const totalMs = end.getTime() - start.getTime()
      const chunkMs = totalMs / 5

      const chunks: Array<{ start: string; end: string }> = []
      for (let i = 0; i < 5; i++) {
        const chunkStart = new Date(start.getTime() + chunkMs * i)
        const chunkEnd = new Date(start.getTime() + chunkMs * (i + 1))
        chunks.push({
          start: chunkStart.toISOString().slice(0, 10),
          end: chunkEnd.toISOString().slice(0, 10)
        })
      }

      addProgressLog(`Fetching tickets in 5 chunks from ${startDate} to ${endDate}...`)

      const allTickets: TicketVerification[] = []

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i]
        setProgressStep(2 + i) // Steps 2-6

        addProgressLog(`Processing chunk ${i + 1}/5: ${chunk.start} to ${chunk.end}...`)

        const response = await fetch('/api/admin/verify-blockchain', {
          method: 'POST',
          headers: {
            'x-admin-key': adminKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ startDate: chunk.start, endDate: chunk.end })
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Verification failed')
        }

        const result = await response.json()

        if (result.data.tickets.length > 0) {
          allTickets.push(...result.data.tickets)
          addProgressLog(`  └─ Found ${result.data.tickets.length} tickets in chunk ${i + 1}`)
        } else {
          addProgressLog(`  └─ No tickets in chunk ${i + 1}`)
        }
      }

      setProgressStep(7)
      addProgressLog('Combining results and calculating statistics...')

      // Calculate combined stats
      const combinedStats = {
        totalTickets: allTickets.length,
        ticketsWithIssues: allTickets.filter(t => t.hasIssue).length,
        confirmedNoTxid: allTickets.filter(t => t.issueType === 'confirmed_no_txid').length,
        pendingNoTxid: allTickets.filter(t => t.issueType === 'pending_no_txid').length,
        ticketsWithTxid: allTickets.filter(t => t.transactionId).length
      }

      // Sort tickets: issues first
      allTickets.sort((a, b) => {
        if (a.hasIssue && !b.hasIssue) return -1
        if (!a.hasIssue && b.hasIssue) return 1
        return a.ticketId.localeCompare(b.ticketId)
      })

      setTickets(allTickets)
      setStats(combinedStats)

      addProgressLog(`Found ${combinedStats.totalTickets} total tickets`)
      addProgressLog(`${combinedStats.ticketsWithTxid} tickets have transaction IDs`)

      if (combinedStats.ticketsWithIssues === 0) {
        addProgressLog('✓ Verification complete - no issues found!')
        addProgressLog('✓ All tickets have proper transaction IDs')
        setSuccess('Blockchain verification complete - no issues found')
      } else {
        addProgressLog(`⚠ Found ${combinedStats.ticketsWithIssues} ticket(s) with issues`)
        if (combinedStats.confirmedNoTxid > 0) {
          addProgressLog(`⚠ ${combinedStats.confirmedNoTxid} confirmed ticket(s) missing transaction ID`)
        }
        if (combinedStats.pendingNoTxid > 0) {
          addProgressLog(`⚠ ${combinedStats.pendingNoTxid} pending ticket(s) missing transaction ID`)
        }
        setError(`Found ${combinedStats.ticketsWithIssues} issue(s)`)
      }
    } catch (err) {
      console.error('Verification failed:', err)
      addProgressLog(`✗ Error: ${err instanceof Error ? err.message : 'Verification failed'}`)
      setError(err instanceof Error ? err.message : 'Failed to verify blockchain data')
    } finally {
      setVerifying(false)
    }
  }

  const issuesTickets = tickets.filter(t => t.hasIssue)

  // Apply filters and sorting to healthy tickets
  const healthyTickets = tickets
    .filter(t => !t.hasIssue)
    .filter(t => {
      // Wallet filter
      if (walletFilter && !t.walletAddress.toLowerCase().includes(walletFilter.toLowerCase())) {
        return false
      }
      // Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false
      }
      return true
    })
    .sort((a, b) => {
      let comparison = 0

      switch (sortBy) {
        case 'ticketId':
          comparison = a.ticketId.localeCompare(b.ticketId)
          break
        case 'wallet':
          comparison = a.walletAddress.localeCompare(b.walletAddress)
          break
        case 'date':
          comparison = new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
          break
        case 'price':
          comparison = a.purchasePrice - b.purchasePrice
          break
      }

      return sortOrder === 'asc' ? comparison : -comparison
    })

  const displayedHealthyTickets = healthyTickets.slice(0, showCount)

  return (
    <div className="space-y-6">
      {/* Date Range Filter & Verify */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Blockchain Verification
          </CardTitle>
          <CardDescription>
            Review all tickets and their transaction IDs to ensure blockchain integrity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted/30 rounded-md text-sm">
            <div className="font-medium mb-1">Simple Verification</div>
            <div className="text-muted-foreground text-xs">
              Lists all tickets with their transaction IDs and flags any confirmed or pending tickets without proper blockchain records.
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <Button
            onClick={handleVerifyBlockchain}
            disabled={verifying || !startDate || !endDate}
            className="w-full"
            size="lg"
          >
            {verifying ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Verifying Blockchain Data...
              </>
            ) : (
              <>
                <RefreshCw className="h-5 w-5 mr-2" />
                Verify Blockchain Data
              </>
            )}
          </Button>

          {/* Progress Display */}
          {(verifying || progressLogs.length > 0) && (
            <div className="space-y-3 pt-4 border-t">
              {verifying && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-medium">{progressStep} / {totalSteps}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-primary h-full transition-all duration-300"
                      style={{ width: `${(progressStep / totalSteps) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <div className="text-sm font-medium">Verification Log</div>
                <div className="max-h-48 overflow-y-auto bg-muted/30 rounded-md p-3 space-y-1 font-mono text-xs">
                  {progressLogs.map((log, idx) => (
                    <div key={idx} className={`${
                      log.includes('✓') ? 'text-green-600' :
                      log.includes('⚠') ? 'text-yellow-600' :
                      log.includes('✗') ? 'text-red-600' :
                      'text-muted-foreground'
                    }`}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Statistics Summary */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Summary</CardTitle>
            <CardDescription>
              Statistics for tickets from {startDate} to {endDate}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-5 gap-4">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Total Tickets</div>
                <div className="text-2xl font-bold">{stats.totalTickets}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">With Transaction ID</div>
                <div className="text-2xl font-bold text-green-600">{stats.ticketsWithTxid}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Issues Found</div>
                <div className="text-2xl font-bold text-red-600">{stats.ticketsWithIssues}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Confirmed (No TxID)</div>
                <div className="text-2xl font-bold text-red-600">{stats.confirmedNoTxid}</div>
              </div>
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Pending (No TxID)</div>
                <div className="text-2xl font-bold text-yellow-600">{stats.pendingNoTxid}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tickets with Issues */}
      {issuesTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Tickets with Issues ({issuesTickets.length})
            </CardTitle>
            <CardDescription>
              These tickets require attention - missing transaction IDs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {issuesTickets.map((ticket) => (
                <div
                  key={ticket.ticketId}
                  className="p-4 border rounded-lg bg-muted/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">#{ticket.ticketId}</span>
                        <Badge variant={
                          ticket.status === 'confirmed' ? 'destructive' : 'secondary'
                        }>
                          {ticket.status}
                        </Badge>
                        {ticket.hasIssue && (
                          <Badge variant="outline" className="text-red-600 border-red-600">
                            {ticket.issueType === 'confirmed_no_txid' ? 'CRITICAL' : 'WARNING'}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <div>Wallet: <span className="font-mono">{ticket.walletAddress}</span></div>
                        <div>Price: {ticket.purchasePrice} STONE</div>
                        <div>Date: {new Date(ticket.purchaseDate).toLocaleString()}</div>
                      </div>
                      {ticket.issueMessage && (
                        <div className="p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          {ticket.issueMessage}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      {ticket.transactionId ? (
                        <a
                          href={ticket.explorerUrl || '#'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          View Transaction
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <div className="text-sm text-muted-foreground">
                          No transaction ID
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Healthy Tickets */}
      {healthyTickets.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="h-5 w-5" />
              Verified Tickets ({healthyTickets.length})
            </CardTitle>
            <CardDescription>
              All tickets with proper transaction IDs
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Filters and Sorting Controls */}
            <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
              <div className="grid md:grid-cols-4 gap-4">
                {/* Search by Wallet */}
                <div className="space-y-2">
                  <Label htmlFor="wallet-search" className="text-xs">Search Wallet</Label>
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="wallet-search"
                      placeholder="SP1ABC..."
                      value={walletFilter}
                      onChange={(e) => setWalletFilter(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-2">
                  <Label htmlFor="status-filter" className="text-xs">Filter by Status</Label>
                  <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                    <SelectTrigger id="status-filter">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort By */}
                <div className="space-y-2">
                  <Label htmlFor="sort-by" className="text-xs">Sort By</Label>
                  <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                    <SelectTrigger id="sort-by">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ticketId">Ticket ID</SelectItem>
                      <SelectItem value="wallet">Wallet Address</SelectItem>
                      <SelectItem value="date">Purchase Date</SelectItem>
                      <SelectItem value="price">Purchase Price</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Sort Order */}
                <div className="space-y-2">
                  <Label htmlFor="sort-order" className="text-xs">Sort Order</Label>
                  <Select value={sortOrder} onValueChange={(value: any) => setSortOrder(value)}>
                    <SelectTrigger id="sort-order">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Results Info */}
              <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                  Showing {displayedHealthyTickets.length} of {healthyTickets.length} tickets
                  {walletFilter && ` (filtered by wallet: ${walletFilter})`}
                  {statusFilter !== 'all' && ` (filtered by status: ${statusFilter})`}
                </div>
                {healthyTickets.length > showCount && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCount(prev => prev + 50)}
                  >
                    Show More
                  </Button>
                )}
              </div>
            </div>

            {/* Ticket List */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {displayedHealthyTickets.map((ticket) => (
                <div
                  key={ticket.ticketId}
                  className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm">#{ticket.ticketId}</span>
                      <Badge variant={
                        ticket.status === 'confirmed' ? 'default' :
                        ticket.status === 'pending' ? 'secondary' :
                        'destructive'
                      }>
                        {ticket.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{ticket.purchasePrice} STONE</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(ticket.purchaseDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground font-mono truncate max-w-[150px]">
                        {ticket.walletAddress}
                      </span>
                      {ticket.transactionId && ticket.explorerUrl && (
                        <a
                          href={ticket.explorerUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {displayedHealthyTickets.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <div>No tickets match your filters</div>
                </div>
              )}
            </div>

            {/* Show All Button */}
            {healthyTickets.length > displayedHealthyTickets.length && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCount(healthyTickets.length)}
                >
                  Show All {healthyTickets.length} Tickets
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Data State */}
      {tickets.length === 0 && !verifying && progressLogs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <div className="text-lg font-medium mb-2">No Verification Data</div>
            <div className="text-sm">
              Select a date range and click "Verify Blockchain Data" to begin verification
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
