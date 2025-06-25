# Energy Rate Analytics

The Energy Rate Analytics system provides comprehensive insights into energy generation rates across different tokens, helping understand how energy accumulation patterns change over time.

## Features

### 1. Energy Per Block Analysis
- **Energy per Block**: Raw energy generated per blockchain block for each token
- **Energy per Hour**: Projected hourly energy generation (assuming ~10 min block times)
- **Time Series Data**: Historical energy generation rates over configurable time periods (7d, 30d, 90d)

### 2. Token Comparison
- **Rate Rankings**: Tokens ranked by energy generation efficiency
- **Holder Analysis**: Average users per block and total unique holders
- **Trend Analysis**: Automatic detection of up/down/stable trends
- **Volatility Metrics**: Coefficient of variation to measure rate stability

### 3. Advanced Visualizations
- **Interactive Charts**: Custom-built charts showing energy rates over time
- **Moving Averages**: Smoothed trend lines to identify patterns
- **User Activity Overlay**: Show active users alongside energy generation
- **Statistical Distribution**: Quartile analysis and rate distribution

### 4. Key Metrics

#### Rate Calculations
```typescript
// Energy per block = Total energy in block / Number of blocks sampled
energyPerBlock = totalEnergyAllBlocks / totalBlocks

// Energy per hour (estimated)
energyPerHour = energyPerBlock * (60 minutes / avgBlockTime)

// Energy per user
energyPerUser = totalEnergyInPeriod / uniqueActiveUsers
```

#### Trend Detection
- **Up Trend**: Second half average > first half average + 10% threshold
- **Down Trend**: Second half average < first half average - 10% threshold  
- **Stable**: Changes within 10% threshold

#### Volatility Calculation
```typescript
volatility = (standardDeviation / averageRate) * 100
```

## API Endpoints

### `/api/v1/admin/energy-rate-analytics`
**Parameters:**
- `timeframe`: `7d` | `30d` | `90d` (default: 30d)

**Response:**
```typescript
{
  tokenRates: TokenEnergyRate[];      // Current rates for all tokens
  rateHistories: TokenRateHistory[];  // Historical data with trends
  energyTokenMetadata: TokenCacheData; // Energy token info for formatting
  timeframe: string;
  timestamp: number;
}
```

## Components

### EnergyRateAnalytics
Main dashboard component with three tabs:
- **Overview**: Summary stats and top performing tokens
- **Comparison**: Side-by-side token comparison table
- **Trends**: Detailed charts and statistical analysis

### EnergyRateChart  
Advanced chart component featuring:
- Interactive hover tooltips
- Moving average trend lines
- User activity overlay
- Statistical summary (min, max, quartiles)

## Data Processing

### Block-Based Aggregation
1. **Daily Grouping**: Logs grouped by day for smoother visualization
2. **Block Analysis**: Energy summed per unique block height
3. **User Tracking**: Unique users counted per time period
4. **Rate Calculation**: Average energy per block computed

### Moving Average Smoothing
- 5-point moving average applied to reduce noise
- Helps identify longer-term trends vs daily fluctuations

### Statistical Analysis
- **Quartile Breakdown**: Q1, Median, Q3 analysis
- **Distribution Metrics**: Min, max, average, volatility
- **User Efficiency**: Energy generated per active user

## Use Cases

1. **Token Performance Monitoring**: Track which tokens generate energy most efficiently
2. **Trend Analysis**: Identify tokens with increasing/decreasing generation rates  
3. **User Behavior**: Understand how user activity correlates with energy generation
4. **System Health**: Monitor overall energy ecosystem performance
5. **Optimization**: Identify opportunities to improve energy generation mechanisms

## Integration

The energy rate analytics integrates with:
- **Token Metadata**: Uses `@repo/tokens` for proper decimal formatting and symbols
- **Energy Analytics**: Builds on existing energy log processing
- **Admin Dashboard**: Provides actionable insights for system administrators

## Performance Considerations

- **Time Window Limits**: Current rate calculations use max 24h window for performance
- **Data Sampling**: Historical analysis uses daily aggregation to manage large datasets
- **Caching**: API responses can be cached as data updates are not real-time critical
- **Memory Usage**: Limited to 50 top users and recent data points to prevent memory issues