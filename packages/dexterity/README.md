# dexterity-sdk

Quote and route swaps on Stacks across Charisma's Dexterity vaults, including wrapped Bitflow, ALEX, Arkadiko and
Velar pools. Full docs: https://docs.charisma.rocks/docs/dex-api/overview

```bash
npm install dexterity-sdk
```

## Quote through the Charisma API

```ts
import { fetchQuote } from 'dexterity-sdk';

// 1 STX (in micro-STX) to CHA; returns the route: path, hops (vault, opcode, per-hop quote), amountIn, amountOut
const route = await fetchQuote('.stx', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', 1_000_000);
```

## Route locally

```ts
import { createRouter } from 'dexterity-sdk';

const router = await createRouter({ maxHops: 4 }); // loads vaults from https://invest.charisma.rocks
const best = await router.findBestRoute('.stx', 'SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token', 1_000_000);
```

`buildSwapTransaction` and `buildSwapPostConditions` build the contract call with deny-mode post-conditions for a
route. Bin (DLMM) and stableswap pools are priced with an on-chain spot-price probe (`withSpotPrices`).

## 0.9

0.9 is a rewrite of 0.8: the CLI is gone, and the router covers external pools.

MIT licensed.
