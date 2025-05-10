---
slug: orders-execute
sidebar_position: 7
title: POST /orders/{uuid}/execute
---

# POST `/orders/{uuid}/execute`

Immediately execute an **open** order against the best available route—even if its trigger price hasn't been reached yet.  Intended for off-chain executors / keepers.

> **Base URL:** `https://swap.charisma.rocks/api/v1/orders/{uuid}/execute`

## Authorization

* Requires a developer `x-api-key` **or** a valid signature from the order owner.

If the order is still valid (`status === "open"`) the API will:
1. Fetch a fresh route via the `/quote` service.
2. Build a multi-hop transaction.
3. Submit the transaction via the Blaze signer service.

## Successful response

```json showLineNumbers
{
  "status": "success",
  "txid": "0x9d22f18b06839ec8d051de4638a96be7bba5db8040dcf76cc73502380f0d308b"
}
```

The `txid` refers to the transaction on Stacks Mainnet.

## Error responses

| HTTP | Body | Comment |
| ---- | ---- | ------- |
| `400` | `{ "error": "Order not open" }` | Already filled/cancelled. |
| `401/403` | `{ "error": "Unauthorized" }` | Signature/API key invalid. |
| `500` | `{ "error": "Execution failed" }` | Upstream signer or broadcast error. |

---

**Tip:** Executors should monitor pending Stacks mempool for the returned `txid` to confirm inclusion in a block. 