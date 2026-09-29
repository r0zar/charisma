# Blaze Wallet Methods — v0.1 (draft)

Extra wallet methods for the Blaze protocol (Charisma subnets), on top of the standard Stacks wallet
provider (SIP-030 style, as used by `@stacks/connect`). Any wallet may implement them; **Signet** is the
reference wallet.

## Why

The standard gives apps `connect`, `sign` and `send`. Blaze adds two things wallets can't express today:

1. **One balance per token.** A token can sit in the wallet *and* in its subnet. Apps (and people) should see
   one number, with the breakdown available.
2. **Microtransactions without a click each time.** A person can let a site auto-sign a narrow kind of Blaze
   order (one subnet, one action, capped amounts, an expiry), and revoke it any time.

## Transport

Exactly the standard provider. Nothing new to install for apps:

```js
import { request } from '@stacks/connect'
const { tokens } = await request('blaze_getBalances')
```

- A wallet registers in `window.wbip_providers` and exposes `window.<Id>.request(method, params)`.
- Requests and answers are JSON-RPC 2.0: `{ result }` or `{ error: { code, message } }`.
- The wallet takes the site's identity from the browser (e.g. `sender.origin`), **never** from the request.
- Methods are prefixed `blaze_` because they describe the protocol, not a wallet (like `stx_` describes Stacks).

### Errors

| Code | Meaning |
|---|---|
| `-32000` | User rejected |
| `-32002` | Not allowed: the site isn't connected, or the method needs approval it doesn't have |
| `-32601` | Method not supported by this wallet |
| `-32602` | Invalid params |
| `-32603` | Internal error (message says what failed) |

## Terms

- **Subnet**: a Blaze token contract whose token-cache metadata has `type: "SUBNET"`; its `base` is the
  on-chain token it holds 1:1 (e.g. `sbtc-token-subnet-v1` → `sbtc-token`).
- **Blaze order**: a SIP-018 structured message with domain
  `{ name: "BLAZE_PROTOCOL", version: "v1.0", chain-id: u1 }` and message
  `{ contract, intent, opcode?, amount?, target?, uuid }`, signed via `stx_signStructuredMessage`.
- **Connected site**: a site the person approved in `getAddresses` / `stx_getAddresses` this session.

## Methods

### `blaze_getBalances`

The connected account's balances, **one entry per token**, wallet and subnets combined. Connected sites
only (`-32002` otherwise).

```ts
params: { tokens?: string[] }   // base contract ids to include; all held tokens when omitted
result: {
  address: string
  tokens: {
    base: string            // on-chain token contract id (".stx" for STX)
    symbol: string
    decimals: number
    total: string           // smallest units: wallet + all subnets
    wallet: string          // on-chain balance
    subnets: { contractId: string; balance: string }[]
  }[]
}
```

Amounts are strings in the token's smallest unit. A token whose metadata the wallet can't verify is left
out rather than shown with guessed decimals.

### `blaze_requestAutoApprove`

Ask the person to let this site auto-sign a narrow kind of Blaze order. The wallet shows one approval;
afterwards, matching `stx_signStructuredMessage` requests from this site are signed without prompting.

```ts
params: {
  subnet: string            // one subnet contract id
  intents: string[]         // e.g. ["TRANSFER_TOKENS"]
  maxPerOrder: string       // smallest units, per signature
  maxTotal: string          // smallest units, across all auto-signed orders
  expiresIn: number         // seconds; the wallet may shorten it
}
result: { rule: AutoApproveRule }   // as granted (the person may lower limits or expiry)
```

```ts
interface AutoApproveRule {
  id: string
  origin: string            // set by the wallet from the browser
  subnet: string
  intents: string[]
  maxPerOrder: string
  maxTotal: string
  spent: string             // total auto-signed so far
  expiresAt: number         // ms since epoch
}
```

**An order is auto-signed only when all of these hold**, otherwise the normal approval appears:

1. The request comes from the rule's `origin`, and the rule hasn't expired or been revoked.
2. The domain is the Blaze v1 domain.
3. `message.contract` is the rule's `subnet` and `message.intent` is in `intents`.
4. `message.amount` is present and ≤ `maxPerOrder`, and `spent + amount` ≤ `maxTotal`.
5. `message.target`, if present, is a router that pays out only to the signer (`x-multihop-v1`). Orders
   whose payout the submitter chooses (e.g. `x-multihop-rc9`) are never auto-signed.

The wallet adds `amount` to `spent` for every auto-signed order, and keeps a record the person can review.

### `blaze_getAutoApprove`

This site's own active rules (never other sites'). No approval needed.

```ts
params: none
result: { rules: AutoApproveRule[] }
```

### `blaze_revokeAutoApprove`

Drop one of this site's rules, or all of them. No approval needed. The person can also revoke any rule from
the wallet itself.

```ts
params: { id?: string }     // all of this site's rules when omitted
result: { revoked: number }
```

## Not in v0.1

- **Listing subnets**: public data (token cache `type: "SUBNET"`, or the chain). Apps look it up directly; the
  wallet isn't the source of truth for which tokens exist. `blaze_getBalances` already names each balance's subnet.

- **Saved signatures**: signing Blaze orders to keep in the wallet and hand to a site or relayer later.
- **Source-agnostic send**: "send 10 WELSH", with the wallet choosing wallet, subnet, or both.
- App-specific actions (prediction markets, rewards, subnet deployment): these belong to apps, built on
  `stx_signStructuredMessage` and `stx_callContract`.
