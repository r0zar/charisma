import { Subnet } from './subnet';
import { WELSH, PREDICTIONS } from './constants';
import type { TransactionRequest, TransactionResult } from './types';
import type { Status } from '~shared/context/types';

/**
 * SubnetRegistry - Manages multiple subnet instances
 * Provides a unified interface for operations across different subnet contracts
 */
export class SubnetRegistry {
  private subnets: Map<string, Subnet> = new Map();
  private _signer: string = '';

  constructor() {
    // Initialize subnet instances for each supported contract
    this.initializeSubnets();
  }

  /**
   * Initialize all supported subnet instances
   */
  private initializeSubnets(): void {
    // Create Welsh subnet
    const welshSubnet = new Subnet(WELSH);
    this.subnets.set(WELSH, welshSubnet);

    // Create Predictions subnet
    const predictionsSubnet = new Subnet(PREDICTIONS);
    this.subnets.set(PREDICTIONS, predictionsSubnet);
  }

  /**
   * Get all subnet statuses
   */
  public getStatus(): Record<string, Status> {
    const statuses: Record<string, Status> = {};

    for (const [contractId, subnet] of this.subnets.entries()) {
      statuses[contractId] = subnet.getStatus();
    }

    return statuses;
  }

  /**
   * Set signer address for all subnets
   */
  set signer(address: string) {
    // Only update if the address is different to avoid unnecessary updates
    if (this._signer !== address) {
      console.log(`Updating signer from ${this._signer} to ${address}`);
      this._signer = address;
      // Update signer for all subnets
      for (const subnet of this.subnets.values()) {
        subnet.signer = address;
      }
    }
  }

  /**
   * Get current signer address
   */
  get signer(): string {
    return this._signer;
  }

  /**
   * Process a transaction request on the appropriate subnet
   */
  public async processTxRequest(txRequest: TransactionRequest): Promise<void> {
    // If subnet is specified, use that specific subnet
    if (this.subnets.has(txRequest.subnetId)) {
      await this.subnets.get(txRequest.subnetId).processTxRequest(txRequest);
      return;
    }

    throw new Error(`Subnet can not process transaction type: ${txRequest.type}`);
  }

  /**
   * Get balance for a specific address across all subnets
   */
  public async getBalance(address: string): Promise<Record<string, number>> {
    const balances: Record<string, number> = {};
    const userAddress = address || this._signer;

    if (!userAddress) {
      throw new Error('No address provided and no signer set');
    }

    for (const [contractId, subnet] of this.subnets.entries()) {
      await subnet.refreshBalances(userAddress)
      if (subnet.canProcessTransaction({ type: 'TRANSFER' } as any)) {
        balances[contractId] = await subnet.getBalance(userAddress)
      }
    }

    return balances;
  }

  /**
   * Get all balances across all subnets
   */
  public async getBalances(): Promise<Record<string, Record<string, number>>> {
    const allBalances: Record<string, Record<string, number>> = {};

    for (const [contractId, subnet] of this.subnets.entries()) {
      allBalances[contractId] = await subnet.getBalances();
    }

    return allBalances;
  }

  /**
   * Deposit tokens to a specific subnet
   */
  public async deposit(amount: number, subnetId: string): Promise<TransactionResult> {
    if (!this.subnets.has(subnetId)) {
      throw new Error(`Subnet not found: ${subnetId}`);
    }

    return await this.subnets.get(subnetId).deposit(amount);
  }

  /**
   * Withdraw tokens from a specific subnet
   */
  public async withdraw(amount: number, subnetId: string): Promise<TransactionResult> {
    if (!this.subnets.has(subnetId)) {
      throw new Error(`Subnet not found: ${subnetId}`);
    }

    return await this.subnets.get(subnetId).withdraw(amount);
  }

  /**
   * Mine a single transaction by its signature
   * @param signature The signature of the transaction to mine
   * @param subnetId Optional: specific subnet ID to mine from (if not provided, will try all subnets)
   * @returns Object with result of the mining operation
   */
  public async mineSingleTransaction(signature: string, subnetId?: string): Promise<{
    success: boolean;
    txid?: string;
    subnet?: string;
    error?: string;
  }> {
    // If a specific subnet is provided, only try that one
    if (subnetId && this.subnets.has(subnetId)) {
      try {
        const result = await this.subnets.get(subnetId).mineSingleTransaction(signature);
        return {
          success: true,
          txid: result.txid,
          subnet: subnetId
        };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          subnet: subnetId
        };
      }
    } else {
      // Try all subnets until we find the transaction
      for (const [id, subnet] of this.subnets.entries()) {
        try {
          const result = await subnet.mineSingleTransaction(signature);
          return {
            success: true,
            txid: result.txid,
            subnet: id
          };
        } catch (error) {
          // If the error is "transaction not found", continue to the next subnet
          if (!error.message.includes('not found')) {
            return {
              success: false,
              error: error.message,
              subnet: id
            };
          }
          // Otherwise, continue to next subnet
        }
      }

      // If we get here, the transaction wasn't found in any subnet
      return {
        success: false,
        error: `Transaction with signature ${signature} not found in any subnet`
      };
    }
  }

  /**
   * Mine selected transactions in batch 
   * @param signatures Array of transaction signatures to mine
   * @returns Object with results of the mining operations by subnet
   */
  public async mineBatchTransactions(signatures: string[]): Promise<{
    success: boolean;
    results: Record<string, {
      success: boolean;
      txid?: string;
      error?: string;
      count: number;
    }>;
  }> {
    if (!signatures || signatures.length === 0) {
      return {
        success: false,
        results: {}
      };
    }

    const results: Record<string, {
      success: boolean;
      txid?: string;
      error?: string;
      count: number; // Number of transactions mined in this subnet
    }> = {};

    // Group signatures by subnet
    const signaturesBySubnet: Record<string, string[]> = {};

    // First, try to find each transaction in a subnet
    for (const signature of signatures) {
      let found = false;

      // Look in each subnet for this transaction
      for (const [subnetId, subnet] of this.subnets.entries()) {
        const tx = subnet.mempool.findTransactionBySignature(signature);
        if (tx) {
          // Add to the appropriate group
          if (!signaturesBySubnet[subnetId]) {
            signaturesBySubnet[subnetId] = [];
          }
          signaturesBySubnet[subnetId].push(signature);
          found = true;
          break; // Move to next signature once found
        }
      }

      if (!found) {
        console.warn(`Transaction with signature ${signature} not found in any subnet`);
      }
    }

    // Now mine transactions by subnet
    for (const [subnetId, sigs] of Object.entries(signaturesBySubnet)) {
      if (sigs.length === 0) continue;

      try {
        // For now, we'll mine each transaction individually within a subnet
        // A future optimization could batch transactions of the same type
        for (const signature of sigs) {
          try {
            const result = await this.subnets.get(subnetId).mineSingleTransaction(signature);

            // Initialize subnet result if needed
            if (!results[subnetId]) {
              results[subnetId] = {
                success: true,
                count: 0
              };
            }

            // Mark success and increment count
            results[subnetId].success = true;
            results[subnetId].txid = result.txid; // Store the last txid
            results[subnetId].count++;

          } catch (error) {
            // Initialize subnet result if needed
            if (!results[subnetId]) {
              results[subnetId] = {
                success: false,
                error: error.message,
                count: 0
              };
            } else {
              // Add error information but don't override previous successes
              results[subnetId].error = error.message;
            }
          }
        }
      } catch (error) {
        console.error(`Error batch mining transactions for subnet ${subnetId}:`, error);
        results[subnetId] = {
          success: false,
          error: error.message,
          count: 0
        };
      }
    }

    // Determine overall success - at least one transaction mined successfully
    const overallSuccess = Object.values(results).some(result => result.success && result.count > 0);

    return {
      success: overallSuccess,
      results
    };
  }

  /**
   * Generate a signature for a message using the appropriate subnet
   */
  public async generateTransferSignature(message: any, subnetId: string): Promise<string> {
    if (!this.subnets.has(subnetId)) {
      throw new Error(`Subnet not found: ${subnetId}`);
    }

    return await this.subnets.get(subnetId).generateTransferSignature(message);
  }

  /**
   * Generate a signature for a message using the appropriate subnet
   */
  public async generateClaimSignature(message: any, subnetId: string): Promise<string> {
    if (!this.subnets.has(subnetId)) {
      throw new Error(`Subnet not found: ${subnetId}`);
    }

    return await this.subnets.get(subnetId).generateClaimSignature(message);
  }

  /**
   * Refresh balances for an address across all subnets
   */
  public async refreshBalances(address?: string): Promise<void> {
    for (const subnet of this.subnets.values()) {
      await subnet.refreshBalances(address);
    }
  }

  /**
   * Get all subnet identifiers
   */
  public getSubnetIds(): string[] {
    return Array.from(this.subnets.keys());
  }

  /**
   * Get a specific subnet instance
   */
  public getSubnet(subnetId: string): Subnet {
    return this.subnets.get(subnetId);
  }

  /**
   * Discard a transaction from all subnets by its signature
   * @param signature The signature of the transaction to discard
   * @param subnetId Optional: specific subnet ID to discard from (if not provided, will try all subnets)
   * @returns Object with success status and details of which subnets the transaction was removed from
   */
  public discardTransaction(signature: string, subnetId?: string): {
    success: boolean;
    removedFrom: string[]
  } {
    const removedFrom: string[] = [];

    // If a specific subnet is provided, only try that one
    if (subnetId && this.subnets.has(subnetId)) {
      const subnet = this.subnets.get(subnetId);
      if (subnet.discardTransaction(signature)) {
        removedFrom.push(subnetId);
      }
    } else {
      // Try all subnets
      for (const [id, subnet] of this.subnets.entries()) {
        if (subnet.discardTransaction(signature)) {
          removedFrom.push(id);
        }
      }
    }

    return {
      success: removedFrom.length > 0,
      removedFrom
    };
  }
}