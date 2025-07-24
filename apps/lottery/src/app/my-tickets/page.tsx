"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/contexts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Wallet } from "lucide-react"
import { Footer } from "@/components/footer"
import { TicketsTable } from "@/components/lottery/tickets-table"
import { SimpleTicketsTable } from "@/components/lottery/simple-tickets-table"
import { getLotteryFormat } from "@/types/lottery"

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

export default function MyTicketsPage() {
  const { walletState, connectWallet, isConnecting } = useWallet()
  const [error, setError] = useState<string | null>(null)
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<'active' | 'archived' | 'all'>('active')
  const [confirmingTickets, setConfirmingTickets] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState(false)

  // Get lottery format
  const lotteryFormat = getLotteryFormat()

  useEffect(() => {
    setMounted(true)
  }, [])

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

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  if (!walletState.connected) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="container mx-auto p-6 space-y-8 flex-1">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
              <Wallet className="h-10 w-10 text-primary" />
              My Tickets
            </h1>
            <p className="text-muted-foreground text-lg">
              View and manage your lottery tickets
            </p>
          </div>

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
        </div>
        <Footer />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="container mx-auto p-6 space-y-8 flex-1">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
              <Wallet className="h-10 w-10 text-primary" />
              My Tickets
            </h1>
            <p className="text-muted-foreground text-lg">
              View and manage your lottery tickets
            </p>
          </div>

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
        </div>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen">
        <div className="container mx-auto p-6 space-y-8 flex-1">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
              <Wallet className="h-10 w-10 text-primary" />
              My Tickets
            </h1>
            <p className="text-muted-foreground text-lg">
              View and manage your lottery tickets
            </p>
          </div>

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
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto p-6 space-y-8 flex-1">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
            <Wallet className="h-10 w-10 text-primary" />
            My Tickets
          </h1>
          <p className="text-muted-foreground text-lg">
            View and manage your lottery tickets
          </p>
        </div>

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
                    
                    onClick={() => setFilter('active')}
                  >
                    Active ({tickets.filter(t => t.status === 'pending' || t.status === 'confirmed').length})
                  </Button>
                  <Button
                    variant={filter === 'archived' ? 'default' : 'outline'}
                    
                    onClick={() => setFilter('archived')}
                  >
                    Archived ({tickets.filter(t => t.status === 'archived').length})
                  </Button>
                  <Button
                    variant={filter === 'all' ? 'default' : 'outline'}
                    
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
                      <a href="/lottery" className="text-primary hover:underline">
                        Purchase tickets in the lottery
                      </a> to participate in upcoming draws
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {lotteryFormat === 'traditional' ? (
                    <TicketsTable
                      tickets={filteredTickets}
                      onConfirmationUpdate={handleConfirmationUpdate}
                      onBulkConfirmationUpdate={handleBulkConfirmationUpdate}
                    />
                  ) : (
                    <SimpleTicketsTable
                      tickets={filteredTickets}
                      onConfirmationUpdate={handleConfirmationUpdate}
                      onBulkConfirmationUpdate={handleBulkConfirmationUpdate}
                    />
                  )}
                  
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
      </div>
      <Footer />
    </div>
  )
}