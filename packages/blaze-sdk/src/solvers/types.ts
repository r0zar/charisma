import { PostConditionMode } from "@stacks/transactions";
import { STACKS_MAINNET, STACKS_TESTNET } from "@stacks/network";

// Derive type from the instances
export type StacksNetworkType = typeof STACKS_MAINNET | typeof STACKS_TESTNET;

export interface BaseInput {
    contractId: string; // e.g., "SP...contract.contract-name"
    signature: string; // hex string of the signature
    uuid: string;
    senderKey: string; // private key for signing the transaction
    network?: StacksNetworkType; // Defaults to STACKS_MAINNET in implementations
    fee?: number;
    postConditionMode?: PostConditionMode;
    anchorMode?: any; // AnchorMode if needed
    nonce?: number;
}

export interface TransferTokensInput extends BaseInput {
    intent: "TRANSFER_TOKENS";
    amount: number;
    recipient: string; // Stacks address
}

export interface TransferTokensLTEInput extends BaseInput {
    intent: "TRANSFER_TOKENS_LTE";
    bound: number;
    amount: number; // The amount to transfer, must be less than or equal to bound
    recipient: string; // Stacks address
}

export interface RedeemBearerInput extends BaseInput {
    intent: "REDEEM_BEARER";
    amount: number;
}

// The expected output from each solver function
export interface ContractCallTxOptions {
    contractAddress: string;
    contractName: string;
    functionName: string;
    functionArgs: any[]; // Array of ClarityValue
    senderKey: string;
    network: StacksNetworkType; // Will be STACKS_MAINNET by default from solvers
    fee?: number;
    postConditionMode?: PostConditionMode;
    anchorMode?: any; // AnchorMode
    nonce?: number;
}

// This is based on the QueuedTxIntent from the route file.
// It's useful for the route to transform its queue message into one of the solver inputs.
export interface QueuedTxIntentForProcessing {
    contractId: string;
    intent: "TRANSFER_TOKENS" | "TRANSFER_TOKENS_LTE" | "REDEEM_BEARER";
    signature: string; // hex encoded
    uuid: string;
    amountOptional?: number | null;
    targetOptional?: string | null;
    // publicKey?: string; // Not directly used by solvers but part of the original type
} 