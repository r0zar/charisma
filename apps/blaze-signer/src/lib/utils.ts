import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a BigInt value representing the smallest unit of a token 
 * into a decimal string representation based on the token's decimals.
 * 
 * @param value The BigInt value to format.
 * @param decimals The number of decimal places the token uses.
 * @returns A string representation of the value with the correct decimal point.
 */
export function formatUnits(value: bigint, decimals: number): string {
  let valueString = value.toString();
  const valueLength = valueString.length;

  if (decimals === 0) {
    return valueString;
  }

  if (valueLength <= decimals) {
    // Pad with leading zeros if the value is smaller than the decimal places
    valueString = '0'.repeat(decimals - valueLength + 1) + valueString;
  }

  const integerPart = valueString.slice(0, -decimals);
  const fractionalPart = valueString.slice(-decimals).replace(/0+$/, ''); // Remove trailing zeros

  if (fractionalPart.length === 0) {
    return integerPart;
  }

  return `${integerPart}.${fractionalPart}`;
}

/**
 * Parses a decimal string representation of a token amount into a BigInt 
 * representing the smallest unit of the token.
 * 
 * @param value The decimal string to parse (e.g., "10.5").
 * @param decimals The number of decimal places the token uses.
 * @returns A BigInt representing the value in the smallest unit, or null if parsing fails.
 */
export function parseUnits(value: string, decimals: number): bigint | null {
  if (!value || typeof value !== 'string') {
    return null;
  }

  // Remove any non-numeric characters except the decimal point
  const cleanedValue = value.replace(/[^0-9.]/g, '');
  const parts = cleanedValue.split('.');

  // Ensure only one decimal point
  if (parts.length > 2) {
    return null;
  }

  let integerPart = parts[0];
  let fractionalPart = parts[1] || '';

  // Ensure integer part is valid
  if (!integerPart || !/^[0-9]+$/.test(integerPart)) {
    // Allow case like ".5" -> "0.5"
    if (integerPart === '' && fractionalPart && /^[0-9]+$/.test(fractionalPart)) {
      integerPart = '0';
    } else {
      return null;
    }
  }

  // Trim or pad fractional part to match decimals
  if (fractionalPart.length > decimals) {
    fractionalPart = fractionalPart.substring(0, decimals);
  } else if (fractionalPart.length < decimals) {
    fractionalPart = fractionalPart.padEnd(decimals, '0');
  }

  try {
    // Combine integer and fractional parts and convert to BigInt
    const combined = integerPart + fractionalPart;
    // Handle empty string case leading to BigInt('') error
    if (combined === '') return BigInt(0);
    return BigInt(combined);
  } catch (error) {
    console.error(`Error parsing value "${value}" to units:`, error);
    return null;
  }
}
