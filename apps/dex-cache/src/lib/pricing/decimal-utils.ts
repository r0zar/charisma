/**
 * Decimal conversion utilities for token pricing calculations
 * Handles conversion between atomic units and decimal representation
 */

import type { TokenNode } from './price-graph';

/**
 * Convert atomic units to decimal representation
 * @param atomicValue - The value in atomic units (e.g., 1000000 microSTX)
 * @param decimals - Number of decimal places (e.g., 6 for STX)
 * @returns Decimal value (e.g., 1.0 STX)
 */
export function convertAtomicToDecimal(atomicValue: number, decimals: number): number {
    if (!isFinite(atomicValue) || atomicValue < 0 || decimals < 0 || decimals > 18) {
        console.warn(`[DecimalUtils] Invalid conversion: atomicValue=${atomicValue}, decimals=${decimals}`);
        return 0;
    }
    
    const divisor = Math.pow(10, decimals);
    const result = atomicValue / divisor;
    
    if (!isFinite(result)) {
        console.warn(`[DecimalUtils] Conversion resulted in non-finite value: ${atomicValue} / 10^${decimals}`);
        return 0;
    }
    
    return result;
}

/**
 * Convert decimal representation to atomic units
 * @param decimalValue - The decimal value (e.g., 1.0 STX)
 * @param decimals - Number of decimal places (e.g., 6 for STX)
 * @returns Atomic value (e.g., 1000000 microSTX)
 */
export function convertDecimalToAtomic(decimalValue: number, decimals: number): number {
    if (!isFinite(decimalValue) || decimalValue < 0 || decimals < 0 || decimals > 18) {
        console.warn(`[DecimalUtils] Invalid conversion: decimalValue=${decimalValue}, decimals=${decimals}`);
        return 0;
    }
    
    const multiplier = Math.pow(10, decimals);
    const result = Math.round(decimalValue * multiplier);
    
    if (!isFinite(result)) {
        console.warn(`[DecimalUtils] Conversion resulted in non-finite value: ${decimalValue} * 10^${decimals}`);
        return 0;
    }
    
    return result;
}

/**
 * Get token decimals from token nodes with fallback
 * @param tokenId - The token contract ID
 * @param tokenNodes - Map of token nodes from price graph
 * @returns Number of decimals, with fallback to 6
 */
export function getTokenDecimals(tokenId: string, tokenNodes: Map<string, TokenNode>): number {
    const node = tokenNodes.get(tokenId);
    if (node?.decimals !== undefined && node.decimals >= 0 && node.decimals <= 18) {
        return node.decimals;
    }
    
    // Fallback logic for known tokens
    if (tokenId === '.stx' || tokenId === 'stx') {
        return 6; // STX has 6 decimals
    }
    
    if (tokenId.includes('sbtc-token')) {
        return 8; // sBTC has 8 decimals
    }
    
    // Default fallback
    console.warn(`[DecimalUtils] Using fallback decimals (6) for token: ${tokenId}`);
    return 6;
}

/**
 * Calculate exchange rate between two tokens using proper decimal conversion
 * @param inputReserve - Input token reserve in atomic units
 * @param inputDecimals - Input token decimals
 * @param outputReserve - Output token reserve in atomic units  
 * @param outputDecimals - Output token decimals
 * @returns Exchange rate (output tokens per input token)
 */
export function calculateDecimalAwareExchangeRate(
    inputReserve: number,
    inputDecimals: number,
    outputReserve: number,
    outputDecimals: number
): number {
    if (!inputReserve || !outputReserve || inputReserve <= 0 || outputReserve <= 0) {
        return 0;
    }
    
    const inputDecimal = convertAtomicToDecimal(inputReserve, inputDecimals);
    const outputDecimal = convertAtomicToDecimal(outputReserve, outputDecimals);
    
    if (inputDecimal <= 0) {
        console.warn(`[DecimalUtils] Invalid input decimal: ${inputDecimal}`);
        return 0;
    }
    
    const exchangeRate = outputDecimal / inputDecimal;
    
    if (!isFinite(exchangeRate) || exchangeRate <= 0) {
        console.warn(`[DecimalUtils] Invalid exchange rate: ${exchangeRate}`);
        return 0;
    }
    
    return exchangeRate;
}

/**
 * Calculate geometric mean liquidity using decimal-converted reserves
 * @param reserveA - Token A reserve in atomic units
 * @param decimalsA - Token A decimals
 * @param reserveB - Token B reserve in atomic units
 * @param decimalsB - Token B decimals
 * @returns Geometric mean of decimal-converted reserves
 */
export function calculateDecimalAwareLiquidity(
    reserveA: number,
    decimalsA: number,
    reserveB: number,
    decimalsB: number
): number {
    if (!reserveA || !reserveB || reserveA <= 0 || reserveB <= 0) {
        return 0;
    }
    
    const decimalA = convertAtomicToDecimal(reserveA, decimalsA);
    const decimalB = convertAtomicToDecimal(reserveB, decimalsB);
    
    if (decimalA <= 0 || decimalB <= 0) {
        console.warn(`[DecimalUtils] Invalid decimal reserves: A=${decimalA}, B=${decimalB}`);
        return 0;
    }
    
    const geometricMean = Math.sqrt(decimalA * decimalB);
    
    if (!isFinite(geometricMean)) {
        console.warn(`[DecimalUtils] Invalid geometric mean: sqrt(${decimalA} * ${decimalB})`);
        return 0;
    }
    
    return geometricMean;
}

/**
 * Validate that decimal conversion parameters are reasonable
 * @param atomicValue - Atomic value to validate
 * @param decimals - Decimals to validate
 * @returns Whether the parameters are valid
 */
export function isValidDecimalConversion(atomicValue: number, decimals: number): boolean {
    return (
        isFinite(atomicValue) &&
        atomicValue >= 0 &&
        Number.isInteger(decimals) &&
        decimals >= 0 &&
        decimals <= 18
    );
}