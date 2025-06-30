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
  type: 'BALANCE_UPDATE';
  userId: string;
  contractId: string;
  
  // Mainnet balance
  balance: number;
  totalSent: string;
  totalReceived: string;
  formattedBalance: number;
  
  // Subnet balance (optional)
  subnetBalance?: number;
  formattedSubnetBalance?: number;
  subnetContractId?: string;
  
  // Complete token metadata
  metadata: TokenMetadata;
  
  timestamp: number;
  source: string;
}
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
  const { balances, _subscribeToUserBalances, _unsubscribeFromUserBalances } = useBlaze();
  
  useEffect(() => {
    if (userId) {
      _subscribeToUserBalances(userId);
      
      return () => {
        _unsubscribeFromUserBalances();
      };
    }
  }, [userId, _subscribeToUserBalances, _unsubscribeFromUserBalances]);
  
  const userBalances = Object.values(balances).filter(b => b.userId === userId);
  
  return (
    <div>
      <h3>Balances for {userId}</h3>
      {userBalances.map((balance) => (
        <div key={balance.contractId}>
          <strong>{balance.metadata.symbol}</strong>: {balance.formattedBalance}
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

### Balance Portfolio
```tsx
function PortfolioValue({ userId }: { userId: string }) {
  const { balances, metadata } = useBlaze();
  
  const userBalances = Object.values(balances).filter(b => b.userId === userId);
  
  const totalValue = userBalances.reduce((sum, balance) => {
    const meta = metadata[balance.contractId];
    if (!meta?.price) return sum;
    
    const totalBalance = balance.formattedBalance + (balance.formattedSubnetBalance || 0);
    return sum + (totalBalance * meta.price);
  }, 0);
  
  return (
    <div className="portfolio">
      <h3>Portfolio Value: ${totalValue.toFixed(2)}</h3>
      <div className="breakdown">
        {userBalances.map(balance => {
          const meta = metadata[balance.contractId];
          const totalBalance = balance.formattedBalance + (balance.formattedSubnetBalance || 0);
          const value = totalBalance * (meta?.price || 0);
          
          return (
            <div key={balance.contractId} className="balance-row">
              <span>{meta?.symbol || balance.contractId}</span>
              <span>{totalBalance} tokens</span>
              <span>${value.toFixed(2)}</span>
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