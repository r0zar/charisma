import {
    uintCV,
    stringAsciiCV,
    principalCV,
    validateStacksAddress,
    PostConditionMode,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import { ContractCallTxOptions, TransferTokensInput } from "./types";
import { bufferFromHex } from "@stacks/transactions/dist/cl";
import { recoverSigner } from "../core";

export function createTransfer(input: TransferTokensInput): ContractCallTxOptions {
    const {
        contractId,
        signature,
        uuid,
        amount,
        recipient,
        senderKey,
        network = STACKS_MAINNET,
        fee = 1000, // Corrected default fee as per original route
        postConditionMode = PostConditionMode.Deny,
        anchorMode,
        nonce
    } = input;

    if (!contractId.includes('.')) {
        throw new Error(`Invalid contractId format: ${contractId}`);
    }
    if (!validateStacksAddress(recipient)) {
        throw new Error(`Invalid recipient Stacks address: ${recipient}`);
    }

    const [contractAddress, contractName] = contractId.split('.');

    const functionArgs = [
        bufferFromHex(signature),
        uintCV(amount),
        stringAsciiCV(uuid),
        principalCV(recipient),
    ];

    return {
        contractAddress,
        contractName,
        functionName: "x-transfer",
        functionArgs,
        senderKey,
        network: network,
        fee,
        postConditionMode,
        anchorMode,
        nonce
    };
}

/**
 * Verifies the signature from a swap transaction
 * 
 * @param signature - The signature from the swap transaction
 * @param uuid - The UUID for the transaction
 * @param tokenContract - The contract ID of the token subnet
 * @param amount - The amount of the token
 * @param recepient - The recepient of the token transfer
 * @returns The recovered signer
 */
export async function recoverTransferSigner(signature: string, uuid: string, tokenContract: string, amount: number, recepient: string): Promise<string> {

    const signer = await recoverSigner(
        signature,
        tokenContract,
        'TRANSFER_TOKENS',
        uuid,
        {
            amount,
            target: recepient
        }
    );

    if (!signer) {
        throw new Error('Failed to recover signer from signature');
    }

    return signer;
}