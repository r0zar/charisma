import { TxMonitorClient, TransactionStatusTracker } from '../src';

// Example usage of the TX Monitor Client
async function main() {
  // Initialize client with default configuration (points to tx.charisma.rocks)
  const client = new TxMonitorClient();

  // Sample transaction IDs
  const txids = [
    '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba'
  ];

  try {
    // 1. Add transactions to monitoring queue
    console.log('Adding transactions to queue...');
    const addResult = await client.addToQueue(txids);
    console.log(`Added: ${addResult.added.length}, Already monitored: ${addResult.alreadyMonitored.length}`);

    // 2. Get queue statistics
    console.log('\\nFetching queue statistics...');
    const stats = await client.getQueueStats();
    console.log(`Queue size: ${stats.queueSize}`);
    console.log(`Processing health: ${stats.processingHealth}`);
    console.log(`Total processed: ${stats.totalProcessed}`);

    // 3. Check transaction status
    console.log(`\\nChecking status of ${txids[0]}...`);
    const status = await client.getTransactionStatus(txids[0]);
    console.log(`Status: ${status.status}`);
    console.log(`From cache: ${status.fromCache}`);
    console.log(`Block height: ${status.blockHeight || 'N/A'}`);

    // 4. Poll for transaction completion with progress tracking
    console.log(`\\nPolling for completion of ${txids[0]}...`);
    const tracker = new TransactionStatusTracker();
    
    tracker.onStatusChange((status, previous) => {
      console.log(`Status changed: ${previous} → ${status}`);
    });

    const finalStatus = await client.pollTransactionStatus(txids[0], {
      interval: 10000,
      timeout: 300000,
      onStatusChange: (status) => {
        tracker.addStatus(status.status);
        console.log(`Current status: ${status.status} (attempt ${tracker.getStatusHistory().length})`);
      },
      onError: (error) => {
        console.error('Polling error:', error.message);
      }
    });

    console.log(`\\nFinal status: ${finalStatus.status}`);
    console.log(`Total monitoring duration: ${tracker.getDuration()}ms`);

    // 5. Batch processing example
    console.log('\\nBatch processing example...');
    const manyTxids = [
      '0x1111111111111111111111111111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222222222222222222222222222',
      '0x3333333333333333333333333333333333333333333333333333333333333333',
      '0x4444444444444444444444444444444444444444444444444444444444444444',
      '0x5555555555555555555555555555555555555555555555555555555555555555'
    ];

    const batchResults = await client.batchAddToQueue(manyTxids, 2);
    console.log(`Batch processing complete: ${batchResults.length} batches processed`);

    // 6. Health check
    console.log('\\nChecking service health...');
    const healthy = await client.isHealthy();
    console.log(`Service is ${healthy ? 'healthy' : 'unhealthy'}`);

    if (!healthy) {
      const health = await client.getHealthCheck();
      console.log('Health details:', health);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };