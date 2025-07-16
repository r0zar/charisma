# Profitability System Implementation

## Overview
This implements a real-time trade profitability tracking system that calculates actual P&L based on entry prices and current market prices.

## Architecture

### tx-monitor (Backend)
- **`profitability-types.ts`**: Core type definitions for profitability data
- **`profitability-service.ts`**: Core calculation logic and price fetching
- **`/api/v1/activities/[id]/profitability`**: Single activity profitability endpoint
- **`/api/v1/activities/profitability/bulk`**: Bulk profitability endpoint

### simple-swap (Frontend)
- **`profitability-api.ts`**: API client for fetching data from tx-monitor
- **`ActivityCard.tsx`**: Updated to use real profitability data with loading states
- **Environment**: `NEXT_PUBLIC_TX_MONITOR_URL` configures the backend URL

## Key Features

### Real-time P&L Calculation
- Uses entry prices captured at trade execution time via `priceSnapshot` data
- Calculates current position value using live price feeds
- Shows percentage and USD value changes

### Historical Performance Tracking
- Generates chart data from historical price movements
- Tracks best/worst performance periods
- Calculates average returns over trade duration

### Token Breakdown Analysis
- Individual token price change contributions
- Net effect calculation combining both tokens
- Market movement attribution

### Fallback System
- Gracefully falls back to mock data in development
- Handles API failures with appropriate error states
- Loading states during data fetching

## Data Flow

1. **Trade Execution**: Price snapshots captured in `TokenInfo.priceSnapshot`
2. **P&L Request**: Frontend requests profitability via `/api/v1/activities/{id}/profitability`
3. **Calculation**: Backend fetches current prices and calculates metrics
4. **Historical Data**: System generates chart data from price history
5. **Display**: Frontend shows real-time P&L with loading states

## Performance Considerations

- **Caching**: API responses cached for 1-5 minutes based on data type
- **Bulk Operations**: Support for fetching multiple activities efficiently
- **Lazy Loading**: P&L data only loaded for visible/expanded activity cards
- **Concurrent Limits**: Bulk endpoint processes max 50 activities per request

## Mock Data Integration

During development and for activities without price snapshots:
- Falls back to mock data via `getMockProfitabilityData()`
- Provides realistic scenarios for UI testing
- Seamless transition between mock and real data

## Environment Configuration

```bash
# simple-swap/.env.local
NEXT_PUBLIC_TX_MONITOR_URL='http://localhost:3012'
```

## API Endpoints

### Single Activity
```
GET /api/v1/activities/{id}/profitability?timeRange=7D
```

### Bulk Activities  
```
POST /api/v1/activities/profitability/bulk
{
  "activityIds": ["id1", "id2"],
  "includeChartData": true
}
```

## Future Enhancements

1. **Real Price APIs**: Replace mock price fetching with CoinGecko/CMC
2. **Portfolio Tracking**: Aggregate P&L across multiple trades
3. **Advanced Metrics**: Sharpe ratio, max drawdown, volatility
4. **Real-time Updates**: WebSocket integration for live P&L updates
5. **Position Linking**: Connect related trades for complete P&L tracking