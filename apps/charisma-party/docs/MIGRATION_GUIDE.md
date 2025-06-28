# Migration Guide: Separate Servers to Unified Subscription Server

## Overview

This guide helps you migrate from separate `balances` and `prices` PartyKit servers to the new unified `tokens` server. The unified server provides better performance, simplified client code, and advanced features like auto-discovery and intelligent broadcasting.

## Quick Migration Checklist

- [ ] Update WebSocket connection URLs
- [ ] Modify subscription message format
- [ ] Update message type handling
- [ ] Test static vs real-time behavior
- [ ] Verify error handling
- [ ] Performance test with your usage patterns

## Connection Changes

### Before (Separate Servers)
```typescript
// Two separate connections
const balanceWs = new WebSocket('ws://localhost:1999/parties/balances/main');
const priceWs = new WebSocket('ws://localhost:1999/parties/prices/main');
```

### After (Unified Server)
```typescript
// Single connection
const tokensWs = new WebSocket('ws://localhost:1999/parties/tokens/main');
```

## Subscription Pattern Migration

### 1. Balance-Only Subscriptions

**Before:**
```typescript
balanceWs.send({
  type: 'SUBSCRIBE',
  userIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS']
});
```

**After (Exact Same!):**
```typescript
tokensWs.send({
  type: 'SUBSCRIBE',
  userIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS']
});
```

### 2. Price-Only Subscriptions

**Before:**
```typescript
priceWs.send({
  type: 'SUBSCRIBE',
  contractIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token']
});
```

**After:**
```typescript
// For metadata-only (static)
tokensWs.send({
  type: 'SUBSCRIBE',
  contractIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token']
});

// For real-time prices (equivalent to old behavior)
tokensWs.send({
  type: 'SUBSCRIBE',
  contractIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  includePrices: true
});
```

### 3. Combined Subscriptions (New!)

**Before (Complex):**
```typescript
// Multiple connections and coordination
balanceWs.send({ type: 'SUBSCRIBE', userIds: ['SP...'] });
priceWs.send({ type: 'SUBSCRIBE', contractIds: ['SP...token1', 'SP...token2'] });

// Manual coordination between two data streams
let balanceData = {};
let priceData = {};

balanceWs.onmessage = (event) => {
  balanceData = JSON.parse(event.data);
  updateUI(combineData(balanceData, priceData));
};

priceWs.onmessage = (event) => {
  priceData = JSON.parse(event.data);
  updateUI(combineData(balanceData, priceData));
};
```

**After (Simple):**
```typescript
// Single connection with automatic coordination
tokensWs.send({
  type: 'SUBSCRIBE',
  userIds: ['SP...'],
  includePrices: true
});

tokensWs.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'USER_PORTFOLIO':
      // Complete portfolio with metadata and balances
      updatePortfolioUI(message);
      break;
    case 'BALANCE_UPDATE':
      updateBalanceUI(message);
      break;
    case 'PRICE_UPDATE':
      updatePriceUI(message);
      break;
  }
};
```

## Message Type Updates

### New Message Types to Handle

#### TOKEN_METADATA
```typescript
interface TokenMetadataMessage {
  type: 'TOKEN_METADATA';
  contractId: string;
  metadata: EnhancedTokenRecord;
  currentPrice?: PriceUpdate;
  timestamp: number;
}
```

#### USER_PORTFOLIO
```typescript
interface UserPortfolioMessage {
  type: 'USER_PORTFOLIO';
  userId: string;
  tokens: TokenMetadataMessage[];
  balances?: BalanceUpdateMessage[];
  timestamp: number;
}
```

#### TOKEN_BATCH
```typescript
interface TokenBatchMessage {
  type: 'TOKEN_BATCH';
  metadata?: TokenMetadataMessage[];
  balances?: BalanceUpdateMessage[];
  prices?: PriceUpdate[];
  timestamp: number;
}
```

### Updated Message Handler

**Before:**
```typescript
// Separate handlers for different connections
balanceWs.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'BALANCE_UPDATE') {
    handleBalanceUpdate(message);
  }
};

priceWs.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.type === 'PRICE_UPDATE') {
    handlePriceUpdate(message);
  }
};
```

**After:**
```typescript
// Unified handler
tokensWs.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'TOKEN_METADATA':
      handleTokenMetadata(message);
      break;
    case 'USER_PORTFOLIO':
      handleUserPortfolio(message);
      break;
    case 'TOKEN_BATCH':
      handleTokenBatch(message);
      break;
    case 'BALANCE_UPDATE':
      handleBalanceUpdate(message); // Same as before!
      break;
    case 'PRICE_UPDATE':
      handlePriceUpdate(message); // Same as before!
      break;
    case 'SERVER_INFO':
      handleServerInfo(message);
      break;
    case 'ERROR':
      handleError(message);
      break;
  }
};
```

## Usage Pattern Examples

### Portfolio Tracker Migration

**Before:**
```typescript
class PortfolioTracker {
  private balanceWs: WebSocket;
  private priceWs: WebSocket;
  private balances: Map<string, any> = new Map();
  private prices: Map<string, number> = new Map();

  async connect(userId: string) {
    // Connect to both servers
    this.balanceWs = new WebSocket('ws://localhost:1999/parties/balances/main');
    this.priceWs = new WebSocket('ws://localhost:1999/parties/prices/main');

    // Set up balance handler
    this.balanceWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.balances.set(message.contractId, message);
      this.updateUI();
    };

    // Set up price handler
    this.priceWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.prices.set(message.contractId, message.price);
      this.updateUI();
    };

    // Subscribe to user balances
    this.balanceWs.onopen = () => {
      this.balanceWs.send({ type: 'SUBSCRIBE', userIds: [userId] });
    };

    // Subscribe to all prices (inefficient!)
    this.priceWs.onopen = () => {
      this.priceWs.send({ type: 'SUBSCRIBE', contractIds: [] });
    };
  }

  private updateUI() {
    // Manually combine balance and price data
    const portfolio = Array.from(this.balances.values()).map(balance => ({
      ...balance,
      currentPrice: this.prices.get(balance.contractId),
      value: balance.balance * (this.prices.get(balance.contractId) || 0)
    }));
    
    this.renderPortfolio(portfolio);
  }
}
```

**After:**
```typescript
class PortfolioTracker {
  private tokensWs: WebSocket;

  async connect(userId: string) {
    this.tokensWs = new WebSocket('ws://localhost:1999/parties/tokens/main');

    this.tokensWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      switch (message.type) {
        case 'USER_PORTFOLIO':
          // Complete portfolio with metadata, balances, and prices
          this.renderPortfolio(message);
          break;
        case 'BALANCE_UPDATE':
          this.updateBalance(message);
          break;
        case 'PRICE_UPDATE':
          this.updatePrice(message);
          break;
      }
    };

    // Subscribe to user portfolio with prices
    this.tokensWs.onopen = () => {
      this.tokensWs.send({
        type: 'SUBSCRIBE',
        userIds: [userId],
        includePrices: true
      });
    };
  }
}
```

### Token Information Lookup

**Before:**
```typescript
async function getTokenInfo(contractId: string) {
  return new Promise((resolve) => {
    const priceWs = new WebSocket('ws://localhost:1999/parties/prices/main');
    
    priceWs.onopen = () => {
      priceWs.send({ type: 'SUBSCRIBE', contractIds: [contractId] });
    };
    
    priceWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.contractId === contractId) {
        // Only got price, need to get metadata separately
        resolve({ price: message.price });
        priceWs.close();
      }
    };
  });
}
```

**After:**
```typescript
async function getTokenInfo(contractId: string) {
  return new Promise((resolve) => {
    const tokensWs = new WebSocket('ws://localhost:1999/parties/tokens/lookup');
    
    tokensWs.onopen = () => {
      tokensWs.send({
        type: 'SUBSCRIBE',
        contractIds: [contractId],
        includePrices: true
      });
    };
    
    tokensWs.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'TOKEN_BATCH') {
        const tokenData = message.metadata[0];
        // Complete token info: metadata + current price
        resolve({
          ...tokenData.metadata,
          currentPrice: tokenData.currentPrice?.price
        });
        tokensWs.close();
      }
    };
  });
}
```

## Performance Optimizations

### 1. Use Static Subscriptions for One-off Lookups

**Inefficient (Old Way):**
```typescript
// Subscribing to real-time when you only need metadata
tokensWs.send({
  type: 'SUBSCRIBE',
  contractIds: [contractId],
  includePrices: true
});
// ... get data and close connection
```

**Efficient (New Way):**
```typescript
// Static lookup - server optimizes for this pattern
tokensWs.send({
  type: 'SUBSCRIBE',
  contractIds: [contractId]
  // No includePrices - static lookup only
});
```

### 2. Leverage Auto-Discovery

**Manual (Old Way):**
```typescript
// Manually subscribing to all tokens user might have
tokensWs.send({
  type: 'SUBSCRIBE',
  userIds: [userId],
  contractIds: [
    'SP...token1',
    'SP...token2',
    'SP...token3'
    // etc.
  ],
  includePrices: true
});
```

**Auto-Discovery (New Way):**
```typescript
// Server auto-discovers all tokens user holds
tokensWs.send({
  type: 'SUBSCRIBE',
  userIds: [userId],
  includePrices: true
});
```

### 3. Intelligent Price Subscriptions

The unified server automatically sends price updates for tokens in a user's portfolio when `includePrices: true`, eliminating the need for separate price subscriptions.

## Error Handling Updates

### New Error Types
```typescript
interface ErrorMessage {
  type: 'ERROR';
  message: string;
  code?: string;
}
```

### Error Handler
```typescript
tokensWs.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'ERROR') {
    console.error('Subscription error:', message.message);
    
    // Handle specific errors
    if (message.message.includes('Invalid contract ID')) {
      handleInvalidContractId(message);
    } else if (message.message.includes('Invalid user address')) {
      handleInvalidUserAddress(message);
    }
  }
};
```

## Testing Your Migration

### 1. Test Each Subscription Pattern
```typescript
// Test static metadata lookup
await testMetadataLookup();

// Test user portfolio with auto-discovery
await testUserPortfolio();

// Test specific token subscriptions
await testSpecificTokens();

// Test combined subscriptions
await testCombinedSubscriptions();
```

### 2. Performance Comparison
```typescript
// Compare response times
const staticTime = await measureStaticLookup();
const realTimeTime = await measureRealTimeSetup();

console.log(`Static lookup: ${staticTime}ms`);
console.log(`Real-time setup: ${realTimeTime}ms`);
```

### 3. Load Testing
```typescript
// Test concurrent connections
await testConcurrentStatic(100); // Should handle easily
await testConcurrentRealTime(25); // More resource intensive
```

## Common Migration Issues

### 1. Missing `includePrices: true`
**Problem**: Not getting price updates
**Solution**: Add `includePrices: true` to subscriptions that need real-time prices

### 2. Expecting Immediate Real-time Updates
**Problem**: Static subscriptions don't receive ongoing updates
**Solution**: Use appropriate subscription pattern for your use case

### 3. Over-subscribing
**Problem**: Too many real-time connections
**Solution**: Use static lookups where possible, combine subscriptions

### 4. Message Type Confusion
**Problem**: Not handling new message types
**Solution**: Update message handlers to support new unified types

## Rollback Plan

If you need to rollback to separate servers:

1. Keep old connection logic as fallback
2. Use feature flags to switch between unified and separate
3. Monitor performance and error rates
4. Gradually increase unified server traffic

```typescript
const useUnifiedServer = process.env.USE_UNIFIED_SERVER === 'true';

if (useUnifiedServer) {
  // New unified server logic
  connectToUnifiedServer();
} else {
  // Old separate servers logic
  connectToSeparateServers();
}
```

## Support and Troubleshooting

### Debug Logging
```typescript
tokensWs.onopen = () => {
  console.log('Connected to unified tokens server');
};

tokensWs.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received message:', message.type, message);
};

tokensWs.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

### Performance Monitoring
```typescript
const metrics = {
  connectionTime: 0,
  messageCount: 0,
  errorCount: 0
};

const startTime = Date.now();
tokensWs.onopen = () => {
  metrics.connectionTime = Date.now() - startTime;
};

tokensWs.onmessage = () => {
  metrics.messageCount++;
};

tokensWs.onerror = () => {
  metrics.errorCount++;
};
```

### Common Solutions

| Issue | Solution |
|-------|----------|
| No price updates | Add `includePrices: true` |
| No balance updates | Include `userIds` in subscription |
| Connection timeout | Check server status and URL |
| Invalid contract ID error | Verify contract ID format |
| Too many connections | Use static lookups for one-off data |
| Slow performance | Optimize subscription specificity |

## Next Steps

1. **Start Small**: Migrate one feature at a time
2. **Test Thoroughly**: Use the provided test utilities
3. **Monitor Performance**: Compare before/after metrics
4. **Optimize Gradually**: Refine subscription patterns based on usage
5. **Provide Feedback**: Report issues and suggestions for improvement

The unified server provides significant benefits in terms of performance, simplicity, and new capabilities. Take advantage of features like auto-discovery and intelligent broadcasting to build better, more efficient applications.