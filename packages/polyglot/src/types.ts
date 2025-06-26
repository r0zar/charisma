/**
 * Type definitions for the Polyglot blockchain API client
 */

// Define the structure for the contract interface based on the API docs
export interface ContractInterface {
  functions: unknown[]; // Replace unknown with specific types if available
  variables: unknown[];
  maps: unknown[];
  fungible_tokens: unknown[];
  non_fungible_tokens: unknown[];
}

// Define the structure for the contract info based on actual API responses
export interface ContractInfo {
  tx_id: string;
  canonical: boolean;
  contract_id: string;
  block_height: number;
  clarity_version: number | null; // Can be null (charisma-token) or number (auto-alex-v3: 2)
  source_code: string;
  abi: string; // This is a JSON string, could be parsed into ContractAbi type if needed
}

// Define Clarity type structure based on actual ABI responses
export type ClarityType = 
  | string // Simple types like "uint128", "bool", "principal"
  | {
      response: {
        ok: ClarityType;
        error: ClarityType;
      };
    }
  | {
      optional: ClarityType;
    }
  | {
      tuple: Array<{
        name: string;
        type: ClarityType;
      }>;
    }
  | {
      list: {
        type: ClarityType;
        length: number;
      };
    }
  | {
      buffer: {
        length: number;
      };
    }
  | {
      "string-ascii": {
        length: number;
      };
    }
  | {
      "string-utf8": {
        length: number;
      };
    }
  | "trait_reference"
  | "none";

// Define the structure for the parsed ABI based on actual responses
export interface ContractAbi {
  maps: Array<{
    key: string;
    name: string;
    value: string;
  }>;
  epoch: string; // e.g., "Epoch24", "Epoch25"
  functions: Array<{
    args: Array<{
      name: string;
      type: ClarityType;
    }>;
    name: string;
    access: "public" | "private" | "read_only";
    outputs: {
      type: ClarityType;
    };
  }>;
  variables: Array<{
    name: string;
    type: ClarityType;
    access: "constant" | "variable";
  }>;
  clarity_version: string; // e.g., "Clarity2"
  fungible_tokens: Array<{
    name: string;
  }>;
  non_fungible_tokens: Array<{
    name: string;
  }>;
}

/**
 * Enhanced contract info that includes parsed ABI
 */
export interface ContractInfoWithParsedAbi extends Omit<ContractInfo, 'abi'> {
  abi: string; // Keep original string
  parsed_abi: ContractAbi | null; // Add parsed version
}

/**
 * Interface for STX token balance information 
 */
export interface StxBalanceInfo {
  balance: string;
  total_sent: string;
  total_received: string;
  lock_tx_id?: string;
  locked?: string;
  lock_height?: number;
  burnchain_lock_height?: number;
  burnchain_unlock_height?: number;
}

/**
 * Interface for fungible token balances 
 */
export interface FungibleTokenBalances {
  [key: string]: {
    balance: string;
    total_sent: string;
    total_received: string;
  };
}

/**
 * Interface for non-fungible token balances 
 */
export interface NonFungibleTokenBalances {
  [key: string]: {
    count: string;
    total_sent: string;
    total_received: string;
  };
}

/**
 * Interface for account balances response 
 */
export interface AccountBalancesResponse {
  stx: StxBalanceInfo;
  fungible_tokens: FungibleTokenBalances;
  non_fungible_tokens: NonFungibleTokenBalances;
}

/**
 * Interface for BNS names response
 */
export interface BnsNamesResponse {
  names: string[];
}

/**
 * Interface for BNS name resolution response
 */
export interface BnsNameResolutionResponse {
  address: string;
  zonefile_hash?: string;
  zonefile?: string;
  expire_block?: number;
  grace_period?: boolean;
}

/**
 * Interface for transaction results from getRecentTransactions
 */
export interface TransactionResults {
  limit: number;
  offset: number;
  total: number;
  results: Transaction[];
}

/**
 * Base transaction interface - covers common fields for all transaction types
 */
export interface BaseTransaction {
  tx_id: string;
  nonce: number;
  fee_rate: string;
  sender_address: string;
  sponsored: boolean;
  post_condition_mode: "allow" | "deny";
  post_conditions: PostCondition[];
  anchor_mode: "on_chain_only" | "any";
  block_hash: string;
  block_height: number;
  block_time: number;
  block_time_iso: string;
  burn_block_time: number;
  burn_block_height: number;
  burn_block_time_iso: string;
  parent_burn_block_time: number;
  parent_burn_block_time_iso: string;
  canonical: boolean;
  tx_index: number;
  tx_status: "success" | "abort_by_response" | "abort_by_post_condition" | "pending";
  tx_result: {
    hex: string;
    repr: string;
  };
  event_count: number;
  parent_block_hash: string;
  is_unanchored: boolean;
  microblock_hash: string;
  microblock_sequence: number;
  microblock_canonical: boolean;
  execution_cost_read_count: number;
  execution_cost_read_length: number;
  execution_cost_runtime: number;
  execution_cost_write_count: number;
  execution_cost_write_length: number;
  vm_error: string | null;
  events: any[]; // Event objects can be complex, keeping as any for now
}

/**
 * Specific transaction types
 */
export interface CoinbaseTransaction extends BaseTransaction {
  tx_type: "coinbase";
  coinbase_payload: {
    data: string;
    alt_recipient: string | null;
    vrf_proof: string;
  };
}

export interface TenureChangeTransaction extends BaseTransaction {
  tx_type: "tenure_change";
  tenure_change_payload: any; // Structure varies, keeping as any for now
}

export interface TokenTransferTransaction extends BaseTransaction {
  tx_type: "token_transfer";
  token_transfer: {
    recipient_address: string;
    amount: string;
    memo: string;
  };
}

export interface ContractCallTransaction extends BaseTransaction {
  tx_type: "contract_call";
  contract_call: {
    contract_id: string;
    function_name: string;
    function_signature: string;
    function_args: Array<{
      hex: string;
      repr: string;
      name: string;
      type: string;
    }>;
  };
}

export interface SmartContractTransaction extends BaseTransaction {
  tx_type: "smart_contract";
  smart_contract: {
    contract_id: string;
    source_code: string;
  };
}

export interface PoisonMicroblockTransaction extends BaseTransaction {
  tx_type: "poison_microblock";
  poison_microblock: any; // Structure varies, keeping as any for now
}

/**
 * Union type for all transaction types
 */
export type Transaction = 
  | CoinbaseTransaction 
  | TenureChangeTransaction 
  | TokenTransferTransaction 
  | ContractCallTransaction 
  | SmartContractTransaction 
  | PoisonMicroblockTransaction;

/**
 * Post condition interfaces
 */
export interface PostCondition {
  principal: {
    type_id: string;
    address: string;
  };
  condition_code: string;
  amount: string;
  type: "fungible" | "non_fungible" | "stx";
  asset?: {
    asset_name: string;
    contract_address: string;
    contract_name: string;
  };
}