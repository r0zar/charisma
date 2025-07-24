# Lottery API Endpoints

## Public API Endpoints (v1)

### Get Full Lottery Configuration
```bash
curl "http://localhost:3013/api/v1/lottery/config"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticketPrice": 5,
    "numbersToSelect": 6,
    "maxNumber": 49,
    "drawFrequency": "twice_weekly",
    "nextDrawDate": "2025-08-01T20:00:00Z",
    "currentJackpot": 1000000,
    "lastModified": "2025-07-23T22:34:57.129Z",
    "version": 5,
    "isActive": true
  }
}
```

### Get Current Jackpot
```bash
curl "http://localhost:3013/api/v1/lottery/jackpot"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jackpot": 1000000,
    "currency": "STONE"
  }
}
```

### Get Next Draw Time
```bash
curl "http://localhost:3013/api/v1/lottery/draw-time"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nextDrawDate": "2025-08-01T20:00:00Z",
    "timestamp": 1754078400000
  }
}
```

## Admin API Endpoints

All admin endpoints require the `x-admin-key` header with a valid admin API key.

### Get Lottery Configuration (Admin)
```bash
curl -H "x-admin-key: admin_api_key_1234567890" \
  "http://localhost:3013/api/admin/lottery-config"
```

### Update Lottery Configuration (Partial Update)
```bash
curl -X PUT \
  -H "x-admin-key: admin_api_key_1234567890" \
  -H "Content-Type: application/json" \
  -d '{"currentJackpot": 2000000}' \
  "http://localhost:3013/api/admin/lottery-config"
```

### Update Multiple Fields
```bash
curl -X PUT \
  -H "x-admin-key: admin_api_key_1234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "nextDrawDate": "2025-08-01T20:00:00Z",
    "currentJackpot": 1000000,
    "ticketPrice": 10
  }' \
  "http://localhost:3013/api/admin/lottery-config"
```

### Create/Replace Full Configuration
```bash
curl -X POST \
  -H "x-admin-key: admin_api_key_1234567890" \
  -H "Content-Type: application/json" \
  -d '{
    "ticketPrice": 5,
    "numbersToSelect": 6,
    "maxNumber": 49,
    "drawFrequency": "twice_weekly",
    "nextDrawDate": "2025-08-01T20:00:00Z",
    "currentJackpot": 1000000,
    "lastModified": "2025-07-23T22:34:57.129Z",
    "version": 1,
    "isActive": true
  }' \
  "http://localhost:3013/api/admin/lottery-config"
```

## Configuration Fields

| Field | Type | Description |
|-------|------|-------------|
| `ticketPrice` | number | Cost of each ticket in STONE tokens |
| `numbersToSelect` | number | How many numbers players must select |
| `maxNumber` | number | Maximum number players can select (1-maxNumber) |
| `drawFrequency` | string | How often draws occur |
| `nextDrawDate` | string | ISO datetime of next draw |
| `currentJackpot` | number | Current jackpot amount in STONE |
| `lastModified` | string | ISO datetime when config was last updated |
| `version` | number | Configuration version number |
| `isActive` | boolean | Whether the lottery is currently active |

## Error Responses

### 401 Unauthorized (Admin endpoints)
```json
{
  "error": "Unauthorized"
}
```

### 400 Bad Request
```json
{
  "error": "Invalid request body"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error: [detailed error message]"
}
```