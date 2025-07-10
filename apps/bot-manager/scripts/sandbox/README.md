# Bot Strategy Sandbox Examples

This directory contains TypeScript example strategies for the bot manager sandbox execution environment.

## Available Examples

### 1. **minimal-example.ts** - Simplest Possible Strategy
Basic example showing how to access bot context and execute a simple trade.

### 2. **beginner-guide.ts** - Step-by-Step Guide
Comprehensive guide for new users showing all basic bot operations with explanations.

### 3. **simple-example.ts** - Real-World Basic Strategy
Practical example with balance checks, error handling, and multiple operations.

### 4. **simple-test-strategy.ts** - Testing Template
Template for testing bot functionality with structured logging and return values.

### 5. **example-strategy.ts** - Advanced Strategy
Full-featured strategy example with:
- DCA (Dollar Cost Averaging)
- Yield farming
- Error handling
- Detailed logging
- Proper TypeScript types

## Key Features

- **Full TypeScript Support**: All examples use proper TypeScript types
- **Global Bot Context**: The `bot` object is available globally with full typing
- **Async/Await**: All trading operations use async/await patterns
- **Error Handling**: Examples show proper error handling patterns
- **Logging**: Console.log statements for debugging and monitoring

## Bot Context API

The `bot` object provides these methods:

```typescript
// Basic info
bot.name: string
bot.id: string
bot.wallet_address: string
bot.balance: { [token: string]: number }

// Trading methods
await bot.swap(fromToken: string, toToken: string, amount: number, slippage?: number)
await bot.addLiquidity(token1: string, token2: string, amount1: number, amount2: number, slippage?: number)
await bot.stake(pool: string, amount: number)
await bot.claimRewards(pool: string)
```

## Running Examples

Execute any example strategy:

```bash
# Run minimal example
pnpm tsx scripts/sandbox/minimal-example.ts

# Run beginner guide
pnpm tsx scripts/sandbox/beginner-guide.ts

# Run advanced strategy
pnpm tsx scripts/sandbox/example-strategy.ts
```

## Creating Your Own Strategy

1. Copy one of the existing examples
2. Modify the trading logic to fit your needs
3. Test with the sandbox environment
4. Deploy to your bot when ready

## Type Safety

All examples include proper TypeScript types from `@/types/sandbox` for:
- `BotContext` - The bot object interface
- `StrategyResult` - Return value structure
- `Trade` - Individual trade records
- Various trading operation result types