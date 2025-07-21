import { ClarityValue, cvToHex, cvToValue, hexToCV } from "@stacks/transactions";
import { apiClient } from "./blockchain-api-client";
import { TransactionEventsResponse } from "@stacks/stacks-blockchain-api-types";

// Import all types from the types module
export type {
  ContractInterface,
  ContractInfo,
  ContractAbi,
  ContractInfoWithParsedAbi,
  ClarityType,
  StxBalanceInfo,
  FungibleTokenBalances,
  NonFungibleTokenBalances,
  AccountBalancesResponse,
  BnsNamesResponse,
  BnsNameResolutionResponse,
  TransactionResults,
  Transaction,
  BaseTransaction,
  CoinbaseTransaction,
  TenureChangeTransaction,
  TokenTransferTransaction,
  ContractCallTransaction,
  SmartContractTransaction,
  PoisonMicroblockTransaction,
  PostCondition,
} from "./types";

import type {
  ContractInterface,
  ContractInfo,
  ContractAbi,
  ContractInfoWithParsedAbi,
  AccountBalancesResponse,
  BnsNamesResponse,
  BnsNameResolutionResponse,
  TransactionResults,
  Transaction,
  FungibleTokenBalances,
} from "./types";

/**
 * Fetches the interface for a specified smart contract.
 * @param contractAddress The Stacks address of the contract.
 * @param contractName The name of the contract.
 * @param tip Optional Stacks chain tip to query from.
 * @returns A promise that resolves to the contract interface.
 */
export async function getContractInterface(
  contractAddress: string,
  contractName: string,
  tip?: string
): Promise<ContractInterface> {
  try {
    // https://api.mainnet.hiro.so/v2/contracts/interface/{contract_address}/{contract_name}
    const { data } = await apiClient.GET(`/v2/contracts/interface/${contractAddress}/${contractName}` as any, {
      contractAddress,
      contractName,
      tip,
    });
    // We might need type casting or validation here depending on the exact return type
    return data as ContractInterface;
  } catch (error) {
    console.error("Error fetching contract interface:", error);
    // Consider more robust error handling
    throw new Error("Failed to fetch contract interface.");
  }
}

/**
 * Generic wrapper for calling read-only functions on Stacks smart contracts.
 * Returns the raw response without parsing.
 * 
 * @param contractAddress The contract's address
 * @param contractName The contract's name
 * @param functionName The function to call
 * @param args The arguments to pass to the function (should be properly formatted for Clarity)
 * @param sender Optional sender address (defaults to contract address)
 * @returns A promise that resolves to the raw contract call response
 */
export async function callReadOnlyFunction(
  contractAddress: string,
  contractName: string,
  functionName: string,
  args: ClarityValue[] = [],
  sender?: string
): Promise<{ value: any, type: any } | null> {
  try {
    const endpoint = `/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;

    const response = await apiClient.POST(endpoint as any, {
      body: {
        sender: sender || contractAddress,
        arguments: args.map(arg => cvToHex(arg)),
      }
    });

    if (!response.data?.result) {
      console.warn(response.error)
      return null
    };
    return cvToValue(hexToCV(response.data.result));
  } catch (error) {
    console.error(`Error calling ${contractAddress}:`, error);
    return null;
  }
}


/**
 * Generic wrapper for calling read-only functions on Stacks smart contracts.
 * Returns the raw response without parsing.
 * 
 * @param contractId The contract's address and name (e.g., SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.satoshibles).
 * @param functionName The function to call
 * @param args The arguments to pass to the function (should be properly formatted for Clarity)
 * @param sender Optional sender address (defaults to contract address)
 * @returns A promise that resolves to the raw contract call response
 */
export async function callReadOnly(
  contractId: string,
  functionName: string,
  args: ClarityValue[] = []
): Promise<any> {
  try {
    const [contractAddress, contractName] = contractId.split(".");
    const endpoint = `/v2/contracts/call-read/${contractAddress}/${contractName}/${functionName}`;

    const response = await apiClient.POST(endpoint as any, {
      body: {
        sender: contractAddress,
        arguments: args.map(arg => cvToHex(arg)),
      }
    });

    if (!response.data?.result) {
      console.warn(response.error)
      return null
    };
    return cvToValue(hexToCV(response.data.result));
  } catch (error) {
    console.error(`Error calling ${contractId}:`, error);
    return null;
  }
}

/**
 * Parses the ABI string from contract info into a typed ContractAbi object
 * @param abiString The JSON string from the contract info's abi field
 * @returns Parsed ContractAbi object or null if parsing fails
 */
export function parseContractAbi(abiString: string): ContractAbi | null {
  try {
    return JSON.parse(abiString) as ContractAbi;
  } catch (error) {
    console.error("Failed to parse contract ABI:", error);
    return null;
  }
}


/**
 * Fetches the information for a specified smart contract.
 * @param contract_id The Stacks address and name of the contract (e.g., SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.satoshibles).
 * @param unanchored Optional boolean to include transaction data from unanchored microblocks.
 * @returns A promise that resolves to the contract information.
 */
export async function getContractInfo(
  contract_id: string,
  unanchored: boolean = false
): Promise<ContractInfo | null> {
  try {
    const { response, data, error } = await apiClient.GET(`/extended/v1/contract/${contract_id}` as any, {
      params: {
        query: {
          unanchored,
        },
      },
    });
    if (!response.ok) {
      console.error(error)
      throw new Error(`${error.error}: ${error.message}`);
    }
    return data as ContractInfo;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      console.warn(`Contract not found: ${contract_id}`);
      return null;
    }
    console.error("Error fetching contract info:", error);
    throw new Error("Failed to fetch contract info.");
  }
}

/**
 * Fetches contract information with parsed ABI for easier type-safe access
 * @param contract_id The Stacks address and name of the contract
 * @param unanchored Optional boolean to include transaction data from unanchored microblocks
 * @returns A promise that resolves to contract information with parsed ABI
 */
export async function getContractInfoWithParsedAbi(
  contract_id: string,
  unanchored: boolean = false
): Promise<ContractInfoWithParsedAbi | null> {
  const contractInfo = await getContractInfo(contract_id, unanchored);
  if (!contractInfo) {
    return null;
  }

  const parsed_abi = parseContractAbi(contractInfo.abi);

  return {
    ...contractInfo,
    parsed_abi,
  };
}

/**
 * Helper function to trim tokenKey suffixes (::identifier) from contract IDs
 * @param tokenKey The tokenKey that might have a suffix
 * @returns The contract ID without the suffix
 */
function extractContractId(tokenKey: string): string {
  const colonIndex = tokenKey.indexOf('::');
  return colonIndex !== -1 ? tokenKey.substring(0, colonIndex) : tokenKey;
}

/**
 * Helper function to trim tokenKey suffixes from balance objects
 * @param balances The original fungible token balances
 * @returns The balances with trimmed keys and merged duplicate balances
 */
function trimTokenKeySuffixes(balances: FungibleTokenBalances): FungibleTokenBalances {
  const trimmedBalances: FungibleTokenBalances = {};

  for (const [tokenKey, balance] of Object.entries(balances)) {
    const contractId = extractContractId(tokenKey);

    // If we already have a balance for this contract ID, merge the balances
    if (trimmedBalances[contractId]) {
      const existingBalance = parseFloat(trimmedBalances[contractId].balance || '0');
      const existingTotalSent = parseFloat(trimmedBalances[contractId].total_sent || '0');
      const existingTotalReceived = parseFloat(trimmedBalances[contractId].total_received || '0');

      const newBalance = parseFloat(balance.balance || '0');
      const newTotalSent = parseFloat(balance.total_sent || '0');
      const newTotalReceived = parseFloat(balance.total_received || '0');

      // Merge the balances by summing them
      trimmedBalances[contractId] = {
        balance: (existingBalance + newBalance).toString(),
        total_sent: (existingTotalSent + newTotalSent).toString(),
        total_received: (existingTotalReceived + newTotalReceived).toString()
      };
    } else {
      trimmedBalances[contractId] = balance;
    }
  }

  return trimmedBalances;
}

/**
 * Fetches account balance information for a Stacks address or a contract identifier.
 * Includes balances of STX tokens, fungible tokens, and non-fungible tokens.
 * 
 * @param principal Stacks address or contract identifier
 * @param params Optional parameters
 * @param params.unanchored Whether to include transaction data from unanchored microblocks
 * @param params.until_block Return data representing the state up until that block height
 * @param params.trim Whether to trim tokenKey suffixes (::identifier) from fungible token keys
 * @returns A promise that resolves to the account balances
 */
export async function getAccountBalances(
  principal: string,
  params?: {
    unanchored?: boolean;
    until_block?: string;
    trim?: boolean;
  }
): Promise<AccountBalancesResponse | null> {
  try {
    const { data } = await apiClient.GET(`/extended/v1/address/${principal}/balances` as any, {
      params: {
        query: {
          unanchored: params?.unanchored ?? true,
          until_block: params?.until_block,
        },
      },
    });

    const balances = data as AccountBalancesResponse;

    // If trim is enabled, trim the tokenKey suffixes
    if (params?.trim) {
      balances.fungible_tokens = trimTokenKeySuffixes(balances.fungible_tokens || {});
    }

    return balances;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      console.warn(`Address or contract not found: ${principal}`);
      return null;
    }
    console.error(`Error fetching account balances for ${principal}:`, error);
    throw new Error("Failed to fetch account balances.");
  }
}

export const getRecentTransactions = async (params?: {
  limit?: number;
  offset?: number;
  type?: Array<"coinbase" | "token_transfer" | "smart_contract" | "contract_call" | "poison_microblock">;
  unanchored?: boolean;
}): Promise<TransactionResults> => {
  const txs = await apiClient.GET(`/extended/v1/tx` as any, {
    params: {
      query: {
        limit: params?.limit ?? 96,
        offset: params?.offset,
        type: params?.type,
        unanchored: params?.unanchored ?? false,
      },
    },
  });
  return txs.data as TransactionResults;
};

export const getMempoolTransactions = async (params?: {
  sender_address?: string;
  recipient_address?: string;
  address?: string;
  limit?: number;
  offset?: number;
  unanchored?: boolean;
}): Promise<TransactionResults> => {
  const txs = await apiClient.GET(`/extended/v1/tx/mempool` as any, {
    params: {
      query: {
        limit: params?.limit ?? 20,
        offset: params?.offset,
        sender_address: params?.sender_address,
        recipient_address: params?.recipient_address,
        address: params?.address,
        unanchored: params?.unanchored ?? false,
      },
    },
  });
  return txs.data as TransactionResults;
};

export async function fetchStxBalance(address: string): Promise<number> {
  try {
    const { data } = await apiClient.GET(`/extended/v1/address/${address}/stx` as any);
    return Number(data.balance || 0);
  } catch (error) {
    console.error(`Failed fetching STX balance for ${address}:`, error);
    return 0;
  }
}

/**
 * Fetches the total supply of STX tokens from the Hiro API.
 * Returns the total supply for STX tokens as a string (uses the estimated future total supply for the year 2050).
 * 
 * @returns A promise that resolves to the total STX supply as a string
 */
export async function getStxTotalSupply(): Promise<number> {
  try {
    const response = await apiClient.GET('/extended/v1/stx_supply/total/plain' as any);

    if (!response.data) {
      throw new Error(`STX total supply API error: ${response.error}`);
    }

    const totalSupply = Number(response.data);
    return totalSupply
  } catch (error) {
    console.error('Failed fetching STX total supply:', error);
    throw new Error('Failed to fetch STX total supply');
  }
}

export async function getTransactionDetails(txId: string): Promise<Transaction> {
  const { data } = await apiClient.GET(`/extended/v1/tx/${txId}` as any, {
    params: {
      query: {
        event_limit: 100,
        event_offset: 0,
      },
    },
  });
  return data as unknown as Transaction;
}

/**
 * Retrieves the list of events filtered by principal (STX address or Smart Contract ID), 
 * transaction id or event types.
 * 
 * @param params Query parameters for filtering events
 * @param params.tx_id Hash of transaction
 * @param params.address Stacks address or a Contract identifier
 * @param params.limit Number of items to return (default: 100)
 * @param params.offset Number of items to skip (default: 0)
 * @param params.type Filter the events on event type
 * @returns A promise that resolves to the transaction events response
 */
export async function getTransactionEvents(params?: {
  tx_id?: string;
  address?: string;
  limit?: number;
  offset?: number;
  type?: Array<'smart_contract_log' | 'stx_lock' | 'stx_asset' | 'fungible_token_asset' | 'non_fungible_token_asset'>;
}): Promise<any> {
  try {
    const { data } = await apiClient.GET('/extended/v1/tx/events' as any, {
      params: {
        query: {
          tx_id: params?.tx_id,
          address: params?.address,
          limit: params?.limit ?? 100,
          offset: params?.offset ?? 0,
          type: params?.type,
        },
      },
    });
    return data;
  } catch (error) {
    console.error('Error fetching transaction events:', error);
    throw new Error('Failed to fetch transaction events.');
  }
}

export async function fetchContractEvents(address: string, { limit = 100, offset = 0 }: { limit?: number, offset?: number } = {}): Promise<TransactionEventsResponse> {
  const { data } = await apiClient.GET(`/extended/v1/contract/${address}/events` as any, {
    limit,
    offset,
  });
  return data as unknown as TransactionEventsResponse;
}

export const fetcHoldToEarnLogs = async (contractAddress: string) => {
  const data = await fetchContractEvents(contractAddress);
  const logs = data.results.map((r: any) => ({ ...(hexToCV(r.contract_log.value.hex) as any).value, tx_id: r.tx_id }));

  const logsFormattedPromises = logs.map(async (log: any) => {
    const { energy, integral, message, op, sender } = log;
    let txDetails = null;
    try {
      txDetails = await getTransactionDetails(log.tx_id as string);
    } catch (error) {
      console.error(`Failed to get transaction details for ${log.tx_id}:`, error);
    }

    return {
      energy: energy.value as bigint,
      integral: integral.value as bigint,
      message: message.value as string,
      op: op.value as string,
      sender: sender.value as string,
      tx_id: log.tx_id as string,
      block_height: txDetails?.block_height,
      block_time: txDetails?.block_time,
      block_time_iso: txDetails?.block_time_iso,
      tx_status: txDetails?.tx_status,
    };
  });

  const logsFormatted = await Promise.all(logsFormattedPromises);
  return logsFormatted;
}

/**
 * Fetches BNS names owned by a given address
 * @param address The Bitcoin or Stacks address to lookup
 * @param blockchain The blockchain type (bitcoin or stacks)
 * @returns A promise that resolves to the list of names owned by the address
 */
export async function getBnsNamesByAddress(
  address: string,
  blockchain: 'bitcoin' | 'stacks' = 'stacks'
): Promise<string[]> {
  try {
    const { data } = await apiClient.GET(`/v1/addresses/${blockchain}/${address}` as any);
    return (data as BnsNamesResponse)?.names || [];
  } catch (error: any) {
    if (error?.response?.status === 404) {
      console.warn(`No BNS names found for address: ${address}`);
      return [];
    }
    console.error(`Error fetching BNS names for ${address}:`, error);
    return [];
  }
}

/**
 * Gets the primary BNS name for an address (first name in the list)
 * @param address The Bitcoin or Stacks address to lookup
 * @param blockchain The blockchain type (bitcoin or stacks)
 * @returns A promise that resolves to the primary BNS name or null
 */
export async function getPrimaryBnsName(
  address: string,
  blockchain: 'bitcoin' | 'stacks' = 'stacks'
): Promise<string | null> {
  try {
    const names = await getBnsNamesByAddress(address, blockchain);
    return names.length > 0 ? names[0] : null;
  } catch (error) {
    console.error(`Error fetching primary BNS name for ${address}:`, error);
    return null;
  }
}

/**
 * Resolves a BNS name to its associated Stacks address
 * @param name The BNS name to resolve (e.g., "username.btc")
 * @returns A promise that resolves to the Stacks address or null if not found
 */
export async function resolveBnsNameToAddress(name: string): Promise<string | null> {
  try {
    const { data } = await apiClient.GET(`/v1/names/${name}` as any);
    const resolutionData = data as BnsNameResolutionResponse;
    return resolutionData?.address || null;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      console.warn(`BNS name not found: ${name}`);
      return null;
    }
    console.error(`Error resolving BNS name ${name}:`, error);
    return null;
  }
}

/**
 * Configuration for trait search functionality
 */
export interface TraitSearchConfig {
  apiKey?: string;
  debug?: boolean;
}

/**
 * Search for contracts implementing a specific trait using the Hiro API
 * @param trait The trait definition (ABI) to search for
 * @param config Configuration including API key and debug options
 * @param blacklist Array of contract IDs to exclude from results
 * @param maxResults Optional maximum number of results to return (for faster testing)
 * @returns A promise that resolves to an array of contracts implementing the trait
 */
export async function searchContractsByTrait(
  trait: any,
  config: TraitSearchConfig = {},
  blacklist: string[] = [],
  maxResults?: number
): Promise<any[]> {
  let allContracts: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const path = `/extended/v1/contract/by_trait?trait_abi=${encodeURIComponent(JSON.stringify(trait))}&limit=50&offset=${offset}`;
      const url = `https://api.hiro.so${path}`;

      const headers: Record<string, string> = { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      const apiKey = config.apiKey || "";
      if (apiKey) headers['x-api-key'] = apiKey;

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const results = data?.results || [];

      if (results.length === 0) {
        hasMore = false;
      } else {
        const filteredResults = results.filter(
          (contract: any) => !blacklist.includes(contract.contract_id)
        );
        allContracts = [...allContracts, ...filteredResults];
        offset += 50;
        
        // Check if we've reached the maximum results after adding new contracts
        if (maxResults && allContracts.length >= maxResults) {
          // Truncate to exact limit
          allContracts = allContracts.slice(0, maxResults);
          if (config.debug) {
            console.debug(`Reached maxResults limit of ${maxResults}, stopping search`);
          }
          break;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // 404 means we've reached the end of results - this is normal
      if (errorMessage.includes('HTTP 404') || errorMessage.includes('cannot find contract')) {
        if (config.debug) {
          console.debug(`Reached end of results at offset ${offset}`);
        }
        hasMore = false;
      } else {
        // Log other errors as warnings
        if (config.debug) {
          console.warn(`Error fetching contracts at offset ${offset}: ${errorMessage}`);
        }
        hasMore = false;
      }
    }
  }

  return allContracts;
}

/**
 * Interface representing all exported functions from the polyglot package
 * This can be used for type definitions in editors and other tools
 */
export interface PolyglotAPI {
  // Contract interface and read-only functions
  getContractInterface(contractAddress: string, contractName: string, tip?: string): Promise<ContractInterface>;
  callReadOnlyFunction(contractAddress: string, contractName: string, functionName: string, args?: ClarityValue[], sender?: string): Promise<{ value: any, type: any } | null>;
  callReadOnly(contractId: string, functionName: string, args?: ClarityValue[]): Promise<any>;
  parseContractAbi(abiString: string): ContractAbi | null;
  getContractInfo(contract_id: string, unanchored?: boolean): Promise<ContractInfo | null>;
  getContractInfoWithParsedAbi(contract_id: string, unanchored?: boolean): Promise<ContractInfoWithParsedAbi | null>;

  // Account and balance functions
  getAccountBalances(principal: string, params?: { unanchored?: boolean; until_block?: string; trim?: boolean; }): Promise<AccountBalancesResponse | null>;
  fetchStxBalance(address: string): Promise<number>;
  getStxTotalSupply(): Promise<number>;

  // Transaction functions
  getRecentTransactions(params?: { limit?: number; offset?: number; type?: Array<"coinbase" | "token_transfer" | "smart_contract" | "contract_call" | "poison_microblock">; unanchored?: boolean; }): Promise<TransactionResults>;
  getMempoolTransactions(params?: { sender_address?: string; recipient_address?: string; address?: string; limit?: number; offset?: number; unanchored?: boolean; }): Promise<TransactionResults>;
  getTransactionDetails(txId: string): Promise<Transaction>;
  getTransactionEvents(params?: { tx_id?: string; address?: string; limit?: number; offset?: number; type?: Array<'smart_contract_log' | 'stx_lock' | 'stx_asset' | 'fungible_token_asset' | 'non_fungible_token_asset'>; }): Promise<any>;

  // Contract events
  fetchContractEvents(address: string, options?: { limit?: number; offset?: number; }): Promise<TransactionEventsResponse>;
  fetcHoldToEarnLogs(contractAddress: string): Promise<any>;

  // BNS functions
  getBnsNamesByAddress(address: string, blockchain?: 'bitcoin' | 'stacks'): Promise<string[]>;
  getPrimaryBnsName(address: string, blockchain?: 'bitcoin' | 'stacks'): Promise<string | null>;
  resolveBnsNameToAddress(name: string): Promise<string | null>;

  // Trait search functions
  searchContractsByTrait(trait: any, config?: TraitSearchConfig, blacklist?: string[], maxResults?: number): Promise<any[]>;
}
