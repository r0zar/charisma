/**
 * Refactored Multihop Transaction Service
 * 
 * This module provides functions for building and executing multihop swap transactions
 * on the Stacks blockchain, working directly with native Clarity values.
 */

import {
    makeContractCall,
    broadcastTransaction,
    AnchorMode,
    PostConditionMode,
    uintCV,
    principalCV,
    contractPrincipalCV,
    tupleCV,
    stringAsciiCV,
    ClarityValue,
    PostCondition,
    TxBroadcastResult,
} from '@stacks/transactions';
import { bufferFromHex } from '@stacks/transactions/dist/cl';
import { STACKS_MAINNET } from '@stacks/network';
import { DEFAULT_ROUTER_CONFIG, MULTIHOP_CONTRACT_ID, STX_CONTRACT_ID, WRAPPED_STX_CONTRACT_ID } from '../../constants';
import { recoverSigner } from '../../core';
import { ContractCallTxOptions } from '../types';
import { buildPostConditions, Token, Hop, Route } from './utils/postconditions';

// ====== Types and Interfaces ======

// Re-export types from postconditions module
export type { Token, Hop, Route } from './utils/postconditions';

export interface SwapMetadata {
    amountIn: number | string;
    signature: string;     // 65-byte hex (no 0x)
    uuid: string;
    recipient: string;     // Principal string
}

export interface RouterConfig {
    routerAddress: string;
    routerName: string;
}

export interface TransactionConfig {
    contractAddress: string;
    contractName: string;
    functionName: string;
    functionArgs: ClarityValue[];
    postConditions: PostCondition[];
    postConditionMode?: PostConditionMode;
    nonce?: number;
    fee?: number;
}

export type TokenOptionalParams = {
    amount?: string;     // Optional amount as string
    target?: string;     // Optional target principal
};

// ====== Helper Functions ======

/**
 * Splits a contract ID into address and name
 * 
 * @param contractId - The contract ID to split
 * @returns The address and name
 */
function splitContractId(contractId: string): [string, string] {
    const parts = contractId.split('.');
    if (parts.length !== 2) {
        throw new Error(`Invalid contract ID: ${contractId}`);
    }
    return [parts[0], parts[1]];
}

// ====== Function Argument Building ======

/**
 * Builds the input tuple for a swap transaction
 * 
 * @param inputToken - The input token
 * @param amountIn - The amount to swap
 * @param signature - The signature authorizing the swap
 * @param uuid - The UUID for the transaction
 * @returns The input tuple as a Clarity value
 */
export function buildInputTuple(
    inputToken: Token,
    amountIn: string | number,
    signature: string,
    uuid: string
): ClarityValue {
    // Special case: Replace STX with wrapped STX for x-multihop compatibility
    let contractId = inputToken.contractId;
    if (contractId === STX_CONTRACT_ID) {
        contractId = WRAPPED_STX_CONTRACT_ID;
    }

    const [addr, name] = splitContractId(contractId);

    return tupleCV({
        token: contractPrincipalCV(addr, name),
        amount: uintCV(BigInt(amountIn)),
        signature: bufferFromHex(signature),
        uuid: stringAsciiCV(uuid)
    });
}

/**
 * Builds the output tuple for a swap transaction
 * 
 * @param outputToken - The output token
 * @param recipient - The recipient of the swapped tokens
 * @returns The output tuple as a Clarity value
 */
export function buildOutputTuple(outputToken: Token, recipient: string): ClarityValue {
    // Special case: Replace STX with wrapped STX for x-multihop compatibility
    let contractId = outputToken.contractId;
    if (contractId === STX_CONTRACT_ID) {
        contractId = WRAPPED_STX_CONTRACT_ID;
    }

    const [addr, name] = splitContractId(contractId);

    return tupleCV({
        token: contractPrincipalCV(addr, name),
        to: principalCV(recipient)
    });
}

/**
 * Builds the hop tuple for a swap transaction
 * 
 * @param hop - The hop to build the tuple for
 * @returns The hop tuple as a Clarity value
 */
function buildHopTuple(hop: Hop): ClarityValue {
    const [addr, name] = splitContractId(hop.vault.contractId);
    const opcodeHex = hop.opcode.toString(16).padStart(2, '0');
    return tupleCV({
        vault: contractPrincipalCV(addr, name),
        opcode: bufferFromHex(opcodeHex),
    });
}


// ====== Main Transaction Building Function ======

/**
 * Builds a transaction config for the multihop swap router with native Clarity values
 * 
 * @param route - The route to execute
 * @param meta - Metadata for the transaction
 * @param config - Router configuration (optional)
 * @returns Transaction configuration with native Clarity values
 */
export function buildXSwapTransaction(
    route: Route,
    meta: SwapMetadata,
    config: RouterConfig = DEFAULT_ROUTER_CONFIG
): TransactionConfig {
    // Ensure router configured
    if (!config.routerAddress || !config.routerName) {
        throw new Error('Router address/name not configured');
    }

    // 1. Build the function arguments
    const inCV = buildInputTuple(
        route.path[0],
        meta.amountIn,
        meta.signature,
        meta.uuid
    );

    const hopCVs = route.hops.map(buildHopTuple);

    const outCV = buildOutputTuple(
        route.path[route.path.length - 1],
        meta.recipient
    );

    // 2. Combine all function arguments
    const functionArgs = [inCV, ...hopCVs, outCV];

    // 3. Build the post conditions
    const routerCID = `${config.routerAddress}.${config.routerName}`;
    const postConditions = buildPostConditions(route, routerCID);

    // 4. Return the complete transaction config
    return {
        contractAddress: config.routerAddress,
        contractName: config.routerName,
        functionName: `x-swap-${route.hops.length}`,
        functionArgs,
        postConditions,
        // postConditions: [],
        // postConditionMode: PostConditionMode.Allow,
    };
}

/**
 * Verifies the signature from a swap transaction
 * 
 * @param signature - The signature from the swap transaction
 * @param uuid - The UUID for the transaction
 * @param tokenContract - The contract ID of the token subnet
 * @param amount - The amount of the token
 * @returns The recovered signer
 */
export async function recoverMultihopSigner(
    signature: string,
    uuid: string,
    tokenContract: string,
    amount: number | string
): Promise<string> {
    const signer = await recoverSigner(
        signature,
        tokenContract,
        'TRANSFER_TOKENS',
        uuid,
        {
            amount: amount,
            target: MULTIHOP_CONTRACT_ID
        }
    );

    if (!signer) {
        throw new Error('Failed to recover signer from signature');
    }

    return signer;
}

/**
 * Executes a multihop transaction using native Clarity values
 * 
 * @param txConfig - The transaction configuration with native Clarity values
 * @param privateKey - The private key for signing the transaction
 * @returns The broadcast response
 */
export async function broadcastMultihopTransaction(
    txConfig: TransactionConfig,
    privateKey: string
): Promise<TxBroadcastResult> {
    // Create transaction
    const txOptions: ContractCallTxOptions = {
        contractAddress: txConfig.contractAddress,
        contractName: txConfig.contractName,
        functionName: txConfig.functionName,
        functionArgs: txConfig.functionArgs,
        senderKey: privateKey,
        network: STACKS_MAINNET,
        anchorMode: AnchorMode.Any,
        postConditionMode: txConfig.postConditionMode || PostConditionMode.Deny,
        postConditions: txConfig.postConditions,
    };

    if (txConfig.fee) {
        txOptions.fee = txConfig.fee;
    }
    if (txConfig.nonce) {
        txOptions.nonce = txConfig.nonce;
    }

    const transaction = await makeContractCall(txOptions);

    // Broadcast transaction
    return await broadcastTransaction({ transaction, network: STACKS_MAINNET });
}

/**
 * Comprehensive function that builds and executes a multihop swap
 * 
 * @param route - The route to execute
 * @param meta - Metadata for the transaction
 * @param privateKey - The private key for signing the transaction
 * @param config - Router configuration (optional)
 * @returns The broadcast response
 */
export async function executeMultihopSwap(
    route: Route,
    meta: SwapMetadata,
    privateKey: string,
    config: RouterConfig = DEFAULT_ROUTER_CONFIG
): Promise<TxBroadcastResult> {
    // 1. Build the transaction config with native Clarity values
    const txConfig = await buildXSwapTransaction(route, meta, config);

    // 2. Verify the signature
    const signer = await recoverMultihopSigner(
        meta.signature,
        meta.uuid,
        route.path[0].contractId,
        meta.amountIn
    );

    // 3. Log debug information
    console.log("\n=========== MULTIHOP EXECUTION DEBUG ===========");
    console.log("Recovered signer (public key hash):", signer);
    console.log("Function:", txConfig.functionName);
    console.log("Args count:", txConfig.functionArgs.length);
    console.log("Post conditions count:", txConfig.postConditions.length);
    console.log("===============================================\n");

    // 4. Broadcast the transaction
    return await broadcastMultihopTransaction(txConfig, privateKey);
}