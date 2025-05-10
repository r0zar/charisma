---
slug: orders-cancel
sidebar_position: 6
title: PATCH /orders/{uuid}/cancel
---

# PATCH `/orders/{uuid}/cancel`

Set an **open** order's status to `cancelled` so it will never execute.

> **Base URL:** `https://swap.charisma.rocks/api/v1/orders/{uuid}/cancel`

## Authorization

One of:

* `x-api-key` header (developer key)
* signature of the `uuid` in the request body (wallet user)

### Request body

Empty—only authentication headers are required when using an API key.  If using signature auth your client library should attach the signed message in the request headers (`authorization: …`).

### Example (signature auth)

```bash
curl -X PATCH https://swap.charisma.rocks/api/v1/orders/669e8e74…/cancel \
  -H "Authorization: SIGNATURE 0x2b7c…" 
```

## Successful response

```json showLineNumbers
{
  "status": "success",
  "data": {
    "uuid": "669e8e74-6b2b-477e-9e4d-cd1399a0ef20",
    "status": "cancelled"
  }
}
```

## Error responses

| HTTP | Body | Reason |
| ---- | ---- | ------ |
| `400` | `{ "error": "Order not open" }` | Order already filled/cancelled. |
| `401/403` | `{ "error": "Unauthorized" }` | Signature or API key invalid. |
| `404` | `{ "error": "Not found" }` | Unknown UUID. | 