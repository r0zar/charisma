---
sidebar_position: 5
title: Deployment
---

# Deployment

Deploy the real-time system using PartyKit's serverless infrastructure for automatic scaling and edge distribution.

## Quick Start

### 1. Install PartyKit CLI

```bash
npm install -g partykit
```

### 2. Configure partykit.json

```json
{
  "$schema": "https://www.partykit.io/schema.json",
  "name": "charisma-party",
  "main": "src/parties/prices.ts",
  "compatibilityDate": "2025-06-17",
  "serve": "dist",
  "parties": {
    "prices": "src/parties/prices.ts",
    "balances": "src/parties/balances.ts"
  }
}
```

### 3. Deploy

```bash
# Development deployment
partykit deploy --preview

# Production deployment  
partykit deploy
```

## Environment Configuration

### Environment Variables

Set these environment variables in your PartyKit dashboard or deployment configuration:

```bash
# API Endpoints
TOKEN_SUMMARIES_URL=https://invest.charisma.rocks/api/v1/tokens/all?includePricing=true
HIRO_API_URL=https://api.hiro.so

# Development Settings (optional)
NODE_ENV=production
PARTYKIT_ENV=production

# Rate Limiting (optional)
MAX_CONNECTIONS_PER_ROOM=1000
UPDATE_INTERVAL_MS=300000
```

### Development vs Production

The system automatically detects its environment:

**Development Mode** (`NODE_ENV=development` or `localhost`):
- Faster update intervals (3 seconds initial, 5 minutes ongoing)
- Price noise generation for realistic testing
- Enhanced debug logging
- No production alarms/persistence

**Production Mode**:
- Standard update intervals (5 minutes)
- Real price data only
- Optimized logging
- Durable object alarms for scheduling

## PartyKit Configuration

### Server Structure

```typescript
// src/parties/prices.ts
export default class PricesParty implements Party.Server {
  constructor(readonly room: Party.Room) {
    // Server initialization
  }
  
  // WebSocket message handling
  onMessage(message: string, sender: Party.Connection) { }
  
  // HTTP request handling
  onRequest(request: Party.Request) { }
  
  // Scheduled tasks
  async onAlarm() { }
  
  // Connection lifecycle
  onConnect(conn: Party.Connection) { }
  onClose(connection: Party.Connection) { }
}
```

### Durable Objects

PartyKit automatically manages durable objects for:
- **State Persistence** - Connection tracking and subscription management
- **Scheduled Tasks** - Alarm-based data fetching intervals
- **Room Isolation** - Independent instances per room

## Scaling Considerations

### Horizontal Scaling
- **Automatic**: PartyKit handles scaling based on connection count
- **Room-based**: Each room runs independently and can scale separately
- **Edge Distribution**: Deployed globally for low latency

### Connection Limits
```typescript
// Optional: Implement connection limiting per room
onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
  if (this.subscriptions.size >= MAX_CONNECTIONS_PER_ROOM) {
    conn.close(1008, 'Room full');
    return;
  }
  
  // Accept connection
  this.handleConnection(conn);
}
```

### Memory Management
```typescript
// Clean up resources when rooms become inactive
onClose(connection: Party.Connection) {
  this.subscriptions.delete(connection.id);
  
  // If no connections remain, clean up
  if (this.subscriptions.size === 0) {
    this.clearIntervals();
    this.clearCaches();
  }
}
```

## Monitoring

### Health Endpoints

Add health check endpoints for monitoring:

```typescript
onRequest(request: Party.Request) {
  const url = new URL(request.url);
  
  if (url.pathname === '/health') {
    return new Response(JSON.stringify({
      status: 'healthy',
      connections: this.subscriptions.size,
      lastUpdate: this.lastUpdateTime,
      uptime: Date.now() - this.startTime
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  // Handle other requests...
}
```

### Logging Strategy

```typescript
// Structured logging for production monitoring
private log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    roomId: this.room.id,
    connections: this.subscriptions.size,
    ...data
  };
  
  console.log(JSON.stringify(logEntry));
}
```

### Metrics Collection

Track important metrics:

```typescript
private metrics = {
  messagesReceived: 0,
  messagesSent: 0,
  apiCalls: 0,
  errors: 0,
  activeSubscriptions: 0
};

// Update metrics throughout your code
onMessage(message: string, sender: Party.Connection) {
  this.metrics.messagesReceived++;
  // Handle message...
}

private broadcastUpdate(data: any) {
  this.room.broadcast(JSON.stringify(data));
  this.metrics.messagesSent += this.subscriptions.size;
}
```

## Performance Optimization

### Connection Pooling
```typescript
// Reuse HTTP connections for external API calls
const httpAgent = new (require('http').Agent)({
  keepAlive: true,
  maxSockets: 10
});

// Use with fetch calls
fetch(apiUrl, { agent: httpAgent });
```

### Request Batching
```typescript
// Batch multiple user balance requests
private async fetchBalancesBatch(userIds: string[]) {
  // Process in chunks to avoid rate limits
  const chunks = this.chunkArray(userIds, 10);
  const results = await Promise.allSettled(
    chunks.map(chunk => this.fetchUsersBalances(chunk))
  );
  
  return results.flatMap(result => 
    result.status === 'fulfilled' ? result.value : []
  );
}
```

### Caching Strategy
```typescript
// Cache external API responses
private cache = new Map<string, { data: any, expires: number }>();

private async getCachedOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlMs: number): Promise<T> {
  const cached = this.cache.get(key);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  const data = await fetcher();
  this.cache.set(key, { data, expires: Date.now() + ttlMs });
  return data;
}
```

## Security

### Rate Limiting
```typescript
private rateLimiter = new Map<string, { count: number, reset: number }>();

private checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const limit = this.rateLimiter.get(clientId);
  
  if (!limit || limit.reset < now) {
    this.rateLimiter.set(clientId, { count: 1, reset: now + 60000 }); // 1 minute
    return true;
  }
  
  if (limit.count >= 100) { // 100 messages per minute
    return false;
  }
  
  limit.count++;
  return true;
}
```

### Input Validation
```typescript
private validateMessage(data: any): boolean {
  // Validate message structure
  if (!data.type || typeof data.type !== 'string') {
    return false;
  }
  
  // Validate specific message types
  switch (data.type) {
    case 'SUBSCRIBE':
      return Array.isArray(data.contractIds) && 
             typeof data.clientId === 'string';
    default:
      return false;
  }
}
```

### Authentication (Optional)
```typescript
// Optional: Verify client tokens
onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
  const token = ctx.request.headers.get('Authorization');
  
  if (!this.verifyToken(token)) {
    conn.close(1008, 'Unauthorized');
    return;
  }
  
  // Accept authenticated connection
  this.handleConnection(conn);
}
```

## Deployment Checklist

### Pre-deployment
- [ ] Environment variables configured
- [ ] API endpoints accessible
- [ ] Rate limits appropriate for expected load
- [ ] Logging configured for monitoring
- [ ] Health endpoints implemented

### Testing
- [ ] WebSocket connections work in target environment
- [ ] External API calls succeed
- [ ] Error handling works correctly
- [ ] Performance under load is acceptable
- [ ] Reconnection logic functions properly

### Production
- [ ] Monitoring dashboards configured
- [ ] Alerting set up for errors and downtime
- [ ] Backup/fallback systems in place
- [ ] Documentation updated
- [ ] Team trained on troubleshooting

### Post-deployment
- [ ] Monitor connection counts and performance
- [ ] Verify data accuracy
- [ ] Check error rates
- [ ] Validate client applications work correctly
- [ ] Monitor external API usage and costs

## Troubleshooting

### Common Issues

**Connections not establishing**:
- Check PartyKit configuration
- Verify environment variables
- Test network connectivity

**Data not updating**:
- Check external API availability
- Verify API credentials and rate limits
- Review server logs for errors

**High latency**:
- Monitor connection counts per room
- Check external API response times
- Consider geographic distribution

**Memory usage growing**:
- Verify subscription cleanup on disconnect
- Check for memory leaks in caching
- Monitor durable object lifecycle

### Debug Commands

```bash
# Check deployment status
partykit list

# View logs
partykit logs [deployment-id]

# Test WebSocket connection
wscat -c wss://your-deployment.partykit.dev/parties/prices/main
```