/**
 * Service for executing signed messages through the API
 */
import { request } from "@stacks/connect";
import {
    bufferCV,
    stringAsciiCV,
    uintCV,
    principalCV,
    contractPrincipalCV,
    noneCV,
    tupleCV,
    ClarityValue,
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
export const HopSchema = z.object({
    vault: z.string().includes('.').min(3), // Basic validation SP...ADDR.CONTRACT
    opcode: z.string().length(2).optional(), // Optional hex string (0x00 or 0x01)
    signature: z.string().length(130).optional(), // Optional hex string 0x + 65 bytes * 2 hex chars
    uuid: z.string().max(36).optional(),
});

export const ApiPayloadSchema = z.object({
    numHops: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    amount: z.string().regex(/^[1-9][0-9]*$/, "Amount must be a positive integer string"),
    recipient: z.string().min(3).regex(/^[SPST].*/, "Invalid principal format"), // Basic principal validation
    hops: z.array(HopSchema).min(1).max(3),
});

type ValidatedPayload = z.infer<typeof ApiPayloadSchema>;

// --- Utility Function for Preparing Transaction Args ---
export function prepareMultihopTxArgs(payload: ValidatedPayload): { functionName: string, functionArgs: ClarityValue[] } {
    const { numHops, amount: amountString, recipient, hops } = payload;

    // --- Convert Frontend Data to Clarity Values ---
    const amountCV = uintCV(BigInt(amountString));
    const recipientCV = principalCV(recipient);

    const formatHopForApi = (hopData: z.infer<typeof HopSchema>, index: number): ClarityValue => {
        const [vaultAddr, vaultName] = hopData.vault.split('.');
        const vaultTraitCV = contractPrincipalCV(vaultAddr, vaultName);
        const opcodeCV = hopData.opcode
            ? bufferFromHex(hopData.opcode) // Assuming opcode is hex without 0x prefix
            : noneCV();

        if (index === 0 && numHops > 0) {
            // Hop 1 requires signature and uuid from payload
            if (!hopData.signature || !hopData.uuid) {
                throw new Error("Internal Server Error: Missing signature/uuid for Hop 1 during CV construction.");
            }
            const signatureCV = bufferFromHex(hopData.signature); // Assuming signature is hex without 0x prefix
            const uuidCV = stringAsciiCV(hopData.uuid);
            return tupleCV({
                vault: vaultTraitCV,
                opcode: opcodeCV,
                signature: signatureCV,
                uuid: uuidCV
            });
        } else {
            // Subsequent hops only need vault and opcode
            return tupleCV({
                vault: vaultTraitCV,
                opcode: opcodeCV
            });
        }
    };

    const hopCVs = hops.map(formatHopForApi);
    console.log("Util: Hop CVs:", JSON.stringify(hopCVs, null, 2));

    // --- Select Function and Args ---
    let functionName = '';
    let functionArgs: ClarityValue[] = [];

    if (numHops === 1) {
        functionName = 'x-swap-1';
        functionArgs = [amountCV, hopCVs[0], recipientCV];
    } else if (numHops === 2) {
        functionName = 'x-swap-2';
        functionArgs = [amountCV, hopCVs[0], hopCVs[1], recipientCV];
    } else if (numHops === 3) {
        functionName = 'x-swap-3';
        functionArgs = [amountCV, hopCVs[0], hopCVs[1], hopCVs[2], recipientCV];
    } else {
        throw new Error("Invalid number of hops after validation.");
    }

    console.log("Util: Function Args:", functionArgs);

    return { functionName, functionArgs };
}