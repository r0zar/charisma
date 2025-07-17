/**
 * CPMM Engine - Constant Product Market Maker Price Discovery
 * 
 * Handles pure AMM-based price discovery through liquidity pools using
 * constant product formulas. Does not handle intrinsic values or oracle feeds.
 */

import { convertAtomicToDecimal } from '../shared/decimal-utils';

export interface PoolData {
    contractId: string;
    type: string;
    protocol: string;
    tokenA: {
        contractId: string;
        symbol: string;
        name: string;
        decimals: number;
    };
    tokenB: {
        contractId: string;
        symbol: string;
        name: string;
        decimals: number;
    };
    reservesA: number;
    reservesB: number;
}

export interface CpmmToken {
    contractId: string;
    symbol: string;
    name: string;
    decimals: number;
    totalLiquidity: number;
    poolCount: number;
}

export interface CpmmPoolEdge {
    poolId: string;
    tokenA: string;
    tokenB: string;
    reservesA: number;
    reservesB: number;
    liquidityUsd: number;
    weight: number;
    lastUpdated: number;
}

export interface CpmmPricePath {
    tokens: string[];
    pools: CpmmPoolEdge[];
    totalLiquidity: number;
    pathLength: number;
    reliability: number;
}

export interface CpmmPriceResult {
    tokenId: string;
    symbol: string;
    ratio: number; // Price ratio to base token
    reliability: number;
    totalLiquidity: number;
    pathsUsed: number;
    primaryPath: CpmmPricePath;
    alternativePaths: CpmmPricePath[];
}

/**
 * Pool data provider interface for dependency injection
 */
export interface CpmmPoolDataProvider {
    getAllVaultData(): Promise<PoolData[]>;
}

/**
 * CPMM Engine - Pure market price discovery through AMM pools
 */
export class CpmmEngine {
    private tokens = new Map<string, CpmmToken>();
    private edges = new Map<string, CpmmPoolEdge[]>(); // tokenId -> connected edges
    private pools = new Map<string, CpmmPoolEdge>();
    private lastUpdated = 0;
    private poolDataProvider: CpmmPoolDataProvider | null = null;

    constructor(poolDataProvider?: CpmmPoolDataProvider) {
        this.poolDataProvider = poolDataProvider || null;
    }

    /**
     * Set the pool data provider
     */
    setPoolDataProvider(provider: CpmmPoolDataProvider): void {
        this.poolDataProvider = provider;
    }

    /**
     * Build the CPMM liquidity graph from pool data
     */
    async buildGraph(): Promise<void> {
        console.log('[CpmmEngine] Building CPMM liquidity graph...');
        const startTime = Date.now();

        if (!this.poolDataProvider) {
            console.warn('[CpmmEngine] No pool data provider configured');
            return;
        }

        try {
            // Get all pool data
            const allPools = await this.poolDataProvider.getAllVaultData();
            console.log(`[CpmmEngine] Found ${allPools.length} total pools`);

            // Filter for valid liquidity pools
            const liquidityPools = allPools.filter(pool =>
                pool.type === 'POOL' &&
                pool.protocol === 'CHARISMA' &&
                pool.tokenA &&
                pool.tokenB &&
                pool.reservesA !== undefined &&
                pool.reservesB !== undefined &&
                pool.reservesA > 0 &&
                pool.reservesB > 0
            );

            console.log(`[CpmmEngine] Filtered to ${liquidityPools.length} valid CHARISMA pools`);

            // Clear existing data
            this.tokens.clear();
            this.edges.clear();
            this.pools.clear();

            // Build graph from pools
            for (const pool of liquidityPools) {
                this.addPoolToGraph(pool);
            }

            this.lastUpdated = Date.now();
            const buildTime = Date.now() - startTime;
            console.log(`[CpmmEngine] Graph built in ${buildTime}ms: ${this.tokens.size} tokens, ${this.pools.size} pools`);

        } catch (error) {
            console.error('[CpmmEngine] Failed to build graph:', error);
            throw error;
        }
    }

    /**
     * Add a pool to the graph, creating tokens and edges
     */
    private addPoolToGraph(pool: PoolData): void {
        const tokenAId = pool.tokenA.contractId;
        const tokenBId = pool.tokenB.contractId;

        // Add tokens if they don't exist
        if (!this.tokens.has(tokenAId)) {
            this.tokens.set(tokenAId, {
                contractId: tokenAId,
                symbol: pool.tokenA.symbol,
                name: pool.tokenA.name,
                decimals: pool.tokenA.decimals,
                totalLiquidity: 0,
                poolCount: 0
            });
        }

        if (!this.tokens.has(tokenBId)) {
            this.tokens.set(tokenBId, {
                contractId: tokenBId,
                symbol: pool.tokenB.symbol,
                name: pool.tokenB.name,
                decimals: pool.tokenB.decimals,
                totalLiquidity: 0,
                poolCount: 0
            });
        }

        // Validate reserves
        let reserveA = typeof pool.reservesA === 'string' ? parseFloat(pool.reservesA) : pool.reservesA;
        let reserveB = typeof pool.reservesB === 'string' ? parseFloat(pool.reservesB) : pool.reservesB;

        if (!isFinite(reserveA) || !isFinite(reserveB) || reserveA <= 0 || reserveB <= 0) {
            console.warn(`[CpmmEngine] Invalid reserves for pool ${pool.contractId}: A=${reserveA}, B=${reserveB}`);
            return;
        }

        // Calculate simple liquidity weight for pathfinding
        const simpleWeight = Math.sqrt(reserveA * reserveB);
        if (!isFinite(simpleWeight) || simpleWeight <= 0) {
            console.warn(`[CpmmEngine] Invalid liquidity weight for pool ${pool.contractId}`);
            return;
        }

        // Create pool edge
        const poolEdge: CpmmPoolEdge = {
            poolId: pool.contractId,
            tokenA: tokenAId,
            tokenB: tokenBId,
            reservesA: reserveA,
            reservesB: reserveB,
            liquidityUsd: 0, // Will be calculated separately if needed
            weight: 1 / simpleWeight, // Lower weight = higher liquidity for pathfinding
            lastUpdated: Date.now()
        };

        this.pools.set(pool.contractId, poolEdge);

        // Add bidirectional edges
        this.addEdgeToToken(tokenAId, poolEdge);
        this.addEdgeToToken(tokenBId, poolEdge);

        console.log(`[CpmmEngine] Added pool: ${pool.tokenA.symbol}/${pool.tokenB.symbol} (${pool.contractId})`);
    }

    /**
     * Add an edge to a token's connection list
     */
    private addEdgeToToken(tokenId: string, edge: CpmmPoolEdge): void {
        if (!this.edges.has(tokenId)) {
            this.edges.set(tokenId, []);
        }
        this.edges.get(tokenId)!.push(edge);
    }

    /**
     * Calculate price discovery from a base token with known price
     * Returns price ratios relative to the base token
     */
    async discoverPricesFromBase(baseTokenId: string, knownPrices?: Map<string, number>): Promise<Map<string, CpmmPriceResult>> {
        console.log(`[CpmmEngine] Starting price discovery from base token: ${baseTokenId}`);
        
        const discoveredPrices = new Map<string, number>();
        const priceResults = new Map<string, CpmmPriceResult>();

        // Initialize with known prices if provided
        if (knownPrices) {
            for (const [tokenId, price] of knownPrices) {
                discoveredPrices.set(tokenId, price);
                console.log(`[CpmmEngine] Known price: ${this.getTokenSymbol(tokenId)} = ${price}`);
            }
        }

        // Ensure base token has price of 1.0 (self-reference)
        if (!discoveredPrices.has(baseTokenId)) {
            discoveredPrices.set(baseTokenId, 1.0);
        }

        // Iterative price discovery
        let cycle = 1;
        const maxCycles = 10;

        while (cycle <= maxCycles) {
            const initialCount = discoveredPrices.size;
            console.log(`[CpmmEngine] Discovery cycle ${cycle}: ${initialCount} known prices`);

            const newPrices = new Map<string, { price: number, reliability: number, path: string }>();

            // Examine each pool for price discovery opportunities
            for (const [poolId, edge] of this.pools) {
                const priceA = discoveredPrices.get(edge.tokenA);
                const priceB = discoveredPrices.get(edge.tokenB);

                // Case 1: Know A, discover B
                if (priceA !== undefined && priceB === undefined && priceA > 0) {
                    const newPrice = this.calculatePriceFromPool(edge, edge.tokenA, edge.tokenB, priceA);
                    if (newPrice && newPrice > 0) {
                        const reliability = this.calculatePoolReliability(edge);
                        const path = `${this.getTokenSymbol(edge.tokenA)}→${this.getTokenSymbol(edge.tokenB)}`;
                        
                        if (!newPrices.has(edge.tokenB) || newPrices.get(edge.tokenB)!.reliability < reliability) {
                            newPrices.set(edge.tokenB, { price: newPrice, reliability, path });
                        }
                    }
                }

                // Case 2: Know B, discover A
                if (priceB !== undefined && priceA === undefined && priceB > 0) {
                    const newPrice = this.calculatePriceFromPool(edge, edge.tokenB, edge.tokenA, priceB);
                    if (newPrice && newPrice > 0) {
                        const reliability = this.calculatePoolReliability(edge);
                        const path = `${this.getTokenSymbol(edge.tokenB)}→${this.getTokenSymbol(edge.tokenA)}`;
                        
                        if (!newPrices.has(edge.tokenA) || newPrices.get(edge.tokenA)!.reliability < reliability) {
                            newPrices.set(edge.tokenA, { price: newPrice, reliability, path });
                        }
                    }
                }
            }

            // Add discovered prices
            for (const [tokenId, { price, reliability, path }] of newPrices) {
                discoveredPrices.set(tokenId, price);
                console.log(`[CpmmEngine] Discovered: ${this.getTokenSymbol(tokenId)} = ${price.toFixed(6)} (${path})`);
            }

            const newCount = discoveredPrices.size;
            if (newCount === initialCount) {
                console.log(`[CpmmEngine] Price discovery converged after ${cycle} cycles`);
                break;
            }

            cycle++;
        }

        // Generate price results for all discovered tokens
        for (const [tokenId, price] of discoveredPrices) {
            if (tokenId !== baseTokenId) { // Skip base token
                const paths = this.findPathsToToken(tokenId, baseTokenId);
                if (paths.length > 0) {
                    const primaryPath = paths[0];
                    const alternativePaths = paths.slice(1, 6); // Top 5 alternatives

                    priceResults.set(tokenId, {
                        tokenId,
                        symbol: this.getTokenSymbol(tokenId),
                        ratio: price,
                        reliability: this.calculatePathReliability(primaryPath),
                        totalLiquidity: primaryPath.totalLiquidity,
                        pathsUsed: paths.length,
                        primaryPath,
                        alternativePaths
                    });
                }
            }
        }

        console.log(`[CpmmEngine] Price discovery complete: ${priceResults.size} tokens priced relative to ${this.getTokenSymbol(baseTokenId)}`);
        return priceResults;
    }

    /**
     * Calculate price of unknown token from known token using CPMM formula
     */
    private calculatePriceFromPool(
        edge: CpmmPoolEdge,
        knownTokenId: string,
        unknownTokenId: string,
        knownPrice: number
    ): number | null {
        try {
            const knownToken = this.tokens.get(knownTokenId);
            const unknownToken = this.tokens.get(unknownTokenId);

            if (!knownToken || !unknownToken) return null;

            // Determine which reserves correspond to which tokens
            const isKnownTokenA = edge.tokenA === knownTokenId;
            const knownReserve = isKnownTokenA ? edge.reservesA : edge.reservesB;
            const unknownReserve = isKnownTokenA ? edge.reservesB : edge.reservesA;

            // Convert to decimal amounts
            const knownDecimalReserve = convertAtomicToDecimal(knownReserve, knownToken.decimals);
            const unknownDecimalReserve = convertAtomicToDecimal(unknownReserve, unknownToken.decimals);

            if (knownDecimalReserve <= 0 || unknownDecimalReserve <= 0) return null;

            // CPMM formula: price_unknown = price_known * (reserve_known / reserve_unknown)
            const exchangeRate = unknownDecimalReserve / knownDecimalReserve;
            const unknownPrice = knownPrice / exchangeRate;

            return unknownPrice > 0 && isFinite(unknownPrice) ? unknownPrice : null;
        } catch (error) {
            console.warn('[CpmmEngine] Error calculating price from pool:', error);
            return null;
        }
    }

    /**
     * Find paths between two tokens
     */
    findPathsToToken(sourceToken: string, targetToken: string, maxPathLength = 4): CpmmPricePath[] {
        if (sourceToken === targetToken) return [];

        const paths: CpmmPricePath[] = [];
        const visited = new Set<string>();

        this.dfsPathFind(sourceToken, targetToken, [], [], visited, paths, maxPathLength);

        // Sort by reliability and liquidity
        paths.sort((a, b) => {
            const scoreA = a.reliability / Math.pow(a.pathLength, 1.5);
            const scoreB = b.reliability / Math.pow(b.pathLength, 1.5);
            return scoreB - scoreA;
        });

        return paths.slice(0, 10); // Top 10 paths
    }

    /**
     * Depth-first search for path finding
     */
    private dfsPathFind(
        current: string,
        target: string,
        currentPath: string[],
        currentPools: CpmmPoolEdge[],
        visited: Set<string>,
        results: CpmmPricePath[],
        maxDepth: number
    ): void {
        if (currentPath.length >= maxDepth) return;

        if (current === target) {
            // Found a path
            const totalLiquidity = currentPools.reduce((sum, pool) => sum + Math.sqrt(pool.reservesA * pool.reservesB), 0);
            const pathLengthPenalty = 1 / Math.pow(currentPath.length + 1, 0.5);
            const reliability = pathLengthPenalty;

            results.push({
                tokens: [...currentPath, target],
                pools: [...currentPools],
                totalLiquidity,
                pathLength: currentPath.length + 1,
                reliability
            });
            return;
        }

        visited.add(current);

        const edges = this.edges.get(current) || [];
        for (const edge of edges) {
            const nextToken = edge.tokenA === current ? edge.tokenB : edge.tokenA;

            if (!visited.has(nextToken)) {
                this.dfsPathFind(
                    nextToken,
                    target,
                    [...currentPath, current],
                    [...currentPools, edge],
                    visited,
                    results,
                    maxDepth
                );
            }
        }

        visited.delete(current);
    }

    /**
     * Calculate reliability of a pool based on liquidity
     */
    private calculatePoolReliability(edge: CpmmPoolEdge): number {
        const liquidity = Math.sqrt(edge.reservesA * edge.reservesB);
        return Math.min(1, liquidity / 1000000000000); // Normalize to reasonable scale
    }

    /**
     * Calculate reliability of a path
     */
    private calculatePathReliability(path: CpmmPricePath): number {
        return path.reliability;
    }

    /**
     * Get token symbol by ID
     */
    private getTokenSymbol(tokenId: string): string {
        return this.tokens.get(tokenId)?.symbol || tokenId.slice(-8);
    }

    /**
     * Get token information
     */
    getToken(tokenId: string): CpmmToken | undefined {
        return this.tokens.get(tokenId);
    }

    /**
     * Get all tokens
     */
    getAllTokens(): CpmmToken[] {
        return Array.from(this.tokens.values());
    }

    /**
     * Get all pools
     */
    getAllPools(): CpmmPoolEdge[] {
        return Array.from(this.pools.values());
    }

    /**
     * Get direct trading pairs for a token
     */
    getDirectPairs(tokenId: string): CpmmPoolEdge[] {
        return this.edges.get(tokenId) || [];
    }

    /**
     * Check if graph needs rebuilding
     */
    needsRebuild(maxAgeMs = 5 * 60 * 1000): boolean {
        return Date.now() - this.lastUpdated > maxAgeMs;
    }

    /**
     * Get graph statistics
     */
    getStats() {
        return {
            totalTokens: this.tokens.size,
            totalPools: this.pools.size,
            lastUpdated: this.lastUpdated,
            ageMs: Date.now() - this.lastUpdated
        };
    }
}