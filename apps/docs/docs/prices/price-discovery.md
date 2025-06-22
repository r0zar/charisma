---
sidebar_position: 4
title: Price Discovery Algorithm
---

# Multi-Path Price Discovery

The Charisma Pricing System employs sophisticated algorithms to discover accurate token prices through multiple trading paths. This approach provides manipulation resistance, redundancy, and high confidence in pricing data across the entire ecosystem.

## Overview

Traditional price oracles often rely on single sources or simple averaging methods, making them vulnerable to manipulation and single points of failure. Charisma's multi-path discovery analyzes the entire liquidity graph to find optimal pricing routes while maintaining transparency and reliability.

### Key Principles

1. **Graph-Based Analysis**: Model all tokens and trading pairs as a connected graph
2. **Multiple Path Discovery**: Find all viable routes between tokens and price anchors
3. **Liquidity Weighting**: Prioritize paths with deeper liquidity
4. **Confidence Scoring**: Quantify reliability of each price calculation
5. **Fallback Mechanisms**: Maintain pricing continuity during market stress

## Algorithm Components

### 1. Graph Construction

The system builds a comprehensive graph of trading relationships:

```typescript
interface PriceGraph {
  nodes: Map<string, TokenNode>;    // All available tokens
  edges: Map<string, PoolEdge>;     // All trading pairs
  adjacency: Map<string, string[]>; // Token connections
}

interface TokenNode {
  contractId: string;
  symbol: string;
  decimals: number;
  connections: Set<string>;
}

interface PoolEdge {
  poolId: string;
  tokenA: string;
  tokenB: string;
  reserveA: number;        // Atomic units
  reserveB: number;        // Atomic units
  liquidityUsd: number;    // Estimated USD liquidity
  fee: number;            // Trading fee (e.g., 0.003 for 0.3%)
  lastUpdated: number;     // Data freshness timestamp
}
```

**Graph Building Process:**
1. **Vault Discovery**: Scan all available liquidity pools
2. **Node Creation**: Create unique nodes for each token
3. **Edge Construction**: Build edges for each trading pair
4. **Liquidity Calculation**: Compute USD liquidity estimates
5. **Connection Mapping**: Build adjacency lists for pathfinding

### 2. Path Discovery Algorithm

#### Depth-First Search with Backtracking

The system uses a Depth-First Search (DFS) algorithm to discover all possible trading paths from a source token to sBTC:

```typescript
findPathsToSbtc(sourceToken: string, maxPathLength = 4): PricePath[] {
  const paths: PricePath[] = [];
  const visited = new Set<string>();
  
  // Start DFS from source token to sBTC
  this.dfsPathFind(sourceToken, SBTC_CONTRACT_ID, [], [], visited, paths, maxPathLength);
  
  // Sort paths by confidence/reliability score
  paths.sort((a, b) => {
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
  if (currentPath.length >= maxDepth) return;

  if (current === target) {
    // Found a complete path to sBTC
    const totalLiquidity = currentPools.reduce((sum, pool) => sum + pool.liquidityUsd, 0);
    const minLiquidity = Math.min(...currentPools.map(p => p.liquidityUsd));
    
    // Calculate path reliability and confidence
    const reliability = this.calculatePathReliability(currentPools, currentPath.length);
    const confidence = Math.min(1, totalLiquidity / 50000);

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

  // Explore all connected tokens through pool edges
  const edges = this.edges.get(current) || [];
  for (const edge of edges) {
    const nextToken = edge.tokenA === current ? edge.tokenB : edge.tokenA;
    
    if (!visited.has(nextToken)) {
      this.dfsPathFind(
        nextToken, target, [...currentPath, current], 
        [...currentPools, edge], visited, results, maxDepth
      );
    }
  }

  visited.delete(current); // Backtrack
}
```

#### Liquidity Weight Calculation

The system calculates edge weights for pathfinding based on decimal-aware liquidity:

```typescript
// Calculate decimal-aware liquidity using geometric mean
const liquidityWeight = calculateDecimalAwareLiquidity(
  reserveA, vault.tokenA.decimals,
  reserveB, vault.tokenB.decimals
);

// Edge weight for pathfinding: higher liquidity = lower cost
const edgeWeight = liquidityWeight > 0 ? 1 / liquidityWeight : Infinity;

// Decimal-aware liquidity calculation
function calculateDecimalAwareLiquidity(
  reserveA: number,
  decimalsA: number, 
  reserveB: number,
  decimalsB: number
): number {
  const decimalA = convertAtomicToDecimal(reserveA, decimalsA);
  const decimalB = convertAtomicToDecimal(reserveB, decimalsB);
  
  // Geometric mean provides balanced liquidity measure
  return Math.sqrt(decimalA * decimalB);
}
```

### 3. Exchange Rate Calculation

#### Decimal-Aware Price Calculation

The system calculates exchange rates for each trading path using proper decimal conversion:

```typescript
private async calculatePathPrice(path: PricePath): Promise<number | null> {
  if (path.pools.length === 0) return null;

  let currentRatio = 1;
  let currentToken = path.tokens[0];

  // Process each hop in the path
  for (let i = 0; i < path.pools.length; i++) {
    const pool = path.pools[i];
    const nextToken = path.tokens[i + 1];

    // Determine input/output tokens and reserves
    const isTokenAInput = pool.tokenA === currentToken;
    const inputToken = isTokenAInput ? pool.tokenA : pool.tokenB;
    const outputToken = isTokenAInput ? pool.tokenB : pool.tokenA;
    let inputReserve = isTokenAInput ? pool.reserveA : pool.reserveB;
    let outputReserve = isTokenAInput ? pool.reserveB : pool.reserveA;

    // Get token decimals from graph nodes
    const inputDecimals = getTokenDecimals(inputToken, tokenNodes);
    const outputDecimals = getTokenDecimals(outputToken, tokenNodes);

    // Calculate decimal-aware exchange rate
    const exchangeRate = calculateDecimalAwareExchangeRate(
      inputReserve, inputDecimals,
      outputReserve, outputDecimals
    );

    if (!isFinite(exchangeRate) || exchangeRate <= 0) {
      return null; // Invalid exchange rate
    }

    currentRatio *= exchangeRate;
    currentToken = nextToken;
  }

  return currentRatio; // Final sBTC ratio
}
```

#### Price Aggregation Across Multiple Paths

The system aggregates prices from multiple paths using weighted median approach:

```typescript
private async calculatePriceFromPaths(
  symbol: string,
  paths: PricePath[],
  btcPrice: BtcPriceData
): Promise<TokenPriceData | null> {
  const pathPrices: Array<{
    sbtcRatio: number;
    usdPrice: number;
    weight: number;
    path: PricePath;
  }> = [];

  // Calculate price for each valid path
  for (const path of paths) {
    const pathPrice = await this.calculatePathPrice(path);
    if (pathPrice !== null && pathPrice > 0 && isFinite(pathPrice)) {
      const weight = this.calculatePathWeight(path);
      pathPrices.push({
        sbtcRatio: pathPrice,
        usdPrice: pathPrice * btcPrice.price,
        weight,
        path
      });
    }
  }

  if (pathPrices.length === 0) return null;

  // Sort by price for outlier detection
  pathPrices.sort((a, b) => a.sbtcRatio - b.sbtcRatio);

  // Remove outliers (prices more than 50% away from median)
  const medianPrice = pathPrices[Math.floor(pathPrices.length / 2)].sbtcRatio;
  const filteredPrices = pathPrices.filter(p => {
    const deviation = Math.abs(p.sbtcRatio - medianPrice) / medianPrice;
    return deviation <= 0.5; // 50% deviation threshold
  });

  if (filteredPrices.length === 0) {
    // Use median if all prices are outliers
    const medianEntry = pathPrices[Math.floor(pathPrices.length / 2)];
    return this.createTokenPriceData(symbol, medianEntry, [medianEntry.path], btcPrice, pathPrices);
  }

  // Calculate weighted average of filtered prices
  let totalWeight = 0;
  let weightedSum = 0;
  
  for (const entry of filteredPrices) {
    totalWeight += entry.weight;
    weightedSum += entry.sbtcRatio * entry.weight;
  }

  const avgSbtcRatio = weightedSum / totalWeight;
  const avgUsdPrice = avgSbtcRatio * btcPrice.price;

  return this.createFinalPriceData(symbol, avgSbtcRatio, avgUsdPrice, filteredPrices, btcPrice);
}
```

### 4. Confidence Scoring

#### Three-Factor Confidence Model

The system uses a simplified three-factor model to calculate confidence scores:

```typescript
// Calculate confidence based on price consistency and liquidity
const priceVariation = this.calculatePriceVariation(filteredPrices);
const totalLiquidity = filteredPrices.reduce((sum, p) => sum + p.path.totalLiquidity, 0);

// Three main confidence factors
const consistencyScore = Math.max(0, 1 - priceVariation);  // Price agreement
const liquidityScore = Math.min(1, totalLiquidity / 100000); // Normalized to $100k
const pathCountScore = Math.min(1, filteredPrices.length / 3); // Prefer multiple paths

// Weighted combination with BTC oracle confidence
const confidence = (
  consistencyScore * 0.4 +     // 40% weight on price consistency
  liquidityScore * 0.4 +       // 40% weight on liquidity depth  
  pathCountScore * 0.2         // 20% weight on path diversity
) * btcPrice.confidence;       // Adjusted by BTC oracle confidence

function calculatePriceVariation(pathPrices: Array<{ sbtcRatio: number; weight: number }>): number {
  if (pathPrices.length <= 1) return 0;

  const weightedAvg = pathPrices.reduce((sum, p) => sum + p.sbtcRatio * p.weight, 0) / 
                     pathPrices.reduce((sum, p) => sum + p.weight, 0);

  const variance = pathPrices.reduce((sum, p) => {
    const deviation = p.sbtcRatio - weightedAvg;
    return sum + Math.pow(deviation, 2) * p.weight;
  }, 0) / pathPrices.reduce((sum, p) => sum + p.weight, 0);

  return Math.sqrt(variance) / weightedAvg; // Coefficient of variation
}
```

#### Path Weight Calculation

Path weights are calculated based on reliability, confidence, liquidity, and data freshness:

```typescript
private calculatePathWeight(path: PricePath): number {
  // Base weight from path properties with minimum values to avoid zero weights
  const reliability = Math.max(0.01, path.reliability || 0.01);
  const confidence = Math.max(0.01, path.confidence || 0.01);
  let weight = reliability * confidence;

  // Penalize longer paths
  const pathPenalty = Math.pow(Math.max(1, path.pathLength || 1), 1.2);
  weight /= pathPenalty;

  // Boost based on minimum liquidity in path (bottleneck)
  if (path.pools && path.pools.length > 0) {
    const liquidities = path.pools.map(p => p.liquidityUsd || 0);
    const minLiquidity = Math.min(...liquidities);
    const liquidityBoost = Math.min(2, minLiquidity / 10000); // Max 2x boost at $10k
    weight *= (1 + liquidityBoost);
  }

  // Boost recent data
  if (path.pools && path.pools.length > 0) {
    const avgAge = path.pools.reduce((sum, p) => 
      sum + (Date.now() - (p.lastUpdated || Date.now())), 0
    ) / path.pools.length;
    const recencyBoost = Math.max(0.5, 1 - (avgAge / (60 * 60 * 1000))); // Decay over 1 hour
    weight *= recencyBoost;
  }

  // Ensure we never return zero weight
  return Math.max(0.001, weight);
}
```

### 5. Alternative Path Analysis

#### Path Discovery Through DFS

The DFS algorithm naturally discovers multiple independent paths during its recursive exploration:

```typescript
// All paths are found in a single DFS traversal
const paths: PricePath[] = [];
const visited = new Set<string>();

this.dfsPathFind(sourceToken, SBTC_CONTRACT_ID, [], [], visited, paths, maxPathLength);

// Sort paths by reliability score after discovery
paths.sort((a, b) => {
  const scoreA = a.reliability / Math.pow(a.pathLength, 1.5);
  const scoreB = b.reliability / Math.pow(b.pathLength, 1.5);
  return scoreB - scoreA;
});

return paths.slice(0, 10); // Return top 10 paths
```

#### Path Diversity and Redundancy

The backtracking nature of DFS ensures path diversity:

```typescript
private dfsPathFind(/* ... parameters ... */): void {
  // ... path discovery logic ...
  
  visited.add(current); // Mark as visited for this branch
  
  // Explore all connected tokens
  const edges = this.edges.get(current) || [];
  for (const edge of edges) {
    const nextToken = edge.tokenA === current ? edge.tokenB : edge.tokenA;
    
    if (!visited.has(nextToken)) {
      // Recursive exploration creates diverse paths
      this.dfsPathFind(nextToken, target, [...currentPath, current], 
                      [...currentPools, edge], visited, results, maxDepth);
    }
  }
  
  visited.delete(current); // Backtrack - crucial for path diversity
}
```

#### Price Validation Through Outlier Filtering

The system validates price consistency using median-based outlier detection:

```typescript
// Sort prices for median calculation
pathPrices.sort((a, b) => a.sbtcRatio - b.sbtcRatio);

// Calculate median price for outlier detection
const medianPrice = pathPrices[Math.floor(pathPrices.length / 2)].sbtcRatio;

// Filter out prices more than 50% away from median
const filteredPrices = pathPrices.filter(p => {
  const deviation = Math.abs(p.sbtcRatio - medianPrice) / medianPrice;
  return deviation <= 0.5; // 50% deviation threshold
});

// Use median if all prices are outliers
if (filteredPrices.length === 0) {
  const medianEntry = pathPrices[Math.floor(pathPrices.length / 2)];
  return this.createTokenPriceData(symbol, medianEntry, [medianEntry.path], btcPrice, pathPrices);
}
```

## Special Cases

### Stablecoin Handling

Stablecoins receive special treatment:

```typescript
function calculateStablecoinPrice(tokenSymbol: string): TokenPriceData {
  if (isStablecoin(tokenSymbol)) {
    const btcPrice = await getBtcPrice();
    
    return {
      usdPrice: 1.0,
      sbtcRatio: 1.0 / btcPrice.price,
      confidence: 0.99, // High confidence for known stablecoins
      lastUpdated: Date.now(),
      calculationDetails: {
        method: 'stablecoin_override',
        btcPrice: btcPrice.price
      }
    };
  }
}
```

### Direct sBTC Pairs

Tokens with direct sBTC pairs are discovered through the normal DFS process but receive higher reliability scores due to shorter path length:

```typescript
// Direct pairs are naturally prioritized by path length penalty in sorting
paths.sort((a, b) => {
  // Shorter paths (like direct sBTC pairs) get higher scores
  const scoreA = a.reliability / Math.pow(a.pathLength, 1.5);
  const scoreB = b.reliability / Math.pow(b.pathLength, 1.5);
  return scoreB - scoreA;
});

// Path length penalty calculation in reliability scoring
const pathLengthPenalty = 1 / Math.pow(currentPath.length, 0.5);
const reliability = liquidityScore * recencyScore * pathLengthPenalty;
```

Direct sBTC pairs naturally emerge as the highest-reliability paths due to:
- **Path Length**: Single hop (pathLength = 2)
- **Liquidity**: Direct exposure to sBTC reserve
- **Reliability**: No intermediate conversion risk
## Performance Optimizations

### Graph Caching Strategy

The price graph itself is cached and rebuilt only when stale:

```typescript
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

// Graph staleness check
needsRebuild(maxAgeMs = 5 * 60 * 1000): boolean {
  return Date.now() - this.lastUpdated > maxAgeMs;
}
```

### Price Calculation Caching

Calculated prices are cached using Redis (Vercel KV):

```typescript
// Multi-level caching strategy
const TOKEN_PRICE_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes
const BULK_PRICE_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

private async cachePrice(tokenId: string, priceData: TokenPriceData): Promise<void> {
  const cacheKey = `${TOKEN_PRICE_CACHE_PREFIX}${tokenId}`;
  await kv.setex(cacheKey, Math.floor(TOKEN_PRICE_CACHE_DURATION_MS / 1000), priceData);
}

// Bulk caching for multiple token calculations
private async cacheBulkPrices(priceMap: Map<string, TokenPriceData>): Promise<void> {
  const priceData = {
    prices: Array.from(priceMap.entries()).map(([tokenId, data]) => ({ ...data, tokenId })),
    lastUpdated: Date.now(),
    count: priceMap.size
  };
  
  await kv.setex(BULK_PRICE_CACHE_KEY, Math.floor(BULK_PRICE_CACHE_DURATION_MS / 1000), priceData);
}
```

### Parallel Batch Processing

Multiple token prices are calculated in parallel batches:

```typescript
async calculateMultipleTokenPrices(tokenIds: string[]): Promise<Map<string, TokenPriceData>> {
  // Check bulk cache first
  const cachedBulk = await this.getCachedBulkPrices();
  if (cachedBulk) {
    // Return cached results if all tokens found
    return this.filterCachedResults(cachedBulk, tokenIds);
  }

  // Process in batches to avoid overwhelming the system
  const batchSize = 10;
  const results = new Map<string, TokenPriceData>();
  
  for (let i = 0; i < tokenIds.length; i += batchSize) {
    const batch = tokenIds.slice(i, i + batchSize);
    
    const promises = batch.map(async (tokenId) => {
      const result = await this.calculateTokenPrice(tokenId);
      if (result.success && result.price) {
        results.set(tokenId, result.price);
      }
    });
    
    await Promise.all(promises);
  }
  
  return results;
}
```

### DFS Path Limitation

The DFS algorithm includes built-in performance safeguards:

```typescript
// Limit search depth to prevent infinite loops
const maxPathLength = 4; // Maximum 4 hops
this.dfsPathFind(sourceToken, SBTC_CONTRACT_ID, [], [], visited, paths, maxPathLength);

// Early termination conditions
if (currentPath.length >= maxDepth) {
  return; // Stop exploring deeper paths
}

// Limit total paths returned
return paths.slice(0, 10); // Return top 10 paths only
```

## Quality Assurance

### Price Calculation Validation

The system includes comprehensive validation throughout the calculation process:

```typescript
// Decimal conversion validation
if (!isValidDecimalConversion(inputReserve, inputDecimals) || 
    !isValidDecimalConversion(outputReserve, outputDecimals)) {
  console.log(`[PriceCalculator] Invalid conversion parameters`);
  return null;
}

// Reserve validation
if (!inputReserve || !outputReserve || inputReserve <= 0 || outputReserve <= 0) {
  console.log(`[PriceCalculator] Invalid atomic reserves: input=${inputReserve}, output=${outputReserve}`);
  return null;
}

// Exchange rate validation
const exchangeRate = calculateDecimalAwareExchangeRate(
  inputReserve, inputDecimals,
  outputReserve, outputDecimals
);

if (!isFinite(exchangeRate) || exchangeRate <= 0) {
  console.log(`[PriceCalculator] Invalid exchange rate: ${exchangeRate}`);
  return null;
}
```

### Path Quality Control

Each path undergoes quality assessment before being used in price calculation:

```typescript
// Path price validation
for (const path of paths) {
  const pathPrice = await this.calculatePathPrice(path);
  if (pathPrice !== null && pathPrice > 0 && isFinite(pathPrice)) {
    const weight = this.calculatePathWeight(path);
    pathPrices.push({
      sbtcRatio: pathPrice,
      usdPrice: pathPrice * btcPrice.price,
      weight,
      path
    });
  } else {
    console.log(`[PriceCalculator] Invalid path: ${path.tokens.join(' -> ')}, ratio: ${pathPrice}`);
  }
}

// Require minimum valid paths
if (pathPrices.length === 0) {
  console.log(`[PriceCalculator] No valid paths found for ${symbol}`);
  return null;
}
```

### Error Handling and Fallbacks

The system implements graceful degradation and error recovery:

```typescript
async calculateTokenPrice(tokenId: string, useCache = true): Promise<PriceCalculationResult> {
  try {
    // Handle sBTC directly (no calculation needed)
    if (tokenId === SBTC_CONTRACT_ID) {
      const btcPrice = await getBtcPrice();
      if (!btcPrice) {
        return { success: false, error: 'Failed to get BTC price' };
      }
      return { success: true, price: this.createSbtcPriceData(btcPrice) };
    }

    // Handle stablecoins with fixed $1 price
    if (tokenNode && isStablecoin(tokenNode.symbol)) {
      return { success: true, price: this.createStablecoinPriceData(tokenNode, btcPrice) };
    }

    // Main path discovery and calculation
    const priceData = await this.calculatePriceFromPaths(tokenNode.symbol, paths, btcPrice);
    
    if (!priceData) {
      return { success: false, error: 'Failed to calculate price from paths' };
    }

    return { success: true, price: priceData };

  } catch (error) {
    console.error(`[PriceCalculator] Error calculating price for ${tokenId}:`, error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
```

This multi-path price discovery algorithm ensures that Charisma provides accurate, reliable, and manipulation-resistant pricing data across the entire token ecosystem while maintaining high performance and fault tolerance.