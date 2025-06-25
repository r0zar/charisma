# Script Runner

An elegant TypeScript/JavaScript script runner with automatic environment variable loading.

## Usage

```bash
# List available scripts
pnpm script
pnpm script list

# Run a script
pnpm script <script-name> [args...]

# Run with custom environment variables
CUSTOM_VAR=value pnpm script <script-name>

# Run with arguments
pnpm script test-contract-interface SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token
```

## Environment Variables

The script runner automatically loads environment variables from:

1. `.env.local` (highest priority)
2. `.env.development.local` 
3. `.env.development`
4. `.env` (lowest priority)

### Required Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

- `KV_REST_API_URL` - Vercel KV database URL (required for cache operations)
- `KV_REST_API_TOKEN` - Vercel KV database token (required for cache operations)
- `HIRO_API_KEY` - Optional, for better Stacks API rate limits

## Available Scripts

- `test-contract-interface` - Test contract interface extraction
- `test-token-metadata` - Test full token metadata fetching (requires KV)
- `test-env-and-contract` - Test environment loading and basic contract operations

## Creating New Scripts

1. Create a `.ts` or `.js` file in the `scripts/` directory
2. The script will automatically appear in `pnpm script list`
3. TypeScript files are executed with `tsx` for full type support
4. Environment variables are automatically loaded

### Example Script

```typescript
// scripts/my-test.ts
import { getContractInterface } from '@repo/polyglot';

const contractId = process.argv[2] || 'default.contract';

async function myTest() {
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Testing:', contractId);
    
    // Your script logic here
}

myTest();
```

Then run with:
```bash
pnpm script my-test SP123...contract
```

## Features

- ✅ TypeScript support with `tsx`
- ✅ Automatic environment variable loading
- ✅ Command-line argument passing
- ✅ Auto-discovery of scripts
- ✅ Helpful error messages
- ✅ Full access to project dependencies