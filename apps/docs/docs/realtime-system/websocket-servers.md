---
sidebar_position: 2
title: WebSocket Servers
---

# WebSocket Servers

The real-time system consists of two main PartyKit servers that handle different types of data streaming.

## PricesParty

Manages real-time token price data streaming with efficient subscription management.

### Features
- **Price Streaming** - Broadcasts price updates every 5 minutes
- **Subscription Management** - Tracks client subscriptions by contract ID
- **Price Validation** - Validates contract ID formats and price data types
- **Development Mode** - Adds price noise for realistic testing
- **Change Detection** - Only broadcasts when prices actually change

### Message Protocol

#### Subscribe to Price Updates
```typescript
// Subscribe to specific tokens
{
  type: 'SUBSCRIBE',
  contractIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', '.stx'],
  clientId: 'unique-client-id'
}

// Subscribe to all prices (empty array)
{
  type: 'SUBSCRIBE', 
  contractIds: [],
  clientId: 'unique-client-id'
}
```

#### Receive Price Updates
```typescript
{
  type: 'PRICE_UPDATE',
  contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  price: 1.2345,
  timestamp: 1234567890123,
  source: 'api'
}
```

#### Unsubscribe
```typescript
{
  type: 'UNSUBSCRIBE',
  contractIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  clientId: 'unique-client-id'
}
```

#### Ping/Pong for Connection Health
```typescript
// Client sends
{ type: 'PING', timestamp: Date.now() }

// Server responds
{ type: 'PONG', timestamp: 1234567890123 }
```

### HTTP Endpoints

#### GET /prices
Returns current price data for all or filtered tokens.

```bash
# All prices
GET ws://localhost:1999/parties/prices/main

# Specific tokens  
GET ws://localhost:1999/parties/prices/main?tokens=SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token,.stx
```

#### POST /prices
Triggers manual price refresh.

```bash
POST ws://localhost:1999/parties/prices/main
```

### Contract ID Validation

Valid contract ID formats:
- `.stx` or `stx` - Native STX token
- `SP{38-39 chars}.{contract-name}` - Standard Stacks contract
- `SP{38-39 chars}.{contract-name}::{trait-name}` - Contract with trait

## BalancesParty

Manages real-time user balance data with advanced subnet token support.

### Features
- **Balance Streaming** - User balance updates from Hiro API
- **Subnet Token Support** - Detects and aggregates L2 token balances
- **Token Metadata** - Enriched metadata with pricing information
- **Multi-user Subscriptions** - Efficient batch processing
- **Mainnet Mapping** - Maps subnet tokens to mainnet equivalents

### Message Protocol

#### Subscribe to User Balances
```typescript
// Subscribe to specific users
{
  type: 'SUBSCRIBE',
  userIds: ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS'],
  clientId: 'unique-client-id'
}

// Subscribe to all users (empty array)
{
  type: 'SUBSCRIBE',
  userIds: [],
  clientId: 'unique-client-id'
}
```

#### Receive Balance Updates
```typescript
{
  type: 'BALANCE_UPDATE',
  userId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS',
  contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token',
  
  // Mainnet balance
  balance: 1000000,
  totalSent: '100000',
  totalReceived: '1100000', 
  formattedBalance: 1.0,
  
  // Subnet balance (if available)
  subnetBalance: 500000,
  formattedSubnetBalance: 0.5,
  subnetContractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
  
  // Token metadata
  metadata: {
    name: 'Charisma Token',
    symbol: 'CHA',
    decimals: 6,
    type: 'SIP10',
    image: 'https://...',
    price: 1.2345,
    marketCap: 5000000
  },
  
  timestamp: 1234567890123,
  source: 'hiro-api'
}
```

#### Balance Batch Messages
Multiple balance updates sent together for efficiency:

```typescript
{
  type: 'BALANCE_BATCH',
  balances: [
    { /* balance update 1 */ },
    { /* balance update 2 */ },
    // ...
  ],
  timestamp: 1234567890123
}
```

### Advanced Features

#### Subnet Token Detection
The server automatically detects subnet tokens and fetches their balances via contract calls:

1. **Metadata Analysis** - Identifies tokens with `type: 'SUBNET'` and `base` mapping
2. **Contract Calls** - Uses `callReadOnlyFunction` to get subnet balances
3. **Balance Aggregation** - Combines mainnet + subnet balances in single message
4. **Error Handling** - Graceful fallback when subnet calls fail

#### User Address Validation
Validates Stacks address formats:
- Standard format: `SP{38-39 chars}` or `ST{38-39 chars}`
- Filters invalid addresses from subscriptions

### HTTP Endpoints

#### GET /balances
```bash
# All balances
GET ws://localhost:1999/parties/balances/main

# Specific users
GET ws://localhost:1999/parties/balances/main?users=SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
```

#### POST /balances
Triggers manual balance refresh.

```bash
POST ws://localhost:1999/parties/balances/main
```

## Connection Lifecycle

### Client Connection
1. **onConnect** - Server sends `SERVER_INFO` with metadata count and environment info
2. **Initial Data** - Server sends cached data relevant to the client
3. **Subscription Setup** - Client sends subscription messages

### Message Handling
1. **Message Parsing** - JSON validation and type checking
2. **Subscription Management** - Updates internal subscription maps
3. **Data Broadcasting** - Sends relevant updates to subscribed clients

### Client Disconnection
1. **onClose** - Removes client from subscription maps
2. **Cleanup** - Removes watched users/tokens if no longer needed
3. **Resource Management** - Stops intervals if no active connections

## Error Handling

### Message Errors
- **Invalid JSON** - Returns error message to client
- **Unknown Message Type** - Returns error with supported types
- **Validation Failures** - Filters invalid data silently

### API Errors
- **External API Failures** - Logs errors, continues processing other data
- **Rate Limiting** - Implements backoff strategies
- **Network Issues** - Automatic retry with exponential backoff

### Environment Detection

The servers automatically detect their environment:

```typescript
private detectLocalDev(): boolean {
  // Test environment
  if (process.env.NODE_ENV === 'test' || process.env.PARTYKIT_ENV === 'test') {
    return true;
  }
  
  // Development environment  
  return process.env.NODE_ENV === 'development' ||
         process.env.PARTYKIT_ENV === 'development' ||
         (typeof globalThis !== 'undefined' && 
          globalThis.location?.hostname === 'localhost');
}
```

**Development Mode Features:**
- Price noise generation (±5% random variance)
- Faster update intervals (3 seconds initial, 5 minutes ongoing)
- Enhanced logging
- No production alarms/persistence