"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/contexts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dice6,
  Ticket,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Trophy
} from "lucide-react"
import Link from "next/link"
import { Footer } from "@/components/footer"
import { JackpotSection } from "@/components/lottery/jackpot-section"
import { ConfirmationDialog } from "@/components/lottery/confirmation-dialog"
import { getLotteryFormat } from "@/types/lottery"

// Constants
const TICKET_PRICE = 100 // 100 STONE

// Simplified tickets component for inline display
function MyTicketsPreview() {
  const { walletState } = useWallet()
  const [tickets, setTickets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (walletState.connected && walletState.address) {
      fetchTickets()
    }
  }, [walletState.connected, walletState.address])

  const fetchTickets = async () => {
    if (!walletState.address) return
    
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/lottery/my-tickets?walletAddress=${encodeURIComponent(walletState.address)}`)
      const result = await response.json()
      
      if (response.ok && result.success) {
        // Show only the 3 most recent active tickets
        const activeTickets = result.data.filter((t: any) => t.status === 'pending' || t.status === 'confirmed')
        setTickets(activeTickets.slice(0, 3))
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!walletState.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            My Tickets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            Connect your wallet to view tickets
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            My Tickets ({tickets.length})
          </CardTitle>
          <Link href="/my-tickets">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-6">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            <div className="text-sm text-muted-foreground">Loading tickets...</div>
          </div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            No tickets yet. Buy some tickets to get started!
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <div key={ticket.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-xs font-mono">#{ticket.id.slice(-6)}</div>
                  <Badge variant={ticket.status === 'confirmed' ? 'default' : 'secondary'}>
                    {ticket.status}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground">
                  {TICKET_PRICE} STONE
                </div>
              </div>
            ))}
            {tickets.length === 3 && (
              <div className="text-center pt-2">
                <Link href="/my-tickets">
                  <Button variant="ghost" size="sm">
                    View all tickets →
                  </Button>
                </Link>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Simplified purchase component
function SimplifiedPurchase() {
  const { walletState, connectWallet } = useWallet()
  const [quantity, setQuantity] = useState(1)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean
    tickets: any[]
    isBulk: boolean
  }>({ isOpen: false, tickets: [], isBulk: false })

  const handlePurchase = async () => {
    if (!walletState.connected || !walletState.address) {
      connectWallet()
      return
    }
    
    setIsPurchasing(true)
    setPurchaseError(null)
    
    try {
      const response = await fetch('/api/v1/lottery/purchase-bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: walletState.address,
          quantity: quantity
        })
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to purchase tickets')
      }
      
      // Open confirmation dialog with tickets
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        setConfirmationDialog({
          isOpen: true,
          tickets: result.data,
          isBulk: true
        })
      }
      
      // Reset quantity
      setQuantity(1)
    } catch (error) {
      console.error('Purchase error:', error)
      setPurchaseError(error instanceof Error ? error.message : 'Unknown error occurred')
    } finally {
      setIsPurchasing(false)
    }
  }

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value) || 1
    setQuantity(Math.max(1, Math.min(1000, num)))
  }

  return (
    <>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Ticket className="h-5 w-5" />
            Buy Tickets
          </CardTitle>
          <CardDescription>
            Each ticket costs {TICKET_PRICE} STONE. More tickets = better odds!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Quantity Input */}
          <div className="text-center space-y-4">
            <div className="text-sm font-medium text-muted-foreground">
              How many tickets?
            </div>
            <div className="flex justify-center items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                -
              </Button>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-24 px-3 py-2 text-center border border-border rounded-md bg-background text-lg"
                  min="1"
                  max="1000"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setQuantity(Math.min(1000, quantity + 1))}
                disabled={quantity >= 1000}
              >
                +
              </Button>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="text-center space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              {[1, 10, 50, 100].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(amount)}
                  className="flex items-center gap-1"
                >
                  {amount} ticket{amount !== 1 ? 's' : ''}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Cost Summary */}
          <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
            <div className="text-sm text-muted-foreground">Total cost</div>
            <div className="text-2xl font-bold text-primary">
              {(quantity * TICKET_PRICE).toLocaleString()} STONE
            </div>
          </div>

          {/* Purchase Error Display */}
          {purchaseError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {purchaseError}
            </div>
          )}

          {/* Purchase Button */}
          <div className="flex justify-center">
            <Button
              onClick={handlePurchase}
              disabled={isPurchasing}
              size="lg"
              className="flex items-center gap-2 px-8"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Purchasing...
                </>
              ) : (
                <>
                  <Ticket className="h-4 w-4" />
                  {walletState.connected 
                    ? `Buy ${quantity.toLocaleString()} ticket${quantity !== 1 ? 's' : ''}` 
                    : 'Connect Wallet'
                  }
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        tickets={confirmationDialog.tickets}
        isBulk={confirmationDialog.isBulk}
        onOpenChange={(isOpen) => setConfirmationDialog(prev => ({ ...prev, isOpen }))}
        onConfirmationUpdate={(ticketIds, status) => {
          // Handle confirmation update - dialog will show success state on confirmed
        }}
        onViewTickets={() => {
          // Navigate to My Tickets page
          window.location.href = '/my-tickets'
        }}
      />
    </>
  )
}

export default function LotteryPage() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="container mx-auto p-6 space-y-12 flex-1">
        {/* Hero Section - Jackpot */}
        <div className="text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
              <Trophy className="h-10 w-10 text-primary" />
              Stone Lottery
            </h1>
            <p className="text-muted-foreground text-lg">
              Win amazing prizes with blockchain-powered lottery draws
            </p>
          </div>
          
          <JackpotSection />
        </div>

        {/* Two Column Layout for Purchase and My Tickets */}
        <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
          {/* Purchase Section */}
          <div>
            <SimplifiedPurchase />
          </div>

          {/* My Tickets Preview */}
          <div>
            <MyTicketsPreview />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}