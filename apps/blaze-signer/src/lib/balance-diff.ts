import {
    cvToValue,
    principalCV,
    ClarityValue,
    deserializeCV,
    cvToHex,
    hexToCV,
    bufferCV,
    stringAsciiCV,
    uintCV,
    optionalCVOf,
    noneCV,
    ClarityType,
    validateStacksAddress
} from "@stacks/transactions";
import { apiClient } from "@/lib/stacks-api-client";
import type { QueuedTxIntent } from "@/lib/types";
import { bufferFromHex } from "@stacks/transactions/dist/cl";

// Signer contract identifier (replace with actual constant import if available)
// Example: import { BLAZE_SIGNER_CONTRACT } from "../constants/contracts";
const BLAZE_SIGNER_CONTRACT_ID = process.env.BLAZE_SIGNER_CONTRACT_ID || "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-v1";
const [BLAZE_SIGNER_ADDRESS, BLAZE_SIGNER_NAME] = BLAZE_SIGNER_CONTRACT_ID.split(".");

// --- Stacks API Client Setup (Replicated from API route for standalone use if needed, or pass client as arg) ---
// Removed client setup block
// --- End Client Setup ---

/**
 * Calculates the balance difference for a specific address based on pending messages,
 * considering both outgoing (signed by address) and incoming (sent to address) transactions.
 *
 * @param targetContractId The token contract ID (e.g., "SP...token.token-name") to filter messages for.
 * @param targetAddress The Stacks address to calculate the balance diff for.
 * @param pendingMessages An array of QueuedTxIntent objects from the queue.
 * @returns The calculated balance difference as a bigint.
 */
export async function calculatePendingBalanceDiff(
    targetContractId: string,
    targetAddress: string,
    pendingMessages: QueuedTxIntent[]
): Promise<bigint> {
    let balanceDiff: bigint = 0n;

    // Split targetContractId once here for efficiency
    const [targetTokenAddress] = targetContractId.split(".");

    // Iterate through the already parsed message objects
    for (const message of pendingMessages) {

        // Basic validation (already parsed, check structure)
        if (!message || typeof message !== 'object' || !message.contractId || !message.intent || !message.signature || !message.uuid) {
            console.warn("calculatePendingBalanceDiff: Skipping malformed QueuedTxIntent structure:", message);
            continue;
        }

        // Filter messages: Check if it relates to the target token contract
        if (message.contractId !== targetContractId) {
            continue;
        }

        // Filter messages: Only consider definite transfers for balance diff for now
        if (message.intent !== 'TRANSFER_TOKENS') {
            console.log(`calculatePendingBalanceDiff: Skipping message ${message.uuid} with intent ${message.intent} (only processing TRANSFER_TOKENS)`);
            continue;
        }

        // Ensure amount is valid for transfer
        const amount = message.amountOptional;
        if (amount === null || amount === undefined || amount <= 0) {
            console.warn(`calculatePendingBalanceDiff: Skipping TRANSFER_TOKENS message ${message.uuid} with invalid amount: ${amount}`);
            continue;
        }
        const valueToApply = BigInt(amount);

        // --- Recover Signer using the contract read-only function ---
        let recoveredSignerAddress: string | null = null;
        try {
            // Prepare arguments for 'recover' function
            const recoverArgs = [
                bufferFromHex(message.signature),
                principalCV(message.contractId),
                stringAsciiCV(message.intent),
                message.opcodeOptional ? optionalCVOf(bufferFromHex(message.opcodeOptional)) : noneCV(),
                message.amountOptional ? optionalCVOf(uintCV(message.amountOptional)) : noneCV(),
                message.targetOptional ? optionalCVOf(principalCV(message.targetOptional)) : noneCV(),
                stringAsciiCV(message.uuid)
            ];

            const response = await apiClient.POST(
                `/v2/contracts/call-read/${BLAZE_SIGNER_ADDRESS}/${BLAZE_SIGNER_NAME}/recover` as any,
                {
                    body: {
                        sender: BLAZE_SIGNER_ADDRESS, // Can be any valid address
                        arguments: recoverArgs.map(cvToHex), // Map args to hex
                    },
                }
            );

            if (response?.data?.okay && response?.data?.result) {
                const resultCV = hexToCV(response.data.result);
                // Check the type of the *value* within the ResponseOkCV
                if (resultCV.type === ClarityType.ResponseOk && resultCV.value.type === ClarityType.PrincipalStandard) {
                    recoveredSignerAddress = cvToValue(resultCV.value);
                    console.log(`calculatePendingBalanceDiff: Recovered signer for ${message.uuid}: ${recoveredSignerAddress}`);
                } else {
                    console.warn(`calculatePendingBalanceDiff: Recover function did not return (ok principal) for ${message.uuid}:`, cvToValue(resultCV));
                }
            } else {
                const cause = response?.data?.cause || 'Unknown API error';
                console.warn(`calculatePendingBalanceDiff: API Error recovering signer for ${message.uuid}:`, cause);
                // Decide whether to throw, continue, or skip? Skipping for now.
            }

        } catch (recoverError) {
            console.error(`calculatePendingBalanceDiff: Error calling recover function for ${message.uuid}:`, recoverError);
            // Skip message if recovery fails
            continue;
        }

        // If signer recovery failed, we cannot determine direction, skip
        if (!recoveredSignerAddress) {
            console.warn(`calculatePendingBalanceDiff: Skipping message ${message.uuid} due to failed signer recovery.`);
            continue;
        }

        // --- Calculate Diff based on Signer and Recipient ---

        // Subtract if the targetAddress signed the message (outgoing)
        if (recoveredSignerAddress === targetAddress) {
            console.log(`calculatePendingBalanceDiff: Applying negative diff (-${valueToApply}) for ${message.uuid} (signer is targetAddress)`);
            balanceDiff -= valueToApply;
        }

        // Add if the targetAddress is the recipient (incoming)
        if (message.targetOptional === targetAddress) {
            // Note: If targetAddress is both signer and recipient (self-send),
            // the previous block subtracts and this block adds, resulting in a correct net zero diff for this message.
            console.log(`calculatePendingBalanceDiff: Applying positive diff (+${valueToApply}) for ${message.uuid} (recipient is targetAddress)`);
            balanceDiff += valueToApply;
        }
    }

    console.log(`calculatePendingBalanceDiff: Final calculated diff for ${targetAddress} on ${targetContractId}: ${balanceDiff.toString()}`);
    return balanceDiff;
} 