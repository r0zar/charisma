'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, ExternalLink, CheckCircle2, Trophy, X } from 'lucide-react'
import { LotteryTicket } from '@/types/lottery'
import { TransactionLink } from '@/components/ui/transaction-link'
import { request } from '@stacks/connect'
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network'
import {
  uintCV,
  standardPrincipalCV,
  Pc,
  noneCV
} from '@stacks/transactions'

interface SimpleTicketsTableProps {
  tickets: LotteryTicket[]
  onConfirmationUpdate: (ticketId: string, status: 'confirming' | 'confirmed' | 'failed') => void
  onTicketCancelled?: (ticketId: string) => void
}

const STONE_CONTRACT_ADDRESS = 'SPQ5CEHETP8K4Q2FSNNK9ANMPAVBSA9NN86YSN59'
const STONE_CONTRACT_NAME = 'stone-bonding-curve'
const BURN_ADDRESS = 'SP000000000000000000002Q6VF78'
const NETWORK = process.env.NODE_ENV === 'production' ? STACKS_MAINNET : STACKS_TESTNET

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800'
    case 'confirmed': return 'bg-green-100 text-green-800'
    case 'cancelled': return 'bg-red-100 text-red-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

interface IndividualTicketRowProps {
  ticket: LotteryTicket
  onConfirmationUpdate: (ticketId: string, status: 'confirming' | 'confirmed' | 'failed') => void
  onTicketCancelled?: (ticketId: string) => void
}

function IndividualTicketRow({ ticket, onConfirmationUpdate, onTicketCancelled }: IndividualTicketRowProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [txId, setTxId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const pollForConfirmation = async (transactionId: string) => {
    const maxAttempts = 24 // 2 minutes total (24 * 5 seconds)
    let attempts = 0

    const poll = async () => {
      try {
        attempts++
        console.log(`Polling attempt ${attempts}/${maxAttempts} for transaction ${transactionId}`)

        const response = await fetch('/api/v1/lottery/confirm-ticket', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ticketId: ticket.id,
            transactionId: transactionId,
            walletAddress: ticket.walletAddress,
            expectedAmount: ticket.purchasePrice
          }),
        })

        const apiResult = await response.json()

        if (apiResult.success) {
          console.log('Transaction confirmed successfully!')
          setIsConfirming(false)
          setError(null)
          onConfirmationUpdate(ticket.id, 'confirmed')
          return
        }

        if (attempts < maxAttempts) {
          if (apiResult.retryable !== false) {
            setTimeout(poll, 5000)
          } else {
            throw new Error(apiResult.error || 'Transaction validation failed')
          }
        } else {
          throw new Error('Transaction confirmation timed out. Please check your wallet and try again.')
        }
      } catch (error) {
        console.error('Confirmation polling error:', error)
        setError(error instanceof Error ? error.message : 'Failed to confirm ticket')
        setIsConfirming(false)
        onConfirmationUpdate(ticket.id, 'failed')
      }
    }

    poll()
  }

  const handleCheckStatus = async () => {
    if (!txId) {
      setError('No transaction ID available to check')
      return
    }

    setIsCheckingStatus(true)
    setError(null)

    try {
      console.log(`Manually checking status for transaction ${txId}`)

      const response = await fetch('/api/v1/lottery/confirm-ticket', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          transactionId: txId,
          walletAddress: ticket.walletAddress,
          expectedAmount: ticket.purchasePrice
        }),
      })

      const apiResult = await response.json()

      if (apiResult.success) {
        console.log('Manual status check: Transaction confirmed!')
        setError(null)
        onConfirmationUpdate(ticket.id, 'confirmed')
      } else {
        console.log('Manual status check failed:', apiResult.error)
        setError(`Status check: ${apiResult.error}`)
      }
    } catch (error) {
      console.error('Manual status check error:', error)
      setError(`Status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleCancelTicket = async () => {
    if (!onTicketCancelled) return

    setIsCancelling(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/lottery/cancel-tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: ticket.walletAddress,
          ticketIds: [ticket.id]
        })
      })

      const result = await response.json()

      if (result.success) {
        onTicketCancelled(ticket.id)
      } else {
        setError(result.error || 'Failed to cancel ticket')
      }
    } catch (error) {
      console.error('Cancel ticket error:', error)
      setError(error instanceof Error ? error.message : 'Failed to cancel ticket')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleBurnTokens = async () => {
    try {
      setIsConfirming(true)
      setError(null)
      onConfirmationUpdate(ticket.id, 'confirming')

      const burnAmount = ticket.purchasePrice * 1000000 // Convert to microSTONE (6 decimals)

      const postConditions = [
        Pc.principal(ticket.walletAddress)
          .willSendEq(burnAmount)
          .ft(`${STONE_CONTRACT_ADDRESS}.${STONE_CONTRACT_NAME}`, 'STONE')
      ]

      console.log(`Burning ${burnAmount} microSTONE from ${ticket.walletAddress} to ${BURN_ADDRESS}`)
      const contractCallOptions = {
        contract: `${STONE_CONTRACT_ADDRESS}.${STONE_CONTRACT_NAME}` as `${string}.${string}`,
        functionName: 'transfer',
        functionArgs: [
          uintCV(burnAmount),
          standardPrincipalCV(ticket.walletAddress),
          standardPrincipalCV(BURN_ADDRESS),
          noneCV() // memo field
        ],
        postConditions,
      }

      const result = await request('stx_callContract', contractCallOptions)

      if (result.txid) {
        console.log('Transaction submitted:', result.txid)
        setTxId(result.txid)

        // Immediately update the ticket with the transaction ID
        try {
          await fetch('/api/v1/lottery/update-ticket-tx', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ticketId: ticket.id,
              transactionId: result.txid,
              walletAddress: ticket.walletAddress
            })
          })
          console.log(`Ticket ${ticket.id} updated with transaction ID immediately`)
        } catch (updateError) {
          console.warn('Failed to update ticket with transaction ID:', updateError)
        }

        pollForConfirmation(result.txid)
      } else {
        throw new Error('Transaction was cancelled or failed')
      }

    } catch (error) {
      console.error('Burn transaction error:', error)
      setError(error instanceof Error ? error.message : 'Failed to initiate transaction')
      setIsConfirming(false)
      onConfirmationUpdate(ticket.id, 'failed')
    }
  }

  return (
    <>
      {/* Mobile Layout */}
      <div className="block sm:hidden bg-muted/30 rounded-lg p-4 space-y-3 border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="text-sm font-mono">#{ticket.id.slice(-6)}</div>
            {ticket.isWinner && (
              <Trophy className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          <Badge className={getStatusColor(ticket.status)}>
            {ticket.status}
          </Badge>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-medium">{ticket.purchasePrice} STONE</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Date:</span>
            <span>{new Date(ticket.purchaseDate).toLocaleDateString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Draw:</span>
            <span className="font-mono">{ticket.drawId.replace('next-draw-', '')}</span>
          </div>
          {ticket.isWinner && (
            <div className="text-center py-2 text-yellow-600 font-medium">
              🏆 WINNER!
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {ticket.status === 'pending' && (
            <>
              <Button
                onClick={handleBurnTokens}
                disabled={isConfirming || isCancelling}
                size="sm"
                className="flex-1 min-w-0"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Transfer
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Transfer {ticket.purchasePrice}
                  </>
                )}
              </Button>

              <Button
                onClick={handleCancelTicket}
                disabled={isConfirming || isCancelling}
                variant="outline"
                size="sm"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Cancel
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </>
                )}
              </Button>

              {txId && (
                <Button
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus || isConfirming || isCancelling}
                  variant="outline"
                  size="sm"
                >
                  {isCheckingStatus ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'Check'
                  )}
                </Button>
              )}
            </>
          )}

          {ticket.status === 'confirmed' && ticket.transactionId && (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-1 text-sm text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirmed</span>
              </div>
              <TransactionLink
                txId={ticket.transactionId}
                variant="button"
                size="sm"
              >
                View TX
              </TransactionLink>
            </div>
          )}
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-2 hover:bg-muted/50 rounded-lg border-b border-border/20 items-center">
        {/* Column 1: ID/Status */}
        <div className="col-span-2">
          <div className="flex items-center gap-2">
            <div className="text-xs font-mono">#{ticket.id.slice(-6)}</div>
            {ticket.isWinner && (
              <Trophy className="h-4 w-4 text-yellow-500" />
            )}
          </div>
          <Badge className={getStatusColor(ticket.status)} >
            {ticket.status}
          </Badge>
        </div>

        {/* Column 2: Type */}
        <div className="col-span-3">
          <div className="text-xs">Simple Lottery Ticket</div>
          {ticket.isWinner && (
            <div className="text-xs font-medium text-yellow-600">🏆 WINNER!</div>
          )}
        </div>

        {/* Column 3: Purchase Info */}
        <div className="col-span-2">
          <div className="text-xs font-medium">{ticket.purchasePrice} STONE</div>
          <div className="text-xs text-muted-foreground">
            {new Date(ticket.purchaseDate).toLocaleDateString()}
          </div>
        </div>

        {/* Column 4: Draw ID */}
        <div className="col-span-2">
          <div className="text-xs font-mono">{ticket.drawId.replace('next-draw-', '')}</div>
          <div className="text-xs text-muted-foreground">Draw</div>
        </div>

        {/* Column 5: Actions */}
        <div className="col-span-3 flex items-center gap-1 justify-end">
          {ticket.status === 'pending' && (
            <>
              <Button
                onClick={handleBurnTokens}
                disabled={isConfirming || isCancelling}
                className="h-7 text-xs px-2"
              >
                {isConfirming ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Transfer
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Transfer {ticket.purchasePrice}
                  </>
                )}
              </Button>

              <Button
                onClick={handleCancelTicket}
                disabled={isConfirming || isCancelling}
                variant="outline"
                size="sm"
                className="h-7 text-xs px-2"
              >
                {isCancelling ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Cancel
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 mr-1" />
                    Cancel
                  </>
                )}
              </Button>

              {txId && (
                <Button
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus || isConfirming || isCancelling}
                  variant="outline"
                  className="px-2 h-7"
                >
                  {isCheckingStatus ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'Check'
                  )}
                </Button>
              )}
            </>
          )}

          {ticket.status === 'confirmed' && ticket.transactionId && (
            <>
              <div className="flex items-center gap-1 text-xs text-green-700 mr-1">
                <CheckCircle2 className="h-3 w-3" />
                <span>Confirmed</span>
              </div>
              <TransactionLink
                txId={ticket.transactionId}
                variant="button"
                size="sm"
                className="h-6 text-xs px-2"
              >
                View TX
              </TransactionLink>
            </>
          )}
        </div>
      </div>

      {/* Error/Status row */}
      {(error || (txId && isConfirming)) && (
        <div className="px-3 pb-2 sm:px-0">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
              {error}
            </div>
          )}
          {txId && !error && isConfirming && (
            <div className="hidden sm:flex items-center justify-between text-xs">
              <span className="text-blue-600">Waiting for confirmation...</span>
              <TransactionLink
                txId={txId}
                variant="inline"
                size="sm"
                className="text-xs"
              >
                View TX
              </TransactionLink>
            </div>
          )}
        </div>
      )}
    </>
  )
}

export function SimpleTicketsTable({ tickets, onConfirmationUpdate, onTicketCancelled }: SimpleTicketsTableProps) {
  if (tickets.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No tickets found
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Table Header - Desktop Only */}
      <div className="hidden sm:grid grid-cols-12 gap-3 px-3 py-2 text-xs font-medium text-muted-foreground border-b">
        <div className="col-span-2">Ticket</div>
        <div className="col-span-3">Type</div>
        <div className="col-span-2">Burned</div>
        <div className="col-span-2">Draw ID</div>
        <div className="col-span-3 text-right">Actions</div>
      </div>

      {/* Table Body */}
      <div className="space-y-2 sm:space-y-0">
        {tickets.map((ticket) => (
          <IndividualTicketRow
            key={ticket.id}
            ticket={ticket}
            onConfirmationUpdate={onConfirmationUpdate}
            onTicketCancelled={onTicketCancelled}
          />
        ))}
      </div>
    </div>
  )
}