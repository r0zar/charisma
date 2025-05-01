import { NextResponse } from 'next/server';
import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    uintCV,
    principalCV,
    contractPrincipalCV,
    stringAsciiCV,
    tupleCV,
    noneCV,
    ClarityValue,
    fetchCallReadOnlyFunction,
    optionalCVOf,
    cvToValue, // Import type
} from '@stacks/transactions';
import { STACKS_MAINNET, StacksNetwork } from '@stacks/network'; // Or use config
import { z } from 'zod'; // For input validation
import { bufferFromHex } from '@stacks/transactions/dist/cl';

// TODO: Move to shared constants or config
const MULTIHOP_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc5";
const TOKEN_A_CONTRACT_ID = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6";

// --- Zod Schema for Input Validation ---
const HopSchema = z.object({
    vault: z.string().includes('.').min(3), // Basic validation SP...ADDR.CONTRACT
    opcode: z.string().length(2).optional(), // Optional hex string (0x00 or 0x01)
    signature: z.string().length(130).optional(), // Optional hex string 0x + 65 bytes * 2 hex chars
    uuid: z.string().max(36).optional(),
});

const ApiPayloadSchema = z.object({
    numHops: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    amount: z.string().regex(/^[1-9][0-9]*$/, "Amount must be a positive integer string"),
    recipient: z.string().min(3).regex(/^[SPST].*/, "Invalid principal format"), // Basic principal validation
    hops: z.array(HopSchema).min(1).max(3),
});
// --- End Zod Schema ---

export async function POST(request: Request) {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("API Error: PRIVATE_KEY environment variable not set.");
        return NextResponse.json({ error: 'Server configuration error: Missing private key' }, { status: 500 });
    }

    const network: StacksNetwork = STACKS_MAINNET; // Use configured network

    try {
        const body = await request.json();

        // Validate input shape
        const validationResult = ApiPayloadSchema.safeParse(body);
        if (!validationResult.success) {
            console.error("API Validation Error:", validationResult.error.flatten());
            return NextResponse.json({ error: 'Invalid request payload', details: validationResult.error.flatten() }, { status: 400 });
        }
        const { numHops, amount: amountString, recipient, hops } = validationResult.data;

        // Further validation/checks
        if (hops.length !== numHops) {
            return NextResponse.json({ error: `Payload validation failed: numHops (${numHops}) does not match hops array length (${hops.length})` }, { status: 400 });
        }
        if (numHops > 0 && (!hops[0].signature || !hops[0].uuid)) {
            return NextResponse.json({ error: 'Payload validation failed: Signature and UUID are required for Hop 1' }, { status: 400 });
        }

        const [multihopAddr, multihopName] = MULTIHOP_CONTRACT_ID.split('.');

        // --- Convert Frontend Data to Clarity Values ---
        const amountCV = uintCV(BigInt(amountString)); // Convert validated string to bigint
        const recipientCV = principalCV(recipient);

        const formatHopForApi = (hopData: z.infer<typeof HopSchema>, index: number): ClarityValue => {
            const [vaultAddr, vaultName] = hopData.vault.split('.');
            const vaultTraitCV = contractPrincipalCV(vaultAddr, vaultName);
            const opcodeCV = hopData.opcode
                ? bufferFromHex(hopData.opcode) // Remove 0x before converting
                : noneCV();

            if (index === 0 && numHops > 0) {
                // Hop 1 requires signature and uuid from payload
                if (!hopData.signature || !hopData.uuid) {
                    // This should be caught by earlier validation, but double-check
                    throw new Error("Internal Server Error: Missing signature/uuid for Hop 1 during CV construction.");
                }
                const signatureCV = bufferFromHex(hopData.signature); // Remove 0x before converting hex
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
        console.log("API: Hop CVs:", JSON.stringify(hopCVs, null, 2));

        // --- Recover Signer ---
        const response = await fetchCallReadOnlyFunction({
            contractAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
            contractName: 'blaze-rc10',
            functionName: 'recover',
            functionArgs: [
                bufferFromHex(hops[0]?.signature!),
                principalCV(TOKEN_A_CONTRACT_ID),
                stringAsciiCV('TRANSFER_TOKENS'),
                noneCV(),
                optionalCVOf(amountCV),
                optionalCVOf(principalCV('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.monkey-d-luffy-rc11')),
                stringAsciiCV(hops[0]?.uuid!),
            ],
            network: 'mainnet',
            senderAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'
        }).then(cvToValue);

        const signer = response.value

        console.log("API: Signer:", signer);

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
            // Should be caught by Zod, but belts and suspenders
            throw new Error("Invalid number of hops after validation.");
        }

        // --- Create and Broadcast Transaction ---
        console.log(`API: Preparing ${functionName} call to ${multihopAddr}.${multihopName}`);
        const txOptions = {
            contractAddress: multihopAddr,
            contractName: multihopName,
            functionName,
            functionArgs,
            senderKey: privateKey,
            network,
            anchorMode: AnchorMode.Any, // Or Microblock if preferred
            postConditionMode: PostConditionMode.Deny, // Recommended for safety
            fee: 1000, // Optional: Estimate or set a fee
        };

        const transaction = await makeContractCall(txOptions);

        console.log("API: Broadcasting transaction...");
        const broadcastResponse = await broadcastTransaction({ transaction, network });
        console.log("API: Broadcast Response:", broadcastResponse);

        // Return the broadcast result (includes txid or error details)
        return NextResponse.json(broadcastResponse);

    } catch (error: unknown) {
        console.error("API Error during multi-hop execution:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        // Check for specific broadcast errors if needed
        if (typeof error === 'object' && error !== null && 'message' in error) {
            // Potentially parse broadcast errors further
        }
        return NextResponse.json({ error: `Failed to execute multi-hop swap: ${errorMessage}` }, { status: 500 });
    }
} 