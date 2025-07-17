# Price Service Architecture

## 🏗️ Directory Structure

```
src/
├── engines/                     # Three-Engine Core
│   ├── oracle-engine.ts         # External market feeds (BTC from exchanges, stablecoins)
│   ├── cpmm-engine.ts           # AMM pool price discovery
│   ├── virtual-engine.ts        # Virtual asset pricing (subnet, LP tokens)
│   ├── lp-token-calculator.ts   # LP token virtual value support
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
- **Oracle Engine**: External market price feeds (BTC via Kraken/CoinGecko, stablecoins at $1)
- **CPMM Engine**: Pure AMM price discovery through liquidity pools  
- **Virtual Engine**: Virtual asset pricing calculated from existing data (subnet tokens, LP tokens)

### 2. **Orchestrator Layer** (`/orchestrator/`)
- **Price Service Orchestrator**: Intelligent engine coordination, arbitrage analysis

### 3. **Price Series Layer** (`/price-series/`)
- **Storage**: Hybrid Vercel KV + Blob integration (KV for latest, Blob for historical)
- **API**: Public endpoints for efficient consumption
- **Scheduler**: Multi-frequency background job system

### 4. **Shared Layer** (`/shared/`)
- **Types**: Common interfaces and type definitions
- **Utils**: Decimal conversion and shared utilities

### 5. **Adapters Layer** (`/adapters/`)
- **Backward Compatibility**: Clean adapters wrapping new architecture for legacy code

## 🔄 Data Flow

```
Multi-Frequency Schedulers → Three Engines → Orchestrator → KV/Blob Storage → Public APIs
```

1. **Oracle Updates** (30s): BTC, ETH, sBTC (1:1), stablecoins ($1) from external sources
2. **Market Updates** (5min): AMM pool price discovery  
3. **Virtual Updates** (post-processing): subnet, LP token calculations
4. **Storage**: Latest prices in KV (ultra-fast), historical snapshots in Blob (1-year cache)
5. **Public Access**: KV-first lookups with Blob fallback

## 📚 Import Guide

### New Three-Engine Architecture
```typescript
// Main orchestrator
import { PriceServiceOrchestrator } from '@services/prices';

// Individual engines
import { OracleEngine, CpmmEngine, VirtualEngine } from '@services/prices';

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
- **Three-Engine Architecture**: Oracle, CPMM, and Virtual engines
- **Price Service Orchestrator**: Intelligent coordination and arbitrage analysis
- **Price Series Storage**: Hybrid Vercel KV + Blob integration
- **Price Scheduler App**: Multi-frequency background price updates
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
KV_URL=redis://...
KV_REST_API_URL=https://...
KV_REST_API_TOKEN=...
KV_REST_API_READ_ONLY_TOKEN=...
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
- **Arbitrage Analysis**: Built-in market vs virtual comparison
- **Backward Compatibility**: Zero-disruption migration
- **Service Discovery**: Dynamic URL resolution across environments
- **Monitoring**: Built-in health checks and dashboard
- **Scalability**: Efficient bulk processing and caching