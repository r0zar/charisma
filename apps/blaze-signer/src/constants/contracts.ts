/**
 * Shared contract constants for the Blaze Protocol application
 */

// Blaze Protocol contract
export const BLAZE_SIGNER_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.blaze-rc10"

// Charisma Credits contract
export const CHARISMA_CREDITS_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-rc6"

// Welsh Credits contract
export const WELSH_CREDITS_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-rc2"

// Mali Credits contract
export const MALI_CREDITS_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.mali-token-subnet-rc1"

// Charisma token contract
export const CHARISMA_TOKEN_CONTRACT = "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"

// Welshcorgicoin token contract
export const WELSHCORGICOIN_CONTRACT = "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token"

// Mali token contract
export const MALI_TOKEN_CONTRACT = "SPKBV3CZB15CM3CVMCMRX56WRYKDY5P5CTQQXSN0.belgian-malinois"

// Token decimals
export const WELSH_CREDITS_DECIMALS = 6
export const CHARISMA_CREDITS_DECIMALS = 6
export const MALI_CREDITS_DECIMALS = 6

// SIP-018 Domain details
export const BLAZE_PROTOCOL_NAME = "BLAZE_PROTOCOL";
export const BLAZE_PROTOCOL_VERSION = "intent-v1";

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
 * @param contractString - Full contract string (e.g., "SP2ZNGJ...KTBS.blaze-rc9")
 * @returns [contractAddress, contractName]
 */
export function parseContract(contractString: string): [string, string] {
    const parts = contractString.split(".")
    if (parts.length !== 2) {
        throw new Error("Invalid contract format")
    }
    return [parts[0], parts[1]]
} 