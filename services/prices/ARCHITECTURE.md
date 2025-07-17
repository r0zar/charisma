# Price Service Architecture

## 🏗️ Directory Structure

```
src/
├── engines/                     # Three-Engine Core
│   ├── oracle-engine.ts         # External market feeds (BTC from exchanges)
│   ├── cpmm-engine.ts           # AMM pool price discovery
│   ├── intrinsic-value-engine.ts # Redeemable asset pricing
│   ├── lp-token-calculator.ts   # LP token intrinsic value support
│   ├── lp-dependency-graph.ts   # LP dependency resolution
│   └── lp-processing-queue.ts   # LP batch processing
│
├── orchestrator/                # Coordination Layer
│   └── price-service-orchestrator.ts # Engine coordination & arbitrage
│
├── price-series/               # Public API Layer  
│   ├── price-series-storage.ts # Vercel Blob storage
│   ├── price-series-api.ts     # Public endpoints
│   └── price-update-scheduler.ts # Background jobs
│
├── shared/                     # Common Utilities
│   ├── types.ts                # Type definitions
│   └── decimal-utils.ts        # Token decimal helpers
│
├── adapters/                   # Backward Compatibility
│   ├── legacy-price-service.ts # Adapter wrapping new architecture
│   └── index.ts                # Legacy exports
│
└── index.ts                    # Main exports
```

## 🎯 Architecture Layers

### 1. **Engines Layer** (`/engines/`)
- **Oracle Engine**: External market price feeds (BTC via Kraken/CoinGecko)
- **CPMM Engine**: Pure AMM price discovery through liquidity pools  
- **Intrinsic Engine**: Redeemable asset valuation (stablecoins, sBTC, subnet tokens, LP tokens)

### 2. **Orchestrator Layer** (`/orchestrator/`)
- **Price Service Orchestrator**: Intelligent engine coordination, arbitrage analysis

### 3. **Price Series Layer** (`/price-series/`)
- **Storage**: Vercel Blob integration with global CDN
- **API**: Public endpoints for efficient consumption
- **Scheduler**: Background job system

### 4. **Shared Layer** (`/shared/`)
- **Types**: Common interfaces and type definitions
- **Utils**: Decimal conversion and shared utilities

### 5. **Adapters Layer** (`/adapters/`)
- **Backward Compatibility**: Clean adapters wrapping new architecture for legacy code

## 🔄 Data Flow

```
Background Scheduler → Three Engines → Orchestrator → Vercel Blob → CDN → Public APIs
```

1. **Scheduled Updates** (every 5 minutes): Background job calculates fresh prices
2. **Engine Coordination**: Orchestrator intelligently selects appropriate engines
3. **Storage**: Results stored in Vercel Blob with structured paths
4. **Distribution**: Global CDN serves cached data instantly
5. **Public Access**: Lightning-fast APIs for end-user consumption

## 📚 Import Guide

### New Three-Engine Architecture
```typescript
// Main orchestrator
import { PriceServiceOrchestrator } from '@services/prices';

// Individual engines
import { OracleEngine, CpmmEngine, IntrinsicValueEngine } from '@services/prices';

// Public API layer
import { PriceSeriesAPI, PriceSeriesStorage } from '@services/prices';
```

### Legacy (Backward Compatibility)
```typescript
// Adapter service (drop-in replacement)
import { LegacyPriceService, PriceService } from '@services/prices';
```

## 🚀 Migration Path

1. **Phase 1**: Three-engine architecture implemented ✅
2. **Phase 2**: Price series integration complete ✅  
3. **Phase 3**: Price scheduler app created and tested ✅
4. **Phase 4**: Apps migrate to new APIs (in progress)
5. **Phase 5**: Legacy adapter cleanup (when all apps migrated)

## 🛠️ Current Implementation Status

### ✅ Completed
- **Three-Engine Architecture**: Oracle, CPMM, and Intrinsic Value engines
- **Price Service Orchestrator**: Intelligent coordination and arbitrage analysis
- **Price Series Storage**: Vercel Blob integration with CDN
- **Price Scheduler App**: Automated background price updates
- **Legacy Adapters**: Backward compatibility for existing code
- **Service Discovery Integration**: Uses `@modules/discovery` for service URLs
- **Build System**: Clean package exports and dependency management

### 🔧 Ready for Deployment
- **Scheduler App** (`apps/price-scheduler`): Ready for Vercel deployment
- **Cron Jobs**: 5-minute intervals configured
- **Monitoring Dashboard**: Available at scheduler app root
- **Manual Triggers**: Available for testing via `/api/trigger`

### 📋 Deployment Requirements
```bash
# Environment Variables (Vercel)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
CRON_SECRET=your-cron-secret
NODE_ENV=production

# Vercel cron configuration (vercel.json)
{
  "crons": [{
    "path": "/api/cron",
    "schedule": "*/5 * * * *"
  }]
}
```

### 📊 Test Results
The system has been tested and is functional:
- ✅ Import resolution working (`@services/prices`)
- ✅ Service discovery working (`@modules/discovery`)
- ✅ Three-engine orchestrator initializes properly
- ✅ Price calculation pipeline functional
- ⚠️ Requires live data sources for actual price calculation
- ⚠️ Needs BLOB_READ_WRITE_TOKEN for storage functionality

## 💡 Key Benefits

- **Separation of Concerns**: Clean engine boundaries
- **Cost Efficiency**: Scheduled calculations vs on-demand
- **Performance**: Global CDN + intelligent caching
- **Arbitrage Analysis**: Built-in market vs intrinsic comparison
- **Backward Compatibility**: Zero-disruption migration
- **Service Discovery**: Dynamic URL resolution across environments
- **Monitoring**: Built-in health checks and dashboard
- **Scalability**: Efficient bulk processing and caching