# Unified Subscription Server API Documentation

## Overview

The Unified Tokens Party server provides a sophisticated WebSocket-based subscription system for cryptocurrency token information. It implements a "metadata core + optional real-time" model that efficiently handles both one-off data lookups and persistent real-time updates.

## Connection

Connect to the unified server via WebSocket:

```
ws://localhost:1999/parties/tokens/{room-id}
```

For testing: `ws://localhost:1999/parties/tokens/test`

## Subscription Model

The unified server supports four distinct subscription patterns:

### 1. Metadata-Only Lookup (Static)
**Use Case**: Get token information without ongoing updates
**Behavior**: Server sends data and expects connection to close
**Real-time**: No

```typescript
{
  type: 'SUBSCRIBE',
  contractIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token']
}
```

**Response**: `TOKEN_BATCH` message with metadata

### 2. Metadata with Real-time Prices
**Use Case**: Get token information with ongoing price updates
**Behavior**: Server sends initial data then ongoing price updates
**Real-time**: Yes (prices only)

```typescript
{
  type: 'SUBSCRIBE',
  contractIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  includePrices: true
}
```

**Response**: `TOKEN_BATCH` + ongoing `PRICE_UPDATE` messages

### 3. User Portfolio Auto-Discovery
**Use Case**: Get all tokens a user holds with balance updates
**Behavior**: Server auto-discovers user's tokens and sends portfolio + balance updates
**Real-time**: Yes (balances)

```typescript
{
  type: 'SUBSCRIBE',
  userIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS']
}
```

**Response**: `USER_PORTFOLIO` + ongoing `BALANCE_UPDATE` messages

### 4. User Portfolio with Full Real-time
**Use Case**: Complete portfolio tracking with balances and prices
**Behavior**: Auto-discovery + balance updates + price updates for held tokens
**Real-time**: Yes (balances + prices)

```typescript
{
  type: 'SUBSCRIBE',
  userIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'],
  includePrices: true
}
```

**Response**: `USER_PORTFOLIO` + ongoing `BALANCE_UPDATE` + `PRICE_UPDATE` messages

### 5. Specific Tokens for Users
**Use Case**: Track specific tokens for specific users
**Behavior**: Targeted subscription for particular user-token combinations
**Real-time**: Yes (balances, optionally prices)

```typescript
{
  type: 'SUBSCRIBE',
  userIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'],
  contractIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  includePrices: true // optional
}
```

**Response**: `TOKEN_BATCH` + `BALANCE_BATCH` + ongoing updates

### 6. Empty Subscription
**Use Case**: Test connectivity or get server info
**Behavior**: Server sends acknowledgment only
**Real-time**: No

```typescript
{
  type: 'SUBSCRIBE'
}
```

**Response**: `SERVER_INFO` message

## Message Types

### Subscription Messages

#### UnifiedSubscription
```typescript
interface UnifiedSubscription {
  type: 'SUBSCRIBE' | 'UNSUBSCRIBE';
  userIds?: string[];        // If present, includes balances
  contractIds?: string[];    // If present, includes token metadata  
  includePrices?: boolean;   // If true, adds real-time price updates
}
```

### Response Messages

#### TokenMetadataMessage
```typescript
interface TokenMetadataMessage {
  type: 'TOKEN_METADATA';
  contractId: string;
  metadata: EnhancedTokenRecord;
  currentPrice?: PriceUpdate;
  timestamp: number;
}
```

#### UserPortfolioMessage
```typescript
interface UserPortfolioMessage {
  type: 'USER_PORTFOLIO';
  userId: string;
  tokens: TokenMetadataMessage[];
  balances?: BalanceUpdateMessage[];
  timestamp: number;
}
```

#### TokenBatchMessage
```typescript
interface TokenBatchMessage {
  type: 'TOKEN_BATCH';
  metadata?: TokenMetadataMessage[];
  balances?: BalanceUpdateMessage[];
  prices?: PriceUpdate[];
  timestamp: number;
}
```

#### PriceUpdate
```typescript
interface PriceUpdate {
  type: 'PRICE_UPDATE';
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}
```

#### UnifiedServerInfo
```typescript
interface UnifiedServerInfo {
  type: 'SERVER_INFO';
  party: 'tokens';
  isLocalDev: boolean;
  metadataLoaded: boolean;
  metadataCount: number;
  priceCount: number;
  balanceCount: number;
  timestamp: number;
}
```

## Update Frequencies

- **Price Updates**: Every 60 seconds (1 minute)
- **Balance Updates**: Every 300 seconds (5 minutes)
- **Noise Updates**: Every 1 second (small price variations for testing)

## Intelligent Broadcasting

The server only sends updates to clients that need them:

- **Static subscriptions** receive no ongoing updates
- **Price subscribers** receive price updates for subscribed tokens
- **Balance subscribers** receive balance updates for subscribed users
- **Portfolio subscribers** automatically receive prices for tokens they hold (when `includePrices: true`)

## Error Handling

### Error Message Format
```typescript
interface ErrorMessage {
  type: 'ERROR';
  message: string;
  code?: string;
}
```

### Common Errors
- `Invalid contract ID format: {contractId}` - Contract ID doesn't match expected pattern
- `Invalid user address format` - User ID is not a valid Stacks address
- `Invalid message format` - JSON parsing failed
- `Unknown message type` - Unsupported message type

## Contract ID Validation

Valid contract ID formats:
- Native STX: `.stx` or `stx`
- Standard contracts: `SP{ADDRESS}.{CONTRACT_NAME}`
- With trait: `SP{ADDRESS}.{CONTRACT_NAME}::{TRAIT_NAME}`

Pattern: `/^(SP|ST)[A-Z0-9]{38,39}\\.[a-z0-9\\-]+(::[a-z0-9\\-]+)?$/`

## Performance Characteristics

### Connection Types
- **Static connections**: Fast connect, minimal resource usage, auto-disconnect
- **Real-time connections**: Persistent, ongoing updates, higher resource usage

### Scalability
- Static clients: High concurrency (100+ concurrent)
- Real-time clients: Moderate concurrency (25-50 concurrent recommended)

### Latency
- Initial response: < 100ms
- Ongoing updates: < 100ms from data source
- Noise updates: 1-second intervals

## Example Usage Patterns

### Portfolio Tracker Application
```typescript
// Connect and get user's complete portfolio
const ws = new WebSocket('ws://localhost:1999/parties/tokens/main');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'SUBSCRIBE',
    userIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'],
    includePrices: true
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'USER_PORTFOLIO':
      // Initial portfolio data
      updatePortfolioUI(message);
      break;
    case 'BALANCE_UPDATE':
      // Real-time balance change
      updateBalanceUI(message);
      break;
    case 'PRICE_UPDATE':
      // Real-time price change
      updatePriceUI(message);
      break;
  }
};
```

### Token Information Lookup
```typescript
// Quick token metadata lookup
const ws = new WebSocket('ws://localhost:1999/parties/tokens/lookup');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'SUBSCRIBE',
    contractIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'TOKEN_BATCH') {
    // Got metadata, can close connection
    displayTokenInfo(message.metadata[0]);
    ws.close();
  }
};
```

### Price Monitoring Dashboard
```typescript
// Monitor prices for specific tokens
const ws = new WebSocket('ws://localhost:1999/parties/tokens/prices');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'SUBSCRIBE',
    contractIds: [
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
      'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.synthetic-welsh'
    ],
    includePrices: true
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'TOKEN_BATCH':
      // Initial token data with current prices
      initializeDashboard(message);
      break;
    case 'PRICE_UPDATE':
      // Real-time price updates
      updatePriceTicker(message);
      break;
  }
};
```

## Migration from Separate Servers

### From Legacy Balance Server
**Old:**
```typescript
ws.send({ type: 'SUBSCRIBE', userIds: ['SP...'] });
```

**New:**
```typescript
ws.send({ type: 'SUBSCRIBE', userIds: ['SP...'] }); // Same!
```

### From Legacy Price Server  
**Old:**
```typescript
ws.send({ type: 'SUBSCRIBE', contractIds: ['SP...'] });
```

**New:**
```typescript
ws.send({ 
  type: 'SUBSCRIBE', 
  contractIds: ['SP...'],
  includePrices: true  // Add this for real-time prices
});
```

### Combined Subscriptions
**Old (separate connections):**
```typescript
// Two different WebSocket connections
balanceWs.send({ type: 'SUBSCRIBE', userIds: ['SP...'] });
priceWs.send({ type: 'SUBSCRIBE', contractIds: ['SP...'] });
```

**New (single connection):**
```typescript
// One WebSocket connection
ws.send({ 
  type: 'SUBSCRIBE', 
  userIds: ['SP...'],
  includePrices: true
});
```

## Testing

Use the test client utilities for comprehensive testing:

```typescript
import { createTestClient, UnifiedSubscriptionTester } from './tests/utils/test-client';

const client = await createTestClient();
const tester = new UnifiedSubscriptionTester(client);

// Test different patterns
await tester.subscribeToMetadata(['SP...token']);
await tester.subscribeToUserPortfolio(['SP...user']);
await tester.subscribeToUserPortfolioWithPrices(['SP...user']);
```

## Troubleshooting

### Connection Issues
1. Verify WebSocket URL format
2. Check if PartyKit server is running
3. Confirm room ID is correct

### No Updates Received
1. Check if subscription includes `includePrices: true` for price updates
2. Verify user has balances for balance updates
3. Confirm contract IDs are valid format

### Performance Issues
1. Use static subscriptions for one-off lookups
2. Limit concurrent real-time connections
3. Consider subscription specificity (avoid subscribe-to-all)

### Message Format Errors
1. Ensure JSON is valid
2. Verify required fields are present
3. Check array formats for contractIds/userIds