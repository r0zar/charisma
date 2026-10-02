---
sidebar_position: 2
title: Get a quote
---

# Get a quote

`GET /quote` finds the best route for a swap, up to 4 hops, and returns the expected output. It does not reserve liquidity or send anything.

## Query parameters

| Name | Required | Description |
| --- | --- | --- |
| `tokenIn` | Yes | Contract ID of the token you pay. Use `.stx` for STX. |
| `tokenOut` | Yes | Contract ID of the token you receive. |
| `amount` | Yes | Amount of `tokenIn` in its smallest unit, as a positive integer. |

## Example

```bash
curl "https://swap.charisma.rocks/api/v1/quote?tokenIn=.stx&tokenOut=SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo&amount=1000000"
```

The response below is trimmed. The `path` and `tokenIn`/`tokenOut` entries carry full token metadata, and `vault` also includes reserves.

```json
{
  "success": true,
  "data": {
    "path": [
      { "contractId": ".stx", "symbol": "STX", "decimals": 6 },
      { "contractId": "SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo", "symbol": "$ROO", "decimals": 6 }
    ],
    "hops": [
      {
        "vault": { "contractId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.velar-stx-roo", "name": "Velar STX-ROO", "protocol": "VELAR", "fee": 3000 },
        "tokenIn": { "contractId": ".stx", "symbol": "STX" },
        "tokenOut": { "contractId": "SP2C1WREHGM75C7TGFAEJPFKTFTEGZKF6DFT6E2GE.kangaroo", "symbol": "$ROO" },
        "opcode": 0,
        "quote": { "amountIn": 1000000, "amountOut": 245259764 }
      }
    ],
    "amountIn": 1000000,
    "amountOut": 245259764
  }
}
```

| Field | Description |
| --- | --- |
| `path` | The tokens along the route, from `tokenIn` to `tokenOut`. |
| `hops[].vault` | The pool used for this hop. |
| `hops[].tokenIn`, `hops[].tokenOut` | The tokens going into and out of this hop. |
| `hops[].opcode` | Which way the hop swaps: `0` is the vault's token A to token B, `1` is token B to token A. |
| `hops[].quote` | `amountIn` and `amountOut` for this hop. |
| `amountIn`, `amountOut` | Totals for the whole route, as numbers in smallest units. |

## Notes

- **No route.** An unknown token or a pair with no route still returns `200`, with `{ "path": [], "hops": [], "amountIn": 0, "amountOut": 0 }`. Check that `amountOut > 0` rather than relying on the status code.
- **Caching.** Browsers cache a quote for 30 s. Vercel's CDN caches it for up to 5 minutes (`s-maxage=300`), then serves it stale for up to 10 more minutes while it refreshes (`stale-while-revalidate=600`). Treat a quote as an estimate. Orders take a fresh quote when they execute.
- **No slippage.** The quote applies none. For how executed orders handle slippage, see [Cancel or execute](./orders-cancel-execute.md#post-ordersuuidexecute).

## Errors

| Status | `error` |
| --- | --- |
| `400` | `Missing tokenIn parameter` (or `tokenOut`, or `amount`) |
| `400` | `Invalid amount parameter. Must be a positive integer.` |
| `500` | The routing error, for example `Failed to load vault data` |
