---
slug: quote
sidebar_position: 2
title: GET /quote
---

# GET `/quote`

Calculate the optimal swap route and expected output amount for a token pair.

> **Base URL:** `https://swap.charisma.rocks/api/v1/quote`

This endpoint performs on-the-fly path-finding across every vault currently loaded in the Charisma routing graph. It does **not** broadcast a transaction or reserve liquidity – it's purely informational and may be called client-side.

## Query parameters

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| `tokenIn` | `string` | ✅ | Contract ID (or `.stx`) of the input token. |
| `tokenOut` | `string` | ✅ | Contract ID of the desired output token. |
| `amount` | `integer (micro-units)` | ✅ | Amount of `tokenIn` in the token's smallest unit (e.g. micro-STX). |

### Example request

```bash
curl "https://swap.charisma.rocks/api/v1/quote?tokenIn=.stx&tokenOut=SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token&amount=1000000"
```

## Successful response

```json showLineNumbers
{
  "success": true,
  "data": {
    "amountIn": 1000000,
    "amountOut": 238941,
    "expectedPrice": 0.238941,
    "minimumReceived": 237746,
    "route": {
      "hops": [
        {
          "vault": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.stx-wbtc-vault",
          "opcode": 0
        }
      ]
    }
  }
}
```

| Field | Description |
| ----- | ----------- |
| `amountIn` | Amount that was quoted (micro-units). |
| `amountOut` | Estimated output in micro-units of `tokenOut`. |
| `expectedPrice` | Effective price (_tokenOut per tokenIn_). |
| `minimumReceived` | Output after applying the default 1 % slippage buffer. |
| `route` | Hop sequence that would be executed on-chain. |

## Error responses

| HTTP | Body | Reason |
| ---- | ---- | ------ |
| `400` | `{ "success": false, "error": "Missing tokenIn parameter" }` | Required param absent |
| `400` | `{ "success": false, "error": "Invalid amount parameter." }` | `amount` not a positive integer |
| `500` | `{ "success": false, "error": "Failed to get quote" }` | Internal failure while generating route |

## Rate limits

Unauthenticated clients are limited to **30 requests / 10 s** per IP address.