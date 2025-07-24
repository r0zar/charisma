import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { CheckCircle2, ExternalLink, Wallet } from 'lucide-react'
import { TicketConfirmation } from '@/components/ticket-confirmation'
import { BulkTicketConfirmation } from '@/components/bulk-ticket-confirmation'

interface ConfirmationDialogProps {
  isOpen: boolean
  tickets: any[]
  isBulk: boolean
  onOpenChange: (isOpen: boolean) => void
  onConfirmationUpdate: (ticketIds: string | string[], status: 'confirming' | 'confirmed' | 'failed') => void
  onViewTickets?: () => void
}

export function ConfirmationDialog({ 
  isOpen, 
  tickets, 
  isBulk, 
  onOpenChange, 
  onConfirmationUpdate,
  onViewTickets
}: ConfirmationDialogProps) {
  const [showSuccess, setShowSuccess] = useState(false)
  const [confirmedTickets, setConfirmedTickets] = useState<any[]>([])
  const [transactionId, setTransactionId] = useState<string | null>(null)

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setShowSuccess(false)
      setConfirmedTickets([])
      setTransactionId(null)
    }
  }, [isOpen])

  const handleConfirmationUpdate = (ticketIds: string | string[], status: 'confirming' | 'confirmed' | 'failed') => {
    onConfirmationUpdate(ticketIds, status)
    
    if (status === 'confirmed') {
      // Show success state instead of closing immediately
      setShowSuccess(true)
      setConfirmedTickets(tickets)
      // Get transaction ID from the ticket if available
      if (tickets.length > 0 && tickets[0].transactionId) {
        setTransactionId(tickets[0].transactionId)
      }
    }
  }

  const handleViewTickets = () => {
    onOpenChange(false)
    if (onViewTickets) {
      onViewTickets()
    }
  }

  const handleClose = () => {
    onOpenChange(false)
  }

  if (showSuccess) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-green-600">
              <CheckCircle2 className="h-6 w-6" />
              {isBulk 
                ? `${confirmedTickets.length} Tickets Confirmed!` 
                : 'Ticket Confirmed!'
              }
            </DialogTitle>
            <DialogDescription>
              Your lottery {isBulk ? 'tickets have' : 'ticket has'} been successfully confirmed on the blockchain. You're now entered into the next draw!
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Success Animation/Visual */}
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
              <div className="text-lg font-semibold text-green-800">
                Transaction Confirmed
              </div>
              {transactionId && (
                <div className="text-sm text-muted-foreground mt-2">
                  Transaction ID: {transactionId.slice(0, 8)}...{transactionId.slice(-8)}
                </div>
              )}
            </div>

            {/* Ticket Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="text-sm font-medium text-green-800 mb-2">
                {isBulk ? 'Confirmed Tickets:' : 'Confirmed Ticket:'}
              </div>
              {isBulk ? (
                <div className="text-sm text-green-700">
                  <div className="flex justify-between">
                    <span>Number of tickets:</span>
                    <span className="font-medium">{confirmedTickets.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total cost:</span>
                    <span className="font-medium">
                      {confirmedTickets.reduce((sum, t) => sum + t.purchasePrice, 0)} STONE
                    </span>
                  </div>
                </div>
              ) : (
                confirmedTickets.length > 0 && (
                  <div className="text-sm text-green-700">
                    <div className="flex justify-between mb-1">
                      <span>Numbers:</span>
                      <span className="font-medium">{confirmedTickets[0].numbers?.join(', ')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cost:</span>
                      <span className="font-medium">{confirmedTickets[0].purchasePrice} STONE</span>
                    </div>
                  </div>
                )
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={handleViewTickets}
                className="flex items-center gap-2"
              >
                <Wallet className="h-4 w-4" />
                View My Tickets
              </Button>
              <Button onClick={handleClose}>
                Continue Playing
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isBulk 
              ? `Confirm ${tickets.length} Tickets` 
              : 'Confirm Your Ticket'
            }
          </DialogTitle>
          <DialogDescription>
            Complete your purchase by transferring STONE tokens to confirm your lottery {isBulk ? 'tickets' : 'ticket'}.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {isBulk ? (
            <BulkTicketConfirmation
              tickets={tickets}
              onConfirmationUpdate={handleConfirmationUpdate}
            />
          ) : (
            tickets.length > 0 && (
              <TicketConfirmation
                ticket={tickets[0]}
                onConfirmationUpdate={handleConfirmationUpdate}
              />
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}