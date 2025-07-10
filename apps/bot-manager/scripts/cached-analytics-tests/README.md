# Cached Analytics Architecture Tests

This directory contains tests to validate the new cron-based analytics architecture that ensures analytics processing **DOES NOT** run on page visits.

## Architecture Overview

The new system works as follows:

1. **Background Processing**: Analytics are computed via cron jobs (`/api/cron/analytics-processor`)
2. **Cached Serving**: Page visits fetch pre-computed data from KV cache (`/api/v1/analytics/*`)
3. **No Real-time Processing**: Zero blockchain processing during user interactions
4. **Instant Experience**: Page loads complete in <200ms instead of 3-10 seconds

## Test Scripts

### 01-test-cached-client.ts
Tests the cached analytics client to ensure it serves data instantly from API endpoints.

**Benefits Demonstrated:**
- Response times <200ms vs 3-10 seconds
- No real-time blockchain processing
- Clean metadata tracking

```bash
pnpm tsx scripts/cached-analytics-tests/01-test-cached-client.ts
```

### 02-test-cron-endpoint.ts
Validates the background cron processing system.

**Benefits Demonstrated:**
- Background processing independent of user requests
- Cache updates with fresh blockchain data
- No blocking operations during page visits

```bash
pnpm tsx scripts/cached-analytics-tests/02-test-cron-endpoint.ts
```

### 03-compare-performance.ts
Direct performance comparison between old real-time vs new cached approach.

**Benefits Demonstrated:**
- 80-95% performance improvement
- 5-50x faster response times
- Better user experience and scalability

```bash
pnpm tsx scripts/cached-analytics-tests/03-compare-performance.ts
```

### 04-test-architecture.ts
Comprehensive architecture validation with concurrent user simulation.

**Benefits Demonstrated:**
- Page loads remain instant under load
- All data served from cache
- No heavy processing on page visits
- High success rate with concurrent users

```bash
pnpm tsx scripts/cached-analytics-tests/04-test-architecture.ts
```

## Running All Tests

Run all tests in sequence:

```bash
pnpm tsx scripts/cached-analytics-tests/01-test-cached-client.ts && \
pnpm tsx scripts/cached-analytics-tests/02-test-cron-endpoint.ts && \
pnpm tsx scripts/cached-analytics-tests/03-compare-performance.ts && \
pnpm tsx scripts/cached-analytics-tests/04-test-architecture.ts
```

## Expected Results

When the architecture is working correctly, you should see:

- ✅ **Instant Response Times**: <200ms for all analytics requests
- ✅ **Cache-Only Serving**: All data marked as `cached: true`
- ✅ **No Heavy Processing**: No requests trigger blockchain processing
- ✅ **High Concurrent Performance**: 95%+ success rate with 50 concurrent users
- ✅ **Consistent Performance**: Minimal variance in response times

## Architecture Benefits

The new cron-based architecture provides:

1. **User Experience**: Instant page loads instead of 3-10 second delays
2. **Scalability**: Supports many concurrent users without performance degradation
3. **Reliability**: Reduces API rate limit issues and timeout errors
4. **Resource Efficiency**: Background processing doesn't compete with user requests
5. **Better Error Handling**: Errors in background processing don't affect page loads

## Troubleshooting

If tests fail:

1. **Check Environment**: Ensure `.env.local` has correct PARTYKIT_URL and other settings
2. **Verify Cron Secret**: Check that CRON_SECRET is set for cron endpoint tests
3. **Cache Issues**: Clear KV cache if stale data is causing problems
4. **Network Issues**: Verify PartyKit and other external services are accessible