/**
 * TypeScript interfaces for getContractInfoWithParsedAbi response structure
 * 
 * Based on real API testing with PoX-4 contract analysis:
 * - abi: Raw byte array (5000+ items) representing source code
 * - parsed_abi: Structured object with functions, variables, maps, etc.
 */

// Re-export the actual ClarityType from polyglot
export type ClarityType = string | {
  response: {
    ok: ClarityType;
    error: ClarityType;
  };
} | {
  optional: ClarityType;
} | {
  tuple: Array<{
    name: string;
    type: ClarityType;
  }>;
} | {
  list: {
    type: ClarityType;
    length: number;
  };
} | {
  buffer: {
    length: number;
  };
} | {
  "string-ascii": {
    length: number;
  };
} | {
  "string-utf8": {
    length: number;
  };
} | "trait_reference" | "none";

export interface ClarityArgument {
  name: string;
  type: ClarityType;
}

export interface ClarityFunction {
  name: string;
  access: 'public' | 'read_only' | 'private';
  args: ClarityArgument[];
  outputs: {
    type: ClarityType;
  };
}

export interface ClarityVariable {
  name: string;
  type: ClarityType;
  access: 'constant' | 'variable';
}

export interface ClarityMap {
  name: string;
  key: ClarityType;
  value: ClarityType;
}

export interface ClarityFungibleToken {
  name: string;
  supply?: ClarityType;
}

export interface ClarityNonFungibleToken {
  name: string;
  type: ClarityType;
}

/**
 * Structured ABI format returned by getContractInfoWithParsedAbi
 * Found in the `parsed_abi` property (not `abi` which is a byte array)
 */
export interface ParsedContractAbi {
  functions: ClarityFunction[];
  variables: ClarityVariable[];
  maps: ClarityMap[];
  fungible_tokens: ClarityFungibleToken[];
  non_fungible_tokens: ClarityNonFungibleToken[];
  clarity_version?: string;
}

/**
 * Complete response from getContractInfoWithParsedAbi
 * 
 * Key findings from real API testing:
 * - abi: Array of 5000+ numbers (byte array, likely source code)
 * - parsed_abi: Structured object with contract interface details
 * - Functions: Array of function definitions with name, access, args, outputs
 * - Variables: Contract constants and variables
 * - Maps: Contract data maps
 * - Tokens: Fungible and non-fungible token definitions
 */
export interface ContractInfoWithParsedAbi {
  tx_id: string;
  canonical: boolean;
  contract_id: string;
  block_height: number;
  clarity_version: number | null; // Match polyglot type
  source_code: string;
  abi: number[]; // Raw byte array (not useful for trait analysis)
  parsed_abi: ParsedContractAbi | null; // Structured ABI (use this for trait analysis)
}

/**
 * Helper type to access the correct ABI for trait analysis
 * Always use parsed_abi for structured contract interface analysis
 */
export type ContractAbiForAnalysis = ParsedContractAbi;

/**
 * Type guard to check if contract info has valid parsed ABI
 */
export function hasValidParsedAbi(contractInfo: any): contractInfo is ContractInfoWithParsedAbi {
  return (
    contractInfo &&
    typeof contractInfo === 'object' &&
    contractInfo.parsed_abi &&
    typeof contractInfo.parsed_abi === 'object' &&
    Array.isArray(contractInfo.parsed_abi.functions)
  );
}

/**
 * Extract functions from contract info safely
 */
export function extractFunctions(contractInfo: ContractInfoWithParsedAbi): ClarityFunction[] {
  return contractInfo.parsed_abi?.functions || [];
}

/**
 * Check if contract implements a specific function by name
 */
export function hasFunction(contractInfo: ContractInfoWithParsedAbi, functionName: string): boolean {
  const functions = extractFunctions(contractInfo);
  return functions.some(func => func.name === functionName);
}

/**
 * Check if contract implements SIP-010 fungible token standard
 * Requires: transfer, get-name, get-symbol, get-decimals, get-balance, get-total-supply
 */
export function implementsSip010(contractInfo: ContractInfoWithParsedAbi): boolean {
  const requiredFunctions = [
    'transfer',
    'get-name', 
    'get-symbol',
    'get-decimals',
    'get-balance',
    'get-total-supply'
  ];
  
  return requiredFunctions.every(funcName => hasFunction(contractInfo, funcName));
}

/**
 * Check if contract implements SIP-009 non-fungible token standard
 * Requires: get-last-token-id, get-token-uri, get-owner, transfer
 */
export function implementsSip009(contractInfo: ContractInfoWithParsedAbi): boolean {
  const requiredFunctions = [
    'get-last-token-id',
    'get-token-uri', 
    'get-owner',
    'transfer'
  ];
  
  return requiredFunctions.every(funcName => hasFunction(contractInfo, funcName));
}