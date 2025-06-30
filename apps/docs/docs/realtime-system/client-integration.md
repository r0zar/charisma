---
sidebar_position: 3  
title: Client Integration
---

# Client Integration

The BlazeProvider offers a seamless React integration for real-time price and balance data.

## Setup

### 1. Install Dependencies

```bash
npm install blaze-sdk partysocket
```

### 2. Wrap Your App

```tsx
import { BlazeProvider } from 'blaze-sdk/realtime';

function App() {
  return (
    <BlazeProvider host="localhost:1999">
      <YourComponents />
    </BlazeProvider>
  );
}
```

### 3. Use the Hook

```tsx
import { useBlaze } from 'blaze-sdk/realtime';

function TokenPrice({ contractId }: { contractId: string }) {
  const { prices, isConnected } = useBlaze();
  
  const price = prices[contractId];
  
  if (!isConnected) {
    return <div>Connecting...</div>;
  }
  
  if (!price) {
    return <div>Price not available</div>;
  }
  
  return (
    <div>
      <span>{price.contractId}: ${price.price}</span>
      <small>Updated {new Date(price.timestamp).toLocaleTimeString()}</small>
    </div>
  );
}
```

## BlazeProvider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children` | `ReactNode` | - | Child components |
| `host` | `string` | Auto-detected | WebSocket server host |

### Host Detection
- **Development**: `localhost:1999` (when hostname is localhost)
- **Production**: `charisma-party.r0zar.partykit.dev`
- **Custom**: Override with `host` prop

## useBlaze Hook

The `useBlaze` hook provides access to real-time data and connection status.

### Return Value

```typescript
interface BlazeData {
  // Real-time data
  prices: Record<string, PriceData>;
  balances: Record<string, BalanceData>;
  metadata: Record<string, TokenMetadata>;
  
  // Connection status
  isConnected: boolean;
  lastUpdate: number;
  initialPricesLoaded: boolean;
  
  // Internal methods (used by BlazeProvider)
  _subscribeToUserBalances: (userId: string) => void;
  _unsubscribeFromUserBalances: () => void;
}
```

### Data Types

#### PriceData
```typescript
interface PriceData {
  type: 'PRICE_UPDATE';
  contractId: string;
  price: number;
  timestamp: number;
  source?: string;
}
```

#### BalanceData
```typescript
interface BalanceData {
  // User and contract identification
  userId?: string;
  contractId?: string;
  
  // Balance information
  balance: string;  // Raw balance as string
  totalSent: string;
  totalReceived: string;
  formattedBalance: number;  // Formatted with decimals
  timestamp: number;
  source: string;  // 'hiro-api' | 'subnet-contract-call' | 'realtime'
  
  // Subnet balance data (merged by client from separate messages)
  subnetBalance?: number;
  formattedSubnetBalance?: number;
  subnetContractId?: string;
  
  // Token metadata (structured)
  metadata: TokenMetadata;
  
  // Legacy fields (for backward compatibility)
  name?: string;
  symbol?: string;
  decimals?: number;
  description?: string | null;
  image?: string | null;
  total_supply?: string | null;
  type?: string;
  identifier?: string;
  token_uri?: string | null;
  lastUpdated?: number;
  tokenAContract?: string | null;
  tokenBContract?: string | null;
  lpRebatePercent?: number | null;
  externalPoolId?: string | null;
  engineContractId?: string | null;
  base?: string | null;
}

// Note: The server sends separate BALANCE_UPDATE messages for mainnet and subnet tokens.
// BlazeProvider automatically merges them using token utilities to create this unified structure.
```

#### Message Flow Architecture

```typescript
// Server sends separate messages:
// 1. Mainnet token message
{
  type: 'BALANCE_UPDATE',
  contractId: 'SP...charisma-token',
  balance: 1000000,
  metadata: { type: 'SIP10', base: null }
}

// 2. Subnet token message (sent separately)
{
  type: 'BALANCE_UPDATE', 
  contractId: 'SP...charisma-token-subnet-v1',
  balance: 500000,
  metadata: { type: 'SUBNET', base: 'SP...charisma-token' }
}

// Client (BlazeProvider) merges them automatically into single balance object
// using getBalanceKey() and token family detection
```

#### TokenMetadata
```typescript
interface TokenMetadata {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  type: string;
  identifier: string;
  description?: string | null;
  image?: string | null;
  token_uri?: string | null;
  total_supply?: string | null;
  lastUpdated?: number | null;
  verified?: boolean;
  
  // Price data
  price?: number | null;
  change1h?: number | null;
  change24h?: number | null;
  change7d?: number | null;
  marketCap?: number | null;
  
  // LP token data
  tokenAContract?: string | null;
  tokenBContract?: string | null;
  lpRebatePercent?: number | null;
  externalPoolId?: string | null;
  engineContractId?: string | null;
  
  // Subnet mapping
  base?: string | null;
}
```

## User Balance Subscriptions

To receive balance updates for a specific user, use the internal subscription methods:

```tsx
import { useBlaze } from 'blaze-sdk/realtime';
import { useEffect } from 'react';

function UserBalances({ userId }: { userId: string }) {
  const { getUserBalances, _subscribeToUserBalances, _unsubscribeFromUserBalances } = useBlaze();
  
  useEffect(() => {
    if (userId) {
      _subscribeToUserBalances(userId);
      
      return () => {
        _unsubscribeFromUserBalances();
      };
    }
  }, [userId, _subscribeToUserBalances, _unsubscribeFromUserBalances]);
  
  // Use getUserBalances helper for cleaner access
  const userBalances = getUserBalances(userId);
  
  return (
    <div>
      <h3>Balances for {userId}</h3>
      {Object.entries(userBalances).map(([contractId, balance]) => (
        <div key={contractId}>
          <strong>{balance.metadata?.symbol || balance.symbol}</strong>: {balance.formattedBalance}
          {balance.subnetBalance && (
            <span> (+{balance.formattedSubnetBalance} on subnet)</span>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Connection Management

### Connection Status
```tsx
function ConnectionStatus() {
  const { isConnected, lastUpdate } = useBlaze();
  
  return (
    <div className={isConnected ? 'connected' : 'disconnected'}>
      {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      <small>Last update: {new Date(lastUpdate).toLocaleTimeString()}</small>
    </div>
  );
}
```

### Loading States
```tsx
function PriceDisplay({ contractId }: { contractId: string }) {
  const { prices, initialPricesLoaded, isConnected } = useBlaze();
  
  if (!isConnected) {
    return <div>Connecting to price feed...</div>;
  }
  
  if (!initialPricesLoaded) {
    return <div>Loading initial prices...</div>;
  }
  
  const price = prices[contractId];
  if (!price) {
    return <div>Price not available for {contractId}</div>;
  }
  
  return <div>${price.price}</div>;
}
```

## Advanced Usage

### Real-time Balance Monitoring

Monitor balance changes with automatic subnet merging:

```tsx
import { useBlaze } from 'blaze-sdk/realtime';
import { useEffect } from 'react';

function BalanceMonitor({ userId, contractId }: { userId: string; contractId: string }) {
  const { getBalance, lastUpdate } = useBlaze();
  
  const balance = getBalance(userId, contractId);
  
  useEffect(() => {
    if (balance) {
      console.log(`Balance updated for ${contractId}:`, balance.formattedBalance);
      
      // Handle subnet balance if present (merged automatically)
      if (balance.subnetBalance) {
        console.log(`Subnet balance (auto-merged):`, balance.formattedSubnetBalance);
        console.log(`Subnet contract:`, balance.subnetContractId);
      }
    }
  }, [balance, lastUpdate]); // Re-run when balance or lastUpdate changes
  
  return (
    <div>
      {balance ? (
        <div>
          <p>Mainnet: {balance.formattedBalance} {balance.metadata?.symbol || balance.symbol}</p>
          {balance.subnetBalance && (
            <p>Subnet: {balance.formattedSubnetBalance} {balance.metadata?.symbol || balance.symbol}</p>
          )}
          <p>Total: {balance.formattedBalance + (balance.formattedSubnetBalance || 0)}</p>
          <small>Last updated: {new Date(balance.timestamp).toLocaleTimeString()}</small>
        </div>
      ) : (
        <p>No balance data</p>
      )}
    </div>
  );
}
```

### Multiple Token Prices
```tsx
function TokenPriceGrid({ contractIds }: { contractIds: string[] }) {
  const { prices } = useBlaze();
  
  return (
    <div className="price-grid">
      {contractIds.map(contractId => {
        const price = prices[contractId];
        return (
          <div key={contractId} className="price-card">
            <h4>{contractId}</h4>
            {price ? (
              <span>${price.price}</span>
            ) : (
              <span>Loading...</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

### Price Change Indicators
```tsx
function PriceWithChange({ contractId }: { contractId: string }) {
  const { prices, metadata } = useBlaze();
  
  const price = prices[contractId];
  const meta = metadata[contractId];
  
  if (!price || !meta) return null;
  
  const change24h = meta.change24h || 0;
  const isPositive = change24h >= 0;
  
  return (
    <div className="price-display">
      <span className="price">${price.price}</span>
      <span className={`change ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? '+' : ''}{change24h.toFixed(2)}%
      </span>
    </div>
  );
}
```

### Understanding Token Merging

BlazeProvider automatically merges mainnet and subnet tokens using token utilities:

```typescript
// Token utilities handle complex balance key generation
import { getBalanceKey, isSubnetToken, getTokenFamily } from 'blaze-sdk/realtime/utils';

// Examples:
getBalanceKey('SP...user', 'SP...charisma-token') 
// → 'SP...user:SP...charisma-token'

getBalanceKey('SP...user', 'SP...charisma-token-subnet-v1', { base: 'SP...charisma-token' })
// → 'SP...user:SP...charisma-token' (uses base contract for key)

isSubnetToken('SP...charisma-token-subnet-v1', { type: 'SUBNET' })
// → true

getTokenFamily('SP...charisma-token-subnet-v1', { base: 'SP...charisma-token' })
// → { baseContractId: 'SP...charisma-token', isSubnet: true }
```

### Balance Portfolio
```tsx
function PortfolioValue({ userId }: { userId: string }) {
  const { getUserBalances, metadata } = useBlaze();
  
  // Use getUserBalances helper for cleaner access
  const userBalances = getUserBalances(userId);
  
  const totalValue = Object.values(userBalances).reduce((sum, balance) => {
    const meta = balance.metadata || metadata[balance.contractId!];
    if (!meta?.price) return sum;
    
    // Subnet balances are automatically merged by BlazeProvider
    const totalBalance = balance.formattedBalance + (balance.formattedSubnetBalance || 0);
    return sum + (totalBalance * meta.price);
  }, 0);
  
  return (
    <div className="portfolio">
      <h3>Portfolio Value: ${totalValue.toFixed(2)}</h3>
      <div className="breakdown">
        {Object.entries(userBalances).map(([contractId, balance]) => {
          const meta = balance.metadata || metadata[contractId];
          const totalBalance = balance.formattedBalance + (balance.formattedSubnetBalance || 0);
          const value = totalBalance * (meta?.price || 0);
          
          return (
            <div key={contractId} className="balance-row">
              <span>{meta?.symbol || balance.symbol}</span>
              <span>{totalBalance} tokens</span>
              <span>${value.toFixed(2)}</span>
              {balance.subnetBalance && (
                <small>({balance.formattedBalance} mainnet + {balance.formattedSubnetBalance} subnet)</small>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

## Error Handling

The BlazeProvider handles reconnection automatically, but you can monitor connection health:

```tsx
function RealtimeDataWrapper({ children }: { children: React.ReactNode }) {
  const { isConnected, lastUpdate } = useBlaze();
  
  // Show warning if data is stale (>10 minutes)
  const isStale = Date.now() - lastUpdate > 10 * 60 * 1000;
  
  return (
    <div>
      {isStale && (
        <div className="warning">
          ⚠️ Price data may be outdated
        </div>
      )}
      
      {!isConnected && (
        <div className="warning">
          🔄 Reconnecting to real-time data...
        </div>
      )}
      
      {children}
    </div>
  );
}
```

## Performance Considerations

1. **Subscription Management** - Only subscribe to balances when needed
2. **Data Filtering** - Filter data at component level to avoid unnecessary renders
3. **Memoization** - Use `useMemo` for expensive calculations
4. **Connection Sharing** - Single BlazeProvider per app to share connections

```tsx
import { useMemo } from 'react';

function OptimizedTokenList({ contractIds }: { contractIds: string[] }) {
  const { prices, metadata } = useBlaze();
  
  // Memoize filtered and sorted data
  const sortedTokens = useMemo(() => {
    return contractIds
      .map(id => ({ id, price: prices[id], meta: metadata[id] }))
      .filter(token => token.price && token.meta)
      .sort((a, b) => (b.meta?.marketCap || 0) - (a.meta?.marketCap || 0));
  }, [contractIds, prices, metadata]);
  
  return (
    <div>
      {sortedTokens.map(token => (
        <TokenCard key={token.id} {...token} />
      ))}
    </div>
  );
}
```