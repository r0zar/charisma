---
sidebar_position: 6
title: Troubleshooting Guide
---

# Troubleshooting Guide

This guide helps diagnose and resolve common issues with the Charisma Pricing System, from missing token data to performance problems and calculation errors.

## Common Issues

### Missing Token Prices

#### Issue: Token not appearing in price list

**Symptoms:**
- Token exists in pools but doesn't show in `/api/v1/prices`
- Error: "Token not found in the system"
- Empty price data in API responses

**Diagnosis Steps:**

1. **Check if token exists in vault data:**
```bash
# Check vault listings
curl "https://invest.charisma.rocks/api/v1/prices?symbols=TOKEN_SYMBOL"

# Check if token appears in any pools
grep -r "TOKEN_CONTRACT_ID" /path/to/logs
```

2. **Verify token has valid pools:**
```typescript
// In browser console or Node.js
const response = await fetch('/api/v1/prices?details=true');
const data = await response.json();
console.log('Available tokens:', data.data.map(t => t.symbol));
```

3. **Check confidence scores:**
```bash
# Low confidence tokens may be filtered out
curl "https://invest.charisma.rocks/api/v1/prices?minConfidence=0"
```

**Common Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Token excluded from stablecoin detection | Check `btc-oracle.ts` for explicit exclusions |
| Low liquidity in pools | Verify pool reserves are above minimum thresholds |
| Failed price calculation | Check logs for calculation errors |
| Stale cache data | Clear cache or wait for refresh cycle |
| Pool data not synced | Run pool reserve update process |

**Example Fix: sUSDh Token Issue**
```typescript
// In btc-oracle.ts - remove explicit exclusion
export function isStablecoin(symbol: string): boolean {
    const upperSymbol = symbol.toUpperCase();
    
    // Remove this line if token should be included:
    // if (upperSymbol === 'SUSDH') return false;
    
    return STABLECOIN_SYMBOLS.some(stableSymbol => 
        upperSymbol === stableSymbol || 
        upperSymbol.includes('USD') || 
        upperSymbol.includes('DAI')
    );
}
```

### Price Calculation Errors

#### Issue: Incorrect or inflated prices

**Symptoms:**
- Market caps showing values like $10B instead of $10M
- Exchange rates off by factors of 100x or 1000x
- Liquidity values unreasonably high

**Root Cause: Decimal Handling**
Most price calculation errors stem from improper handling of token decimals.

**Diagnosis:**
```typescript
// Check if calculations use atomic units without decimal conversion
const reserveA = 150000000;  // sBTC atomic (8 decimals)
const reserveB = 1500000;    // STX atomic (6 decimals)

// ❌ Wrong: Direct calculation
const wrongPrice = reserveB / reserveA;  // = 0.01 (wrong!)

// ✅ Correct: Decimal-aware calculation
const decimalA = reserveA / Math.pow(10, 8);  // = 1.5
const decimalB = reserveB / Math.pow(10, 6);  // = 1.5
const correctPrice = decimalB / decimalA;     // = 1.0 (correct!)
```

**Solution: Use Decimal Utilities**
```typescript
import { 
  convertAtomicToDecimal,
  calculateDecimalAwareExchangeRate 
} from '@/lib/pricing/decimal-utils';

// Proper calculation
const exchangeRate = calculateDecimalAwareExchangeRate(
  reserveA, 8,  // sBTC reserves and decimals
  reserveB, 6   // STX reserves and decimals
);
```

### API Performance Issues

#### Issue: Slow response times or timeouts

**Symptoms:**
- API responses taking &gt;5 seconds
- Timeout errors on `/api/v1/prices`
- High server load

**Diagnosis:**
```bash
# Check response times
time curl "https://invest.charisma.rocks/api/v1/prices?limit=10"

# Monitor with detailed timing
curl -w "@curl-format.txt" "https://invest.charisma.rocks/api/v1/prices"
```

Where `curl-format.txt` contains:
```
     time_namelookup:  %{time_namelookup}\n
        time_connect:  %{time_connect}\n
     time_appconnect:  %{time_appconnect}\n
    time_pretransfer:  %{time_pretransfer}\n
       time_redirect:  %{time_redirect}\n
  time_starttransfer:  %{time_starttransfer}\n
                     ----------\n
          time_total:  %{time_total}\n
```

**Solutions:**

1. **Reduce request scope:**
```bash
# Use smaller limits
curl "/api/v1/prices?limit=20"

# Request only essential data
curl "/api/v1/prices?details=false"
```

2. **Check cache status:**
```typescript
// Verify caching headers
const response = await fetch('/api/v1/prices');
console.log('Cache-Control:', response.headers.get('cache-control'));
console.log('Age:', response.headers.get('age'));
```

3. **Optimize queries:**
```bash
# Filter by confidence to reduce processing
curl "/api/v1/prices?minConfidence=0.8"

# Request specific symbols only
curl "/api/v1/prices?symbols=sBTC,STX,CHA"
```

### Cache Issues

#### Issue: Stale or inconsistent data

**Symptoms:**
- Prices not updating despite pool changes
- Different prices across multiple requests
- "Cache not warmed" warnings

**Diagnosis:**
```typescript
// Check cache age in response metadata
const response = await fetch('/api/v1/prices?details=true');
const data = await response.json();
console.log('Processing time:', data.metadata.processingTimeMs);
console.log('Graph stats:', data.metadata.graphStats);
```

**Solutions:**

1. **Force cache refresh:**
```bash
# Wait for natural cache expiration (30 seconds)
# Or trigger refresh through admin interface
```

2. **Check cache health:**
```typescript
// Monitor cache hit rates
const healthResponse = await fetch('/api/health');
const health = await healthResponse.json();
console.log('Cache status:', health.cache);
```

3. **Clear problematic cache entries:**
```typescript
// For development/debugging
localStorage.clear(); // Client-side cache
// Server-side cache requires admin access
```

### Low Confidence Scores

#### Issue: Prices showing low confidence

**Symptoms:**
- Confidence scores below 0.5
- Tokens filtered out by confidence thresholds
- Warning about "unreliable price data"

**Diagnosis:**
```bash
# Check confidence distribution
curl "/api/v1/prices?details=true&minConfidence=0" | jq '.data[].confidence'

# Analyze specific token
curl "/api/v1/prices/TOKEN_CONTRACT_ID" | jq '.data.calculationDetails'
```

**Common Causes:**

1. **Low liquidity:**
```typescript
// Check if pools have sufficient liquidity
if (pool.liquidityUsd &lt; 1000) {
  console.warn('Low liquidity pool:', pool.poolId);
}
```

2. **Stale data:**
```typescript
// Check data freshness
const ageMinutes = (Date.now() - pool.lastUpdated) / (1000 * 60);
if (ageMinutes &gt; 10) {
  console.warn('Stale pool data:', pool.poolId);
}
```

3. **Few alternative paths:**
```typescript
// Insufficient path diversity
if (alternativePaths.length &lt; 2) {
  console.warn('Limited path diversity for:', tokenId);
}
```

**Solutions:**

1. **Improve liquidity:**
   - Add more liquidity to pools
   - Create additional trading pairs
   - Incentivize liquidity providers

2. **Update data more frequently:**
   - Reduce cache TTL for critical pools
   - Implement real-time updates
   - Monitor data freshness

3. **Add redundant paths:**
   - Create alternative trading routes
   - Support more token pairs
   - Improve graph connectivity

### API Error Responses

#### Common Error Codes and Solutions

**400 Bad Request:**
```json
{
  "status": "error",
  "error": "Bad Request",
  "message": "Invalid token contract ID format"
}
```

**Solution:** Ensure contract IDs include a period (.) separator:
```bash
# ❌ Wrong
curl "/api/v1/prices/SP123INVALID"

# ✅ Correct  
curl "/api/v1/prices/SP123...CONTRACT.token-name"
```

**404 Not Found:**
```json
{
  "status": "error", 
  "error": "Not Found",
  "message": "Token not found in the system"
}
```

**Solution:** Verify token exists in vault data:
```bash
# Check available tokens
curl "/api/v1/prices" | jq '.data[].tokenId'
```

**429 Too Many Requests:**
```json
{
  "status": "error",
  "error": "Too Many Requests", 
  "message": "Rate limit exceeded. Please try again later."
}
```

**Solution:** Implement rate limiting in client:
```typescript
class RateLimitedClient {
  private lastRequest = 0;
  private minInterval = 1000; // 1 second between requests
  
  async makeRequest(url: string) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minInterval - timeSinceLastRequest)
      );
    }
    
    this.lastRequest = Date.now();
    return fetch(url);
  }
}
```

**500 Internal Server Error:**
```json
{
  "status": "error",
  "error": "Internal Server Error",
  "message": "Price calculation failed"
}
```

**Solution:** Check server logs and retry with exponential backoff:
```typescript
async function retryRequest(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      
      if (response.status &gt;= 500) {
        // Exponential backoff for server errors
        await new Promise(resolve => 
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
        continue;
      }
      
      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
    }
  }
}
```

## Debugging Tools

### Browser Console Debugging

```javascript
// Check current price data
async function debugPrices() {
  const response = await fetch('/api/v1/prices?details=true&limit=5');
  const data = await response.json();
  
  console.table(data.data.map(token => ({
    symbol: token.symbol,
    price: token.usdPrice,
    confidence: token.confidence,
    paths: token.alternativePathCount || 0
  })));
}

// Check specific token
async function debugToken(contractId) {
  const response = await fetch(`/api/v1/prices/${encodeURIComponent(contractId)}`);
  const data = await response.json();
  console.log('Token data:', data);
}

// Monitor API performance
async function monitorAPI() {
  const start = performance.now();
  const response = await fetch('/api/v1/prices?limit=10');
  const end = performance.now();
  
  console.log(`API response time: ${end - start}ms`);
  console.log('Cache headers:', {
    cacheControl: response.headers.get('cache-control'),
    age: response.headers.get('age')
  });
}
```

### Server-Side Debugging

```typescript
// Add to price calculation functions
function debugPriceCalculation(tokenId: string, result: any) {
  console.log(`[DEBUG] Price calculation for ${tokenId}:`, {
    usdPrice: result.usdPrice,
    confidence: result.confidence,
    pathsUsed: result.calculationDetails?.pathsUsed,
    primaryPath: result.primaryPath?.tokens,
    processingTime: Date.now() - startTime
  });
}

// Monitor cache performance
function debugCachePerformance() {
  const cacheStats = {
    hits: cacheHits,
    misses: cacheMisses,
    hitRate: cacheHits / (cacheHits + cacheMisses),
    avgResponseTime: totalResponseTime / requestCount
  };
  
  console.log('[CACHE] Performance stats:', cacheStats);
}
```

### Health Check Endpoints

```bash
# Check system health
curl "/api/health" | jq '.'

# Check BTC oracle status  
curl "/api/health/btc-oracle" | jq '.'

# Check cache status
curl "/api/health/cache" | jq '.'
```

## Performance Optimization

### Client-Side Optimizations

1. **Implement caching:**
```typescript
class PriceCache {
  private cache = new Map();
  private ttl = 30000; // 30 seconds
  
  async getPrice(tokenId: string) {
    const cached = this.cache.get(tokenId);
    if (cached && Date.now() - cached.timestamp < this.ttl) {
      return cached.data;
    }
    
    const data = await this.fetchPrice(tokenId);
    this.cache.set(tokenId, { data, timestamp: Date.now() });
    return data;
  }
}
```

2. **Batch requests:**
```typescript
// Instead of multiple individual requests
const symbols = ['CHA', 'sBTC', 'STX'];
const prices = await fetch(`/api/v1/prices?symbols=${symbols.join(',')}`);
```

3. **Use appropriate limits:**
```typescript
// Request only what you need
const prices = await fetch('/api/v1/prices?limit=20&details=false');
```

### Server-Side Optimizations

1. **Enable compression:**
```typescript
// In Next.js config
module.exports = {
  compress: true,
  // ...other config
};
```

2. **Optimize database queries:**
```typescript
// Use parallel fetching
const [vaults, prices, health] = await Promise.all([
  getAllVaultData(),
  getMultipleTokenPrices(tokenIds),
  getBtcOracleHealth()
]);
```

3. **Implement circuit breakers:**
```typescript
class CircuitBreaker {
  private failures = 0;
  private lastFailure = 0;
  
  async execute(fn: () => Promise<any>) {
    if (this.isOpen()) {
      throw new Error('Circuit breaker open');
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
}
```

## Monitoring and Alerts

### Key Metrics to Monitor

1. **API Response Times**
   - Target: &lt;500ms for /api/v1/prices
   - Alert: &gt;2 seconds

2. **Cache Hit Rates**
   - Target: &gt;80% hit rate
   - Alert: &lt;60% hit rate

3. **Price Confidence Scores**
   - Target: &gt;0.8 average confidence
   - Alert: &lt;0.6 average confidence

4. **Data Freshness**
   - Target: &lt;5 minutes data age
   - Alert: &gt;15 minutes data age

### Setting Up Alerts

```typescript
// Example monitoring function
async function monitorSystemHealth() {
  const metrics = await gatherMetrics();
  
  if (metrics.avgResponseTime &gt; 2000) {
    await sendAlert('High API response times detected');
  }
  
  if (metrics.avgConfidence &lt; 0.6) {
    await sendAlert('Low price confidence scores detected');
  }
  
  if (metrics.cacheHitRate &lt; 0.6) {
    await sendAlert('Poor cache performance detected');
  }
}
```

This troubleshooting guide should help identify and resolve most issues with the Charisma Pricing System. For additional support, check the system logs and consider reaching out to the development team with specific error messages and reproduction steps.