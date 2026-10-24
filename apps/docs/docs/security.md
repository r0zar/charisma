---
id: security
title: Security
---

# Is it safe to trade through Charisma pools?

**Yes.** Every Charisma pool is its own small contract. Nobody, not even Charisma, holds a key that can pause it, change it or take from it. And because contracts on Stacks can never be edited, that will always be true.

## Every pool stands alone

Many DEXes run every pool from one shared contract, with admin keys that can change it. One mistake or one stolen key can touch everything.

Charisma doesn't work that way. Each pool is a separate contract that holds only its own two tokens.

```mermaid
flowchart TB
    subgraph many["Many DEXes"]
        key["🔑 Admin key"] --> hub["One shared contract"]
        hub --> a1["Pool"]
        hub --> a2["Pool"]
        hub --> a3["Pool"]
    end
    subgraph charisma["Charisma"]
        p1["Pool<br/>its own tokens<br/>no key"]
        p2["Pool<br/>its own tokens<br/>no key"]
        p3["Pool<br/>its own tokens<br/>no key"]
    end
```

## Why it's safe

| | Protection | What it means |
|---|---|---|
| 🧱 | **Every pool stands alone** | A pool holds only its own two tokens. A problem in one pool can't reach any other |
| 🔑 | **No master key** | No one can pause a pool, change its fee or withdraw from it. The only thing a pool's creator can change is its name and picture |
| 🔒 | **Nothing can change later** | A pool's code is locked the moment it goes live. New contracts can't change old ones |
| 🚪 | **Just in and out** | A swap does one thing: your tokens go in, the other token comes out. If it can't finish, nothing moves |
| 🎯 | **What it quotes is what it pays** | A Charisma pool works out the quote and the swap with the same math |
| 👀 | **Open for anyone to read** | Every pool's code is public on-chain, and it's short |

## Permanently secure, by design

These protections aren't promises or settings. They're how the pools are built.

There is no admin to make a bad call later, no upgrade that could slip in a change, and no key to lose or steal. So no future mistake, by Charisma or anyone else, can make a pool less safe than it is today.

**The security you get today is the security you'll always get.**

## One simple shape for every pool

Every Charisma pool speaks the same language, called **Dexterity**. Charisma proposed it as a Stacks standard in December 2024 ([SIP draft #204](https://github.com/stacksgov/sips/pull/204)).

It gives every pool the same two buttons:

| Button | What it does |
|---|---|
| `quote` | "What would I get?" Answers without changing anything |
| `execute` | "Do it." Runs the swap |

Because every pool has the same two buttons, any app or router, Charisma's or anyone else's, can connect to any pool. No special code, and no permission needed.

```mermaid
flowchart LR
    app["Charisma app"] --> p1["Pool"]
    app --> p2["Pool"]
    other["Another DEX's router"] --> p2
    other --> p3["Pool"]
    yours["Your own contract"] --> p3
```

## What we checked

On 23 Oct 2026 we read the live code of all 155 pools on Charisma's list. Not one has a way to withdraw other people's tokens, pause trading or change its fee.

Before listing a new pool, Charisma tests it on a copy of mainnet to prove that what it quotes is exactly what it pays.

## What this doesn't cover

| Risk | What to know |
|---|---|
| 📉 **Prices move** | A pool can't stop the market moving. Set a minimum amount you'll accept on every swap |
| 🪙 **Tokens are their own thing** | A pool is only as good as the two tokens in it. Charisma can't vouch for every token |
| 🔗 **Pools from other DEXes** | Charisma also lists pools from Bitflow, ALEX, Velar and others. Those follow their own DEX's rules |

## Frequently asked questions

### Bad tokens and bad pools

<details>
<summary>What if a pool's token takes everything I send?</summary>

A pool like that pays back little or nothing, so its price looks bad. Routers always pick the pool that pays you the most, so it never gets chosen.

</details>

<details>
<summary>What if a pool lies about its price to get picked?</summary>

Every swap carries a minimum you'll accept, based on that price. If the pool pays less than it promised, the whole swap is undone and you keep your tokens.

This has happened once: a listed pool promised a price it couldn't pay. The swap was undone, and the pool was removed from the list.

</details>

<details>
<summary>What if a token tries to take a different token from my wallet?</summary>

A swap lists every token that's allowed to move. If anything else moves, the whole swap is cancelled. Charisma's app builds every swap this way, and so do the aggregators that route through its pools.

</details>

<details>
<summary>What if a bad token is in the middle of a multi-hop route?</summary>

Every hop has its own limits. If one hop breaks them, every hop is undone.

</details>

<details>
<summary>What about fake tokens that copy a real one's name and logo?</summary>

Tokens are matched by their contract address, not their name. A copycat is a different contract, so it's never on the route to the real token.

</details>

### The pools themselves

<details>
<summary>Can anyone change a pool's fee or rules after it launches?</summary>

No. A Charisma pool's fee, which goes entirely to its liquidity providers as a rebate, is written into its code when it's deployed. So is every rule that matters. Nobody can change them later, not even the pool's creator.

To offer different terms, someone has to deploy a brand-new pool. Liquidity never moves on its own: each provider decides for themselves whether to take theirs out and move it.

So nothing changes while you're not looking, and everyone opts in, pool by pool. The free market picks the best pools: providers choose where to put their liquidity, and traders choose where to trade.

</details>

<details>
<summary>Can someone drain a pool?</summary>

No. Tokens leave a pool in only two ways: a swap that pays the pool's price, or a liquidity provider cashing out their own share.

</details>

<details>
<summary>Can a pool's creator rug it?</summary>

The creator is just another liquidity provider. They can take out their own share, like anyone else, but they can't touch anyone else's, change the fee or pause trading.

If one person owns most of a small pool and takes their share out, the pool gets thin, so check who's in a pool before you add to it.

</details>

<details>
<summary>Could a bug in one pool spread to others?</summary>

No. Each pool is its own contract with its own tokens. Nothing is shared.

</details>

### Trading

<details>
<summary>Can someone trade just ahead of me?</summary>

Yes, anyone can see a swap while it's waiting to confirm. But your minimum still holds, so the most it can cost you is your slippage setting.

</details>

### Charisma itself

<details>
<summary>What happens if Charisma disappears?</summary>

The pools keep working. Anyone can still trade through them or withdraw their liquidity, from any app or straight on-chain.

</details>

<details>
<summary>Wasn't Charisma hacked in 2024?</summary>

In September 2024, an attacker exploited the old Charisma DAO's voting system, not the pools. They minted tokens and sold them. The DAO was shut down afterwards, and today's pools have no connection to it.

Charisma's developer took full responsibility and has been paying affected users back from personal funds. Everyone affected received IOU tokens: a one-for-one claim on exactly what they lost, redeemable for the original tokens. Progress is tracked live, on-chain, at [recovery.charisma.rocks](https://recovery.charisma.rocks).

Users come first at Charisma, even when it costs the people who build it.

</details>

## Trading on the Charisma app?

On [swap.charisma.rocks](https://swap.charisma.rocks), a swap can hop through several pools in one go, using Charisma's multi-hop router. The router never holds your tokens: each pool trades with your wallet directly, and your wallet shows the most you'll send and the least you'll get before you sign. If any hop falls short, the whole swap is undone.

[How the routers work](./dexterity/overview.md#why-one-interface) has the details.

<details>
<summary>For developers</summary>

The interface every pool implements, `SP2ZNGJ85ENDY6QRHQ5P2D4FXKGZWCKTB2T0Z55KS.dexterity-traits-v0`:

```clarity
(define-trait liquidity-pool-trait
  (
    (execute
      (uint (optional (buff 16)))
      (response (tuple (dx uint) (dy uint) (dk uint)) uint))
    (quote
      (uint (optional (buff 16)))
      (response (tuple (dx uint) (dy uint) (dk uint)) uint))
  )
)
```

- **Swaps.** `execute(amount, 0x00)` swaps token A for B, and `0x01` swaps B for A. `dy` is the amount out. See [The opcode](./dexterity/opcodes.md).
- **No custody.** The pool takes the input from `tx-sender` and pays the output to `tx-sender`. Nothing passes through a third contract.
- **Exact quotes.** In the [pool template](https://launchpad.charisma.rocks/templates/liquidity-pool), `execute` pays out the result of the same read-only function `quote` returns, on the pool's real token balances.
- **Payout limits.** Pools built from the Clarity 4 template name the exact token and amount each payout may send (`as-contract?`). Anything else aborts.
- **The list.** Every listed pool is served by the [Invest API](./data-apis/invest-api.md#get-vaults). [Vault kinds](./dexterity/vault-kinds.md) covers each kind.

</details>
