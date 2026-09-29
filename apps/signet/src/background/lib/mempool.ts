import { Cl } from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';
import { Transaction } from './transaction';
import { TransactionType } from './constants';

/**
 * Manages unconfirmed transactions waiting to be mined into blocks
 * Acts as a memory pool (mempool) for transactions before they are written to the blockchain
 */
export class Mempool {
    private queue: Transaction[] = [];

    constructor(
        private subnet: string,
        private balances: Map<string, number>,
        private fetchContractBalance: (user: string) => Promise<number>
    ) { }

    /**
     * Get the current transaction queue
     */
    getQueue(): Transaction[] {
        return this.queue;
    }

    /**
     * Clear the transaction queue
     */
    clearQueue(): void {
        this.queue = [];
    }

    /**
     * Add a transaction to the mempool
     */
    addTransaction(transaction: Transaction): void {
        this.queue.push(transaction);
    }

    /**
     * Get all users affected by transactions in the mempool
     */
    getAffectedUsers(): Set<string> {
        const users = new Set<string>();
        this.queue.forEach(tx => {
            tx.affectedUsers.forEach(user => users.add(user));
        });
        return users;
    }

    /**
     * Calculate pending balance changes for all users from transactions in the mempool
     * @returns Map of user addresses to their pending balance changes
     */
    getPendingBalanceChanges(): Map<string, number> {
        const pendingChanges = new Map<string, number>();

        // Apply changes from each transaction
        this.queue.forEach(tx => {
            const changes = tx.getBalanceChanges();

            // Add each change to the pending changes map
            changes.forEach((change, user) => {
                const currentChange = pendingChanges.get(user) || 0;
                pendingChanges.set(user, currentChange + change);
            });
        });

        return pendingChanges;
    }

    /**
     * Calculate total balances including pending changes from the mempool
     * @returns Map of user addresses to their total balances
     */
    getTotalBalances(): Map<string, number> {
        const totalBalances = new Map(this.balances);
        const pendingChanges = this.getPendingBalanceChanges();

        // Apply pending changes to confirmed balances
        pendingChanges.forEach((change, user) => {
            const confirmedBalance = totalBalances.get(user) || 0;
            totalBalances.set(user, confirmedBalance + change);
        });

        return totalBalances;
    }

    /**
     * Get transactions of a specific type (up to maxBatchSize)
     * @param type Transaction type to filter
     * @param maxBatchSize Maximum number of transactions to include
     * @returns Array of transactions of the specified type
     */
    getBatchByType(type: TransactionType, maxBatchSize: number = 200): Transaction[] {
        return this.queue
            .filter(tx => tx.type === type)
            .slice(0, maxBatchSize);
    }

    /**
     * Group transactions by type
     * @returns Map of transaction types to arrays of transactions
     */
    getTransactionsByType(): Map<TransactionType, Transaction[]> {
        const txByType = new Map<TransactionType, Transaction[]>();

        this.queue.forEach(tx => {
            const txs = txByType.get(tx.type) || [];
            txs.push(tx);
            txByType.set(tx.type, txs);
        });

        return txByType;
    }

    /**
     * Remove transactions from the queue
     * @param transactions Array of transactions to remove
     */
    removeTransactions(transactions: Transaction[]): void {
        const txSet = new Set(transactions);
        this.queue = this.queue.filter(tx => !txSet.has(tx));
    }

    /**
     * Discard a transaction from the queue by its signature
     * @param signature The transaction signature to find and remove
     * @returns True if the transaction was found and removed, false otherwise
     */
    discardTransactionBySignature(signature: string): boolean {
        const initialLength = this.queue.length;

        // Filter out the transaction with the matching signature
        this.queue = this.queue.filter(tx => {
            return tx.data.signature !== signature;
        });

        // Return true if at least one transaction was removed
        return this.queue.length < initialLength;
    }

    /**
     * Get the balance for a specific user, including pending transactions
     * @param user User address
     * @returns Balance for the user
     */
    async getBalance(user: string): Promise<number> {
        // Ensure the user's on-chain balance is loaded
        if (!this.balances.has(user)) {
            await this.fetchContractBalance(user);
        }

        // Get confirmed balance
        const confirmedBalance = this.balances.get(user) || 0;

        // Calculate pending balance changes from the mempool
        const pendingChanges = this.getPendingBalanceChanges().get(user) || 0;

        return confirmedBalance + pendingChanges;
    }

    /**
     * Build batch transaction options for a set of transactions
     * @param txsToMine Array of transactions to include in the batch
     * @param txType Type of transactions being processed
     * @param contractAddress Contract address
     * @param contractName Contract name
     * @returns Transaction options for the batch operation
     */
    buildBatchTxOptions(
        txsToMine: Transaction[],
        txType: TransactionType,
        contractAddress: string,
        contractName: string,
    ): any {
        // Build the clarity operations for the batch
        const clarityOperations = txsToMine.map(tx => tx.toClarityValue());

        // Calculate the fee based on the number of transactions
        const fee = 400 * txsToMine.length;

        // Build transaction options
        return {
            contractAddress,
            contractName,
            functionName: `batch-${txType}`,
            functionArgs: [Cl.list(clarityOperations)],
            network: STACKS_MAINNET,
            fee
        };
    }

    /**
     * Build transaction options for mining a single transaction
     * Uses the direct 'signed-' function instead of batch processing
     * @param tx Transaction to mine
     * @param contractAddress Contract address
     * @param contractName Contract name
     * @returns Transaction options for the single transaction operation
     */
    buildSingleTxOptions(
        tx: Transaction,
        contractAddress: string,
        contractName: string,
    ): any {
        // Get the clarity value for a single transaction
        const clarityValue = tx.toClarityValue().value;

        // Determine the function name based on transaction type
        const functionName = `signed-${tx.type}`;

        // Extract the function arguments based on transaction type
        let functionArgs;
        switch (tx.type) {
            case TransactionType.TRANSFER:
                functionArgs = [
                    clarityValue.signet,              // signet tuple (signature, nonce)
                    clarityValue.to,                  // recipient principal
                    clarityValue.amount               // amount uint
                ];
                break;
            case TransactionType.PREDICT:
                functionArgs = [
                    clarityValue.signet,              // signet tuple (signature, nonce)
                    clarityValue.market_id,           // market ID uint 
                    clarityValue.outcome_id,          // outcome ID uint
                    clarityValue.amount               // amount uint
                ];
                break;
            case TransactionType.CLAIM_REWARD:
                functionArgs = [
                    clarityValue.signet,              // signet tuple (signature, nonce)
                    clarityValue.receipt_id           // receipt ID uint
                ];
                break;
            default:
                throw new Error(`Unsupported transaction type for single mining: ${tx.type}`);
        }

        // Build transaction options
        return {
            contractAddress,
            contractName,
            functionName,
            functionArgs,
            network: STACKS_MAINNET,
            fee: 400 // Base fee for a single transaction
        };
    }

    /**
     * Find a transaction by its signature
     * @param signature Transaction signature to look for
     * @returns The transaction if found, or undefined if not found
     */
    findTransactionBySignature(signature: string): Transaction | undefined {
        return this.queue.find(tx => tx.data.signature === signature);
    }
}