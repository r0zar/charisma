'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ExternalLink, CheckCircle2, ChevronDown, ChevronRight } from 'lucide-react'
import { LotteryTicket } from '@/types/lottery'
import { request } from '@stacks/connect'
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network'
import {
  uintCV,
  standardPrincipalCV,
  Pc
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

  // Calculate total amount needed
  const totalAmount = tickets.reduce((sum, ticket) => sum + ticket.purchasePrice, 0)
  const ticketIds = tickets.map(t => t.id)

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
          uintCV(0) // memo field
        ],
        postConditions,
      }

      const result = await request('stx_callContract', contractCallOptions)

      if (result.txid) {
        console.log('Bulk transaction submitted:', result.txid)
        setTxId(result.txid)

        try {
          // Send the transaction ID to the backend for verification of all tickets
          const confirmPromises = tickets.map(ticket =>
            fetch('/api/v1/lottery/confirm-ticket', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                ticketId: ticket.id,
                transactionId: result.txid,
                walletAddress: ticket.walletAddress,
                expectedAmount: ticket.purchasePrice
              }),
            })
          )

          const responses = await Promise.all(confirmPromises)
          const results = await Promise.all(responses.map(r => r.json()))

          const allSuccessful = results.every(r => r.success)

          if (allSuccessful) {
            onConfirmationUpdate(ticketIds, 'confirmed')
          } else {
            const failedTickets = results.filter(r => !r.success)
            throw new Error(`Some tickets failed to confirm: ${failedTickets.map(r => r.error).join(', ')}`)
          }
        } catch (error) {
          console.error('Bulk confirmation API error:', error)
          setError(error instanceof Error ? error.message : 'Failed to confirm tickets')
          onConfirmationUpdate(ticketIds, 'failed')
        }
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
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
            <div>
              <CardTitle className="text-lg">
                Bulk Purchase - {tickets.length} tickets
              </CardTitle>
              <CardDescription>
                Total: {totalAmount} STONE • {new Date(tickets[0].purchaseDate).toLocaleString()}
              </CardDescription>
            </div>
          </div>
          <Badge className={getStatusColor(tickets[0].status)}>
            {tickets[0].status}
          </Badge>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-2 mb-4">
            <div className="text-sm font-medium text-muted-foreground">Ticket Numbers:</div>
            <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
              {tickets.map((ticket, index) => (
                <div key={ticket.id} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">#{index + 1}:</span>
                  <div className="flex gap-1">
                    {ticket.numbers.map((number, numIndex) => (
                      <div
                        key={numIndex}
                        className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center"
                      >
                        {number}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      )}

      <CardContent className="space-y-4">
        {tickets[0].status === 'pending' && (
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Confirm all {tickets.length} tickets by transferring {totalAmount} STONE tokens to the burn address.
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                {error}
              </div>
            )}

            {txId && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="flex items-center gap-2 text-sm text-blue-700">
                  <ExternalLink className="h-4 w-4" />
                  <span>Bulk transaction submitted:</span>
                  <code className="text-xs bg-blue-100 px-1 py-0.5 rounded">
                    {txId.slice(0, 8)}...{txId.slice(-8)}
                  </code>
                </div>
                <div className="text-xs text-blue-600 mt-1">
                  Waiting for blockchain confirmation...
                </div>
              </div>
            )}

            <Button
              onClick={handleBulkBurnTokens}
              disabled={isConfirming}
              className="w-full"
            >
              {isConfirming ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Confirming {tickets.length} tickets...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Transfer {totalAmount} STONE for {tickets.length} tickets
                </>
              )}
            </Button>
          </div>
        )}

        {tickets[0].status === 'confirmed' && tickets[0].transactionId && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span>All {tickets.length} tickets confirmed via transaction:</span>
              <code className="text-xs bg-green-100 px-1 py-0.5 rounded">
                {tickets[0].transactionId.slice(0, 8)}...{tickets[0].transactionId.slice(-8)}
              </code>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}