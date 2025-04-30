import { ClarityValue, cvToHex, cvToValue, hexToCV } from "@stacks/transactions";
import { apiClient } from "./blockchain-api-client";

// Define the structure for the contract interface based on the API docs
interface ContractInterface {
  functions: unknown[]; // Replace unknown with specific types if available
  variables: unknown[];
  maps: unknown[];
  fungible_tokens: unknown[];
  non_fungible_tokens: unknown[];
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
    const { data } = await apiClient.POST(endpoint as any, {
      body: {
        sender: sender || contractAddress,
        arguments: args.map(arg => cvToHex(arg)),
      }
    });

    if (!data?.result) return null;
    return cvToValue(hexToCV(data.result));
  } catch (error) {
    console.error(`Error calling ${contractAddress}:`, error);
    return null;
  }
}