# Price Service - Three-Engine Architecture

A comprehensive price discovery system that separates concerns into three specialized engines: Oracle, CPMM (Constant Product Market Maker), and Intrinsic Value calculation.

## 🏗️ Architecture Overview

The price service is built around **three distinct pricing engines** that handle different types of price discovery:

```
┌─────────────────────────────────────────┐
│           Price Service                 │
│            Orchestrator                 │
├─────────────────────────────────────────┤
│  • Intelligent engine selection        │
│  • Arbitrage analysis                  │
│  • Caching & health monitoring         │
│  • Unified API interface               │
└─────────────┬───────────────────────────┘
              │
     ┌────────┼────────┐
     │        │        │
┌────▼───┐ ┌──▼──┐ ┌───▼────┐
│Oracle  │ │CPMM │ │Intrinsic│
│Engine  │ │Engine│ │ Engine │
└────────┘ └─────┘ └────────┘
```

### 🔮 Oracle Engine
- **Purpose**: External market price feeds
- **Assets**: BTC (via Kraken, CoinGecko APIs)
- **Use Case**: Base price anchoring for sBTC

### 📊 CPMM Engine  
- **Purpose**: Market price discovery through AMM pools
- **Assets**: Any token with sufficient liquidity pools
- **Use Case**: Real market prices from trading activity

### 💎 Intrinsic Value Engine
- **Purpose**: Redeemable asset valuation
- **Assets**: Stablecoins ($1.00), sBTC (BTC price), Subnet tokens (base price), LP tokens (underlying assets)
- **Use Case**: Assets with defined redemption values

## 🎯 Key Concepts

### Price Source Types
- **Oracle**: External market feeds (e.g., BTC from exchanges)
- **Market**: AMM pool price discovery (e.g., CHA/sBTC pool rates)  
- **Intrinsic**: Redeemable value calculation (e.g., LP token underlying assets)
- **Hybrid**: Combination of multiple sources with arbitrage analysis

### Arbitrage Analysis
When multiple price sources are available, the system automatically:
- Compares market vs intrinsic values
- Calculates percentage deviations
- Identifies profitable arbitrage opportunities
- Provides detailed breakdown of price differences

## 🚀 Quick Start

### Basic Setup

```typescript
import { 
    PriceServiceOrchestrator, 
    OracleEngine, 
    CpmmEngine, 
    IntrinsicValueEngine 
} from '@services/prices';

// Create engines
const oracleEngine = new OracleEngine();
const cpmmEngine = new CpmmEngine();
const intrinsicEngine = new IntrinsicValueEngine();

// Create orchestrator
const priceService = new PriceServiceOrchestrator();
priceService.setOracleEngine(oracleEngine);
priceService.setCpmmEngine(cpmmEngine);
priceService.setIntrinsicEngine(intrinsicEngine);

// Calculate a price
const result = await priceService.calculateTokenPrice('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token');
if (result.success) {
    console.log(`CHA Price: $${result.price.usdPrice} (${result.price.source})`);
}
```

### With Arbitrage Analysis

```typescript
const result = await priceService.calculateTokenPrice(
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.some-lp-token',
    { includeArbitrageAnalysis: true }
);

if (result.success && result.price.arbitrageOpportunity) {
    const arb = result.price.arbitrageOpportunity;
    console.log(`Market: $${arb.marketPrice}, Intrinsic: $${arb.intrinsicValue}`);
    console.log(`Deviation: ${arb.deviation.toFixed(2)}%, Profitable: ${arb.profitable}`);
}
```

### Bulk Price Calculation

```typescript
const tokenIds = [
    'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
    'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token',
    // ... more tokens
];

const bulkResult = await priceService.calculateMultipleTokenPrices(tokenIds, {
    includeArbitrageAnalysis: true,
    batchSize: 5
});

console.log(`Calculated ${bulkResult.prices.size} prices`);
console.log('Engine usage:', bulkResult.debugInfo?.engineStats);
```

## 🔧 Engine Configuration

### Oracle Engine Setup

```typescript
// Configure BTC oracle sources
const oracleEngine = new OracleEngine([
    new KrakenOracleSource(),
    new CoinGeckoOracleSource()
]);

// Check oracle status
const status = oracleEngine.getStatus();
console.log('Oracle sources:', status);
```

### CPMM Engine Setup

```typescript
// Provide pool data
const poolProvider = {
    getAllVaultData: async () => {
        // Return pool/vault data from your DEX
        return vaultData;
    }
};

const cpmmEngine = new CpmmEngine(poolProvider);
await cpmmEngine.buildGraph();

// Get graph statistics
const stats = cpmmEngine.getStats();
console.log(`CPMM graph: ${stats.totalTokens} tokens, ${stats.totalPools} pools`);
```

### Intrinsic Value Engine Setup

```typescript
// Configure all providers
const intrinsicEngine = new IntrinsicValueEngine();

// Oracle for BTC price (for sBTC and ratios)
intrinsicEngine.setOracleEngine(oracleEngine);

// Token metadata for subnet token detection
intrinsicEngine.setTokenMetadataProvider({
    getTokenMetadata: async (contractId) => {
        // Return metadata including type: 'SUBNET', base token, etc.
        return tokenMetadata;
    }
});

// LP provider for liquidity pool intrinsic values
intrinsicEngine.setLpProvider({
    getAllVaultData: async () => vaultData,
    getRemoveLiquidityQuote: async (contractId, amount) => {
        // Return remove liquidity simulation
        return { success: true, quote: { dx: amount1, dy: amount2 } };
    }
});

// Price provider for underlying asset prices
intrinsicEngine.setPriceProvider({
    getPrice: async (contractId) => {
        // Return USD price for any token
        return { usdPrice: price };
    }
});
```

## 📋 API Reference

### PriceServiceOrchestrator

#### `calculateTokenPrice(tokenId, options?)`
Calculate price for a single token.

**Parameters:**
- `tokenId: string` - Contract ID of the token
- `options?: object`
  - `preferredSources?: PriceSource[]` - Engine preference order
  - `includeArbitrageAnalysis?: boolean` - Enable arbitrage detection
  - `useCache?: boolean` - Use cached results (default: true)
  - `maxAge?: number` - Maximum cache age in milliseconds

**Returns:** `Promise<PriceCalculationResult>`

#### `calculateMultipleTokenPrices(tokenIds, options?)`
Calculate prices for multiple tokens efficiently.

**Parameters:**
- `tokenIds: string[]` - Array of contract IDs
- `options?: object`
  - `includeArbitrageAnalysis?: boolean`
  - `useCache?: boolean`
  - `batchSize?: number` - Batch size for processing (default: 10)

**Returns:** `Promise<BulkPriceResult>`

### Result Types

#### `TokenPriceData`
```typescript
interface TokenPriceData {
    tokenId: string;
    symbol: string;
    usdPrice: number;
    sbtcRatio: number;
    lastUpdated: number;
    source: 'oracle' | 'market' | 'intrinsic' | 'hybrid';
    reliability: number; // 0-1 scale
    
    // Engine-specific data
    oracleData?: OraclePriceData;
    marketData?: MarketPriceData;
    intrinsicData?: IntrinsicPriceData;
    
    // Arbitrage analysis (when available)
    arbitrageOpportunity?: {
        marketPrice?: number;
        intrinsicValue?: number;
        deviation: number;
        profitable: boolean;
    };
}
```

## 🔄 Asset Type Detection

The system automatically detects asset types and routes to appropriate engines:

### Stablecoins
- **Detection**: Symbol matching (USDC, USDT, DAI, etc.)
- **Engine**: Intrinsic Value Engine
- **Price**: Fixed $1.00
- **Use Case**: Arbitrage baseline, stable value reference

### sBTC
- **Detection**: Contract ID matching
- **Engine**: Oracle Engine → Intrinsic Value Engine
- **Price**: BTC oracle price (redeemable for BTC)
- **Use Case**: Bitcoin price exposure on Stacks

### Subnet Tokens
- **Detection**: Metadata `type: 'SUBNET'` with `base` reference
- **Engine**: Intrinsic Value Engine
- **Price**: Inherits from mainnet base token
- **Use Case**: Layer 2 token representations

### LP Tokens
- **Detection**: Vault data `type: 'POOL'`
- **Engine**: Intrinsic Value Engine
- **Price**: Remove liquidity quote of underlying assets
- **Use Case**: Liquidity provider tokens

### Market Tokens
- **Detection**: Default for tokens with liquidity pools
- **Engine**: CPMM Engine
- **Price**: Market discovery through AMM pools
- **Use Case**: Regular tradable tokens

## 🎯 Use Cases

### 1. Portfolio Valuation
```typescript
// Value entire portfolio with arbitrage detection
const portfolioTokens = ['token1', 'token2', 'lp-token', 'subnet-token'];
const result = await priceService.calculateMultipleTokenPrices(portfolioTokens, {
    includeArbitrageAnalysis: true
});

let totalValue = 0;
let arbitrageOpportunities = 0;

result.prices.forEach((price, tokenId) => {
    totalValue += price.usdPrice * holdings[tokenId];
    if (price.arbitrageOpportunity?.profitable) {
        arbitrageOpportunities++;
    }
});

console.log(`Portfolio value: $${totalValue}`);
console.log(`Arbitrage opportunities: ${arbitrageOpportunities}`);
```

### 2. DEX Price Display
```typescript
// Get real-time price with market/intrinsic comparison
const priceData = await priceService.calculateTokenPrice(tokenId, {
    includeArbitrageAnalysis: true
});

if (priceData.success) {
    const price = priceData.price;
    
    // Display primary price
    console.log(`${price.symbol}: $${price.usdPrice} (${price.source})`);
    
    // Show arbitrage if available
    if (price.arbitrageOpportunity) {
        const arb = price.arbitrageOpportunity;
        const type = arb.marketPrice > arb.intrinsicValue ? 'overvalued' : 'undervalued';
        console.log(`Market ${type} by ${arb.deviation.toFixed(1)}%`);
    }
}
```

### 3. Arbitrage Bot
```typescript
// Scan for arbitrage opportunities
const tokens = await getAllTradableTokens();
const results = await priceService.calculateMultipleTokenPrices(tokens, {
    includeArbitrageAnalysis: true
});

const opportunities = [];
results.prices.forEach((price, tokenId) => {
    if (price.arbitrageOpportunity?.profitable) {
        const arb = price.arbitrageOpportunity;
        if (arb.deviation > 5) { // >5% deviation
            opportunities.push({
                tokenId,
                symbol: price.symbol,
                marketPrice: arb.marketPrice,
                intrinsicValue: arb.intrinsicValue,
                profit: arb.deviation
            });
        }
    }
});

// Sort by profit potential
opportunities.sort((a, b) => b.profit - a.profit);
```

## 🔍 Health Monitoring

```typescript
// Check engine health
const health = priceService.getEngineHealth();
health.forEach(engine => {
    console.log(`${engine.engine}: ${engine.status} (${engine.errorRate * 100}% error rate)`);
});

// Cache statistics
const cacheStats = priceService.getCacheStats();
console.log(`Cache: ${cacheStats.size} entries`);
```

## 🐛 Troubleshooting

### Common Issues

#### 1. "All engines failed for token"
- **Cause**: Token not found in any engine's scope
- **Solution**: Check if token has liquidity pools, is a known intrinsic asset, or oracle coverage

#### 2. LP Token pricing fails
- **Cause**: Missing LP provider or remove liquidity quote fails
- **Solution**: Ensure LP provider is configured and vault contract supports remove liquidity simulation

#### 3. Subnet token not recognized
- **Cause**: Missing token metadata provider or incorrect metadata format
- **Solution**: Verify metadata provider returns `type: 'SUBNET'` with `base` reference

#### 4. Oracle price unavailable
- **Cause**: External API failures or network issues
- **Solution**: Check Oracle Engine circuit breaker status and external API health

### Debug Information

Enable detailed logging:
```typescript
const result = await priceService.calculateTokenPrice(tokenId);
console.log('Debug info:', result.debugInfo);
// Shows: calculation time, engines used, paths found, etc.
```

## 🔄 Migration from Old System

### Key Changes
1. **Confidence → Reliability**: Replaced confidence scoring with reliability (0-1 scale)
2. **Separated Engines**: Oracle, market, and intrinsic pricing are now distinct
3. **Arbitrage Analysis**: Built-in market vs intrinsic value comparison
4. **Source Attribution**: All prices include which engine provided them

### Migration Steps
1. Update imports to use `@services/prices`
2. Replace `PriceCalculator` with `PriceServiceOrchestrator`
3. Set up the three engines with appropriate providers
4. Update code to handle new `TokenPriceData` structure
5. Replace `confidence` references with `reliability`
6. Utilize new `arbitrageOpportunity` data for enhanced analysis

### Backward Compatibility
Legacy adapters are available for gradual migration:
```typescript
import { LegacyPriceService } from '@services/prices';

// Drop-in replacement for old PriceService
const priceService = new LegacyPriceService();
```

The new system maintains similar interfaces:
- `calculateTokenPrice()` returns similar structure
- USD prices and sBTC ratios remain available
- Caching behavior is preserved
- Error handling patterns are consistent

## 📈 Performance Considerations

### Caching Strategy
- **Individual tokens**: 5-minute default cache
- **Bulk operations**: Intelligent batching
- **Engine results**: Per-engine cache duration
- **Oracle data**: Longer cache for stable external feeds

### Optimization Tips
1. Use bulk operations for multiple tokens
2. Enable caching for repeated queries
3. Configure appropriate batch sizes
4. Monitor engine health for performance issues
5. Use specific engine preferences when asset type is known

## 🔒 Security Considerations

- **Oracle Security**: Multiple sources with circuit breakers
- **Input Validation**: All contract IDs and parameters are validated
- **Error Handling**: No sensitive data exposed in error messages
- **Rate Limiting**: Built-in protection against API abuse
- **Dependency Injection**: Clean separation of external dependencies

---

## 🛠️ Price Scheduler Integration

The price service is used by the **Price Scheduler** app for automated price updates:

```typescript
// apps/price-scheduler - Vercel cron job every 5 minutes
import { PriceServiceOrchestrator, PriceSeriesStorage } from '@services/prices';
import { getHostUrl } from '@modules/discovery';

const result = await orchestrator.calculateMultipleTokenPrices(tokens, {
    includeArbitrageAnalysis: true,
    batchSize: 10
});

// Store results in Vercel Blob for public consumption
await storage.storePriceSnapshot({
    timestamp: Date.now(),
    prices: result.prices,
    metadata: { engineStats: result.debugInfo?.engineStats }
});
```

**Price Series APIs:**
- GET `/api/prices` - Latest prices for all tokens
- GET `/api/prices/[tokenId]` - Specific token price history
- GET `/api/prices/snapshots` - Historical snapshots

## 📚 Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Oracle Engine Implementation](./src/engines/oracle-engine.ts)
- [CPMM Engine Implementation](./src/engines/cpmm-engine.ts)  
- [Intrinsic Value Engine Implementation](./src/engines/intrinsic-value-engine.ts)
- [Orchestrator Implementation](./src/orchestrator/price-service-orchestrator.ts)
- [Type Definitions](./src/shared/types.ts)
- [Legacy Adapters](./src/adapters/)
- [Price Series Storage](./src/price-series/)
- [Test Scripts](./scripts/)

For questions or issues, please refer to the troubleshooting section or check the engine health monitoring for system status.
