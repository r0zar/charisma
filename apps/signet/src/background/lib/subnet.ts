import { makeContractCall, broadcastTransaction, signStructuredData, fetchCallReadOnlyFunction, Cl, ClarityType } from '@stacks/transactions';
import { STACKS_MAINNET } from '@stacks/network';
import { TransactionType, WELSH, subnetTokens, txTypeContracts } from './constants';
import type {
    TransactionRequest,
    Transfer,
    Prediction,
    ClaimReward,
    TransactionResult,
    TransferMessage
} from './types';
import { Transaction } from './transaction';
import { Mempool } from './mempool';
import { buildDepositTxOptions, buildWithdrawTxOptions } from './utils';
import { createWelshDomain, createTransferMessage, createClaimRewardMessage, createWelshPredictionDomain } from './signatures';
import { getCurrentAccount } from './wallet';
import type { Status } from '~shared/context/types';

export class Subnet {
    subnet: `${string}.${string}`;
    tokenIdentifier: string;
    signer: string;
    balances: Map<string, number> = new Map();
    mempool: Mempool;

    constructor(subnetContract: `${string}.${string}` = WELSH) {
        this.signer = '';
        this.subnet = subnetContract;

        this.tokenIdentifier = subnetTokens[this.subnet as keyof typeof subnetTokens];
        if (!this.tokenIdentifier) {
            throw new Error(`No token identifier found for subnet: ${this.subnet}`);
        }

        // Initialize the mempool
        this.mempool = new Mempool(
            this.subnet,
            this.balances,
            this.fetchContractBalance.bind(this)
        );
    }

    /**
     * Check if this subnet can process the given transaction type
     */
    public canProcessTransaction(txRequest: TransactionRequest): boolean {
        // Check if this subnet processes this transaction type
        const txType = txRequest.type;
        const targetContract = txTypeContracts[txType]?.contract;

        return targetContract === this.subnet;
    }

    /**
     * Check if this subnet has any pending transactions
     */
    public hasPendingTransactions(): boolean {
        return this.mempool.getQueue().length > 0;
    }

    /**
     * Discard a transaction from the mempool by its signature
     * @param signature The signature of the transaction to discard
     * @returns True if the transaction was found and removed, false otherwise
     */
    public discardTransaction(signature: string): boolean {
        return this.mempool.discardTransactionBySignature(signature);
    }

    public getStatus(): Status {
        return {
            subnet: this.subnet,
            signer: this.signer,
            token: this.tokenIdentifier,
            txQueue: this.mempool.getQueue(),
        };
    }

    /**
     * Fetch a user's on-chain balance from the contract
     */
    async fetchContractBalance(user: string): Promise<number> {
        const [contractAddress, contractName] = this.subnet.split('.');
        try {
            const result = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: 'get-balance',
                functionArgs: [Cl.principal(user)],
                network: STACKS_MAINNET,
                senderAddress: user
            });
            const balance = result.type === ClarityType.UInt ? Number(result.value) : 0;

            // Store the confirmed balance in our Map
            this.balances.set(user, balance);

            return balance;
        } catch (error: unknown) {
            console.error('Failed to fetch contract balance:', error);
            return 0;
        }
    }

    // get all balances
    async getBalances() {
        // First, collect all unique users affected by transactions
        const usersInQueue = this.mempool.getAffectedUsers();

        // Fetch on-chain balances for all users that might not be in the balances Map
        const fetchPromises = [];
        for (const user of Array.from(usersInQueue)) {
            if (!this.balances.has(user)) {
                fetchPromises.push(this.fetchContractBalance(user));
            }
        }

        // Wait for all balance fetches to complete
        if (fetchPromises.length > 0) {
            await Promise.all(fetchPromises);
        }

        // Get total balances with pending changes applied
        const totalBalances = this.mempool.getTotalBalances();
        return Object.fromEntries(totalBalances);
    }

    /**
     * Get a user's complete balance information
     */
    async getBalance(user: string): Promise<number> {
        const address = user || this.signer;
        console.log('Getting balance for:', address);
        return this.mempool.getBalance(address);
    }

    private async executeTransaction(txOptions: any): Promise<TransactionResult> {
        // Get the active account from wallet
        const activeAccount = await getCurrentAccount();

        if (!activeAccount || !activeAccount.privateKey) {
            throw new Error('No active account or private key found');
        }

        const transaction = await makeContractCall({
            ...txOptions,
            senderKey: activeAccount.privateKey,
            network: STACKS_MAINNET,
        });

        console.log('Broadcasting transaction:', transaction);
        const response = await broadcastTransaction({
            transaction,
            network: STACKS_MAINNET,
        });

        console.log(response)
        return response
    }

    public async processTxRequest(txRequest: TransactionRequest) {
        // TODO: VALIDATE SIGNATURES

        // Create a new Transaction object and put it in the queue
        const transaction = new Transaction(txRequest);
        this.mempool.addTransaction(transaction);
    }

    /**
     * Mine a single transaction by its signature
     * @param signature The signature of the transaction to mine
     * @returns Transaction result containing the txid if successful
     * @throws Error if the transaction is not found or mining fails
     */
    public async mineSingleTransaction(signature: string): Promise<TransactionResult> {
        // Find the transaction in the mempool
        const transaction = this.mempool.findTransactionBySignature(signature);

        if (!transaction) {
            throw new Error(`Transaction with signature ${signature} not found in mempool`);
        }

        // Get the contract info for this subnet
        const [contractAddress, contractName] = this.subnet.split('.');

        if (!contractAddress || !contractName) {
            throw new Error(`Invalid contract format: ${this.subnet}`);
        }

        // Build transaction options for single transaction
        const txOptions = this.mempool.buildSingleTxOptions(
            transaction,
            contractAddress,
            contractName
        );

        try {
            // Execute the transaction
            console.log(`Mining single transaction of type ${transaction.type} with signature ${signature}`);
            const result = await this.executeTransaction(txOptions);

            // Remove the transaction from the mempool
            this.mempool.removeTransactions([transaction]);

            return result;
        } catch (error) {
            console.error(`Failed to mine transaction with signature ${signature}:`, error);
            throw error;
        }
    }

    async deposit(amount: number) {
        try {
            // Build deposit transaction options
            const txOptions = buildDepositTxOptions({
                signer: this.signer,
                subnet: this.subnet,
                amount,
            });

            // Execute the deposit transaction
            const result = await this.executeTransaction(txOptions);

            // Note: We don't refresh balance here since on-chain updates take ~30 seconds
            // Users should explicitly refresh balances when needed or wait for SSE events

            return result;
        } catch (error: unknown) {
            throw error;
        }
    }

    async withdraw(amount: number) {
        try {
            // Build withdraw transaction options
            const txOptions = buildWithdrawTxOptions({
                subnet: this.subnet,
                amount,
                signer: this.signer
            });

            // Execute the withdraw transaction
            const result = await this.executeTransaction(txOptions);

            // Note: We don't refresh balance here since on-chain updates take ~30 seconds
            // Users should explicitly refresh balances when needed or wait for SSE events

            return result;
        } catch (error: unknown) {
            throw error;
        }
    }

    async generateTransferSignature(message: TransferMessage): Promise<string> {
        // Get the active account from wallet
        const activeAccount = await getCurrentAccount();

        if (!activeAccount || !activeAccount.privateKey) {
            throw new Error('No active account or private key found');
        }

        const signature = await signStructuredData({
            domain: createWelshDomain(),
            message: createTransferMessage(message),
            privateKey: activeAccount.privateKey
        });
        return signature;
    }

    async verifyTransferSignature(data: Transfer | Prediction): Promise<boolean> {
        const [contractAddress, contractName] = this.subnet.split('.');
        try {
            // Determine recipient based on transaction type
            const recipient = data.type === TransactionType.TRANSFER
                ? (data as Transfer).to
                : this.subnet

            const amount = data.type === TransactionType.TRANSFER
                ? (data as Transfer).amount
                : (data as Prediction).amount;

            const result = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: 'verify-transfer-signer',
                functionArgs: [
                    Cl.tuple({
                        signature: Cl.bufferFromHex(data.signature),
                        nonce: Cl.uint(data.nonce)
                    }),
                    Cl.principal(recipient),
                    Cl.uint(amount)
                ],
                network: STACKS_MAINNET,
                senderAddress: this.signer
            });

            return result.type === ClarityType.ResponseOk;
        } catch (error: unknown) {
            console.error('Transfer signature verification failed:', error);
            return false;
        }
    }

    async generateClaimSignature(message: ClaimReward): Promise<string> {
        // Get the active account from wallet
        const activeAccount = await getCurrentAccount();

        if (!activeAccount || !activeAccount.privateKey) {
            throw new Error('No active account or private key found');
        }

        const signature = await signStructuredData({
            domain: createWelshPredictionDomain(),
            message: createClaimRewardMessage(message),
            privateKey: activeAccount.privateKey
        });
        return signature;
    }

    async verifyClaimSignature(claim: ClaimReward): Promise<boolean> {
        const [contractAddress, contractName] = this.subnet.split('.');
        try {
            const result = await fetchCallReadOnlyFunction({
                contractAddress,
                contractName,
                functionName: 'verify-receipt-signer',
                functionArgs: [
                    Cl.tuple({
                        signature: Cl.bufferFromHex(claim.signature),
                        nonce: Cl.uint(claim.nonce)
                    }),
                    Cl.uint(claim.receiptId)
                ],
                network: STACKS_MAINNET,
                senderAddress: this.signer
            });

            return result.type === ClarityType.ResponseOk;
        } catch (error: unknown) {
            console.error('Claim signature verification failed:', error);
            return false;
        }
    }

    async validateTransferOperation(operation: Transfer): Promise<void> {
        if (!operation.to || !operation.signature) {
            throw new Error('Invalid transfer operation: missing required fields');
        }
        if (operation.amount <= 0) {
            throw new Error('Invalid transfer operation: amount must be positive');
        }
        if (operation.nonce <= 0) {
            throw new Error('Invalid transfer operation: nonce must be positive');
        }
        // Verify signature
        const isValid = await this.verifyTransferSignature(operation);
        if (!isValid) {
            throw new Error('Invalid transfer operation: signature verification failed');
        }
    }

    /**
     * Refresh on-chain balances for a specific user or all users in the balances Map
     */
    async refreshBalances(user?: string): Promise<void> {
        if (user) {
            // Refresh for a single user
            await this.fetchContractBalance(user);
        } else {
            // Refresh for all users in the balances Map
            const refreshPromises = Array.from(this.balances.keys()).map(address =>
                this.fetchContractBalance(address)
            );

            if (refreshPromises.length > 0) {
                await Promise.all(refreshPromises);
            }
        }
    }
}