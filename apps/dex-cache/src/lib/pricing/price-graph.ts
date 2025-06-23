import { getAllVaultData, type Vault } from '../pool-service';
import { SBTC_CONTRACT_ID, isStablecoin } from './btc-oracle';
import {
    getTokenDecimals,
    isValidDecimalConversion,
    convertAtomicToDecimal
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
    liquidityUsd: number; // Deprecated: This is actually relative liquidity, not USD
    liquidityRelative: number; // Geometric mean of decimal-converted reserves (for display)
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
    private globalMaxLiquidity = 0; // Cache for performance optimization

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
            console.log(`[PriceGraph] 🔍 POOL DETECTION DEBUG - Total vaults found: ${vaults.length}`);

            // Debug: Check for specific pools we're looking for
            const debugPools = vaults.filter(v =>
                v.tokenA?.symbol === 'CHA' || v.tokenB?.symbol === 'CHA' ||
                v.tokenA?.symbol === 'B' || v.tokenB?.symbol === 'B' ||
                v.contractId?.includes('beri')
            );

            if (debugPools.length > 0) {
                console.log(`[PriceGraph] 🔍 Found ${debugPools.length} CHA or B related pools for debugging:`);
                debugPools.forEach(pool => {
                    console.log(`[PriceGraph]   ${pool.contractId}: ${pool.tokenA?.symbol}/${pool.tokenB?.symbol} - Type: ${pool.type}, Protocol: ${pool.protocol}, Reserves: ${pool.reservesA}/${pool.reservesB}`);
                });
            }

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

            console.log(`[PriceGraph] After filtering: ${liquidityPools.length} valid CHARISMA liquidity pools`);

            // Debug: Check if any CHA/B pools were filtered out
            const filteredOutChaB = vaults.filter(v =>
                (v.tokenA?.symbol === 'CHA' && v.tokenB?.symbol === 'B') ||
                (v.tokenA?.symbol === 'B' && v.tokenB?.symbol === 'CHA')
            ).filter(v => !liquidityPools.includes(v));

            if (filteredOutChaB.length > 0) {
                console.warn(`[PriceGraph] ⚠️  Found ${filteredOutChaB.length} CHA/B pools that were filtered out:`);
                filteredOutChaB.forEach(pool => {
                    const reasons = [];
                    if (pool.type !== 'POOL') reasons.push(`type=${pool.type}`);
                    if (pool.protocol !== 'CHARISMA') reasons.push(`protocol=${pool.protocol}`);
                    if (!pool.tokenA) reasons.push('no tokenA');
                    if (!pool.tokenB) reasons.push('no tokenB');
                    if (pool.reservesA === undefined) reasons.push('reservesA undefined');
                    if (pool.reservesB === undefined) reasons.push('reservesB undefined');
                    if (pool.reservesA !== undefined && pool.reservesA <= 0) reasons.push(`reservesA=${pool.reservesA}`);
                    if (pool.reservesB !== undefined && pool.reservesB <= 0) reasons.push(`reservesB=${pool.reservesB}`);

                    console.warn(`[PriceGraph]   ${pool.contractId}: Filtered because: ${reasons.join(', ')}`);
                });
            }

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
            console.log(`[PriceGraph] 🔍 PROCESSING ${liquidityPools.length} POOLS:`);

            for (const vault of liquidityPools) {
                if (!vault.tokenA || !vault.tokenB) {
                    console.log(`[PriceGraph] Skipping vault ${vault.symbol} - missing tokens`);
                    continue;
                }

                console.log(`[PriceGraph] ✅ Processing pool: ${vault.tokenA.symbol}/${vault.tokenB.symbol} (${vault.symbol}) - Contract: ${vault.contractId}`);

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

                // Enhanced validation to prevent calculation errors
                if (!isFinite(reserveA) || !isFinite(reserveB) || reserveA <= 0 || reserveB <= 0 ||
                    isNaN(reserveA) || isNaN(reserveB)) {
                    console.warn(`[PriceGraph] Invalid atomic reserves for ${vault.symbol}: A=${reserveA}, B=${reserveB}`);
                    continue;
                }

                // Log warning for very large numbers 
                if (reserveA > Number.MAX_SAFE_INTEGER || reserveB > Number.MAX_SAFE_INTEGER) {
                    console.warn(`[PriceGraph] Very large atomic reserves detected for ${vault.symbol}: A=${reserveA.toExponential(2)}, B=${reserveB.toExponential(2)} - proceeding with calculation`);
                }

                // Calculate simple liquidity weight for pathfinding
                // Since we're now USD-only, we'll calculate this during the second pass
                // For now, use a simple approach based on reserve sizes
                const simpleWeight = Math.sqrt(reserveA * reserveB);
                
                console.log(`[PriceGraph] Simple liquidity weight: ${simpleWeight}`);

                if (simpleWeight <= 0 || !isFinite(simpleWeight)) {
                    console.warn(`[PriceGraph] Invalid liquidity weight for ${vault.symbol}: ${simpleWeight}`);
                    continue;
                }

                // Calculate edge weight for pathfinding
                // Higher liquidity = lower cost for pathfinding
                const edgeWeight = simpleWeight > 0 ? 1 / simpleWeight : Infinity;

                const poolEdge: PoolEdge = {
                    poolId: vault.contractId,
                    tokenA: tokenAId,
                    tokenB: tokenBId,
                    reserveA,
                    reserveB,
                    liquidityUsd: 0, // Will be calculated in second pass (deprecated)
                    liquidityRelative: 0, // Will be calculated in second pass
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

    /**
     * Run iterative price discovery starting from sBTC oracle anchor
     */
    private async runIterativePriceDiscovery(): Promise<Map<string, number>> {
        const discoveredPrices = new Map<string, number>();
        const priceConfidence = new Map<string, number>();
        
        // Step 1: Initialize with sBTC oracle price
        try {
            const { getBtcPrice } = await import('./btc-oracle');
            const btcPrice = await getBtcPrice();
            if (btcPrice) {
                discoveredPrices.set(SBTC_CONTRACT_ID, btcPrice.price);
                priceConfidence.set(SBTC_CONTRACT_ID, 1.0); // Highest confidence for oracle price
                console.log(`[PriceDiscovery] 🔧 Anchor: sBTC = $${btcPrice.price} (confidence: 100%)`);
            } else {
                console.error('[PriceDiscovery] Failed to get BTC oracle price - cannot run price discovery');
                return discoveredPrices;
            }
        } catch (error) {
            console.error('[PriceDiscovery] Error getting BTC price:', error);
            return discoveredPrices;
        }

        // Step 2: Add known stablecoin anchors
        for (const [tokenId, node] of this.nodes.entries()) {
            if (isStablecoin(node.symbol)) {
                discoveredPrices.set(tokenId, 1.00);
                priceConfidence.set(tokenId, 0.95); // High confidence for stablecoins
                console.log(`[PriceDiscovery] 🔧 Stablecoin anchor: ${node.symbol} = $1.00 (confidence: 95%)`);
            }
        }

        console.log(`[PriceDiscovery] Starting iterative discovery with ${discoveredPrices.size} anchors...`);

        // Step 3: Iterative price discovery through liquidity graph
        let cycle = 1;
        const maxCycles = 10;
        
        while (cycle <= maxCycles) {
            const initialPriceCount = discoveredPrices.size;
            console.log(`[PriceDiscovery] 🔄 Cycle ${cycle}: Starting with ${initialPriceCount} known prices`);
            
            const newPrices = new Map<string, {price: number, confidence: number, path: string}>();
            
            // Examine each pool to discover new prices
            for (const [poolId, edge] of this.pools.entries()) {
                const tokenANode = this.nodes.get(edge.tokenA);
                const tokenBNode = this.nodes.get(edge.tokenB);
                
                if (!tokenANode || !tokenBNode) continue;
                
                // Skip pools with two stablecoins - they shouldn't be used for price discovery
                // since both tokens should be ~$1.00 and constant product doesn't apply
                if (isStablecoin(tokenANode.symbol) && isStablecoin(tokenBNode.symbol)) {
                    console.log(`[PriceDiscovery] 🚫 Skipping stablecoin/stablecoin pool: ${tokenANode.symbol}/${tokenBNode.symbol} (both should be ~$1.00)`);
                    continue;
                }
                
                const priceA = discoveredPrices.get(edge.tokenA);
                const priceB = discoveredPrices.get(edge.tokenB);
                const confidenceA = priceConfidence.get(edge.tokenA) || 0;
                const confidenceB = priceConfidence.get(edge.tokenB) || 0;
                
                // Case 1: We know price A, discover price B
                if (priceA !== undefined && priceB === undefined && priceA > 0) {
                    const newPrice = this.calculatePriceFromPool(edge, edge.tokenA, edge.tokenB, priceA);
                    if (newPrice > 0) {
                        const newConfidence = Math.max(0.1, confidenceA * 0.8); // Reduce confidence each hop
                        const pathInfo = `${tokenANode.symbol}→${tokenBNode.symbol}`;
                        
                        // Only update if this is a better price or first discovery
                        if (!newPrices.has(edge.tokenB) || newPrices.get(edge.tokenB)!.confidence < newConfidence) {
                            newPrices.set(edge.tokenB, {price: newPrice, confidence: newConfidence, path: pathInfo});
                        }
                    }
                }
                
                // Case 2: We know price B, discover price A  
                if (priceB !== undefined && priceA === undefined && priceB > 0) {
                    const newPrice = this.calculatePriceFromPool(edge, edge.tokenB, edge.tokenA, priceB);
                    if (newPrice > 0) {
                        const newConfidence = Math.max(0.1, confidenceB * 0.8); // Reduce confidence each hop
                        const pathInfo = `${tokenBNode.symbol}→${tokenANode.symbol}`;
                        
                        // Only update if this is a better price or first discovery
                        if (!newPrices.has(edge.tokenA) || newPrices.get(edge.tokenA)!.confidence < newConfidence) {
                            newPrices.set(edge.tokenA, {price: newPrice, confidence: newConfidence, path: pathInfo});
                        }
                    }
                }
            }
            
            // Add discovered prices to our main map
            for (const [tokenId, {price, confidence, path}] of newPrices.entries()) {
                const tokenNode = this.nodes.get(tokenId);
                discoveredPrices.set(tokenId, price);
                priceConfidence.set(tokenId, confidence);
                console.log(`[PriceDiscovery] ✅ Discovered: ${tokenNode?.symbol || tokenId} = $${price.toFixed(6)} (confidence: ${(confidence*100).toFixed(1)}%, path: ${path})`);
            }
            
            const finalPriceCount = discoveredPrices.size;
            const newlyDiscovered = finalPriceCount - initialPriceCount;
            
            console.log(`[PriceDiscovery] Cycle ${cycle} complete: ${newlyDiscovered} new prices discovered (total: ${finalPriceCount})`);
            
            // Stop if no new prices were discovered
            if (newlyDiscovered === 0) {
                console.log(`[PriceDiscovery] 🎯 Price discovery converged after ${cycle} cycles`);
                break;
            }
            
            cycle++;
        }
        
        // Summary
        console.log(`[PriceDiscovery] 📊 FINAL RESULTS:`);
        console.log(`[PriceDiscovery] Total tokens: ${this.nodes.size}`);
        console.log(`[PriceDiscovery] Prices discovered: ${discoveredPrices.size}`);
        console.log(`[PriceDiscovery] Coverage: ${((discoveredPrices.size / this.nodes.size) * 100).toFixed(1)}%`);
        
        // Log all discovered prices for verification
        const sortedPrices = Array.from(discoveredPrices.entries())
            .map(([tokenId, price]) => {
                const node = this.nodes.get(tokenId);
                const confidence = priceConfidence.get(tokenId) || 0;
                return {tokenId, symbol: node?.symbol || 'Unknown', price, confidence};
            })
            .sort((a, b) => b.confidence - a.confidence);
            
        sortedPrices.forEach(({symbol, price, confidence}) => {
            console.log(`[PriceDiscovery] ${symbol}: $${price.toFixed(6)} (${(confidence*100).toFixed(1)}%)`);
        });
        
        return discoveredPrices;
    }

    /**
     * Calculate price of unknown token from known token using pool exchange rate
     */
    private calculatePriceFromPool(
        edge: PoolEdge, 
        knownTokenId: string, 
        unknownTokenId: string, 
        knownPrice: number
    ): number {
        try {
            const knownNode = this.nodes.get(knownTokenId);
            const unknownNode = this.nodes.get(unknownTokenId);
            
            if (!knownNode || !unknownNode) return 0;
            
            // Determine which reserves correspond to which tokens
            const isKnownTokenA = edge.tokenA === knownTokenId;
            const knownReserve = isKnownTokenA ? edge.reserveA : edge.reserveB;
            const unknownReserve = isKnownTokenA ? edge.reserveB : edge.reserveA;
            
            // Convert to decimal amounts
            const knownDecimalReserve = convertAtomicToDecimal(knownReserve, knownNode.decimals);
            const unknownDecimalReserve = convertAtomicToDecimal(unknownReserve, unknownNode.decimals);
            
            if (knownDecimalReserve <= 0 || unknownDecimalReserve <= 0) return 0;
            
            // Calculate exchange rate: how many unknown tokens per known token
            const exchangeRate = unknownDecimalReserve / knownDecimalReserve;
            
            // Price of unknown token = price of known token / exchange rate
            const unknownPrice = knownPrice / exchangeRate;
            
            console.log(`[PriceDiscovery] Pool calc: ${knownNode.symbol} ($${knownPrice.toFixed(6)}) / ${unknownNode.symbol} rate=${exchangeRate.toFixed(6)} → $${unknownPrice.toFixed(6)}`);
            
            return unknownPrice > 0 && isFinite(unknownPrice) ? unknownPrice : 0;
        } catch (error) {
            console.warn('[PriceDiscovery] Error calculating price from pool:', error);
            return 0;
        }
    }

    private async calculateLiquidityValues(): Promise<void> {
        console.log('[PriceGraph] Calculating USD-normalized liquidity values for edges and nodes...');

        // Step 1: Iterative Price Discovery Algorithm starting from sBTC oracle
        console.log(`[PriceGraph] === ITERATIVE PRICE DISCOVERY FROM sBTC ORACLE ===`);

        const discoveredPrices = await this.runIterativePriceDiscovery();

        // Step 2: Calculate USD liquidity values for all pools
        console.log(`[PriceGraph] 💰 USD-ONLY LIQUIDITY CALCULATION:`);

        for (const [poolId, edge] of Array.from(this.pools.entries())) {
            // Get token nodes for decimal information
            const tokenANode = this.nodes.get(edge.tokenA);
            const tokenBNode = this.nodes.get(edge.tokenB);

            if (!tokenANode || !tokenBNode) {
                console.warn(`[PriceGraph] Missing token nodes for pool ${poolId}`);
                edge.liquidityUsd = 0;
                continue;
            }

            if (edge.reserveA > 0 && edge.reserveB > 0 && isFinite(edge.reserveA) && isFinite(edge.reserveB)) {
                // Get USD prices for both tokens
                const priceA = discoveredPrices.get(edge.tokenA);
                const priceB = discoveredPrices.get(edge.tokenB);

                if (priceA !== undefined && priceB !== undefined && priceA > 0 && priceB > 0) {
                    // USD-ONLY CALCULATION
                    console.log(`[PriceGraph] 💰 USD calculation for ${poolId} (${tokenANode.symbol}/${tokenBNode.symbol}):`);

                    // Convert atomic reserves to decimal format
                    const decimalReserveA = convertAtomicToDecimal(edge.reserveA, tokenANode.decimals);
                    const decimalReserveB = convertAtomicToDecimal(edge.reserveB, tokenBNode.decimals);

                    // Calculate USD values
                    const usdValueA = decimalReserveA * priceA;
                    const usdValueB = decimalReserveB * priceB;

                    // Calculate geometric mean of USD values
                    const usdLiquidity = Math.sqrt(usdValueA * usdValueB);

                    console.log(`[PriceGraph]   ${tokenANode.symbol}: ${decimalReserveA.toFixed(6)} × $${priceA} = $${usdValueA.toFixed(2)}`);
                    console.log(`[PriceGraph]   ${tokenBNode.symbol}: ${decimalReserveB.toFixed(6)} × $${priceB} = $${usdValueB.toFixed(2)}`);
                    console.log(`[PriceGraph]   USD Liquidity: √($${usdValueA.toFixed(2)} × $${usdValueB.toFixed(2)}) = $${usdLiquidity.toFixed(2)}`);

                    if (isFinite(usdLiquidity) && usdLiquidity > 0) {
                        edge.liquidityUsd = usdLiquidity;
                    } else {
                        console.warn(`[PriceGraph] Invalid USD liquidity for pool ${poolId}: ${usdLiquidity}`);
                        edge.liquidityUsd = 0;
                    }
                } else {
                    // NO FALLBACK: Pool excluded from scoring if no price data available
                    console.log(`[PriceGraph] ❌ No USD calculation for ${poolId} (missing prices: ${tokenANode.symbol}=${priceA}, ${tokenBNode.symbol}=${priceB})`);
                    edge.liquidityUsd = 0;
                }
            } else {
                console.warn(`[PriceGraph] Invalid reserves for liquidity calculation in pool ${poolId}`);
                edge.liquidityUsd = 0;
            }

            console.log(`[PriceGraph] Pool ${poolId}: ${tokenANode.symbol}/${tokenBNode.symbol} -> USD liquidity=$${edge.liquidityUsd.toFixed(2)}`);
        }

        // Simple approach: Calculate global relative liquidity scores
        console.log(`[PriceGraph] === CALCULATING GLOBAL LIQUIDITY PERCENTAGES ===`);

        // Step 1: Analyze all pool USD liquidity values for debugging
        console.log(`[PriceGraph] 🔍 DETAILED POOL ANALYSIS:`);
        const poolLiquidities: Array<{ poolId: string, symbol: string, usdLiquidity: number }> = [];

        for (const [poolId, edge] of this.pools.entries()) {
            const tokenANode = this.nodes.get(edge.tokenA);
            const tokenBNode = this.nodes.get(edge.tokenB);
            const symbol = `${tokenANode?.symbol || '?'}/${tokenBNode?.symbol || '?'}`;

            poolLiquidities.push({
                poolId,
                symbol,
                usdLiquidity: edge.liquidityUsd
            });

            console.log(`[PriceGraph]   ${symbol}: $${edge.liquidityUsd.toFixed(2)} (USD-discovered)`);
        }

        // Sort by liquidity to see the ranking
        poolLiquidities.sort((a, b) => b.usdLiquidity - a.usdLiquidity);
        console.log(`[PriceGraph] 📊 TOP 5 POOLS BY LIQUIDITY:`);
        poolLiquidities.slice(0, 5).forEach((pool, i) => {
            console.log(`[PriceGraph]   ${i + 1}. ${pool.symbol}: $${pool.usdLiquidity.toFixed(2)}`);
        });

        // Step 2: Find the global maximum liquidity
        this.globalMaxLiquidity = 0;
        let maxPoolInfo = '';

        for (const [poolId, edge] of this.pools.entries()) {
            if (edge.liquidityUsd > this.globalMaxLiquidity) {
                this.globalMaxLiquidity = edge.liquidityUsd;
                const tokenANode = this.nodes.get(edge.tokenA);
                const tokenBNode = this.nodes.get(edge.tokenB);
                maxPoolInfo = `${tokenANode?.symbol || '?'}/${tokenBNode?.symbol || '?'} (${poolId})`;
            }
        }

        console.log(`[PriceGraph] 🎯 GLOBAL MAXIMUM: $${this.globalMaxLiquidity.toFixed(2)}`);
        console.log(`[PriceGraph] Maximum pool: ${maxPoolInfo}`);

        // Check if the maximum is unreasonably high
        if (this.globalMaxLiquidity > 1000000) {
            console.warn(`[PriceGraph] ⚠️  VERY HIGH MAXIMUM DETECTED: $${this.globalMaxLiquidity.toFixed(0)} - this may cause percentage compression`);
        }

        // Step 3: Calculate relative percentages against global maximum
        if (this.globalMaxLiquidity > 0) {
            console.log(`[PriceGraph] 📊 CALCULATING PERCENTAGES (all pools vs max $${this.globalMaxLiquidity.toFixed(2)}):`);

            for (const [poolId, edge] of this.pools.entries()) {
                const relativePercentage = (edge.liquidityUsd / this.globalMaxLiquidity) * 100;
                edge.liquidityRelative = relativePercentage;

                const tokenANode = this.nodes.get(edge.tokenA);
                const tokenBNode = this.nodes.get(edge.tokenB);
                const symbol = `${tokenANode?.symbol}/${tokenBNode?.symbol}`;

                // Log all CHA pools and any pools > 0.1%
                if (relativePercentage > 0.1 || symbol.includes('CHA')) {
                    console.log(`[PriceGraph]   ${symbol}: $${edge.liquidityUsd.toFixed(2)} -> ${relativePercentage.toFixed(6)}%`);
                }
            }
        } else {
            for (const edge of this.pools.values()) {
                edge.liquidityRelative = 0;
            }
        }

        // Update node statistics
        console.log(`[PriceGraph] === UPDATING NODE STATISTICS ===`);
        for (const [tokenId, node] of Array.from(this.nodes.entries())) {
            const tokenEdges = this.edges.get(tokenId) || [];
            node.poolCount = tokenEdges.length;

            // Calculate total liquidity for this token across all pools
            let totalLiquidity = 0;
            for (const edge of tokenEdges) {
                totalLiquidity += edge.liquidityUsd;
            }
            node.totalLiquidity = totalLiquidity;

            console.log(`[PriceGraph] Token ${tokenId} (${node.symbol}): ${tokenEdges.length} pools, total liquidity=${totalLiquidity.toFixed(2)}`);

            // Special logging for sBTC to verify the fix
            if (tokenId.includes('sbtc') || tokenId.includes('sBTC') || node.symbol === 'sBTC') {
                console.log(`[PriceGraph] 🔍 sBTC TOKEN ANALYSIS (AFTER FIX):`);
                console.log(`[PriceGraph]   Contract: ${tokenId}`);
                console.log(`[PriceGraph]   Symbol: ${node.symbol}`);
                console.log(`[PriceGraph]   Pool count: ${tokenEdges.length}`);

                // Show all pool details for sBTC with new global scores
                tokenEdges.forEach((edge, index) => {
                    const pairedTokenId = edge.tokenA === tokenId ? edge.tokenB : edge.tokenA;
                    const pairedNode = this.nodes.get(pairedTokenId);
                    console.log(`[PriceGraph]     Pool ${index + 1}: ${edge.poolId} (${node.symbol}/${pairedNode?.symbol || '?'}) -> GLOBAL SCORE: ${edge.liquidityRelative?.toFixed(1)}%`);
                });
            }
        }

        console.log(`[PriceGraph] Updated liquidity values for ${this.pools.size} pools and ${this.nodes.size} tokens with GLOBAL scoring`);
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
     * Force rebuild the graph with current data
     */
    async forceRebuild(): Promise<void> {
        console.log('[PriceGraph] 🔄 FORCE REBUILDING GRAPH WITH CURRENT DATA');
        this.lastUpdated = 0; // Force rebuild by making it stale
        await this.buildGraph();
    }

    /**
     * Get the cached global maximum liquidity value
     */
    getGlobalMaxLiquidity(): number {
        return this.globalMaxLiquidity;
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
            globalMaxLiquidity: this.globalMaxLiquidity,
            lastUpdated: this.lastUpdated,
            ageMs: Date.now() - this.lastUpdated
        };
    }
}

// Singleton instance
let priceGraphInstance: PriceGraph | null = null;

export async function getPriceGraph(forceRebuild: boolean = false): Promise<PriceGraph> {
    if (!priceGraphInstance) {
        priceGraphInstance = new PriceGraph();
        await priceGraphInstance.buildGraph();
    } else if (forceRebuild) {
        console.log('[PriceGraph] 🔄 FORCE REBUILDING requested');
        await priceGraphInstance.forceRebuild();
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