---
sidebar_position: 4
title: Data Flow
---

# Data Flow

Understanding how data flows through the real-time system helps with debugging, optimization, and extending functionality.

## High-Level Flow

The real-time system follows a structured flow with three main phases:

### **Phase 1: Initial Connection**
1. **Client Component Mount**
   - React component with `BlazeProvider` mounts
   - Provider initializes WebSocket connections

2. **WebSocket Establishment**
   - `BlazeProvider` → `PricesParty` (WebSocket connect)
   - `BlazeProvider` → `BalancesParty` (WebSocket connect)

3. **Initial Data Loading**
   - `PricesParty` → External APIs (fetch token prices)
   - `BalancesParty` → External APIs (load token metadata)

4. **Server Response**
   - `PricesParty` → `BlazeProvider` (SERVER_INFO + initial prices)
   - `BalancesParty` → `BlazeProvider` (SERVER_INFO + metadata)

### **Phase 2: Subscription Management**
1. **Automatic Price Subscription**
   - `BlazeProvider` → `PricesParty` (SUBSCRIBE to all prices)

2. **User Balance Subscription** (when requested)
   - Client → `BlazeProvider` (request user balances)
   - `BlazeProvider` → `BalancesParty` (SUBSCRIBE to user)

### **Phase 3: Real-time Updates**

**Price Updates (Every 5 minutes):**
```
PricesParty → External APIs (fetch latest prices)
    ↓ (if prices changed)
PricesParty → BlazeProvider (PRICE_UPDATE message)
    ↓
BlazeProvider → Client (update prices state)
```

**Balance Updates (Every 5 minutes):**
```
BalancesParty → Hiro API (fetch user balances)
    ↓
BalancesParty → Subnet Contracts (fetch subnet balances)
    ↓
BalancesParty → BlazeProvider (separate BALANCE_UPDATE messages for each token)
    ↓
BlazeProvider → Client (merge mainnet + subnet data using token utilities)
```

## Price Data Flow

### 1. External API Integration

The PricesParty fetches price data from the `@repo/tokens` package:

```typescript
// src/parties/prices.ts
import { listPrices } from "@repo/tokens";

private async fetchAndBroadcastPrices() {
  try {
    // Fetch from external API
    const priceData = await listPrices();
    
    // Process and validate
    for (const [contractId, price] of Object.entries(priceData)) {
      if (typeof price === 'number' && !isNaN(price)) {
        const priceUpdate: PriceUpdate = {
          type: 'PRICE_UPDATE',
          contractId,
          price,
          timestamp: Date.now(),
          source: 'api'
        };
        
        // Store and broadcast if changed
        this.updateAndBroadcastPrice(priceUpdate);
      }
    }
  } catch (error) {
    console.error('Price fetch failed:', error);
  }
}
```

### 2. Change Detection

Only changed prices are broadcasted to reduce bandwidth:

```typescript
private updateAndBroadcastPrice(update: PriceUpdate) {
  const lastPrice = this.lastBroadcastedPrices.get(update.contractId);
  
  // Only broadcast if price changed
  if (lastPrice !== update.price) {
    this.latestPrices.set(update.contractId, update);
    this.lastBroadcastedPrices.set(update.contractId, update.price);
    
    // Broadcast to all subscribed clients
    this.room.broadcast(JSON.stringify(update));
  }
}
```

### 3. Client State Updates

The BlazeProvider receives price updates and updates React state:

```typescript
// BlazeProvider.tsx
pricesSocket.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  
  if (data.type === 'PRICE_UPDATE') {
    setPrices(prev => ({
      ...prev,
      [data.contractId]: data
    }));
    setLastUpdate(Date.now());
  }
});
```

## Balance Data Flow

### 1. Token Metadata Loading

BalancesParty loads comprehensive token metadata on startup:

```typescript
// src/balances-lib.ts
export async function loadTokenMetadata(): Promise<Map<string, EnhancedTokenRecord>> {
  // Fetch from token summaries API (includes pricing data)
  const tokenSummaries = await fetchTokenSummariesFromAPI();
  
  const enhancedTokenRecords = new Map<string, EnhancedTokenRecord>();
  
  for (const summary of tokenSummaries) {
    const enhancedRecord: EnhancedTokenRecord = {
      // Core metadata
      contractId: summary.contractId,
      name: summary.name,
      symbol: summary.symbol,
      decimals: summary.decimals,
      type: summary.type,
      
      // Price data from summaries API
      price: summary.price,
      change24h: summary.change24h,
      marketCap: summary.marketCap,
      
      // Subnet mapping
      base: summary.base,
      
      // Internal tracking
      userBalances: {},
      timestamp: Date.now(),
      metadataSource: 'token-summaries-api'
    };
    
    enhancedTokenRecords.set(summary.contractId, enhancedRecord);
  }
  
  return enhancedTokenRecords;
}
```

### 2. Multi-Source Balance Fetching

The system fetches balances from multiple sources:

```typescript
export async function fetchUserBalances(
  userIds: string[], 
  enhancedTokenRecords?: Map<string, EnhancedTokenRecord>
): Promise<Record<string, BalanceData>> {
  
  const balanceUpdates: Record<string, BalanceData> = {};
  
  await Promise.allSettled(
    userIds.map(async (userId) => {
      // 1. Fetch mainnet balances from Hiro API
      const accountBalances = await getAccountBalances(userId, { unanchored: true });
      
      // Process STX balance
      if (accountBalances.stx) {
        balanceUpdates[`${userId}:.stx`] = {
          userId,
          contractId: '.stx',
          balance: Number(accountBalances.stx.balance),
          totalSent: accountBalances.stx.total_sent,
          totalReceived: accountBalances.stx.total_received,
          timestamp: Date.now(),
          source: 'hiro-api'
        };
      }
      
      // Process token balances
      if (accountBalances.fungible_tokens) {
        Object.entries(accountBalances.fungible_tokens).forEach(([contractId, tokenBalance]) => {
          balanceUpdates[`${userId}:${contractId}`] = {
            userId,
            contractId,
            balance: Number(tokenBalance.balance),
            totalSent: tokenBalance.total_sent,
            totalReceived: tokenBalance.total_received,
            timestamp: Date.now(),
            source: 'hiro-api'
          };
        });
      }
      
      // 2. Fetch subnet token balances via contract calls
      if (enhancedTokenRecords) {
        const subnetTokens = Array.from(enhancedTokenRecords.values())
          .filter(record => record.type === 'SUBNET');
          
        for (const subnetRecord of subnetTokens) {
          try {
            const [addr, name] = subnetRecord.contractId.split('.');
            const balanceCV = await callReadOnlyFunction(
              addr!, 
              name!, 
              'get-balance', 
              [principalCV(userId)]
            );
            
            const balance = Number(balanceCV?.value || 0);
            
            if (balance > 0) {
              balanceUpdates[`${userId}:${subnetRecord.contractId}`] = {
                userId,
                contractId: subnetRecord.contractId,
                balance: Number(balance),
                totalSent: '0',
                totalReceived: '0',
                timestamp: Date.now(),
                source: 'subnet-contract-call'
              };
            }
          } catch (error) {
            console.error(`Failed to fetch subnet balance for ${subnetRecord.contractId}:`, error);
          }
        }
      }
    })
  );
  
  return balanceUpdates;
}
```

### 3. Balance Processing and Message Creation

The BalancesParty processes raw balance data and creates separate messages for each token:

```typescript
// src/parties/balances.ts
private async fetchAndBroadcastBalances() {
  const userIds = Array.from(this.watchedUsers);
  const rawBalances = await fetchUserBalances(userIds, this.tokenRecords);
  
  const updatedBalances: WebSocketTokenBalance[] = [];
  
  // Process each raw balance (internally aggregates for efficiency)
  for (const [, balanceData] of Object.entries(rawBalances)) {
    const { userId, contractId } = balanceData;
    
    const tokenRecord = this.findTokenRecord(contractId);
    if (!tokenRecord) continue;
    
    const isSubnet = isSubnetToken(tokenRecord);
    const mainnetContractId = isSubnet ? tokenRecord.base! : tokenRecord.contractId;
    const key = `${userId}:${mainnetContractId}`;
    
    let balance = this.balances.get(key);
    if (!balance) {
      balance = {
        userId,
        mainnetContractId,
        mainnetBalance: 0,
        mainnetTotalSent: '0',
        mainnetTotalReceived: '0',
        lastUpdated: Date.now()
      };
    }
    
    // Update mainnet or subnet portion (internal aggregation)
    if (isSubnet) {
      balance.subnetBalance = balanceData.balance;
      balance.subnetContractId = contractId;
    } else {
      balance.mainnetBalance = balanceData.balance;
      balance.mainnetTotalSent = balanceData.totalSent;
      balance.mainnetTotalReceived = balanceData.totalReceived;
    }
    
    balance.lastUpdated = Date.now();
    this.balances.set(key, balance);
    updatedBalances.push(balance);
  }
  
  // Create separate messages for each token type
  if (updatedBalances.length > 0) {
    const allMessages: BalanceUpdateMessage[] = [];
    for (const balance of updatedBalances) {
      // createBalanceMessage now returns array of separate messages
      allMessages.push(...this.createBalanceMessage(balance));
    }
    
    // Broadcast each message individually
    allMessages.forEach(message => {
      this.room.broadcast(JSON.stringify(message));
    });
    
    // Also send batch for initial loading
    this.room.broadcast(JSON.stringify({
      type: 'BALANCE_BATCH',
      balances: allMessages,
      timestamp: Date.now()
    }));
  }
}
```

## Subnet Token Flow

Subnet tokens are now handled with separate messages for mainnet and subnet balances:

### 1. Detection
```typescript
// Token metadata includes type and base mapping
{
  contractId: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1',
  type: 'SUBNET',
  base: 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'
}
```

### 2. Server-side Processing
```typescript
// Server aggregates internally for efficiency but sends separate messages
interface WebSocketTokenBalance {
  userId: string;
  mainnetContractId: string;
  
  // Mainnet balance
  mainnetBalance: number;
  mainnetTotalSent: string;
  mainnetTotalReceived: string;
  
  // Subnet balance (optional)
  subnetBalance?: number;
  subnetTotalSent?: string;
  subnetTotalReceived?: string;
  subnetContractId?: string;
  
  lastUpdated: number;
}

// createBalanceMessage() returns array of separate messages
private createBalanceMessage(balance: WebSocketTokenBalance): BalanceUpdateMessage[] {
  const messages: BalanceUpdateMessage[] = [];
  
  // Always create mainnet message
  messages.push(createBalanceUpdateMessage(mainnetRecord, balance.userId, mainnetBalance));
  
  // Create separate subnet message if exists
  if (balance.subnetBalance !== undefined && balance.subnetContractId) {
    messages.push(createBalanceUpdateMessage(subnetRecord, balance.userId, subnetBalance));
  }
  
  return messages;
}
```

### 3. Separate Messages Sent to Client
```typescript
// Client receives separate messages for each token type

// Mainnet token message
{
  type: 'BALANCE_UPDATE',
  userId: 'SP...',
  contractId: 'SP...charisma-token',
  balance: 1000000,
  totalSent: '0',
  totalReceived: '1000000',
  formattedBalance: 1.0,
  metadata: { type: 'SIP10', base: null, ... }
}

// Subnet token message (sent separately)
{
  type: 'BALANCE_UPDATE',
  userId: 'SP...',
  contractId: 'SP...charisma-token-subnet-v1',
  balance: 500000,
  totalSent: '0',
  totalReceived: '0',
  formattedBalance: 0.5,
  metadata: { type: 'SUBNET', base: 'SP...charisma-token', ... }
}
```

### 4. Client-side Merging
```typescript
// BlazeProvider merges tokens using token utilities
import { getBalanceKey, isSubnetToken, getTokenFamily } from '../utils/token-utils';

case 'BALANCE_UPDATE':
  const key = getBalanceKey(data.userId, data.contractId, data.metadata);
  const existingBalance = prev[key];
  const isSubnet = isSubnetToken(data.contractId, data.metadata);
  
  const mergedBalance = {
    ...existingBalance,
    // Update core fields only if mainnet OR no existing data
    ...((!isSubnet || !existingBalance?.balance) && {
      balance: String(data.balance),
      formattedBalance: data.formattedBalance
    }),
    // Update subnet fields only if subnet update
    ...(isSubnet && {
      subnetBalance: data.balance,
      formattedSubnetBalance: data.formattedBalance,
      subnetContractId: data.contractId
    })
  };
```

## Error Handling Flow

### 1. API Failures
```typescript
// Graceful degradation for external API issues
try {
  const priceData = await listPrices();
  // Process successful data
} catch (error) {
  console.error('Price fetch failed:', error);
  // Continue with cached data, retry later
}
```

### 2. Client Disconnections
```typescript
// Server cleanup when clients disconnect
onClose(connection: Party.Connection) {
  const clientId = connection.id;
  this.subscriptions.delete(clientId);
  this.cleanupWatchedUsers(); // Remove users no longer watched
}
```

### 3. Message Validation
```typescript
// Validate messages before processing
onMessage(message: string, sender: Party.Connection) {
  try {
    const data = JSON.parse(message);
    // Process valid message
  } catch (error) {
    sender.send(JSON.stringify({ 
      type: 'ERROR', 
      message: 'Invalid message format' 
    }));
  }
}
```

## Performance Optimizations

### 1. Change Detection
- Only broadcast prices that have actually changed
- Compare with last broadcasted values

### 2. Separate Token Messages
- Send individual messages for mainnet and subnet tokens
- Reduce message complexity and enable independent updates
- Client-side merging reduces server memory usage

### 3. Batch Processing
- Process multiple users in parallel with `Promise.allSettled`
- Send both individual and batch balance updates
- Batch contains all separate token messages

### 4. Subscription Management
- Track watched users/tokens efficiently
- Clean up subscriptions when clients disconnect

### 5. Caching
- Cache token metadata to avoid repeated API calls
- Store processed balance data for immediate delivery to new clients
- Internal aggregation for efficiency while sending separate messages

### 6. Rate Limiting
- Use fixed intervals (5 minutes) for API calls
- Implement backoff for API failures