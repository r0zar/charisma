import {
    uintCV,
    stringAsciiCV,
    bufferCV,
    noneCV,
    PostConditionMode,
} from "@stacks/transactions";
import { STACKS_MAINNET } from "@stacks/network";
import { ContractCallTxOptions, RedeemBearerInput } from "./types";
import { bufferFromHex } from "@stacks/transactions/dist/cl";

export function createRedeem(input: RedeemBearerInput): ContractCallTxOptions {
    const {
        contractId,
        signature,
        uuid,
        amount,
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

    const [contractAddress, contractName] = contractId.split('.');

    const functionArgs = [
        bufferFromHex(signature),
        uintCV(amount),
        stringAsciiCV(uuid),
        noneCV(),
    ];

    return {
        contractAddress,
        contractName,
        functionName: "x-redeem",
        functionArgs,
        senderKey,
        network: network,
        fee,
        postConditionMode,
        anchorMode,
        nonce
    };
} 