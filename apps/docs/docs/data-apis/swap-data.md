---
sidebar_position: 5
title: Swap data
---

# Swap data

Small reads from the swap app: wallet balances, subnet token pairings and platform totals.

**Base URL:** `https://swap.charisma.rocks/api/v1`

Quotes and orders on the same host are covered by the [DEX API](../dex-api/quote.md).

## GET /balances/`{address}`

A wallet's STX, fungible-token and NFT balances, including Blaze subnet balances. No CORS headers, so call it from a server.

| Param | In | Default | Notes |
|---|---|---|---|
| `address` | path | | Stacks address |
| `includeZero` | query | `false` | `true` keeps zero balances |

```bash
curl https://swap.charisma.rocks/api/v1/balances/SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4
```

```json
{
  "address": "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4",
  "lastUpdated": "2026-10-02T02:17:59.456Z",
  "source": "stacks-api",
  "stxBalance": "1965379994",
  "fungibleTokens": {
    "SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token": { "balance": "129", "decimals": 8 }
  },
  "nonFungibleTokens": {
    "SP2KGVFHAQDQPS95ZSF9Y4KN2C04V859C8Z76VW99.stdao::ststx": { "count": "1", "total_sent": "0", "total_received": "1" }
  },
  "metadata": {
    "cacheSource": "live",
    "tokenCount": 4,
    "nftCount": 2,
    "stxLocked": "0",
    "stxTotalSent": "0",
    "stxTotalReceived": "3785513202"
  }
}
```

- `fungibleTokens` is keyed by contract id. Balances are raw-unit strings.
- `decimals` comes from the Tokens API. Tokens it doesn't know report `6`.
- Subnet balances are read on-chain for every `SUBNET` token. They're left out if the token list takes longer than 2 s to load.

**Errors**

| Status | Body |
|---|---|
| `400` | `{ "error": "Invalid Stacks address format", "message": "Address must be a valid Stacks address" }` |
| `404` | `{ "error": "Balance not found" }` |
| `500` | `{ "error": "Failed to fetch balance", "message": "…" }` |

**Caching:** `Cache-Control: public, max-age=30, stale-while-revalidate=60`.

## GET /subnet-tokens

Every Blaze subnet token and the mainnet token it wraps. No CORS headers.

```json
{
  "success": true,
  "subnetTokens": [
    {
      "contractId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1",
      "base": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token",
      "symbol": "CHA",
      "name": "Charisma",
      "decimals": 6
    }
  ],
  "pairings": {
    "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token-subnet-v1"
  }
}
```

`pairings` maps mainnet contract id → subnet contract id.

**Errors:** `500` `{ "success": false, "subnetTokens": [], "pairings": {}, "error": "…" }`

**Caching:** `Cache-Control: public, max-age=300, stale-while-revalidate=600`.

## GET /stats

Headline totals for trades through Charisma's routers. CORS open to any origin.

```json
{
  "trades": 22711,
  "traders": 353,
  "volumeUsd": 86974.71793047035,
  "tvlUsd": 6026144.034905883,
  "firstTradeAt": 1734356100000,
  "updatedAt": 1790905172410
}
```

| Field | Meaning |
|---|---|
| `trades` | All-time trade count |
| `traders` | Unique trading wallets |
| `volumeUsd` | All-time volume, USD |
| `tvlUsd` | USD value of reserves in every `POOL` vault on the [Invest API](./invest-api.md), wrapped pools included |
| `firstTradeAt`, `updatedAt` | Unix ms |

**Errors:** `500` when the totals can't be computed.

**Caching:** regenerated at most every 15 minutes.
