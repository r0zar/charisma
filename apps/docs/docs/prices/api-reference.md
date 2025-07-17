---
sidebar_position: 3
title: API Reference
---

# Pricing API Reference

The Charisma Pricing System provides RESTful HTTP endpoints for accessing real-time token prices, detailed calculation information, and liquidity analysis. All endpoints return JSON responses and support CORS for browser-based applications.

## Base URL

[`https://invest.charisma.rocks/api/v1`](https://invest.charisma.rocks/api/v1)

## Authentication

No authentication is required for the pricing APIs. All endpoints are publicly accessible with appropriate rate limiting.

## Common Headers

### Request Headers
```http
Accept: application/json
User-Agent: YourApp/1.0
```

### Response Headers
```http
Content-Type: application/json
Access-Control-Allow-Origin: *
Cache-Control: public, s-maxage=30, stale-while-revalidate=60
```

## Endpoints

### GET [/prices](https://invest.charisma.rocks/api/v1/prices)

Retrieve pricing data for multiple tokens with filtering and sorting options.

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | `50` | Maximum number of tokens to return (max: 100) |
| `details` | boolean | `true` | Include detailed calculation information (always enabled) |
| `minConfidence` | number | `0` | Minimum confidence threshold (0-1) |
| `symbols` | string | - | Comma-separated list of token symbols to filter |

#### Example Request

```bash
curl "https://invest.charisma.rocks/api/v1/prices?limit=10&details=true&minConfidence=0.8"
```

**[Try it live: Basic request](https://invest.charisma.rocks/api/v1/prices?limit=10)**

**[Try it live: With details](https://invest.charisma.rocks/api/v1/prices?limit=5&details=true)**

#### Response Format

```json
{
  "status": "success",
  "data": [
    {
      "tokenId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token",
      "symbol": "CHA",
      "name": "Charisma",
      "decimals": 6,
      "image": "https://charisma.rocks/charisma-logo-square.png",
      "description": "The primary token of the Charisma ecosystem.",
      "usdPrice": 0.46840046942724306,
      "sbtcRatio": 0.000004732463543469713,
      "confidence": 0.9699320418391625,
      "lastUpdated": 1750625214265,
      
      // Always included (details parameter always true)
      "totalLiquidity": 1522682.35, // Actual token liquidity (not sum of paths)
      "calculationDetails": {
        "btcPrice": 99095.63333333335,
        "pathsUsed": 10,
        "priceVariation": 0.02029004135102099
      },
      "primaryPath": {
        "tokens": ["SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token", "SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz", "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"],
        "poolCount": 2,
        "totalLiquidity": 505903.169349132,
        "reliability": 0.42612305271225653,
        "confidence": 1,
        "pathLength": 3
      },
      "alternativePathCount": 5
    }
  ],
  "metadata": {
    "count": 10,
    "totalTokensAvailable": 127,
    "processingTimeMs": 234,
    "minConfidence": 0.8,
    "includeDetails": true,
    "graphStats": {
      "totalNodes": 127,
      "totalEdges": 89,
      "averageLiquidity": 45000.0,
      "lastUpdate": 1703123456789
    }
  }
}
```

#### Response Fields

**Token Data:**
- `tokenId` - Unique contract identifier
- `symbol` - Token trading symbol
- `name` - Full token name
- `decimals` - Number of decimal places
- `image` - Token logo URL (if available)
- `description` - Token description
- `usdPrice` - Current USD price
- `sbtcRatio` - Price ratio relative to sBTC
- `confidence` - Calculation confidence (0-1)
- `lastUpdated` - Timestamp of last price update

**Calculation Details** (always included):
- `totalLiquidity` - Actual token liquidity (not sum of paths) 
- `calculationDetails` - BTC price, paths used, price variation
- `primaryPath` - Main trading route with tokens, pools, and metrics
- `alternativePaths` - Array of alternative trading routes with reliability metrics

**Metadata:**
- `count` - Number of tokens in response (bulk endpoint)
- `totalTokensAvailable` - Total tokens in system (bulk endpoint)
- `processingTimeMs` - Response time
- `includeDetails` - Whether detailed information was requested
- `graphStats` - Graph topology information (bulk endpoint with details)

### GET /prices/[tokenId]

Retrieve detailed pricing information for a specific token, including liquidity analysis and pool breakdown.

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `tokenId` | string | Contract ID of the token (URL encoded) |

#### Example Request

```bash
# Basic request
curl "https://invest.charisma.rocks/api/v1/prices/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"

# With detailed path analysis
curl "https://invest.charisma.rocks/api/v1/prices/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token?details=true"
```

**[Try it live: CHA token](https://invest.charisma.rocks/api/v1/prices/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token)**

**[Try it live: CHA with details](https://invest.charisma.rocks/api/v1/prices/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token?details=true)**

#### Response Format

```json
{
  "status": "success",
  "data": {
    "tokenId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token",
    "symbol": "CHA",
    "name": "Charisma",
    "decimals": 6,
    "image": "https://charisma.rocks/charisma-logo-square.png",
    "description": "The primary token of the Charisma ecosystem.",
    "usdPrice": 0.46896661415082397,
    "sbtcRatio": 0.000004732464977274383,
    "confidence": 0.9844320140756163,
    "lastUpdated": 1750625520714,
    
    // Always included (details parameter always true)
    "totalLiquidity": 1522682.35, // Actual token liquidity (not sum of paths)
    "calculationDetails": {
      "btcPrice": 99095.63333333335,
      "pathsUsed": 10,
      "priceVariation": 0.02029004135102099
    },
    "primaryPath": {
      "tokens": [
        "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token",
        "SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz",
        "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
      ],
      "pools": [
        {
          "poolId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.president-pepe-lp",
          "tokenA": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token",
          "tokenB": "SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz",
          "reserveA": 3341462444,
          "reserveB": 74778606660,
          "fee": 0,
          "lastUpdated": 1750625420589
        },
        {
          "poolId": "SP6SA6BTPNN5WDAWQ7GWJF1T5E2KWY01K9SZDBJQ.pepe-faktory-pool",
          "tokenA": "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token",
          "tokenB": "SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz",
          "reserveA": 8802960,
          "reserveB": 413502659337,
          "fee": 0,
          "lastUpdated": 1750625420589
        }
      ],
      "totalLiquidity": 505903.169349132,
      "reliability": 0.42612305271225653,
      "confidence": 1,
      "pathLength": 3
    },
    "alternativePaths": [
      {
        "tokens": [
          "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token",
          "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token",
          "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
        ],
        "poolCount": 2,
        "totalLiquidity": 49270.88226697283,
        "reliability": 0.028393292466467008,
        "confidence": 0.9854176453394566,
        "pathLength": 3
      },
      {
        "tokens": [
          "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token",
          "SP1AY6K3PQV5MRT6R4S671NWW2FRVPKM0BR162CT6.leo-token",
          "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token"
        ],
        "poolCount": 2,
        "totalLiquidity": 99131.86277158075,
        "reliability": 0.02578666618077362,
        "confidence": 1,
        "pathLength": 3
      }
    ]
  },
  "metadata": {
    "processingTimeMs": 147,
    "includeDetails": true
  }
}
```

## Filtering and Pagination

### Symbol Filtering

Filter results by specific token symbols:

```bash
curl "https://invest.charisma.rocks/api/v1/prices?symbols=CHA,sBTC,STX&limit=3"
```

**[Try it live: Popular tokens](https://invest.charisma.rocks/api/v1/prices?symbols=CHA,sBTC,STX)**

### Confidence Filtering

Only return tokens with high confidence scores:

```bash
curl "https://invest.charisma.rocks/api/v1/prices?minConfidence=0.9"
```

**[Try it live: High confidence only](https://invest.charisma.rocks/api/v1/prices?minConfidence=0.9)**

### Pagination

Use limit and sorting for pagination:

```bash
# First page
curl "https://invest.charisma.rocks/api/v1/prices?limit=20"

# Results are sorted by confidence (highest first) by default
```

## Error Responses

### Standard Error Format

```json
{
  "status": "error",
  "error": "Bad Request",
  "message": "Invalid token contract ID format",
  "metadata": {
    "processingTimeMs": 45
  }
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `400` | Bad Request - Invalid parameters |
| `404` | Not Found - Token not found |
| `429` | Too Many Requests - Rate limit exceeded (Vercel WAF) |
| `500` | Internal Server Error - System error |
| `503` | Service Unavailable - Temporary outage |

*Note: 429 errors are handled by Vercel WAF at the edge level*

### Common Error Messages

**Invalid Token ID:**
```json
{
  "status": "error",
  "error": "Bad Request", 
  "message": "Token contract ID must contain a period (.)"
}
```

**Token Not Found:**
```json
{
  "status": "error",
  "error": "Not Found",
  "message": "Token not found in the system"
}
```

**Rate Limit (Vercel WAF):**
When rate limited, blocked requests receive:
```http
HTTP/1.1 429 Too Many Requests
Content-Type: text/html

<!DOCTYPE html>
<html>
<head>
  <title>Rate Limit Exceeded</title>
</head>
<body>
  <h1>Too Many Requests</h1>
  <p>You have exceeded the rate limit. Please try again later.</p>
</body>
</html>
```

Note: WAF-level blocking occurs before reaching the API, so custom JSON error responses are not possible.

## Rate Limiting

Rate limiting is implemented using **Vercel's Web Application Firewall (WAF)** for optimal performance and edge-level protection.

### Current Implementation
- **Technology**: Vercel WAF rules configured at the edge
- **Scope**: Applied to all `/api/v1/prices*` endpoints
- **Performance**: Zero latency impact (handled at CDN edge)
- **Reliability**: Built-in DDoS protection and traffic shaping

### Rate Limits
- **All Pricing Endpoints** (`/api/v1/prices*`): **100 requests per 60 seconds per IP**
- **Window Type**: Fixed window (resets every 60 seconds)
- **Scope**: Applies to all pricing endpoints uniformly
- **Blocking**: Automatic at edge level before reaching API

### WAF Rule Configuration
```yaml
# Vercel WAF configuration (active)
rules:
  - name: "prices-api-rate-limit"
    match:
      path: "/api/v1/prices*"
    action:
      type: "rate_limit"
      rate_limit:
        requests_per_window: 100
        window_seconds: 60
        window_type: "fixed"
```

### Rate Limit Testing
You can test the rate limit by making more than 100 requests to any prices endpoint within 60 seconds:

```bash
# Test rate limiting
for i in {1..105}; do
  curl -w "%{http_code}\n" -o /dev/null -s "https://invest.charisma.rocks/api/v1/prices?limit=1"
done
# Requests 101-105 should return 429
```

**Status**: ✅ Active and enforced
**Benefits**: Edge-level protection, zero application latency, automatic scaling

## Caching

### Client Caching
Responses include appropriate cache headers:
- **CDN Cache**: 30 seconds
- **Stale-While-Revalidate**: 60 seconds
- **Browser Cache**: Based on Cache-Control headers

### Recommended Client Strategy
1. Cache responses for 30 seconds
2. Use stale data while fetching updates
3. Implement exponential backoff on errors
4. Monitor rate limit headers

**Status**: Internal testing phase for Charisma applications

## SDK and Libraries

### Blaze SDK (Coming Soon)

The official **blaze-sdk** is being developed to provide a comprehensive TypeScript SDK with real-time capabilities:

```javascript
// Coming soon: Official blaze-sdk
import { BlazeClient } from 'blaze-sdk';

const blaze = new BlazeClient();

// Get token prices
const prices = await blaze.prices.getTokenPrices({
  limit: 20,
  details: true,
  minConfidence: 0.8
});

// Subscribe to real-time updates
blaze.prices.subscribe(['CHA', 'sBTC'], (priceUpdate) => {
  console.log('Price update:', priceUpdate);
});
```

### Current JavaScript/TypeScript

For now, use standard fetch API:

```javascript
// Current implementation using fetch
async function getTokenPrices(options = {}) {
  const params = new URLSearchParams(options);
  const response = await fetch(`https://invest.charisma.rocks/api/v1/prices?${params}`);
  return response.json();
}

// Usage
const prices = await getTokenPrices({
  limit: 20,
  details: true,
  minConfidence: 0.8
});
```

### Python

```python
import requests

def get_token_prices(**kwargs):
    response = requests.get(
        'https://invest.charisma.rocks/api/v1/prices',
        params=kwargs
    )
    return response.json()

# Usage
prices = get_token_prices(limit=20, details=True, minConfidence=0.8)
```

## Best Practices

### Error Handling
- Always check the `status` field in responses
- Implement retry logic with exponential backoff for 500 errors
- Cache responses to reduce load (30-60 second cache recommended)
- Handle network timeouts gracefully

### Performance
- Use appropriate `limit` values to avoid large responses (max 100)
- Details are always included (parameter is always enabled for transparency)
- Implement client-side caching (30 seconds recommended)
- Respect Vercel WAF rate limits (100 requests per 60 seconds for all pricing endpoints)

### Data Freshness
- Prices update approximately every 30 seconds
- Check `lastUpdated` timestamps for data age
- Use confidence scores to assess price reliability
- Implement fallback strategies for low confidence data

This API provides comprehensive access to the Charisma Pricing System's capabilities while maintaining high performance and reliability.