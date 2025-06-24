# Debug API Endpoints

This directory contains debug and administrative endpoints for troubleshooting and maintaining the Simple Swap application, particularly the Twitter triggers system.

## Twitter Trigger Debug Endpoints

### Raw Executions Analysis
**GET** `/api/debug/raw-executions`

Returns raw TwitterTriggerExecution records with field analysis and missing data detection.

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalExecutions": 46,
    "fieldsAnalysis": {
      "recipientAddress": {
        "totalRecords": 46,
        "recordsWithField": 36,
        "percentage": 78
      }
    },
    "recordsMissingReplyText": 0,
    "recordsMissingReplyTweetId": 0
  },
  "executions": [...],
  "missingFieldsAnalysis": [...]
}
```

### Execution Detail
**GET** `/api/debug/execution-detail/[id]`

Get detailed information about a specific TwitterTriggerExecution record.

**Parameters:**
- `id` - The execution ID

**Response:**
```json
{
  "success": true,
  "executionId": "exec_1750738949923_z9ad0cmfk",
  "execution": {
    "triggerId": "twitter_1750738705857_j2p0n7c3o",
    "replierHandle": "lordrozar",
    "bnsName": "rozar.btc",
    "status": "order_confirmed",
    "txid": "ae843a8ffce37287f82fbebf7257fa426c9496aad09e14cb42d1c9ad3cb7ea90"
  },
  "fieldsPresent": [...]
}
```

### Twitter Correlation Analysis
**GET** `/api/debug/twitter-correlation`

Analyzes correlation between TwitterTriggerExecution records and order metadata.

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalExecutions": 46,
    "totalOrders": 156,
    "twitterOrders": 15,
    "ordersWithMetadata": 15,
    "correlationIssues": 0
  },
  "correlationAnalysis": [...],
  "recommendations": [...]
}
```

## Maintenance Endpoints

### Backfill Metadata
**POST** `/api/debug/backfill-metadata`

Backfills missing execution metadata for Twitter orders by correlating with TwitterTriggerExecution records.

**Request Body:**
```json
{
  "dryRun": true,
  "limit": 50
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalTwitterOrders": 15,
    "needsBackfill": 0,
    "alreadyHasMetadata": 15,
    "backfilled": 0
  },
  "results": [...]
}
```

### Fix Recipients
**POST** `/api/debug/fix-recipients`

Fixes recipient addresses for Twitter orders by resolving BNS names to proper addresses.

**Request Body:**
```json
{
  "dryRun": true
}
```

**Response:**
```json
{
  "success": true,
  "summary": {
    "totalTwitterOrders": 15,
    "needsUpdate": 0,
    "alreadyCorrect": 15,
    "failed": 0
  },
  "results": [...]
}
```

### Metadata Validation
**GET** `/api/debug/metadata-validation`

Validates the structure and completeness of Twitter order metadata.

**Response:**
```json
{
  "success": true,
  "validation": {
    "totalTwitterOrders": 15,
    "validMetadata": 15,
    "invalidMetadata": 0,
    "missingFields": []
  },
  "details": [...]
}
```

## Data Structure Endpoints

### Twitter Executions
**GET** `/api/debug/twitter-executions`

Lists all TwitterTriggerExecution records with filtering options.

**Query Parameters:**
- `status` - Filter by execution status
- `triggerId` - Filter by trigger ID
- `limit` - Limit results (default: 50)

### Twitter Orders
**GET** `/api/debug/twitter-orders`

Lists all orders with Twitter strategy type and their metadata.

**Query Parameters:**
- `status` - Filter by order status
- `hasMetadata` - Filter by metadata presence
- `limit` - Limit results (default: 50)

## Usage Examples

### Investigate Missing Metadata
```bash
# Check overall correlation
curl http://localhost:3002/api/debug/twitter-correlation

# Check specific execution
curl http://localhost:3002/api/debug/execution-detail/exec_1750738949923_z9ad0cmfk

# Validate metadata structure
curl http://localhost:3002/api/debug/metadata-validation
```

### Fix Data Issues
```bash
# Dry run to see what would be fixed
curl -X POST http://localhost:3002/api/debug/fix-recipients \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# Actually fix recipient addresses
curl -X POST http://localhost:3002/api/debug/fix-recipients \
  -H "Content-Type: application/json" \
  -d '{"dryRun": false}'
```

### Monitor System Health
```bash
# Check raw execution data
curl http://localhost:3002/api/debug/raw-executions

# Validate all Twitter orders
curl http://localhost:3002/api/debug/metadata-validation
```

## Error Handling

All debug endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Description of the error",
  "timestamp": "2025-06-24T05:22:53.602Z"
}
```

## Security Notes

- These endpoints are for debugging and should not be exposed in production
- Always run dry runs before executing destructive operations
- Monitor logs for any unexpected behavior
- Regular correlation checks help maintain data integrity

## Troubleshooting Common Issues

### Missing Execution Metadata
1. Check correlation with `/api/debug/twitter-correlation`
2. Use `/api/debug/backfill-metadata` to fix missing data
3. Validate with `/api/debug/metadata-validation`

### Incorrect Recipient Addresses
1. Identify issues with `/api/debug/twitter-orders?hasMetadata=true`
2. Fix with `/api/debug/fix-recipients`
3. Verify BNS resolution is working properly

### Failed Executions
1. Analyze with `/api/debug/raw-executions`
2. Check specific executions with `/api/debug/execution-detail/[id]`
3. Use retry mechanism in Twitter triggers processor