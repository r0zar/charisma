# Integration Testing Guide

This guide explains how to run **integration tests** and **end-to-end (E2E) tests** that interact with real APIs instead of mocks.

## Types of Tests

### Unit Tests (Existing)
- **Location**: `src/__tests__/**/*.test.ts`
- **Purpose**: Test individual components with mocks
- **Command**: `npm test`
- **Environment**: Uses mocks for all external dependencies

### Integration Tests (New)
- **Location**: `src/__tests__/integration/**/*.test.ts`
- **Purpose**: Test real API interactions without mocks
- **Command**: `npm run test:integration`
- **Environment**: Requires real API credentials

### End-to-End Tests
- **Location**: `src/__tests__/integration/**/*.e2e.test.ts`
- **Purpose**: Test complete workflows with real APIs
- **Command**: `npm run test:e2e`
- **Environment**: Requires all API credentials

## Required Environment Variables

Create a `.env.local` file in the service root with the following variables:

```bash
# Hiro Stacks API (Required for discovery tests)
HIRO_API_KEY=your_hiro_api_key_here

# Vercel Blob Storage (Required for storage tests)
BLOB_READ_WRITE_TOKEN=vercel_blob_token_here

# Vercel KV Store (Required for indexing tests)
KV_REST_API_URL=https://your-kv-instance.kv.vercel-storage.com
KV_REST_API_TOKEN=your_kv_token_here
KV_REST_API_READ_ONLY_TOKEN=your_kv_readonly_token_here
```

## Getting API Credentials

### 1. Hiro API Key
```bash
# Free tier available
curl -X POST https://api.hiro.so/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@example.com"}'
```

### 2. Vercel Blob Token
```bash
# Via Vercel CLI
vercel env add BLOB_READ_WRITE_TOKEN

# Or in Vercel dashboard:
# Project Settings → Environment Variables → Add
```

### 3. Vercel KV Credentials
```bash
# Create KV store via Vercel CLI
vercel kv create contract-registry-test

# Get credentials
vercel env ls
```

## Test Commands

### Run All Unit Tests (Mocked)
```bash
npm test
```

### Run Integration Tests (Real APIs)
```bash
# All integration tests
npm run test:integration

# Watch mode
npm run test:integration:watch

# Specific test file
npm run test:integration -- TraitDiscoveryEngine.integration.test.ts

# With debug output
DEBUG=1 npm run test:integration
```

### Run E2E Tests Only
```bash
npm run test:e2e
```

### Run Everything
```bash
npm run test:all
```

## Integration Test Structure

### TraitDiscoveryEngine Integration
- **File**: `TraitDiscoveryEngine.integration.test.ts`
- **Tests**: Real contract discovery from Stacks blockchain
- **APIs**: Hiro Stacks API
- **Time**: ~2-3 minutes

### BlobStorage Integration  
- **File**: `BlobStorage.integration.test.ts`
- **Tests**: Real blob storage operations
- **APIs**: Vercel Blob
- **Time**: ~1-2 minutes

### IndexManager Integration
- **File**: `IndexManager.integration.test.ts`
- **Tests**: Real KV store operations
- **APIs**: Vercel KV
- **Time**: ~1-2 minutes

### ContractRegistry E2E
- **File**: `ContractRegistry.e2e.test.ts`
- **Tests**: Complete workflow with all APIs
- **APIs**: All of the above
- **Time**: ~3-5 minutes

## Test Configuration

### Integration Test Config
```typescript
// vitest.integration.config.ts
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/integration/**/*.test.ts'],
    testTimeout: 60000, // 1 minute per test
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true } // Prevent rate limiting
    },
    retry: 2 // Retry flaky network calls
  }
});
```

### Environment Validation
Tests automatically skip if required environment variables are missing:

```typescript
// Will skip gracefully with warning
if (!process.env.HIRO_API_KEY) {
  console.warn('⏭️  Skipping Hiro API tests - HIRO_API_KEY not set');
  return;
}
```

## Best Practices

### 1. Test Data Cleanup
All integration tests automatically clean up test data:

```typescript
afterEach(async () => {
  // Clean up contracts created during tests
  for (const contractId of testContractIds) {
    await registry.removeContract(contractId);
  }
});
```

### 2. Rate Limiting
Tests respect API rate limits:

```typescript
// Stagger requests to avoid rate limiting
await integrationUtils.wait(i * 500);

// Single fork execution prevents concurrent requests
poolOptions: { forks: { singleFork: true } }
```

### 3. Retry Logic
Network operations include retry logic:

```typescript
const result = await integrationUtils.retryOperation(async () => {
  return await discoveryEngine.discoverByTrait(traitConfig);
}, 3, 1000); // 3 retries with 1s delay
```

### 4. Unique Test Data
All tests use unique identifiers to prevent conflicts:

```typescript
const testId = integrationUtils.generateTestId();
const contractId = `SP123.test-contract-${testId}`;
```

## Troubleshooting

### Missing Environment Variables
```bash
⚠️  Missing environment variables for integration tests:
   - HIRO_API_KEY
   - BLOB_READ_WRITE_TOKEN
ℹ️  Integration tests will be skipped or may fail
```
**Solution**: Add missing variables to `.env.local`

### Rate Limiting
```bash
❌ Request failed with 429 Too Many Requests
```
**Solution**: Tests include automatic retry with exponential backoff

### Network Timeouts
```bash
❌ Request timeout after 30000ms
```
**Solution**: Tests have extended timeouts and retry logic

### API Quota Exceeded
```bash
❌ API quota exceeded for this month
```
**Solution**: Use different API key or wait for quota reset

## Integration Test Examples

### Simple Discovery Test
```typescript
it('should discover real SIP-010 contracts', async () => {
  const result = await discoveryEngine.discoverByTrait({
    trait: SIP010_TRAIT,
    enabled: true,
    batchSize: 5
  });
  
  expect(result.success).toBe(true);
  expect(result.contractsFound).toBeGreaterThan(0);
});
```

### E2E Workflow Test
```typescript
it('should perform complete contract discovery workflow', async () => {
  // 1. Discover contracts
  const discovery = await registry.discoverContracts(config);
  
  // 2. Analyze contracts
  const analysis = await registry.analyzeContract(contractId);
  
  // 3. Search stored contracts
  const search = await registry.searchContracts(criteria);
  
  // 4. Verify workflow completed
  expect(search.contracts.length).toBeGreaterThan(0);
});
```

## CI/CD Integration

### GitHub Actions
```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:integration
        env:
          HIRO_API_KEY: ${{ secrets.HIRO_API_KEY }}
          BLOB_READ_WRITE_TOKEN: ${{ secrets.BLOB_READ_WRITE_TOKEN }}
          KV_REST_API_URL: ${{ secrets.KV_REST_API_URL }}
          KV_REST_API_TOKEN: ${{ secrets.KV_REST_API_TOKEN }}
```

## Performance Expectations

| Test Suite | Duration | API Calls | Data Created |
|------------|----------|-----------|--------------|
| Unit Tests | 5-10s | 0 | None |
| Integration Tests | 2-3min | 50-100 | ~10KB |
| E2E Tests | 3-5min | 100-200 | ~50KB |
| All Tests | 8-15min | 150-300 | ~60KB |

## Cost Considerations

### API Usage
- **Hiro API**: Free tier (1000 requests/day)
- **Vercel Blob**: Pay per GB stored/transferred
- **Vercel KV**: Pay per request/storage

### Optimization
- Tests use small batch sizes
- Automatic cleanup prevents storage accumulation  
- Rate limiting prevents quota exhaustion
- Retry logic minimizes failed requests

Integration tests provide confidence that your code works with real APIs, catching issues that mocks might miss. Use them as part of your development workflow to ensure robust, production-ready code.