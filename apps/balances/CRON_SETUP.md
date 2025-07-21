# Automated Address Discovery with Vercel Cron

This app includes automated address discovery that runs every 6 hours using Vercel's cron functionality.

## How It Works

The system automatically:
1. 🔍 **Analyzes existing tracked addresses** to discover new token contracts
2. 🪙 **Scans token holders** from known working contracts 
3. 🐋 **Classifies whale addresses** by portfolio value
4. 📊 **Updates the discovery dashboard** with new findings
5. 🔄 **Grows the database** organically using real blockchain data

## Cron Configuration

### Schedule
- **Frequency**: Every 6 hours (`0 */6 * * *`)
- **Endpoint**: `/api/cron/discovery`
- **Timeout**: 5 minutes (300 seconds)

### Security
The cron endpoint is protected by a secret token:
- Set `CRON_SECRET` in your Vercel environment variables
- Vercel automatically includes `Authorization: Bearer <CRON_SECRET>` in cron requests
- In development, requests are allowed without authentication

## Setup Instructions

### 1. Environment Variables
In your Vercel project settings, add:
```bash
CRON_SECRET=your-secure-random-string-here
```

Generate a secure random string:
```bash
openssl rand -hex 32
```

### 2. Deploy Configuration
The `vercel.json` file includes:
```json
{
  "crons": [
    {
      "path": "/api/cron/discovery", 
      "schedule": "0 */6 * * *"
    }
  ],
  "functions": {
    "src/app/api/cron/discovery/route.ts": {
      "maxDuration": 300
    }
  }
}
```

### 3. Manual Testing
Test the cron locally (development bypasses auth):
```bash
curl http://localhost:3400/api/cron/discovery
```

Test in production with auth:
```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
     https://your-app.vercel.app/api/cron/discovery
```

## Discovery Parameters

The automated discovery uses optimized parameters:
- **Contract Scanning**: 25 contracts maximum
- **Token Holders**: 30 holders per token  
- **Whale Threshold**: Top 35% of holders
- **Batch Size**: 10 addresses per batch
- **Minimum Balance**: 1,000+ tokens
- **Auto-Collection**: Enabled (high-value addresses auto-added)

## Monitoring

### Vercel Functions Tab
Monitor cron execution in your Vercel dashboard:
- Go to **Functions** tab
- View `/api/cron/discovery` logs
- Check execution times and errors

### Response Format
Successful cron runs return:
```json
{
  "success": true,
  "discovery": [...],
  "stats": {
    "totalAddresses": 6,
    "totalTokens": 11
  },
  "execution": {
    "startTime": "2025-07-21T13:48:39.473Z", 
    "executionTimeMs": 6006,
    "completedAt": "2025-07-21T13:48:45.780Z"
  }
}
```

### Discovery Dashboard  
View real-time results at `/discovery` in your app:
- Auto-discovered addresses
- Whale classifications  
- Discovery sources and statistics
- Performance metrics

## Benefits

### Organic Growth
- Uses **real tracked data** instead of guessing contract addresses
- **Cross-pollinates**: tracked addresses → discover tokens → find more addresses
- **Self-reinforcing**: grows smarter as database expands

### Reliability
- Only uses **proven working contracts** from existing balance data
- Avoids 404 errors from non-existent contracts
- Falls back gracefully when APIs are unavailable

### Performance
- **6-second execution time** (well under 5-minute limit)
- Efficient batching and rate limiting
- Minimal API calls by leveraging existing data

## Troubleshooting

### Common Issues

**Cron not running:**
- Check `CRON_SECRET` is set in Vercel environment variables
- Verify `vercel.json` is in the project root
- Ensure the project is deployed to Vercel

**Discovery errors:**
- Check Vercel function logs for detailed error messages
- Verify KV and Blob storage credentials are correct
- Test the endpoint manually to isolate issues

**No new addresses found:**
- This is normal - discovery is organic and depends on existing data
- As you track more addresses/tokens, discovery becomes more effective
- Check `/discovery` dashboard for current stats

### Debug Endpoints

**Manual discovery trigger:**
```bash
curl -X POST /api/discovery/run
```

**Check current stats:**
```bash  
curl /api/balances/stats
curl /api/discovery/stats
```

## Production Recommendations

1. **Monitor regularly** via Vercel dashboard
2. **Set up alerts** for cron failures (Vercel Pro feature)
3. **Adjust schedule** if needed (current: every 6 hours)
4. **Review discovery results** weekly via `/discovery` dashboard
5. **Scale parameters** as your database grows

The automated discovery will continuously grow your address and token database, making balance tracking more comprehensive over time!