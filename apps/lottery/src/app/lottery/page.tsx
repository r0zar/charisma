"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/contexts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dice6,
  Clock,
  Trophy,
  Wallet,
  History,
  Zap,
  Star,
  Target,
  Package,
  Hash,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { Footer } from "@/components/footer"
import { TicketConfirmation } from "@/components/ticket-confirmation"
import { BulkTicketConfirmation } from "@/components/bulk-ticket-confirmation"
import { JackpotSection } from "@/components/lottery/jackpot-section"
import { PurchaseControls } from "@/components/lottery/purchase-controls"
import { ConfirmationDialog } from "@/components/lottery/confirmation-dialog"



// Constants
const mockTicketPrice = 5 // 5 STONE


async function getLatestWinningNumbers() {
  try {
    const response = await fetch('/api/v1/lottery/latest-result')
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch latest results')
    }
    
    return result.data
  } catch (error) {
    console.error('Failed to get latest winning numbers:', error)
    throw new Error('Lottery drawing data not available. Please connect to the blockchain lottery contract to fetch the latest winning numbers.')
  }
}

async function getPastDraws() {
  try {
    const response = await fetch('/api/v1/lottery/results?limit=10')
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch past draws')
    }
    
    return result.data
  } catch (error) {
    console.error('Failed to get past draws:', error)
    throw new Error('Historical lottery data not available. Please connect to the blockchain lottery contract to fetch past drawing results.')
  }
}

// Results Section Component
function ResultsSection() {
  const [error, setError] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<any>(null)
  const [pastDraws, setPastDraws] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchResults = async () => {
    setLoading(true)
    setError(null)

    try {
      const [latest, past] = await Promise.all([
        getLatestWinningNumbers(),
        getPastDraws()
      ])
      setLatestResult(latest)
      setPastDraws(past)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch lottery results')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
  }, [])

  const handleRetry = () => {
    fetchResults()
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Trophy className="h-5 w-5" />
              Loading Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading lottery results...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-destructive/20">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <Trophy className="h-5 w-5" />
              Results Unavailable
            </CardTitle>
            <CardDescription>
              Unable to load lottery drawing data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 space-y-4">
              <div className="text-muted-foreground">
                {error}
              </div>
              <Button variant="outline" onClick={handleRetry} size="lg">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Lottery Results ({pastDraws.length})
          </CardTitle>
          <CardDescription>
            Recent lottery draw results and winners
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {/* Compact List Header */}
            <div className="grid grid-cols-12 gap-4 px-3 py-2 text-sm font-medium text-muted-foreground border-b">
              <div className="col-span-2">Draw</div>
              <div className="col-span-4">Winning Numbers</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-2">Winner</div>
              <div className="col-span-2">Prize</div>
            </div>
            
            {/* Compact Results List */}
            {pastDraws.map((draw: any) => (
              <div key={draw.id} className="grid grid-cols-12 gap-4 px-3 py-3 hover:bg-muted/50 rounded-lg border-b border-border/20">
                {/* Draw ID */}
                <div className="col-span-2">
                  <div className="font-mono text-sm">
                    #{draw.id.split('-').pop()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {draw.totalTicketsSold} tickets
                  </div>
                </div>
                
                {/* Winning Numbers */}
                <div className="col-span-4">
                  <div className="flex gap-1">
                    {draw.winningNumbers.map((number: number, index: number) => (
                      <div
                        key={index}
                        className="w-6 h-6 rounded-full bg-yellow-500 text-white text-xs font-bold flex items-center justify-center"
                      >
                        {number}
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Date */}
                <div className="col-span-2">
                  <div className="text-sm">
                    {new Date(draw.drawDate).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(draw.drawDate).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
                
                {/* Winner Info */}
                <div className="col-span-2">
                  {draw.winners.length > 0 ? (
                    <div>
                      <div className="text-sm font-medium text-green-600">
                        {draw.winners[0].winnerCount} Winner{draw.winners[0].winnerCount !== 1 ? 's' : ''}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        6 matches
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No winner
                    </div>
                  )}
                </div>
                
                {/* Prize Amount */}
                <div className="col-span-2">
                  {draw.winners.length > 0 ? (
                    <div>
                      <div className="text-sm font-medium">
                        {draw.winners[0].prizePerWinner.toLocaleString()} STONE
                      </div>
                      <div className="text-xs text-muted-foreground">
                        per winner
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      {draw.jackpotAmount.toLocaleString()} STONE
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            <div className="text-center pt-4">
              <Button variant="outline" onClick={handleRetry}>
                Refresh Results
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// User tickets data function
async function getUserTickets(walletAddress: string) {
  try {
    const response = await fetch(`/api/v1/lottery/my-tickets?walletAddress=${encodeURIComponent(walletAddress)}`)
    const result = await response.json()
    
    if (!response.ok || !result.success) {
      throw new Error(result.error || 'Failed to fetch user tickets')
    }
    
    return result.data
  } catch (error) {
    console.error('Failed to get user tickets:', error)
    throw new Error('User ticket data not available. Please connect to the blockchain lottery contract to fetch your purchased tickets.')
  }
}


// My Tickets Section Component
function MyTicketsSection() {
  const { walletState, connectWallet, isConnecting } = useWallet()
  const [error, setError] = useState<string | null>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [confirmingTickets, setConfirmingTickets] = useState<Set<string>>(new Set())

  const fetchTickets = async () => {
    if (!walletState.connected || !walletState.address) return
    
    setLoading(true)
    setError(null)

    try {
      const userTickets = await getUserTickets(walletState.address)
      setTickets(userTickets)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user tickets')
    } finally {
      setLoading(false)
    }
  }

  // Filter tickets based on selected filter
  const filteredTickets = tickets.filter(ticket => {
    switch (filter) {
      case 'active':
        return ticket.status === 'pending' || ticket.status === 'confirmed'
      case 'archived':
        return ticket.status === 'archived'
      case 'all':
        return true
      default:
        return true
    }
  })

  useEffect(() => {
    if (walletState.connected && walletState.address) {
      fetchTickets()
    }
  }, [walletState.connected, walletState.address])

  const handleRetry = () => {
    fetchTickets()
  }

  const handleConfirmationUpdate = (ticketId: string, status: 'confirming' | 'confirmed' | 'failed') => {
    if (status === 'confirming') {
      setConfirmingTickets(prev => new Set(prev).add(ticketId))
    } else {
      setConfirmingTickets(prev => {
        const newSet = new Set(prev)
        newSet.delete(ticketId)
        return newSet
      })
      
      if (status === 'confirmed') {
        // Update the ticket status in our local state
        setTickets(prev => prev.map(ticket => 
          ticket.id === ticketId 
            ? { ...ticket, status: 'confirmed' }
            : ticket
        ))
      }
      
      // Optionally refresh tickets to get latest data
      fetchTickets()
    }
  }

  const handleBulkConfirmationUpdate = (ticketIds: string[], status: 'confirming' | 'confirmed' | 'failed') => {
    if (status === 'confirming') {
      setConfirmingTickets(prev => {
        const newSet = new Set(prev)
        ticketIds.forEach(id => newSet.add(id))
        return newSet
      })
    } else {
      setConfirmingTickets(prev => {
        const newSet = new Set(prev)
        ticketIds.forEach(id => newSet.delete(id))
        return newSet
      })
      
      if (status === 'confirmed') {
        // Update all ticket statuses in our local state
        setTickets(prev => prev.map(ticket => 
          ticketIds.includes(ticket.id)
            ? { ...ticket, status: 'confirmed' }
            : ticket
        ))
      }
      
      // Optionally refresh tickets to get latest data
      fetchTickets()
    }
  }

  // Group tickets by purchase batch (same wallet, similar timestamp)
  const groupTicketsByBatch = (tickets: any[]) => {
    const groups: any[][] = []
    const processed = new Set<string>()
    
    tickets.forEach(ticket => {
      if (processed.has(ticket.id)) return
      
      // Find tickets purchased within the same minute (bulk purchase)
      const purchaseTime = new Date(ticket.purchaseDate).getTime()
      const batchTickets = tickets.filter(t => {
        const tTime = new Date(t.purchaseDate).getTime()
        return Math.abs(tTime - purchaseTime) < 60000 && // Within 1 minute
               t.walletAddress === ticket.walletAddress &&
               t.status === ticket.status &&
               !processed.has(t.id)
      })
      
      batchTickets.forEach(t => processed.add(t.id))
      groups.push(batchTickets)
    })
    
    return groups
  }

  if (!walletState.connected) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Wallet className="h-5 w-5" />
              My Tickets
            </CardTitle>
            <CardDescription>
              Your purchased tickets for upcoming draws
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 space-y-4">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
              <div className="text-muted-foreground">Connect your wallet to view tickets</div>
              <Button onClick={connectWallet} disabled={isConnecting} size="lg" className="mt-4">
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Wallet className="h-5 w-5" />
              Loading Tickets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="text-muted-foreground">Loading your tickets...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="border-destructive/20">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2 text-destructive">
              <Wallet className="h-5 w-5" />
              Tickets Unavailable
            </CardTitle>
            <CardDescription>
              Unable to load your ticket data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 space-y-4">
              <div className="text-muted-foreground">
                {error}
              </div>
              <Button variant="outline" onClick={handleRetry} size="lg">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                My Tickets ({filteredTickets.length})
              </CardTitle>
              <CardDescription>
                Your purchased tickets for lottery draws
              </CardDescription>
            </div>
            
            {/* Filter Controls */}
            <div className="flex gap-2">
              <Button
                variant={filter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('active')}
              >
                Active ({tickets.filter(t => t.status === 'pending' || t.status === 'confirmed').length})
              </Button>
              <Button
                variant={filter === 'archived' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('archived')}
              >
                Archived ({tickets.filter(t => t.status === 'archived').length})
              </Button>
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All ({tickets.length})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredTickets.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
              <div className="text-muted-foreground">
                {filter === 'active' 
                  ? "No active tickets" 
                  : filter === 'archived' 
                    ? "No archived tickets"
                    : "You haven't purchased any tickets yet"
                }
              </div>
              {filter === 'active' && (
                <div className="text-sm text-muted-foreground">
                  Purchase tickets in the Play tab to participate in upcoming draws
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Show pending tickets grouped by batch with bulk confirmation UI */}
              {groupTicketsByBatch(filteredTickets.filter(ticket => ticket.status === 'pending')).map((ticketGroup: any[], groupIndex: number) => {
                if (ticketGroup.length === 1) {
                  // Single ticket - use individual confirmation
                  return (
                    <TicketConfirmation
                      key={ticketGroup[0].id}
                      ticket={ticketGroup[0]}
                      onConfirmationUpdate={handleConfirmationUpdate}
                    />
                  )
                } else {
                  // Multiple tickets - use bulk confirmation
                  return (
                    <BulkTicketConfirmation
                      key={`bulk-${groupIndex}`}
                      tickets={ticketGroup}
                      onConfirmationUpdate={handleBulkConfirmationUpdate}
                    />
                  )
                }
              })}
              
              {/* Show other tickets grouped as well */}
              {groupTicketsByBatch(filteredTickets.filter(ticket => ticket.status !== 'pending')).map((ticketGroup: any[], groupIndex: number) => {
                if (ticketGroup.length === 1) {
                  // Single ticket - show individual compact view
                  const ticket = ticketGroup[0]
                  return (
                    <Card key={ticket.id} className="p-4">
                      <div className="grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-2">
                          <div className="font-mono text-sm">#{ticket.id.split('-').pop()}</div>
                          {ticket.drawResult && (
                            <div className="text-xs text-muted-foreground">
                              Draw #{ticket.drawResult.split('-').pop()}
                            </div>
                          )}
                        </div>
                        <div className="col-span-4">
                          <div className="flex gap-1">
                            {ticket.numbers.map((number: number, index: number) => (
                              <div
                                key={index}
                                className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center"
                              >
                                {number}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-sm">{new Date(ticket.purchaseDate).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(ticket.purchaseDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                        <div className="col-span-2">
                          <Badge 
                            variant={
                              ticket.status === 'confirmed' ? 'default' : 
                              ticket.status === 'archived' ? 'outline' : 'destructive'
                            }
                            className="text-xs"
                          >
                            {ticket.status}
                          </Badge>
                        </div>
                        <div className="col-span-2">
                          <div className="text-sm font-medium">{ticket.purchasePrice} STONE</div>
                        </div>
                      </div>
                    </Card>
                  )
                } else {
                  // Multiple tickets - show bulk summary
                  const totalAmount = ticketGroup.reduce((sum, t) => sum + t.purchasePrice, 0)
                  return (
                    <BulkTicketConfirmation
                      key={`bulk-other-${groupIndex}`}
                      tickets={ticketGroup}
                      onConfirmationUpdate={handleBulkConfirmationUpdate}
                    />
                  )
                }
              })}
              
              <div className="text-center pt-4">
                <Button variant="outline" onClick={handleRetry}>
                  Refresh Tickets
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default function LotteryPage() {
  const { walletState, connectWallet, isConnecting } = useWallet()
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState("play")
  const [bulkQuantity, setBulkQuantity] = useState(1)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean
    tickets: any[]
    isBulk: boolean
  }>({ isOpen: false, tickets: [], isBulk: false })

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleNumberToggle = (number: number) => {
    setSelectedNumbers(prev =>
      prev.includes(number)
        ? prev.filter(n => n !== number)
        : [...prev, number]
    )
  }

  const handleQuickPick = () => {
    const numbers: number[] = []
    while (numbers.length < 6) {
      const num = Math.floor(Math.random() * 49) + 1
      if (!numbers.includes(num)) {
        numbers.push(num)
      }
    }
    setSelectedNumbers(numbers.sort((a, b) => a - b))
  }

  const handleClearSelection = () => {
    setSelectedNumbers([])
  }

  const handlePurchaseTicket = async () => {
    if (!walletState.connected || !walletState.address) {
      connectWallet()
      return
    }
    
    setIsPurchasing(true)
    setPurchaseError(null)
    
    try {
      if (bulkMode) {
        // Bulk purchase
        const response = await fetch('/api/v1/lottery/purchase-bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: walletState.address,
            quantity: bulkQuantity
          })
        })
        
        const result = await response.json()
        
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to purchase bulk tickets')
        }
        
        // Open confirmation dialog with bulk tickets
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          setConfirmationDialog({
            isOpen: true,
            tickets: result.data,
            isBulk: true
          })
        }
        
        // Reset bulk quantity
        setBulkQuantity(1)
      } else {
        // Single ticket purchase
        if (selectedNumbers.length !== 6) {
          // Don't proceed if not exactly 6 numbers selected
          // The UI already shows this requirement
          return
        }
        
        const response = await fetch('/api/v1/lottery/purchase-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: walletState.address,
            numbers: selectedNumbers
          })
        })
        
        const result = await response.json()
        
        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to purchase ticket')
        }
        
        // Open confirmation dialog with single ticket
        if (result.data) {
          setConfirmationDialog({
            isOpen: true,
            tickets: [result.data],
            isBulk: false
          })
        }
        
        // Clear selected numbers
        setSelectedNumbers([])
      }
    } catch (error) {
      console.error('Purchase error:', error)
      setPurchaseError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleBulkQuantityChange = (value: string) => {
    const num = parseInt(value) || 1
    setBulkQuantity(Math.max(1, Math.min(10000, num))) // Limit between 1 and 10,000
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto p-6 space-y-8 flex-1 relative">
        {/* Background Effects */}
        <div className="fixed inset-0 bg-casino-texture pointer-events-none"></div>
        <div className="fixed inset-0 bg-circuit-pattern opacity-20 pointer-events-none"></div>
        <div className="fixed top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full filter blur-3xl opacity-30 pointer-events-none animate-pulse"></div>
        <div className="fixed bottom-1/4 left-0 w-80 h-80 bg-accent/10 rounded-full filter blur-3xl opacity-20 pointer-events-none" style={{ animationDelay: '5s' }}></div>
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <Dice6 className="h-10 w-10 text-primary" />
            Stone Lottery
          </h1>
          <p className="text-muted-foreground text-lg">
            Win big with blockchain-powered lottery draws
          </p>
        </div>

        {/* Current Jackpot */}
        <JackpotSection />

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
            <TabsList>
              <TabsTrigger value="play">
                <Dice6 className="h-4 w-4" />
                <span className="hidden sm:inline">Play</span>
              </TabsTrigger>
              <TabsTrigger value="tickets">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">My Tickets</span>
              </TabsTrigger>
              <TabsTrigger value="results">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Results</span>
              </TabsTrigger>
            </TabsList>

            {/* Purchase Mode Toggle - Always reserve space to prevent layout shift */}
            <div className="min-w-[200px] flex justify-center">
              {activeTab === "play" ? (
                <div className="bg-muted text-muted-foreground inline-flex h-10 w-fit items-center justify-center rounded-lg p-1">
                  <button
                    onClick={() => setBulkMode(false)}
                    className={`inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                      !bulkMode ? "bg-background text-foreground shadow-sm" : ""
                    }`}
                  >
                    <Target className="h-4 w-4" />
                    Single Ticket
                  </button>
                  <button
                    onClick={() => setBulkMode(true)}
                    className={`inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
                      bulkMode ? "bg-background text-foreground shadow-sm" : ""
                    }`}
                  >
                    <Package className="h-4 w-4" />
                    Bulk Purchase
                  </button>
                </div>
              ) : (
                /* Invisible placeholder to maintain layout */
                <div className="h-10 opacity-0 pointer-events-none">
                  <div className="bg-muted text-muted-foreground inline-flex h-10 w-fit items-center justify-center rounded-lg p-1">
                    <div className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap">
                      <Target className="h-4 w-4" />
                      Single Ticket
                    </div>
                    <div className="inline-flex items-center justify-center gap-2 rounded-md border border-transparent px-3 py-2 text-sm font-medium whitespace-nowrap">
                      <Package className="h-4 w-4" />
                      Bulk Purchase
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Play Tab */}
          <TabsContent value="play" className="space-y-6">
            <div className="max-w-2xl mx-auto">
              <PurchaseControls
                selectedNumbers={selectedNumbers}
                onNumberToggle={handleNumberToggle}
                onQuickPick={handleQuickPick}
                onClearSelection={handleClearSelection}
                bulkMode={bulkMode}
                bulkQuantity={bulkQuantity}
                onBulkQuantityChange={handleBulkQuantityChange}
                setBulkQuantity={setBulkQuantity}
                onPurchase={handlePurchaseTicket}
                isPurchasing={isPurchasing}
                purchaseError={purchaseError}
                walletConnected={walletState.connected}
                onConnectWallet={connectWallet}
              />
            </div>
          </TabsContent>

          {/* My Tickets Tab */}
          <TabsContent value="tickets" className="space-y-6">
            <MyTicketsSection />
          </TabsContent>

          {/* Results Tab */}
          <TabsContent value="results" className="space-y-6">
            <ResultsSection />
          </TabsContent>

        </Tabs>
      </div>

      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        tickets={confirmationDialog.tickets}
        isBulk={confirmationDialog.isBulk}
        onOpenChange={(isOpen) => setConfirmationDialog(prev => ({ ...prev, isOpen }))}
        onConfirmationUpdate={(ticketIds, status) => {
          // Handle confirmation update - dialog will show success state on confirmed
        }}
        onViewTickets={() => {
          // Switch to My Tickets tab
          setActiveTab('tickets')
        }}
      />

      <Footer />
    </div>
  )
}