---
slug: orders
sidebar_position: 3
title: GET /orders
---

# GET `/orders`

Returns all open & historical limit orders.  Optionally filter by owner.

> **Base URL:** `https://swap.charisma.rocks/api/v1/orders`

## Query parameters

| Name | Type | Required | Description |
| ---- | ---- | -------- | ----------- |
| `owner` | `string` | No | Stacks address.  If provided, only orders created by this principal are returned. |

### Example request

```bash
curl "https://swap.charisma.rocks/api/v1/orders?owner=SP3FBR2…ZY6"
```

## Successful response

```json showLineNumbers
{
  "status": "success",
  "data": [
    {
      "uuid": "669e…ef",
      "owner": "SP3FBR2…ZY6",
      "inputToken": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1",
      "outputToken": ".stx",
      "amountIn": "1000000",
      "targetPrice": "0.25",
      "direction": "gt",
      "conditionToken": ".stx",
      "recipient": "SP3FBR2…ZY6",
      "status": "open",
      "createdAt": "2024-05-22T14:31:45.123Z"
    }
  ]
}
```

## Error responses

| HTTP | Body | Condition |
| ---- | ---- | ---------- |
| `500` | `{ "error": "Failed to fetch orders" }` | Unexpected server error.

## Notes

* Orders are returned newest-first.
* No pagination yet; endpoint is suitable for wallets but not unbounded admin dashboards. 