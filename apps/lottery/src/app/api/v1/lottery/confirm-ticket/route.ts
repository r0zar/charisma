import { NextRequest, NextResponse } from 'next/server'
import { blobStorage } from '@/lib/blob-storage'
import { ticketService } from '@/lib/ticket-service'
import { createTxMonitorClient } from '@repo/tx-monitor-client'
import { getTransactionEvents, getTransactionDetails } from '@repo/polyglot'
import { getHostUrl } from '@modules/discovery'

export interface TicketConfirmationRequest {
  ticketId: string
  transactionId: string
  walletAddress: string
  expectedAmount: number
}

export interface TicketConfirmationResponse {
  success: boolean
  data?: {
    ticketId: string
    status: string
    transactionId: string
    confirmedAt: string
  }
  error?: string
  retryable?: boolean
}

// Constants for validation
const STONE_CONTRACT_ADDRESS = 'SPQ5CEHETP8K4Q2FSNNK9ANMPAVBSA9NN86YSN59'
const STONE_CONTRACT_NAME = 'stone-bonding-curve'
const BURN_ADDRESS = 'SP000000000000000000002Q6VF78'

// Create tx-monitor client with proper configuration using service discovery
const txMonitorClient = createTxMonitorClient({
  baseUrl: getHostUrl('tx-monitor'),
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 2000
})

async function validateBurnTransaction(txId: string, expectedAmount: number, walletAddress: string) {
  try {
    console.log(`Starting burn transaction validation for ${txId}`)
    
    // First wait for transaction confirmation using tx-monitor
    try {
      await txMonitorClient.addToQueue([txId])
      console.log(`Added transaction ${txId} to monitoring queue`)
    } catch (queueError) {
      console.error(`Failed to add transaction to monitoring queue:`, queueError)
      // Continue with direct validation if queue fails
      console.log(`Proceeding with direct transaction validation...`)
    }
    
    // Try to poll for transaction status, but fall back to direct check if it fails
    let txStatus = 'unknown'
    let blockHeight: number | undefined
    let blockTime: number | undefined
    
    try {
      const result = await txMonitorClient.pollTransactionStatus(txId, {
        interval: 2000,
        timeout: 10000, // Short timeout for polling API
        maxAttempts: 5,
        onStatusChange: (status) => {
          console.log(`Transaction ${txId} status: ${status.status}`)
        }
      })
      
      txStatus = result.status
      blockHeight = result.blockHeight
      blockTime = result.blockTime
      
      if (result.status !== 'success') {
        return {
          success: false,
          error: `Transaction failed with status: ${result.status}`,
          status: result.status
        }
      }
      
      console.log(`Transaction ${txId} confirmed via tx-monitor, now validating burn transfer...`)
    } catch (pollError) {
      console.warn(`Failed to poll transaction status via tx-monitor:`, pollError)
      console.log(`Proceeding with direct transaction validation...`)
      
      // Try direct validation without tx-monitor
      try {
        const directTxDetails = await getTransactionDetails(txId)
        if (directTxDetails.tx_status === 'success') {
          txStatus = 'success'
          blockHeight = directTxDetails.block_height
          blockTime = directTxDetails.block_time
          console.log(`Transaction ${txId} validated directly, now checking burn transfer...`)
        } else {
          return {
            success: false,
            error: `Transaction not yet confirmed or failed. Status: ${directTxDetails.tx_status}. Please wait a moment and try again.`
          }
        }
      } catch (directError) {
        console.error(`Failed to validate transaction directly:`, directError)
        return {
          success: false,
          error: 'Unable to validate transaction status. The transaction monitoring service may be temporarily unavailable. Please try again in a few minutes.'
        }
      }
    }
    
    // Get transaction details and events to validate the STONE transfer
    const [txDetails, txEvents] = await Promise.all([
      getTransactionDetails(txId),
      getTransactionEvents({ tx_id: txId, type: ['fungible_token_asset'] })
    ])
    
    // Log full transaction details for debugging
    console.log(`=== FULL TRANSACTION DETAILS ===`)
    console.log(JSON.stringify(txDetails, null, 2))
    
    console.log(`=== TRANSACTION EVENTS ===`)
    console.log(JSON.stringify(txEvents, null, 2))
    
    console.log(`Transaction summary:`, {
      tx_type: txDetails.tx_type,
      tx_status: txDetails.tx_status,
      sender_address: txDetails.sender_address,
      contract_call: txDetails.tx_type === 'contract_call' ? (txDetails as any).contract_call : undefined,
      tx_result: txDetails.tx_result
    })
    console.log(`Found ${txEvents.events?.length || 0} fungible token events`)
    
    // Also try to get ALL event types to see what's available
    const allEvents = await getTransactionEvents({ tx_id: txId })
    console.log(`=== ALL EVENTS (${allEvents.events?.length || 0} total) ===`)
    console.log(JSON.stringify(allEvents, null, 2))
    
    // Validate sender address
    if (txDetails.sender_address !== walletAddress) {
      return {
        success: false,
        error: `Transaction sender ${txDetails.sender_address} does not match expected wallet ${walletAddress}`
      }
    }
    
    // Look for STONE transfer to burn address
    const expectedAmountMicro = expectedAmount * 1000000 // Convert to microSTONE
    let foundValidTransfer = false
    
    console.log(`=== SEARCHING FOR STONE TRANSFER ===`)
    console.log(`Expected:`, {
      assetId: `${STONE_CONTRACT_ADDRESS}.${STONE_CONTRACT_NAME}::stone`.toLowerCase(),
      amount: expectedAmountMicro,
      sender: walletAddress,
      recipient: BURN_ADDRESS
    })
    
    // Check fungible token events first
    console.log(`Checking ${txEvents.events?.length || 0} fungible token events...`)
    for (const event of txEvents.events || []) {
      console.log(`Event ${event.event_index}:`, {
        event_type: event.event_type,
        asset: event.asset
      })
      
      if (event.event_type === 'fungible_token_asset' && event.asset) {
        const asset = event.asset
        const assetId = `${asset.asset_id}`.toLowerCase()
        const stoneAssetId = `${STONE_CONTRACT_ADDRESS}.${STONE_CONTRACT_NAME}::STONE`.toLowerCase()
        
        console.log(`Checking asset transfer:`, {
          assetId,
          expectedAssetId: stoneAssetId,
          amount: asset.amount,
          expectedAmount: expectedAmountMicro,
          sender: asset.sender,
          recipient: asset.recipient,
          matches: {
            assetId: assetId === stoneAssetId,
            sender: asset.sender === walletAddress,
            recipient: asset.recipient === BURN_ADDRESS,
            amount: parseInt(asset.amount) === expectedAmountMicro
          }
        })
        
        if (assetId === stoneAssetId &&
            asset.sender === walletAddress &&
            asset.recipient === BURN_ADDRESS &&
            parseInt(asset.amount) === expectedAmountMicro) {
          foundValidTransfer = true
          console.log(`✅ Found valid STONE burn transfer!`)
          break
        }
      }
    }
    
    // Also check ALL events for any STONE-related activity
    console.log(`Checking ${allEvents.events?.length || 0} total events for STONE activity...`)
    for (const event of allEvents.events || []) {
      const eventStr = JSON.stringify(event, null, 2)
      if (eventStr.toLowerCase().includes('stone') || 
          eventStr.includes(STONE_CONTRACT_ADDRESS) ||
          eventStr.includes(BURN_ADDRESS)) {
        console.log(`Found STONE-related event:`, event)
      }
    }
    
    if (!foundValidTransfer) {
      return {
        success: false,
        error: `No valid STONE transfer to burn address found. Expected ${expectedAmount} STONE (${expectedAmountMicro} microSTONE) from ${walletAddress} to ${BURN_ADDRESS}`
      }
    }
    
    return {
      success: true,
      status: txStatus,
      blockHeight: blockHeight,
      blockTime: blockTime,
      validatedAmount: expectedAmount,
      burnAddress: BURN_ADDRESS
    }
    
  } catch (error) {
    console.error('Burn transaction validation error:', error)
    
    // Provide more helpful error messages based on the error type
    let errorMessage = 'Transaction validation failed'
    
    if (error instanceof Error) {
      if (error.message.includes('TxMonitorError')) {
        errorMessage = 'Transaction monitoring service is temporarily unavailable. Please try again in a few minutes.'
      } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = 'Transaction validation timed out. Your transaction may still be processing. Please try again in a few minutes.'
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error occurred while validating transaction. Please check your connection and try again.'
      } else {
        errorMessage = error.message
      }
    }
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TicketConfirmationRequest = await request.json()
    const { ticketId, transactionId, walletAddress, expectedAmount } = body
    
    console.log('Ticket confirmation request:', { ticketId, transactionId, walletAddress, expectedAmount })
    
    // Validate input
    if (!ticketId || !transactionId || !walletAddress || !expectedAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Get the ticket to verify it exists and is in pending status
    const ticket = await blobStorage.getLotteryTicket(ticketId)
    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      )
    }
    
    if (ticket.status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Ticket is already ${ticket.status}` },
        { status: 400 }
      )
    }
    
    if (ticket.walletAddress !== walletAddress) {
      return NextResponse.json(
        { success: false, error: 'Wallet address mismatch' },
        { status: 400 }
      )
    }
    
    if (ticket.purchasePrice !== expectedAmount) {
      return NextResponse.json(
        { success: false, error: 'Amount mismatch' },
        { status: 400 }
      )
    }
    
    // Validate the burn transaction using tx-monitor-client and polyglot
    console.log(`Validating burn transaction ${transactionId} for ticket ${ticketId}`)
    const validationResult = await validateBurnTransaction(transactionId, expectedAmount, walletAddress)
    
    if (!validationResult.success) {
      console.log(`Transaction validation failed for ${ticketId}:`, validationResult.error)
      
      // Determine appropriate HTTP status based on error type
      let statusCode = 400
      if (validationResult.error?.includes('temporarily unavailable') || 
          validationResult.error?.includes('try again')) {
        statusCode = 503 // Service Unavailable
      } else if (validationResult.error?.includes('timeout') || 
                 validationResult.error?.includes('processing')) {
        statusCode = 202 // Accepted but still processing
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: validationResult.error || 'Transaction validation failed',
          retryable: statusCode === 503 || statusCode === 202
        },
        { status: statusCode }
      )
    }
    
    // Update the ticket to confirmed status
    const confirmedTicket = {
      ...ticket,
      status: 'confirmed' as const,
      transactionId,
      confirmedAt: new Date().toISOString(),
      blockHeight: validationResult.blockHeight,
      blockTime: validationResult.blockTime
    }
    
    await blobStorage.saveLotteryTicket(confirmedTicket)
    
    console.log(`Ticket ${ticketId} confirmed successfully`)
    
    const response: TicketConfirmationResponse = {
      success: true,
      data: {
        ticketId,
        status: 'confirmed',
        transactionId,
        confirmedAt: confirmedTicket.confirmedAt!
      }
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Confirm ticket API error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Provide user-friendly error messages
    let errorMessage = 'An unexpected error occurred while confirming your ticket'
    let statusCode = 500
    
    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'The request timed out. Please try again.'
        statusCode = 408
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error occurred. Please check your connection and try again.'
        statusCode = 503
      } else if (error.message.includes('JSON') || error.message.includes('parse')) {
        errorMessage = 'Invalid request format. Please refresh the page and try again.'
        statusCode = 400
      }
    }
    
    const response: TicketConfirmationResponse = {
      success: false,
      error: errorMessage
    }
    
    return NextResponse.json(response, { status: statusCode })
  }
}