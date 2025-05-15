import { ClarityValue, cvToHex, cvToValue, hexToCV } from "@stacks/transactions";
import { apiClient } from "./blockchain-api-client";
import { TransactionResults } from "@stacks/stacks-blockchain-api-types";

// Define the structure for the contract interface based on the API docs
interface ContractInterface {
  functions: unknown[]; // Replace unknown with specific types if available
  variables: unknown[];
  maps: unknown[];
  fungible_tokens: unknown[];
  non_fungible_tokens: unknown[];
}

// Define the structure for the contract info based on the API docs
interface ContractInfo {
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
interface StxBalanceInfo {
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
interface FungibleTokenBalances {
  [key: string]: {
    balance: string;
    total_sent: string;
    total_received: string;
  };
}

/**
 * Interface for non-fungible token balances 
 */
interface NonFungibleTokenBalances {
  [key: string]: {
    count: string;
    total_sent: string;
    total_received: string;
  };
}

/**
 * Interface for account balances response 
 */
interface AccountBalancesResponse {
  stx: StxBalanceInfo;
  fungible_tokens: FungibleTokenBalances;
  non_fungible_tokens: NonFungibleTokenBalances;
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
 * Fetches the information for a specified smart contract.
 * @param contract_id The Stacks address and name of the contract (e.g., SP6P4EJF0VG8V0RB3TQQKJBHDQKEF6NVRD1KZE3C.satoshibles).
 * @param unanchored Optional boolean to include transaction data from unanchored microblocks.
 * @returns A promise that resolves to the contract information.
 */
export async function getContractInfo(
  contract_id: string,
  unanchored?: boolean
): Promise<ContractInfo | null> {
  try {
    const { data } = await apiClient.GET(`/extended/v1/contract/${contract_id}` as any, {
      params: {
        query: {
          unanchored,
        },
      },
    });
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
    const response = await fetch(`/extended/v1/address/${address}/stx`, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.HIRO_API_KEY as string
      }
    });
    if (!response.ok) {
      throw new Error(`STX Balance API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json() as { balance: string };
    return Number(data.balance || 0);
  } catch (error) {
    console.error(`Failed fetching STX balance for ${address}:`, error);
    return 0;
  }
}