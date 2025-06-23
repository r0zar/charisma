# Twitter Replies Integration

## Overview
Automatic Twitter reply notifications for users when their BNS-triggered orders are successfully executed.

## Features
- ✅ **Automatic replies** to users when orders execute
- ✅ **Rich notifications** with transaction details and explorer links
- ✅ **Status tracking** for reply success/failure
- ✅ **Graceful error handling** - reply failures don't block order execution
- ✅ **Admin UI indicators** showing reply status in executions table

## Architecture

### Core Components

1. **TwitterReplyService** (`/lib/twitter-triggers/twitter-reply-service.ts`)
   - Handles Twitter API authentication
   - Formats notification messages
   - Sends replies to specific tweets
   - Tracks success/failure status

2. **Processor Integration** (`/lib/twitter-triggers/processor.ts`)
   - Calls reply service after successful order execution
   - Updates execution records with reply status
   - Fire-and-forget approach (doesn't block order processing)

3. **Admin UI** (`/app/admin/twitter-triggers/twitter-triggers-client.tsx`)
   - Shows reply status in executions table
   - Visual indicators for sent/failed/pending replies

## Environment Variables

Required for Twitter API v2:
```env
# Twitter API Credentials (required for posting)
TWITTER_API_KEY=your_api_key
TWITTER_API_SECRET=your_api_secret
TWITTER_ACCESS_TOKEN=your_access_token
TWITTER_ACCESS_SECRET=your_access_secret

# Feature toggle
TWITTER_REPLIES_ENABLED=true
```

## Message Format

When an order executes, users receive a reply like:
```
Hey @username! 🎯

✅ Your Twitter trigger order executed successfully!
💰 Sent 10.5 CHA to alice.btc
🔗 View transaction: https://explorer.hiro.so/txid/0x123...

Thanks for using our Twitter triggers! 🚀
```

## Status Tracking

The system tracks reply status in `TwitterTriggerExecution`:
- **`twitterReplyStatus`**: `'sent' | 'failed' | 'disabled'`
- **`twitterReplyId`**: ID of the sent reply tweet
- **`twitterReplyError`**: Error message if reply failed

## Admin UI Indicators

In the executions table:
- ✅ **Green checkmark**: Reply sent successfully
- ❌ **Red X**: Reply failed
- ⏳ **Yellow clock**: Reply pending (for successful orders)
- **-**: No reply needed (failed/overflow orders)

## Error Handling

- **Graceful degradation**: Order execution succeeds even if reply fails
- **Retry logic**: Built into Twitter API client
- **Comprehensive logging**: All reply attempts logged with context
- **Status tracking**: Reply failures recorded in execution records

## Security & Rate Limiting

- **API credentials**: Uses Twitter API v2 with OAuth 1.0a
- **Rate limiting**: Handled by twitter-api-v2 client
- **Error isolation**: Reply failures don't affect core order processing
- **Feature flag**: Can be disabled via `TWITTER_REPLIES_ENABLED=false`

## Technical Details

### Dependencies
- `twitter-api-v2`: Twitter API client for posting
- `@repo/tokens`: Token metadata for formatting amounts
- Existing Twitter trigger infrastructure

### Flow
1. Order executes successfully in processor
2. TwitterReplyService formats notification message
3. Reply sent to original tweet using Twitter API v2
4. Execution record updated with reply status
5. Admin UI shows reply status indicators

### Error Recovery
- Reply failures are logged but don't block processing
- Failed replies can be retried manually if needed
- Status tracking helps identify notification issues

## Testing

To test the reply system:
1. Set up Twitter API credentials
2. Create a Twitter trigger with real tweet
3. Reply to the tweet with a .btc BNS name
4. Monitor logs for reply attempts
5. Check admin UI for reply status
6. Verify actual reply appears on Twitter

## Future Enhancements

Potential improvements:
- User opt-out mechanism
- Custom reply templates per trigger
- Reply scheduling for rate limit management
- Analytics on reply engagement
- Integration with other notification channels