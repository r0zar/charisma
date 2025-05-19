/* eslint-disable @typescript-eslint/no-explicit-any */

// import removed Blaze
import { callReadOnlyFunction } from '@repo/polyglot'
import { getTokenMetadataCached, TokenCacheData } from '@repo/tokens';
import {
    bufferCV,
    ClarityValue,
    principalCV,
    someCV,
    tupleCV,
    uintCV,
    PostCondition,
    Pc,
    FungiblePostCondition,
    broadcastTransaction,
    makeContractCall,
    PostConditionMode,
    SignedMultiSigContractCallOptions,
    SignedContractCallOptions
} from "@stacks/transactions";

interface Token {
    contractId: string;
    name: string;
    symbol: string;
    decimals: number;
    image?: string;
    type: string;
    base?: string;
    identifier: string;
}

/**
 * Vault instance representing a liquidity pool
 */
export interface Vault {
    type: string;
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
    tokenA: any;
    tokenB: any;
    reservesA: number;
    reservesB: number;
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
    opcode: number;
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
    LOOKUP_RESERVES: 0x04,  // Get reserves information
    OP_DEPOSIT: 0x05,       // Deposit into subnet/bridge
    OP_WITHDRAW: 0x06       // Withdraw from subnet/bridge
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
    // static client removed
    static sender: string;

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
    static init(options: any = {}) {
        if (options.stxAddress) this.sender = options.stxAddress;
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
        },
        sender?: string,
    ) {
        if (sender) this.sender = sender;
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
        const metadata = await getTokenMetadataCached(contractId);
        console.log('[DexterityClient] Metadata:', metadata);

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
                getTokenMetadataCached(tokenAContract),
                getTokenMetadataCached(tokenBContract)
            ]);

            if (!tokenAInfo || !tokenBInfo) {
                return null;
            }

            if (!tokenAInfo.contractId) {
                tokenAInfo.contractId = tokenAContract;
            }

            if (!tokenBInfo.contractId) {
                tokenBInfo.contractId = tokenBContract;
            }

            if (!tokenAInfo.identifier) {
                console.log(metadata)
            }

            if (!tokenBInfo.identifier) {
                console.log(metadata)
            }


            // Fetch reserves
            let reservesA = 0;
            let reservesB = 0;
            try {
                const reservesResult = await callReadOnlyFunction(
                    contractAddress, contractName,
                    'get-reserves-quote',
                    []
                );
                reservesA = Number(reservesResult.dx.value);
                reservesB = Number(reservesResult.dy.value);

            } catch (reserveError) {
                console.warn(`Could not fetch reserves for ${contractId}:`, reserveError);
                // Keep reserves as 0 if fetching fails
            }

            // Create the vault object
            const vault: Vault = {
                type: metadata.type,
                contractId,
                contractAddress,
                contractName,
                name: metadata.name,
                symbol: metadata.symbol,
                decimals: metadata.decimals!,
                identifier: metadata.identifier!,
                description: metadata.description || "",
                image: metadata.image || "",
                fee: metadata.lpRebatePercent ? Math.floor((Number(metadata.lpRebatePercent) / 100) * 1000000) : 0,
                externalPoolId: metadata.externalPoolId || "",
                engineContractId: metadata.engineContractId || "",
                tokenA: tokenAInfo,
                tokenB: tokenBInfo,
                reservesA, // Assign fetched reserves
                reservesB  // Assign fetched reserves
            };

            return vault;
        } catch (error) {
            console.error(`Error building vault for ${contractId}:`, error);
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
                fee: vault.fee,
                opcode
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
            // hack for newer vaults
            const opcodeCV = this.opcodeCV(opcode)

            // Make the contract call
            const result = await callReadOnlyFunction(vault.contractAddress, vault.contractName, 'quote', [uintCV(amount), opcodeCV]);

            // Parse the result
            return {
                dx: Number(result?.value.dx.value || 0),
                dy: Number(result?.value.dy.value || 0),
                dk: Number(result?.value.dk.value || 0)
            };

        } catch (error) {
            console.error(`Error calling contract ${vault.contractId}.quote:`, error);
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
            // defensive code to avoid bad data, should never happen if types are correct
            if (!vault.tokenA || !vault.tokenB) continue;

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
                    console.warn(`EvaluateRoute: No direct vault edge found between ${tokenIn.symbol} (${tokenIn.contractId}) and ${tokenOut.symbol} (${tokenOut.contractId}) for hop ${i + 1}. Path invalid.`);
                    throw new Error(`Internal Error: No vault found for hop ${i + 1} between ${tokenIn.symbol} and ${tokenOut.symbol}`);
                }

                // Get quotes for all edges and select the best one
                const edgeQuotes = await Promise.all(matchingEdges.map(async edge => {
                    // Determine opcode based on token types and vault order
                    const isInSubnet = tokenIn.type === 'SUBNET';
                    const isOutSubnet = tokenOut.type === 'SUBNET';
                    let opcode: number;

                    if (!isInSubnet && isOutSubnet) {
                        opcode = OPCODES.OP_DEPOSIT;
                    } else if (isInSubnet && !isOutSubnet) {
                        opcode = OPCODES.OP_WITHDRAW;
                    } else {
                        // Standard swap (both subnet or both not subnet)
                        const isAtoB = tokenIn.contractId === edge.vault.tokenA.contractId;
                        opcode = isAtoB ? OPCODES.SWAP_A_TO_B : OPCODES.SWAP_B_TO_A;
                    }

                    try {
                        const quote = await this.callVaultQuote(edge.vault, currentAmount, opcode);
                        return { edge, opcode, quote };
                    } catch (error) {
                        console.error(`[Dexterity] Error quoting vault ${edge.vault.contractId}:`, error);
                        return { edge, opcode, quote: error }; // Return error object for handling
                    }
                }));

                // Find best quote (highest output amount)
                const bestEdgeQuote = edgeQuotes.reduce((best, current) => {
                    if (current.quote instanceof Error) return best;
                    if (best.quote instanceof Error) return current;
                    // Compare amountOut, ensuring we handle the potentially added opcode property
                    const currentAmountOut = (current.quote as Quote).amountOut;
                    const bestAmountOut = (best.quote as Quote).amountOut;
                    return currentAmountOut > bestAmountOut ? current : best;
                });

                if (bestEdgeQuote.quote instanceof Error) {
                    // If the best quote is an error, log it and try the next path
                    console.warn(`Error quoting edge for vault ${bestEdgeQuote.edge.vault.contractId}:`, bestEdgeQuote.quote.message);
                    // Propagate the error to indicate this path is invalid
                    throw bestEdgeQuote.quote;
                }

                // Add the hop with the best quote
                const quoteResult = bestEdgeQuote.quote as Quote;
                hops.push({
                    vault: bestEdgeQuote.edge.vault,
                    opcode: bestEdgeQuote.opcode,
                    tokenIn,
                    tokenOut,
                    quote: {
                        amountIn: currentAmount,
                        amountOut: quoteResult.amountOut,
                    },
                });

                // Update amount for next hop
                currentAmount = quoteResult.amountOut;
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
    static async getQuote(
        fromTokenId: string,
        toTokenId: string,
        amount: number,
        options: { excludeVaultIds?: string[] } = {},
    ): Promise<{
        route: Route;
        amountIn: number;
        amountOut: number;
        expectedPrice: number;
        minimumReceived: number;
    } | Error> {
        try {
            const { excludeVaultIds = [] } = options;

            // Gather all possible paths between tokens
            const paths = this.findAllPaths(fromTokenId, toTokenId);

            if (paths.length === 0) {
                return new Error(`No paths found from ${fromTokenId} to ${toTokenId}`);
            }

            // Evaluate each path
            const routeResults = await Promise.all(
                paths.map((path) => this.evaluateRoute(path, amount))
            );

            // Filter out errored routes
            let validRoutes = routeResults.filter((r): r is Route => !(r instanceof Error));

            // If an exclusion list is provided, filter out any route containing those vaults
            if (excludeVaultIds.length > 0) {
                validRoutes = validRoutes.filter(
                    (r) => !r.hops.some((h) => excludeVaultIds.includes(h.vault.contractId))
                );
            }

            if (validRoutes.length === 0) {
                return new Error(`No valid routes found with the given constraints`);
            }

            // Select the route with highest output amount
            const bestRoute = validRoutes.sort((a, b) => b.amountOut - a.amountOut)[0];

            const minimumReceived = Math.floor(
                bestRoute.amountOut * (1 - this.config.defaultSlippage)
            );

            return {
                route: bestRoute,
                amountIn: amount,
                amountOut: bestRoute.amountOut,
                expectedPrice: bestRoute.amountOut / amount,
                minimumReceived,
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
    static async buildSwapTransaction(route: Route) {

        // Check if router information is available
        if (!this.config.routerAddress || !this.config.routerName) {
            throw new Error("Router address and name must be configured before executing swaps");
        }

        // Create a map to track combined post-conditions by token
        const pcMap = new Map<string, any>();

        // Build post conditions
        for (const hop of route.hops) {
            const hopAmountIn = hop.quote?.amountIn ?? route.amountIn;
            const hopAmountOut = hop.quote?.amountOut ?? 0;

            // Get vault-specific post conditions
            const pcs = await this.buildSwapPostConditions(
                hop.vault,
                hop.tokenIn,
                hop.tokenOut,
                hopAmountIn,
                hopAmountOut,
                hop.opcode,
            );

            // Combine by token
            for (const pc of pcs as FungiblePostCondition[]) {
                const key = `${pc.address}-${pc.asset ?? 'STX'}}`;
                if (pcMap.has(key)) {
                    // Add amounts for existing token PC
                    const existingPC = pcMap.get(key);
                    existingPC.amount = BigInt(existingPC.amount) + BigInt(pc.amount);
                } else {
                    // Create new entry for this token PC
                    pcMap.set(key, { ...pc });
                }
            }
        }

        // Build function args for the router
        const functionArgs = [
            uintCV(route.amountIn),
            ...route.hops.map((hop: Hop) =>
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
        amount: bigint,
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
            ? Pc.principal(sender).willSendEq(amount).ft(token.contractId as any, token.identifier!)
            : condition === 'gte' ? Pc.principal(sender).willSendGte(amount).ft(token.contractId as any, token.identifier!)
                : Pc.principal(sender).willSendLte(amount).ft(token.contractId as any, token.identifier!);
    }

    /**
     * Build post conditions for a swap
     */
    private static async buildSwapPostConditions(
        vault: Vault,
        tokenIn: Token,
        tokenOut: Token,
        amountIn: number,
        amountOut: number,
        opcode: number,
    ) {

        const postConditions: PostCondition[] = [];

        if (opcode === OPCODES.OP_DEPOSIT) {
            // DEPOSIT: User sends exact tokenIn amount
            const exactAmountIn = BigInt(amountIn);
            postConditions.push(this.createPostCondition(tokenIn, exactAmountIn, this.sender, 'eq'));

        } else if (opcode === OPCODES.OP_WITHDRAW) {
            // WITHDRAW: Vault sends exact tokenOut amount
            const exactAmountOut = BigInt(amountOut);
            // Sender is the vault contract itself for a withdrawal
            postConditions.push(this.createPostCondition(tokenOut, exactAmountOut, vault.externalPoolId || vault.contractId, 'eq'));

        } else { // Standard Swaps (A_TO_B or B_TO_A)
            // Apply slippage tolerance
            const maxAmountIn = BigInt(Math.floor(amountIn * (1 + this.config.defaultSlippage)));
            const minAmountOut = BigInt(Math.floor(amountOut * (1 - this.config.defaultSlippage)));

            // Standard swap post conditions with slippage
            postConditions.push(this.createPostCondition(tokenIn, maxAmountIn, this.sender, 'lte'));
            postConditions.push(this.createPostCondition(tokenOut, minAmountOut, vault.externalPoolId || vault.contractId, 'gte'));

            // Handle specific external pool logic if needed (kept from original code)
            if (vault.externalPoolId) {
                // Add additional post condition for specific external pool
                if (vault.externalPoolId === 'SP1Y5YSTAHZ88XYK1VPDH24GY0HPX5J4JECTMY4A1.univ2-core' ||
                    vault.externalPoolId.startsWith('SP20X3DC5R091J8B6YPQT638J8NR1W83KN6TN5BJY.univ2-pool-v1')
                ) {
                    // This condition seems specific, ensure it's still relevant.
                    // It checks that the signer sends >= 0 to the external pool.
                    postConditions.push(this.createPostCondition(tokenIn, BigInt(0), vault.externalPoolId, 'gte'));
                }
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
        const txConfig = await this.buildSwapTransaction(route);

        // Handle post conditions
        if (options.disablePostConditions) {
            if (this.config.debug) {
                console.warn("Post conditions disabled for swap");
            }
            txConfig.postConditions = [];
        }

        // Execute the transaction using Blaze client
        return this.callContractFunction(
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
        const txConfig = await this.buildSwapTransaction(route);

        // Handle post conditions
        if (options.disablePostConditions) {
            if (this.config.debug) {
                console.warn("Post conditions disabled for swap");
            }
            txConfig.postConditions = [];
        }

        // Execute the transaction using Blaze client
        return this.callContractFunction(
            `${txConfig.contractAddress}.${txConfig.contractName}`,
            txConfig.functionName,
            txConfig.functionArgs,
            { ...options, ...txConfig }
        );
    }

    /**
   * Call a public function (state-changing) on a smart contract
   *
   * @param contractId - Fully qualified contract identifier (address.contract-name)
   * @param functionName - Name of the function to call
   * @param args - Array of Clarity values to pass to the function
   * @param senderAddress - Address of the sender
   * @param postConditions - Optional post conditions
   * @param options - Additional options (fee, nonce, etc.)
   * @returns Transaction ID if successful
   */
    static async callContractFunction(
        contractId: string,
        functionName: string,
        args: ClarityValue[] = [],
        options: any = {}
    ) {

        // Parse contract ID
        const [contractAddress, contractName] = contractId.split('.');

        // Check if there is a private key supplied
        if (!process.env.PRIVATE_KEY) {
            // If not supplied, try to use the Stacks Connect library for client-side signing
            const { request } = await import('@stacks/connect');
            const response = await request('stx_callContract', {
                contract: contractId as any,
                functionName,
                functionArgs: args,
                network: 'mainnet',
                postConditions: options.postConditions,
                postConditionMode: options.postConditionMode || 'deny',
            });
            return response
        } else {
            // If in secure environment, use the private key to sign the transaction
            const transactionOptions:
                | SignedContractCallOptions
                | SignedMultiSigContractCallOptions = {
                contractAddress,
                contractName,
                functionName,
                functionArgs: args,
                senderKey: process.env.PRIVATE_KEY,
                network: 'mainnet',
                postConditions: options.postConditions,
                postConditionMode: options.postConditionMode || PostConditionMode.Deny,
                fee: options.fee || 1000
            };

            if (options.nonce) {
                transactionOptions.nonce = options.nonce;
            }

            if (options.fee) {
                transactionOptions.fee = options.fee;
            }

            // Create the transaction
            const transaction = await makeContractCall(transactionOptions);

            // Broadcast the transaction
            // Relies on the network context set during transaction creation
            const broadcastResponse = await broadcastTransaction({ transaction });

            // Check for errors
            if ('error' in broadcastResponse) {
                throw new Error(
                    `Failed to broadcast transaction: ${broadcastResponse.error} - ${broadcastResponse.reason}`
                );
            }

            // Return transaction ID
            return broadcastResponse
        }
    }

    /**
     * Build transaction config (with hex-encoded args and PCs) for the new x-swap router used by orders/blaze-signer
     */
    static async buildXSwapTransaction(
        route: Route,
        meta: {
            amountIn: number | string;
            signature: string; // 65-byte hex (no 0x)
            uuid: string;
            recipient: string; // principal string
        }
    ) {
        // Ensure router configured
        if (!this.config.routerAddress || !this.config.routerName) {
            throw new Error('Router address/name not configured');
        }

        // Helper imports (pulled lazily to avoid tree-shaking issues in browser)
        const {
            uintCV,
            principalCV,
            contractPrincipalCV,
            tupleCV,
        } = await import('@stacks/transactions');
        const { bufferFromHex } = await import('@stacks/transactions/dist/cl');
        const { serializeCV } = await import('@stacks/transactions/dist/clarity/serialize');
        const { Pc } = await import('@stacks/transactions');
        const { postConditionToHex } = await import('@stacks/transactions/dist/postcondition');

        // -------- Build Clarity Args --------
        const amountU = BigInt(meta.amountIn);
        const amountCV = uintCV(amountU);
        const recipientCV = principalCV(meta.recipient);

        const hopCVs = await Promise.all(
            route.hops.map(async (hop: Hop) => {
                const [addr, name] = hop.vault.contractId.split('.');
                const opcodeHex = hop.opcode.toString(16).padStart(2, '0');
                return tupleCV({
                    vault: contractPrincipalCV(addr, name),
                    opcode: bufferFromHex(opcodeHex),
                });
            })
        );

        // Build in/out tuples
        const assetId = (t: Token) => `${t.contractId}${t.identifier ? '::' + t.identifier : ''}`;

        const inputTokenContract = route.path[0].contractId;
        const inputTokenAsset = assetId(route.path[0]);
        const inCV = tupleCV({
            token: contractPrincipalCV(inputTokenContract.split('.')[0], inputTokenContract.split('.')[1]),
            amount: amountCV,
            signature: bufferFromHex(meta.signature),
            uuid: (await import('@stacks/transactions')).stringAsciiCV(meta.uuid),
        });

        const outputTokenContract = route.path[route.path.length - 1].contractId;
        const outputTokenAsset = assetId(route.path[route.path.length - 1]);
        const outCV = tupleCV({
            token: contractPrincipalCV(outputTokenContract.split('.')[0], outputTokenContract.split('.')[1]),
            to: recipientCV,
        });

        const functionArgsCV = [inCV, ...hopCVs, outCV];

        // -------- Build Post-conditions --------
        const routerCID = `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9`;

        // Aggregate by principal|token
        const pcMap = new Map<string, bigint>();
        const add = (principal: string, tokenId: string, amt: bigint) => {
            const key = `${principal}|${tokenId}`;
            pcMap.set(key, (pcMap.get(key) ?? 0n) + amt);
        };

        // Use hop.quote amounts if present else calculate based on meta.amountIn cascade
        route.hops.forEach((hop) => {
            const amtIn = BigInt(hop.quote?.amountIn ?? 0);
            const amtOut = BigInt(hop.quote?.amountOut ?? 0);

            if (hop.tokenIn.type !== 'SUBNET') add(routerCID, assetId(hop.tokenIn), amtIn);
            if (hop.tokenOut.type !== 'SUBNET') {
                // If the vault is a sub-link vault, use the tokenIn contractId as the principal (the subnet)
                const contractOut = hop.vault.contractId.includes('sub-link') ? hop.tokenIn.contractId : hop.vault.contractId;
                add(contractOut, assetId(hop.tokenOut), amtOut)
            };
        });

        const lastHop = route.hops[route.hops.length - 1];
        const finalAmountOut = BigInt(lastHop.quote?.amountOut ?? 0);
        add(routerCID, outputTokenAsset, finalAmountOut);

        const postConditions = Array.from(pcMap.entries()).map(([key, amount]) => {
            const [principal, tokenId] = key.split('|');
            if (tokenId === '.stx::stx') {
                return Pc.principal(principal).willSendEq(amount).ustx();
            }
            const [contractPart, identPart] = tokenId.split('::');
            return Pc.principal(principal).willSendEq(amount).ft(contractPart as any, identPart);
        });

        // -------- Hex-encode --------
        const functionArgs = functionArgsCV.map((cv) => serializeCV(cv));
        const pcsHex = postConditions.map((pc) => postConditionToHex(pc));

        return {
            contractAddress: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
            contractName: 'x-multihop-rc9',
            functionName: `x-swap-${route.hops.length}`,
            functionArgs,
            postConditions: pcsHex,
        };
    }
}