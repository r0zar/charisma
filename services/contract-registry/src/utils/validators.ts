/**
 * Validation utilities for contract registry
 */

/**
 * Validates a Stacks contract ID format
 * 
 * Contract ID format: {principal}.{contract-name}
 * - Principal: SP or SM followed by 26-40 base58 characters (no 0, O, I, l)
 * - Contract name: 1-128 characters, lowercase letters, numbers, hyphens, underscores
 * 
 * Examples:
 * - SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token ✓
 * - SP2VCQJGH7PHP2DJK7Z0V48AGBHQAW3R3ZW1QF4N.zststxbtc-v2_v2-0 ✓
 * - SM1793C4R5PZ4NS4VQ4WMP7SKKYVH8JZEWSZ9HCCR.xyk-pool-stx-shark-v-1-1 ✓
 */
export function isValidContractId(contractId: string): boolean {
  if (typeof contractId !== 'string' || !contractId) {
    return false;
  }

  // Basic format check: must contain exactly one dot
  const parts = contractId.split('.');
  if (parts.length !== 2) {
    return false;
  }

  const [principal, contractName] = parts;

  // Validate principal format
  if (!isValidPrincipal(principal)) {
    return false;
  }

  // Validate contract name format
  if (!isValidContractName(contractName)) {
    return false;
  }

  return true;
}

/**
 * Validates a Stacks principal (address) format
 * 
 * Format: SP or SM followed by 26-40 base58 characters
 * Base58 alphabet: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0
 * (excludes O, I, l to avoid confusion, but 0 is valid)
 */
export function isValidPrincipal(principal: string): boolean {
  if (typeof principal !== 'string' || !principal) {
    return false;
  }

  // Must start with SP or SM
  if (!principal.startsWith('SP') && !principal.startsWith('SM')) {
    return false;
  }

  // Check total length - real principals are typically 41 characters
  if (principal.length < 28 || principal.length > 42) {
    return false;
  }

  // Validate base58 characters after SP/SM prefix (excludes O, I, l)
  const addressPart = principal.slice(2);
  const base58Regex = /^[123456789ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0]+$/;
  
  return base58Regex.test(addressPart);
}

/**
 * Validates a Stacks contract name format
 * 
 * Rules:
 * - 1-128 characters
 * - Only lowercase letters, numbers, hyphens, and underscores
 * - Cannot start with a hyphen or underscore
 * - Cannot end with a hyphen or underscore
 */
export function isValidContractName(contractName: string): boolean {
  if (typeof contractName !== 'string' || !contractName) {
    return false;
  }

  // Length check
  if (contractName.length < 1 || contractName.length > 128) {
    return false;
  }

  // Character set check (lowercase letters, numbers, hyphens, underscores)
  const nameRegex = /^[a-z0-9_-]+$/;
  if (!nameRegex.test(contractName)) {
    return false;
  }

  // Cannot start or end with hyphen or underscore
  if (contractName.startsWith('-') || contractName.startsWith('_') ||
      contractName.endsWith('-') || contractName.endsWith('_')) {
    return false;
  }

  return true;
}

/**
 * Validates multiple contract IDs
 */
export function areValidContractIds(contractIds: string[]): boolean {
  return Array.isArray(contractIds) && 
         contractIds.length > 0 && 
         contractIds.every(isValidContractId);
}

/**
 * Extracts principal from a contract ID
 */
export function extractPrincipal(contractId: string): string | null {
  if (!isValidContractId(contractId)) {
    return null;
  }
  return contractId.split('.')[0];
}

/**
 * Extracts contract name from a contract ID
 */
export function extractContractName(contractId: string): string | null {
  if (!isValidContractId(contractId)) {
    return null;
  }
  return contractId.split('.')[1];
}