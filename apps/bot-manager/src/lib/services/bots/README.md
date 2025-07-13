# BotService User Manual

## Quick Start

```typescript
import { botService } from './core/service';

// The service is a singleton - use the exported instance
const bot = await botService.getBot('bot-id');
```

## Prerequisites

- **Authentication**: Requires active Clerk session
- **Configuration**: `ENABLE_API_BOTS` must be `true`
- **Storage**: Vercel KV must be configured

## Core Operations

### Creating Bots

**Example 1: Basic Bot (No Repository)**
```typescript
const pikachuBot = await botService.createBot({
  name: 'Pikachu',
  strategy: `
    console.log('⚡ Pikachu bot starting up!');
    
    try {
      // Access bot context (available in all execution environments)
      console.log('Bot ID:', bot.id);
      console.log('Bot Name:', bot.name);
      
      // Simple logic using built-in Node.js APIs
      const timestamp = new Date().toISOString();
      const decision = Math.random() > 0.5 ? 'ATTACK' : 'DEFEND';
      
      console.log(\`Pikachu decision at \${timestamp}: \${decision}\`);
      
      return {
        success: true,
        message: \`Pikachu used \${decision}! It was super effective!\`
      };
    } catch (error) {
      return {
        success: false,
        message: \`Pikachu fainted: \${error.message}\`
      };
    }
  `
});
```

**Example 2: Advanced Bot with Monorepo Dependencies**
```typescript
const advancedBot = await botService.createBot({
  name: 'Advanced Trading Bot',
  strategy: `
    // Import @stacks/transactions directly
    const { makeContractCall, broadcastTransaction } = require('@stacks/transactions');
    
    console.log('🚀 Advanced bot initializing...');
    
    try {
      // Use bot context for wallet credentials
      const transaction = await makeContractCall({
        contractAddress: 'SPGYCP878RYFVT03ZT8TWGPKNYTSQB1578VVXHGE',
        contractName: 'powerful-farmer',
        functionName: 'execute-both',
        functionArgs: [],
        postConditionMode: 'allow',
        senderKey: bot.walletCredentials.privateKey
      });
      
      const result = await broadcastTransaction({ transaction });
      console.log('Success! Transaction ID:', result.txid);
      
      return {
        success: true,
        message: \`Transaction executed: \${result.txid}\`
      };
    } catch (error) {
      return {
        success: false,
        message: \`Strategy failed: \${error.message}\`
      };
    }
  `,
  gitRepository: 'https://github.com/r0zar/charisma',
  isMonorepo: true,
  packagePath: 'bots/basic'
});
```

### Retrieving Bots
```typescript
// Get single bot with execution data
const bot = await botService.getBot('bot-id', {
  includeExecutions: true,
  executionLimit: 50
});

// List user's bots
const userBots = await botService.listBots({
  ownerId: 'user-id',
  includeStateInfo: true
});
```

### Updating Bots
```typescript
// ⚠️ IMPORTANT: Use transitionAction for status changes
const updatedBot = await botService.updateBot('bot-id', {
  name: 'Updated Name',
  transitionAction: 'start',
  transitionReason: 'Manual start'
});

// ❌ DON'T: Direct status changes will throw errors
// status: 'running' // This will fail
```

### Deleting Bots
```typescript
await botService.deleteBot('bot-id');
```

## State Management

### Valid State Transitions
Use `transitionAction` parameter, not direct `status` changes:

- `start` - Begin bot execution
- `pause` - Temporarily halt execution
- `stop` - Permanently stop execution
- `reset` - Reset to initial state
- `reactivate` - Reactivate stopped bot

### State Machine Integration
```typescript
// Check available actions before attempting transitions
const bot = await botService.getBot('bot-id');
if (bot?.schedulingInfo?.canExecute) {
  await botService.updateBot('bot-id', {
    transitionAction: 'start'
  });
}
```

## Authentication & Ownership

- All operations require authenticated Clerk session
- Users can only access bots they own
- Ownership is validated on every operation
- Authentication failures return `null` instead of throwing

## Performance Considerations

### Selective Data Loading
```typescript
// Lightweight - basic bot data only
const bot = await botService.getBot('bot-id', {
  includeExecutions: false
});

// Full data - includes execution stats and logs
const enrichedBot = await botService.getBot('bot-id', {
  includeExecutions: true,
  executionLimit: 100
});
```

### Batch Operations
```typescript
// List multiple bots efficiently
const bots = await botService.listBots({
  limit: 20,
  includeStateInfo: true,
  includeExecutions: false // Skip heavy execution data for lists
});
```

## Error Handling

### Expected Patterns
```typescript
try {
  const bot = await botService.updateBot('bot-id', {
    transitionAction: 'invalid-action'
  });
} catch (error) {
  // Handle specific errors:
  // - Authentication failures
  // - Ownership violations  
  // - Invalid state transitions
  // - Validation errors
}
```

### Null Returns
Many methods return `null` on failure instead of throwing:
```typescript
const bot = await botService.getBot('nonexistent-id');
if (!bot) {
  // Handle bot not found or access denied
}
```

## Common Anti-Patterns

❌ **Don't modify status directly**
```typescript
// This will throw an error
await botService.updateBot('bot-id', { status: 'running' });
```

❌ **Don't bypass ownership validation**
```typescript
// Service automatically validates ownership - don't try to circumvent
```

❌ **Don't assume bot existence**
```typescript
// Always check for null returns
const bot = await botService.getBot('bot-id');
if (bot) {
  // Safe to use bot
}
```

## Configuration

### Feature Flag
The service respects the `ENABLE_API_BOTS` configuration:
```typescript
if (!botService.useKV) {
  // Service is in read-only mode
  // Create/update/delete operations will fail
}
```

### Dependencies
- `@vercel/kv` - Primary storage
- `@clerk/nextjs/server` - Authentication
- `zod` - Data validation
- `BotStateMachine` - State management
- `executionDataStore` - Execution tracking