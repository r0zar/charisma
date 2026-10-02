---
sidebar_position: 3
title: Invest API
---

# Invest API

Every vault Charisma routes through (its own pools and wrapped third-party pools), the tokens they trade, and energy reads.

**Base URL:** `https://invest.charisma.rocks/api/v1` · CORS open to any origin, except `/energy/token-metadata` and `/energy/user-dashboard`.

Prices are also served here; see the [Pricing API reference](../prices/api-reference.md).

## Vault record

| Field | Notes |
|---|---|
| `contractId` | Vault contract |
| `type` | `POOL`, `SUBLINK` or `ENERGY` |
| `protocol` | `CHARISMA`, `BITFLOW`, `ALEX`, `ARKADIKO` or `VELAR` |
| `name`, `symbol`, `decimals`, `identifier`, `image`, `description` | The vault's own token (the LP token for a `POOL`) |
| `tokenA`, `tokenB` | [Token records](./tokens-api.md#token-record) for each side. Absent on `ENERGY`. |
| `reservesA`, `reservesB` | Reserves in raw units of `tokenA` / `tokenB`. `0` on `ENERGY`. |
| `reservesLastUpdatedAt` | Unix ms |
| `fee` | Swap fee in parts per million (`3000` = 0.3%) |
| `externalPoolId` | The third-party pool this vault wraps. Empty for Charisma pools. |
| `engineContractId` | `ENERGY`: the hold-to-earn engine |
| `base` | `ENERGY`: the token you hold to earn |
| `stxWrapper` | Asset an external pool swaps STX through (Arkadiko's wSTX) |
| `forwardsInputFee` | `true` when the pool sends part of the input to a fee address (Velar) |

| `type` | Meaning |
|---|---|
| `POOL` | Liquidity pool. `protocol: CHARISMA` is a native pool; any other protocol is a Charisma vault wrapping that protocol's pool at `externalPoolId`. |
| `SUBLINK` | Moves a mainnet token (`tokenA`) to its Blaze subnet token (`tokenB`) |
| `ENERGY` | Hold-to-earn energy vault |

## GET /vaults

All vaults, block-listed ones removed. Token sides are refreshed from the Tokens API.

| Param | In | Notes |
|---|---|---|
| `protocol` | query | Case-insensitive, e.g. `bitflow` |
| `type` | query | Exact match: `POOL`, `SUBLINK` or `ENERGY` |
| `contractId` | query | Return one vault instead of a list |

```bash
curl "https://invest.charisma.rocks/api/v1/vaults?protocol=bitflow"
```

```json
{
  "status": "success",
  "data": [
    {
      "type": "POOL",
      "protocol": "BITFLOW",
      "contractId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.bitflow-aeusdc-usdcx",
      "name": "Bitflow aeUSDC-USDCx",
      "symbol": "AEUSDCUSDCX",
      "decimals": 6,
      "fee": 500,
      "externalPoolId": "SM1FKXGNZJWSTWDWXQZJNF7B5TV5ZB235JTCXYXKD.dlmm-pool-aeusdc-usdcx-v-1-bps-1",
      "engineContractId": "",
      "tokenA": { "contractId": "SP3Y2ZSH8P7D50B0VBTSX11S7XSG24M1VB9YFQA4K.token-aeusdc", "symbol": "aeUSDC", "decimals": 6, "…": "…" },
      "tokenB": { "contractId": "SP120SBRBQJ00MCWS7TM5R8WJNTTKD5K0HFRC2CNE.usdcx", "symbol": "USDCx", "decimals": 6, "…": "…" },
      "reservesA": 42371252008,
      "reservesB": 74922777468,
      "reservesLastUpdatedAt": 1790906414797
    }
  ],
  "count": 15
}
```

**Errors:** `404` `{ "status": "error", "message": "Vault with contractId … not found." }` (with `contractId`) · `500` `{ "status": "error", "error": "Internal Server Error" }`

**Caching:** `Cache-Control: public, max-age=600`; edge cache 10 min (stale-while-revalidate 1 d).

## GET /vaults/`{contractId}`

One vault, as stored. Token sides are not refreshed from the Tokens API.

| Param | In | Notes |
|---|---|---|
| `contractId` | path | `address.contract-name` |

Response: `{ "status": "success", "data": { …vault } }`

**Errors**

| Status | Body |
|---|---|
| `400` | `{ "status": "error", "error": "Invalid contract ID format. Expect address.contract-name" }` |
| `404` | `{ "status": "error", "error": "Vault not found" }` |
| `500` | `{ "status": "error", "error": "Internal Server Error" }` |

**Caching:** `Cache-Control: public, max-age=1800`; edge cache 6 h (stale-while-revalidate 2 d).

## GET /tokens

Every token on either side of a `POOL` or `SUBLINK` vault: the set Charisma can route. Includes subnet tokens.

```json
{
  "status": "success",
  "data": [
    {
      "contractId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.sbtc-token-subnet-v1",
      "name": "sBTC",
      "symbol": "sBTC",
      "decimals": 8,
      "identifier": "sbtc-token",
      "type": "SUBNET",
      "isLpToken": false,
      "…": "…"
    }
  ],
  "count": 67
}
```

**Errors:** `500` `{ "status": "error", "error": "Internal Server Error" }`

**Caching:** `Cache-Control: public, max-age=900`; edge cache 6 h (stale-while-revalidate 1 d).

## GET /tokens/all

Routable mainnet tokens (no subnet tokens) and the LP tokens of Charisma pools, in one list.

| Param | In | Default | Notes |
|---|---|---|---|
| `type` | query | `all` | `all`, `tradeable` or `lp` |

LP entries carry `lpMetadata`:

```json
{
  "contractId": "SP15WAVKQNT241YVCGQMJS777E17H9TS96M21Q5DX.sexy-pepe",
  "symbol": "PEPE69",
  "decimals": 6,
  "isLpToken": true,
  "lpMetadata": {
    "tokenA": { "contractId": ".stx", "symbol": "STX", "name": "Stacks Token", "decimals": 6 },
    "tokenB": { "contractId": "SP1Z92MPDQEWZXW36VX71Q25HKF5K2EPCJ304F275.tokensoft-token-v4k68639zxz", "symbol": "PEPE", "name": "Pepe Coin", "decimals": 3 },
    "reservesA": 3660195,
    "reservesB": 219672777,
    "fee": 6900,
    "protocol": "CHARISMA",
    "vaultType": "POOL"
  }
}
```

The envelope is `{ "status": "success", "data": [...], "metadata": { "count": 127, "tradeableTokens": 49, "lpTokens": 78, … } }`.

**Errors:** `500` `{ "status": "error", "error": "Internal Server Error" }`

**Caching:** `Cache-Control: public, s-maxage=120, stale-while-revalidate=600`.

## Energy

### GET /energy/token-metadata

The [token record](./tokens-api.md#token-record) for `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.energy`.

**Errors:** `500` `{ "error": "Failed to fetch energy token metadata", "details": "…" }`

**Caching:** `Cache-Control: public, s-maxage=1800, stale-while-revalidate=3600`.

### GET /energy/user-dashboard

A wallet's energy cap and its stats for each `ENERGY` vault.

| Param | In | Notes |
|---|---|---|
| `address` | query | Required. Stacks address. |

```json
{
  "maxCapacity": 1450000000,
  "userEnergyDashboardData": [
    {
      "contractId": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charismatic-flow-energize",
      "name": "Charismatic Flow Energize",
      "currentAccumulatedEnergy": 34604883573851,
      "estimatedEnergyRatePerSecond": 16930933.06499339,
      "lastRateCalculationTimestamp": 1774785610000,
      "contractTotalEnergyHarvested": 34604883573851,
      "contractUniqueUsers": 1,
      "contractTopUserRates": [{ "address": "SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS", "energyPerMinute": 1201558457.425382 }]
    }
  ]
}
```

`maxCapacity` comes from the `power-cells` contract. The `current…` and `estimated…` fields are this wallet's harvested total and rate; the `contract…` fields cover all users. Energy amounts use 6 decimals.

**Errors:** `400` `{ "error": "Missing address parameter" }` · `500` `{ "error": "Failed to fetch energy data" }`

**Caching:** `Cache-Control: private, max-age=60, stale-while-revalidate=120`.

### GET /energy/stream/`{address}`

Server-Sent Events. One `connected` event, then an `energy_update` every second; failures arrive as `type: "error"` events.

```bash
curl -N https://invest.charisma.rocks/api/v1/energy/stream/SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS
```

```text
data: {"type":"connected","message":"Energy stream connected","timestamp":1790907312379}

data: {"type":"energy_update","currentEnergyBalance":450000000,"totalHarvestableEnergy":1450000000,"energyRatePerSecond":5478285.37149309,"maxCapacity":1450000000,"capacityPercentage":100,"capacityStatus":"overflow","isHarvestNeeded":true,"timeToCapacity":0,"lastUpdated":1790907313379,"…":"…"}
```

**Caching:** `Cache-Control: no-cache, no-transform`.
