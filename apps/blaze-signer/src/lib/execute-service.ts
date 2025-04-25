/**
 * Service for executing signed messages through the API
 */
import { request } from "@stacks/connect";
import {
    bufferCV,
    stringAsciiCV,
    uintCV,
    principalCV,
    TxBroadcastResult,
    TxBroadcastResultOk,
} from "@stacks/transactions";

interface ExecuteMessageParams {
    messageType: "TRANSFER_TOKENS" | "TRANSFER_TOKENS_LTE" | "REDEEM_BEARER";
    contractId: string;
    signature: string;
    amount?: number;
    bound?: number;
    uuid: string;
    recipient?: string;
}

// Simplified custom response type
interface ExecuteResponse {
    success: boolean;
    message: string;
    txid?: string; // Present on success
    error?: string; // Present on failure
    reason?: string; // Present on failure
    reason_data?: any; // Present on failure
}

/**
 * Sends a signed message to the API for server-side execution
 */
export async function executeSignedMessage(params: ExecuteMessageParams): Promise<ExecuteResponse> {
    try {
        // Call API to handle the execution on the server-side
        const response = await fetch('/api/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });

        // Get the raw broadcast response from the API
        const broadcastResult: TxBroadcastResult = await response.json();

        // Check if the API itself returned an error (e.g., 500 status)
        if (!response.ok) {
            // If the response body contains an error message from the API
            if ('error' in broadcastResult && typeof broadcastResult.error === 'string') {
                throw new Error(broadcastResult.error || `API error! status: ${response.status}`);
            } else {
                // Otherwise, it's a generic HTTP error
                throw new Error(`API error! status: ${response.status}`);
            }
        }

        // Check the broadcast result for success (presence of txid)
        if (broadcastResult.txid) {
            return {
                success: true,
                message: "Transaction broadcasted successfully",
                txid: broadcastResult.txid,
            };
        } else {
            // Handle broadcast failure - rely on property existence
            const errorResult = broadcastResult as any; // Use any to access potential error properties
            const errorMessage = errorResult.error || 'Unknown broadcast error';
            const reason = errorResult.reason || 'No reason provided';
            const reasonData = errorResult.reason_data ? JSON.stringify(errorResult.reason_data) : '';
            const fullError = `Broadcast failed: ${errorMessage} - ${reason} ${reasonData}`.trim();
            console.error("Broadcast Error Details:", errorResult);
            return {
                success: false,
                message: fullError,
                error: errorMessage,
                reason: reason,
                reason_data: errorResult.reason_data,
            };
        }
    } catch (error) {
        console.error('Error executing signed message:', error);
        // Return a structured error response for client-side handling
        const errorMessage = error instanceof Error ? error.message : 'Unknown client-side error occurred';
        return {
            success: false,
            message: errorMessage,
            error: errorMessage
        };
    }
}

/**
 * Helper function for executing a token transfer
 */
export async function executeTransfer({
    contractId,
    signature,
    amount,
    recipient,
    uuid
}: {
    contractId: string;
    signature: string;
    amount: number;
    recipient: string;
    uuid: string;
}): Promise<ExecuteResponse> {
    return executeSignedMessage({
        messageType: "TRANSFER_TOKENS",
        contractId,
        signature,
        amount,
        recipient,
        uuid
    });
}

/**
 * Helper function for executing a bounded token transfer
 */
export async function executeBoundedTransfer({
    contractId,
    signature,
    bound,
    recipient,
    uuid
}: {
    contractId: string;
    signature: string;
    bound: number;
    recipient: string;
    uuid: string;
}): Promise<ExecuteResponse> {
    return executeSignedMessage({
        messageType: "TRANSFER_TOKENS_LTE",
        contractId,
        signature,
        bound,
        recipient,
        uuid
    });
}

/**
 * Helper function for executing a bearer redemption
 */
export async function executeRedeem({
    contractId,
    signature,
    amount,
    uuid,
    recipient
}: {
    contractId: string;
    signature: string;
    amount: number;
    uuid: string;
    recipient?: string;
}): Promise<ExecuteResponse> {
    return executeSignedMessage({
        messageType: "REDEEM_BEARER",
        contractId,
        signature,
        amount,
        recipient,
        uuid
    });
} 