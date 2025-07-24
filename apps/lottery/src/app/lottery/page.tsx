"use client"

import { useState, useEffect } from "react"
import { useWallet } from "@/contexts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Dice6,
  Target,
  Package,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { Footer } from "@/components/footer"
import { JackpotSection } from "@/components/lottery/jackpot-section"
import { PurchaseControls } from "@/components/lottery/purchase-controls"
import { SimplePurchaseControls } from "@/components/lottery/simple-purchase-controls"
import { ConfirmationDialog } from "@/components/lottery/confirmation-dialog"
import { getLotteryFormat } from "@/types/lottery"



// Constants
const mockTicketPrice = 100 // 100 STONE



export default function LotteryPage() {
  const { walletState, connectWallet, isConnecting } = useWallet()
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([])
  const [mounted, setMounted] = useState(false)
  const [bulkQuantity, setBulkQuantity] = useState(1)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [isPurchasing, setIsPurchasing] = useState(false)
  const [bulkMode, setBulkMode] = useState(false)
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean
    tickets: any[]
    isBulk: boolean
  }>({ isOpen: false, tickets: [], isBulk: false })

  // Get lottery format
  const lotteryFormat = getLotteryFormat()

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
      if (lotteryFormat === 'simple' || bulkMode) {
        // Simple format always uses bulk API, traditional format uses bulk when bulkMode is true
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
        setBulkQuantity(1)
      } else {
        // Traditional format single ticket purchase
        if (selectedNumbers.length !== 6) {
          // Don't proceed if not exactly 6 numbers selected for traditional format
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

        {/* Format-specific content */}
        {lotteryFormat === 'traditional' ? (
          <>
            {/* Purchase Mode Toggle for Traditional Format */}
            <div className="flex justify-center mb-6">
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
            </div>

            {/* Traditional Lottery Play Section */}
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
          </>
        ) : (
          <>
            {/* Simple Lottery Play Section - No toggle needed */}
            <div className="max-w-2xl mx-auto">
              <SimplePurchaseControls
                quantity={bulkQuantity}
                onQuantityChange={handleBulkQuantityChange}
                setQuantity={setBulkQuantity}
                onPurchase={handlePurchaseTicket}
                isPurchasing={isPurchasing}
                purchaseError={purchaseError}
                walletConnected={walletState.connected}
                onConnectWallet={connectWallet}
              />
            </div>
          </>
        )}
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
          // Navigate to My Tickets page
          window.location.href = '/my-tickets'
        }}
      />

      <Footer />
    </div>
  )
}