'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ExternalLink, CheckCircle2 } from 'lucide-react'
import { LotteryTicket } from '@/types/lottery'
import { request } from '@stacks/connect'
import { STACKS_TESTNET, STACKS_MAINNET } from '@stacks/network'
import {
  uintCV,
  standardPrincipalCV,
  Pc,
  PostConditionMode,
  noneCV
} from '@stacks/transactions'

interface TicketConfirmationProps {
  ticket: LotteryTicket
  onConfirmationUpdate: (ticketId: string, status: 'confirming' | 'confirmed' | 'failed') => void
}

const STONE_CONTRACT_ADDRESS = 'SPQ5CEHETP8K4Q2FSNNK9ANMPAVBSA9NN86YSN59'
const STONE_CONTRACT_NAME = 'stone-bonding-curve'
const BURN_ADDRESS = 'SP000000000000000000002Q6VF78' // Standard burn address
const NETWORK = process.env.NODE_ENV === 'production' ? STACKS_MAINNET : STACKS_TESTNET

export function TicketConfirmation({ ticket, onConfirmationUpdate }: TicketConfirmationProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [txId, setTxId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isCheckingStatus, setIsCheckingStatus] = useState(false)

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
          onConfirmationUpdate(ticket.id, 'confirmed')
          return
        }

        // Check if we should retry
        if (attempts < maxAttempts) {
          if (apiResult.retryable !== false) {
            // Wait 5 seconds before next attempt
            setTimeout(poll, 5000)
          } else {
            // Non-retryable error
            throw new Error(apiResult.error || 'Transaction validation failed')
          }
        } else {
          // Max attempts reached
          throw new Error('Transaction confirmation timed out. Please check your wallet and try again.')
        }
      } catch (error) {
        console.error('Confirmation polling error:', error)
        setError(error instanceof Error ? error.message : 'Failed to confirm ticket')
        setIsConfirming(false)
        onConfirmationUpdate(ticket.id, 'failed')
      }
    }

    // Start polling
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

  const handleBurnTokens = async () => {
    try {
      setIsConfirming(true)
      setError(null)
      onConfirmationUpdate(ticket.id, 'confirming')

      const burnAmount = ticket.purchasePrice * 1000000 // Convert to microSTONE (6 decimals)

      // Use Pc.principal syntax for post conditions
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
        // PostConditionMode: 'deny'
      }

      const result = await request('stx_callContract', contractCallOptions)

      if (result.txid) {
        console.log('Transaction submitted:', result.txid)
        setTxId(result.txid)

        // Start polling for confirmation instead of waiting for one long request
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
          {/* Left side - Ticket info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="flex-shrink-0">
              <div className="text-xs font-mono">#{ticket.id.slice(-6)}</div>
              <Badge className={getStatusColor(ticket.status)} >
                {ticket.status}
              </Badge>
            </div>
            <div className="flex gap-0.5 flex-shrink-0">
              {ticket.numbers.map((number: number, index: number) => (
                <div
                  key={index}
                  className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center"
                >
                  {number}
                </div>
              ))}
            </div>
            <div className="text-xs text-muted-foreground flex-shrink-0">
              {ticket.purchasePrice} STONE
            </div>
          </div>

          {/* Right side - Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {ticket.status === 'pending' && (
              <>
                <Button
                  onClick={handleBurnTokens}
                  disabled={isConfirming}
                  
                  className="h-7 text-xs px-2"
                >
                  {isConfirming ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Burn {ticket.purchasePrice}
                    </>
                  )}
                </Button>
                
                {txId && (
                  <Button
                    onClick={handleCheckStatus}
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
            
            {ticket.status === 'confirmed' && ticket.transactionId && (
              <>
                <div className="flex items-center gap-1 text-xs text-green-700 mr-2">
                  <CheckCircle2 className="h-3 w-3" />
                  <code className="text-xs bg-green-100 px-1 rounded">
                    {ticket.transactionId.slice(0, 4)}...{ticket.transactionId.slice(-4)}
                  </code>
                </div>
                <Button
                  onClick={handleCheckStatus}
                  disabled={isCheckingStatus}
                  variant="outline"
                  
                  className="px-2 h-6 text-xs"
                >
                  {isCheckingStatus ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    'Re-check'
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Error/Status messages below */}
        {ticket.status === 'pending' && (error || txId) && (
          <div className="mt-2 space-y-1">
            {error && (
              <div className="p-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {error}
              </div>
            )}
            {txId && !error && (
              <div className="flex items-center gap-1 text-xs text-blue-600">
                <ExternalLink className="h-3 w-3" />
                <span>TX: {txId.slice(0, 6)}...{txId.slice(-6)} - Waiting for confirmation...</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}