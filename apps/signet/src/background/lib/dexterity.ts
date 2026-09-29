/**
 * Dexterity integration for Signet Extension
 * 
 * This module encapsulates all Dexterity-related functionality used by the Signet extension,
 * including token subnet deployment and other blockchain interactions.
 */

import type { TxBroadcastResultOk } from "@stacks/transactions";
import { Dexterity, type SubnetWrapperParams, type DeploymentResult, type Route } from "dexterity-sdk";
import { Opcode } from "dexterity-sdk/dist/core/opcode";
import { Vault } from "dexterity-sdk/dist/core/vault";

/**
 * Configure Dexterity SDK with the appropriate settings
 * @param stxAddress The current STX address to use
 * @param network Optional network to use (defaults to mainnet)
 */
export async function configureDexterity(stxAddress: string, network: 'mainnet' | 'testnet' = 'mainnet'): Promise<void> {
  await Dexterity.configure({
    mode: "server",
    stxAddress,
    network,
  });

  console.log(`Dexterity configured with address: ${stxAddress}, network: ${network}`);
}

/**
 * Execute a swap operation using Dexterity SDK
 * @param params The swap parameters including route, amount, and options
 * @param stxAddress The STX address to use for the swap
 * @param privateKey Optional private key for signing the transaction
 * @returns Promise resolving to swap result
 */
export async function executeDexSwap(
  params: {
    route: any;
    amount: number;
    options?: {
      disablePostConditions?: boolean;
      sponsored?: boolean;
    };
  },
  stxAddress: string,
  privateKey?: string
): Promise<{ success: boolean; txId?: string; error?: string }> {
  try {
    // Configure Dexterity first
    await configureDexterity(stxAddress);

    // Set sponsored option if provided
    if (params.options?.sponsored !== undefined) {
      Dexterity.config.sponsored = params.options.sponsored;
    }

    // Validate the route and hops
    if (!params.route || !params.route.hops || !Array.isArray(params.route.hops) || params.route.hops.length === 0) {
      return {
        success: false,
        error: "Required parameters missing: route with valid hops is required"
      };
    }

    // Build properly typed route hops
    const hops = [];
    for (const hop of params.route.hops) {
      const vault = await Vault.build(hop.vault.contractId);
      const opcode = new Opcode(hop.opcode.code);
      hops.push({ ...hop, vault, opcode });
    }
    params.route.hops = hops;

    // Enhanced options with credentials included directly
    const enhancedOptions = {
      ...params.options,
      disablePostConditions: params.options?.disablePostConditions || false,
      // Include credentials directly in the options object
      privateKey: privateKey,
      stxAddress: stxAddress
    };

    // Execute the swap with the enhanced options
    const result = await Dexterity.router.executeSwap(
      params.route,
      params.amount,
      enhancedOptions
    );

    // Return the successful result with txId
    return {
      success: true,
      txId: (result as TxBroadcastResultOk).txid
    };
  } catch (error) {
    // Handle any unexpected errors
    console.error("Error executing Dexterity swap:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error executing Dexterity swap"
    };
  }
}

/**
 * Deploy a token subnet wrapper contract using Dexterity
 * @param params The subnet parameters
 * @param stxAddress The STX address to use as the deployer
 * @param privateKey Optional private key for signing the transaction
 * @returns Promise resolving to deployment result
 */
export async function deployTokenSubnet(
  params: {
    tokenContract: string;
    versionName: string;
    versionNumber: string;
    batchSize: number;
    description?: string;
  },
  stxAddress: string,
  privateKey?: string
): Promise<DeploymentResult> {
  try {
    // Configure Dexterity first
    await configureDexterity(stxAddress);

    // Validate required parameters
    if (!params.tokenContract || !params.versionName || !params.versionNumber) {
      return {
        success: false,
        error: "Required parameters missing: tokenContract, versionName, and versionNumber are required"
      };
    }

    // Convert parameters to SubnetWrapperParams
    const subnetParams: SubnetWrapperParams = {
      tokenContract: params.tokenContract,
      versionName: params.versionName,
      versionNumber: params.versionNumber,
      batchSize: params.batchSize || 200, // Default to 200 if not specified
      description: params.description
    };

    // Deploy the subnet wrapper contract using Dexterity with credentials
    const credentials = privateKey ? { privateKey, stxAddress } : undefined;
    const result = await Dexterity.deployTokenSubnet(subnetParams, credentials);

    // Return the deployment result
    return result;
  } catch (error) {
    // Handle any unexpected errors
    console.error("Error deploying token subnet:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error deploying token subnet"
    };
  }
}

/**
 * Generate subnet wrapper contract code without deploying
 * Used for previewing contract code before deployment
 * @param params The subnet parameters
 * @param stxAddress Optional STX address to use for the contract ID
 * @returns Promise resolving to code generation result
 */
export async function generateSubnetCode(params: {
  tokenContract: string;
  versionName: string;
  versionNumber: string;
  batchSize: number;
  description?: string;
}, stxAddress?: string
): Promise<{ success: boolean; code?: string; contractId?: string; error?: string }> {
  try {
    // Configure Dexterity if stxAddress is provided
    if (stxAddress) {
      await configureDexterity(stxAddress);
    }

    // Convert parameters to SubnetWrapperParams
    const subnetParams: SubnetWrapperParams = {
      tokenContract: params.tokenContract,
      versionName: params.versionName,
      versionNumber: params.versionNumber,
      batchSize: params.batchSize || 200,
      description: params.description
    };

    // Generate code using new Dexterity.generateSubnetCode function
    const codeResult = Dexterity.generateSubnetCode(subnetParams);

    return {
      success: true,
      ...codeResult,
      code: codeResult.code
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error generating subnet code"
    };
  }
}