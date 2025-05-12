import {
    uintCV,
    stringAsciiCV,
    principalCV,
    validateStacksAddress,
    PostConditionMode,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import { ContractCallTxOptions, TransferTokensLTEInput } from "./types";
import { bufferFromHex } from "@stacks/transactions/dist/cl";

export function createBoundedTransfer(input: TransferTokensLTEInput): ContractCallTxOptions {
    const {
        contractId,
        signature,
        uuid,
        bound,
        amount,
        recipient,
        senderKey,
        network = STACKS_MAINNET,
        fee = 1000, // Corrected default fee
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
        uintCV(bound),
        uintCV(amount),
        stringAsciiCV(uuid),
        principalCV(recipient),
    ];

    return {
        contractAddress,
        contractName,
        functionName: "x-transfer-lte",
        functionArgs,
        senderKey,
        network: network,
        fee,
        postConditionMode,
        anchorMode,
        nonce
    };
} 