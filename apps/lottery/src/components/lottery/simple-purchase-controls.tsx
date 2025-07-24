'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Ticket, Wallet, Hash, Loader2 } from 'lucide-react'

const TICKET_PRICE = 5 // STONE per ticket

interface SimplePurchaseControlsProps {
  // Bulk mode props
  bulkMode: boolean
  bulkQuantity: number
  onBulkQuantityChange: (value: string) => void
  setBulkQuantity: (quantity: number) => void
  
  // Purchase props
  onPurchase: () => void
  isPurchasing: boolean
  purchaseError: string | null
  
  // Wallet props
  walletConnected: boolean
  onConnectWallet: () => void
}

export function SimplePurchaseControls({
  bulkMode,
  bulkQuantity,
  onBulkQuantityChange,
  setBulkQuantity,
  onPurchase,
  isPurchasing,
  purchaseError,
  walletConnected,
  onConnectWallet
}: SimplePurchaseControlsProps) {
  const handlePurchaseClick = () => {
    if (!walletConnected) {
      onConnectWallet()
      return
    }
    onPurchase()
  }

  if (!bulkMode) {
    // Single Ticket Mode
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <Ticket className="h-5 w-5" />
            Buy a Lottery Ticket
          </CardTitle>
          <CardDescription>
            Purchase a ticket for {TICKET_PRICE} STONE tokens. One random ticket will be selected as the winner in each draw.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Simple explanation */}
          <div className="text-center bg-muted/50 rounded-lg p-6">
            <Ticket className="h-12 w-12 mx-auto text-primary mb-4" />
            <div className="text-lg font-semibold mb-2">Simple Lottery Format</div>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>• Buy tickets by burning STONE tokens</p>
              <p>• No numbers to pick - all tickets have equal chance</p>
              <p>• One random ticket wins the entire jackpot</p>
              <p>• More tickets = better odds of winning</p>
            </div>
          </div>

          <Separator />

          {/* Purchase Error Display */}
          {purchaseError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {purchaseError}
            </div>
          )}

          {/* Purchase Button */}
          <div className="flex justify-center">
            <Button
              onClick={handlePurchaseClick}
              disabled={isPurchasing}
              size="lg"
              className="flex items-center gap-2"
            >
              {isPurchasing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Purchasing...
                </>
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  {walletConnected ? `Buy Ticket (${TICKET_PRICE} STONE)` : 'Connect Wallet'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Bulk Purchase Mode
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Hash className="h-5 w-5" />
          Bulk Purchase
        </CardTitle>
        <CardDescription>
          Purchase multiple tickets at once. Each ticket costs {TICKET_PRICE} STONE tokens and has an equal chance to win.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quantity Input */}
        <div className="text-center space-y-4">
          <div className="text-sm font-medium text-muted-foreground">
            Number of Tickets
          </div>
          <div className="flex justify-center items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkQuantity(Math.max(1, bulkQuantity - 1))}
              disabled={bulkQuantity <= 1}
            >
              -
            </Button>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={bulkQuantity}
                onChange={(e) => onBulkQuantityChange(e.target.value)}
                className="w-20 px-3 py-2 text-center border border-border rounded-md bg-background"
                min="1"
                max="10000"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkQuantity(Math.min(10000, bulkQuantity + 1))}
              disabled={bulkQuantity >= 10000}
            >
              +
            </Button>
          </div>
        </div>

        <Separator />

        {/* Quick Amount Buttons */}
        <div className="text-center space-y-4">
          <div className="text-sm font-medium text-muted-foreground">
            Quick Select
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {[10, 50, 100, 500, 1000].map((amount) => (
              <Button
                key={amount}
                variant="outline"
                size="sm"
                onClick={() => setBulkQuantity(amount)}
                className="flex items-center gap-1"
              >
                <Hash className="h-3 w-3" />
                {amount}
              </Button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Odds Display */}
        <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
          <div className="text-sm text-muted-foreground">Your Winning Odds</div>
          <div className="text-lg font-bold text-primary">
            {bulkQuantity} ticket{bulkQuantity !== 1 ? 's' : ''} = {bulkQuantity} chance{bulkQuantity !== 1 ? 's' : ''} to win
          </div>
          <div className="text-xs text-muted-foreground">
            Each ticket has an equal probability of being selected as the winner
          </div>
        </div>

        {/* Cost Summary */}
        <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
          <div className="text-sm text-muted-foreground">Total Cost</div>
          <div className="text-2xl font-bold text-primary">
            {(bulkQuantity * TICKET_PRICE).toLocaleString()} STONE
          </div>
          <div className="text-xs text-muted-foreground">
            {bulkQuantity.toLocaleString()} tickets × {TICKET_PRICE} STONE each
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
            onClick={handlePurchaseClick}
            disabled={!walletConnected || isPurchasing}
            size="lg"
            className="flex items-center gap-2"
          >
            {isPurchasing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Purchasing...
              </>
            ) : (
              <>
                <Hash className="h-4 w-4" />
                {walletConnected 
                  ? `Buy ${bulkQuantity.toLocaleString()} Tickets` 
                  : 'Connect Wallet'
                }
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}