"use client"

import { useState, useEffect } from "react"
import { useWallet, useLottery } from "@/contexts"
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
import { TransactionLink } from "@/components/ui/transaction-link"
import { LotteryConfig } from "@/types/lottery"

// Simplified tickets component for inline display
function MyTicketsPreview({ refreshTrigger }: { refreshTrigger: number }) {
  const { walletState } = useWallet()
  const { config } = useLottery()
  const [tickets, setTickets] = useState<any[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchTickets = async () => {
    if (!walletState.address) return

    setLoading(true)
    try {
      // Use the faster preview endpoint that only checks KV storage
      // Add timestamp for cache busting to ensure real-time updates
      const timestamp = Date.now()
      const response = await fetch(`/api/v1/lottery/my-tickets-preview?walletAddress=${encodeURIComponent(walletState.address)}&limit=3&_t=${timestamp}`, {
        cache: 'no-cache' // Bypass Next.js cache
      })
      const result = await response.json()

      if (response.ok && result.success) {
        setTickets(result.data)
        setTotalCount(result.count || 0)
      }
    } catch (error) {
      console.error('Failed to fetch tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (walletState.connected && walletState.address) {
      fetchTickets()
    }
  }, [walletState.connected, walletState.address, refreshTrigger]) // Add refreshTrigger to dependencies

  console.log(config)

  if (!walletState.connected) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          My Tickets
        </h3>
        <div className="text-center py-6 text-muted-foreground">
          Connect your wallet to view tickets
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Ticket className="h-5 w-5" />
          My Tickets ({totalCount})
        </h3>
        <Link href="/my-tickets">
          <Button variant="outline" size="sm">
            View All
          </Button>
        </Link>
      </div>
      <div>
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
              <div key={ticket.id} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-xs font-mono">#{ticket.id.slice(-6)}</div>
                    <Badge variant={ticket.status === 'confirmed' ? 'default' : 'secondary'}>
                      {ticket.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {ticket.transactionId && (
                      <TransactionLink
                        txId={ticket.transactionId}
                        variant="inline"
                        size="sm"
                        className="text-xs"
                        showIcon={false}
                      >
                        TX
                      </TransactionLink>
                    )}
                    <div className="text-sm text-muted-foreground">
                      {config?.ticketPrice || 100} STONE
                    </div>
                  </div>
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
      </div>
    </div>
  )
}

// Simplified purchase component
function SimplifiedPurchase({ onTicketPurchased }: { onTicketPurchased?: () => void }) {
  const { walletState, connectWallet } = useWallet()
  const { config } = useLottery()
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
      let response
      let result

      if (quantity === 1) {
        // Single ticket purchase
        response = await fetch('/api/v1/lottery/purchase-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: walletState.address
          })
        })

        result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to purchase ticket')
        }

        // Convert single ticket to array for consistent handling
        if (result.data) {
          setConfirmationDialog({
            isOpen: true,
            tickets: [result.data],
            isBulk: false
          })
          // Refresh ticket preview immediately after purchase
          onTicketPurchased?.()
        }
      } else {
        // Bulk ticket purchase
        response = await fetch('/api/v1/lottery/purchase-bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: walletState.address,
            quantity: quantity
          })
        })

        result = await response.json()

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Failed to purchase tickets')
        }

        // Bulk tickets already come as array
        if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          setConfirmationDialog({
            isOpen: true,
            tickets: result.data,
            isBulk: true
          })
          // Refresh ticket preview immediately after purchase
          onTicketPurchased?.()
        }
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
      <div className="bg-card border border-border rounded-xl p-6 shadow-lg space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2 flex items-center justify-center gap-2">
            <Ticket className="h-5 w-5" />
            Burn STONE for Tickets
          </h3>
          <p className="text-sm text-muted-foreground">
            Burn {config?.ticketPrice || 100} STONE per ticket to enter the lottery. More tickets = better odds!
          </p>
        </div>
        <div className="space-y-6">
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
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-2">
              {[1, 10, 50, 100].map((amount) => (
                <Button
                  key={amount}
                  variant="outline"
                  size="sm"
                  onClick={() => setQuantity(amount)}
                  className="flex items-center gap-1 text-xs sm:text-sm"
                >
                  {amount} ticket{amount !== 1 ? 's' : ''}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Cost Summary */}
          <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
            <div className="text-sm text-muted-foreground">STONE to burn</div>
            <div className="text-2xl font-bold text-primary">
              {(quantity * (config?.ticketPrice || 100)).toLocaleString()} STONE
            </div>
            <div className="text-xs text-muted-foreground">Tokens will be permanently burned</div>
          </div>

          {/* Purchase Error Display */}
          {purchaseError && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-md text-sm text-red-500">
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
                  Burning STONE...
                </>
              ) : (
                <>
                  <Ticket className="h-4 w-4" />
                  {walletState.connected
                    ? `Burn for ${quantity.toLocaleString()} ticket${quantity !== 1 ? 's' : ''}`
                    : 'Connect Wallet'
                  }
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={confirmationDialog.isOpen}
        tickets={confirmationDialog.tickets}
        isBulk={confirmationDialog.isBulk}
        onOpenChange={(isOpen) => setConfirmationDialog(prev => ({ ...prev, isOpen }))}
        onConfirmationUpdate={(ticketIds, status) => {
          // Handle confirmation update - dialog will show success state on confirmed
          if (status === 'confirmed') {
            // Refresh ticket preview when tickets are confirmed
            onTicketPurchased?.()
          }
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
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleTicketPurchased = () => {
    // Trigger refresh by incrementing the counter
    setRefreshTrigger(prev => prev + 1)
  }

  if (!mounted) {
    return <div className="p-8">Loading...</div>
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 max-w-[1600px] mx-auto">
        {/* Left Panel: Full-height Jackpot */}
        <div className="min-h-[60vh] lg:min-h-screen flex items-center p-6 lg:p-8">
          <div className="w-full">
            <JackpotSection />
          </div>
        </div>

        {/* Right Panel: Floating Cards */}
        <div className="p-6 lg:p-8 space-y-6 flex flex-col justify-center">
          <div className="max-w-lg mx-auto w-full space-y-6">
            <SimplifiedPurchase onTicketPurchased={handleTicketPurchased} />
            <MyTicketsPreview refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}