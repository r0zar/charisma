# @modules/contracts

Trait-based TypeScript wrappers for Stacks smart contracts with 1:1 function mappings.

## Overview

This package provides TypeScript classes that mirror Clarity smart contract traits, offering type-safe access to contract functions with intelligent abstractions.

## Architecture

### Trait System
- **SIP010**: Standard fungible token interface
- **Vault**: Shared interface for Sublinks and LiquidityPools  
- **SubnetToken**: Extends SIP010 with subnet-specific functions
- **BlazeVerifier**: Intent verification and execution

### Contract Classes
- **Token**: Implements SIP010 trait
- **SubnetTokenImpl**: Implements SubnetToken trait
- **Sublink**: Implements Vault trait (bridge contracts)
- **LiquidityPool**: Implements Vault trait (AMM pools)
- **BlazeContract**: Implements BlazeVerifier trait

## Usage

### Basic Token Operations
```typescript
import { ContractFactory } from '@modules/contracts';

// Create token instance with auto-detection
const token = await ContractFactory.createToken('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token');

// Use SIP-010 functions
const balance = await token.getBalance(address);
const formattedBalance = token.formatBalance(balance);
console.log(`Balance: ${formattedBalance} ${token.symbol}`);
```

### Subnet Token Operations
```typescript
// Auto-detected as SubnetTokenImpl if metadata indicates SUBNET type
const subnetToken = await ContractFactory.createToken('SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1');

if (ContractFactory.isSubnetToken(subnetToken)) {
  // Subnet-specific operations
  await subnetToken.deposit('1000000');
  await subnetToken.xTransfer(signature, amount, uuid, recipient);
}
```

### Vault Operations (Polymorphic)
```typescript
// Works for both Sublinks and LiquidityPools
const vault = await ContractFactory.createVault(contractId);

// Common vault operations
const quote = await vault.quote('1000000');
const result = await vault.execute('1000000', '0x05');

// Type-specific operations
if (ContractFactory.isSublink(vault)) {
  await vault.deposit('1000000', recipient);
} else if (ContractFactory.isLiquidityPool(vault)) {
  await vault.addLiquidity('1000000', '2000000');
}
```

### Intent-Based Operations
```typescript
const blaze = ContractFactory.getDefaultBlazeContract();

// Generate intent hash
const hash = await blaze.hash(
  subnetContract,
  'TRANSFER_TOKENS',
  undefined,
  '1000000',
  recipient,
  uuid
);

// Verify signature
const isValid = await blaze.verifyIntent(intentData, signature);
```

## Features

- **1:1 Contract Mapping**: Each function maps directly to contract functions
- **Type Safety**: Full TypeScript coverage with trait compliance
- **Smart Factory**: Auto-detection of contract types
- **Caching**: Instance caching for performance
- **Utilities**: Balance formatting, validation, constants
- **Error Handling**: Graceful fallbacks and validation

## Dependencies

- `@repo/polyglot`: Blockchain API access
- `@repo/tokens`: Token metadata integration