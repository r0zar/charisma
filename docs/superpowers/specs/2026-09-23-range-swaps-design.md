# Range Swaps — Design

Date: 2026-09-23
App: `apps/simple-swap`
Status: approved by Ross via the design artifacts (Range Swaps v7, Range Orders Card v1)

## Summary

Range Swaps is a full-page pro mode under a new **Advanced** menu in the top nav. A user picks a pair of subnet tokens, sets a sell line above current price and a buy line below it, tilts the band, chooses a window length and a run length, and signs one order per leg per window. Every window gets a sell order at the top line and a buy order at the bottom line. Legs are independent: a window can fill one, both, or neither. Fills on one side refill the other, so a run can continue past the wallet's starting balance.

It replaces the manual process of building two Triggered Swaps per window by hand.

## Goals

- Set up a repeating sell-high / buy-low pair from one chart in under a minute.
- Show an honest profit preview before signing.
- Reuse the existing order pipeline, signing loop, chart, and Orders grouping.
- Give the Orders page a card that answers: what hit, what it made, what's next, is a side about to run dry.

## Non-goals (v1)

- A new server-side strategy order type. Every leg is a normally signed order.
- Pausing a run. Signed orders can only be cancelled.
- Independent tilt per line. Both lines share one slope.
- The buy leg spending the sell's proceeds. Each leg is a fixed USD amount.
- Extending a run in place. "Run again with these settings" recreates it.

## Decisions already made

| Topic | Decision |
|---|---|
| Placement | Full page at `/advanced/range`, linked from an **Advanced ▾** menu in the top nav beside Swap and Orders. The swap card and its Instant/Triggered toggle are untouched. |
| Name | Range Swaps. |
| Leg sizing | Fixed USD per swap, converted to token amounts at creation using the price feed. |
| Default band | Sell +8%, buy −8% around current price. |
| Tilt | One shared slope, set by a slider, expressed as % change by the end of the run. |
| Signing | Sequential, one wallet signature per order, same loop as Split Swap. |
| Order cap | 200 orders per sitting. |
| Gas | Left out of the math. |
| Slippage | 1% per leg, the executor's default. |
| Volatility read (wizard) | Count of band crossings over the last 30 days, per band width. |
| Token selector | New subnet-pair selector, also adopted by Triggered Swaps. |

## The page

Route: `apps/simple-swap/src/app/advanced/range/page.tsx`, client component tree under `src/components/range/`.

Layout at desktop width: chart on the left two thirds, a controls rail on the right, and the execution schedule and signing status underneath once orders exist. On narrow screens the rail stacks under the chart.

### Chart

Extends the trigger chart (`condition-token-chart.tsx`) rather than forking it:

- 7D default with the existing 24H / 7D / 30D toggle. The x-axis extends past "now" to the end of the run so the band is visible across its whole life.
- The band is two extra line series (not price lines, which lightweight-charts draws horizontal): sell (orange, existing target colour) and buy (green), each spanning from "now" to run end with the tilt applied. Two points per series.
- Both lines are draggable as a whole, up or down, via pointer events on the chart container: hit-test the pointer against each band series' y at that x, capture the pointer, and convert vertical movement with `series.coordinateToPrice`. There are no point handles. `condition-token-chart.tsx` has no drag handling today; this is new work.
- Autoscale includes both lines (extend `includeTargetInRange` to take a list of prices).
- Faint dotted vertical lines at each window boundary across the future region, so the number of sell/buy opportunities is visible; when a run has more than ~90 windows, draw every k-th boundary so at most ~90 lines show.

### Controls rail, top to bottom

1. **Pair.** Two subnet-pair selectors (see below). Swapping order is allowed.
2. **Band.** "Sell above +X%" and "Buy below −Y%" numeric inputs, percent of current price, two-way bound with the lines. Resulting prices shown beside them.
3. **Per swap.** USD amount. Shows the resulting token amounts for each leg.
4. **Trigger every.** 6 hours, Day, Week (hourly was judged too frequent; custom hours deferred).
5. **Run for.** 1 week, 1 month, 3 months, Custom days.
6. **Tilt.** Slider from −40% to +40%, labelled "+10% by the end".
7. **Profit preview** card (below).
8. **Create button.** Label is always "Create N orders" with a subline "N signatures, one after another · sells cover A windows, buys cover B".
9. **Guide me** button at the top of the rail opens the wizard.

### Profit preview

Per completed cycle, where one cycle is a sell at the top line and a buy at the bottom line. Costs come from two live router quotes (the same `getQuote` the swap page uses), not a fixed slippage figure:

```
sellIn      = perSwapUsd / priceA           (A sent by the sell leg)
buyIn       = perSwapUsd / priceB           (B sent by the buy leg)
sellOut     = router quote for sellIn A → B
buyOut      = router quote for buyIn B → A
routeCost   = (sellIn × priceA − sellOut × priceB) + (buyIn × priceB − buyOut × priceA)
spread      = sell / buy − 1
gross       = perSwapUsd × spread
net         = gross − routeCost
breakEven   = routeCost / perSwapUsd         (spread must exceed this)
ifAll       = net × windows
```

Quotes are requested with the subnet contract ids and the same rounded micro amounts the orders will carry, debounced 400 ms on pair / amount / decimals changes only (not on price ticks). While quotes are pending the row reads "Waiting for route quotes" and the button is disabled; a router error shows its message there. The route cost may be negative when a quote beats mid price; it is not clamped.

Shown as: band summary, net per cycle, route cost per cycle (with a tooltip explaining the mid-price comparison), a "Guaranteed minimum: 99% of the quote at execution" line derived from the executor's default 1% slippage post-condition, and the big number "if every window completes a cycle" with that assumption in the label. Spread below break-even turns the preview red and disables the button. The preview never estimates fill rate.

### Order generation

```
N            = floor(runHours / intervalHours)
start        = now
for i in 0..N-1:
  sell_i     = sellStart × (1 + tilt × i / max(N − 1, 1))
  buy_i      = buyStart  × (1 + tilt × i / max(N − 1, 1))
  validFrom  = start + i × interval
  validTo    = start + (i + 1) × interval

  sell leg:  from A (subnet) → B, amount = perSwapUsd / priceA,
             trigger ratio A/B ≥ sell_i, window [validFrom, validTo)
  buy leg:   from B (subnet) → A, amount = perSwapUsd / priceB,
             trigger ratio A/B ≤ buy_i, same window
```

Contract ids per field, matching the existing ratio trigger:

- `inputToken` / `outputToken`: the subnet contract ids (the "from" side must be subnet; the "to" side is the other token's subnet id so the buy leg can be sent from it later).
- `conditionToken` / `baseAsset`: the mainnet contract ids the price service knows. The executor evaluates `price(conditionToken) / price(baseAsset)`, so `conditionToken = A`, `baseAsset = B`, sell leg `direction: 'gt'`, buy leg `direction: 'lt'`.

`createSingleOrder` in `useRouterTrading` cannot be reused: it hardcodes `conditionToken: '*'`, `targetPrice: '0'`, `direction: 'gt'`, `strategyType: 'dca'`, and takes input/output from the swap context. Add `createRangeLeg(spec)` to the hook that takes explicit input/output subnet ids, condition token, base asset, target price, direction, window, and strategy fields, and reuses only `signTriggeredSwap` and the `POST /api/v1/orders/new` call. The API schema is `.passthrough()`, so the new fields land without a route change.

Strategy fields on every leg: one `strategyId` for the run, `strategyPosition` 1-based (matching DCA), `strategySize = 2N`, `strategyType: 'range'`, `leg: 'sell' | 'buy'`, and `metadata.range` (see data model). Signing is sequential with the same status list Split Swap shows. The first rejected signature aborts the remaining orders; already-signed orders stay.

### Guardrails

- Both tokens must have subnet versions. The selector only lists tokens the wallet holds on the subnet.
- Sell line must be at least 0.5% above current price and buy line at least 0.5% below (exactly 0.5% is allowed, matching the inputs' minimum). Otherwise the button disables and says why.
- Spread must exceed break-even, else the button disables.
- `2N > 200` disables the button: "Too many orders (2N). Cap is 200 in one sitting. Widen the interval or shorten the run." The interval and run presets that would exceed the cap with the other current setting are greyed out so the button rarely reaches that state.
- Balance coverage is shown, not enforced: "sells cover A windows, buys cover B", where A = floor(balanceA / amountA).
- If price only trends one way, only one leg fires. Accepted; the preview text says so.

## Guide me wizard

Optional. A modal flow that ends by filling the page's controls. Six steps, one question each:

1. **Goal.** USD amount and deadline (1 week / 1 month / 3 months). Deadline becomes the run length.
2. **Pair.** Two subnet-pair selectors.
3. **Volatility read.** Shown, not asked: 30-day ratio chart, its range, and how many times it crossed ±4%, ±8%, ±15% bands. Copy: "At last month's pace, ±8% completed 6 cycles."
4. **Risk dial.** Narrow to wide band. For each position, show what last month's crossings would have earned toward the goal at the current per-swap amount.
5. **Per swap.** Pre-filled from goal and dial: the smallest amount for which `expectedCycles × net ≥ goal`, capped by the smaller side's balance coverage. If the goal isn't reachable, say so and show the closest reachable number.
6. **Review.** The filled panel summary. "Looks right, take me there" applies the values to the page. Back goes to any step.

Band crossings are computed client-side from the hourly ratio series already fetched for the chart: count the times the ratio crosses from below the buy line to above the sell line (a completed cycle), for each candidate band width, ignoring tilt.

## Subnet-pair token selector

New component `SubnetPairSelector` (also adopted by Triggered Swaps in a follow-up, not this plan):

- Lists only tokens that have a subnet version and that the connected wallet holds on the subnet, with the subnet balance and its USD value on each row (the mainnet balance is not shown; `TokenDropdown` gains a `balanceMode: 'subnet'` option and an `includeStx: false` opt-out for its synthetic STX row).
- Search by name, symbol, or address.
- Empty states: no subnet-funded tokens at all: "Range Swaps need tokens on the subnet. Move some over from the swap page."; exactly one, so the second selector is empty: "Range Swaps need two subnet-funded tokens. Move another over from the swap page."

## Orders page

### Data model additions

On `LimitOrder` (`src/lib/orders/types.ts`):

- `strategyType` gains `'range'`. The same union must gain `'range'` in `createTriggeredSwap`'s options, `StrategyDisplayData.type` in `strategy-formatter.ts`, `detectStrategyType` in `strategy-cards/utils/strategy-detector.ts`, and the `StrategyComponentRegistry`.
- New `leg?: 'sell' | 'buy'`.
- New `metadata.range`, written on every leg at creation:

```
{ pair: { a, b }, subnet: { a, b }, sellStart, buyStart, tilt, intervalHours, windows, perSwapUsd, createdAt }
```

The band settings ride on the signed orders themselves, so there is no separate strategy record, no new store, and no new route. The card reads `metadata.range` from the first order in the group. Repeating it on every leg keeps the group self-describing after partial cancels.

### Card

`RangeStrategyCard` registered in `StrategyCardFactory` for `strategyType === 'range'`.

Collapsed row: pair, cadence, "window i of N", realized profit, a runway warning pill when a side is under 3 windows, and the status pill.

Expanded card:

- Header: pair, cadence, window count, start date, status pill, next-window countdown.
- Chart: price so far with the band drawn from `metadata.range`, filled legs as solid dots, expired legs as hollow dots, future windows greyed.
- Stats: Realized, Cycles done ("2 of 8 so far"), Sells hit with unmatched count, Buys hit, Open position, Hit rate. Completed runs add Best window and Avg per cycle.
- Runway: per side, `floor(subnetBalance / legAmount)` recomputed from the live balance context. Amber under 3 with a banner and a "Top up" action that opens the swap page pre-filled to move that token to the subnet; red at 0.
- Window list: every window with both legs, hit / expired / open / future, fill amount and tx id on hits, per-order cancel on open legs. "Cancel remaining" cancels every open order in the strategy and confirms with the count.

States: Live, Low runway (Live + banner), Completed ("Run again with these settings" links to the page with `metadata.range` pre-filled), Cancelled.

### Metric definitions

Leg outcome, derived from existing order fields (no executor change):

- **Hit.** `status === 'confirmed'`.
- **Expired.** `status === 'cancelled'` and `cancelledAt >= validTo` (the executor cancels past-window orders this way), or `status === 'failed'`.
- **Cancelled.** `status === 'cancelled'` and `cancelledAt < validTo` (a user cancel).
- **Open.** `status === 'open'` inside its window, or `status === 'broadcasted'` at any time (a transaction is in flight, confirmations can land after the window ends).
- **Future.** `status === 'open'` and `validFrom` is ahead.

Run status: **Live** while any leg is Open or Future; otherwise **Cancelled** if at least one leg was user-cancelled, else **Completed**. Cancelling a single leg leaves the run Live.

Fill amounts and prices: the executor stores `metadata.quote` (`amountIn`, `amountOut`, `timestamp`) before broadcasting. Treat `amountOut` as the fill amount and price it in USD from the hourly price series at `quote.timestamp`, falling back only to `confirmedAt` when the quote has no timestamp (never `createdAt`, which is the run's creation time). A hit leg with no quote or no usable time is counted as an unpriced leg and excluded from realized and open position; a pair whose price lookup returns null is counted as an unpriced pair. The card shows both counts. This is an approximation and the card labels it "at quote".

- **Realized.** Match each hit buy with the earliest unmatched hit sell before it. Realized = Σ (sell `amountOut` × USD price of B at its quote time − buy `amountIn` × USD price of B at its quote time) over matched pairs. Unmatched legs contribute nothing.
- **Open position.** Unmatched hit legs, expressed in the token received.
- **Cycles done.** Number of matched pairs, out of windows whose `validTo` has passed.
- **Hit rate.** Hit legs ÷ legs whose window has ended.

## Error handling

- Quote or price feed unavailable: preview shows "Waiting for a quote" and the button disables. No fallback numbers.
- Signature rejected mid-loop: stop, mark remaining as not created, show how many were signed, keep them.
- Order creation API failure for a leg: same as rejection. Never silently skip a leg.
- An order group whose first order lacks `metadata.range` (shouldn't happen, but old or hand-made data): the card lists legs without the band chart and says the settings are missing. No fabricated band.

## Testing

Pure functions get unit tests in vitest (node environment, no DOM):

- `generateRangeOrders(settings, prices, now)` → the ordered list of leg specs. Cases: window count, tilt at first and last window, both legs' amounts, cap at 200.
- `rangeProfitPreview(settings)` → spread, net, break-even, disabled reasons.
- `countBandCycles(series, bandPct)` → crossings for the wizard.
- `matchRangeLegs(orders, usdPriceAt)` → realized, open position, cycles, hit rate, from a list of orders with fill data and a `(contractId, timestamp) => number` price lookup.
- `runwayFor(balance, legAmount)`.
- `includeTargetInRange` extended to multiple targets.

Components are verified on a branch preview deployment in Chrome, since local dev cannot render the swap app (see memory note on Vercel scopes). Anything needing a signature is checked by Ross.

## Reuse map

| Need | Reuse |
|---|---|
| Chart | `condition-token-chart.tsx`, `simple-chart-utils.ts`, `price-series-service.ts` |
| Order signing and submission | `signTriggeredSwap` and the `POST /api/v1/orders/new` call inside `useRouterTrading`; Split Swap's status list in `dca-dialog.tsx` |
| Top nav | `src/components/layout/header.tsx` |
| Orders grouping and cards | `StrategyCardFactory`, `BaseStrategyCard`, `shared-types.ts` |
| Balances, prices, tokens | `wallet-balance-context`, `token-price-context`, `token-metadata-context`, `subnet-tokens-context` |
| Subnet-from rule | `isSubnetFromActive` |

## Plan phasing

The wizard only fills the page's controls, so the implementation plan should treat it as a second phase after the page, order generation, and Orders card are working end to end.

## Out of scope for the first plan

- Custom hours for "Trigger every" and custom days for "Run for" (phase 1 ships the fixed presets only).
- The "Guide me" button and wizard (phase 2).
- Adopting `SubnetPairSelector` in Triggered Swaps.
- A comparable volatility score across pairs.
- Any change to the executor.
