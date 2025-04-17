# Charisma API

This is the API server for Charisma, providing RESTful endpoints for various services including Dexterity (DEX aggregator).

## Development

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Environment Variables

- `PORT`: The port to run the server on (default: 5001)
- `HIRO_API_KEYS`: Comma-separated list of Hiro API keys for Stacks blockchain access
- `ROUTER_ADDRESS`: The Stacks address of the router contract (optional, for multi-hop swaps)
- `ROUTER_NAME`: The name of the router contract (optional, for multi-hop swaps)

## Dexterity API Endpoints

The Dexterity API provides access to liquidity pools, tokens, and swap quotes.

### Get API Status

```
GET /api/dexterity/status
```

Returns the status of the Dexterity API, including cache statistics.

### Trigger Data Indexing

```
POST /api/dexterity/index
```

Manually triggers the data indexing process. This is useful for updating the cache with the latest data.

### Get Vaults (Liquidity Pools)

```
GET /api/dexterity/vaults
```

Optional query parameters:
- `tokenId`: Filter vaults containing a specific token

Returns a list of liquidity vaults (pools).

### Get Tokens

```
GET /api/dexterity/tokens
```

Optional query parameters:
- `symbol`: Filter tokens by symbol (case-insensitive, partial match)

Returns a list of tokens.

### Get Token by ID

```
GET /api/dexterity/tokens/:tokenId
```

Returns details for a specific token.

### Get Swap Quote

```
GET /api/dexterity/quote
```

Required query parameters:
- `fromTokenId`: The contract ID of the token to swap from
- `toTokenId`: The contract ID of the token to swap to
- `amount`: The amount to swap (in base units)

Returns a quote for swapping tokens, including the best route, expected price, and minimum received.

## API Response Examples

### Status Response

```json
{
  "status": "ok",
  "cacheStats": {
    "vaults": 42,
    "tokens": 38,
    "lastUpdated": "2023-05-01T12:34:56.789Z",
    "indexing": false
  },
  "serverTime": "2023-05-01T12:35:00.123Z"
}
```

### Tokens Response

```json
[
  {
    "contractId": ".stx",
    "name": "Stacks Token",
    "symbol": "STX",
    "decimals": 6,
    "identifier": "STX"
  },
  {
    "contractId": "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-bitcoin",
    "name": "Wrapped Bitcoin",
    "symbol": "xBTC",
    "decimals": 8,
    "identifier": "xBTC"
  }
]
```

### Quote Response

```json
{
  "route": {
    "path": [
      {
        "contractId": ".stx",
        "symbol": "STX",
        "name": "Stacks Token"
      },
      {
        "contractId": "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-bitcoin",
        "symbol": "xBTC",
        "name": "Wrapped Bitcoin"
      }
    ],
    "hops": [
      {
        "vault": {
          "contractId": "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.stx-xbtc-pool",
          "contractAddress": "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR",
          "contractName": "stx-xbtc-pool",
          "name": "STX-xBTC Pool",
          "symbol": "STXBTC-LP",
          "decimals": 8,
          "fee": 3000
        },
        "tokenIn": {
          "contractId": ".stx",
          "symbol": "STX"
        },
        "tokenOut": {
          "contractId": "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.wrapped-bitcoin",
          "symbol": "xBTC"
        },
        "opcode": 0,
        "quote": {
          "amountIn": 1000000,
          "amountOut": 397
        }
      }
    ],
    "amountIn": 1000000,
    "amountOut": 397
  },
  "amountIn": 1000000,
  "amountOut": 397,
  "expectedPrice": 0.000397,
  "minimumReceived": 393
}
```