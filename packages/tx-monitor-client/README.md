# TX Monitor Client

A TypeScript client library for interacting with the TX Monitor API service.

## Features

- **Type-safe API client** with full TypeScript support
- **Automatic retries** with exponential backoff
- **Real-time polling** for transaction status updates
- **Batch operations** for handling multiple transactions
- **Error handling** with custom error types
- **Utility functions** for transaction status management
- **Comprehensive testing** with Jest

## Installation

```bash
pnpm add @repo/tx-monitor-client
```

## Quick Start

```typescript
import { TxMonitorClient } from '@repo/tx-monitor-client';

// Create client with default configuration (points to tx.charisma.rocks)
const client = new TxMonitorClient();

// Add transactions to monitoring queue
await client.addToQueue(['0x1234...', '0x5678...']);

// Get transaction status
const status = await client.getTransactionStatus('0x1234...');

// Poll for transaction completion
const finalStatus = await client.pollTransactionStatus('0x1234...');
```

## API Reference

### Constructor

```typescript
new TxMonitorClient(config?: TxMonitorConfig)
```

#### Configuration Options

```typescript
interface TxMonitorConfig {
  baseUrl?: string;          // Base URL of TX Monitor API (default: 'https://tx.charisma.rocks')
  timeout?: number;          // Request timeout in ms (default: 30000)
  retryAttempts?: number;    // Number of retry attempts (default: 3)
  retryDelay?: number;       // Initial retry delay in ms (default: 1000)
  adminAuth?: {              // Admin authentication
    token?: string;
    headers?: Record<string, string>;
  };
}
```

**Note:** All configuration options are optional. The client will use `https://tx.charisma.rocks` as the default base URL.

### Core Methods

#### `addToQueue(txids: string[]): Promise<QueueAddResponse>`

Add transaction IDs to the monitoring queue.

```typescript
const result = await client.addToQueue(['0x1234...', '0x5678...']);
console.log(`Added: ${result.added.length}, Already monitored: ${result.alreadyMonitored.length}`);
```

#### `getTransactionStatus(txid: string): Promise<StatusResponse>`

Get the current status of a transaction.

```typescript
const status = await client.getTransactionStatus('0x1234...');
console.log(`Status: ${status.status}, From cache: ${status.fromCache}`);
```

#### `getQueueStats(): Promise<QueueStatsResponse>`

Get queue statistics and health metrics.

```typescript
const stats = await client.getQueueStats();
console.log(`Queue size: ${stats.queueSize}, Health: ${stats.processingHealth}`);
```

### Polling Methods

#### `pollTransactionStatus(txid: string, options?: PollingOptions): Promise<StatusResponse>`

Poll for transaction status until it reaches a final state.

```typescript
const finalStatus = await client.pollTransactionStatus('0x1234...', {
  interval: 5000,           // Check every 5 seconds
  timeout: 300000,          // Stop after 5 minutes
  maxAttempts: 60,          // Maximum number of attempts
  onStatusChange: (status) => {
    console.log(`Status update: ${status.status}`);
  },
  onError: (error) => {
    console.error('Polling error:', error);
  }
});
```

#### `waitForTransaction(txid: string, options?: PollingOptions): Promise<StatusResponse>`

Alias for `pollTransactionStatus` for better readability.

```typescript
const result = await client.waitForTransaction('0x1234...', {
  interval: 10000,
  timeout: 600000
});
```

### Batch Operations

#### `batchAddToQueue(txids: string[], batchSize?: number): Promise<QueueAddResponse[]>`

Add multiple transactions in batches to avoid overwhelming the API.

```typescript
const txids = ['0x1234...', '0x5678...', /* ... many more ... */];
const results = await client.batchAddToQueue(txids, 10); // Process 10 at a time
```

### Admin Methods

#### `getQueueDetails(): Promise<QueueDetailsResponse>`

Get detailed information about the current queue (requires admin authentication).

```typescript
const details = await client.getQueueDetails();
console.log(`Queue: ${details.queue.length} transactions`);
```

#### `triggerCronJob(): Promise<CronMonitorResult>`

Manually trigger the cron job for processing transactions.

```typescript
const result = await client.triggerCronJob();
console.log(`Processed: ${result.processed}, Updated: ${result.updated}`);
```

### Health Monitoring

#### `getHealthCheck(): Promise<HealthCheckResponse>`

Get the health status of the TX Monitor service.

```typescript
const health = await client.getHealthCheck();
console.log(`API: ${health.api}, Cron: ${health.cron}, Queue: ${health.queue}`);
```

#### `isHealthy(): Promise<boolean>`

Quick health check that returns a boolean.

```typescript
const healthy = await client.isHealthy();
if (!healthy) {
  console.warn('TX Monitor service is unhealthy');
}
```

## Utility Functions

### Status Checking

```typescript
import { 
  isTransactionFinal, 
  isTransactionSuccessful, 
  isTransactionFailed, 
  isTransactionPending 
} from '@repo/tx-monitor-client';

if (isTransactionFinal(status.status)) {
  console.log('Transaction is complete');
}

if (isTransactionSuccessful(status.status)) {
  console.log('Transaction succeeded');
}
```

### Transaction ID Validation

```typescript
import { validateTransactionId, normalizeTransactionId } from '@repo/tx-monitor-client';

if (validateTransactionId(txid)) {
  const normalized = normalizeTransactionId(txid); // Ensures 0x prefix
  await client.addToQueue([normalized]);
}
```

### Status Tracking

```typescript
import { TransactionStatusTracker } from '@repo/tx-monitor-client';

const tracker = new TransactionStatusTracker();

tracker.onStatusChange((status, previous) => {
  console.log(`Status changed from ${previous} to ${status}`);
});

tracker.addStatus('pending');
tracker.addStatus('success');

console.log(`Duration: ${tracker.getDuration()}ms`);
```

### Progress Tracking

```typescript
import { createPollingProgressTracker } from '@repo/tx-monitor-client';

const progressTracker = createPollingProgressTracker((progress) => {
  console.log(`Attempt ${progress.attempts}, Elapsed: ${progress.elapsed}ms`);
});

await client.pollTransactionStatus('0x1234...', {
  ...progressTracker,
  interval: 5000
});
```

## Error Handling

The client provides custom error types for different scenarios:

```typescript
import { 
  TxMonitorError, 
  TxMonitorTimeoutError, 
  TxMonitorNotFoundError 
} from '@repo/tx-monitor-client';

try {
  const status = await client.getTransactionStatus('0x1234...');
} catch (error) {
  if (error instanceof TxMonitorNotFoundError) {
    console.log('Transaction not found on blockchain');
  } else if (error instanceof TxMonitorTimeoutError) {
    console.log('Request timed out');
  } else if (error instanceof TxMonitorError) {
    console.log('API error:', error.message, error.status);
  }
}
```

## Advanced Examples

### Real-time Transaction Monitoring

```typescript
async function monitorTransaction(txid: string) {
  const tracker = new TransactionStatusTracker();
  
  tracker.onStatusChange((status, previous) => {
    console.log(`[${new Date().toISOString()}] ${txid}: ${previous} → ${status}`);
  });

  try {
    const result = await client.pollTransactionStatus(txid, {
      interval: 10000,
      timeout: 600000,
      onStatusChange: (status) => {
        tracker.addStatus(status.status);
      }
    });

    console.log(`Transaction ${txid} completed with status: ${result.status}`);
    console.log(`Total duration: ${tracker.getDuration()}ms`);
    
    return result;
  } catch (error) {
    console.error(`Failed to monitor ${txid}:`, error);
    throw error;
  }
}
```

### Batch Transaction Processing

```typescript
async function processTransactionBatch(txids: string[]) {
  // Add all transactions to queue
  const addResults = await client.batchAddToQueue(txids, 20);
  
  console.log(`Added ${addResults.reduce((sum, r) => sum + r.added.length, 0)} transactions`);

  // Monitor all transactions concurrently
  const monitoringPromises = txids.map(txid => 
    client.pollTransactionStatus(txid, {
      interval: 15000,
      timeout: 900000
    })
  );

  try {
    const results = await Promise.allSettled(monitoringPromises);
    
    const successful = results.filter(r => 
      r.status === 'fulfilled' && r.value.status === 'success'
    ).length;
    
    const failed = results.filter(r => 
      r.status === 'rejected' || 
      (r.status === 'fulfilled' && r.value.status !== 'success')
    ).length;

    console.log(`Batch complete: ${successful} successful, ${failed} failed`);
    
    return results;
  } catch (error) {
    console.error('Batch processing failed:', error);
    throw error;
  }
}
```

### Health Monitoring

```typescript
async function monitorServiceHealth() {
  const health = await client.getHealthCheck();
  
  const issues = [];
  if (health.cron !== 'healthy') issues.push('cron');
  if (health.api !== 'healthy') issues.push('api');
  if (health.queue !== 'healthy') issues.push('queue');
  if (!health.kvConnectivity) issues.push('kv');
  
  if (issues.length > 0) {
    console.warn(`Health issues detected: ${issues.join(', ')}`);
    
    // Attempt to trigger cron job if it's having issues
    if (issues.includes('cron')) {
      try {
        const result = await client.triggerCronJob();
        console.log('Manual cron trigger successful:', result);
      } catch (error) {
        console.error('Manual cron trigger failed:', error);
      }
    }
  } else {
    console.log('All systems healthy');
  }
  
  return health;
}
```

## Testing

The package includes comprehensive unit tests:

```bash
pnpm test
pnpm test:coverage
pnpm test:watch
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

MIT