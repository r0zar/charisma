---
sidebar_label: 'Programmatic Orders'
sidebar_position: 3
title: 'Programmatic Order Management & Developer Use Cases'
---

# Programmatic Order Management & Developer Use Cases

The Charisma DEX API offers powerful endpoints that allow developers to build sophisticated applications by programmatically creating, managing, and executing orders. This guide explores how to leverage `POST /orders/new`, `PATCH /orders/{uuid}/cancel`, and `POST /orders/{uuid}/execute` to build your own oracle systems, automated trading strategies, and innovative reward mechanisms.

## Core Endpoints for Developers

These three endpoints are the workhorses for advanced integrations:

1.  **`POST /orders/new`**: Create new limit or triggered orders.
    *   **Authentication**: Public (Signature required)
    *   **Key Feature**: Allows defining complex order conditions and, crucially, specifying a `recipient` address different from the order creator. This opens up a world of possibilities for third-party applications to facilitate swaps for users. Refer to the [Create New Order](./orders-new.md) page for detailed parameters.
2.  **`PATCH /orders/{uuid}/cancel`**: Cancel an existing open order.
    *   **Authentication**: Signature or API key
    *   **Key Feature**: Essential for managing orders when conditions change or based on user actions within your application. Refer to the [Cancel Order](./orders-cancel.md) page for details.
3.  **`POST /orders/{uuid}/execute`**: Force immediate execution of an order.
    *   **Authentication**: Signature or API key
    *   **Key Feature**: This allows your application to act as its own oracle, triggering the execution of an order when your specific, off-chain or on-chain conditions are met, bypassing the DEX's native trigger mechanisms if needed. See the [Execute Order](./orders-execute.md) page for more.

## Building Your Own Oracle System

With `POST /orders/new` and `POST /orders/{uuid}/execute`, your application can become an oracle, triggering multihop swaps based on any data you can access.

### How It Works:

1.  **Order Creation (`POST /orders/new`):**
    *   Your application monitors an external data source (e.g., CEX prices, weather APIs, social media sentiment, IoT sensor data, on-chain events).
    *   When your predefined conditions are met, your app creates an order on the DEX. You might set a specific limit price or create a "triggered" order that you intend to execute programmatically via `POST /orders/{uuid}/execute` once your oracle confirms the event.
    *   You can specify the `recipient` of the output tokens, which could be your application's user, a smart contract, a treasury, or any Stacks principal.

2.  **Programmatic Execution (`POST /orders/{uuid}/execute`):**
    *   Your application continues to monitor its data sources or internal logic.
    *   When your oracle system determines it's the right time to execute (e.g., a specific price point is hit on another exchange, a real-world event occurs, a game state changes), it calls `POST /orders/{uuid}/execute` with the order's UUID.
    *   The DEX then attempts to fill this order immediately against available liquidity, respecting the order's parameters (like limit price, if set).

### Example: Custom Event-Driven Swaps

*   **Monitor**: Your application tracks new NFT mints for a specific collection.
*   **Create**: When a user of your platform successfully mints a rare NFT from that collection, you want to reward them. You use `POST /orders/new` to create an order to swap 10 STX from your treasury into 50 YOUR_REWARD_TOKEN, setting the user's address as the `recipient`. 
*   **Execute**: You immediately call `POST /orders/{uuid}/execute` for the newly created order to ensure the reward swap happens promptly.

## Creative Applications & Use Cases

The flexibility of specifying a `recipient` and programmatically controlling the order lifecycle unlocks a vast array of applications.

### 1. Automated & Algorithmic Trading

*   **Dollar-Cost Averaging (DCA) / Time-Weighted Average Price (TWAP) Bots:**
    *   Create scheduled orders (`POST /orders/new`) to buy/sell a specific token with a set amount of another token over time. Your service would manage the scheduling, API calls, and potentially execution via `POST /orders/{uuid}/execute`.
*   **Grid Trading Bots:**
    *   Place a series of buy and sell limit orders (`POST /orders/new`) at pre-defined price intervals. Cancel (`PATCH /orders/{uuid}/cancel`) and replace orders as the price moves and fills occur.
*   **Portfolio Rebalancing Tools:**
    *   Users define a target asset allocation. Your tool monitors their portfolio (or a connected wallet) and periodically creates and executes orders to swap tokens, maintaining the desired balance. The tool would use its own funds for the input token and set the user's address as the `recipient`.

### 2. Reward, Incentive & Payment Systems

*   **Gamified Rewards & Achievements:**
    *   A game developer can reward players for in-game achievements (e.g., completing a quest, reaching a high score).
    *   *Scenario*: Player defeats a raid boss.
    *   *Action*: Game backend calls `POST /orders/new`, using the game's treasury STX (input token) to buy a "Legendary Gem Token" (output token), with the player's wallet as the `recipient`. The order is then executed using `POST /orders/{uuid}/execute`.
*   **Content Creator Tipping & Subscriptions:**
    *   A platform allows users to tip content creators in STX, but creators prefer to receive USDC. The platform can use `POST /orders/new` to create a swap from STX to USDC, with the creator as the `recipient`.
*   **Bounty & Grant Payouts:**
    *   Reward contributors for completing tasks (e.g., fixing a bug, creating documentation, winning a hackathon).
    *   Your platform tracks task completion and, upon verification, initiates a swap to send them tokens in their preferred currency.
*   **Airdrop Distribution Services:**
    *   A project wants to airdrop their new token (Token B) to a list of addresses.
    *   Your service could take a funding amount (e.g., in STX) from the project, then for each recipient, create an order via `POST /orders/new` to swap a portion of STX for Token B, with the target address as the `recipient`. Execute each order using `POST /orders/{uuid}/execute`.

### 3. Conditional & Event-Triggered Finance

*   **Prediction Market Payouts:**
    *   Platforms where users bet on the outcome of future events. When an event resolves, the platform uses its operational funds (e.g., USDC) to buy the payout asset (e.g., STX) via `POST /orders/new` and `POST /orders/{uuid}/execute`, sending it to the winning bettors' addresses as `recipient`.
*   **Decentralized Insurance & Hedging:**
    *   Create financial products that pay out based on verifiable on-chain or off-chain data (e.g., flight delay insurance paying out in crypto if a flight is delayed, using an oracle for flight data).
*   **Automated Loan Collateral Management:**
    *   If a loan's collateralization ratio drops below a threshold, an automated system could create and execute an order to swap some collateral for the debt asset to rebalance.

### 4. DAO & Treasury Management Tools

*   **Automated Treasury Diversification / Rebalancing:**
    *   A DAO votes to allocate a percentage of its treasury (e.g., STX) into other assets like BTC or stablecoins.
    *   A bot can execute these swaps gradually over time using `POST /orders/new` (e.g., as DCA orders) and `POST /orders/{uuid}/execute` to minimize market impact, with the DAO's multi-sig or treasury address as the `recipient` for the acquired assets.
*   **Automated Token Buybacks / Burns:**
    *   A project uses a portion of its protocol revenue (e.g., in USDC) to buy back its native token from the market.
    *   An automated system can create and execute buy orders for the native token, with the project's treasury or a burn address as the `recipient`.

## Managing the Order Lifecycle

*   **Cancellation (`PATCH /orders/{uuid}/cancel`):**
    *   Crucial if your oracle system determines that the conditions for a previously created order are no longer valid or optimal (e.g., arbitrage opportunity vanished, trigger event for a reward was invalidated, user requests cancellation via your app).
    *   Allows your application to adapt to changing market conditions or user needs.

## Authentication Options

The Charisma DEX API supports two authentication methods for order operations:

### API Key Authentication (Recommended for Automation)

API keys provide secure, automated access without requiring wallet signatures for each operation. Perfect for trading bots and automated systems.

**Key Features:**
- **Wallet-scoped**: Each API key is owned by a specific wallet and can only operate on orders created by that wallet
- **Self-service**: Create and manage keys through signed messages - no approval process needed
- **Granular permissions**: Keys can have `execute` and/or `cancel` permissions
- **Rate limiting**: Built-in rate limits prevent abuse
- **Usage tracking**: Monitor your automation with detailed analytics

**Creating an API Key:**
```typescript
const message = {
  action: 'create_api_key',
  keyName: 'Trading Bot v1',
  permissions: ['execute', 'cancel'],
  timestamp: Date.now()
};

const signature = await signMessage(JSON.stringify(message));

const response = await fetch('/api/v1/api-keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: JSON.stringify(message),
    signature,
    walletAddress: 'SP1ABC123...'
  })
});

const { apiKey } = await response.json();
// Store securely - only shown once!
```

**Using API Keys:**
```typescript
// Execute an order you created
await fetch('/api/v1/orders/uuid_123/execute', {
  method: 'POST',
  headers: { 'X-API-Key': 'ck_live_abc123...' }
});

// Cancel an order you created
await fetch('/api/v1/orders/uuid_123/cancel', {
  method: 'PATCH',
  headers: { 'X-API-Key': 'ck_live_abc123...' }
});
```

### Signature Authentication (Manual Operations)

For manual trading or one-off operations, you can authenticate each request with a wallet signature.

```typescript
const message = orderUuid; // Simple message for execute/cancel
const signature = await signMessage(message);

await fetch('/api/v1/orders/uuid_123/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message,
    signature,
    walletAddress: 'SP1ABC123...'
  })
});
```

**When to Use Each Method:**
- **API Keys**: Trading bots, scheduled operations, automated strategies
- **Signatures**: Manual trading, testing, one-off operations

For comprehensive API key documentation, see [API Key Management](./api-keys.md).

## Key Technical Considerations

*   **Authentication & Security:**
    *   **API Keys**: Store keys securely using environment variables. Never commit to version control. Rotate regularly.
    *   **Signatures**: Implement robust signature generation for `POST /orders/new` and signature-based authentication. Ensure message payloads are correctly stringified and hashed before signing.
    *   **Rate Limits**: API keys have built-in rate limiting (100/min by default). Monitor usage and implement backoff strategies.
*   **Idempotency:**
    *   When creating orders (`POST /orders/new`), your application should handle retries carefully to avoid duplicate order submissions. Consider using a client-generated unique ID that you can check against your own database before attempting to create an order. Check the specific `orders-new.md` documentation for any server-side idempotency key support.
*   **Error Handling & Retries:**
    *   Implement comprehensive error handling for all API calls. Understand potential error codes related to invalid parameters, insufficient funds, signature issues, order execution (e.g., slippage, no fill), and rate limits.
    *   Develop a sensible retry strategy for transient network errors, but avoid retrying on errors that indicate a permanent issue with the order itself.
*   **Rate Limiting:**
    *   Be aware of any API rate limits imposed by the DEX. Design your application to respect these limits and handle `429 Too Many Requests` errors gracefully (e.g., with exponential backoff).
*   **Gas Fees, Slippage & Execution Guarantees:**
    *   All on-chain order executions involve Stacks transaction fees (gas). Factor this into your application's economics.
    *   Market orders or executing triggered orders can be subject to price slippage. The `POST /orders/new` endpoint may allow specifying slippage tolerance. Your application should account for this, and inform users if applicable.
    *   Execution is not always guaranteed (e.g., insufficient liquidity at the desired price). Your application needs to handle scenarios where an order might not fill, partially fill, or expire.
*   **Monitoring Order Status:**
    *   After creating or attempting to execute an order, use `GET /orders/{uuid}` or `GET /orders` to track its status (e.g., open, filled, partially_filled, cancelled, failed).

## Conclusion

The programmatic order management endpoints of the Charisma DEX API are more than just tools for trading; they are building blocks for a new generation of decentralized applications. By combining `POST /orders/new`, `PATCH /orders/{uuid}/cancel`, and `POST /orders/{uuid}/execute` with your own data feeds, unique logic, and user interfaces, you can create sophisticated automated systems, engaging reward programs, and innovative financial products on the Stacks blockchain. The ability to define the `recipient` independently of the order creator is a particularly powerful feature that opens up a vast design space for developers. 