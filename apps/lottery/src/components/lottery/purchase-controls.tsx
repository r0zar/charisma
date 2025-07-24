'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Zap, Wallet, Package, Hash, Loader2 } from 'lucide-react'
import { NumberGrid } from './number-grid'

const TICKET_PRICE = 100 // STONE per ticket

interface PurchaseControlsProps {
  // Single ticket mode props
  selectedNumbers: number[]
  onNumberToggle: (number: number) => void
  onQuickPick: () => void
  onClearSelection: () => void
  
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

export function PurchaseControls({
  selectedNumbers,
  onNumberToggle,
  onQuickPick,
  onClearSelection,
  bulkMode,
  bulkQuantity,
  onBulkQuantityChange,
  setBulkQuantity,
  onPurchase,
  isPurchasing,
  purchaseError,
  walletConnected,
  onConnectWallet
}: PurchaseControlsProps) {
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
            <Wallet className="h-5 w-5" />
            Choose Your Numbers
          </CardTitle>
          <CardDescription>
            Choose 6 numbers from 1 to 49. Each ticket costs {TICKET_PRICE} STONE tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Selected Numbers Display */}
          <div className="text-center">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              Selected Numbers ({selectedNumbers.length}/6)
            </div>
            <div className="flex flex-wrap justify-center gap-2 min-h-[3rem] items-center">
              {selectedNumbers.length === 0 ? (
                <div className="text-muted-foreground text-sm">No numbers selected yet</div>
              ) : (
                selectedNumbers.sort((a, b) => a - b).map((number) => (
                  <div
                    key={number}
                    className="w-10 h-10 rounded-full bg-primary text-primary-foreground border-2 border-primary flex items-center justify-center font-bold text-sm"
                  >
                    {number}
                  </div>
                ))
              )}
            </div>
          </div>

          <Separator />

          {/* Number Grid */}
          <NumberGrid
            selectedNumbers={selectedNumbers}
            onNumberToggle={onNumberToggle}
          />

          <Separator />

          {/* Action Buttons */}
          <div className="text-center space-y-4">
            <div className="text-sm font-medium text-muted-foreground">
              Quick Actions
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="outline"
                onClick={onQuickPick}
                className="flex items-center gap-2"
              >
                <Zap className="h-4 w-4" />
                Quick Pick
              </Button>
              <Button
                variant="outline"
                onClick={onClearSelection}
                disabled={selectedNumbers.length === 0}
              >
                Clear Selection
              </Button>
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
              disabled={selectedNumbers.length !== 6 || isPurchasing}
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
          <Package className="h-5 w-5" />
          Bulk Purchase
        </CardTitle>
        <CardDescription>
          Purchase multiple tickets with random numbers. Each ticket costs {TICKET_PRICE} STONE tokens.
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
                <Package className="h-4 w-4" />
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