/**
 * Clean Contract Calling Wrappers for Blaze Signer
 * 
 * This file provides pure functional wrappers for interacting with the Blaze Protocol
 * smart contract. Each function handles a specific contract operation while abstracting
 * away the implementation details of constructing function arguments and handling responses.
 */

import {
    stringAsciiCV,
    cvToValue,
    ClarityType,
    principalCV,
    uintCV,
    optionalCVOf,
    noneCV, Cl } from "@stacks/transactions";
import { callReadOnlyFunction } from "@repo/polyglot";
import { BLAZE_CONTRACT_ID } from "./constants";
import { blazeContract, blazeVersionOf } from "./version";

const [contractAddress, contractName] = parseContract(BLAZE_CONTRACT_ID);

/**
 * Parses a contract string into address and name components
 * 
 * @param contract - Contract string in the format "SP123...456.contract-name"
 * @returns Tuple of [contractAddress, contractName]
 */
export function parseContract(contract: string): [string, string] {
    const [contractAddress, contractName] = contract.split(".");
    if (!contractAddress || !contractName) {
        throw new Error("Invalid contract format - expected 'address.name'");
    }
    return [contractAddress, contractName];
}

/**
 * Type for the optional parameters used in Blaze Signer operations
 */
export type BlazeSignerOptions = {
    opcode?: string;     // Optional hex string for opcode buffer
    amount?: number | bigint | string;     // Optional uint amount
    target?: string;     // Optional principal target
};

/**
 * Generates a structured data hash using the Blaze Signer contract
 * 
 * @param coreContract - The Subnet contract principal
 * @param intent - Intent string (max 32 ASCII chars)
 * @param uuid - Unique identifier (max 36 ASCII chars)
 * @param options - Optional parameters (opcode, amount, target)
 * @returns Promise resolving to the generated hash string
 */
export async function generateHash(
    coreContract: string,
    intent: string,
    uuid: string,
    options: BlazeSignerOptions = {},
): Promise<string> {
    // Prepare optional arguments
    const opcodeArg = options.opcode
        ? optionalCVOf(Cl.bufferFromHex(options.opcode))
        : noneCV();

    const amountArg = options.amount
        ? optionalCVOf(uintCV(options.amount))
        : noneCV();

    const targetArg = options.target
        ? optionalCVOf(principalCV(options.target))
        : noneCV();

    // Call the 'hash' function of the verifier this subnet uses
    const [blazeAddress, blazeName] = parseContract(blazeContract(await blazeVersionOf(coreContract)));
    const result: any = await callReadOnlyFunction(
        blazeAddress,
        blazeName,
        "hash",
        [
            principalCV(coreContract),
            stringAsciiCV(intent),
            opcodeArg,
            amountArg,
            targetArg,
            stringAsciiCV(uuid)
        ],
    );

    if (result?.value?.value) {
        return result.value.value;
    } else {
        throw new Error(
            `Hash generation failed: ${result ? JSON.stringify(cvToValue(result, true)) : 'Unknown error'
            }`
        );
    }
}

/**
 * Verifies a signature against a pre-computed message hash
 * 
 * @param messageHash - 32-byte message hash (as hex string)
 * @param signature - 65-byte signature (as hex string)
 * @returns Promise resolving to the recovered signer principal
 */
export async function verifySignature(
    messageHash: string,
    signature: string,
): Promise<string> {
    // Remove '0x' prefix if present
    const cleanMessageHash = messageHash.startsWith('0x') ? messageHash.substring(2) : messageHash;
    const cleanSignature = signature.startsWith('0x') ? signature.substring(2) : signature;

    // Call the 'verify' function
    const result: any = await callReadOnlyFunction(
        contractAddress,
        contractName,
        "verify",
        [
            Cl.bufferFromHex(cleanMessageHash),
            Cl.bufferFromHex(cleanSignature),
        ],
    );

    // verify returns (ok principal) or (err ...)
    if (
        result &&
        result.type === ClarityType.ResponseOk &&
        result.value &&
        result.value.type === ClarityType.PrincipalStandard
    ) {
        return cvToValue(result.value);
    } else if (result && result.type === ClarityType.ResponseErr) {
        throw new Error(`Verification failed: ${JSON.stringify(cvToValue(result.value, true))}`);
    } else {
        throw new Error(
            `Invalid signature or hash, or unexpected result: ${result ? JSON.stringify(cvToValue(result, true)) : 'Unknown error'
            }`
        );
    }
}

/**
 * Recovers the signer of a message by checking against full intent data
 * 
 * @param signature - 65-byte signature (as hex string)
 * @param contract - Contract principal allowed to execute the intent
 * @param intent - Intent string (max 32 ASCII chars)
 * @param uuid - Unique identifier (max 36 ASCII chars)
 * @param options - Optional parameters (opcode, amount, target)
 * @returns Promise resolving to the recovered signer principal
 */
export async function recoverSigner(
    signature: string,
    contract: string,
    intent: string,
    uuid: string,
    options: BlazeSignerOptions = {},
): Promise<string> {

    // Prepare optional arguments
    const opcodeArg = options.opcode ? optionalCVOf(Cl.bufferFromHex(options.opcode)) : noneCV();
    const amountArg = options.amount ? optionalCVOf(uintCV(options.amount)) : noneCV();
    const targetArg = options.target ? optionalCVOf(principalCV(options.target)) : noneCV();

    // Call the 'recover' function of the verifier this subnet uses
    const [blazeAddress, blazeName] = parseContract(blazeContract(await blazeVersionOf(contract)));
    const result: any = await callReadOnlyFunction(
        blazeAddress,
        blazeName,
        "recover",
        [
            Cl.bufferFromHex(signature),
            principalCV(contract),
            stringAsciiCV(intent),
            opcodeArg,
            amountArg,
            targetArg,
            stringAsciiCV(uuid)
        ],
    );

    if (!result?.value) {
        throw new Error('Could not recover signer: Unexpected result format from read-only call.');
    }
    return result.value;
}

/**
 * Checks if a UUID has been submitted to the contract
 * 
 * @param uuid - UUID to check
 * @returns Promise resolving to a boolean indicating if UUID has been submitted
 */
export async function checkUUID(uuid: string): Promise<boolean> {
    // Call the 'check' function
    const result: any = await callReadOnlyFunction(
        contractAddress,
        contractName,
        "check",
        [stringAsciiCV(uuid)],
    );

    // Check result type
    if (result.type === ClarityType.BoolTrue) {
        return true;
    } else if (result.type === ClarityType.BoolFalse) {
        return false;
    } else {
        throw new Error("Unexpected result type checking UUID status");
    }
}

/** Blaze v2: whether this signer has used (or revoked) this uuid. v2 keys replay protection by signer. */
export async function checkUUIDV2(signer: string, uuid: string): Promise<boolean> {
    const [address, name] = parseContract(blazeContract(2));
    const result: any = await callReadOnlyFunction(address, name, "check", [principalCV(signer), stringAsciiCV(uuid)]);
    if (result.type === ClarityType.BoolTrue) return true;
    if (result.type === ClarityType.BoolFalse) return false;
    throw new Error("Unexpected result type checking a Blaze v2 uuid");
}

/**
 * Submits a signature to execute the signed intent
 * 
 * @param signature - 65-byte signature (as hex string)
 * @param intent - Intent string (max 32 ASCII chars)
 * @param uuid - Unique identifier (max 36 ASCII chars)
 * @param options - Optional parameters (opcode, amount, target)
 * @returns Promise resolving to the transaction ID
 */
export async function submitSignature(
    signature: string,
    intent: string,
    uuid: string,
    options: BlazeSignerOptions = {}
): Promise<string> {
    // Remove '0x' prefix if present
    const cleanSignature = signature.startsWith('0x') ? signature.substring(2) : signature;

    // Prepare optional arguments
    const opcodeArg = options.opcode
        ? optionalCVOf(Cl.bufferFromHex(options.opcode))
        : noneCV();

    const amountArg = options.amount
        ? optionalCVOf(uintCV(options.amount))
        : noneCV();

    const targetArg = options.target
        ? optionalCVOf(principalCV(options.target))
        : noneCV();

    // Call the 'execute' function
    const params = {
        contract: `${contractAddress}.${contractName}` as `${string}.${string}`,
        functionName: "execute",
        functionArgs: [
            Cl.bufferFromHex(cleanSignature),
            stringAsciiCV(intent),
            opcodeArg,
            amountArg,
            targetArg,
            stringAsciiCV(uuid),
        ],
    };

    const { request } = await import('@stacks/connect');
    const result = await request('stx_callContract', params) as any;

    // Check if the result indicates a successful broadcast (has txid)
    if (result && result.txid) {
        return result.txid;
    } else {
        // Extract potential error message if available
        const errorMessage = result?.error?.message || "Transaction failed or was rejected";
        throw new Error(`Submission Failed: ${errorMessage}`);
    }
}