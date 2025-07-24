'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Ticket, Wallet, Hash, Loader2 } from 'lucide-react'

const TICKET_PRICE = 100 // STONE per ticket

interface SimplePurchaseControlsProps {
  // Quantity props
  quantity: number
  onQuantityChange: (value: string) => void
  setQuantity: (quantity: number) => void
  
  // Purchase props
  onPurchase: () => void
  isPurchasing: boolean
  purchaseError: string | null
  
  // Wallet props
  walletConnected: boolean
  onConnectWallet: () => void
}

export function SimplePurchaseControls({
  quantity,
  onQuantityChange,
  setQuantity,
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

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          <Ticket className="h-5 w-5" />
          Buy Lottery Tickets
        </CardTitle>
        <CardDescription>
          Each ticket costs {TICKET_PRICE} STONE. One random ticket wins the entire jackpot.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Simple explanation */}
        <div className="text-center bg-muted/50 rounded-lg p-6">
          <Ticket className="h-12 w-12 mx-auto text-primary mb-4" />
          <div className="text-lg font-semibold mb-2">How It Works</div>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>• Buy any number of tickets by burning STONE</p>
            <p>• No numbers to pick - each ticket has equal odds</p>
            <p>• One random ticket wins the entire jackpot</p>
            <p>• More tickets = better chance to win</p>
          </div>
        </div>

        <Separator />

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
                onChange={(e) => onQuantityChange(e.target.value)}
                className="w-24 px-3 py-2 text-center border border-border rounded-md bg-background text-lg"
                min="1"
                max="10000"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setQuantity(Math.min(10000, quantity + 1))}
              disabled={quantity >= 10000}
            >
              +
            </Button>
          </div>
        </div>

        {/* Quick Amount Buttons */}
        <div className="text-center space-y-4">
          <div className="text-sm font-medium text-muted-foreground">
            Quick amounts
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {[1, 10, 50, 100, 500].map((amount) => (
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

        {/* Odds Display */}
        <div className="bg-blue-50 rounded-lg p-4 text-center space-y-2">
          <div className="text-sm text-blue-600">Your winning chances</div>
          <div className="text-lg font-bold text-blue-700">
            {quantity} out of every {quantity === 1 ? 'X' : `${quantity}+`} tickets entered
          </div>
          <div className="text-xs text-blue-600">
            The more tickets you buy, the better your odds
          </div>
        </div>

        {/* Cost Summary */}
        <div className="bg-muted/50 rounded-lg p-4 text-center space-y-2">
          <div className="text-sm text-muted-foreground">Total cost</div>
          <div className="text-2xl font-bold text-primary">
            {(quantity * TICKET_PRICE).toLocaleString()} STONE
          </div>
          <div className="text-xs text-muted-foreground">
            {quantity.toLocaleString()} ticket{quantity !== 1 ? 's' : ''} × {TICKET_PRICE} STONE each
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
                {walletConnected 
                  ? `Buy ${quantity.toLocaleString()} ticket${quantity !== 1 ? 's' : ''}` 
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