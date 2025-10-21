import { NextRequest, NextResponse } from 'next/server'
import { hybridStorage } from '@/lib/hybrid-storage'
import { ticketService } from '@/lib/ticket-service'
import { verifyTicketTransaction } from '@/lib/transaction-verification'

export interface TicketConfirmationRequest {
  ticketId: string
  transactionId: string
  walletAddress: string
  expectedAmount: number
  isBulkValidation?: boolean
  totalBulkAmount?: number
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

export async function POST(request: NextRequest) {
  try {
    const body: TicketConfirmationRequest = await request.json()
    const { ticketId, transactionId, walletAddress, expectedAmount, isBulkValidation, totalBulkAmount } = body
    
    console.log('Ticket confirmation request:', { ticketId, transactionId, walletAddress, expectedAmount, isBulkValidation, totalBulkAmount })
    
    // Validate input
    if (!ticketId || !transactionId || !walletAddress || !expectedAmount) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Get the ticket to verify it exists and is in pending status
    const ticket = await hybridStorage.getLotteryTicket(ticketId)
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
    
    // Use the ticket's stored purchase price for validation
    console.log(`Using ticket's stored price ${ticket.purchasePrice} STONE instead of frontend expected amount ${expectedAmount} STONE`)

    // For bulk validation, use the total bulk amount, otherwise use individual ticket price
    const validationAmount = isBulkValidation && totalBulkAmount ? totalBulkAmount : ticket.purchasePrice

    // Verify the transaction using the new service
    console.log(`Verifying transaction ${transactionId} for ticket ${ticketId} (bulk: ${isBulkValidation}, amount: ${validationAmount})`)
    const validationResult = await verifyTicketTransaction({
      transactionId,
      walletAddress,
      expectedAmount: validationAmount,
      isBulkValidation: isBulkValidation || false
    })
    
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
    
    // For bulk validation, verify that the individual ticket price is valid compared to the total transfer
    if (isBulkValidation && validationResult.actualTransferAmount) {
      const actualTotalSTONE = validationResult.actualTransferAmount / 1000000
      const individualTicketPrice = ticket.purchasePrice
      
      console.log(`Bulk validation - Total burned: ${actualTotalSTONE} STONE, Individual ticket price: ${individualTicketPrice} STONE`)
      
      // Check if the individual ticket price is reasonable relative to the total burn
      // The total burn should be divisible by the individual ticket price (with some tolerance for floating point)
      const expectedTicketCount = Math.round(actualTotalSTONE / individualTicketPrice)
      const expectedTotal = expectedTicketCount * individualTicketPrice
      const tolerance = 0.000001 // 1 microSTONE tolerance
      
      if (Math.abs(actualTotalSTONE - expectedTotal) > tolerance) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Bulk validation failed: Total burned amount ${actualTotalSTONE} STONE doesn't match expected pattern for ${individualTicketPrice} STONE tickets`,
            retryable: false
          },
          { status: 400 }
        )
      }
      
      console.log(`✅ Bulk validation passed: ${actualTotalSTONE} STONE total for ${expectedTicketCount} tickets at ${individualTicketPrice} STONE each`)
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
    
    await hybridStorage.saveLotteryTicket(confirmedTicket)
    
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
    
    const jsonResponse = NextResponse.json(response)
    
    // Never cache confirmation responses to ensure fresh transaction status
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    jsonResponse.headers.set('Pragma', 'no-cache')
    jsonResponse.headers.set('Expires', '0')
    jsonResponse.headers.set('Surrogate-Control', 'no-store')
    
    return jsonResponse
    
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
    
    const jsonResponse = NextResponse.json(response, { status: statusCode })
    
    // Never cache error responses from confirmation endpoint
    jsonResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    jsonResponse.headers.set('Pragma', 'no-cache')
    jsonResponse.headers.set('Expires', '0')
    jsonResponse.headers.set('Surrogate-Control', 'no-store')
    
    return jsonResponse
  }
}