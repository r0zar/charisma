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
    await txMonitorClient.addToQueue([txId])
    console.log(`Added transaction ${txId} to monitoring queue`)
    
    const result = await txMonitorClient.pollTransactionStatus(txId, {
      interval: 5000,
      timeout: 300000,
      maxAttempts: 60,
      onStatusChange: (status) => {
        console.log(`Transaction ${txId} status: ${status.status}`)
      }
    })
    
    if (result.status !== 'success') {
      return {
        success: false,
        error: `Transaction failed with status: ${result.status}`,
        status: result.status
      }
    }
    
    console.log(`Transaction ${txId} confirmed, now validating burn transfer...`)
    
    // Get transaction details and events to validate the STONE transfer
    const [txDetails, txEvents] = await Promise.all([
      getTransactionDetails(txId),
      getTransactionEvents({ tx_id: txId, type: ['fungible_token_asset'] })
    ])
    
    console.log(`Transaction details:`, {
      tx_type: txDetails.tx_type,
      tx_status: txDetails.tx_status,
      sender_address: txDetails.sender_address
    })
    console.log(`Found ${txEvents.results?.length || 0} fungible token events`)
    
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
    
    for (const event of txEvents.results || []) {
      if (event.event_type === 'fungible_token_asset' && event.asset) {
        const asset = event.asset
        const assetId = `${asset.asset_id}`.toLowerCase()
        const stoneAssetId = `${STONE_CONTRACT_ADDRESS}.${STONE_CONTRACT_NAME}::stone`.toLowerCase()
        
        console.log(`Checking asset transfer:`, {
          assetId,
          expectedAssetId: stoneAssetId,
          amount: asset.amount,
          expectedAmount: expectedAmountMicro,
          sender: asset.sender,
          recipient: asset.recipient
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
    
    if (!foundValidTransfer) {
      return {
        success: false,
        error: `No valid STONE transfer to burn address found. Expected ${expectedAmount} STONE (${expectedAmountMicro} microSTONE) from ${walletAddress} to ${BURN_ADDRESS}`
      }
    }
    
    return {
      success: true,
      status: result.status,
      blockHeight: result.blockHeight,
      blockTime: result.blockTime,
      validatedAmount: expectedAmount,
      burnAddress: BURN_ADDRESS
    }
    
  } catch (error) {
    console.error('Burn transaction validation error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Transaction validation failed'
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
      return NextResponse.json(
        { success: false, error: validationResult.error || 'Transaction validation failed' },
        { status: 400 }
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
    
    const response: TicketConfirmationResponse = {
      success: false,
      error: `Failed to confirm ticket: ${error instanceof Error ? error.message : 'Unknown error'}`
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}