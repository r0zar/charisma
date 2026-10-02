---
sidebar_position: 5
title: Swap routers
---

A router turns one signed `TRANSFER_TOKENS` into a multi-hop swap that pays out a SIP-010 token.

| | `x-multihop-v1` | `x-multihop-rc9` |
|---|---|---|
| Contract | `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-v1` | `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.x-multihop-rc9` |
| Deployed | 2026-09-28 | 2025-05-08 |
| `out.to` | Must equal the signer `blaze-v1` recovers, or `err u403` | Any principal the caller passes |
| Hops and output token | Caller parameters | Caller parameters |
| Extra public functions | None | `test-x-deposit`, `test-execute`, `test-withdraw` |
| blaze-sdk constant | `MULTIHOP_CONTRACT_ID` (the default) | `LEGACY_MULTIHOP_CONTRACT_ID` |
| Used for | New orders | Orders signed for rc9 before v1 existed, and Twitter triggers that pay repliers |

`test-withdraw` on rc9 sends any token rc9 holds to any address the caller names, so anything left in rc9 is anyone's. Never send tokens to a router directly.

## x-swap-N

Both routers expose `x-swap-1` through `x-swap-5`, one per hop count:

```clarity
(define-public (x-swap-2
    (in {token: <subnet-trait>, amount: uint, signature: (buff 65), uuid: (string-ascii 36)})
    (hop-1 {vault: <vault-trait>, opcode: (buff 16)})
    (hop-2 {vault: <vault-trait>, opcode: (buff 16)})
    (out {token: <sip10-trait>, to: principal}))
```

In `x-multihop-v1`, each call:

1. Recovers the signer with `blaze-v1` `recover` over `in.token`, `TRANSFER_TOKENS`, `in.amount`, target = this router, `in.uuid`, and requires `out.to` to equal it.
2. Calls `x-transfer` on `in.token`, moving `in.amount` from the signer to the router. This spends the UUID.
3. Calls `execute` on each hop's vault as the router, feeding each hop's output into the next. Hop 1 is normally the subnet's sublink vault with opcode `0x06`, which withdraws the router's subnet balance as the underlying token.
4. Transfers the last hop's output of `out.token` to `out.to`.

Any failure aborts the whole transaction. rc9 is the same without step 1. The [overview](./introduction.md) shows this flow as a diagram.

## No minimum output on-chain

The signature covers the subnet, amount, router and UUID. Neither router checks a minimum output. Slippage is enforced by deny-mode post-conditions that Charisma's executor attaches (`buildPostConditions` in `blaze-sdk` `solvers/vaults/utils/postconditions.ts`):

| Post-condition | Bound |
|---|---|
| Router sends each non-subnet input token | At most the quoted input plus slippage |
| Whoever pays out each hop (vault, pool or subnet) | At least the quoted output minus slippage |
| Router sends the final token | At least the quoted output minus slippage |

Slippage defaults to 1% of a fresh quote taken at execution time, not the price the user saw when signing.

## Which router a signature is for

The router is the signed `target`, so a signature works only on the router it names. `findSignedRouter(signature, uuid, subnet, amount, expectedSigner)` tries each id in `MULTIHOP_CONTRACT_IDS` with `recover` and returns the one that recovers to `expectedSigner`. `/orders/new` uses it when an order omits `router`.

## Building and broadcasting

```ts
import { buildXSwapTransaction, broadcastMultihopTransaction, routerConfigFor, MULTIHOP_CONTRACT_ID } from 'blaze-sdk';

// route: a dexterity-sdk route (path, hops with quotes)
const tx = buildXSwapTransaction(
  route,
  { amountIn, signature, uuid, recipient: owner, slippage: 1 },
  routerConfigFor(MULTIHOP_CONTRACT_ID),
);
const result = await broadcastMultihopTransaction(tx, solverPrivateKey); // deny mode, fee capped at 0.01 STX
```
