import { createTxMonitorClient } from '@repo/tx-monitor-client'
import { getTransactionEvents, getTransactionDetails } from '@repo/polyglot'
import { getHostUrl } from '@modules/discovery'

// Constants for STONE token validation
export const STONE_CONTRACT_ADDRESS = 'SPQ5CEHETP8K4Q2FSNNK9ANMPAVBSA9NN86YSN59'
export const STONE_CONTRACT_NAME = 'stone-bonding-curve'
export const BURN_ADDRESS = 'SP000000000000000000002Q6VF78'

// Create tx-monitor client singleton with service discovery
const txMonitorClient = createTxMonitorClient({
  baseUrl: getHostUrl('tx-monitor'),
  timeout: 10000,
  retryAttempts: 1,
  retryDelay: 1000
})

export interface TransactionVerificationResult {
  success: boolean
  status?: string
  blockHeight?: number
  blockTime?: number
  validatedAmount?: number
  actualTransferAmount?: number
  burnAddress?: string
  error?: string
  retryable?: boolean
}

export interface VerifyTicketTransactionParams {
  transactionId: string
  walletAddress: string
  expectedAmount: number
  isBulkValidation?: boolean
}

/**
 * Verify a STONE burn transaction for a lottery ticket
 *
 * This function:
 * 1. Monitors transaction status via tx-monitor-client
 * 2. Validates transaction is successful on blockchain
 * 3. Verifies STONE token burn to burn address
 * 4. Confirms sender and amount match expectations
 */
export async function verifyTicketTransaction(
  params: VerifyTicketTransactionParams
): Promise<TransactionVerificationResult> {
  const { transactionId, walletAddress, expectedAmount, isBulkValidation = false } = params

  try {
    console.log(`Starting transaction verification for ${transactionId} (bulk: ${isBulkValidation})`)

    // Add transaction to monitoring queue (non-blocking)
    try {
      await txMonitorClient.addToQueue([transactionId])
      console.log(`Added transaction ${transactionId} to monitoring queue`)
    } catch (queueError) {
      console.warn(`Failed to add transaction to monitoring queue:`, queueError)
      console.log(`Proceeding with direct validation...`)
    }

    // Poll for transaction status with fallback to direct validation
    let txStatus = 'unknown'
    let blockHeight: number | undefined
    let blockTime: number | undefined

    try {
      const result = await txMonitorClient.pollTransactionStatus(transactionId, {
        interval: 2000,
        timeout: 10000,
        maxAttempts: 5,
        onStatusChange: (status) => {
          console.log(`Transaction ${transactionId} status: ${status.status}`)
        }
      })

      txStatus = result.status
      blockHeight = result.blockHeight
      blockTime = result.blockTime

      if (result.status !== 'success') {
        return {
          success: false,
          error: `Transaction failed with status: ${result.status}`,
          status: result.status,
          retryable: result.status === 'pending'
        }
      }

      console.log(`Transaction ${transactionId} confirmed via tx-monitor`)
    } catch (pollError) {
      console.warn(`Failed to poll via tx-monitor:`, pollError)
      console.log(`Attempting direct validation...`)

      // Fallback to direct blockchain query
      try {
        const directTxDetails = await getTransactionDetails(transactionId)
        if (directTxDetails.tx_status === 'success') {
          txStatus = 'success'
          blockHeight = directTxDetails.block_height
          blockTime = directTxDetails.block_time
          console.log(`Transaction ${transactionId} validated directly`)
        } else {
          return {
            success: false,
            error: `Transaction not yet confirmed. Status: ${directTxDetails.tx_status}. Please wait and try again.`,
            retryable: directTxDetails.tx_status === 'pending'
          }
        }
      } catch (directError) {
        console.error(`Failed to validate transaction:`, directError)
        return {
          success: false,
          error: 'Unable to validate transaction status. Please try again in a few minutes.',
          retryable: true
        }
      }
    }

    // Get transaction details and events for STONE transfer validation
    const [txDetails, txEvents] = await Promise.all([
      getTransactionDetails(transactionId),
      getTransactionEvents({ tx_id: transactionId, type: ['fungible_token_asset'] })
    ])

    console.log(`Transaction details:`, {
      tx_type: txDetails.tx_type,
      sender: txDetails.sender_address,
      events_count: txEvents.events?.length || 0
    })

    // Validate sender
    if (txDetails.sender_address !== walletAddress) {
      return {
        success: false,
        error: `Transaction sender ${txDetails.sender_address} does not match wallet ${walletAddress}`
      }
    }

    // Validate STONE burn transfer (STONE has 6 decimals)
    const expectedAmountMicro = Math.round(expectedAmount * 1000000)
    const stoneAssetId = `${STONE_CONTRACT_ADDRESS}.${STONE_CONTRACT_NAME}::STONE`.toLowerCase()

    let foundValidTransfer = false
    let actualTransferAmount = 0

    for (const event of txEvents.events || []) {
      if (event.event_type === 'fungible_token_asset' && event.asset) {
        const asset = event.asset
        const assetId = `${asset.asset_id}`.toLowerCase()

        if (assetId === stoneAssetId &&
            asset.sender === walletAddress &&
            asset.recipient === BURN_ADDRESS) {

          actualTransferAmount = parseInt(asset.amount)

          if (isBulkValidation) {
            // For bulk: just need to find STONE burn, amount validated separately
            foundValidTransfer = true
            console.log(`✅ Found STONE burn for bulk validation: ${actualTransferAmount} microSTONE`)
            break
          } else {
            // For single: exact amount match required
            if (actualTransferAmount === expectedAmountMicro) {
              foundValidTransfer = true
              console.log(`✅ Found valid STONE burn: ${actualTransferAmount} microSTONE`)
              break
            }
          }
        }
      }
    }

    if (!foundValidTransfer) {
      return {
        success: false,
        error: `No valid STONE transfer found. Expected ${expectedAmount} STONE from ${walletAddress} to ${BURN_ADDRESS}`
      }
    }

    return {
      success: true,
      status: txStatus,
      blockHeight,
      blockTime,
      validatedAmount: expectedAmount,
      actualTransferAmount,
      burnAddress: BURN_ADDRESS
    }

  } catch (error) {
    console.error('Transaction verification error:', error)

    let errorMessage = 'Transaction verification failed'

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Verification timed out. Transaction may still be processing. Please try again.'
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error. Please check connection and try again.'
      } else {
        errorMessage = error.message
      }
    }

    return {
      success: false,
      error: errorMessage,
      retryable: true
    }
  }
}

/**
 * Quick transaction status check without full validation
 */
export async function getTransactionStatus(transactionId: string): Promise<{
  status: string
  blockHeight?: number
  blockTime?: number
}> {
  try {
    const txDetails = await getTransactionDetails(transactionId)
    return {
      status: txDetails.tx_status,
      blockHeight: txDetails.block_height,
      blockTime: txDetails.block_time
    }
  } catch (error) {
    console.error('Failed to get transaction status:', error)
    throw new Error('Failed to fetch transaction status from blockchain')
  }
}
