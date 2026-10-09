---
sidebar_position: 8
title: Instant balances
---

A wallet's balances the moment something happens, not when the next block lands: a swap the user just approved, a
transfer from another wallet that's still waiting to be mined, a signed DCA or limit order that hasn't run yet. Charisma's
balance service reads the chain itself, so apps report nothing.

```bash
npm install blaze-sdk
```

## Watch a wallet

```ts
import { watchBalances, combineSubnets } from 'blaze-sdk';

const stop = watchBalances('SP…', sheet => {
  const totals = combineSubnets(sheet); // one number per token, Stacks and Blaze added together
  render(totals['SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.charisma-token'].ready);
}, { onProblem: error => console.warn(error.message) });

// later
stop();
```

The service pushes a new sheet whenever the wallet's balances change, usually within two or three seconds of a
transaction reaching the mempool or a block. There's no polling. The connection reconnects on its own. `watchBalances`
reads the stream with `fetch`, so it works in browsers, extensions (service workers included) and Node 18+.

For a single reading, use `getBalances(address)`.

## The balance sheet

Each token is one contract: STX (`.stx`), a SIP-010 token, or a Blaze subnet (`base` names its underlying token).

| Field | Meaning |
|---|---|
| `settled` | On the chain, in smallest units. `null` when it couldn't be read (`error` says why) |
| `pending` | Sum of changes sent and waiting for a block |
| `held` | Sum of holds: money promised to signed orders and bets that haven't run (zero or negative) |
| `ready` | `settled + pending`: the balance once what's on its way lands. Holds don't come off, because signing doesn't lock funds: the owner can still move them, and an order that finds them gone skips. Orders promise more than the wallet holds when `ready + held` is below zero |
| `entries` | Every change behind those numbers |

Each entry has a `stage` (`pending` or `hold`), a `kind` (`transfer`, `swap`, `deposit`, `withdraw`, `fee`, `order`,
`bet`), a signed `amount`, and the `txid` or public `order` handle that proves it. A swap's output `amount` is its likely
amount from a live quote. `min` is the least it can settle at, when the transaction's post-conditions guarantee one.

`failed` lists transactions that failed or were dropped in the last few minutes. Their entries have already snapped back
out of the numbers, so a screen can tell the user why the balance moved back.

## What counts

| Happens | Shows |
|---|---|
| A transfer, network fee, or move onto Blaze and back | As soon as it's in the mempool, exact |
| A swap through Charisma's routers, from a wallet or a Blaze order | As soon as it's in the mempool, at its likely amount |
| A signed Blaze transfer, whoever sends it | As soon as it's in the mempool; the signer is recovered from the signature |
| A signed order or a Meme Roulette bet | The moment it's signed, as a hold |
| Any other contract call | Its fee at once, the rest when its block lands |

## HTTP

| Endpoint | Returns |
|---|---|
| `GET https://swap.charisma.rocks/api/v1/balances/{address}/sheet` | The sheet as JSON |
| `GET https://swap.charisma.rocks/api/v1/balances/{address}/stream` | Server-sent events: `sheet` (the sheet as JSON) on open and on every change, `problem` when balances couldn't be read |
