# Signet SDK

A lightweight communication library for interacting with the Signet Chrome extension. This SDK provides a simple messaging system for web applications to seamlessly integrate with Signet's wallet and blockchain capabilities.

## Features

- 🔑 **Secure Communication**: Standardized messaging protocol between web apps and the Signet extension
- 📬 **Type-Safe API**: Complete TypeScript support with type definitions for all operations
- 🔌 **Extension Detection**: Helpers to detect if Signet is installed and available
- 💰 **Wallet Integration**: Get balances, create transfers, and manage assets
- 📝 **Transaction Signing**: Support for transfers and prediction market transactions
- 🔄 **Async Messaging**: Promise-based request/response system with timeout handling

## Installation

```bash
npm install signet-sdk
# or
yarn add signet-sdk
# or 
pnpm add signet-sdk
```

## Quick Start

```typescript
import { checkExtensionInstalled, getSignetStatus, getBalance, createTransfer } from 'signet-sdk';

// Check if the Signet extension is installed
const checkExtension = async () => {
  const { installed, version } = await checkExtensionInstalled();
  
  if (installed) {
    console.log(`Signet extension v${version} is installed!`);
    return true;
  } else {
    console.log('Signet extension is not installed');
    return false;
  }
};

// Get the status of all subnets
const checkStatus = async () => {
  const status = await getSignetStatus();
  const subnetIds = Object.keys(status);
  console.log(`Connected to ${subnetIds.length} subnets`);
  return status;
};

// Check balance on a specific subnet
const checkBalance = async (subnetId) => {
  const balances = await getBalance(subnetId);
  console.log(`Balance on ${subnetId}:`, balances);
  return balances;
};

// Create and send a transfer transaction
const sendTransfer = async (subnetId, to, amount) => {
  const result = await createTransfer({
    subnetId,
    to,
    amount,
    nonce: Date.now() // You should get a proper nonce in production
  });
  
  if (result.success) {
    console.log('Transfer successful!', result.transaction);
  } else {
    console.error('Transfer failed:', result.error);
  }
  
  return result;
};

// Initialize app
const initApp = async () => {
  const isInstalled = await checkExtension();
  if (isInstalled) {
    const status = await checkStatus();
    // Continue with app initialization
  }
};

initApp();
```

## Low-Level Messaging API

For advanced use cases, you can use the low-level messaging API:

```typescript
import { send, request, subscribe, MessageType } from 'signet-sdk';

// Send a message without expecting a response
send({
  type: MessageType.GET_STATUS,
  data: null
});

// Send a message and wait for a response
const getStatus = async () => {
  try {
    const response = await request({
      type: MessageType.GET_STATUS,
      data: null
    }, 5000); // 5 second timeout
    
    return response.data;
  } catch (error) {
    console.error('Failed to get status:', error);
    return {};
  }
};

// Subscribe to specific message types
const unsubscribe = subscribe((message) => {
  console.log('Received message:', message);
}, { 
  type: [MessageType.GET_STATUS, MessageType.GET_BALANCE]
});

// Later: clean up subscription
unsubscribe();
```

## API Reference

### Extension Operations

- `checkExtensionInstalled()`: Check if the Signet extension is installed
- `getSignetStatus()`: Get current status of all connected subnets

### Subnet Operations

- `getBalance(subnetId, address?)`: Get balance for a specific subnet
- `getBalances()`: Get balances across all subnets
- `getSubnetIds(status)`: Extract subnet IDs from a status response
- `getSubnetData(status, subnetId)`: Get data for a specific subnet

### Transaction Operations

- `createTransfer(params)`: Create and execute a transfer transaction
- `signPrediction(data)`: Sign a prediction market transaction

### Low-Level Messaging

- `send(message)`: Send a message without expecting a response
- `request(message, timeoutMs?)`: Send a message and wait for a response
- `respond(originalMessage, data?, error?)`: Send a response to a message
- `subscribe(callback, filter?)`: Subscribe to incoming messages
- `cleanup()`: Clean up message listeners and pending responses

## MessageType Enum

The SDK provides a `MessageType` enum for specifying message types:

```typescript
enum MessageType {
  // Status and discovery operations
  CHECK_EXTENSION_INSTALLED = 'check_extension_installed',
  GET_STATUS = 'get_status',

  // Subnet operations
  GET_BALANCE = 'get_balance',
  GET_BALANCES = 'get_balances',

  // Transaction operations
  CREATE_TRANSFER_TX = 'create_transfer_tx',
  SIGN_PREDICTION = 'sign_prediction'
}
```

## Development

For local development:

```bash
# Install dependencies
pnpm install

# Build the SDK
pnpm build

# Watch mode during development
pnpm dev

# Run type checking
pnpm typecheck
```

## License

MIT

## Related Projects

- [Signet Chrome Extension](https://github.com/yourusername/signet-extension) - Chrome extension for Signet
- [Signet Demo App](https://github.com/yourusername/signet-demo) - Example app using the Signet SDK