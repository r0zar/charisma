/**
 * Decimal conversion utilities for token amounts
 */

/**
 * Convert atomic token amount to decimal representation
 * @param atomicAmount - Token amount in atomic units
 * @param decimals - Number of decimal places for the token
 * @returns Decimal value
 */
export function convertAtomicToDecimal(atomicAmount: number, decimals: number): number {
    if (decimals === 0) return atomicAmount;
    return atomicAmount / Math.pow(10, decimals);
}

/**
 * Convert decimal token amount to atomic representation
 * @param decimalAmount - Token amount in decimal units
 * @param decimals - Number of decimal places for the token
 * @returns Atomic value
 */
export function convertDecimalToAtomic(decimalAmount: number, decimals: number): number {
    if (decimals === 0) return decimalAmount;
    return decimalAmount * Math.pow(10, decimals);
}