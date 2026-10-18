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

`findBestRoute` uses real on-chain quotes only: hop by hop it quotes every pool out of every token reached and keeps
the most of each token, up to `maxHops` (default 4, one more for a trade in or out of a subnet). Nothing is
estimated, so a pool whose balances don't show its price (bin or stable pools) can't hide the best route.

`buildSwapTransaction` and `buildSwapPostConditions` build the contract call with deny-mode post-conditions for a
route.

`findBestRoute` returns an empty route (`amountOut: 0`) when no path connects the tokens, and throws, saying why,
when paths exist but none can be quoted.

## 2.0

2.0 finds routes with real quotes only. `withSpotPrices`, `isPricedByQuote`, `Vault.spotPrice` and `maxPathsToEvaluate` are gone, and `maxHops` defaults to 4 (was 5).

## 1.0

1.0 is a rewrite of 0.8: the CLI is gone, the router covers external pools, and from here the API follows semver.

MIT licensed.
