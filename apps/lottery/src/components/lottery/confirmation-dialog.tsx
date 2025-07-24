import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { TicketConfirmation } from '@/components/ticket-confirmation'
import { BulkTicketConfirmation } from '@/components/bulk-ticket-confirmation'

interface ConfirmationDialogProps {
  isOpen: boolean
  tickets: any[]
  isBulk: boolean
  onOpenChange: (isOpen: boolean) => void
  onConfirmationUpdate: (ticketIds: string | string[], status: 'confirming' | 'confirmed' | 'failed') => void
}

export function ConfirmationDialog({ 
  isOpen, 
  tickets, 
  isBulk, 
  onOpenChange, 
  onConfirmationUpdate 
}: ConfirmationDialogProps) {
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
              onConfirmationUpdate={(ticketIds, status) => {
                onConfirmationUpdate(ticketIds, status)
                if (status === 'confirmed') {
                  onOpenChange(false)
                }
              }}
            />
          ) : (
            tickets.length > 0 && (
              <TicketConfirmation
                ticket={tickets[0]}
                onConfirmationUpdate={(ticketId, status) => {
                  onConfirmationUpdate(ticketId, status)
                  if (status === 'confirmed') {
                    onOpenChange(false)
                  }
                }}
              />
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}