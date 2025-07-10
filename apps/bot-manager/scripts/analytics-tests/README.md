# Analytics System Testing Suite

This directory contains organized tests to debug and verify the analytics system functionality.

## Directory Structure

```
analytics-tests/
├── 01-dependencies/          # Test core external dependencies
├── 02-engine-components/     # Test analytics engine functions
├── 03-client/               # Test analytics client functionality
├── 04-integration/          # Test end-to-end integration
└── README.md               # This file
```

## Test Phases

### Phase 1: Dependencies (`01-dependencies/`)
Tests for external dependencies and environment setup:
- **test-polyglot.ts**: Test `@repo/polyglot` getTransactionEvents function
- **test-tokens.ts**: Test `@repo/tokens` getPrices function  
- **test-env.ts**: Test environment variables and KV cache setup

### Phase 2: Engine Components (`02-engine-components/`)
Tests for individual analytics engine functions:
- **test-transaction-processing.ts**: Test transaction event processing
- **test-performance-calc.ts**: Test performance metrics calculations
- **test-portfolio.ts**: Test portfolio holdings calculations

### Phase 3: Client (`03-client/`)
Tests for analytics client functionality:
- **test-client-init.ts**: Test AnalyticsClient initialization
- **test-direct-calls.ts**: Test client methods with mock data

### Phase 4: Integration (`04-integration/`)
Tests for full system integration:
- **test-end-to-end.ts**: Test complete analytics pipeline
- **test-context.ts**: Test module resolution in different contexts

## Running Tests

### Run individual tests:
```bash
node --import tsx scripts/analytics-tests/01-dependencies/test-polyglot.ts
```

### Run all tests in a phase:
```bash
# Run all dependency tests
for file in scripts/analytics-tests/01-dependencies/*.ts; do
  echo "Running $file..."
  node --import tsx "$file"
done
```

### Run all tests:
```bash
# Run complete test suite
for dir in scripts/analytics-tests/*/; do
  echo "Testing $(basename "$dir")..."
  for file in "$dir"*.ts; do
    if [ -f "$file" ]; then
      echo "  Running $(basename "$file")..."
      node --import tsx "$file"
    fi
  done
done
```

## Expected Outcomes

1. **Phase 1**: Verify all external dependencies work correctly
2. **Phase 2**: Verify analytics engine functions work with sample data
3. **Phase 3**: Verify client can be initialized and configured
4. **Phase 4**: Identify exact failure points and module resolution issues

## Debugging Strategy

- Start with Phase 1 to ensure foundational dependencies work
- Progress through phases sequentially
- If a phase fails, fix issues before moving to next phase
- Use detailed logging to identify exact failure points

## Test Data

Tests use known wallet addresses with transaction history:
- `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS` (yield farming wallet)
- `SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R` (active trader)
- `SP102V8P0F7JX67ARQ77WEA3D3CFB5XW39REDT0AM` (long-term holder)

## Environment Requirements

- Node.js with TypeScript support (`--import tsx`)
- Environment variables configured in `.env.local`
- Access to Stacks blockchain APIs
- PartyKit service for token prices