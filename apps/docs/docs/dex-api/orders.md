---
sidebar_position: 4
title: Read orders
---

# Read orders

Anyone can list or fetch orders without authentication. Responses never include an order's signature.

## GET `/orders`

| Param | Default | Description |
| --- | --- | --- |
| `owner` | — | Return only this address's orders. |
| `page` | `1` | The page number, 1 or higher. |
| `limit` | `10` | Results per page, from 1 to 50. |
| `sortBy` | `createdAt` | `createdAt` or `status` (sorts open, broadcasted, confirmed, failed, cancelled). |
| `sortOrder` | `desc` | `asc` or `desc`. |
| `status` | `all` | `all`, `open` (also returns `broadcasted`), `broadcasted`, `confirmed`, `failed` or `cancelled`. |
| `search` | — | A case-insensitive match against part of the `uuid`, `owner`, `inputToken`, `outputToken`, `conditionToken` or `txid`. |

Pagination starts when you send `page` or `limit`. If you send neither, the response holds every order (or every order for `owner`), unsorted and without a `pagination` object, and `status`, `search` and sorting are ignored.

```bash
curl "https://swap.charisma.rocks/api/v1/orders?owner=SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS&search=df531665&page=1&limit=1"
```

```json
{
  "status": "success",
  "data": [
    {
      "owner": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
      "inputToken": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1",
      "outputToken": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.welsh-token-subnet-v1",
      "amountIn": "1000",
      "recipient": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS",
      "uuid": "df531665-1de2-49bd-8ac1-41113eb8bdd4",
      "router": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v1",
      "status": "confirmed",
      "createdAt": "2026-09-29T02:39:29.384Z",
      "metadata": {
        "quote": { "amountIn": 1000, "amountOut": 6064569478, "timestamp": "2026-09-29T02:39:44.553Z", "slippage": 0.01 }
      },
      "txid": "0ada3d8f224d40f701c26bccff508f7b36868bb55f086d605ecbba597cddcccd",
      "blockHeight": 9085381,
      "blockTime": 1790649599,
      "confirmedAt": "2026-09-29T02:40:13.825Z"
    }
  ],
  "pagination": { "total": 1, "page": 1, "limit": 1, "totalPages": 1, "hasNextPage": false, "hasPrevPage": false }
}
```

The `path` inside `metadata.quote` is left out above.

| Order field | Description |
| --- | --- |
| `uuid`, `owner`, `inputToken`, `outputToken`, `amountIn`, `recipient` | As created. |
| `router` | The router the signature was made for. Older orders that lack it use `x-multihop-rc9`. |
| `conditionToken`, `targetPrice`, `direction`, `baseAsset`, `validFrom`, `validTo` | Present when the order has a trigger or a time window. |
| `status`, `createdAt`, `txid`, `broadcastedAt`, `confirmedAt`, `failedAt`, `failureReason`, `cancelledAt` | The order's lifecycle. See [Overview](./overview.md#order-lifecycle). |
| `metadata.quote` | The quote taken when the order executed. |
| `strategyId`, `strategyType`, `strategyPosition`, `strategySize` | Groups related orders, such as a DCA plan or a set of exits. |

Order lists are cached for 10 s (`s-maxage=10, stale-while-revalidate=30`).

## GET `/orders/{uuid}`

```bash
curl "https://swap.charisma.rocks/api/v1/orders/df531665-1de2-49bd-8ac1-41113eb8bdd4"
```

This returns `{ "status": "success", "data": <order> }`, where the order has the same shape as above. An unknown uuid returns `404 { "error": "Not found" }`.

## Errors

| Status | `error` |
| --- | --- |
| `400` | `Invalid page parameter` |
| `400` | `Invalid limit parameter (1-50)` |
| `500` | `Failed to fetch orders` |
