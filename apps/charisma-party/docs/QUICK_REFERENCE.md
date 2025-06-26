# Balance System Quick Reference

## ⚠️ Critical Field Names

```typescript
// ✅ ALWAYS USE (balances-lib format)
token.type        // NOT token.tokenType
token.base        // NOT token.baseToken

// ❌ NEVER USE (legacy format)
token.tokenType   // WRONG
token.baseToken   // WRONG
```

## 🏗️ Type Imports

```typescript
import type {
  EnhancedTokenRecord,
  WebSocketTokenBalance,
  SubnetBalanceInfo,
  UserBalanceInfo,
  isSubnetToken,
  hasValidBaseMapping,
  TOKEN_TYPES
} from "../types/balance-types";
```

## 🔍 Type Guards

```typescript
// Check if token is subnet
if (isSubnetToken(tokenRecord)) {
  // Process subnet token
}

// Validate subnet mapping
if (!hasValidBaseMapping(subnetToken, allTokens)) {
  console.warn('Invalid subnet mapping');
  return;
}
```

## 📨 Balance Message Creation

```typescript
// ✅ CORRECT: With auto-discovery
const message = createBalanceUpdateMessage(
  mainnetRecord,
  userId,
  balanceInfo,
  tokenRecords,        // Required for auto-discovery
  allBalanceUpdates   // Required for auto-discovery
);

// ❌ WRONG: Missing auto-discovery parameters
const message = createBalanceUpdateMessage(
  mainnetRecord,
  userId,
  balanceInfo
);
```

## 🎯 Common Patterns

### Subnet Detection
```typescript
const isSubnet = isSubnetToken(tokenRecord);
const mainnetContractId = isSubnet ? tokenRecord.base! : tokenRecord.contractId;
```

### Balance Merging
```typescript
if (isSubnet) {
  balance.subnetBalance = balanceData.balance;
  balance.subnetContractId = contractId;
} else {
  balance.mainnetBalance = balanceData.balance;
}
```

## 📁 File Locations

- **Types**: `/src/types/balance-types.ts`
- **Core Logic**: `/src/balances-lib.ts`
- **Websocket**: `/src/parties/balances.ts`
- **Architecture**: `/docs/BALANCE_ARCHITECTURE.md`

## 🧪 Testing

```bash
pnpm run script test-websocket-refactor
```

## 🚨 Common Mistakes

1. Using `tokenType` instead of `type`
2. Using `baseToken` instead of `base`
3. Not passing auto-discovery parameters
4. Manual subnet lookup instead of using auto-discovery
5. Missing type imports