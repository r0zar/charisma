---
sidebar_label: 'API Keys'
sidebar_position: 2
title: 'API Key Management'
---

# API Key Management

API keys provide a secure way to automate order execution and cancellation without requiring manual wallet signatures for each operation. This enables building sophisticated trading bots, automated strategies, and third-party integrations while maintaining the security of wallet-scoped permissions.

## Security Model

### Wallet-Scoped Keys
- **Each API key is owned by a specific Stacks wallet address**
- **API keys can only execute or cancel orders created by their owning wallet**
- **Keys are created and managed through signed messages from the wallet owner**
- **No central approval process - users have full control over their automation**

### Authentication Hierarchy
1. **Order Creation**: Can use either:
   - Wallet signature only (original method)
   - API key with `create` permission + wallet signature (dual authentication)
2. **Order Execution/Cancellation**: Can use either:
   - Wallet signature (original method)
   - API key owned by the order creator's wallet

## API Key Management

### Creating an API Key

Create a new API key by signing a message with your wallet:

```typescript
// 1. Generate the message to sign
const message = {
  action: 'create_api_key',
  keyName: 'My Trading Bot',
  permissions: ['create', 'execute', 'cancel'],
  timestamp: Date.now()
};

const messageString = JSON.stringify(message);

// 2. Sign the message with your wallet (using blaze-sdk)
const signature = await signMessage(messageString);

// 3. Submit to API
const response = await fetch('/api/v1/api-keys', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: messageString,
    signature: signature.signature, // Extract signature from result
    walletAddress: 'SP1ABC123...' // Your wallet address
  })
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error);
}

const { apiKey, keyId, name, permissions, rateLimit } = await response.json();
console.log(`Created API key: ${name} (${keyId})`);
console.log(`Permissions: ${permissions.join(', ')}`);
console.log(`Rate limit: ${rateLimit} requests/minute`);

// Store this API key securely - it's only shown once!
process.env.CHARISMA_API_KEY = apiKey;
```

### Listing Your API Keys

```typescript
const message = {
  action: 'list_api_keys',
  timestamp: Date.now()
};

const messageString = JSON.stringify(message);
const signature = await signMessage(messageString);

const response = await fetch('/api/v1/api-keys', {
  method: 'GET',
  headers: {
    'X-Message': messageString,
    'X-Signature': signature.signature,
    'X-Wallet-Address': 'SP1ABC123...'
  }
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error);
}

const { apiKeys } = await response.json();

// Display API key information (without sensitive data)
apiKeys.forEach(key => {
  console.log(`${key.name} (${key.id})`);
  console.log(`  Status: ${key.status}`);
  console.log(`  Permissions: ${key.permissions.join(', ')}`);
  console.log(`  Created: ${new Date(key.createdAt).toLocaleDateString()}`);
  console.log(`  Usage: ${key.usageStats.totalRequests} total requests`);
  console.log(`  Success rate: ${Math.round((key.usageStats.successfulRequests / key.usageStats.totalRequests) * 100)}%`);
});
```

### Revoking an API Key

```typescript
const keyId = 'key_123abc';
const message = {
  action: 'delete_api_key',
  keyId,
  timestamp: Date.now()
};

const messageString = JSON.stringify(message);
const signature = await signMessage(messageString);

const response = await fetch(`/api/v1/api-keys/${keyId}`, {
  method: 'DELETE',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: messageString,
    signature: signature.signature,
    walletAddress: 'SP1ABC123...'
  })
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error);
}

const { message: resultMessage } = await response.json();
console.log(resultMessage); // "API key 'My Trading Bot' has been revoked"
```

## Using API Keys for Order Operations

### Creating Orders

Create orders using an API key with `create` permission. Note that a valid signature is still required for security:

```typescript
// Create a new order with API key authentication
const orderData = {
  owner: 'SP1ABC123DEF456',
  inputToken: 'SP1ABC123DEF456.token-a',
  outputToken: 'SP1ABC123DEF456.token-b',
  amountIn: '1000000',
  targetPrice: '1.5',
  direction: 'gt',
  conditionToken: 'SP1ABC123DEF456.price-oracle',
  recipient: 'SP1ABC123DEF456',
  signature: '0x123abc...', // Signed transaction signature
  uuid: 'uuid-456def789',
  validFrom: '2024-01-15T10:00:00Z',
  validTo: '2024-01-16T10:00:00Z'
};

const response = await fetch('/api/v1/orders/new', {
  method: 'POST',
  headers: {
    'X-API-Key': 'ck_live_abc123def456...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(orderData)
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error);
}

const { status, data } = await response.json();
console.log(`Order created: ${data.uuid}`);
```

### Executing Orders

Instead of signing each execution request, use your API key:

```typescript
// Execute an order you created
const response = await fetch('/api/v1/orders/uuid_456def/execute', {
  method: 'POST',
  headers: {
    'X-API-Key': 'ck_live_abc123def456...',
    'Content-Type': 'application/json'
  }
});

const { status, txid } = await response.json();
```

### Cancelling Orders

```typescript
// Cancel an order you created
const response = await fetch('/api/v1/orders/uuid_456def/cancel', {
  method: 'PATCH',
  headers: {
    'X-API-Key': 'ck_live_abc123def456...',
    'Content-Type': 'application/json'
  }
});

const { status } = await response.json();
```

## Permissions

### Available Permissions
- **`create`**: Can create orders on behalf of the wallet (signature still required)
- **`execute`**: Can execute orders owned by the wallet
- **`cancel`**: Can cancel orders owned by the wallet

### Permission Scoping
- You can create keys with specific permission subsets
- Full automation bots typically need `create`, `execute`, and `cancel` permissions
- Execution-only bots need just `execute` and `cancel` permissions
- Order creation services need just the `create` permission
- Read-only applications may not need any permissions (they can use public endpoints)

## Rate Limits

### Default Limits
- **100 requests per minute** per API key
- **1000 requests per hour** per API key
- **10,000 requests per day** per API key

### Rate Limit Headers
All API responses include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1640995200
X-RateLimit-Window: 60
```

### Handling Rate Limits
```typescript
async function executeWithRetry(apiKey, orderUuid, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const response = await fetch(`/api/v1/orders/${orderUuid}/execute`, {
      method: 'POST',
      headers: { 'X-API-Key': apiKey }
    });

    if (response.status === 429) {
      // Rate limited - wait and retry
      const resetTime = parseInt(response.headers.get('X-RateLimit-Reset'));
      const waitTime = (resetTime * 1000) - Date.now();
      
      if (attempt < maxRetries && waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
    }

    return response;
  }
}
```

## Security Best Practices

### API Key Storage
- **Never commit API keys to version control**
- **Use environment variables for production deployments**
- **Rotate keys regularly (monthly recommended)**
- **Use different keys for different applications/environments**

### Network Security
- **Always use HTTPS when transmitting API keys**
- **Consider IP allowlisting for production bots**
- **Monitor API key usage for suspicious activity**

### Access Control
- **Create keys with minimal required permissions**
- **Revoke unused keys immediately**
- **Use separate keys for different trading strategies**
- **Monitor usage statistics regularly**

## Error Handling

### Common Error Responses

| HTTP Status | Error | Description |
|-------------|-------|-------------|
| `401` | `Invalid API key` | Key not found or malformed |
| `401` | `API key inactive` | Key has been revoked or suspended |
| `403` | `API key not authorized for this wallet` | Key trying to access order from different wallet |
| `429` | `Rate limit exceeded` | Too many requests in time window |
| `400` | `Order not open` | Order already filled, cancelled, or expired |
| `404` | `Order not found` | Invalid order UUID |

### Example Error Response
```json
{
  "error": "API key not authorized for this wallet",
  "details": {
    "apiKeyWallet": "SP1ABC123...",
    "orderOwner": "SP1XYZ789...",
    "orderUuid": "uuid_456def"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Handling Example
```typescript
async function executeOrderSafely(apiKey: string, orderUuid: string) {
  try {
    const response = await fetch(`/api/v1/orders/${orderUuid}/execute`, {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    // Check rate limit headers
    const rateLimit = {
      limit: parseInt(response.headers.get('X-RateLimit-Limit') || '0'),
      remaining: parseInt(response.headers.get('X-RateLimit-Remaining') || '0'),
      reset: parseInt(response.headers.get('X-RateLimit-Reset') || '0')
    };

    if (!response.ok) {
      const error = await response.json();
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = (rateLimit.reset * 1000) - Date.now();
        console.log(`Rate limited. Waiting ${Math.ceil(waitTime / 1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return executeOrderSafely(apiKey, orderUuid); // Retry
      }
      
      throw new Error(`Order execution failed: ${error.error}`);
    }

    const { txid } = await response.json();
    console.log(`Order executed successfully! TX: ${txid}`);
    console.log(`Rate limit: ${rateLimit.remaining}/${rateLimit.limit} remaining`);
    
    return txid;
  } catch (error) {
    console.error('Failed to execute order:', error);
    throw error;
  }
}
```

## Integration Examples

### Simple Trading Bot
```typescript
class TradingBot {
  constructor(apiKey, walletAddress) {
    this.apiKey = apiKey;
    this.walletAddress = walletAddress;
  }

  async executeOrder(orderUuid) {
    try {
      const response = await fetch(`/api/v1/orders/${orderUuid}/execute`, {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Execution failed: ${error.error}`);
      }

      const { txid } = await response.json();
      console.log(`Order executed successfully: ${txid}`);
      return txid;
    } catch (error) {
      console.error('Failed to execute order:', error);
      throw error;
    }
  }

  async monitorAndExecute(orderUuid, condition) {
    const checkInterval = 30000; // 30 seconds

    const monitor = setInterval(async () => {
      try {
        if (await condition()) {
          await this.executeOrder(orderUuid);
          clearInterval(monitor);
        }
      } catch (error) {
        console.error('Monitoring error:', error);
        // Continue monitoring unless it's a fatal error
        if (error.message.includes('Order not open')) {
          clearInterval(monitor);
        }
      }
    }, checkInterval);
  }
}

// Usage
const bot = new TradingBot('ck_live_abc123...', 'SP1ABC123...');

// Execute order when BTC price hits $50,000
bot.monitorAndExecute('order_uuid_123', async () => {
  const btcPrice = await fetchBTCPrice();
  return btcPrice >= 50000;
});
```

### Portfolio Rebalancing
```typescript
class PortfolioRebalancer {
  constructor(apiKey, walletAddress, targetAllocation) {
    this.apiKey = apiKey;
    this.walletAddress = walletAddress;
    this.targetAllocation = targetAllocation; // { 'STX': 0.5, 'BTC': 0.3, 'USDC': 0.2 }
  }

  async rebalance() {
    const currentPortfolio = await this.fetchPortfolioBalances();
    const rebalanceOrders = this.calculateRebalanceOrders(currentPortfolio);

    for (const order of rebalanceOrders) {
      try {
        await this.executeOrder(order.uuid);
        console.log(`Rebalanced: ${order.description}`);
      } catch (error) {
        console.error(`Failed to rebalance ${order.description}:`, error);
      }
    }
  }

  async executeOrder(orderUuid) {
    const response = await fetch(`/api/v1/orders/${orderUuid}/execute`, {
      method: 'POST',
      headers: { 'X-API-Key': this.apiKey }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error);
    }

    return response.json();
  }
}
```

### Authorized Signing Server

For advanced use cases, you can build an authorized server that signs transactions and forwards them to the DEX API:

```typescript
class AuthorizedSigningServer {
  constructor(apiKey, walletAddress, signingKey) {
    this.apiKey = apiKey;
    this.walletAddress = walletAddress;
    this.signingKey = signingKey; // Private key for signing
  }

  async createAndSubmitOrder(orderParams) {
    try {
      // 1. Generate order UUID
      const orderUuid = crypto.randomUUID();
      
      // 2. Sign the transaction on the server
      const signature = await this.signTransaction({
        ...orderParams,
        uuid: orderUuid,
        owner: this.walletAddress
      });

      // 3. Submit the order with API key authentication
      const orderData = {
        owner: this.walletAddress,
        signature,
        uuid: orderUuid,
        ...orderParams
      };

      const response = await fetch('/api/v1/orders/new', {
        method: 'POST',
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Order creation failed: ${error.error}`);
      }

      const { data } = await response.json();
      console.log(`Order created: ${data.uuid}`);
      return data;

    } catch (error) {
      console.error('Failed to create order:', error);
      throw error;
    }
  }

  async signTransaction(transactionData) {
    // Implementation depends on your signing setup
    // This could use hardware security modules, key management services, etc.
    // Return the hex signature string
    return await signWithPrivateKey(this.signingKey, transactionData);
  }

  // Express.js endpoint example
  setupRoutes(app) {
    app.post('/api/create-order', async (req, res) => {
      try {
        const { inputToken, outputToken, amountIn, targetPrice, direction, conditionToken } = req.body;
        
        // Validate and authorize the request
        if (!this.isAuthorizedRequest(req)) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        const order = await this.createAndSubmitOrder({
          inputToken,
          outputToken,
          amountIn,
          targetPrice,
          direction,
          conditionToken,
          recipient: this.walletAddress
        });

        res.json({ success: true, order });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  isAuthorizedRequest(req) {
    // Implement your authorization logic
    // This could check API keys, IP allowlists, authentication tokens, etc.
    return true;
  }
}

// Usage
const signingServer = new AuthorizedSigningServer(
  'ck_live_abc123...',
  'SP1ABC123DEF456',
  process.env.SIGNING_PRIVATE_KEY
);

// Set up API endpoints
signingServer.setupRoutes(app);
```

## Monitoring and Analytics

### Usage Statistics
API keys track detailed usage statistics:

```json
{
  "keyId": "key_123abc",
  "walletAddress": "SP1ABC123...",
  "name": "My Trading Bot",
  "status": "active",
  "permissions": ["execute", "cancel"],
  "rateLimit": 100,
  "createdAt": "2024-01-01T00:00:00Z",
  "lastUsedAt": "2024-01-15T10:30:00Z",
  "usageStats": {
    "totalRequests": 1547,
    "successfulRequests": 1502,
    "failedRequests": 45,
    "creationCount": 89,
    "executionCount": 234,
    "cancellationCount": 12
  }
}
```

### Monitoring Recommendations
- **Track success/failure rates** to identify issues
- **Monitor execution latency** for performance optimization
- **Set up alerts** for unusual activity patterns
- **Review daily usage** against your strategy expectations

## Migration from Signature Authentication

### Gradual Migration
You can use both authentication methods simultaneously:

```typescript
// Option 1: Use API key (recommended for automation)
await executeOrder(orderUuid, { apiKey: 'ck_live_abc123...' });

// Option 2: Use signature (manual operations)
await executeOrder(orderUuid, { 
  signature: signedMessage, 
  walletAddress: 'SP1ABC123...' 
});
```

### When to Use Each Method
- **API Keys**: Automated trading, bots, scheduled operations
- **Signatures**: Manual trading, one-off operations, testing

This API key system enables powerful automation while maintaining the security principle that only the order creator (or their authorized keys) can execute or cancel orders.