# Zesty — Design

Date: 2026-09-28
App: `apps/simple-swap`, served at `zesty.charisma.rocks`
Status: approved by Ross in conversation; mockups: https://claude.ai/artifact/BbV6Qey3zazj5fPvdDuzwL

## Summary

Zesty is a one-page, guided way to bet on ZEST going up or down against sBTC. The user adds money, picks a side, sets a target (and an optional safety net), approves in their wallet, and walks away. The trade finishes itself when the price hits, with no gas for the user. It showcases what the Charisma subnet makes possible: signed trades that run while you're offline.

The user never has to think about tokens. They see **money** (USD). Behind the scenes the money is held in the subnet as sBTC or ZEST, whichever the trade needs.

## Goals

- A first-time user can go from landing to a live trade by clicking the obvious button on every screen.
- Plain language: "goes up / goes down", "sell when it hits", "safety net", "money in Zesty". No long/short, take-profit, stop-loss, subnet or sublink on screen.
- Always show how much money is in Zesty and in the wallet, and always offer a way to move it back out.
- Reuse the swap app's wallet, balances, prices, order signing, order executor and routing.

## Non-goals (v1)

- Other pairs. sBTC ⇄ ZEST only (Nakamoto Flow + Feeling Zesty: good rates, low fees).
- One-signature trades. Every trade that runs while the user is away needs its own signature (Blaze intent).
- Leverage or borrowing. "Goes down" means selling ZEST now and buying it back cheaper.
- Editing a live trade. Cancel and start again.

## How a trade works

Each side needs one token for its "later" trade. The user can start from either token; the app converts only when needed.

| Side | Later trade (the target) | Safety net | Held in Zesty while waiting |
|---|---|---|---|
| ZEST goes up | sell ZEST → sBTC when ZEST ≥ target | sell ZEST → sBTC when ZEST ≤ floor | ZEST |
| ZEST goes down | buy ZEST with sBTC when ZEST ≤ target | buy ZEST with sBTC when ZEST ≥ ceiling | sBTC |

Steps the app runs, in order, each skipped when not needed:

1. **Add money** (on-chain wallet call): deposit sBTC or ZEST from the wallet into its subnet token. Pick the wallet token that matches what the trade holds, so no conversion is needed; otherwise the other one. Wait for confirmation before continuing.
2. **Convert now** (signature): an order with `conditionToken: '*'` (runs on the next executor pass, about a minute) swapping the subnet token the user has into the one the trade holds. Route verified on a mainnet fork: `subnet sBTC → sBTC → STX → ZEST → subnet ZEST` and the reverse, via `blaze-bitcoin`, `nakamoto-flow`, `feeling-zesty`, `zest-token-sublink`, with `x-multihop-rc9` as caller.
3. **Target** (signature): the later trade, conditioned on the ZEST USD price.
4. **Safety net** (signature, optional): the opposite condition, same trade.

Target and safety net share a `strategyId` with `strategyType: 'zesty'`. When one of them is broadcast, the executor cancels the other (new: one-cancels-other).

**Amounts.** Target and safety net each spend the amount the trade holds. When step 2 runs, they're signed up front for the conversion's quoted output minus 1% (the executor's slippage), so they always fit what arrives; any remainder stays as money in Zesty.

## The page

Route: `apps/simple-swap/src/app/zesty/`. `middleware.ts` rewrites requests for host `zesty.charisma.rocks` to `/zesty`. The layout has no swap nav, is mobile-first, and uses the Stacks Workshop theme: `#FC6432` orange, black, `#141414` dark, `#F7F7F7` background, Matter font (`public/fonts/Matter-*.woff`), uppercase headers, 44px+ touch targets. Buttons use black text on orange (white on this orange fails contrast). Token icons from the token cache.

Header, always visible: connect/wallet, **Money in Zesty** (USD total of subnet sBTC + subnet ZEST) and **In your wallet** (USD total of sBTC + ZEST). Tap to see the per-token split.

Screens (one at a time, with a progress bar):

1. **Pick a side.** ZEST price now; two big cards: "ZEST goes up" / "ZEST goes down".
2. **How much.** A dollar amount with 25% / 50% / All of everything available (Zesty + wallet). If it needs money from the wallet, say so: "We'll add $X from your wallet."
3. **Set it.** Sell/buy-back price as +10 / +15 / +25% (or −, for down); safety net toggle (default on, 10% the other way); "If it hits +$A · Worst case −$B".
4. **Approve.** A checklist of the wallet steps from "How a trade works" that apply, highlighting the current one ("Check your wallet"). Waits for the deposit to confirm before the first signature.
5. **Watch.** Price now, a bar from safety net to target with the entry marked, gain so far; "Sell now" (executes the target immediately) and "Cancel" (cancels both orders; money stays in Zesty).
6. **Done.** Result and confetti; "Trade again"; "Move money to my wallet".

**Cash out** ("Move money to my wallet"): withdraw every non-zero subnet balance (sBTC, ZEST), one wallet call each. Available from the header at any time.

## New work

- `middleware.ts` host rewrite; `app/zesty/` layout and page; theme and fonts.
- A withdraw helper beside `executeDeposit` (subnet token `withdraw (amount, (some recipient))`, post-condition: the subnet contract sends exactly `amount` of the base token).
- Trade orchestration: plan the steps from side, amount and balances; sign and submit orders with the existing `signTriggeredSwap` + `/api/v1/orders/new` flow (like `lib/range/create-leg.ts`).
- One-cancels-other in the executor for `strategyType: 'zesty'`.
- Watch/Done screens read the user's `zesty` orders by `strategyId`.

## Ops

- Add the `zesty.charisma.rocks` domain to the `charisma-simple-swap` Vercel project (Ross).

## Open risks

- Public quote budget: very large ZEST trades can't be quoted over the public API (~5k STX / 8k ZEST per quote today). Cap the amount in the UI and say why.
- The conversion step waits up to a minute for the executor; the page shows progress and lets the user leave.
