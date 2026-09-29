import { useState } from 'react'
import { assets } from '../../../background/lib/constants'
import type { Status, TransactionResult, Transfer } from '../types'
import { sendMessage } from '../utils'

export interface BlockchainState {
  status: Record<string, Status> | null
  isLoading: boolean
  error: string | null
}

export interface BlockchainActions {
  // Subnet operations
  getAssetBalances: (address?: string) => Promise<Record<string, number>>
  getBalance: (address?: string) => Promise<Record<string, number>>
  getBalances: () => Promise<Record<string, Record<string, number>>>
  deposit: (amount: number, subnetId: string) => Promise<TransactionResult>
  withdraw: (amount: number, subnetId: string) => Promise<TransactionResult>
  refreshBalances: (address?: string) => Promise<void>
  refreshStatus: () => Promise<Record<string, Status>>

  // Transaction operations
  createTransfer: (to: string, amount: number, nonce: number, subnetId: string) => Promise<Transfer>
  discardTransaction: (signature: string, subnetId?: string) => Promise<{ success: boolean, removedFrom: string[] }>
  mineSingleTransaction: (signature: string, subnetId?: string) => Promise<{ success: boolean, txid?: string, subnet?: string, error?: string }>
  mineBatchTransactions: (signatures: string[]) => Promise<{ success: boolean, results: Record<string, any> }>
}

export type BlockchainSlice = BlockchainState & BlockchainActions

export function useBlockchainSlice(signer: string | null = null): BlockchainSlice {
  // Initialize state
  const [status, setStatus] = useState<Record<string, Status> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Status fetching
  const refreshStatus = async (): Promise<Record<string, Status>> => {
    setIsLoading(true);
    setError(null);

    try {
      const statusData = await sendMessage<Record<string, Status>>("getStatus");
      setStatus(statusData);
      return statusData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch status";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Note: Signer is now managed by the wallet slice

  // Asset operations
  const getAssetBalances = async (address?: string): Promise<Record<string, number>> => {
    setIsLoading(true);
    setError(null);

    try {
      // Get balances from all subnets
      const subnetBalances = await sendMessage<Record<string, number>>("getBalance", { address: address || signer });

      // Convert to asset balances using the assets mapping
      const assetBalances: Record<string, number> = {};

      // Map each asset to its corresponding subnet balance
      for (const asset of assets) {
        // Find the subnet balance for this asset's subnet
        const balance = subnetBalances[asset.subnet] || 0;
        assetBalances[asset.id] = balance;
      }

      return assetBalances;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get asset balances";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  // Balance operations
  const getBalance = async (address: string): Promise<Record<string, number>> => {
    setIsLoading(true);
    setError(null);

    try {
      return await sendMessage<Record<string, number>>("getBalance", { address });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get balance";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  const getBalances = async (): Promise<Record<string, Record<string, number>>> => {
    setIsLoading(true);
    setError(null);

    try {
      return await sendMessage<Record<string, Record<string, number>>>("getBalances");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get balances";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  const refreshBalances = async (address?: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      await sendMessage<void>("refreshBalances", { address });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to refresh balances";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Token operations
  const deposit = async (amount: number, subnetId: string): Promise<TransactionResult> => {
    setIsLoading(true);
    setError(null);

    try {
      return await sendMessage<TransactionResult>("deposit", { amount, subnetId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to deposit";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  const withdraw = async (amount: number, subnetId: string): Promise<TransactionResult> => {
    setIsLoading(true);
    setError(null);

    try {
      return await sendMessage<TransactionResult>("withdraw", { amount, subnetId });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to withdraw";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  // Transaction operations
  const createTransfer = async (to: string, amount: number, nonce: number, subnetId: string): Promise<Transfer> => {
    setIsLoading(true);
    setError(null);

    if (!signer) {
      setError("No signer set");
      setIsLoading(false);
      throw new Error("No signer set");
    }

    try {
      const result = await sendMessage<{ transaction: Transfer }>("createTransferTx", {
        to,
        amount,
        nonce,
        signer,
        subnetId
      });
      return result.transaction;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create transfer";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Discard a transaction from the mempool by its signature
   * @param signature The transaction signature to discard
   * @param subnetId Optional: specific subnet ID to discard from (if not provided, tries all subnets)
   * @returns Information about successful discard operation
   */
  const discardTransaction = async (signature: string, subnetId?: string): Promise<{ success: boolean, removedFrom: string[] }> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<{ success: boolean, removedFrom: string[] }>('discardTransaction', {
        signature,
        subnetId
      });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to discard transaction";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Mine a single transaction
   * @param signature The signature of the transaction to mine
   * @param subnetId Optional subnet ID to mine from
   * @returns Mining result
   */
  const mineSingleTransaction = async (signature: string, subnetId: string): Promise<{
    success: boolean;
    txid?: string;
    subnet?: string;
    error?: string;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<any>('mineSingleTransaction', { signature, subnetId });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to mine transaction";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Mine a batch of transactions
   * @param signatures Array of transaction signatures to mine
   * @returns Mining results by subnet
   */
  const mineBatchTransactions = async (signatures: string[]): Promise<{
    success: boolean;
    results: Record<string, any>;
  }> => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await sendMessage<any>('mineBatchTransactions', {
        signatures
      });
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to mine batch transactions";
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    // State
    status,
    isLoading,
    error,

    // Subnet Actions
    getAssetBalances,
    getBalance,
    getBalances,
    deposit,
    withdraw,
    refreshBalances,
    refreshStatus,

    // Transaction Actions
    createTransfer,
    discardTransaction,
    mineSingleTransaction,
    mineBatchTransactions
  }
}