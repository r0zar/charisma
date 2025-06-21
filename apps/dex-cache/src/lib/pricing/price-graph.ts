import { getAllVaultData, type Vault } from '../pool-service';
import { SBTC_CONTRACT_ID } from './btc-oracle';
import {
    calculateDecimalAwareLiquidity,
    getTokenDecimals,
    isValidDecimalConversion
} from './decimal-utils';

export interface TokenNode {
    contractId: string;
    symbol: string;
    name: string;
    decimals: number;
    totalLiquidity: number; // Total USD liquidity across all pools
    poolCount: number;
}

export interface PoolEdge {
    poolId: string;
    tokenA: string;
    tokenB: string;
    reserveA: number;
    reserveB: number;
    liquidityUsd: number;
    weight: number; // Calculated weight for pathfinding
    lastUpdated: number;
    fee: number;
}

export interface PricePath {
    tokens: string[];
    pools: PoolEdge[];
    totalLiquidity: number;
    pathLength: number;
    reliability: number;
    confidence: number;
}

export class PriceGraph {
    private nodes = new Map<string, TokenNode>();
    private edges = new Map<string, PoolEdge[]>(); // tokenId -> array of connected edges
    private pools = new Map<string, PoolEdge>();
    private lastUpdated = 0;

    constructor() {
        // Initialize sBTC as the base node
        this.nodes.set(SBTC_CONTRACT_ID, {
            contractId: SBTC_CONTRACT_ID,
            symbol: 'sBTC',
            name: 'Stacked Bitcoin',
            decimals: 8,
            totalLiquidity: 0,
            poolCount: 0
        });
    }

    async buildGraph(): Promise<void> {
        console.log('[PriceGraph] Building price discovery graph...');
        const startTime = Date.now();

        try {
            // Get all vault/pool data - only CHARISMA protocol
            const vaults = await getAllVaultData();
            const liquidityPools = vaults.filter(v => 
                v.type === 'POOL' && 
                v.protocol === 'CHARISMA' &&
                v.tokenA && 
                v.tokenB && 
                v.reservesA !== undefined && 
                v.reservesB !== undefined &&
                v.reservesA > 0 &&
                v.reservesB > 0
            );

            console.log(`[PriceGraph] Processing ${liquidityPools.length} CHARISMA liquidity pools`);
            
            if (liquidityPools.length === 0) {
                console.warn('[PriceGraph] No CHARISMA liquidity pools found! Check protocol filtering.');
                // Log sample vault for debugging
                if (vaults.length > 0) {
                    console.log('[PriceGraph] Sample vault:', {
                        type: vaults[0].type,
                        protocol: vaults[0].protocol,
                        symbol: vaults[0].symbol,
                        hasTokenA: !!vaults[0].tokenA,
                        hasTokenB: !!vaults[0].tokenB,
                        hasReserves: vaults[0].reservesA !== undefined && vaults[0].reservesB !== undefined
                    });
                }
            }

            // Clear existing data
            this.nodes.clear();
            this.edges.clear();
            this.pools.clear();

            // Re-initialize sBTC node
            this.nodes.set(SBTC_CONTRACT_ID, {
                contractId: SBTC_CONTRACT_ID,
                symbol: 'sBTC',
                name: 'Stacked Bitcoin',
                decimals: 8,
                totalLiquidity: 0,
                poolCount: 0
            });

            // First pass: Create nodes and edges
            for (const vault of liquidityPools) {
                if (!vault.tokenA || !vault.tokenB) {
                    console.log(`[PriceGraph] Skipping vault ${vault.symbol} - missing tokens`);
                    continue;
                }
                
                console.log(`[PriceGraph] Processing pool: ${vault.tokenA.symbol}/${vault.tokenB.symbol} (${vault.symbol})`);

                const tokenAId = vault.tokenA.contractId;
                const tokenBId = vault.tokenB.contractId;

                // Add nodes if they don't exist
                if (!this.nodes.has(tokenAId)) {
                    this.nodes.set(tokenAId, {
                        contractId: tokenAId,
                        symbol: vault.tokenA.symbol,
                        name: vault.tokenA.name,
                        decimals: vault.tokenA.decimals,
                        totalLiquidity: 0,
                        poolCount: 0
                    });
                }

                if (!this.nodes.has(tokenBId)) {
                    this.nodes.set(tokenBId, {
                        contractId: tokenBId,
                        symbol: vault.tokenB.symbol,
                        name: vault.tokenB.name,
                        decimals: vault.tokenB.decimals,
                        totalLiquidity: 0,
                        poolCount: 0
                    });
                }

                // Calculate pool liquidity using decimal-aware conversion
                let reserveA = vault.reservesA || 0;
                let reserveB = vault.reservesB || 0;
                
                // Convert to numbers if they're strings
                reserveA = typeof reserveA === 'string' ? parseFloat(reserveA) : reserveA;
                reserveB = typeof reserveB === 'string' ? parseFloat(reserveB) : reserveB;
                
                console.log(`[PriceGraph] Atomic reserves: ${vault.tokenA.symbol}=${reserveA}, ${vault.tokenB.symbol}=${reserveB}`);
                
                if (!isFinite(reserveA) || !isFinite(reserveB) || reserveA <= 0 || reserveB <= 0) {
                    console.warn(`[PriceGraph] Invalid atomic reserves for ${vault.symbol}: A=${reserveA}, B=${reserveB}`);
                    continue;
                }
                
                // Calculate decimal-aware liquidity weight
                const liquidityWeight = calculateDecimalAwareLiquidity(
                    reserveA, vault.tokenA.decimals,
                    reserveB, vault.tokenB.decimals
                );
                
                console.log(`[PriceGraph] Decimal-aware liquidity weight: ${liquidityWeight}`);
                
                if (liquidityWeight <= 0 || !isFinite(liquidityWeight)) {
                    console.warn(`[PriceGraph] Invalid liquidity weight for ${vault.symbol}: ${liquidityWeight}`);
                    continue;
                }
                
                // Calculate edge weight for pathfinding
                // Higher liquidity = lower cost for pathfinding
                const edgeWeight = liquidityWeight > 0 ? 1 / liquidityWeight : Infinity;

                const poolEdge: PoolEdge = {
                    poolId: vault.contractId,
                    tokenA: tokenAId,
                    tokenB: tokenBId,
                    reserveA,
                    reserveB,
                    liquidityUsd: 0, // Will be calculated in second pass
                    weight: edgeWeight,
                    lastUpdated: Date.now(),
                    fee: 0 // Fee not used in pricing calculations
                };

                this.pools.set(vault.contractId, poolEdge);

                // Add bidirectional edges
                this.addEdgeToNode(tokenAId, poolEdge);
                this.addEdgeToNode(tokenBId, poolEdge);
            }

            // Second pass: Calculate USD liquidity values and update node stats
            await this.calculateLiquidityValues();

            this.lastUpdated = Date.now();
            
            const buildTime = Date.now() - startTime;
            console.log(`[PriceGraph] Graph built in ${buildTime}ms: ${this.nodes.size} tokens, ${this.pools.size} pools`);

        } catch (error) {
            console.error('[PriceGraph] Failed to build graph:', error);
            throw error;
        }
    }

    private addEdgeToNode(tokenId: string, edge: PoolEdge): void {
        if (!this.edges.has(tokenId)) {
            this.edges.set(tokenId, []);
        }
        this.edges.get(tokenId)!.push(edge);
    }

    private async calculateLiquidityValues(): Promise<void> {
        console.log('[PriceGraph] Calculating decimal-aware liquidity values for edges and nodes...');
        
        // Update edge liquidity values using decimal-aware calculations
        for (const [poolId, edge] of Array.from(this.pools.entries())) {
            // Get token nodes for decimal information
            const tokenANode = this.nodes.get(edge.tokenA);
            const tokenBNode = this.nodes.get(edge.tokenB);
            
            if (!tokenANode || !tokenBNode) {
                console.warn(`[PriceGraph] Missing token nodes for pool ${poolId}`);
                edge.liquidityUsd = 0;
                continue;
            }
            
            // Calculate decimal-aware geometric mean
            const decimalAwareLiquidity = calculateDecimalAwareLiquidity(
                edge.reserveA, tokenANode.decimals,
                edge.reserveB, tokenBNode.decimals
            );
            
            // This gives us relative liquidity in decimal terms
            // Still not accurate USD but much better scaling than atomic units
            edge.liquidityUsd = decimalAwareLiquidity;
            
            console.log(`[PriceGraph] Pool ${poolId}: atomic(${edge.reserveA}, ${edge.reserveB}) -> decimal-aware liquidityUsd=${decimalAwareLiquidity}`);
        }
        
        // Update node statistics
        for (const [tokenId, node] of Array.from(this.nodes.entries())) {
            const tokenEdges = this.edges.get(tokenId) || [];
            node.poolCount = tokenEdges.length;
            
            // Calculate total liquidity for this token across all pools
            let totalLiquidity = 0;
            for (const edge of tokenEdges) {
                // Sum up the liquidity from all pools this token participates in
                totalLiquidity += edge.liquidityUsd;
            }
            node.totalLiquidity = totalLiquidity;
            
            console.log(`[PriceGraph] Token ${tokenId}: ${tokenEdges.length} pools, totalLiquidity=${totalLiquidity}`);
        }
        
        console.log(`[PriceGraph] Updated liquidity values for ${this.pools.size} pools and ${this.nodes.size} tokens`);
    }

    /**
     * Find all possible paths from source token to sBTC
     */
    findPathsToSbtc(sourceToken: string, maxPathLength = 4): PricePath[] {
        if (sourceToken === SBTC_CONTRACT_ID) {
            return []; // Source is already sBTC
        }

        console.log(`[PriceGraph] Finding paths from ${sourceToken} to sBTC`);
        console.log(`[PriceGraph] Source token has ${(this.edges.get(sourceToken) || []).length} connected pools`);

        const paths: PricePath[] = [];
        const visited = new Set<string>();
        
        this.dfsPathFind(sourceToken, SBTC_CONTRACT_ID, [], [], visited, paths, maxPathLength);
        
        console.log(`[PriceGraph] Found ${paths.length} paths to sBTC`);
        
        // Sort paths by confidence/reliability
        paths.sort((a, b) => {
            // Prefer shorter paths with higher liquidity
            const scoreA = a.reliability / Math.pow(a.pathLength, 1.5);
            const scoreB = b.reliability / Math.pow(b.pathLength, 1.5);
            return scoreB - scoreA;
        });

        return paths.slice(0, 10); // Return top 10 paths
    }

    private dfsPathFind(
        current: string,
        target: string,
        currentPath: string[],
        currentPools: PoolEdge[],
        visited: Set<string>,
        results: PricePath[],
        maxDepth: number
    ): void {
        if (currentPath.length >= maxDepth) {
            return;
        }

        if (current === target) {
            // Found a path to sBTC
            const totalLiquidity = currentPools.reduce((sum, pool) => sum + pool.liquidityUsd, 0);
            const minLiquidity = Math.min(...currentPools.map(p => p.liquidityUsd));
            const avgAge = currentPools.reduce((sum, pool) => sum + (Date.now() - pool.lastUpdated), 0) / currentPools.length;
            
            // Calculate reliability based on liquidity and recency
            const liquidityScore = Math.min(1, minLiquidity / 10000); // Normalize to max at $10k
            const recencyScore = Math.max(0, 1 - (avgAge / (24 * 60 * 60 * 1000))); // Decay over 24 hours
            const pathLengthPenalty = 1 / Math.pow(currentPath.length, 0.5);
            
            const reliability = liquidityScore * recencyScore * pathLengthPenalty;
            const confidence = Math.min(1, totalLiquidity / 50000); // Confidence based on total liquidity

            results.push({
                tokens: [...currentPath, target],
                pools: [...currentPools],
                totalLiquidity,
                pathLength: currentPath.length + 1,
                reliability,
                confidence
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
     * Get direct trading pairs for a token
     */
    getDirectPairs(tokenId: string): PoolEdge[] {
        return this.edges.get(tokenId) || [];
    }

    /**
     * Get node information for a token
     */
    getNode(tokenId: string): TokenNode | undefined {
        return this.nodes.get(tokenId);
    }

    /**
     * Get all tokens in the graph
     */
    getAllTokens(): TokenNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Get all pools in the graph
     */
    getAllPools(): PoolEdge[] {
        return Array.from(this.pools.values());
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
        const totalPools = this.pools.size;
        const totalTokens = this.nodes.size;
        const avgPoolsPerToken = totalTokens > 0 ? totalPools * 2 / totalTokens : 0;
        
        const sbtcNode = this.nodes.get(SBTC_CONTRACT_ID);
        const sbtcPairCount = sbtcNode ? sbtcNode.poolCount : 0;

        return {
            totalTokens,
            totalPools,
            avgPoolsPerToken: Number(avgPoolsPerToken.toFixed(2)),
            sbtcPairCount,
            lastUpdated: this.lastUpdated,
            ageMs: Date.now() - this.lastUpdated
        };
    }
}

// Singleton instance
let priceGraphInstance: PriceGraph | null = null;

export async function getPriceGraph(): Promise<PriceGraph> {
    if (!priceGraphInstance) {
        priceGraphInstance = new PriceGraph();
        await priceGraphInstance.buildGraph();
    } else if (priceGraphInstance.needsRebuild()) {
        console.log('[PriceGraph] Rebuilding stale graph');
        await priceGraphInstance.buildGraph();
    }
    
    return priceGraphInstance;
}

// Force refresh the graph
export async function refreshPriceGraph(): Promise<PriceGraph> {
    priceGraphInstance = new PriceGraph();
    await priceGraphInstance.buildGraph();
    return priceGraphInstance;
}