---
sidebar_position: 2
title: System Architecture
---

# Pricing System Architecture

The Charisma Pricing System is built on a layered architecture designed for scalability, reliability, and accuracy. This document details the technical implementation and data flow throughout the system.

## System Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Data Sources  │    │  External APIs  │    │   User Queries  │
│                 │    │                 │    │                 │
│ • Pool Reserves │    │ • BTC Oracles   │    │ • REST API      │
│ • Token Meta    │    │ • Price Feeds   │    │ • Web Interface │
│ • Vault Data    │    │ • Health Checks │    │ • WebSocket     │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌───────────────────────────────────────────────────────────────┐
│                      Pricing Engine                           │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Price Graph │  │ Calculator  │  │ Cache Layer │            │
│  │             │  │             │  │             │            │
│  │ • Nodes     │  │ • Multi-path│  │ • Reserve   │            │
│  │ • Edges     │  │ • Confidence│  │ • BTC Price │            │
│  │ • Liquidity │  │ • Decimals  │  │ • Results   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└───────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Data Layer

#### Pool Service (`pool-service.ts`)
Manages vault and liquidity pool data:

```typescript
interface Vault {
  type: string;           // POOL, SUBLINK, etc.
  protocol: string;       // CHARISMA, ALEX, etc.
  contractId: string;     // Smart contract identifier
  tokenA?: Token;         // First token in pair
  tokenB?: Token;         // Second token in pair
  reservesA?: number;     // Token A reserves (atomic units)
  reservesB?: number;     // Token B reserves (atomic units)
  fee: number;           // Trading fee percentage
}
```

**Key Functions:**
- `getAllVaultData()` - Fetches all vault configurations
- `getVaultData(contractId)` - Individual vault lookup
- `updateAllPoolReserves()` - Batch reserve updates (cron jobs)
- `listVaultTokens()` - Extract unique tokens from vaults

#### Reserve Management
- **Cache Duration**: 30 seconds for UI requests, 5 minutes for pricing
- **Update Strategy**: Primary (quote) and backup (balance) methods
- **Validation**: Minimum reserve thresholds and data integrity checks

### 2. Graph Layer

#### Price Graph (`price-graph.ts`)
Constructs trading relationship graph:

```typescript
interface TokenNode {
  contractId: string;
  symbol: string;
  decimals: number;
  connections: Set<string>;  // Connected token IDs
}

interface PoolEdge {
  poolId: string;
  tokenA: string;
  tokenB: string;
  reserveA: number;         // Atomic units
  reserveB: number;         // Atomic units
  liquidityUsd: number;     // USD liquidity estimate
  lastUpdated: number;      // Timestamp
}
```

**Graph Construction:**
1. Load all vaults and extract token pairs
2. Create nodes for each unique token
3. Create edges for each trading pair
4. Calculate liquidity weights using geometric mean
5. Build adjacency lists for pathfinding

**Pathfinding Algorithm:**
- **Depth-First Search (DFS)**: With backtracking for comprehensive path discovery
- **Path Diversity**: Naturally discovers multiple independent routes through backtracking
- **Path Validation**: Validates liquidity thresholds and exchange rate calculations
- **Alternative Routes**: Finds all viable paths within depth limits (4 hops maximum)

### 3. Calculation Layer

#### Price Calculator (`price-calculator.ts`)
Core pricing algorithms:

```typescript
interface TokenPriceData {
  usdPrice: number;
  sbtcRatio: number;
  confidence: number;
  lastUpdated: number;
  primaryPath?: PricePath;
  alternativePaths?: PricePath[];
  calculationDetails: {
    pathsUsed: number;
    totalLiquidity: number;
    btcPrice: number;
  };
}
```

**Calculation Process:**
1. **Path Discovery**: DFS finds all viable routes from token to sBTC (max 4 hops)
2. **Decimal Conversion**: Convert atomic units to decimal representation using token decimals
3. **Exchange Rate Math**: Apply decimal-aware constant product formula for each hop
4. **Outlier Detection**: Filter paths with prices >50% deviation from median
5. **Path Weighting**: Multi-factor weighting (liquidity, recency, path length, reliability)
6. **Price Aggregation**: Weighted median approach with confidence scoring
7. **USD Conversion**: Apply current BTC price with oracle confidence adjustment

#### Decimal Utilities (`decimal-utils.ts`)
Comprehensive decimal precision handling across different token scales:

```typescript
// Atomic to decimal conversion with validation
function convertAtomicToDecimal(atomicValue: number, decimals: number): number {
  if (!isFinite(atomicValue) || atomicValue < 0 || decimals < 0 || decimals > 18) {
    console.warn(`[DecimalUtils] Invalid conversion: atomicValue=${atomicValue}, decimals=${decimals}`);
    return 0;
  }
  const divisor = Math.pow(10, decimals);
  return atomicValue / divisor;
}

// Decimal-aware exchange rate calculation
function calculateDecimalAwareExchangeRate(
  inputReserve: number, inputDecimals: number,
  outputReserve: number, outputDecimals: number
): number {
  const inputDecimal = convertAtomicToDecimal(inputReserve, inputDecimals);
  const outputDecimal = convertAtomicToDecimal(outputReserve, outputDecimals);
  return outputDecimal / inputDecimal;
}

// Geometric mean liquidity calculation
function calculateDecimalAwareLiquidity(
  reserveA: number, decimalsA: number,
  reserveB: number, decimalsB: number
): number {
  const decimalA = convertAtomicToDecimal(reserveA, decimalsA);
  const decimalB = convertAtomicToDecimal(reserveB, decimalsB);
  return Math.sqrt(decimalA * decimalB);
}

// Validation utilities
function isValidDecimalConversion(atomicValue: number, decimals: number): boolean {
  return isFinite(atomicValue) && atomicValue >= 0 && 
         Number.isInteger(decimals) && decimals >= 0 && decimals <= 18;
}
```

**Key Features:**
- **Input Validation**: Comprehensive parameter checking and bounds validation
- **Error Handling**: Graceful fallbacks for invalid conversions
- **Precision Control**: Handles tokens with 0-18 decimal places
- **Liquidity Calculations**: Geometric mean for balanced pool analysis

### 4. BTC Oracle Layer

#### Oracle System (`btc-oracle.ts`)
Provides reliable Bitcoin price feeds:

**Price Sources:**
- CoinGecko API (Primary)
- Kraken API (Secondary)
- Circuit breakers for failure handling
- Weighted averaging across sources

**Caching Strategy:**
- **Fresh Data**: 5-minute cache duration
- **Stale-While-Revalidate**: 30-second grace period
- **Backup Storage**: Fallback to last known good price
- **Health Monitoring**: Track oracle reliability

**Stablecoin Detection:**
```typescript
function isStablecoin(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  // Note: sUSDh is a yield-bearing token but should still be priced through normal paths
  return STABLECOIN_SYMBOLS.some(stableSymbol => 
    upperSymbol === stableSymbol || 
    upperSymbol.includes('USD') || 
    upperSymbol.includes('DAI')
  );
}

// Fixed USD pricing for stablecoins in arbitrage analysis
if (tokenNode && isStablecoin(tokenNode.symbol)) {
  return {
    usdPrice: 1.0, // Fixed $1 for arbitrage perspective
    sbtcRatio: 1.0 / btcPrice.price,
    confidence: 1.0
  };
}
```

### 5. API Layer

#### REST Endpoints
**`/api/v1/prices`**
- Bulk token pricing with filtering
- Configurable limits and confidence thresholds
- Optional detailed path information

**Query Parameters:**
- `limit` - Maximum tokens to return
- `details` - Include calculation details
- `minConfidence` - Filter by confidence threshold
- `symbols` - Specific token symbols to price

**Response Format:**
```json
{
  "status": "success",
  "data": [
    {
      "tokenId": "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc",
      "symbol": "aBTC",
      "name": "Alex Bitcoin",
      "decimals": 8,
      "usdPrice": 98432.15,
      "sbtcRatio": 1.0023,
      "confidence": 0.95,
      "lastUpdated": 1703123456789
    }
  ],
  "metadata": {
    "count": 45,
    "totalTokensAvailable": 127,
    "processingTimeMs": 234
  }
}
```

### 6. Cache Architecture

#### Multi-Level Caching Strategy
1. **Application Cache**: In-memory graph singleton with staleness checking
2. **Vercel KV (Redis)**: Persistent storage for calculated prices and vault data
3. **CDN Cache**: Edge caching for API responses (30s cache, 60s stale-while-revalidate)
4. **Browser Cache**: Client-side caching based on Cache-Control headers

#### Cache Keys and Durations
```typescript
// Price calculation caching
const TOKEN_PRICE_CACHE_PREFIX = 'token-price:';           // 5 minutes
const BULK_PRICE_CACHE_KEY = 'bulk-token-prices';         // 5 minutes
const PRICE_CALCULATION_CACHE_PREFIX = 'price-calc:';     // 1 minute

// Vault and oracle caching
'dex-vault:{contractId}' - Individual vault data          // 30 seconds (UI), 5 minutes (pricing)
'btc-price' - Current Bitcoin price                       // 5 minutes
'btc-price-backup' - Backup Bitcoin price                 // Persistent
'btc-oracle-health' - Oracle health status                // 1 minute
```

#### Caching Implementation
```typescript
// Individual price caching
private async cachePrice(tokenId: string, priceData: TokenPriceData): Promise<void> {
  const cacheKey = `${TOKEN_PRICE_CACHE_PREFIX}${tokenId}`;
  await kv.setex(cacheKey, Math.floor(TOKEN_PRICE_CACHE_DURATION_MS / 1000), priceData);
}

// Bulk price caching for efficiency
private async cacheBulkPrices(priceMap: Map<string, TokenPriceData>): Promise<void> {
  const priceData = {
    prices: Array.from(priceMap.entries()).map(([tokenId, data]) => ({ ...data, tokenId })),
    lastUpdated: Date.now(),
    count: priceMap.size
  };
  await kv.setex(BULK_PRICE_CACHE_KEY, Math.floor(BULK_PRICE_CACHE_DURATION_MS / 1000), priceData);
}
```

#### Invalidation Strategy
- **Time-based**: TTL expiration with different durations per data type
- **Staleness Detection**: Graph rebuilding when data age exceeds thresholds
- **Health-based**: Automatic refresh on oracle failures and circuit breaker activation
- **Bulk Cache Optimization**: Intelligent cache hit detection for multiple token requests

## Performance Considerations

### Optimization Strategies
1. **Batch Processing**: 10-token batches for bulk price calculations
2. **Parallel Fetching**: Concurrent Promise.all() for multiple token processing
3. **Graph Singleton**: Single price graph instance with intelligent rebuilding
4. **Path Limitations**: DFS depth limiting (4 hops max) and result limiting (top 10 paths)
5. **Cache Warming**: Proactive price calculation for all available tokens
6. **Circuit Breakers**: Oracle failure protection and automatic fallbacks

```typescript
// Batch processing implementation
async calculateMultipleTokenPrices(tokenIds: string[]): Promise<Map<string, TokenPriceData>> {
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

// Graph staleness detection
needsRebuild(maxAgeMs = 5 * 60 * 1000): boolean {
  return Date.now() - this.lastUpdated > maxAgeMs;
}
```

### Scalability Features
- **Stateless Design**: Enables horizontal scaling across multiple instances
- **Vercel WAF Rate Limiting**: Edge-level protection (100 requests/60s per IP)
- **Graceful Degradation**: Fallbacks for oracle failures and invalid paths
- **Performance Monitoring**: Comprehensive logging and health checks
- **Memory Efficiency**: Proper cleanup and bounded collections

## Security Measures

### Data Integrity
- **Validation**: Input sanitization and type checking
- **Checksums**: Verify data consistency
- **Rollback**: Revert to known good state on errors

### API Security
- **CORS**: Proper cross-origin policies (`Access-Control-Allow-Origin: *`)
- **Vercel WAF**: Edge-level rate limiting and DDoS protection
- **Input Validation**: Comprehensive parameter sanitization and type checking
- **Error Handling**: Structured error responses without sensitive information leakage
- **Contract ID Validation**: Proper format validation for token identifiers

## Monitoring and Observability

### Health Checks
- **Oracle Status**: Monitor external price feed health
- **Cache Performance**: Track hit rates and latency
- **API Metrics**: Response times and error rates
- **Data Freshness**: Alert on stale data

### Logging
- **Structured Logging**: Consistent log format
- **Error Tracking**: Comprehensive error capture
- **Performance Metrics**: Response time tracking
- **Audit Trail**: Price calculation history

## Advanced Price Aggregation

### Median-Based Outlier Detection
The system implements sophisticated price validation to ensure accuracy:

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
```

### Three-Factor Confidence Model
Price confidence is calculated using multiple factors:

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
```

### Multi-Factor Path Weighting
Each trading path receives a sophisticated weight calculation:

```typescript
private calculatePathWeight(path: PricePath): number {
  // Base weight from path properties
  const reliability = Math.max(0.01, path.reliability || 0.01);
  const confidence = Math.max(0.01, path.confidence || 0.01);
  let weight = reliability * confidence;
  
  // Penalize longer paths
  const pathPenalty = Math.pow(Math.max(1, path.pathLength || 1), 1.2);
  weight /= pathPenalty;
  
  // Boost based on minimum liquidity in path (bottleneck)
  const minLiquidity = Math.min(...path.pools.map(p => p.liquidityUsd));
  const liquidityBoost = Math.min(2, minLiquidity / 10000); // Max 2x boost at $10k
  weight *= (1 + liquidityBoost);
  
  // Boost recent data
  const avgAge = path.pools.reduce((sum, p) => sum + (Date.now() - p.lastUpdated), 0) / path.pools.length;
  const recencyBoost = Math.max(0.5, 1 - (avgAge / (60 * 60 * 1000))); // Decay over 1 hour
  weight *= recencyBoost;
  
  return Math.max(0.001, weight); // Ensure non-zero weight
}
```

This architecture ensures reliable, accurate, and scalable token pricing across the Charisma ecosystem while maintaining high performance, fault tolerance, and mathematical precision.