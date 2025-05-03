import { PrincipalCV, stringAsciiCV, tupleCV } from "@stacks/transactions";
import { contractPrincipalCV, noneCV } from "@stacks/transactions";
import { principalCV } from "@stacks/transactions";
import { uintCV } from "@stacks/transactions";
import { ClarityValue } from "@stacks/transactions";
import { bufferFromHex } from "@stacks/transactions/dist/cl";
import { z } from "zod";

// Enhanced interface for queued intent
export interface QueuedTxIntent {
    signerPrincipal: PrincipalCV;  // Store the verified signer
    signature: string;
    contractId: string;
    amount: number;
    target: string;
    uuid: string;
    tokenId: string; // Store which token was voted for
}
// --- Utility Function for Preparing Transaction Args for Processing ---
export function prepareProcessTxArgs(quote: any, intent: QueuedTxIntent): { functionName: string, functionArgs: ClarityValue[] } {
    const numHops = quote.route.hops.length;

    // Prepare the hop data with signature information
    const formatHopForApi = (hop: any, index: number): ClarityValue => {
        const [vaultAddr, vaultName] = hop.vault.contractId.split('.');
        const vaultTraitCV = contractPrincipalCV(vaultAddr, vaultName);

        // Handle opcode
        const opcodeCV = hop.opcode
            ? bufferFromHex(hop.opcode.toString())
            : bufferFromHex('00'); // Default opcode if none provided

        if (index === 0) {
            // First hop needs signature and uuid from the original intent
            return tupleCV({
                vault: vaultTraitCV,
                opcode: opcodeCV,
                signature: bufferFromHex(intent.signature),
                uuid: stringAsciiCV(intent.uuid)
            });
        } else {
            // Subsequent hops only need vault and opcode from the quote
            return tupleCV({
                vault: vaultTraitCV,
                opcode: opcodeCV
            });
        }
    };

    // Create the hop clarity values
    const hopCVs = quote.route.hops.map(formatHopForApi);
    console.log("Util: Hop CVs:", JSON.stringify(hopCVs, null, 2));

    // Prepare amount and recipient
    const amountCV = uintCV(intent.amount);
    const recipientCV = intent.signerPrincipal; // Already a PrincipalCV

    let functionArgs: ClarityValue[] = [];
    const functionName = `x-swap-${numHops}`;

    // Construct function args based on number of hops
    if (numHops === 1) {
        functionArgs = [amountCV, hopCVs[0], recipientCV];
    } else if (numHops === 2) {
        functionArgs = [amountCV, hopCVs[0], hopCVs[1], recipientCV];
    } else if (numHops === 3) {
        functionArgs = [amountCV, hopCVs[0], hopCVs[1], hopCVs[2], recipientCV];
    } else {
        throw new Error("Invalid number of hops: " + numHops);
    }

    console.log("Util: Function Args:", functionArgs);

    return { functionName, functionArgs };
}