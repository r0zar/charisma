/**
 * Shared contract constants for the Blaze Signer application
 */

// Blaze Signer contract
export const BLAZE_SIGNER_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-rc9"

// Welsh Credits contract
export const WELSH_CREDITS_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-credits-rc5"

// Welshcorgicoin token contract
export const WELSHCORGICOIN_CONTRACT = "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token"

// Token decimals
export const WELSH_CREDITS_DECIMALS = 6

// SIP-018 Domain details
export const BLAZE_PROTOCOL_NAME = "BLAZE_PROTOCOL";
export const BLAZE_PROTOCOL_VERSION = "rc9";

/**
 * Generates a UUID string in the format xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * Used for various operations that require unique identifiers
 */
export function generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0
        const v = c === 'x' ? r : (r & 0x3 | 0x8)
        return v.toString(16)
    })
}

/**
 * Utility to parse a contract string into its components
 * @param contractString - Full contract string (e.g., "SP2ZNGJ...KTBS.blaze-rc5")
 * @returns [contractAddress, contractName]
 */
export function parseContract(contractString: string): [string, string] {
    const parts = contractString.split(".")
    if (parts.length !== 2) {
        throw new Error("Invalid contract format")
    }
    return [parts[0], parts[1]]
} 