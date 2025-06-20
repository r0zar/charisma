# Transaction Monitoring System

This document describes the transaction monitoring system that tracks the actual blockchain status of order transactions.

## Overview

Previously, when orders were executed, they were immediately marked as "filled" even though they were only broadcasted to the network. The transaction monitoring system adds proper tracking to distinguish between:

- **Broadcasted**: Transaction sent to network but not yet confirmed
- **Confirmed**: Transaction successfully included in a block
- **Failed**: Transaction failed due to errors or post-conditions

## Architecture

### Components

1. **Cron Job** (`/api/cron/transaction-monitor`)
   - Runs every minute via Vercel cron
   - Checks pending transactions using Stacks blockchain API
   - Updates order status based on blockchain confirmation

2. **Transaction Monitor Library** (`/lib/transaction-monitor.ts`)
   - Utility functions for checking and caching transaction statuses
   - Integrates with Vercel KV for persistent storage
   - Uses `@packages/polyglot` for blockchain queries

3. **UI Components**
   - `TransactionStatusIndicator`: Shows real-time transaction status
   - `PremiumStatusBadge`: Enhanced status badges with transaction info
   - `useTransactionStatus`: React hook for transaction status checking

4. **Admin Endpoints**
   - `/api/admin/transaction-monitor/stats`: Get monitoring statistics
   - `/api/admin/transaction-monitor/trigger`: Manually trigger monitoring
   - `/api/admin/transaction-monitor/status/[txid]`: Get specific transaction status

## Transaction Status Flow

```
Order Created (open) 
    ↓
Order Executed (filled) + txid stored
    ↓
Cron Job Checks Transaction Status
    ↓
┌─────────────────┬─────────────────┬─────────────────┐
│   CONFIRMED     │    FAILED       │    PENDING      │
│   (success)     │   (abort_*)     │   (pending)     │
│                 │                 │                 │
│ Order stays     │ Order reverted  │ Keep checking   │
│ "filled"        │ to "open"       │ until resolved  │
│                 │ txid cleared    │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

## Data Storage

### Vercel KV Keys

- `orders`: Hash containing all order data
- `tx:status:{txid}`: Cached transaction status (1 hour TTL)
- `tx:confirmed:{txid}`: Confirmation metadata (7 days TTL)
- `tx:failed:{txid}`: Failure information (7 days TTL)

### Transaction Status Types

```typescript
type TransactionStatus = 
  | 'success'              // Confirmed on blockchain
  | 'abort_by_response'    // Failed due to contract error
  | 'abort_by_post_condition' // Failed due to post-condition
  | 'pending'              // Still being processed
```

## Configuration

### Environment Variables

- `CRON_SECRET`: Authentication token for cron endpoints

### Vercel Cron Configuration

```json
{
  "path": "/api/cron/transaction-monitor",
  "schedule": "*/1 * * * *"  // Every minute
}
```

## Usage

### Monitoring Statistics

```bash
curl GET /api/admin/transaction-monitor/stats
```

### Manual Trigger

```bash
curl -X POST /api/admin/transaction-monitor/trigger
```

### Check Specific Transaction

```bash
curl GET /api/admin/transaction-monitor/status/{txid}
```

## Error Handling

### Retry Logic
- Failed API calls are logged but don't prevent other transactions from being checked
- Invalid transaction IDs are skipped with error logging
- Network errors are captured and reported in cron results

### Fallback Behavior
- If blockchain API is unavailable, transactions remain in current status
- UI shows "unknown" status for unchecked transactions
- Cached statuses prevent redundant API calls

### Data Consistency
- Orders are atomically updated in Vercel KV
- Transaction status caching prevents race conditions
- Failed transactions properly revert order state

## Monitoring and Alerts

### Logs
- All transaction checks are logged with detailed status
- Error conditions include stack traces and context
- Performance metrics track execution time and throughput

### Health Checks
- Cron job returns success/failure status
- Statistics endpoint provides system health overview
- Manual trigger allows testing without waiting for schedule

## Integration Points

### Polyglot Package
```typescript
import { getTransactionDetails } from '@packages/polyglot';
```

### Order Management
- Seamlessly integrates with existing order execution flow
- No changes required to order creation or cancellation
- Maintains backward compatibility with existing order data

### User Interface
- Real-time status indicators in order cards
- Tooltips explain transaction states
- Visual distinction between broadcasted and confirmed orders

## Performance Considerations

### Caching Strategy
- Transaction statuses cached for 1 hour to reduce API calls
- Confirmation metadata stored for 7 days for audit trail
- Efficient querying using KV hash operations

### Rate Limiting
- Checks limited to orders with pending transactions
- Sequential processing prevents API overload
- Configurable batch sizes for large deployments

### Scalability
- Stateless cron job design supports horizontal scaling
- KV storage handles high-throughput order processing
- Minimal impact on existing order execution performance

## Troubleshooting

### Common Issues

1. **Transactions stuck in pending**
   - Check Stacks network status
   - Verify transaction ID format
   - Review blockchain API connectivity

2. **Status not updating in UI**
   - Clear browser cache for latest hook version
   - Check API endpoint accessibility
   - Verify KV storage connectivity

3. **Cron job failures**
   - Check `CRON_SECRET` environment variable
   - Review Vercel function logs
   - Validate polyglot package integration

### Debug Commands

```bash
# Check system health
curl GET /api/admin/transaction-monitor/stats

# Manually trigger monitoring
curl -X POST /api/admin/transaction-monitor/trigger

# Check specific transaction
curl GET /api/admin/transaction-monitor/status/0x123...
```

## Future Enhancements

### Planned Features
- Webhook notifications for status changes
- Batch transaction processing optimization
- Historical transaction analytics
- Advanced retry strategies for failed transactions

### Monitoring Improvements
- Grafana dashboard for transaction metrics
- Automated alerts for high failure rates
- Performance optimization based on usage patterns