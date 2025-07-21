# Balance Service

A comprehensive balance tracking service with time series data support, built on Vercel Blob storage.

## Features

- **Real-time balance tracking** - Track token balances across mainnet and subnets
- **Time series data** - Historical balance data with configurable granularity
- **Cost-optimized storage** - Efficient Vercel Blob storage with smart caching
- **API-ready architecture** - Clean service interface ready for REST/GraphQL exposure
- **Built on contracts** - Uses `@modules/contracts` Token/Credit primitives

## Quick Start

```typescript
import { BalanceService, BalanceSeriesAPI } from '@services/balances';

const balanceService = new BalanceService();
const seriesAPI = new BalanceSeriesAPI();

// Get current balance
const balance = await balanceService.getBalance(address, tokenId);

// Get balance history for charts
const history = await balanceService.getBalanceHistory(address, tokenId, '30d');

// Bulk time series requests
const bulkData = await seriesAPI.getBalanceSeriesBulk({
  addresses: [address1, address2],
  tokenIds: [tokenId1, tokenId2],
  period: '30d',
  granularity: 'day'
});

// Bulk current balances
const bulkBalances = await seriesAPI.getCurrentBalancesBulk({
  addresses: [address1, address2],
  tokenIds: [tokenId1, tokenId2]
});
```

## Architecture

### Storage Layers

1. **Current Balances** (`BlobBalanceStore`)
   - Single blob per address with all token balances
   - Aggressive in-memory caching (5min TTL)
   - Optimized for frequent reads

2. **Time Series Data** (`BalanceTimeSeriesStore`)
   - Monthly blobs for historical points
   - Daily snapshots for portfolio tracking
   - Configurable granularity and retention

### Service Methods

#### Current Balances
- `getBalance(address, tokenId)` - Single token balance
- `getBalances(address, tokenIds?)` - Multiple token balances
- `getAllBalances(address)` - All non-zero balances
- `getBalancesBatch(requests)` - Batch balance requests

#### Time Series
- `getBalanceHistory(address, tokenId, period)` - Historical data for charts
- `getPortfolioHistory(address, period)` - Portfolio snapshots over time

#### Sync Operations
- `refreshBalance(address, tokenId)` - Sync single token from chain
- `refreshAddressBalances(address)` - Sync all tokens for address
- `syncOnDemand(address, tokenId?)` - Smart sync when stale

### Balance Series API

#### Bulk Operations
- `getBalanceSeriesBulk(request)` - Bulk time series for multiple addresses/tokens
- `getCurrentBalancesBulk(request)` - Bulk current balances with filtering
- `getPortfolioPerformanceBulk(addresses, period)` - Portfolio analytics

#### Data Management
- `generateAggregatedData(addresses, period)` - Pre-compute aggregated data
- `clearCache()` - Clear all cached data
- `getCacheStats()` - Get cache performance metrics

#### Background Scheduler
- `BalanceScheduler` - Automated balance syncing and data maintenance
- `DEFAULT_SCHEDULER_CONFIG` - Default configuration for background tasks

## Storage Costs

Optimized for Vercel Blob pricing:

**Estimated monthly costs (10k addresses, 100 tokens):**
- Storage: ~11GB = $0.14/month
- Operations: ~300K puts = $1.00/month
- **Total: ~$1.15/month**

## Configuration

```typescript
const config: BalanceServiceConfig = {
  cacheTimeouts: {
    current: 5 * 60 * 1000,      // 5 minutes
    timeSeries: 60 * 60 * 1000,  // 1 hour
    snapshots: 24 * 60 * 60 * 1000 // 24 hours
  },
  maxPointsPerMonth: 1000,
  blobCacheControl: 300,
  syncConcurrency: 10
};
```

## Integration

### Simple Swap Integration

Replace manual balance fetching:

```typescript
// Before
const balance = await callReadOnlyFunction(
  contractAddress,
  contractName,
  "get-balance",
  [principalCV(address)]
);

// After
const balance = await balanceService.getBalance(address, tokenId);
```

### Future API Endpoints

The service is designed to easily become REST endpoints:

```typescript
// GET /balances/{address}/{tokenId}
app.get('/balances/:address/:tokenId', async (req, res) => {
  const balance = await balanceService.getBalance(req.params.address, req.params.tokenId);
  res.json({ balance });
});

// GET /balances/{address}/history/{tokenId}
app.get('/balances/:address/history/:tokenId', async (req, res) => {
  const history = await balanceService.getBalanceHistory(
    req.params.address, 
    req.params.tokenId, 
    req.query.period
  );
  res.json({ history });
});

// POST /balances/bulk/current
app.post('/balances/bulk/current', async (req, res) => {
  const result = await seriesAPI.getCurrentBalancesBulk(req.body);
  res.json(result);
});

// POST /balances/bulk/series
app.post('/balances/bulk/series', async (req, res) => {
  const result = await seriesAPI.getBalanceSeriesBulk(req.body);
  res.json(result);
});

// POST /balances/bulk/portfolio
app.post('/balances/bulk/portfolio', async (req, res) => {
  const { addresses, period } = req.body;
  const result = await seriesAPI.getPortfolioPerformanceBulk(addresses, period);
  res.json(result);
});
```

## Development

```bash
# Build the service
pnpm build

# Run in development mode
pnpm dev

# Type checking
pnpm typecheck

# Run tests
pnpm test
```