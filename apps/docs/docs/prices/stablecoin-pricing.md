---
sidebar_position: 5
title: Stablecoin Pricing Strategy
---

# Stablecoin Pricing Strategy

The Charisma Pricing System employs a specialized approach for pricing stablecoins that prioritizes trading utility and user experience over mathematical precision. This document explains our $1.00 fixed pricing strategy and its rationale.

## Overview

Rather than calculating stablecoin prices through complex trading paths, our system assumes **all stablecoins are worth exactly $1.00**. This approach provides several advantages for traders and applications while maintaining consistency with our constant product pool architecture.

## Why Fixed $1.00 Pricing?

### 1. Trading Perspective Optimization

From a trader's perspective, stablecoins should fluctuate around $1.00 with some trading slightly above and others slightly below at various times:

```typescript
// Fixed pricing for all stablecoins
if (tokenNode && isStablecoin(tokenNode.symbol)) {
  return {
    usdPrice: 1.0,                    // Always $1.00
    sbtcRatio: 1.0 / btcPrice.price,  // Convert to sBTC ratio
    confidence: 1.0,                   // High confidence
    lastUpdated: Date.now(),
    calculationDetails: {
      method: 'stablecoin_override',
      btcPrice: btcPrice.price
    }
  };
}
```

**Benefits:**
- **Consistent Reference Point**: Traders can easily compare values knowing stablecoins = $1
- **Arbitrage Clarity**: Clear arbitrage opportunities when market prices deviate from $1
- **UI Simplicity**: No confusion from fluctuating "stable" prices
- **Trading Strategy**: Enables straightforward stable-to-stable comparisons

### 2. Constant Product Pool Compatibility

Charisma pools currently use **constant product formula** (x × y = k), which can create price anomalies for assets that should maintain parity:

```typescript
// Constant product pricing formula
const exchangeRate = (reserveB / reserveA) * (decimalsA / decimalsB);

// Problem: This can show USDC = $1.02, USDT = $0.98 
// Solution: Override both to $1.00 for consistency
```

**Technical Reasons:**
- **Pool Mechanics**: Constant product pools naturally create price deviations from exact parity
- **Liquidity Effects**: Lower liquidity pools can show larger price deviations
- **Trading Noise**: Small trades can temporarily skew calculated prices
- **Future Flexibility**: When we support constant sum pools, this approach remains valid

### 3. User Experience Benefits

Fixed stablecoin pricing provides superior UX across trading interfaces:

```typescript
// Clear trading signals
const signals = {
  'USDC Market Price': '$1.02',  // 2% premium - sell opportunity
  'USDT Market Price': '$0.98',  // 2% discount - buy opportunity  
  'Reference Price': '$1.00',    // Always consistent
  'Arbitrage Signal': 'USDT → USDC (+4%)'
};
```

## Stablecoin Detection

### Automatic Detection Logic

The system automatically identifies stablecoins using symbol pattern matching:

```typescript
export function isStablecoin(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  
  // Explicit exclusions for yield-bearing tokens that contain USD
  if (upperSymbol === 'SUSDH') return false;
  
  // Core stablecoin symbols
  const STABLECOIN_SYMBOLS = [
    'USDC', 'USDT', 'DAI', 'FRAX', 'TUSD', 'BUSD',
    'LUSD', 'SUSD', 'GUSD', 'HUSD', 'DUSD', 'OUSD', 'USD'
  ];
  
  // Pattern matching for USD-denominated tokens
  return STABLECOIN_SYMBOLS.some(stableSymbol => 
    upperSymbol === stableSymbol || 
    upperSymbol.includes('USD') || 
    upperSymbol.includes('DAI')
  );
}
```

### Exclusions and Special Cases

Some tokens are deliberately excluded from stablecoin treatment:

```typescript
// sUSDh is yield-bearing, should trade through normal paths
// This allows it to reflect actual market premiums/discounts
if (upperSymbol === 'SUSDH') {
  return false; // Use normal price discovery
}

// Future consideration: Other yield-bearing stables
// - stETH, rETH (if bridged to Stacks)
// - Compound cTokens (cDAI, cUSDC)
// - Aave aTokens (aUSDC, aDAI)
```

## Implementation Details

### Price Calculation Override

Stablecoins bypass the entire path discovery algorithm:

```typescript
async calculateTokenPrice(tokenId: string): Promise<PriceCalculationResult> {
  // Get token info to check if it's a stablecoin
  const graph = await getPriceGraph();
  const tokenNode = graph.getNode(tokenId);
  
  // Handle stablecoins as $1 (useful for arbitrage analysis)
  if (tokenNode && isStablecoin(tokenNode.symbol)) {
    const btcPrice = await getBtcPrice();
    if (!btcPrice) {
      return { success: false, error: 'Failed to get BTC price for stablecoin calculation' };
    }

    const stablecoinPrice: TokenPriceData = {
      tokenId,
      symbol: tokenNode.symbol,
      usdPrice: 1.0,                    // Fixed $1 for arbitrage perspective
      sbtcRatio: 1.0 / btcPrice.price,  // Convert to sBTC ratio
      confidence: 1.0,                   // High confidence for stablecoin assumption
      lastUpdated: Date.now(),
      calculationDetails: {
        method: 'stablecoin_override',
        btcPrice: btcPrice.price,
        pathsUsed: 0,
        totalLiquidity: 0,
        priceVariation: 0
      }
    };

    console.log(`[PriceCalculator] Stablecoin ${tokenNode.symbol} priced at $1.00`);
    return { success: true, price: stablecoinPrice };
  }
  
  // Continue with normal price discovery for other tokens...
}
```

### API Response Format

Stablecoins return the same data structure as other tokens:

```json
{
  "tokenId": "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-wusdc",
  "symbol": "USDC",
  "name": "USD Coin",
  "decimals": 6,
  "usdPrice": 1.0,
  "sbtcRatio": 0.0000101,
  "confidence": 1.0,
  "lastUpdated": 1703123456789,
  "calculationDetails": {
    "method": "stablecoin_override",
    "btcPrice": 99000,
    "pathsUsed": 0,
    "totalLiquidity": 0,
    "priceVariation": 0
  }
}
```

## Trading Strategy Implications

### Arbitrage Opportunities

Fixed $1.00 pricing makes arbitrage signals clear and actionable:

```typescript
interface ArbitrageSignal {
  token: string;
  marketPrice: number;    // From constant product pools
  referencePrice: 1.0;    // Always $1.00
  deviation: number;      // Percentage difference
  action: 'buy' | 'sell' | 'hold';
}

// Example arbitrage detection
function detectStablecoinArbitrage(poolPrice: number): ArbitrageSignal {
  const deviation = ((poolPrice - 1.0) / 1.0) * 100;
  
  return {
    marketPrice: poolPrice,
    referencePrice: 1.0,
    deviation,
    action: deviation > 2 ? 'sell' : deviation < -2 ? 'buy' : 'hold'
  };
}
```

### Portfolio Valuation

Fixed pricing provides consistent portfolio calculations:

```typescript
// Portfolio value calculation with mixed assets
const portfolio = [
  { symbol: 'CHA', amount: 1000, price: 0.45 },    // Market-determined
  { symbol: 'USDC', amount: 500, price: 1.0 },     // Fixed stablecoin
  { symbol: 'sBTC', amount: 0.1, price: 99000 },   // Market-determined
  { symbol: 'USDT', amount: 200, price: 1.0 }      // Fixed stablecoin
];

const totalValue = portfolio.reduce((sum, asset) => 
  sum + (asset.amount * asset.price), 0
);
// = 450 + 500 + 9900 + 200 = $11,050
```

## Pool Type Compatibility

### Current: Constant Product Pools

Our current constant product implementation can show natural price deviations:

```typescript
// Constant product: x * y = k
const price = reserveB / reserveA;

// Real example: USDC/USDT pool
// reserveUSDC: 10,000, reserveUSDT: 9,800
// implied price: 9,800 / 10,000 = 0.98 USDT per USDC
// Our system: Both priced at $1.00
```

**Why This Works:**
- Traders still see pool-specific exchange rates for actual trading
- Price feeds show consistent $1.00 for valuation and comparison
- Arbitrage opportunities remain clear and actionable

### Future: Constant Sum Pools

When we implement constant sum pools for stablecoins:

```typescript
// Constant sum: x + y = k (perfect for stablecoins)
const price = 1.0; // Always 1:1 exchange

// Our $1.00 pricing will remain consistent
// Pool mechanics will enforce the parity we assume
```

**Benefits:**
- Our pricing assumption becomes mathematically enforced
- No conflict between calculated and reference prices
- Seamless transition for existing applications

## Configuration and Management

### Adding New Stablecoins

To add a new stablecoin to the system:

```typescript
// 1. Update the stablecoin symbols list
const STABLECOIN_SYMBOLS = [
  'USDC', 'USDT', 'DAI', 'FRAX', 'TUSD', 'BUSD',
  'LUSD', 'SUSD', 'GUSD', 'HUSD', 'DUSD', 'OUSD',
  'NEWSTABLE' // Add new stablecoin here
];

// 2. Verify detection works
console.log(isStablecoin('NEWSTABLE')); // Should return true

// 3. Test price calculation
const price = await getTokenPrice('SP123...new-stable-token');
console.log(price.usdPrice); // Should be 1.0
```

### Excluding Yield-Bearing Tokens

For tokens that should use market pricing despite USD denomination:

```typescript
export function isStablecoin(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  
  // Explicit exclusions for yield-bearing tokens
  const YIELD_BEARING_EXCLUSIONS = ['SUSDH', 'STETH', 'RETH'];
  
  if (YIELD_BEARING_EXCLUSIONS.includes(upperSymbol)) {
    return false;
  }
  
  return STABLECOIN_SYMBOLS.some(stableSymbol => 
    upperSymbol === stableSymbol || 
    upperSymbol.includes('USD') || 
    upperSymbol.includes('DAI')
  );
}
```

## Monitoring and Validation

### Health Checks

Monitor stablecoin pricing behavior:

```typescript
interface StablecoinHealthCheck {
  symbol: string;
  ourPrice: 1.0;
  marketPrices: {
    poolPrice?: number;    // From our pools
    externalPrice?: number; // From external oracles
  };
  deviation: number;
  alert: boolean;
}

// Alert if market prices deviate significantly
function checkStablecoinHealth(symbol: string): StablecoinHealthCheck {
  const ourPrice = 1.0;
  const marketPrice = getPoolPrice(symbol);
  const deviation = Math.abs((marketPrice - ourPrice) / ourPrice) * 100;
  
  return {
    symbol,
    ourPrice,
    marketPrices: { poolPrice: marketPrice },
    deviation,
    alert: deviation > 5 // Alert if >5% deviation
  };
}
```

### Logging and Analytics

Track stablecoin price requests and deviations:

```typescript
// Log stablecoin pricing events
console.log(`[PriceCalculator] Stablecoin ${tokenNode.symbol} priced at $1.00`);

// Analytics: Track how often stablecoins are priced
const stablecoinPricingMetrics = {
  totalRequests: 0,
  stablecoinRequests: 0,
  averageDeviation: 0,
  lastUpdated: Date.now()
};
```

## Best Practices

### 1. Consistent Application
Always use $1.00 pricing for stablecoins across all interfaces and calculations.

### 2. Clear Documentation
Document that stablecoin prices are fixed at $1.00 for trading optimization.

### 3. Arbitrage Visibility
Show both reference ($1.00) and market prices to highlight arbitrage opportunities.

### 4. Future Compatibility
Design with constant sum pools in mind for seamless future upgrades.

### 5. Exception Handling
Carefully consider which USD-denominated tokens should be excluded from fixed pricing.

This stablecoin pricing strategy provides optimal trading experience while maintaining technical consistency with our constant product pool architecture and preparing for future enhancements.