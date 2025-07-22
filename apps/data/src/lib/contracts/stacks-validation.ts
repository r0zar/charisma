export interface StacksAddress {
  network: 'mainnet' | 'testnet';
  type: 'standard' | 'contract';
  address: string;
  contractName?: string;
}

export interface TokenPair {
  base: string;
  quote: string;
}

export interface ParsedApiPath {
  type: 'addresses' | 'contracts' | 'prices';
  address?: StacksAddress;
  functionName?: string;
  tokenPair?: TokenPair;
  action?: string; // e.g., 'balances', 'transactions', 'current', 'history'
}

/**
 * Base58 alphabet (Modified for Stacks address compatibility - includes 0)
 */
const BASE58_ALPHABET = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Validates base58 characters (Edge Runtime compatible)
 */
function isValidBase58(str: string): boolean {
  if (!str) return false;

  for (let i = 0; i < str.length; i++) {
    if (!BASE58_ALPHABET.includes(str[i])) {
      return false;
    }
  }
  return true;
}

/**
 * Validates a Stacks address format (Edge Runtime compatible)
 * Mainnet: SP/SM prefix + 39 base58 characters (41 total)
 * Testnet: ST prefix + 37 base58 characters (39 total)
 */
export function validateStacksAddress(address: string): boolean {
  if (!address) return false;

  // Check prefix first
  const prefix = address.slice(0, 2);
  if (!['SP', 'SM', 'ST'].includes(prefix)) return false;

  // Check length - Stacks addresses are typically 39-41 characters
  if (address.length < 39 || address.length > 41) return false;

  // Check remaining characters are valid base58
  const addressBody = address.slice(2);
  return isValidBase58(addressBody);
}

/**
 * Parses a Stacks address with optional contract name
 */
export function parseStacksAddress(addressPath: string): StacksAddress | null {
  const parts = addressPath.split('.');
  const address = parts[0];
  const contractName = parts[1];

  if (!validateStacksAddress(address)) {
    return null;
  }

  const network = address.startsWith('ST') ? 'testnet' : 'mainnet';
  const type = address.startsWith('SM') ? 'contract' : 'standard';

  return {
    network,
    type,
    address,
    ...(contractName && { contractName })
  };
}

/**
 * Validates a token pair format (e.g., "STX-USDA", "WELSH-STX")
 */
export function validateTokenPair(pair: string): TokenPair | null {
  const parts = pair.split('-');
  if (parts.length !== 2) return null;

  const [base, quote] = parts;
  if (!base || !quote) return null;

  // Basic token symbol validation (alphanumeric, 2-10 chars)
  const tokenRegex = /^[A-Z0-9]{2,10}$/;
  if (!tokenRegex.test(base) || !tokenRegex.test(quote)) return null;

  return { base, quote };
}

/**
 * Validates contract function name (alphanumeric, dashes, underscores)
 */
export function validateContractFunction(functionName: string): boolean {
  if (!functionName) return false;
  return /^[a-z0-9\-_]+$/i.test(functionName);
}

/**
 * Extracts path components for API routing
 */
export function parseApiPath(path: string[]): {
  type: 'addresses' | 'contracts' | 'prices';
  address?: StacksAddress;
  functionName?: string;
  tokenPair?: TokenPair;
  action?: string;
} | null {
  if (path.length < 2) return null;

  const [type, identifier, ...rest] = path;

  switch (type) {
    case 'addresses': {
      const address = parseStacksAddress(identifier);
      if (!address) return null;

      const action = rest[0]; // 'balances', 'transactions', etc.
      return { type: 'addresses', address, action };
    }

    case 'contracts': {
      const address = parseStacksAddress(identifier);
      if (!address) return null;

      const functionName = rest[0];
      if (functionName && !validateContractFunction(functionName)) return null;

      return { type: 'contracts', address, functionName };
    }

    case 'prices': {
      const tokenPair = validateTokenPair(identifier);
      if (!tokenPair) return null;

      const action = rest[0]; // 'current', 'history', etc.
      return { type: 'prices', tokenPair, action };
    }

    default:
      return null;
  }
}

/**
 * Generates blob storage path from parsed API components
 */
export function generateBlobPath(parsed: ReturnType<typeof parseApiPath>): string | null {
  if (!parsed) return null;

  switch (parsed.type) {
    case 'addresses':
      if (!parsed.address || !parsed.action) return null;
      return `addresses/${parsed.address.address}/${parsed.action}`;

    case 'contracts':
      {
        if (!parsed.address) return null;
        const basePath = `contracts/${parsed.address.address}`;
        return parsed.functionName
          ? `${basePath}/${parsed.functionName}`
          : `${basePath}/metadata`;
      }

    case 'prices':
      if (!parsed.tokenPair || !parsed.action) return null;
      return `prices/${parsed.tokenPair.base}-${parsed.tokenPair.quote}/${parsed.action}`;

    default:
      return null;
  }
}