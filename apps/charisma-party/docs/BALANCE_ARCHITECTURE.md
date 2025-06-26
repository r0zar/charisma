# Balance Architecture Documentation

This document explains the balance data flow and architecture in the Charisma Party websocket system to prevent future confusion and ensure consistent implementation.

## Overview

The balance system consists of three main components:
1. **Raw Balance Fetching** (`balances-lib.ts`) - Fetches balances from APIs
2. **Websocket Processing** (`parties/balances.ts`) - Processes and broadcasts balance updates
3. **Auto-Discovery Logic** (`balances-lib.ts`) - Automatically links subnet balances to mainnet tokens

## Critical Field Name Conventions

**⚠️ IMPORTANT**: Use these exact field names to prevent confusion:

```typescript
// ✅ CORRECT (balances-lib format)
interface EnhancedTokenRecord {
  type: 'SIP10' | 'SUBNET' | 'LP';  // NOT 'tokenType'
  base?: string;                    // NOT 'baseToken'
}

// ❌ WRONG (legacy websocket format)
interface LegacyFormat {
  tokenType: string;  // This was causing bugs
  baseToken?: string; // This was causing bugs
}
```

## Data Flow Architecture

```
1. Raw API Data (Hiro API + Subnet Contracts)
   ↓
2. fetchUserBalances() → RawBalanceData[]
   ↓
3. Websocket Processing → WebSocketTokenBalance (merged mainnet+subnet)
   ↓
4. Auto-Discovery Logic → createBalanceUpdateMessage()
   ↓
5. Client Apps → BalanceUpdateMessage with subnet fields
```

## Type Definitions

All types are defined in `/src/types/balance-types.ts`:

### Core Types

- **`RawBalanceData`** - Direct API response format
- **`WebSocketTokenBalance`** - Internal websocket storage (one per mainnet token per user)
- **`EnhancedTokenRecord`** - Token metadata with price data and mappings
- **`BalancesLibFormat`** - Format expected by auto-discovery logic
- **`SubnetBalanceInfo`** - Subnet balance details for message creation
- **`UserBalanceInfo`** - User balance details for message creation

### Key Interfaces

```typescript
// Internal websocket storage - ONE entry per mainnet token per user
interface WebSocketTokenBalance {
  userId: string;
  mainnetContractId: string;  // Always the mainnet contract
  mainnetBalance: number;
  mainnetTotalSent: string;
  mainnetTotalReceived: string;
  subnetBalance?: number;     // Optional subnet data
  subnetTotalSent?: string;
  subnetTotalReceived?: string;
  subnetContractId?: string;
  lastUpdated: number;
}

// Enhanced token metadata - CRITICAL field names
interface EnhancedTokenRecord {
  type: 'SIP10' | 'SUBNET' | 'LP';  // ✅ Use 'type' NOT 'tokenType'
  base?: string;                    // ✅ Use 'base' NOT 'baseToken'
  // ... other fields
}
```

## Subnet Token Mapping Logic

### 1. Known Mappings (Fallback)
```typescript
const KNOWN_SUBNET_MAPPINGS = new Map([
  ['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1', 
   'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'],
  // ... other mappings
]);
```

### 2. Auto-Discovery (Primary)
The `createBalanceUpdateMessage()` function automatically discovers subnet balances:

```typescript
// If mainnet token has no subnet data, auto-discovery will:
// 1. Look through all tokens for type === 'SUBNET'
// 2. Find subnet token where base === mainnetToken.contractId
// 3. Look up subnet balance in allBalanceUpdates
// 4. Attach subnet fields to the message
```

## Websocket Processing Flow

### 1. Balance Fetching
```typescript
const rawBalances = await fetchUserBalances(userIds, tokenRecords);
// Returns: Record<string, RawBalanceData>
// Key format: `${userId}:${contractId}`
```

### 2. Balance Merging
```typescript
// Process each raw balance
for (const balanceData of rawBalances) {
  const isSubnet = isSubnetToken(tokenRecord);
  const mainnetContractId = isSubnet ? tokenRecord.base! : tokenRecord.contractId;
  const key = `${userId}:${mainnetContractId}`;
  
  // Get or create merged balance entry
  let balance = this.balances.get(key) || createNewBalance();
  
  // Update appropriate portion
  if (isSubnet) {
    balance.subnetBalance = balanceData.balance;
    balance.subnetContractId = contractId;
  } else {
    balance.mainnetBalance = balanceData.balance;
  }
}
```

### 3. Message Creation
```typescript
// Use auto-discovery for complete subnet integration
const message = createBalanceUpdateMessage(
  mainnetRecord,
  userId,
  mainnetBalance,
  this.tokenRecords,           // For auto-discovery
  this.createAllBalanceUpdatesMap(), // For auto-discovery
  subnetBalanceInfo           // Manual override (optional)
);
```

## Type Guards and Utilities

```typescript
// Check if token is subnet
function isSubnetToken(token: EnhancedTokenRecord): boolean {
  return token.type === 'SUBNET';
}

// Check if subnet has valid base mapping
function hasValidBaseMapping(
  subnetToken: EnhancedTokenRecord,
  allTokens: Map<string, EnhancedTokenRecord>
): boolean {
  return isSubnetToken(subnetToken) && 
         !!subnetToken.base && 
         allTokens.has(subnetToken.base);
}
```

## Common Patterns

### ✅ Correct Implementation
```typescript
// Check token type
if (isSubnetToken(tokenRecord)) {
  // Process subnet token
}

// Validate subnet mapping
if (!hasValidBaseMapping(subnetToken, allTokens)) {
  console.warn('Invalid subnet mapping');
  return;
}

// Create balance message with auto-discovery
const message = createBalanceUpdateMessage(
  mainnetRecord,
  userId,
  balanceInfo,
  tokenRecords,        // Required for auto-discovery
  allBalanceUpdates   // Required for auto-discovery
);
```

### ❌ Common Mistakes
```typescript
// DON'T use legacy field names
if (tokenRecord.tokenType === 'SUBNET') { } // Wrong!
if (tokenRecord.baseToken) { }              // Wrong!

// DON'T skip auto-discovery parameters
const message = createBalanceUpdateMessage(
  mainnetRecord,
  userId,
  balanceInfo
  // Missing tokenRecords and allBalanceUpdates!
);

// DON'T manually implement subnet lookup
for (const record of allTokens) {
  if (record.type === 'SUBNET' && record.base === mainnetId) {
    // This logic already exists in auto-discovery!
  }
}
```

## Testing Strategy

Always test the complete flow:

1. **Unit Tests** - Test individual functions with known data
2. **Integration Tests** - Test websocket processing with real API data  
3. **End-to-End Tests** - Verify client apps receive correct subnet fields

### Example Test Pattern
```typescript
// Test that auto-discovery works in websocket flow
const testParty = new TestBalancesParty();
await testParty.processUserBalances(userId);
const message = testParty.createBalanceMessage(balance);

// Verify subnet fields are populated
expect(message.subnetBalance).toBeDefined();
expect(message.formattedSubnetBalance).toBeGreaterThan(0);
expect(message.subnetContractId).toContain('subnet');
```

## Debugging Tips

### Check Field Names
```typescript
console.log('Token type:', token.type);      // ✅ Should work
console.log('Token type:', token.tokenType); // ❌ Will be undefined
```

### Verify Auto-Discovery Parameters
```typescript
// Make sure these are passed to createBalanceUpdateMessage
console.log('Token records size:', tokenRecords.size);
console.log('Balance updates count:', Object.keys(allBalanceUpdates).length);
```

### Trace Subnet Mapping
```typescript
// Debug subnet token relationships
subnetTokens.forEach(token => {
  console.log(`${token.symbol} (${token.contractId}) → base: ${token.base}`);
});
```

## Future Considerations

1. **Type Safety** - The type definitions prevent field name confusion
2. **Extensibility** - Auto-discovery works for any new subnet tokens
3. **Performance** - Cached mappings reduce lookup overhead
4. **Maintainability** - Clear separation between manual and auto logic

## Migration Notes

When updating existing code:

1. Replace `tokenType` → `type`
2. Replace `baseToken` → `base`  
3. Use type guards instead of string comparisons
4. Always pass auto-discovery parameters to `createBalanceUpdateMessage`
5. Import types from `/src/types/balance-types.ts`