import { ClarityValue, cvToHex, cvToValue, hexToCV } from "@stacks/transactions";
import { apiClient } from "./blockchain-api-client";
import { TransactionEventsResponse, TransactionResults, Transaction } from "@stacks/stacks-blockchain-api-types";

// Define the structure for the contract interface based on the API docs
export interface ContractInterface {
  functions: unknown[]; // Replace unknown with specific types if available
  variables: unknown[];
  maps: unknown[];
  fungible_tokens: unknown[];
  non_fungible_tokens: unknown[];
}

// Define the structure for the contract info based on the API docs
export interface ContractInfo {
  tx_id: string;
  canonical: boolean;
  contract_id: string;
  block_height: number;
  clarity_version: number;
  source_code: string;
  abi: string; // This is a JSON string, could be parsed into a more specific type if needed
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
): Promise<any> {
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
 * Fetches account balance information for a Stacks address or a contract identifier.
 * Includes balances of STX tokens, fungible tokens, and non-fungible tokens.
 * 
 * @param principal Stacks address or contract identifier
 * @param params Optional parameters
 * @param params.unanchored Whether to include transaction data from unanchored microblocks
 * @param params.until_block Return data representing the state up until that block height
 * @returns A promise that resolves to the account balances
 */
export async function getAccountBalances(
  principal: string,
  params?: {
    unanchored?: boolean;
    until_block?: string;
  }
): Promise<AccountBalancesResponse | null> {
  try {
    const { data } = await apiClient.GET(`/extended/v1/address/${principal}/balances` as any, {
      params: {
        query: {
          unanchored: params?.unanchored,
          until_block: params?.until_block,
        },
      },
    });
    return data as AccountBalancesResponse;
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
}) => {
  const txs = await apiClient.GET(`/v2/transactions/list` as any, {
    limit: params?.limit ?? 96,
    offset: params?.offset,
    type: params?.type,
    unanchored: params?.unanchored ?? false,
  });
  return txs as unknown as TransactionResults;
};

export const getMempoolTransactions = async (params?: {
  sender_address?: string;
  recipient_address?: string;
  address?: string;
  limit?: number;
  offset?: number;
  unanchored?: boolean;
}) => {
  const txs = await apiClient.GET(`/v2/transactions/mempool` as any, {
    limit: params?.limit ?? 20,
    offset: params?.offset,
    senderAddress: params?.sender_address,
    recipientAddress: params?.recipient_address,
    address: params?.address,
    unanchored: params?.unanchored ?? false,
  });
  return txs as unknown as TransactionResults;
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
