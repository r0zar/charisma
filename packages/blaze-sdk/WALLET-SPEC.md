# Blaze Wallet Methods — v0.1 (draft)

Extra wallet methods for the Blaze protocol (Charisma subnets), on top of the standard Stacks wallet
provider (SIP-030 style, as used by `@stacks/connect`). Any wallet may implement them; **Signet** is the
reference wallet.

## Why

**Microtransactions without a click each time.** The standard wallet asks before every signature. For Blaze
that's too much friction: games and tiny payments sign many small messages. These methods let a person allow
a site to auto-sign a narrow kind of Blaze message (one subnet, chosen actions, capped amounts, an expiry), and
revoke it any time.

**Principle:** a wallet method only covers what the wallet alone knows or controls: its keys and the person's
choices. Anything public (which subnets exist, balances once an app has the address) apps look up directly,
e.g. with `blaze-sdk` or `@repo/tokens`.

## Transport

Exactly the standard provider. Nothing new to install for apps:

```js
import { request } from '@stacks/connect'
const { rule } = await request('blaze_requestAutoApprove', { subnet, intents, maxPerMessage, maxTotal, expiresIn })
```

- A wallet registers in `window.wbip_providers` and exposes `window.<Id>.request(method, params)`.
- Requests and answers are JSON-RPC 2.0: `{ result }` or `{ error: { code, message } }`.
- The wallet takes the site's identity from the browser (e.g. `sender.origin`), **never** from the request.
- Methods are prefixed `blaze_` because they describe the protocol, not a wallet (like `stx_` describes Stacks).

### Errors

| Code | Meaning |
|---|---|
| `-32000` | User rejected |
| `-32601` | Method not supported by this wallet |
| `-32602` | Invalid params |
| `-32603` | Internal error (message says what failed) |

## Terms

- **Subnet**: a Blaze token contract whose token-cache metadata has `type: "SUBNET"`; its `base` is the
  on-chain token it holds 1:1 (e.g. `sbtc-token-subnet-v1` → `sbtc-token`).
- **Blaze message**: a SIP-018 structured message with domain
  `{ name: "BLAZE_PROTOCOL", version: "v1.0", chain-id: u1 }` and message
  `{ contract, intent, opcode?, amount?, target?, uuid }`, signed via `stx_signStructuredMessage`.

## Methods

### `blaze_requestAutoApprove`

Ask the person to let this site auto-sign a narrow kind of Blaze message. The wallet shows one approval;
afterwards, matching `stx_signStructuredMessage` requests from this site are signed without prompting.

```ts
params: {
  subnet: string            // one subnet contract id
  intents: string[]         // e.g. ["TRANSFER_TOKENS"]
  maxPerMessage: string       // smallest units, per signature
  maxTotal: string          // smallest units, across all auto-signed messages
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
  maxPerMessage: string
  maxTotal: string
  spent: string             // total auto-signed so far
  expiresAt: number         // ms since epoch
}
```

**A message is auto-signed only when all of these hold**, otherwise the normal approval appears:

1. The request comes from the rule's `origin`, and the rule hasn't expired or been revoked.
2. The domain is the Blaze v1 domain.
3. `message.contract` is the rule's `subnet` and `message.intent` is in `intents`.
4. `message.amount` is present and ≤ `maxPerMessage`, and `spent + amount` ≤ `maxTotal`.
5. `message.target`, if present, is a router that pays out only to the signer (`x-multihop-v1`). Messages
   whose payout the submitter chooses (e.g. `x-multihop-rc9`) are never auto-signed.

The wallet adds `amount` to `spent` for every auto-signed message, and keeps a record the person can review.

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

## Not wallet methods

Public data, so apps look it up directly rather than asking the wallet:

- **Which subnets exist**: token cache `type: "SUBNET"`, or the chain.
- **Balances**, wallet and subnet combined: public once the app has the address (from `getAddresses`).

## Later

- **Bulk signing** (`blaze_signStructuredMessages`, the plural of the standard `stx_signStructuredMessage`): sign
  many Blaze messages from one approval, e.g. 60 shown as one card with the count, totals per token and payout
  router, instead of 60 separate prompts. Auto-approve rules can cover a batch too. (Not "multi-signature":
  in Stacks that means several signers on one transaction.)
- **Saved signatures**: signing Blaze messages to keep in the wallet and hand to a site or relayer later.
- **Source-agnostic send**: "send 10 WELSH", with the wallet choosing wallet, subnet, or both.
- App-specific actions (prediction markets, rewards, subnet deployment) belong to apps, built on
  `stx_signStructuredMessage` and `stx_callContract`.

## Vision: the wallet as a node

Signet's hackathon version held pending Blaze messages in the browser and settled them itself: a subnet
mempool running inside the wallet. That removes the dependency on any one server, and it's the long-term
direction. It needs three things first: durable storage (extension memory is wiped often), wallets sharing
messages with each other, and a way to pay settlement fees. **Saved signatures** is the first step.
