'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ExternalLink, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
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

interface BulkTicketConfirmationProps {
  tickets: LotteryTicket[]
  onConfirmationUpdate: (ticketIds: string[], status: 'confirming' | 'confirmed' | 'failed') => void
}

const STONE_CONTRACT_ADDRESS = 'SPQ5CEHETP8K4Q2FSNNK9ANMPAVBSA9NN86YSN59'
const STONE_CONTRACT_NAME = 'stone-bonding-curve'
const BURN_ADDRESS = 'SP000000000000000000002Q6VF78'
const NETWORK = process.env.NODE_ENV === 'production' ? STACKS_MAINNET : STACKS_TESTNET

export function BulkTicketConfirmation({ tickets, onConfirmationUpdate }: BulkTicketConfirmationProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [txId, setTxId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

  // Calculate total amount needed
  const totalAmount = tickets.reduce((sum, ticket) => sum + ticket.purchasePrice, 0)
  const ticketIds = tickets.map(t => t.id)

  const pollForBulkConfirmation = async (transactionId: string) => {
    const maxAttempts = 24 // 2 minutes total (24 * 5 seconds)
    let attempts = 0

    const poll = async () => {
      try {
        attempts++
        console.log(`Bulk polling attempt ${attempts}/${maxAttempts} for transaction ${transactionId}`)

        // Try to confirm all tickets - they should all use the same transaction
        const confirmPromises = tickets.map(ticket =>
          fetch('/api/v1/lottery/confirm-ticket', {
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
        )

        const responses = await Promise.all(confirmPromises)
        const results = await Promise.all(responses.map(r => r.json()))

        const allSuccessful = results.every(r => r.success)

        if (allSuccessful) {
          console.log('All bulk tickets confirmed successfully!')
          setIsConfirming(false)
          onConfirmationUpdate(ticketIds, 'confirmed')
          return
        }

        // Check if we should retry
        const anyRetryable = results.some(r => r.retryable !== false)

        if (attempts < maxAttempts && anyRetryable) {
          // Wait 5 seconds before next attempt
          setTimeout(poll, 5000)
        } else {
          // Max attempts reached or non-retryable error
          const failedTickets = results.filter(r => !r.success)
          throw new Error(`Bulk ticket confirmation failed: ${failedTickets.map(r => r.error).join(', ')}`)
        }
      } catch (error) {
        console.error('Bulk confirmation polling error:', error)
        setError(error instanceof Error ? error.message : 'Failed to confirm tickets')
        setIsConfirming(false)
        onConfirmationUpdate(ticketIds, 'failed')
      }
    }

    // Start polling
    poll()
  }

  const handleCheckBulkStatus = async () => {
    if (!txId) {
      setError('No transaction ID available to check')
      return
    }

    setIsCheckingStatus(true)
    setError(null)

    try {
      console.log(`Manually checking bulk status for transaction ${txId}`)

      const confirmPromises = tickets.map(ticket =>
        fetch('/api/v1/lottery/confirm-ticket', {
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
      )

      const responses = await Promise.all(confirmPromises)
      const results = await Promise.all(responses.map(r => r.json()))

      const allSuccessful = results.every(r => r.success)

      if (allSuccessful) {
        console.log('Manual bulk status check: All tickets confirmed!')
        onConfirmationUpdate(ticketIds, 'confirmed')
      } else {
        const failedTickets = results.filter(r => !r.success)
        const errorMsg = `Bulk status check failed: ${failedTickets.map(r => r.error).join(', ')}`
        console.log(errorMsg)
        setError(errorMsg)
      }
    } catch (error) {
      console.error('Manual bulk status check error:', error)
      setError(`Bulk status check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsCheckingStatus(false)
    }
  }

  const handleBulkBurnTokens = async () => {
    try {
      setIsConfirming(true)
      setError(null)
      onConfirmationUpdate(ticketIds, 'confirming')

      const burnAmount = totalAmount * 1000000 // Convert to microSTONE (6 decimals)

      // Use Pc.principal syntax for post conditions
      const postConditions = [
        Pc.principal(tickets[0].walletAddress)
          .willSendEq(burnAmount)
          .ft(`${STONE_CONTRACT_ADDRESS}.${STONE_CONTRACT_NAME}`, 'STONE')
      ]

      const contractCallOptions = {
        contract: `${STONE_CONTRACT_ADDRESS}.${STONE_CONTRACT_NAME}` as `${string}.${string}`,
        functionName: 'transfer',
        functionArgs: [
          uintCV(burnAmount),
          standardPrincipalCV(tickets[0].walletAddress),
          standardPrincipalCV(BURN_ADDRESS),
          noneCV()
        ],
        postConditions,
      }

      const result = await request('stx_callContract', contractCallOptions)

      if (result.txid) {
        console.log('Bulk transaction submitted:', result.txid)
        setTxId(result.txid)
        
        // Immediately update all tickets with the transaction ID
        try {
          const updatePromises = tickets.map(ticket =>
            fetch('/api/v1/lottery/update-ticket-tx', {
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
          )
          
          await Promise.all(updatePromises)
          console.log(`All ${tickets.length} tickets updated with transaction ID immediately`)
        } catch (updateError) {
          console.warn('Failed to update some tickets with transaction ID:', updateError)
        }

        // Start polling for confirmation instead of waiting for one long request
        pollForBulkConfirmation(result.txid)
      } else {
        throw new Error('Transaction was cancelled or failed')
      }

    } catch (error) {
      console.error('Bulk burn transaction error:', error)
      setError(error instanceof Error ? error.message : 'Failed to initiate transaction')
      setIsConfirming(false)
      onConfirmationUpdate(ticketIds, 'failed')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'confirmed': return 'bg-green-100 text-green-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <Card className="w-full">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          {/* Left side - Bulk info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <Button
              variant="ghost"

              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 h-5 w-5 flex-shrink-0"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </Button>
            <div className="flex-shrink-0">
              <div className="text-xs font-medium">Bulk - {tickets.length} tickets</div>
              <Badge className={getStatusColor(tickets[0].status)}>
                {tickets[0].status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground flex-shrink-0">
              {totalAmount} STONE total
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {tickets[0].status === 'pending' && (
              <>
                <Button
                  onClick={handleBulkBurnTokens}
                  disabled={isConfirming}

                  className="h-7 text-xs px-2"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Confirming {tickets.length}...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Burn {totalAmount}
                    </>
                  )}
                </Button>

                {txId && (
                  <Button
                    onClick={handleCheckBulkStatus}
                    disabled={isCheckingStatus || isConfirming}
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

            {tickets[0].status === 'confirmed' && tickets[0].transactionId && (
              <>
                <div className="flex items-center gap-1 text-xs text-green-700 mr-2">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>All {tickets.length} confirmed</span>
                </div>
                <TransactionLink 
                  txId={tickets[0].transactionId} 
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

        {/* Expanded ticket details */}
        {isExpanded && (
          <div className="mt-2 pt-2 border-t border-border">
            <div className="text-xs font-medium text-muted-foreground mb-1">Ticket IDs:</div>
            <div className="grid grid-cols-2 gap-1 max-h-24 overflow-y-auto">
              {tickets.map((ticket, index) => (
                <div key={ticket.id} className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">#{index + 1}:</span>
                  <code className="text-xs bg-muted px-1 rounded">
                    {ticket.id.slice(-8)}
                  </code>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error/Status messages below */}
        {tickets[0].status === 'pending' && (error || txId) && (
          <div className="mt-2 space-y-1">
            {error && (
              <div className="p-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}
            {txId && !error && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-600">Bulk transaction waiting for confirmation...</span>
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
      </CardContent>
    </Card>
  )
}