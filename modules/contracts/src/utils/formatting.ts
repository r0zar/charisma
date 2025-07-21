import { DEFAULT_DECIMALS } from './constants';

// Re-export for external use
export { DEFAULT_DECIMALS };

/**
 * Format atomic token amount to human-readable string
 */
export function formatTokenAmount(atomicAmount: string | bigint, decimals: number = DEFAULT_DECIMALS): string {
  const amount = BigInt(atomicAmount);
  const divisor = BigInt(10 ** decimals);
  
  const whole = amount / divisor;
  const remainder = amount % divisor;
  
  if (remainder === BigInt(0)) {
    return whole.toString();
  }
  
  const fractional = remainder.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fractional}`;
}

/**
 * Parse user input to atomic units
 */
export function parseUserInput(input: string, decimals: number = DEFAULT_DECIMALS): string {
  const trimmed = input.trim();
  if (!trimmed || isNaN(Number(trimmed))) {
    throw new Error('Invalid number input');
  }
  
  const [whole = '0', fractional = ''] = trimmed.split('.');
  
  if (fractional.length > decimals) {
    throw new Error(`Too many decimal places. Maximum: ${decimals}`);
  }
  
  const paddedFractional = fractional.padEnd(decimals, '0');
  const atomicAmount = BigInt(whole) * BigInt(10 ** decimals) + BigInt(paddedFractional || '0');
  
  return atomicAmount.toString();
}

/**
 * Convert atomic units to decimal number (use with caution for large numbers)
 */
export function toDecimalNumber(atomicAmount: string | bigint, decimals: number = DEFAULT_DECIMALS): number {
  const amount = BigInt(atomicAmount);
  const divisor = BigInt(10 ** decimals);
  return Number(amount) / Number(divisor);
}

/**
 * Convert decimal number to atomic units string
 */
export function fromDecimalNumber(amount: number, decimals: number = DEFAULT_DECIMALS): string {
  const multiplier = 10 ** decimals;
  const atomicAmount = Math.round(amount * multiplier);
  return atomicAmount.toString();
}