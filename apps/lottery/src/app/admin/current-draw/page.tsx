"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Play, Download, Trophy, Ticket, Loader2, AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { useAdmin } from "../admin-context"
import { LotteryTicket, LotteryConfig } from "@/types/lottery"

const Skeleton = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-muted rounded ${className}`} />
)

export default function CurrentDrawPage() {
  const { adminKey, setSuccess, setError } = useAdmin()
  const [config, setConfig] = useState<LotteryConfig | null>(null)
  const [tickets, setTickets] = useState<LotteryTicket[]>([])
  const [stats, setStats] = useState<any>({})
  const [configLoading, setConfigLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [ticketsLoading, setTicketsLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [processingWinner, setProcessingWinner] = useState(false)

  useEffect(() => {
    fetchConfig()
    fetchStats()
    fetchTickets()
  }, [])

  const fetchStats = async () => {
    setStatsLoading(true)
    try {
      // Use currentOnly=true to skip slow blob storage queries
      const response = await fetch('/api/admin/stats?currentOnly=true', {
        headers: { 'x-admin-key': adminKey }
      })
      if (response.ok) {
        const result = await response.json()
        setStats(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchConfig = async () => {
    setConfigLoading(true)
    try {
      const response = await fetch('/api/admin/lottery-config', {
        headers: { 'x-admin-key': adminKey }
      })
      if (response.ok) {
        const result = await response.json()
        setConfig(result.data)
      }
    } catch (err) {
      console.error('Failed to fetch config:', err)
    } finally {
      setConfigLoading(false)
    }
  }

  const fetchTickets = async () => {
    setTicketsLoading(true)
    try {
      // Use activeOnly parameter for fast KV lookup
      const response = await fetch('/api/admin/lottery-tickets?activeOnly=true', {
        headers: { 'x-admin-key': adminKey }
      })

      if (response.ok) {
        const result = await response.json()
        // Tickets are already filtered to active only by the API
        setTickets(result.data)
      } else {
        throw new Error('Failed to fetch tickets')
      }
    } catch (err) {
      console.error('Failed to fetch tickets:', err)
      setError('Failed to fetch tickets')
      setTickets([])
    } finally {
      setTicketsLoading(false)
    }
  }

  const handleExportTickets = async () => {
    setExporting(true)
    try {
      const response = await fetch('/api/admin/lottery-tickets?activeOnly=true', {
        headers: { 'x-admin-key': adminKey }
      })

      if (!response.ok) throw new Error('Failed to fetch tickets')

      const result = await response.json()
      const currentTickets = result.data // Already filtered to active only

      const dateStamp = new Date().toISOString().split('T')[0]
      const confirmedOnly = currentTickets.filter((t: LotteryTicket) => t.status === 'confirmed')

      // Calculate statistics
      const stats = {
        totalTickets: currentTickets.length,
        confirmedTickets: confirmedOnly.length,
        pendingTickets: currentTickets.filter((t: LotteryTicket) => t.status === 'pending').length,
        cancelledTickets: currentTickets.filter((t: LotteryTicket) => t.status === 'cancelled').length,
        uniqueWallets: new Set(currentTickets.map((t: LotteryTicket) => t.walletAddress)).size,
        totalRevenue: confirmedOnly.reduce((sum: number, t: LotteryTicket) => sum + t.purchasePrice, 0),
        averageTicketsPerWallet: confirmedOnly.length / new Set(confirmedOnly.map((t: LotteryTicket) => t.walletAddress)).size || 0
      }

      // 1. CSV - All tickets
      const headers = ['Ticket ID', 'Wallet Address', 'Status', 'Purchase Date', 'Purchase Price', 'Transaction ID']
      const rows = currentTickets.map((t: LotteryTicket) => [
        t.id,
        t.walletAddress,
        t.status,
        new Date(t.purchaseDate).toISOString(),
        t.purchasePrice,
        t.transactionId || 'N/A'
      ])
      const csv = [headers.join(','), ...rows.map((row: (string | number)[]) => row.join(','))].join('\n')

      // 2. JSON - Full data export
      const json = JSON.stringify({
        exportDate: new Date().toISOString(),
        drawId: config?.currentDrawId || 'unknown',
        statistics: stats,
        tickets: currentTickets
      }, null, 2)

      // 3. TXT - Drawing ceremony list (confirmed tickets only)
      const txt = [
        '═══════════════════════════════════════════════════════════',
        '                  LOTTERY DRAWING CEREMONY',
        '═══════════════════════════════════════════════════════════',
        '',
        `Draw Date: ${config?.nextDrawDate ? new Date(config.nextDrawDate).toLocaleString() : 'Not set'}`,
        `Export Date: ${new Date().toISOString()}`,
        `Draw ID: ${config?.currentDrawId || 'unknown'}`,
        '',
        '───────────────────────────────────────────────────────────',
        '  STATISTICS',
        '───────────────────────────────────────────────────────────',
        `Total Tickets (Confirmed): ${stats.confirmedTickets}`,
        `Pending Tickets: ${stats.pendingTickets}`,
        `Cancelled Tickets: ${stats.cancelledTickets}`,
        `Unique Participants: ${new Set(confirmedOnly.map((t: LotteryTicket) => t.walletAddress)).size}`,
        `Total Revenue: ${stats.totalRevenue.toFixed(2)} STONE`,
        `Average Tickets/Wallet: ${stats.averageTicketsPerWallet.toFixed(2)}`,
        '',
        '───────────────────────────────────────────────────────────',
        '  ELIGIBLE ENTRIES (Confirmed Tickets Only)',
        '───────────────────────────────────────────────────────────',
        '',
        ...confirmedOnly.map((t: LotteryTicket, idx: number) =>
          `${String(idx + 1).padStart(4, ' ')}. Ticket #${t.id.padStart(8, ' ')} | ${t.walletAddress} | ${t.purchasePrice} STONE`
        ),
        '',
        '═══════════════════════════════════════════════════════════',
        `Total Eligible Entries: ${confirmedOnly.length}`,
        '═══════════════════════════════════════════════════════════'
      ].join('\n')

      // 4. Summary report
      const summary = [
        'LOTTERY DRAW SUMMARY REPORT',
        '=' .repeat(60),
        '',
        `Export Date: ${new Date().toISOString()}`,
        `Draw ID: ${config?.currentDrawId || 'unknown'}`,
        `Next Draw: ${config?.nextDrawDate ? new Date(config.nextDrawDate).toLocaleString() : 'Not set'}`,
        `Jackpot: ${config?.currentJackpot?.title || 'Not set'}`,
        '',
        'TICKET STATISTICS',
        '-'.repeat(60),
        `Total Tickets: ${stats.totalTickets}`,
        `  - Confirmed: ${stats.confirmedTickets} (${((stats.confirmedTickets / stats.totalTickets) * 100).toFixed(1)}%)`,
        `  - Pending: ${stats.pendingTickets} (${((stats.pendingTickets / stats.totalTickets) * 100).toFixed(1)}%)`,
        `  - Cancelled: ${stats.cancelledTickets} (${((stats.cancelledTickets / stats.totalTickets) * 100).toFixed(1)}%)`,
        '',
        'PARTICIPANT STATISTICS',
        '-'.repeat(60),
        `Unique Wallets: ${stats.uniqueWallets}`,
        `Unique Confirmed Participants: ${new Set(confirmedOnly.map((t: LotteryTicket) => t.walletAddress)).size}`,
        `Average Tickets per Wallet: ${stats.averageTicketsPerWallet.toFixed(2)}`,
        '',
        'REVENUE STATISTICS',
        '-'.repeat(60),
        `Total Revenue (Confirmed): ${stats.totalRevenue.toFixed(2)} STONE`,
        `Ticket Price: ${config?.ticketPrice || 'N/A'} STONE`,
        '',
        'TOP PARTICIPANTS (by confirmed tickets)',
        '-'.repeat(60),
      ]

      // Add top 10 participants by ticket count
      const walletTicketCount = new Map<string, number>()
      confirmedOnly.forEach((t: LotteryTicket) => {
        walletTicketCount.set(t.walletAddress, (walletTicketCount.get(t.walletAddress) || 0) + 1)
      })
      const topParticipants = Array.from(walletTicketCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)

      topParticipants.forEach(([wallet, count], idx) => {
        summary.push(`${idx + 1}. ${wallet.slice(0, 12)}...${wallet.slice(-8)} - ${count} tickets`)
      })

      summary.push('')
      summary.push('VERIFICATION CHECKLIST')
      summary.push('-'.repeat(60))
      summary.push(`[ ] All ${stats.confirmedTickets} confirmed tickets have valid blockchain transactions`)
      summary.push(`[ ] All transaction IDs verified on Stacks blockchain`)
      summary.push(`[ ] All STONE burns confirmed to address: SP000000000000000000002Q6VF78`)
      summary.push(`[ ] No duplicate tickets detected`)
      summary.push(`[ ] Winner selection process is ready`)
      summary.push(`[ ] Prize distribution wallet is prepared`)
      summary.push('')
      summary.push('=' .repeat(60))
      summary.push('Report generated by Charisma Lottery Admin System')
      summary.push('=' .repeat(60))

      const summaryTxt = summary.join('\n')

      // 5. Wallet list (unique confirmed wallets only)
      const walletList = [
        'UNIQUE CONFIRMED PARTICIPANTS',
        '=' .repeat(60),
        '',
        `Total Unique Wallets: ${new Set(confirmedOnly.map((t: LotteryTicket) => t.walletAddress)).size}`,
        `Export Date: ${new Date().toISOString()}`,
        '',
        'WALLET ADDRESSES (one per line)',
        '-'.repeat(60),
        '',
        ...Array.from(new Set(confirmedOnly.map((t: LotteryTicket) => t.walletAddress))).sort()
      ].join('\n')

      // Create downloads for all files
      const downloads = [
        { content: csv, filename: `lottery-tickets-all-${dateStamp}.csv`, type: 'text/csv' },
        { content: json, filename: `lottery-data-${dateStamp}.json`, type: 'application/json' },
        { content: txt, filename: `drawing-ceremony-${dateStamp}.txt`, type: 'text/plain' },
        { content: summaryTxt, filename: `draw-summary-${dateStamp}.txt`, type: 'text/plain' },
        { content: walletList, filename: `confirmed-wallets-${dateStamp}.txt`, type: 'text/plain' }
      ]

      // Download all files sequentially
      for (const { content, filename, type } of downloads) {
        const blob = new Blob([content], { type })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        window.URL.revokeObjectURL(url)
        // Small delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      setSuccess(`Exported ${downloads.length} files for drawing ceremony`)
    } catch (err) {
      console.error('Export failed:', err)
      setError('Failed to export tickets')
    } finally {
      setExporting(false)
    }
  }

  const handleSelectWinner = async () => {
    if (!confirm('Are you sure you want to manually select a winner? This will end the current draw.')) {
      return
    }

    setProcessingWinner(true)
    try {
      const response = await fetch('/api/admin/select-winner', {
        method: 'POST',
        headers: {
          'x-admin-key': adminKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to select winner')
      }

      const result = await response.json()
      setSuccess(`Winner selected: ${result.winner.walletAddress}`)
      await Promise.all([fetchConfig(), fetchStats(), fetchTickets()])
    } catch (err) {
      console.error('Winner selection failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to select winner')
    } finally {
      setProcessingWinner(false)
    }
  }

  // Use stats from stats endpoint (fast) instead of filtering tickets (slow)
  const confirmedTickets = tickets.filter(t => t.status === 'confirmed')
  const confirmedCount = stats.currentDrawConfirmed || 0
  const pendingCount = stats.currentDrawPending || 0
  const cancelledCount = stats.currentDrawCancelled || 0
  const uniqueWalletsCount = stats.currentDrawUniqueWallets || 0
  const totalTicketsCount = stats.currentDrawTickets || 0

  return (
    <div className="space-y-6">
      {/* Draw Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="h-5 w-5" />
            Current Draw Overview
          </CardTitle>
          <CardDescription>
            Manage the active lottery draw and ticket operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statsLoading || configLoading ? (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="space-y-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-8 w-20" />
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-7 w-24" />
              </div>
            </>
          ) : (
            <>
              <div className="grid md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Total Tickets</div>
                  <div className="text-2xl font-bold">{totalTicketsCount}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Confirmed</div>
                  <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Pending</div>
                  <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-muted-foreground">Unique Wallets</div>
                  <div className="text-2xl font-bold">{uniqueWalletsCount}</div>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Next Draw Date</div>
                  <div className="text-sm text-muted-foreground">
                    {config?.nextDrawDate ? new Date(config.nextDrawDate).toLocaleString() : 'Not set'}
                  </div>
                </div>
                <Badge variant={config?.isActive ? "default" : "secondary"} className="text-base px-4 py-2">
                  {config?.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Draw Operations</CardTitle>
          <CardDescription>
            Export data, select winners, and manage tickets
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statsLoading || configLoading ? (
            <div className="grid md:grid-cols-2 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-4">
                <Button
                  onClick={handleExportTickets}
                  disabled={exporting || tickets.length === 0}
                  variant="outline"
                  className="w-full h-auto flex-col items-start p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {exporting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Download className="h-5 w-5" />
                    )}
                    <span className="font-semibold">Export Drawing Package</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-left">
                    Download 5 files: CSV, JSON, ceremony list, summary report, and wallet list
                  </p>
                </Button>

                <Button
                  onClick={handleSelectWinner}
                  disabled={processingWinner || confirmedCount === 0}
                  className="w-full h-auto flex-col items-start p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {processingWinner ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Trophy className="h-5 w-5" />
                    )}
                    <span className="font-semibold">Select Winner</span>
                  </div>
                  <p className="text-xs text-left opacity-90">
                    Manually trigger winner selection for current draw
                  </p>
                </Button>
              </div>

              {confirmedCount === 0 && (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  No confirmed tickets available for winner selection
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Ticket List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            Active Tickets {!ticketsLoading && `(${tickets.length})`}
          </CardTitle>
          <CardDescription>
            All tickets in the current draw
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ticketsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tickets in current draw
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {tickets.slice(0, 50).map((ticket) => (
                <div
                  key={ticket.id}
                  className="flex items-center justify-between p-3 border rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="font-mono text-sm font-medium">#{ticket.id}</div>
                    <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                      {ticket.walletAddress}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">
                      {new Date(ticket.purchaseDate).toLocaleDateString()}
                    </div>
                    <Badge
                      variant={
                        ticket.status === 'confirmed' ? 'default' :
                        ticket.status === 'pending' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {ticket.status === 'confirmed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                      {ticket.status === 'pending' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                      {ticket.status === 'cancelled' && <XCircle className="h-3 w-3 mr-1" />}
                      {ticket.status}
                    </Badge>
                  </div>
                </div>
              ))}
              {tickets.length > 50 && (
                <div className="text-center text-sm text-muted-foreground py-2">
                  Showing first 50 of {tickets.length} tickets
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
