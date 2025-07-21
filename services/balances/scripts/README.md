# Balance Service E2E Test Scripts

This directory contains end-to-end test scripts for the balance service that test real functionality without mocks.

## Prerequisites

1. **Environment Setup**: Create a `.env.local` file in the project root with your configuration:
   ```env
   # Required for blob storage tests
   BLOB_BASE_URL=https://your-blob-storage-url
   
   # Required for KV storage tests
   KV_REST_API_URL=https://your-kv-url
   KV_REST_API_TOKEN=your-token
   
   # Optional logging configuration
   LOG_LEVEL=info
   LOG_DIR=logs
   NO_FILE_LOG=false
   ```

2. **Install Dependencies**: Make sure you have tsx installed:
   ```bash
   npm install -g tsx
   ```

## Test Scripts

### 🔌 `tests/test-connection.ts`
Tests blob storage connection and basic monitoring functionality.

```bash
tsx scripts/tests/test-connection.ts
```

**What it tests:**
- Blob storage connectivity
- Storage statistics
- Monitoring stats
- Recent operations
- Active alerts

### 💰 `tests/test-balance-reads.ts`
Tests all balance reading operations across BalanceService and BalanceSeriesAPI.

```bash
tsx scripts/tests/test-balance-reads.ts
```

**What it tests:**
- Single balance retrieval
- Multiple balances for address
- Bulk balance requests
- Batch operations
- Time series data
- Balance history
- Service statistics

### 📸 `tests/test-snapshot-reads.ts`
Tests snapshot storage and reading operations.

```bash
tsx scripts/tests/test-snapshot-reads.ts
```

**What it tests:**
- Snapshot storage connection
- Snapshot existence checks
- Metadata retrieval
- Snapshot data access
- Historical balance queries
- Snapshot indexing
- Query operations

### 🗄️ `tests/test-kv-storage.ts`
Tests KV storage layer operations.

```bash
tsx scripts/tests/test-kv-storage.ts
```

**What it tests:**
- Individual balance retrieval
- Address balance aggregation
- Bulk operations
- Address indexing
- Contract tracking
- Storage statistics
- Sync timestamps
- Error handling

### 🚀 `tests/test-all-reads.ts`
Comprehensive test that runs all read operations across all components.

```bash
tsx scripts/tests/test-all-reads.ts
```

**What it tests:**
- All components in sequence
- Provides success/failure summary
- Performance metrics
- Comprehensive error reporting

## Features

### 📋 **Automatic Logging**
- All scripts automatically log to files in the `logs/` directory
- Logs include timestamps, errors, and execution details
- Console output with emojis for better readability

### 🔍 **Real Data Testing**
- Uses actual Stacks addresses and contracts
- Tests against real KV and blob storage
- No mocking - tests actual service behavior

### 🎯 **Focused Testing**
- Each script tests specific functionality
- Clear success/failure indicators
- Detailed error reporting with stack traces

### 📊 **Performance Monitoring**
- Execution time tracking
- Operation counts
- Cache hit/miss statistics
- Storage utilization metrics

## Sample Test Addresses

The scripts use these real Stacks addresses for testing:
- `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS`
- `SP1H1733V5MZ3SZ9XRW9FKYAHJ0CR4O42S4HZ3PKH`
- `SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C`

## Sample Test Contracts

The scripts test against these contracts:
- `SP3FBR2AGK5H9QBDH3EEN6DF8EK8JY7RX8QJ5SVTE.arkadiko-token`
- `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token`
- `SP2KAF9RF86PVX3NEE27DFV1CQX0T4WGR41X3S45C.usdc-token`

## Running All Tests

### Using npm scripts (recommended):

```bash
# Run all E2E tests with summary
npm run test:e2e

# Run individual tests
npm run test:e2e:connection
npm run test:e2e:kv
npm run test:e2e:balance
npm run test:e2e:snapshot
npm run test:e2e:all
```

### Using tsx directly:

```bash
# Run individual tests
tsx scripts/tests/test-connection.ts
tsx scripts/tests/test-kv-storage.ts
tsx scripts/tests/test-balance-reads.ts
tsx scripts/tests/test-snapshot-reads.ts

# Or run comprehensive test
tsx scripts/tests/test-all-reads.ts
```

## Expected Behavior

✅ **Success Cases:**
- All read operations complete without errors
- Data is returned in expected formats
- Performance metrics are reasonable
- Logs are written to files

❌ **Failure Cases:**
- Missing environment variables
- Network connectivity issues
- Service unavailability
- Data format mismatches

## Troubleshooting

### Common Issues

1. **Environment Variables Missing**
   ```
   ❌ Failed to load .env.local file
   ```
   Solution: Create `.env.local` with required variables

2. **Connection Failures**
   ```
   ❌ Connection failed!
   ```
   Solution: Check your `BLOB_BASE_URL` and network connectivity

3. **KV Storage Issues**
   ```
   ❌ KV Storage test failed
   ```
   Solution: Verify `KV_REST_API_URL` and `KV_REST_API_TOKEN`

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug tsx scripts/tests/test-all-reads.ts
```

### 🔍 Debug Scripts

For troubleshooting blob storage issues, use the debug script:
```bash
tsx scripts/tests/debug-blob-connection.ts
```

### No File Logging

Disable file logging:
```bash
NO_FILE_LOG=true tsx scripts/tests/test-all-reads.ts
```

## Integration with CI/CD

These scripts can be integrated into CI/CD pipelines for:
- **Smoke testing** after deployments
- **Health checks** for monitoring
- **Performance regression** testing
- **Integration validation** across environments