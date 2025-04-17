/* eslint-disable @typescript-eslint/no-explicit-any */

import { createBlazeClient, Blaze } from "@repo/blaze";
import { Cryptonomicon, Token, MetadataServiceConfig } from "@repo/cryptonomicon"; // Adjust path as needed
import {
  bufferCV,
  ClarityValue,
  principalCV,
  someCV,
  tupleCV,
  uintCV,
  PostCondition,
  Pc,
  FungiblePostCondition
} from "@stacks/transactions";

/**
 * Vault instance representing a liquidity pool
 */
export interface Vault {
  contractId: string;
  contractAddress: string;
  contractName: string;
  name: string;
  symbol: string;
  decimals: number;
  identifier: string;
  description: string;
  image: string;
  fee: number;
  externalPoolId: string;
  engineContractId: string;
  tokenA: Token;
  tokenB: Token;
}

/**
 * Discovery options
 */
export interface DiscoveryOptions {
  blacklist?: string[];
  parallelRequests?: number;
  continueOnError?: boolean;
  maxVaultLoadLimit?: number;
}

/**
 * Quote result for a token swap
 */
export interface Quote {
  amountIn: number;
  amountOut: number;
  expectedPrice: number;
  minimumReceived: number;
  fee: number;
}

/**
 * Information about pool reserves and a swap
 */
export interface Delta {
  dx: number;
  dy: number;
  dk: number;
}

/**
 * Operation types as simple constants
 */
export const OPCODES = {
  SWAP_A_TO_B: 0x00,      // Swap token A for token B
  SWAP_B_TO_A: 0x01,      // Swap token B for token A
  ADD_LIQUIDITY: 0x02,    // Add liquidity to pool
  REMOVE_LIQUIDITY: 0x03, // Remove liquidity from pool
  LOOKUP_RESERVES: 0x04   // Get reserves information
};

/**
 * Route between tokens
 */
export interface Route {
  path: Token[];
  hops: Hop[];
  amountIn: number;
  amountOut: number;
}

/**
 * Hop in a route
 */
export interface Hop {
  vault: Vault;
  tokenIn: Token;
  tokenOut: Token;
  opcode: number;
  quote?: {
    amountIn: number;
    amountOut: number;
  };
}

/**
 * Default pool trait for contract discovery
 */
const POOL_TRAIT = {
  maps: [],
  epoch: "Epoch30",
  functions: [
    {
      args: [
        { name: "amount", type: "uint128" },
        {
          name: "opcode",
          type: { optional: { buffer: { length: 16 } } }
        }
      ],
      name: "execute",
      access: "public",
      outputs: {
        type: {
          response: {
            ok: {
              tuple: [
                { name: "dk", type: "uint128" },
                { name: "dx", type: "uint128" },
                { name: "dy", type: "uint128" }
              ]
            },
            error: "uint128"
          }
        }
      }
    },
    {
      args: [
        { name: "amount", type: "uint128" },
        {
          name: "opcode",
          type: { optional: { buffer: { length: 16 } } }
        }
      ],
      name: "quote",
      access: "read_only",
      outputs: {
        type: {
          response: {
            ok: {
              tuple: [
                { name: "dk", type: "uint128" },
                { name: "dx", type: "uint128" },
                { name: "dy", type: "uint128" }
              ]
            },
            error: "uint128"
          }
        }
      }
    }
  ],
  variables: [],
  clarity_version: "Clarity3",
  fungible_tokens: [],
  non_fungible_tokens: []
};

/**
 * Contracts to skip during discovery
 */
const DEFAULT_BLACKLIST = [
  'SP39859AD7RQ6NYK00EJ8HN1DWE40C576FBDGHPA0.chdollar',
  'SP39859AD7RQ6NYK00EJ8HN1DWE40C576FBDGHPA0.dmg-runes',
  'SP39859AD7RQ6NYK00EJ8HN1DWE40C576FBDGHPA0.uahdmg',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.abtc-dog-vault-wrapper-alex',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.satoshi-nakamoto-liquidity',
  'SP20VRJRCZ3FQG7RE4QSPFPQC24J92TKDXJVHWEAW.phoenix-charismatic',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.a-fistful-of-dollars',
  'SP26PZG61DH667XCX51TZNBHXM4HG4M6B2HWVM47V.dmgsbtc-lp-token',
  'SP26PZG61DH667XCX51TZNBHXM4HG4M6B2HWVM47V.lp-token',
  'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.theyre-taking-our-jerbs',
  'SP2F66ASMYZ9M8EEVD4S76RCF9X15WZD2EQFR5MV1.stxsbtc-lp-token',
  'SP23B2ZSDG9WKWPCKRERP6PV81FWNB4NECV6MKKAC.stxcha-lp-token',
];

/**
 * Graph edge connecting tokens in the routing graph
 */
interface GraphEdge {
  vault: Vault;
  target: Token;
}

/**
 * Graph node representing a token in the routing graph
 */
interface GraphNode {
  token: Token;
  edges: Map<string, GraphEdge>;
}

/**
 * Main class for discovering and interacting with liquidity vaults 
 */
/**
 * Options for executing a swap
 */
export interface SwapOptions {
  disablePostConditions?: boolean;
  slippageTolerance?: number;
  nonce?: number;
  fee?: number;
}

export class Dexterity {
  // Static properties
  static client: Blaze;
  static cryptonomicon: Cryptonomicon;

  // Router graph components
  static edges: Map<string, Vault> = new Map();
  static nodes: Map<string, GraphNode> = new Map();
  static config = {
    maxHops: 3,
    debug: false,
    defaultSlippage: 0.01, // 1% default slippage
    routerAddress: undefined as string | undefined,
    routerName: undefined as string | undefined
  };

  /**
   * Initialize the discovery service with appropriate configuration
   */
  static init(options: MetadataServiceConfig = {}) {
    this.client = createBlazeClient(options)
    this.cryptonomicon = new Cryptonomicon(options);
  }

  /**
   * Configure the router for multi-hop swaps
   * 
   * @param routerAddress - The router contract address
   * @param routerName - The router contract name
   * @param options - Additional configuration options
   */
  static configureRouter(
    routerAddress: string,
    routerName: string,
    options?: {
      maxHops?: number;
      defaultSlippage?: number;
      debug?: boolean;
    }
  ) {
    this.config.routerAddress = routerAddress;
    this.config.routerName = routerName;

    if (options?.maxHops !== undefined) {
      this.config.maxHops = options.maxHops;
    }

    if (options?.defaultSlippage !== undefined) {
      this.config.defaultSlippage = options.defaultSlippage;
    }

    if (options?.debug !== undefined) {
      this.config.debug = options.debug;
    }

    if (this.config.debug) {
      console.log(`Router configured: ${routerAddress}.${routerName}`);
      console.log(`Max Hops: ${this.config.maxHops}, Default Slippage: ${this.config.defaultSlippage * 100}%`);
    }
  }

  /**
   * Discover all liquidity vaults
   */
  static async discover(options: DiscoveryOptions = {}): Promise<Vault[]> {
    // Ensure cryptonomicon is initialized
    if (!this.cryptonomicon) this.init();

    // Merge default blacklist with provided options
    const blacklist = [...DEFAULT_BLACKLIST, ...(options.blacklist || [])];
    const continueOnError = options.continueOnError ?? true;
    const parallelRequests = options.parallelRequests ?? 10;
    const maxVaultLoadLimit = options.maxVaultLoadLimit ?? 100;

    // Search for contracts with the POOL_TRAIT
    const contracts = await this.cryptonomicon.searchContractsByTrait(POOL_TRAIT, blacklist);

    const maxAllowed = Math.min(contracts.length, maxVaultLoadLimit);

    if (this.cryptonomicon.config?.debug) {
      console.debug(`Discovered ${contracts.length} potential pools, processing ${maxAllowed}...`);
    }

    // Process contracts in parallel batches
    const vaults: Vault[] = [];
    const failedPools: { contractId: string, error: any }[] = [];

    for (let i = 0; i < maxAllowed; i += parallelRequests) {
      const batch = contracts.slice(i, i + parallelRequests);

      // Use allSettled to handle failures gracefully
      const batchResults = await Promise.allSettled(
        batch.map(contract => this.buildVault(contract.contract_id))
      );

      // Process results, handling both successes and failures
      for (let j = 0; j < batchResults.length; j++) {
        const result = batchResults[j];
        const contractId = batch[j].contract_id;

        if (result.status === 'fulfilled' && result.value !== null) {
          vaults.push(result.value);
        } else {
          // Record the failure
          const error = result.status === 'rejected' ? result.reason : 'Null vault returned';
          failedPools.push({ contractId, error });

          if (this.cryptonomicon.config?.debug) {
            console.warn(`Failed to build vault for ${contractId}: ${error}`);
          }

          // If we're not continuing on error, throw
          if (!continueOnError) {
            throw new Error(`Failed to build vault for ${contractId}: ${error}`);
          }
        }
      }
    }

    // Log summary if debug enabled
    if (this.cryptonomicon.config?.debug) {
      if (failedPools.length > 0) {
        console.warn(`Failed to load ${failedPools.length} pools out of ${maxAllowed}`);
      }
      console.log(`Successfully loaded ${vaults.length} vaults`);
    }

    return vaults;
  }

  /**
   * Get vaults containing a specific token
   */
  static getVaultsWithToken(vaults: Vault[], tokenId: string): Vault[] {
    return vaults.filter(vault => {
      return vault.tokenA.contractId === tokenId || vault.tokenB.contractId === tokenId;
    });
  }

  /**
   * Extract all unique tokens from vaults
   */
  static getAllVaultTokens(vaults: Vault[]): Token[] {
    const tokenMap = new Map<string, Token>();

    vaults.forEach(vault => {
      // Add tokenA and tokenB to the map if not already present
      if (!tokenMap.has(vault.tokenA.contractId)) {
        tokenMap.set(vault.tokenA.contractId, vault.tokenA);
      }

      if (!tokenMap.has(vault.tokenB.contractId)) {
        tokenMap.set(vault.tokenB.contractId, vault.tokenB);
      }
    });

    return Array.from(tokenMap.values());
  }

  /**
   * Build a vault object from a contract ID
   */
  static async buildVault(contractId: string): Promise<Vault | null> {
    // Parse contract ID
    const [contractAddress, contractName] = contractId.split('.');

    // Fetch metadata using Cryptonomicon
    const metadata = await this.cryptonomicon.getTokenMetadata(contractId);

    // If we couldn't get metadata, return null
    if (!metadata) {
      // return null;
      throw new Error('Failed to get metadata')
    }

    // Extract token contracts
    const tokenAContract = metadata.tokenAContract;
    const tokenBContract = metadata.tokenBContract;

    // Check if token contracts are available
    if (!tokenAContract || !tokenBContract) {
      throw new Error('Failed to get base tokens')
    }

    try {
      // Fetch token information using Cryptonomicon
      const [tokenAInfo, tokenBInfo] = await Promise.all([
        this.cryptonomicon.getTokenInfo(tokenAContract),
        this.cryptonomicon.getTokenInfo(tokenBContract)
      ]);

      if (!tokenAInfo || !tokenBInfo) {
        return null;
      }

      // Create the vault object
      const vault: Vault = {
        contractId,
        contractAddress,
        contractName,
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        identifier: metadata.identifier,
        description: metadata.description || "",
        image: metadata.image || "",
        fee: metadata.lpRebatePercent ? Math.floor((Number(metadata.lpRebatePercent) / 100) * 1000000) : 0,
        externalPoolId: metadata.externalPoolId || "",
        engineContractId: metadata.engineContractId || "",
        tokenA: tokenAInfo,
        tokenB: tokenBInfo
      };

      return vault;
    } catch (error) {
      if (this.cryptonomicon.config?.debug) {
        console.error(`Error building vault for ${contractId}:`, error);
      }
      return null;
    }
  }

  /**
   * Call a contract's quote function
   */
  static async callVaultQuote(vault: Vault, amount: number, opcode: number): Promise<Quote | Error> {
    try {
      // Call the contract's quote function
      const delta = await this.quote(vault, amount, opcode);

      if (!delta) {
        return new Error("Failed to get quote from contract");
      }

      return {
        amountIn: delta.dx,
        amountOut: delta.dy,
        expectedPrice: delta.dy / amount,
        minimumReceived: Math.floor(delta.dy * (1 - this.config.defaultSlippage)),
        fee: vault.fee
      };
    } catch (error) {
      return new Error(`Failed to get quote: ${error}`);
    }
  }

  /**
   * Call a contract function
   */
  private static async quote(
    vault: Vault,
    amount: number,
    opcode: number
  ): Promise<Delta | null> {
    try {
      // Build opcode cv
      const opcodeCV = this.opcodeCV(opcode);

      // Make the contract call
      const result: any = await this.client.call(
        vault.contractId,
        'quote',
        [uintCV(amount), opcodeCV]
      );

      // Parse the result
      if (result && typeof result === 'object' && 'dx' in result && 'dy' in result && 'dk' in result) {
        return {
          dx: Number(result.dx.value || 0),
          dy: Number(result.dy.value || 0),
          dk: Number(result.dk.value || 0)
        };
      }

      return null;
    } catch (error) {
      console.error(`Error calling contract ${vault.contractId}.quote:`, error);
      if (this.config.debug) {
        console.error(`Error calling contract ${vault.contractId}.quote:`, error);
      }
      return null;
    }
  }

  /**
   * Build an opcode clarity value for contract calls
   * to match the actual contract's expected format
   */
  private static opcodeCV(opcode: number): ClarityValue {
    const buffer = new Uint8Array(16).fill(0);
    buffer[0] = opcode;
    return someCV(bufferCV(buffer));
  }

  // -------------- Router Graph Functions --------------

  /**
   * Load vaults into the routing graph
   */
  static loadVaults(vaults: Vault[]): void {
    // Clear existing data
    this.edges.clear();
    this.nodes.clear();

    for (const vault of vaults) {
      // Add to edges map
      this.edges.set(vault.contractId, vault);

      const token0 = vault.tokenA;
      const token1 = vault.tokenB;

      // Create nodes if missing
      if (!this.nodes.has(token0.contractId)) {
        this.nodes.set(token0.contractId, {
          token: token0,
          edges: new Map(),
        });
      }
      if (!this.nodes.has(token1.contractId)) {
        this.nodes.set(token1.contractId, {
          token: token1,
          edges: new Map(),
        });
      }

      const node0 = this.nodes.get(token0.contractId)!;
      const node1 = this.nodes.get(token1.contractId)!;

      // Create unique edge keys that include the vault ID
      const edge0Key = `${token1.contractId}-${vault.contractId}`;
      const edge1Key = `${token0.contractId}-${vault.contractId}`;

      // Add edges in both directions with unique keys
      node0.edges.set(edge0Key, {
        vault,
        target: token1
      });

      node1.edges.set(edge1Key, {
        vault,
        target: token0
      });
    }

    if (this.config.debug) {
      console.log(`Loaded ${vaults.length} vaults into the routing graph.`);
      console.log(`Graph now has ${this.nodes.size} tokens and ${this.edges.size} liquidity pools.`);
    }
  }

  /**
   * Get graph statistics
   */
  static getGraphStats() {
    let totalEdges = 0;
    for (const node of Array.from(this.nodes.values())) {
      totalEdges += node.edges.size;
    }
    return {
      nodeCount: this.nodes.size,
      edgeCount: totalEdges,
      tokenIds: Array.from(this.nodes.keys()),
    };
  }

  /**
   * Find all possible paths between tokens
   */
  static findAllPaths(
    fromId: string,
    toId: string,
    path: Token[] = [],
    visitedVaults: Set<string> = new Set()
  ): Token[][] {
    const results: Token[][] = [];
    const node = this.nodes.get(fromId);
    if (!node) return results;

    const newPath = [...path, node.token];

    // Add path if we've reached target token
    if (fromId === toId && path.length >= 2) {
      results.push(newPath);
    } else if (newPath[newPath.length - 1].contractId === toId) {
      results.push(newPath);
    }

    // Continue exploring if under max hops
    if (newPath.length <= this.config.maxHops) {
      // Group edges by target token
      const edgesByTarget = new Map<string, GraphEdge[]>();

      node.edges.forEach((edge) => {
        const targetId = edge.target.contractId;
        if (!edgesByTarget.has(targetId)) {
          edgesByTarget.set(targetId, []);
        }
        edgesByTarget.get(targetId)!.push(edge);
      })

      // Explore each target token's edges
      edgesByTarget.forEach((edges, targetId) => {
        for (const edge of edges) {
          const vaultId = edge.vault.contractId;

          // Skip if we've visited this vault before
          if (!visitedVaults.has(vaultId)) {
            const newVisitedVaults = new Set(visitedVaults);
            newVisitedVaults.add(vaultId);

            const nested = this.findAllPaths(
              targetId,
              toId,
              newPath,
              newVisitedVaults
            );
            results.push(...nested);
          }
        }
      })
    }

    return results;
  }

  /**
   * Get vaults linked to a specific token
   */
  static getVaultsForToken(tokenId: string): Map<string, Vault> {
    const node = this.nodes.get(tokenId);
    if (!node) return new Map();

    const vaults = new Map<string, Vault>();
    for (const edge of Array.from(node.edges.values())) {
      vaults.set(edge.vault.contractId, edge.vault);
    }

    return vaults;
  }

  /**
   * Get all vaults in the graph
   */
  static getVaults(): Vault[] {
    return Array.from(this.edges.values());
  }

  /**
   * Discover vaults and load them into the router graph
   */
  static async discoverAndLoad(options: DiscoveryOptions = {}): Promise<Vault[]> {
    const vaults = await this.discover(options);
    this.loadVaults(vaults);
    return vaults;
  }

  /**
   * Find all routes between two tokens
   */
  static findRoute(fromTokenId: string, toTokenId: string): Token[][] {
    // Find all possible paths between the tokens
    const paths = this.findAllPaths(fromTokenId, toTokenId);

    if (this.config.debug) {
      console.debug(`Found ${paths.length} possible paths between ${fromTokenId} and ${toTokenId}`);

      // Log the first few paths
      paths.slice(0, 3).forEach((path, i) => {
        console.debug(`Path ${i + 1}: ${path.map(t => t.symbol).join(' → ')}`);
      });
    }

    return paths;
  }

  /**
   * Evaluate a single route with quotes
   */
  static async evaluateRoute(path: Token[], amount: number): Promise<Route | Error> {
    try {
      const hops: Hop[] = [];
      let currentAmount = amount;

      for (let i = 0; i < path.length - 1; i++) {
        const tokenIn = path[i];
        const tokenOut = path[i + 1];
        const node = this.nodes.get(tokenIn.contractId);

        if (!node) {
          throw new Error(`Node not found for token: ${tokenIn.contractId}`);
        }

        // Find edges connecting tokenIn to tokenOut
        const matchingEdges = Array.from(node.edges.values())
          .filter(edge => edge.target.contractId === tokenOut.contractId);

        if (matchingEdges.length === 0) {
          throw new Error(`No direct connection found between ${tokenIn.symbol} and ${tokenOut.symbol}`);
        }

        // Get quotes for all edges and select the best one
        const edgeQuotes = await Promise.all(matchingEdges.map(async edge => {
          // Determine if it's A->B or B->A based on the vault's token order
          const isAtoB = tokenIn.contractId === edge.vault.tokenA.contractId;
          const opcode = isAtoB ? OPCODES.SWAP_A_TO_B : OPCODES.SWAP_B_TO_A;

          const quote = await this.callVaultQuote(edge.vault, currentAmount, opcode);
          return { edge, opcode, quote };
        }));

        // Find best quote (highest output amount)
        const bestEdgeQuote = edgeQuotes.reduce((best, current) => {
          if (current.quote instanceof Error) return best;
          if (best.quote instanceof Error) return current;
          return (current.quote as Quote).amountOut > (best.quote as Quote).amountOut ? current : best;
        });

        if (bestEdgeQuote.quote instanceof Error) {
          throw bestEdgeQuote.quote;
        }

        // Add the hop with the best quote
        const quote = bestEdgeQuote.quote as Quote;
        hops.push({
          vault: bestEdgeQuote.edge.vault,
          opcode: bestEdgeQuote.opcode,
          tokenIn,
          tokenOut,
          quote: {
            amountIn: currentAmount,
            amountOut: quote.amountOut,
          },
        });

        // Update amount for next hop
        currentAmount = quote.amountOut;
      }

      // Create the route
      const route: Route = {
        path,
        hops,
        amountIn: amount,
        amountOut: currentAmount,
      };

      return route;
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error(`Failed to evaluate route: ${error}`);
    }
  }

  /**
   * Find the best route for a token swap with actual quotes
   */
  static async findBestRoute(fromTokenId: string, toTokenId: string, amount: number): Promise<Route | Error> {
    try {
      // Find all possible paths
      const paths = this.findAllPaths(fromTokenId, toTokenId);

      if (paths.length === 0) {
        return new Error(`No paths found from ${fromTokenId} to ${toTokenId}`);
      }

      if (this.config.debug) {
        console.log(`Found ${paths.length} possible paths, evaluating with quotes...`);
      }

      // Evaluate all paths with quotes
      const routePromises = paths.map(path => this.evaluateRoute(path, amount));
      const routeResults = await Promise.all(routePromises);

      // Filter out errors and sort by amountOut (descending)
      const validRoutes = routeResults
        .filter(r => !(r instanceof Error)) as Route[];

      const sortedRoutes = validRoutes.sort((a, b) => b.amountOut - a.amountOut);

      if (sortedRoutes.length === 0) {
        return new Error(`No valid routes found with quotes`);
      }

      // Return the best route (highest output amount)
      return sortedRoutes[0];
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error(`Failed to find best route: ${error}`);
    }
  }

  /**
   * Get a quote for swapping tokens
   */
  static async getQuote(fromTokenId: string, toTokenId: string, amount: number): Promise<{
    route: Route;
    amountIn: number;
    amountOut: number;
    expectedPrice: number;
    minimumReceived: number;
  } | Error> {
    try {
      // Find best route
      const route = await this.findBestRoute(fromTokenId, toTokenId, amount);

      if (route instanceof Error) {
        return route;
      }

      // Calculate minimum received with slippage
      const minimumReceived = Math.floor(route.amountOut * (1 - this.config.defaultSlippage));

      return {
        route,
        amountIn: amount,
        amountOut: route.amountOut,
        expectedPrice: route.amountOut / amount,
        minimumReceived
      };
    } catch (error) {
      return error instanceof Error
        ? error
        : new Error(`Failed to get quote: ${error}`);
    }
  }

  /**
   * Build transaction for a multi-hop swap
   */
  static async buildSwapTransaction(route: Route, amount: number) {
    // Ensure client is initialized
    if (!this.client) this.init();

    // Check if router information is available
    if (!this.config.routerAddress || !this.config.routerName) {
      throw new Error("Router address and name must be configured before executing swaps");
    }

    // Create a map to track combined post-conditions by token
    const pcMap = new Map<string, any>();

    // Build post conditions
    for (const hop of route.hops) {
      const hopAmountIn = hop.quote?.amountIn ?? amount;
      const hopAmountOut = hop.quote?.amountOut ?? 0;

      // Get vault-specific post conditions
      const pcs = await this.buildSwapPostConditions(
        hop.vault,
        hop.tokenIn,
        hop.tokenOut,
        hopAmountIn,
        hopAmountOut
      );

      // Combine by token
      for (const pc of pcs as FungiblePostCondition[]) {
        const key = `${pc.address}-${pc.asset ?? 'STX'}}`;
        if (pcMap.has(key)) {
          // Add amounts for existing token PC
          const existingPC = pcMap.get(key);
          existingPC.amount = Number(existingPC.amount) + Number(pc.amount);
        } else {
          // Create new entry for this token PC
          pcMap.set(key, { ...pc });
        }
      }
    }

    // Build function args for the router
    const functionArgs = [
      uintCV(amount),
      ...route.hops.map((hop) =>
        tupleCV({
          pool: principalCV(hop.vault.contractId),
          opcode: this.opcodeCV(hop.opcode)
        })
      ),
    ];

    // Return transaction config
    return {
      contractAddress: this.config.routerAddress,
      contractName: this.config.routerName,
      functionName: `swap-${route.hops.length}`,
      functionArgs,
      postConditions: Array.from(pcMap.values())
    };
  }

  /**
   * Create a post condition for a token transfer
   */
  static createPostCondition(
    token: Token,
    amount: number,
    sender: string,
    condition: 'eq' | 'gte' | 'lte' = 'eq'
  ): PostCondition {
    if (token.contractId === ".stx") {
      return condition === 'eq'
        ? Pc.principal(sender).willSendEq(amount).ustx()
        : condition === 'gte' ? Pc.principal(sender).willSendGte(amount).ustx()
          : Pc.principal(sender).willSendLte(amount).ustx();
    }
    return condition === 'eq'
      ? Pc.principal(sender).willSendEq(amount).ft(token.contractId as any, token.identifier)
      : condition === 'gte' ? Pc.principal(sender).willSendGte(amount).ft(token.contractId as any, token.identifier)
        : Pc.principal(sender).willSendLte(amount).ft(token.contractId as any, token.identifier);
  }

  /**
   * Build post conditions for a swap
   */
  private static async buildSwapPostConditions(
    vault: Vault,
    tokenIn: Token,
    tokenOut: Token,
    amountIn: number,
    amountOut: number
  ) {
    // Apply slippage tolerance
    const maxAmountIn = Math.floor(amountIn * (1 + this.config.defaultSlippage));
    const minAmountOut = Math.floor(amountOut * (1 - this.config.defaultSlippage));

    // Assume signer as sender
    const signer = await this.client.signer.getAddress()

    const postConditions = [
      this.createPostCondition(tokenIn, maxAmountIn, signer, 'lte'),
      this.createPostCondition(tokenOut, minAmountOut, vault.externalPoolId || vault.contractId, 'gte'),
    ];

    // For wrapper contract, use external pool ID if available
    if (vault.externalPoolId) {
      // Add additional post condition for specific external pool
      if (vault.externalPoolId === 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-core' ||
        vault.externalPoolId.startsWith('SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY.univ2-pool-v1')
      ) {
        postConditions.push(this.createPostCondition(tokenIn, 0, vault.externalPoolId, 'gte'));
      }
    }

    return postConditions;
  }

  /**
   * Execute a multi-hop token swap using the best route
   * 
   * @param fromTokenId - Source token contract ID
   * @param toTokenId - Destination token contract ID
   * @param amount - Amount of source token to swap
   * @param options - Additional options for the swap
   * @returns Promise that resolves to the transaction ID if successful
   */
  static async executeSwap(
    fromTokenId: string,
    toTokenId: string,
    amount: number,
    options: SwapOptions = {}
  ) {
    // Make sure client is initialized
    if (!this.client) this.init();

    // Find the best route
    const routeResult = await this.findBestRoute(fromTokenId, toTokenId, amount);
    if (routeResult instanceof Error) {
      return routeResult;
    }

    const route = routeResult;
    if (route.hops.length === 0) {
      return new Error("No valid route found for swap");
    }

    // Build transaction for the route
    const txConfig = await this.buildSwapTransaction(route, amount);

    // Handle post conditions
    if (options.disablePostConditions) {
      if (this.config.debug) {
        console.warn("Post conditions disabled for swap");
      }
      txConfig.postConditions = [];
    }

    // Execute the transaction using Blaze client
    return this.client.execute(
      `${txConfig.contractAddress}.${txConfig.contractName}`,
      txConfig.functionName,
      txConfig.functionArgs,
      { ...options, ...txConfig }
    );
  }

  static async executeSwapRoute(
    route: Route,
    options: SwapOptions = {}
  ) {

    // Build transaction for the route
    const txConfig = await this.buildSwapTransaction(route, route.amountIn);

    // Handle post conditions
    if (options.disablePostConditions) {
      if (this.config.debug) {
        console.warn("Post conditions disabled for swap");
      }
      txConfig.postConditions = [];
    }

    // Execute the transaction using Blaze client
    return this.client.execute(
      `${txConfig.contractAddress}.${txConfig.contractName}`,
      txConfig.functionName,
      txConfig.functionArgs,
      { ...options, ...txConfig }
    );
  }
}