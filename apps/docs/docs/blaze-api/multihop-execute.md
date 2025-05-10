---
slug: multihop-execute
sidebar_position: 3
title: POST /multihop/execute
---

# POST `/multihop/execute`

Submit a signed intent for a **multi-hop** swap route. Blaze solvers will construct the necessary Clarity transaction, leveraging the Charisma router, and execute it.

This endpoint is ideal for complex token paths where intermediate assets must be swapped atomically. Blaze accepts the route description as part of the signed intent, builds the appropriate Clarity calls, and broadcasts the transaction.

## Request body

```json title="intent.json"
{
  "uuid": "5b29f424-2412-41eb-8c2e-f5429660e3bb",
  "route": {
    "steps": [
      {
        "pool": "SP…/pool-x-y",   // first hop liquidity pool contract
        "input": "SP…/token-x",
        "output": "SP…/token-y",
        "amount": "1000000"         // u64 (µ-denomination)
      },
      {
        "pool": "SP…/pool-y-z",
        "input": "SP…/token-y",
        "output": "SP…/token-z",
        "min_output": "990000"
      }
    ]
  },
  "signature": "3ae4…",
  "network": "mainnet"
}
```

- **uuid** – id you sign to prove authorship.

- **route.steps** – ordered array describing each hop. See field notes above.

- **signature** – 65-byte compressed sig of the **uuid**.

## Example (cURL)

```bash title="2-hop route"
curl -X POST https://blaze.charisma.rocks/api/v1/multihop/execute \
  -H "Content-Type: application/json" \
  -d @route.json
```

## Successful response

```json title="200 OK"
{
  "success": true,
  "tx_id": "0xcafebabe…",
  "uuid": "5b29f424-2412-41eb-8c2e-f5429660e3bb"
}
```

## Error response

```json title="409 Conflict"
{
  "success": false,
  "error": "route expired"
} 