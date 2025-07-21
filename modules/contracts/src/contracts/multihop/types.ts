import type { Vault, VaultResult } from '../../traits/Vault';
import type { SIP010 } from '../../traits/SIP010';

/**
 * VaultOperation interface for generic vault operations
 * Represents any executable command on any vault
 */
export interface VaultOperation {
  vault: Vault;     // Vault implementation to execute operation on
  opcode?: string;  // Optional opcode for vault operations
}

/**
 * Router configuration for pathfinding and execution
 */
export interface MultihopConfig {
  maxHops: number;
  debug: boolean;
  defaultSlippage: number;
  quoteCacheTTL: number;
  maxPathsToEvaluate: number;
}

/**
 * Default configuration values
 */
export const defaultMultihopConfig: MultihopConfig = {
  maxHops: 9,
  debug: false,
  defaultSlippage: 0.01,
  quoteCacheTTL: 30000,
  maxPathsToEvaluate: 5
};

/**
 * Route opcodes for different vault operations
 */
export const OPCODES = {
  SWAP_A_TO_B: '00',
  SWAP_B_TO_A: '01',
  ADD_LIQUIDITY: '02',
  REMOVE_LIQUIDITY: '03',
  LOOKUP_RESERVES: '04',
  OP_DEPOSIT: '05',
  OP_WITHDRAW: '06',
} as const;

/**
 * Hop information for routing
 */
export interface RouteHop {
  vault: Vault;
  tokenIn: SIP010;
  tokenOut: SIP010;
  opcode: string;
  quote?: VaultResult;
}

/**
 * Complete route information
 */
export interface Route {
  path: SIP010[];
  hops: RouteHop[];
  amountIn: string;
  amountOut: string;
}

/**
 * Graph edge for pathfinding
 */
export interface GraphEdge {
  vault: Vault;
  target: SIP010;
}

/**
 * Graph node for pathfinding
 */
export interface GraphNode {
  token: SIP010;
  edges: Map<string, GraphEdge>;
}

/**
 * Cached quote entry
 */
export interface CachedQuote {
  result: VaultResult;
  timestamp: number;
}