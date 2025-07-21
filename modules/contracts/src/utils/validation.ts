/**
 * Input validation utilities
 */

/**
 * Validate Stacks address format
 */
export function isValidStacksAddress(address: string): boolean {
  // Basic Stacks address validation
  return /^S[P|T][0-9A-Z]{39}$/.test(address);
}

/**
 * Validate contract ID format
 */
export function isValidContractId(contractId: string): boolean {
  const parts = contractId.split('.');
  return parts.length === 2 && isValidStacksAddress(parts[0]) && parts[1].length > 0;
}

/**
 * Validate UUID format
 */
export function isValidUuid(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid);
}

/**
 * Validate amount string (must be positive integer)
 */
export function isValidAmount(amount: string): boolean {
  const num = BigInt(amount);
  return num >= BigInt(0);
}

/**
 * Validate signature format (65 bytes as hex)
 */
export function isValidSignature(signature: string): boolean {
  // Remove 0x prefix if present
  const hex = signature.startsWith('0x') ? signature.slice(2) : signature;
  return hex.length === 130 && /^[0-9a-f]+$/i.test(hex);
}