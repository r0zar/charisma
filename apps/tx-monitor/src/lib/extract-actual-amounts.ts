/**
 * Utility functions to extract actual received amounts from transaction events
 */

import { getTransactionDetails } from '@repo/polyglot';

/**
 * Interface for storing comprehensive transaction analysis data
 * This can be stored in activity metadata for advanced visualizations
 */
export interface TransactionAnalysis {
  txid: string;
  userAddress: string;
  totalEvents: number;
  analysis: {
    inputTokens: Array<{
      assetId: string;
      amount: string;
      sender: string;
      eventIndex: number;
    }>;
    outputTokens: Array<{
      assetId: string;
      amount: string;
      sender: string;
      eventIndex: number;
    }>;
    finalOutputAmount: string | null;
    expectedOutputToken: string;
    slippage?: {
      quotedAmount: string;
      actualAmount: string;
      difference: number;
      slippagePercent: number;
    };
  };
  metadata: {
    extractedAt: number;
    blockHeight: number;
    blockTime: number;
    txStatus: string;
  };
}

/**
 * Extracts the actual output amount received by a user from transaction events
 * Looks for the final fungible_token_asset transfer event to the user address
 * 
 * @param txid Transaction ID to analyze
 * @param userAddress User's Stacks address
 * @param expectedOutputTokenContractId Contract ID of the expected output token (e.g., 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token')
 * @returns The actual amount received as a string, or null if not found
 */
export async function extractActualOutputAmount(
  txid: string, 
  userAddress: string, 
  expectedOutputTokenContractId: string
): Promise<string | null> {
  try {
    const txDetails = await getTransactionDetails(txid);
    
    if (!txDetails.events || txDetails.events.length === 0) {
      return null;
    }

    // Filter for fungible token events that transfer to the user
    const userTransfers = txDetails.events
      .filter(event => 
        event.event_type === 'fungible_token_asset' &&
        event.asset?.recipient === userAddress &&
        event.asset?.asset_event_type === 'transfer'
      );

    // Look for transfers of the expected output token
    const outputTokenTransfers = userTransfers.filter(event => {
      const assetId = event.asset?.asset_id;
      // Asset identifier format: "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token::charisma"
      // We need to match the contract part before "::"
      if (!assetId) return false;
      const contractPart = assetId.split('::')[0];
      return contractPart === expectedOutputTokenContractId;
    });

    // Return the amount from the last (final) transfer
    if (outputTokenTransfers.length > 0) {
      const finalTransfer = outputTokenTransfers[outputTokenTransfers.length - 1];
      return finalTransfer.asset?.amount || null;
    }

    return null;
  } catch (error) {
    console.error(`Error extracting actual output amount for ${txid}:`, error);
    return null;
  }
}

/**
 * Extracts all token transfers to a user from a transaction
 * Useful for debugging and understanding transaction flows
 * 
 * @param txid Transaction ID to analyze
 * @param userAddress User's Stacks address
 * @returns Array of transfer events to the user
 */
export async function extractUserTransfers(
  txid: string,
  userAddress: string
): Promise<Array<{
  assetIdentifier: string;
  amount: string;
  sender: string;
  eventIndex: number;
}>> {
  try {
    const txDetails = await getTransactionDetails(txid);
    
    if (!txDetails.events || txDetails.events.length === 0) {
      return [];
    }

    return txDetails.events
      .filter(event => 
        event.event_type === 'fungible_token_asset' &&
        event.asset?.recipient === userAddress &&
        event.asset?.asset_event_type === 'transfer'
      )
      .map(event => ({
        assetIdentifier: event.asset?.asset_id || '',
        amount: event.asset?.amount || '0',
        sender: event.asset?.sender || '',
        eventIndex: event.event_index || 0
      }));
  } catch (error) {
    console.error(`Error extracting user transfers for ${txid}:`, error);
    return [];
  }
}

/**
 * Performs comprehensive transaction analysis and returns structured data
 * This includes input/output token analysis, slippage calculation, and metadata
 * 
 * @param txid Transaction ID to analyze
 * @param userAddress User's Stacks address
 * @param expectedOutputTokenContractId Contract ID of the expected output token
 * @param quotedAmount Optional quoted amount for slippage calculation
 * @returns Comprehensive transaction analysis data
 */
export async function analyzeTransaction(
  txid: string,
  userAddress: string,
  expectedOutputTokenContractId: string,
  quotedAmount?: string
): Promise<TransactionAnalysis | null> {
  try {
    const txDetails = await getTransactionDetails(txid);
    
    if (!txDetails.events || txDetails.events.length === 0) {
      return null;
    }

    // Get all token transfers involving the user
    const allTokenEvents = txDetails.events.filter(event => 
      event.event_type === 'fungible_token_asset' &&
      event.asset?.asset_event_type === 'transfer' &&
      (event.asset?.sender === userAddress || event.asset?.recipient === userAddress)
    );

    // Separate input (from user) and output (to user) transfers
    const inputTokens = allTokenEvents
      .filter(event => event.asset?.sender === userAddress)
      .map(event => ({
        assetId: event.asset?.asset_id || '',
        amount: event.asset?.amount || '0',
        sender: event.asset?.sender || '',
        eventIndex: event.event_index || 0
      }));

    const outputTokens = allTokenEvents
      .filter(event => event.asset?.recipient === userAddress)
      .map(event => ({
        assetId: event.asset?.asset_id || '',
        amount: event.asset?.amount || '0',
        sender: event.asset?.sender || '',
        eventIndex: event.event_index || 0
      }));

    // Find the final output amount for the expected token
    const finalOutputAmount = await extractActualOutputAmount(txid, userAddress, expectedOutputTokenContractId);

    // Calculate slippage if quoted amount is provided and valid
    let slippage;
    if (quotedAmount && finalOutputAmount) {
      const quotedNum = parseInt(quotedAmount);
      const actualNum = parseInt(finalOutputAmount);
      
      // Only calculate slippage if quoted amount is greater than 0
      if (quotedNum > 0) {
        const difference = quotedNum - actualNum;
        const slippagePercent = (difference / quotedNum) * 100;

        slippage = {
          quotedAmount,
          actualAmount: finalOutputAmount,
          difference,
          slippagePercent
        };
      }
    }

    const analysis: TransactionAnalysis = {
      txid,
      userAddress,
      totalEvents: txDetails.events.length,
      analysis: {
        inputTokens,
        outputTokens,
        finalOutputAmount,
        expectedOutputToken: expectedOutputTokenContractId,
        slippage
      },
      metadata: {
        extractedAt: Date.now(),
        blockHeight: txDetails.block_height,
        blockTime: txDetails.block_time,
        txStatus: txDetails.tx_status
      }
    };

    return analysis;
  } catch (error) {
    console.error(`Error analyzing transaction ${txid}:`, error);
    return null;
  }
}