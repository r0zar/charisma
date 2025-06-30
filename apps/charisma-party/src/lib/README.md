# Token Metadata Library

This library provides comprehensive token metadata aggregation for the charisma-party realtime balance system.

## Overview

The token metadata library solves the critical issue of missing LP tokens in the realtime system by aggregating token data from multiple sources and providing a unified, comprehensive token registry.

## Features

### 🔍 **Multi-Source Data Aggregation**
- **Dex-Cache API** (invest.charisma.rocks) - Primary LP token source
- **Simple-Swap API** (swap.charisma.rocks) - Alternative token source  
- **Token-Cache Service** (tokens.charisma.rocks) - Base metadata
- **Local/Environment APIs** - Development sources
- **@repo/tokens Package** - Fallback metadata
- **Hardcoded Critical Tokens** - Essential tokens guarantee

### 🎯 **Priority-Based Merging**
- Higher priority sources override lower priority data
- Intelligent field merging preserves the best available data
- Automatic gap filling from multiple sources

### 🏗️ **Automatic Subnet Token Generation**
- Creates synthetic subnet token records from mainnet tokens
- Handles known subnet mappings automatically
- Proxies pricing data from base tokens

### 📊 **Comprehensive Token Coverage**
- All SIP10 tokens
- All LP tokens from dex-cache
- All subnet tokens
- Price and market data when available
- Verified token status

## Usage

### Basic Usage

```typescript
import { loadAllTokenMetadata, getTokenStats, getLPTokens } from './token-metadata';

// Load all token metadata from all sources
const allTokens = await loadAllTokenMetadata();

// Get statistics
const stats = getTokenStats(allTokens);
console.log(`Loaded ${stats.total} tokens (${stats.lp} LP tokens)`);

// Get all LP tokens
const lpTokens = getLPTokens(allTokens);
console.log(`Found ${lpTokens.length} LP tokens`);
```

### Integration with Balance System

The library is automatically integrated into the balance system through `balances-lib.ts`:

```typescript
// In loadTokenMetadata()
const allTokenMetadata = await loadAllTokenMetadata();
// Converts to EnhancedTokenRecord format for balance tracking
```

## Data Sources

### Priority Levels

1. **Priority 100**: Dex-Cache with pricing (`invest.charisma.rocks/api/v1/tokens/all?includePricing=true`)
2. **Priority 90**: Dex-Cache without pricing (`invest.charisma.rocks/api/v1/tokens/all`)
3. **Priority 80**: Simple-Swap API (`swap.charisma.rocks/api/token-summaries`)
4. **Priority 70**: Local Development API (if configured)
5. **Priority 60**: Token-Cache Service (`tokens.charisma.rocks`)

### Source Configuration

Sources can be enabled/disabled and configured via the `TOKEN_SOURCES` array:

```typescript
const TOKEN_SOURCES: TokenSource[] = [
  {
    name: 'dex-cache-primary',
    url: 'https://invest.charisma.rocks/api/v1/tokens/all?includePricing=true',
    priority: 100,
    timeout: 10000,
    enabled: true
  },
  // ... more sources
];
```

## Token Types

### EnhancedTokenMetadata Interface

```typescript
interface EnhancedTokenMetadata {
  // Core fields
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  type?: 'SIP10' | 'SUBNET' | 'LP';
  
  // Pricing data
  price?: number;
  usdPrice?: number;
  change1h?: number;
  change24h?: number;
  change7d?: number;
  marketCap?: number;
  
  // LP token fields
  tokenAContract?: string;
  tokenBContract?: string;
  lpRebatePercent?: number;
  reserves?: { tokenA: string; tokenB: string; };
  
  // Subnet fields
  base?: string;
  subnetContractId?: string;
  
  // Metadata
  source?: string;
  lastUpdated?: number;
  verified?: boolean;
}
```

## Critical Tokens

Essential tokens are hardcoded to ensure they're always available:

- **STX** - Native Stacks token
- **CHA** - Charisma token
- Additional critical tokens can be added to `CRITICAL_TOKENS` map

## Subnet Token Handling

### Known Subnet Mappings

```typescript
const SUBNET_MAPPINGS = new Map([
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1', 
   'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  // ... more mappings
]);
```

### Synthetic Generation

The library automatically creates subnet token records based on their mainnet counterparts:

- Copies metadata from base token
- Sets `type: 'SUBNET'`
- Maintains price parity with base token
- Establishes `base` field mapping

## Error Handling

### Robust Fallback System

1. **Source Timeouts**: Each source has configurable timeout
2. **Fetch Failures**: Failed sources are logged but don't block others
3. **Partial Data**: Successful sources are used even if others fail
4. **Empty Results**: Returns empty map rather than crashing

### Logging

Comprehensive logging throughout the process:

```
🚀 Starting comprehensive token metadata loading...
🔍 Fetching tokens from dex-cache-primary: https://invest.charisma.rocks/...
✅ Fetched 79 tokens from dex-cache-primary
📊 Source summary:
  dex-cache-primary: 79 total (30 regular, 49 LP)
✅ Token metadata loading complete in 1250ms:
   Total tokens: 128
   Regular tokens: 45
   LP tokens: 49
   Subnet tokens: 34
```

## Performance

### Parallel Fetching
- All sources fetched concurrently using `Promise.allSettled()`
- Individual source failures don't block others
- Configurable timeouts prevent hanging

### Caching Strategy
- Token metadata loaded once at startup
- Can be refreshed on demand
- Results cached in memory for balance system

## Benefits

### Before (Single Source Issues)
- Missing 48 out of 49 LP tokens
- Single point of failure
- Limited metadata coverage
- Manual subnet token management

### After (Multi-Source Aggregation)
- Complete LP token coverage from dex-cache
- Redundant data sources
- Rich metadata from multiple APIs
- Automatic subnet token generation
- Intelligent data merging

## Monitoring

The library provides comprehensive statistics:

```typescript
const stats = getTokenStats(allTokens);
// Returns: { total, regular, lp, subnet, sources, verified, withPricing }
```

Use these stats to monitor:
- Token coverage completeness
- Source availability
- Data quality (verified tokens, pricing coverage)

## Environment Variables

### TOKEN_SUMMARIES_URL
If set, adds a custom token source to the aggregation pipeline.

### NODE_ENV
Controls whether development sources are enabled.

## Future Enhancements

1. **Dynamic Source Discovery**: Auto-detect available token APIs
2. **Data Freshness Tracking**: Monitor when each source was last updated
3. **Source Health Monitoring**: Track source reliability over time
4. **Custom Source Plugins**: Allow easy addition of new token sources
5. **Metadata Validation**: Ensure data consistency across sources

## Troubleshooting

### Missing LP Tokens
1. Check if dex-cache API is accessible
2. Verify LP tokens have correct metadata in dex-cache
3. Check source priority configuration
4. Review logs for fetch errors

### Subnet Token Issues
1. Verify base token exists in metadata
2. Check SUBNET_MAPPINGS configuration
3. Ensure subnet token creation is enabled

### Performance Issues
1. Adjust source timeouts
2. Disable slow or unreliable sources
3. Monitor fetch times in logs
4. Consider caching strategies