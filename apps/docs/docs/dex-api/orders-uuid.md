---
slug: orders-uuid
sidebar_position: 5
title: GET /orders/{uuid}
---

# GET `/orders/{uuid}`

Retrieve a single order by its universally-unique identifier.

> **Base URL:** `https://swap.charisma.rocks/api/v1/orders/{uuid}`

No authorisation is required—UUIDs should be kept private so orders can only be looked up by their creator.

### Example

```bash
curl https://swap.charisma.rocks/api/v1/orders/669e8e74-6b2b-477e-9e4d-cd1399a0ef20
```

#### Successful response

```json showLineNumbers
{
  "status": "success",
  "data": {
    "uuid": "669e8e74-6b2b-477e-9e4d-cd1399a0ef20",
    "owner": "SP3FBR2…ZY6",
    "status": "open",
    "inputToken": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1",
    "outputToken": ".stx",
    "amountIn": "1000000",
    "targetPrice": "0.30",
    "direction": "gt",
    "createdAt": "2024-05-22T14:31:45.123Z"
  }
}
```

#### Error responses

| HTTP | Body | Condition |
| ---- | ---- | --------- |
| `404` | `{ "error": "Not found" }` | Unknown UUID |