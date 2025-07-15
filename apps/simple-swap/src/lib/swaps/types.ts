/**
 * Types for tracking instant swap records
 */

export type SwapStatus = 'pending' | 'completed' | 'failed';

export interface SwapRecord {
  id: string;                    // unique identifier (UUID)
  type: 'instant';               // swap type (start with instant, can expand later)
  owner: string;                 // user wallet address
  inputToken: string;            // from token contract ID
  outputToken: string;           // to token contract ID
  inputAmount: string;           // amount in (micro units as string)
  outputAmount?: string;         // amount out (micro units as string, set when completed)
  status: SwapStatus;            // current status
  txid?: string;                 // blockchain transaction ID
  timestamp: number;             // creation timestamp (Date.now())
  completedAt?: number;          // completion timestamp
  
  // Routing and execution details
  routePath?: string[];          // swap route contract IDs
  priceImpact?: number;          // price impact percentage (0-100)
  
  // Extensible metadata
  metadata?: Record<string, any>;
}

export interface SwapRecordListOptions {
  owner?: string;                // filter by wallet address
  status?: SwapStatus;           // filter by status
  type?: 'instant';              // filter by swap type
  limit?: number;                // pagination limit
  offset?: number;               // pagination offset
  sortBy?: 'timestamp' | 'completedAt'; // sort field
  sortOrder?: 'asc' | 'desc';    // sort direction
}

export interface SwapRecordListResult {
  swaps: SwapRecord[];
  total: number;
  hasMore: boolean;
}

// For creating new swap records
export interface CreateSwapRecordInput {
  owner: string;
  inputToken: string;
  outputToken: string;
  inputAmount: string;
  routePath?: string[];
  priceImpact?: number;
  metadata?: Record<string, any>;
}

// For updating swap status
export interface UpdateSwapRecordInput {
  status: SwapStatus;
  txid?: string;
  outputAmount?: string;
  completedAt?: number;
  metadata?: Record<string, any>;
}