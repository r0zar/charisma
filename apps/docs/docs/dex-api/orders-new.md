---
slug: orders-new
sidebar_position: 4
title: POST /orders/new
---

# POST `/orders/new`

Create a **limit / triggered order** that will execute on-chain once its price condition is met.

> **Base URL:** `https://swap.charisma.rocks/api/v1/orders/new`

## Authorization

This route supports two authentication methods:

1. **Signature only** (original method): Include the 65-byte compressed signature (hex, no `0x`) in the `signature` field of the JSON payload.

2. **API key + signature** (for automated systems): Include both:
   - `X-API-Key` header with an API key that has `create` permission
   - Valid signature in the `signature` field (always required for security)

The signature is always required regardless of authentication method to ensure transaction integrity.

## Request body

All fields are strings unless noted.

| Field | Type | Required | Description |
| ----- | ---- | -------- | ----------- |
| `owner` | Stacks address | ✅ | Principal that owns (& can cancel) the order. |
| `inputToken` | contract ID | ✅ | Token to spend (must be a **subnet** token). |
| `outputToken` | contract ID | ✅ | Token you want to receive. |
| `amountIn` | integer | ✅ | Amount of `inputToken` in micro-units. |
| `targetPrice` | decimal | ✅ | Desired price (output per input); compared using `direction`. |
| `direction` | `"gt" \| "lt"` | ✅ | `gt` = fill when price ≥ `targetPrice`; `lt` = price ≤ `targetPrice`. |
| `conditionToken` | contract ID | ✅ | Token whose price is monitored. |
| `recipient` | Stacks address | ✅ | Address that will receive the swap proceeds. |
| `signature` | hex(130) | ✅* | 65-byte compressed secp256k1 signature of the message bundle. |
| `uuid` | UUID v4 | ✅ | Unique identifier to prevent replay. |
| `baseAsset` | contract ID or `"USD"` | No | Denominator for price feeds; defaults to subnet sUSDT. |
| `validFrom` | ISO-8601 | No | Earliest timestamp at which the order may fill. |
| `validTo` | ISO-8601 | No | Expiration time; after this the order is auto-cancelled.

### Example (Signature only)

```bash
curl -X POST https://swap.charisma.rocks/api/v1/orders/new \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "SP3FBR2…ZY6",
    "inputToken": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1",
    "outputToken": ".stx",
    "amountIn": "1000000",
    "targetPrice": "0.30",
    "direction": "gt",
    "conditionToken": ".stx",
    "recipient": "SP3FBR2…ZY6",
    "uuid": "669e8e74-6b2b-477e-9e4d-cd1399a0ef20",
    "signature": "3045022100e8f2a8c4b1d7e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9c2d5e8f1b4d7e0f3a6b9c2d5e8f1b4d7e0f3a6b9c2d5e8f1b4d7e0f3a6b9c2d5e"
  }'
```

### Example (API key + signature)

```bash
curl -X POST https://swap.charisma.rocks/api/v1/orders/new \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ck_live_abc123def456..." \
  -d '{
    "owner": "SP3FBR2…ZY6",
    "inputToken": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1",
    "outputToken": ".stx",
    "amountIn": "1000000",
    "targetPrice": "0.30",
    "direction": "gt",
    "conditionToken": ".stx",
    "recipient": "SP3FBR2…ZY6",
    "uuid": "669e8e74-6b2b-477e-9e4d-cd1399a0ef20",
    "signature": "3045022100e8f2a8c4b1d7e6f9a2b5c8d1e4f7a0b3c6d9e2f5a8b1c4d7e0f3a6b9c2d5e8f1b4d7e0f3a6b9c2d5e8f1b4d7e0f3a6b9c2d5e8f1b4d7e0f3a6b9c2d5e"
  }'
```

## Successful response

```json showLineNumbers
{
  "status": "success",
  "data": {
    "uuid": "669e8e74-6b2b-477e-9e4d-cd1399a0ef20",
    "status": "open",
    "createdAt": "2024-05-22T14:31:45.123Z"
  }
}
```

## Validation errors (400)

* `amountIn must be integer numeric string`
* `targetPrice must be positive`
* `signature verification failed`
