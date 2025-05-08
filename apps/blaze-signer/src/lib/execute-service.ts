/**
 * Service for executing signed messages through the API
 */
import { request } from "@stacks/connect";
import {
    stringAsciiCV,
    uintCV,
    principalCV,
    contractPrincipalCV,
    tupleCV,
    ClarityValue,
    PostCondition,
    Pc,
} from "@stacks/transactions";
import { bufferFromHex } from "@stacks/transactions/dist/cl";
import { z } from "zod";

interface ExecuteMessageParams {
    messageType: "TRANSFER_TOKENS" | "TRANSFER_TOKENS_LTE" | "REDEEM_BEARER";
    contractId: string;
    signature: string;
    amount?: number;
    bound?: number;
    uuid: string;
    recipient?: string;
}

// Custom response type for this service
interface ExecuteResponse {
    success: boolean;
    message: string;
    uuid?: string;  // Return the UUID on successful queuing
    error?: string; // Present on failure
}

// API Success Response format from /api/execute
interface ApiExecuteSuccessResponse {
    message: string;
    uuid: string;
}

// API Error Response format (generic)
interface ApiErrorResponse {
    error: string;
}

/**
 * Sends a signed message to the API for server-side queuing
 */
export async function executeSignedMessage(params: ExecuteMessageParams): Promise<ExecuteResponse> {
    try {
        const response = await fetch('/api/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(params),
        });

        // Attempt to parse the JSON response body regardless of status code
        let responseBody: ApiExecuteSuccessResponse | ApiErrorResponse | any;
        try {
            responseBody = await response.json();
        } catch (jsonError) {
            // Handle cases where response is not valid JSON (e.g., plain text 500 error)
            throw new Error(`API error! status: ${response.status}, Response not valid JSON.`);
        }

        // Check if the API call itself was successful (status code 2xx)
        if (response.ok) {
            // Check if the response body conforms to the expected success structure
            if (responseBody && typeof responseBody.message === 'string' && typeof responseBody.uuid === 'string') {
                return {
                    success: true,
                    message: responseBody.message, // Use the message from the API
                    uuid: responseBody.uuid,       // Return the UUID
                };
            } else {
                // Successful status code but unexpected response body
                console.error("Unexpected success response format from /api/execute:", responseBody);
                throw new Error("Received unexpected success response from server.");
            }
        } else {
            // API call failed (status code 4xx or 5xx)
            let errorMessage = `API error! status: ${response.status}`;
            // Try to extract error message from the response body
            if (responseBody && typeof responseBody.error === 'string') {
                errorMessage = responseBody.error;
            }
            throw new Error(errorMessage);
        }
    } catch (error) {
        console.error('Error executing signed message:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown client-side error occurred';
        // Return the simplified error structure
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

// --- Zod Schema for Input Validation ---
export const TxSchema = z.object({
    contractAddress: z.string().min(1),
    contractName: z.string(),
    functionName: z.string(),
    functionArgs: z.array(z.any()),
    postConditions: z.array(z.any()),
});

export const ApiPayloadSchema = z.object({
    tx: TxSchema,
    signature: z.string().length(130),
    uuid: z.string().max(36),
});

type ValidatedPayload = z.infer<typeof ApiPayloadSchema>;

// prepareMultihopTxArgs deprecated – full tx config is now passed from client