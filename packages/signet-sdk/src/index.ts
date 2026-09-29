/**
 * Signet SDK - Lightweight messaging API for Signet extension communication
 */

// Export the core messaging system
import { MessageType, request, send } from './messaging';

// Export the core messaging system
export {
    send,
    request,
    respond,
    subscribe,
    cleanup,
    MessageType
} from './messaging';
export type { Message } from './messaging';

// Flag to track if we've attempted initialization
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Type definitions for responses
export interface ExtensionStatusResponse {
    installed: boolean;
    version?: string;
}

// Subnet data returned by the extension
export interface SubnetData {
    subnet: string;
    signer: string;
    token: string;
    txQueue: any[];
}

// Status response is a map of subnet IDs to subnet data
export interface SignetStatusResponse {
    [subnetId: string]: SubnetData;
}

// No caching - we'll check the extension status each time
// This will help us debug any issues with duplicate checks

/**
 * Helper function to check if the Signet extension is installed
 * This should trigger a permission prompt just like getStatus
 */
export async function checkExtensionInstalled(): Promise<ExtensionStatusResponse> {
    try {

        // Try multiple times with increasing delays
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                // Use a regular request that will trigger permission flow
                const response = await request<null, ExtensionStatusResponse>({
                    type: MessageType.CHECK_EXTENSION_INSTALLED,
                    data: null
                }, 0); // 0 means no timeout - wait indefinitely for user response

                // Return the result immediately
                return response.data;
            } catch (error) {
                // Wait briefly before retry
                if (attempt < 1) await new Promise(r => setTimeout(r, 500));
            }
        }

        // If all attempts fail, assume extension is not installed
        return { installed: false };
    } catch (error) {
        // If timeout or error, assume extension is not installed
        return { installed: false };
    }
}

/**
 * Helper function to get the current status of Signet
 */
export async function getSignetStatus(): Promise<SignetStatusResponse> {
    try {
        // Directly request status without checking extension first
        // This allows us to see all permission requests
        const response = await request<null, SignetStatusResponse>({
            type: MessageType.GET_STATUS,
            data: null
        }, 0); // 0 means no timeout - wait indefinitely for user response

        return response.data;
    } catch (error) {
        // Return empty object on error
        return {};
    }
}

/**
 * Helper function to get all subnet IDs from status response
 */
export function getSubnetIds(status: SignetStatusResponse): string[] {
    return Object.keys(status);
}

/**
 * Helper function to get subnet data for a specific subnet
 */
export function getSubnetData(status: SignetStatusResponse, subnetId: string): SubnetData | null {
    return status[subnetId] || null;
}

// Define transaction-related interfaces
export interface TransactionResult {
    success: boolean;
    error?: string;
    transaction?: {
        to: string;
        amount: number;
        nonce: number;
        signature: string;
        signer: string;
        subnetId: string;
        type: string;
    };
}

// Subnet operations

/**
 * Get balance for a specific subnet and address
 * @param subnetId The subnet ID to get balance for
 * @param address Optional address to check balance for (uses current signer if not provided)
 */
export async function getBalance(subnetId: string, address?: string): Promise<Record<string, number>> {
    try {
        const response = await request<{ subnet: string, address?: string }, Record<string, number>>({
            type: MessageType.GET_BALANCE,
            data: {
                subnet: subnetId,
                address
            }
        });

        return response.data;
    } catch (error) {
        console.error('Failed to get balance:', error);
        return {};
    }
}

/**
 * Get all balances across all subnets
 * @returns A map of subnet IDs to balance records
 */
export async function getBalances(): Promise<Record<string, Record<string, number>>> {
    try {
        const response = await request<null, Record<string, Record<string, number>>>({
            type: MessageType.GET_BALANCES,
            data: null
        });

        return response.data;
    } catch (error) {
        console.error('Failed to get balances:', error);
        return {};
    }
}

/**
 * Create and execute a transfer transaction
 */
export async function createTransfer(params: {
    subnetId: string;
    to: string;
    amount: number;
    nonce: number;
}): Promise<TransactionResult> {
    try {
        const response = await request<{
            subnetId: string;
            to: string;
            amount: number;
            nonce: number;
        }, TransactionResult>({
            type: MessageType.CREATE_TRANSFER_TX,
            data: params
        });

        return response.data;
    } catch (error) {
        console.error('Failed to create transfer:', error);
        return { success: false };
    }
}

/**
 * Signature request for a prediction transaction
 */
export async function signPrediction(data: any): Promise<any> {
    try {
        const response = await request<any, any>({ type: MessageType.SIGN_PREDICTION, data });
        return response.data;
    } catch (error) {
        console.error('Failed to create prediction:', error);
        return { success: false };
    }
}

/**
 * Signature request for a prediction winnings claim transaction
 */
export async function claimRewards(data: any): Promise<any> {
    try {
        const response = await request<any, any>({ type: MessageType.CLAIM_REWARDS, data });
        return response.data;
    } catch (error) {
        console.error('Failed to claim rewards:', error);
        return { success: false };
    }
}

/**
 * Search the mempool for transactions matching given criteria
 * 
 * @param criteria Object with search criteria like nonce, signer, type, etc.
 * @param subnetId Optional: specific subnet ID to search in
 * @returns Array of matching transactions (with signatures masked)
 */
export async function searchMempool(
    criteria: {
        nonce?: number;
        signer?: string;
        type?: string;
        to?: string;
        marketId?: number;
        outcomeId?: number;
        [key: string]: any;
    },
    subnetId?: string
): Promise<{
    success: boolean;
    transactions: any[];
    error?: string;
}> {
    try {
        const response = await request<{
            criteria: Record<string, any>;
            subnetId?: string;
        }, any>({
            type: MessageType.SEARCH_MEMPOOL,
            data: { criteria, subnetId }
        });

        return response.data;
    } catch (error) {
        console.error('Failed to search mempool:', error);
        return {
            success: false,
            transactions: [],
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Interface for token subnet deployment parameters
 */
export interface TokenSubnetParams {
    tokenContract: string;  // Original token contract ID to wrap
    versionName: string;    // Subnet name (lowercase, no spaces)
    versionNumber: string;  // Version like v1, rc1
    batchSize: number;      // Max operations per batch
    description?: string;   // Optional description
}

/**
 * Interface for deployment results
 */
export interface DeploymentResult {
    success: boolean;
    error?: string;
    txId?: string;
    contractId?: string;
}

/**
 * Deploy a token subnet wrapper contract
 * @param params The subnet parameters
 * @returns A promise resolving to the deployment result
 */
export async function deployTokenSubnet(params: TokenSubnetParams): Promise<DeploymentResult> {
    try {
        const response = await request<TokenSubnetParams, DeploymentResult>({
            type: MessageType.DEPLOY_TOKEN_SUBNET,
            data: params
        }, 0); // No timeout - wait for user confirmation

        return response.data;
    } catch (error) {
        console.error('Failed to deploy token subnet:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Generate subnet wrapper contract code without deploying
 * Useful for previewing code before deployment
 */
export async function generateSubnetCode(params: TokenSubnetParams): Promise<any> {
    try {
        const response = await request<TokenSubnetParams, any>({
            type: MessageType.GENERATE_SUBNET_CODE,
            data: params
        });
        console.log(response)

        return response.data;
    } catch (error) {
        console.error('Failed to generate subnet code:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Request custody of a transaction
 * This transfers control of a transaction to the requesting app
 * The transaction will be removed from the wallet's pending transactions
 * 
 * @param criteria Object with criteria to identify the transaction (nonce, signer, etc.)
 * @param subnetId Optional: specific subnet ID if known
 * @returns Object containing the transaction data and custody transfer result
 */
export async function requestTransactionCustody(
    criteria: {
        nonce?: number;
        signer?: string;
        type?: string;
        to?: string;
        marketId?: number;
        outcomeId?: number;
        signature?: string;
        [key: string]: any;
    },
    subnetId?: string
): Promise<{
    success: boolean;
    transaction?: any;
    discardedFrom?: string[];
    error?: string;
}> {
    try {
        const response = await request<{
            criteria: Record<string, any>;
            subnetId?: string;
        }, any>({
            type: MessageType.REQUEST_TRANSACTION_CUSTODY,
            data: { criteria, subnetId }
        });

        return response.data;
    } catch (error) {
        console.error('Failed to request transaction custody:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Interface for Dexterity Vault
 */
export interface DexterityVault {
    contractId: string;
    [key: string]: any;
}

/**
 * Interface for Dexterity Opcode
 */
export interface DexterityOpcode {
    code: number;
    [key: string]: any;
}

/**
 * Interface for Dexterity Hop
 */
export interface DexterityHop {
    vault: DexterityVault;
    opcode: DexterityOpcode;
    [key: string]: any;
}

/**
 * Interface for Dexterity Route
 */
export interface DexterityRoute {
    hops: DexterityHop[];
    [key: string]: any;
}

/**
 * Interface for Dexterity swap parameters
 */
export interface ExecuteSwapParams {
    route: DexterityRoute;
    amount: number;
    options?: {
        disablePostConditions?: boolean;
        sponsored?: boolean;
        [key: string]: any;
    };
}

/**
 * Interface for Dexterity swap response
 */
export interface ExecuteSwapResponse {
    success: boolean;
    txId?: string;
    error?: string;
}

/**
 * Execute a Dexterity swap via the Signet extension
 * @param params The swap parameters
 * @returns A promise resolving to the swap response
 */
export async function executeDexSwap(params: ExecuteSwapParams): Promise<ExecuteSwapResponse> {
    try {
        const response = await request<ExecuteSwapParams, ExecuteSwapResponse>({
            type: MessageType.EXECUTE_DEX_SWAP,
            data: params
        }, 0); // No timeout - wait for user confirmation

        return response.data;
    } catch (error) {
        console.error('Failed to execute Dexterity swap:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}