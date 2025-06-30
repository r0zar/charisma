/**
 * Token utilities for handling subnet token detection and base contract mapping
 */

/**
 * Known subnet token mappings for client-side merging
 * Maps subnet contract IDs to their mainnet base contracts
 */
export const KNOWN_SUBNET_MAPPINGS = new Map([
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.leo-token-subnet-v1', 'SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.kangaroo-subnet', 'SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1', 'SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.usda-token-subnet', 'SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken-subnet', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dmtoken'],
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.nope-subnet', 'SP32AEEF6WW5Y0NMJ1S8SBSZDAY8R5J32NBZFPKKZ.nope'],
  ['SP2KGJEAZRDVK78ZWTRGSDE11A1VMZVEATNQFZ73C.world-peace-stacks-stxcity-subnet', 'SP14J806BWEPQAXVA0G6RYZN7GNA126B7JFRRYTEM.world-peace-stacks-stxcity']
]);

/**
 * Detect if a contract ID is a subnet token
 */
export function isSubnetToken(contractId: string, metadata?: { type?: string; base?: string }): boolean {
  // Check metadata first if available
  if (metadata?.type === 'SUBNET') {
    return true;
  }
  // Fall back to known mappings
  return KNOWN_SUBNET_MAPPINGS.has(contractId);
}

/**
 * Get the base contract ID for a subnet token
 */
export function getBaseContractId(contractId: string, metadata?: { base?: string }): string {
  // Use metadata base field if available
  if (metadata?.base) {
    return metadata.base;
  }
  // Fall back to known mappings
  return KNOWN_SUBNET_MAPPINGS.get(contractId) || contractId;
}

/**
 * Get the base contract key for balance storage
 * This is used to group mainnet and subnet balances under the same key
 */
export function getBalanceKey(userId: string, contractId: string, metadata?: { type?: string; base?: string }): string {
  const baseContract = isSubnetToken(contractId, metadata)
    ? getBaseContractId(contractId, metadata)
    : contractId;

  return `${userId}:${baseContract}`;
}

/**
 * Check if two contract IDs belong to the same token family (mainnet + subnet)
 */
export function areRelatedTokens(contractId1: string, contractId2: string, metadata1?: { type?: string; base?: string }, metadata2?: { type?: string; base?: string }): boolean {
  const base1 = getBaseContractId(contractId1, metadata1);
  const base2 = getBaseContractId(contractId2, metadata2);
  return base1 === base2;
}

/**
 * Extract token family info for debugging and logging
 */
export function getTokenFamily(contractId: string, metadata?: { type?: string; base?: string }): {
  contractId: string;
  baseContractId: string;
  isSubnet: boolean;
  source: 'metadata' | 'known-mapping' | 'inferred' | 'original';
} {
  const isSubnet = isSubnetToken(contractId, metadata);
  let baseContractId = contractId;
  let source: 'metadata' | 'known-mapping' | 'inferred' | 'original' = 'original';

  if (isSubnet) {
    if (metadata?.base) {
      baseContractId = metadata.base;
      source = 'metadata';
    } else if (KNOWN_SUBNET_MAPPINGS.has(contractId)) {
      baseContractId = KNOWN_SUBNET_MAPPINGS.get(contractId)!;
      source = 'known-mapping';
    } else {
      const inferred = getBaseContractId(contractId);
      if (inferred !== contractId) {
        baseContractId = inferred;
        source = 'inferred';
      }
    }
  }

  return {
    contractId,
    baseContractId,
    isSubnet,
    source
  };
}