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
- Two price lines drawn as series price lines: sell (orange, existing target colour) and buy (green).
- Both lines are draggable as a whole, up or down. There are no point handles.
- Tilt is applied to both lines and drawn as sloped segments from "now" to run end.
- Autoscale includes both lines (extend `includeTargetInRange` to take a list of prices).
- A faint vertical tick per window across the future region, capped visually at 30 ticks.

### Controls rail, top to bottom

1. **Pair.** Two subnet-pair selectors (see below). Swapping order is allowed.
2. **Band.** "Sell above +X%" and "Buy below −Y%" numeric inputs, percent of current price, two-way bound with the lines. Resulting prices shown beside them.
3. **Per swap.** USD amount. Shows the resulting token amounts for each leg.
4. **Trigger every.** Hour, Day, Week, Custom hours. Same options as Split Swap.
5. **Run for.** 1 week, 1 month, 3 months, Custom days.
6. **Tilt.** Slider from −40% to +40%, labelled "+10% by the end".
7. **Profit preview** card (below).
8. **Create button.** Label is always "Create N orders" with a subline "N signatures, one after another · sells cover A windows, buys cover B".
9. **Guide me** button at the top of the rail opens the wizard.

### Profit preview

Per completed cycle, where one cycle is a sell at the top line and a buy at the bottom line:

```
spread      = sell / buy − 1
gross       = perSwapUsd × spread
slippage    = 2 × 0.01 × perSwapUsd
net         = gross − slippage
breakEven   = 2 × 0.01                      (spread must exceed this)
ifAll       = net × windows
```

Shown as: band summary, net per cycle, costs per cycle, and the big number "if every window completes a cycle" with that assumption in the label. Spread below break-even turns the preview red and disables the button. The preview never estimates fill rate.

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

Orders go through `createSingleOrder` in `useRouterTrading` with one `strategyId` for the run, `strategyPosition` (0..2N−1), `strategySize` (2N), plus the new fields below. Signing is sequential with the same status list Split Swap shows. The first rejected signature aborts the remaining orders; already-signed orders stay.

### Guardrails

- Both tokens must have subnet versions. The selector only lists tokens the wallet holds on the subnet.
- Sell line must be above current price and buy line below, with a 0.5% minimum gap. Otherwise the button disables and says why.
- Spread must exceed break-even, else the button disables.
- `2N > 200` disables the button: "Too many orders (2N). Cap is 200 in one sitting. Widen the interval or shorten the run."
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

- Lists only tokens that have a subnet version and that the connected wallet holds on the subnet, with subnet balance and USD value on each row.
- Search by name, symbol, or address.
- Empty state when the wallet holds no subnet tokens: "Range Swaps need tokens on the subnet. Move some over from the swap page."

## Orders page

### Data model additions

On `LimitOrder` (`src/lib/orders/types.ts`):

- `strategyType` gains `'range'`.
- New `leg?: 'sell' | 'buy'`.

New strategy record stored alongside orders, keyed by `strategyId`:

```
{ pair: { a, b }, sellStart, buyStart, tilt, intervalHours, windows, perSwapUsd, createdAt }
```

Stored once at creation so the card can redraw the lines and compute runway with the right per-swap amount. Follow the existing store pattern in `src/lib/orders/store.ts`.

### Card

`RangeStrategyCard` registered in `StrategyCardFactory` for `strategyType === 'range'`.

Collapsed row: pair, cadence, "window i of N", realized profit, a runway warning pill when a side is under 3 windows, and the status pill.

Expanded card:

- Header: pair, cadence, window count, start date, status pill, next-window countdown.
- Chart: price so far with the band drawn from the strategy record, filled legs as solid dots, expired legs as hollow dots, future windows greyed.
- Stats: Realized, Cycles done ("2 of 8 so far"), Sells hit with unmatched count, Buys hit, Open position, Hit rate. Completed runs add Best window and Avg per cycle.
- Runway: per side, `floor(subnetBalance / legAmount)` recomputed from the live balance context. Amber under 3 with a banner and a "Top up" action that opens the swap page pre-filled to move that token to the subnet; red at 0.
- Window list: every window with both legs, hit / expired / open / future, fill amount and tx id on hits, per-order cancel on open legs. "Cancel remaining" cancels every open order in the strategy and confirms with the count.

States: Live, Low runway (Live + banner), Completed ("Run again with these settings" links to the page with the record pre-filled), Cancelled.

### Metric definitions

- **Realized.** Match each filled buy with the earliest unmatched filled sell before it. Realized = Σ (sell proceeds in USD at fill − buy cost in USD at fill) over matched pairs. Unmatched legs contribute nothing.
- **Open position.** Unmatched filled legs, expressed in the token received.
- **Cycles done.** Number of matched pairs, out of windows whose `validTo` has passed.
- **Hit rate.** Filled legs ÷ legs whose window has ended.

## Error handling

- Quote or price feed unavailable: preview shows "Waiting for a quote" and the button disables. No fallback numbers.
- Signature rejected mid-loop: stop, mark remaining as not created, show how many were signed, keep them.
- Order creation API failure for a leg: same as rejection. Never silently skip a leg.
- Strategy record write failure after orders exist: surface the error on the page; the Orders card falls back to listing legs without the band chart and says the settings are missing.

## Testing

Pure functions get unit tests in vitest (node environment, no DOM):

- `generateRangeOrders(settings, prices, now)` → the ordered list of leg specs. Cases: window count, tilt at first and last window, both legs' amounts, cap at 200.
- `rangeProfitPreview(settings)` → spread, net, break-even, disabled reasons.
- `countBandCycles(series, bandPct)` → crossings for the wizard.
- `matchRangeLegs(orders)` → realized, open position, cycles, hit rate, from a list of orders with fill data.
- `runwayFor(balance, legAmount)`.
- `includeTargetInRange` extended to multiple targets.

Components are verified on a branch preview deployment in Chrome, since local dev cannot render the swap app (see memory note on Vercel scopes). Anything needing a signature is checked by Ross.

## Reuse map

| Need | Reuse |
|---|---|
| Chart | `condition-token-chart.tsx`, `simple-chart-utils.ts`, `price-series-service.ts` |
| Order creation and signing loop | `createSingleOrder` in `useRouterTrading`, Split Swap's status list in `dca-dialog.tsx` |
| Orders grouping and cards | `StrategyCardFactory`, `BaseStrategyCard`, `shared-types.ts` |
| Balances, prices, tokens | `wallet-balance-context`, `token-price-context`, `token-metadata-context`, `subnet-tokens-context` |
| Subnet-from rule | `isSubnetFromActive` |

## Out of scope for the first plan

- Adopting `SubnetPairSelector` in Triggered Swaps.
- A comparable volatility score across pairs.
- Any change to the executor.
