# Activity Timeline System

A comprehensive activity monitoring and timeline system for the Charisma ecosystem, providing real-time tracking of user activities across swaps, orders, DCA strategies, Twitter triggers, and more.

## Overview

The Activity Timeline System is a production-ready feature that creates a unified feed of all user activities across the Charisma platform. It provides a Twitter/X-style interface for viewing, filtering, and interacting with activities through replies and social features.

## Architecture

### Core Components

1. **Activity Management** (tx-monitor service)
   - All activity storage and business logic now lives in tx-monitor
   - Redis-based storage using sorted sets for time-based queries
   - Efficient pagination and filtering
   - User-specific and global timelines

2. **Activity API Client** (`api.ts`)
   - Client library for fetching activities from tx-monitor service
   - Pagination and filtering support
   - Reply system integration

3. **Transaction Registration** (`tx-monitor-client.ts`)
   - Register transactions for monitoring from simple-swap
   - Direct integration with tx-monitor service
   - No more webhook-based communication

4. **Frontend Components** (`types.ts`, `utils.ts`)
   - TypeScript interfaces for activity data
   - Utility functions for UI formatting and display
   - Activity timeline rendering components

## Features

### 🔄 **Real-time Activity Tracking**
- Live updates from transaction monitoring
- Status synchronization across all activities
- WebSocket-ready for future real-time features

### 🎯 **Multi-source Data Integration**
- **Instant Swaps**: Direct token exchanges
- **Limit Orders**: Order book activities
- **DCA Strategies**: Dollar-cost averaging executions
- **Twitter Triggers**: Social sentiment-based trades
- **Bot Activities**: Automated trading strategies
- **Perpetual Positions**: Leverage trading activities

### 💬 **Social Features**
- Reply system with nested conversations
- User interactions and engagement
- Activity sharing capabilities

### 🔍 **Advanced Filtering**
- Filter by activity type, status, date range
- Search across tokens, transactions, and content
- User-specific timeline views

### 📊 **Analytics Ready**
- Comprehensive activity metadata
- Performance tracking integration
- Admin analytics endpoints

## API Reference

### Activity Timeline

#### Get Activities
```typescript
GET /api/v1/activity
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)
- `sortOrder`: 'asc' or 'desc' (default: 'desc')
- `types`: Comma-separated activity types
- `statuses`: Comma-separated statuses
- `search`: Search query
- `startDate`: ISO date string
- `endDate`: ISO date string
- `owner`: Filter by wallet address

**Response:**
```json
{
  "data": [
    {
      "id": "activity-123",
      "type": "instant_swap",
      "timestamp": 1704067200000,
      "status": "completed",
      "owner": "SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60",
      "txid": "0x123abc...",
      "fromToken": {
        "symbol": "STX",
        "amount": "1000000000",
        "contractId": "SP4SZE494VC2YC5JYG7AYFQ44F5Q4PYV7DVMDPBG.stx-token"
      },
      "toToken": {
        "symbol": "CHA",
        "amount": "50000000000",
        "contractId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token"
      },
      "metadata": {
        "slippage": 0.5,
        "priceImpact": 0.2,
        "notes": "Quick swap for portfolio rebalancing"
      },
      "replyCount": 2,
      "hasReplies": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1250,
    "hasMore": true
  }
}
```

### Reply System

#### Get Replies
```typescript
GET /api/v1/activity/{activityId}/replies
```

#### Add Reply
```typescript
POST /api/v1/activity/{activityId}/replies
```

**Request Body:**
```json
{
  "content": "Great timing on this swap! 🎯",
  "author": "SP1K1A1PMGW2ZJCNF46NWZWHG8TS1D23EGH1KNK60"
}
```

#### Update Reply
```typescript
PUT /api/v1/activity/{activityId}/replies/{replyId}
```

#### Delete Reply
```typescript
DELETE /api/v1/activity/{activityId}/replies/{replyId}
```

### Admin Endpoints

#### Trigger Ingestion
```typescript
POST /api/v1/activity/admin/ingest
```

**Request Body:**
```json
{
  "action": "full" | "incremental" | "cleanup",
  "lastSyncTimestamp": 1704067200000
}
```

#### Transaction Webhook
```typescript
POST /api/v1/activity/webhook/transaction-update
```

**Request Body:**
```json
{
  "txid": "0x123abc...",
  "recordId": "order-456",
  "recordType": "order" | "swap",
  "previousStatus": "pending",
  "currentStatus": "success"
}
```

## Data Types

### ActivityItem
```typescript
interface ActivityItem {
  id: string;
  type: ActivityType;
  timestamp: number;
  status: ActivityStatus;
  owner: string;
  txid?: string;
  fromToken: TokenInfo;
  toToken: TokenInfo;
  metadata?: ActivityMetadata;
  replyCount: number;
  hasReplies: boolean;
  replies?: Reply[];
}
```

### ActivityType
```typescript
type ActivityType = 
  | 'instant_swap' 
  | 'order_filled' 
  | 'order_cancelled' 
  | 'dca_update' 
  | 'twitter_trigger'
  | 'bot_activity'
  | 'perpetual_position';
```

### ActivityStatus
```typescript
type ActivityStatus = 
  | 'pending' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';
```

## Integration with Transaction Monitor

The activity system integrates seamlessly with the `tx-monitor` service for real-time transaction status updates:

### Transaction Registration
```typescript
import { registerTransactionForActivityMonitoring } from '@/lib/activity/monitor';

// Register transaction for monitoring
await registerTransactionForActivityMonitoring(
  txid,
  recordId,
  recordType
);
```

### Status Updates
Transaction status changes are automatically propagated to the activity timeline through webhooks:

1. **tx-monitor** detects transaction status change
2. Sends webhook to `/api/v1/activity/webhook/transaction-update`
3. Activity timeline updates status in real-time
4. UI reflects changes immediately

## Setup and Configuration

### Environment Variables

```bash
# Redis Configuration
KV_REST_API_URL=your_redis_url
KV_REST_API_TOKEN=your_redis_token

# Transaction Monitor Integration
NEXT_PUBLIC_TX_MONITOR_URL=http://localhost:3012
ACTIVITY_WEBHOOK_SECRET=your_webhook_secret

# Simple Swap Configuration
SIMPLE_SWAP_URL=http://localhost:3002
```

### Installation

1. **Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Set up Redis**
   - Configure Redis connection in environment variables
   - Redis is used for activity storage and caching

3. **Configure Transaction Monitor**
   - Set up webhook endpoints between services
   - Configure authentication secrets

4. **Seed Demo Data** (Optional)
   ```bash
   pnpm run seed-activity-demo
   ```

### Development

#### Running the System
```bash
# Start simple-swap (main app)
pnpm dev --filter=simple-swap

# Start tx-monitor (transaction monitoring)
pnpm dev --filter=tx-monitor
```

#### Testing
```bash
# Run tests
pnpm test

# Type checking
pnpm run type-check
```

## Usage Examples

### Frontend Integration

```typescript
import { fetchActivityTimeline } from '@/lib/activity/api';

// Load activities with filtering
const activities = await fetchActivityTimeline({
  limit: 20,
  types: ['instant_swap', 'order_filled'],
  statuses: ['completed'],
  searchQuery: 'STX'
});

// Using the React hook
import { useActivityTimeline } from '@/lib/activity/api';

function ActivityFeed() {
  const { 
    activities, 
    loading, 
    error, 
    hasMore, 
    loadMore 
  } = useActivityTimeline({
    limit: 50,
    types: ['instant_swap']
  });

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <div>
      {activities.map(activity => (
        <ActivityCard key={activity.id} activity={activity} />
      ))}
      {hasMore && (
        <button onClick={loadMore}>Load More</button>
      )}
    </div>
  );
}
```

### Adding New Activity Sources

1. **Create Data Adapter**
   ```typescript
   // In adapters.ts
   export function adaptNewSource(sourceData: NewSourceData): ActivityItem {
     return {
       id: generateActivityId('new_source', sourceData.id),
       type: 'new_activity_type',
       timestamp: sourceData.createdAt,
       status: mapStatus(sourceData.status),
       owner: sourceData.userAddress,
       // ... map other fields
     };
   }
   ```

2. **Update Ingestion Pipeline**
   ```typescript
   // In ingestion.ts
   export async function ingestNewSource(): Promise<void> {
     const data = await fetchNewSourceData();
     
     for (const item of data) {
       const activity = adaptNewSource(item);
       await addActivity(activity);
     }
   }
   ```

3. **Add to Activity Types**
   ```typescript
   // In types.ts
   export type ActivityType = 
     | 'instant_swap' 
     | 'order_filled' 
     | 'new_activity_type'; // Add new type
   ```

## Performance Considerations

### Storage Optimization
- **Redis Sorted Sets**: Efficient time-based queries
- **Pagination**: Limit memory usage with proper pagination
- **Indexing**: Multiple indexes for fast filtering
- **TTL**: Automatic cleanup of old data

### Caching Strategy
- **Activity Data**: Cached with appropriate TTL
- **Reply Threads**: Cached per activity
- **User Timelines**: Separate caching per user

### Monitoring
- **Query Performance**: Monitor Redis query times
- **Memory Usage**: Track Redis memory consumption
- **API Response Times**: Monitor endpoint performance
- **Error Rates**: Track API error frequencies

## Security

### Authentication
- **Wallet-based Auth**: Users identified by wallet addresses
- **API Keys**: Admin endpoints require API key authentication
- **Webhook Security**: Signed webhooks with secret verification

### Data Protection
- **Input Validation**: All inputs validated and sanitized
- **Rate Limiting**: API endpoints have rate limits
- **Access Control**: User-specific data access controls

## Monitoring and Logging

### Health Checks
- **API Health**: `/api/v1/activity/health`
- **Redis Connectivity**: Connection health monitoring
- **Ingestion Status**: Background job monitoring

### Logging
- **Structured Logging**: JSON format for easy parsing
- **Error Tracking**: Comprehensive error logging
- **Performance Metrics**: Response time tracking

### Metrics
- **Activity Volume**: Track activities per time period
- **User Engagement**: Monitor reply rates and interactions
- **System Performance**: API response times and error rates

## Troubleshooting

### Common Issues

1. **Redis Connection Issues**
   ```bash
   # Check Redis connectivity
   curl -X GET /api/v1/activity/health
   ```

2. **Transaction Updates Not Appearing**
   - Verify webhook configuration
   - Check tx-monitor service status
   - Validate webhook secret

3. **Missing Activities**
   - Run manual ingestion
   - Check data adapter mappings
   - Verify source data availability

### Debug Tools

```typescript
// Enable debug logging
process.env.DEBUG = 'activity:*';

// Manual ingestion
await triggerIngestion('full');

// Check activity stats
const stats = await getActivityStats();
```

## Contributing

1. **Code Style**: Follow existing TypeScript patterns
2. **Testing**: Add tests for new features
3. **Documentation**: Update README for new functionality
4. **Type Safety**: Maintain strict TypeScript compliance

## Future Enhancements

- **Real-time WebSocket Updates**: Live activity streaming
- **Advanced Analytics**: Detailed activity analytics
- **Push Notifications**: Real-time user notifications
- **Activity Insights**: AI-powered activity insights
- **Social Features**: Enhanced user interactions
- **Mobile Support**: Optimized mobile experience

## License

This project is part of the Charisma ecosystem and follows the same licensing terms.