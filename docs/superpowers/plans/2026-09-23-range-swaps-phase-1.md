# Range Swaps Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Range Swaps page at `/advanced/range` (chart with a draggable band, controls rail, profit preview, sequential order signing) and the Range strategy card on the Orders page.

**Architecture:** Pure logic lives in `src/lib/range/` (order generation, profit preview, leg matching) with vitest unit tests. The page composes existing contexts (tokens, prices, balances, subnet pairings) and extends the existing trigger chart with an optional band. Orders are created through a new `createRangeLeg` in `useRouterTrading` that reuses signing and the orders POST. The Orders card is a fourth strategy card type registered in the existing factory.

**Tech Stack:** Next.js 15 app router, React 19, TypeScript, lightweight-charts 5, vitest 3 (node environment, no DOM), Tailwind classes as used elsewhere in `apps/simple-swap`.

**Spec:** `docs/superpowers/specs/2026-09-23-range-swaps-design.md`

**Out of this plan:** the Guide me wizard (phase 2), adopting the subnet-pair selector in Triggered Swaps, per-window vertical ticks on the chart.

---

## Working notes for every task

- Run all commands from `apps/simple-swap`: `cd /Users/ross/Documents/charisma/apps/simple-swap`.
- Tests: `pnpm test -- <path>` runs vitest on that file. `pnpm test` runs everything.
- Type check: `pnpm check-types 2>&1 | grep -E "<file you touched>"`. The repo has pre-existing type errors elsewhere; only your files must be clean.
- Lint: `pnpm exec eslint <file>`.
- Never build the app. Local dev cannot render the swap page (it needs services that are not in this repo). Verify UI on a branch preview: push a branch, wait for the Vercel preview (`vercel ls charisma-simple-swap --scope pointblankdev`), open it in Chrome.
- No mock data, no fallbacks. Throw descriptive errors and let callers handle them.
- Avoid `useMemo` and `useCallback` in new code. Derive values inline.
- Commit after every task with the attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## File structure

| File | Responsibility |
|---|---|
| `src/lib/range/types.ts` | `RangeSettings`, `RangeLegSpec`, `RangeLeg` union types. |
| `src/lib/range/generate-legs.ts` (+ test) | Pure: settings + prices + now → ordered leg specs. |
| `src/lib/range/profit-preview.ts` (+ test) | Pure: spread, net per cycle, break-even, order count, disabled reasons, runway, window count. |
| `src/lib/range/match-legs.ts` (+ test) | Pure: orders → per-leg outcome, run status, realized, open position, cycles, hit rate. |
| `src/lib/charts/simple-chart-utils.ts` (+ test) | `includeTargetsInRange` for several prices. |
| `src/components/condition-token-chart.tsx` | Optional `band` prop: two band series, future extension, drag. |
| `src/hooks/useRouterTrading.tsx` | `createRangeLeg`. |
| `src/components/layout/header.tsx` | Advanced menu. |
| `src/components/range/SubnetPairSelector.tsx` | Token picker limited to subnet-funded tokens. |
| `src/components/range/RangeControls.tsx` | The rail: pair, band %, per swap, interval, run, tilt. |
| `src/components/range/RangePreview.tsx` | Profit preview card + create button label. |
| `src/components/range/RangeSchedule.tsx` | Leg list with signing statuses. |
| `src/components/range/RangePage.tsx` | State, derivations, signing loop, layout. |
| `src/app/advanced/range/page.tsx` | Route shell. |
| `src/lib/orders/types.ts`, `src/lib/orders/strategy-formatter.ts`, `strategy-cards/utils/strategy-detector.ts`, `strategy-cards/StrategyCardFactory.tsx`, `strategy-cards/base/shared-types.ts`, `strategy-cards/index.ts` | Register `'range'`. |
| `src/components/orders/strategy-cards/types/RangeStrategyCard.tsx` | The card. |

---

### Task 1: Types and `'range'` registration

**Files:**
- Create: `src/lib/range/types.ts`
- Modify: `src/lib/orders/types.ts` (the `strategyType` union near line 60)
- Modify: `src/lib/orders/strategy-formatter.ts` (`StrategyDisplayData.type` line 14, `generateStrategyDescription` line 239, `estimateStrategyCompletion` line 265)
- Modify: `src/components/orders/strategy-cards/utils/strategy-detector.ts`
- Modify: `src/components/orders/strategy-cards/base/shared-types.ts`
- Modify: `src/hooks/useRouterTrading.tsx` (the `strategyType?:` union inside `createTriggeredSwap` opts, line 638)

- [ ] **Step 1: Create the range types**

```ts
// src/lib/range/types.ts
import type { ConditionDirection } from '@/contexts/order-conditions-context';

/** Stored on every leg as `metadata.range`. Mainnet ids feed the price service; subnet ids are what orders move. */
export interface RangeSettings {
  pair: { a: string; b: string };
  subnet: { a: string; b: string };
  sellStart: number;
  buyStart: number;
  tilt: number;
  intervalHours: number;
  windows: number;
  perSwapUsd: number;
  createdAt: string;
}

export type RangeLeg = 'sell' | 'buy';

/** One order to create. `position` is 1-based across the whole run. */
export interface RangeLegSpec {
  leg: RangeLeg;
  window: number;
  position: number;
  inputToken: string;
  outputToken: string;
  inputDecimals: number;
  amountDisplay: string;
  conditionToken: string;
  baseAsset: string;
  targetPrice: string;
  direction: ConditionDirection;
  validFrom: string;
  validTo: string;
}
```

- [ ] **Step 2: Add `'range'` and `leg` to `LimitOrder`**

In `src/lib/orders/types.ts` replace:

```ts
    strategyType?: 'dca' | 'twitter';
```

with:

```ts
    strategyType?: 'dca' | 'twitter' | 'range';

    /**
     * Which side of a range swap this order is. Only set when strategyType is 'range'.
     */
    leg?: 'sell' | 'buy';
```

- [ ] **Step 3: Widen the strategy formatter unions**

In `src/lib/orders/strategy-formatter.ts`:

- Line 14: `type: 'dca' | 'single' | 'twitter' | 'split' | 'batch';` → `type: 'dca' | 'single' | 'twitter' | 'split' | 'batch' | 'range';`
- `generateStrategyDescription(type: 'dca' | 'twitter', ...)` → `type: 'dca' | 'twitter' | 'range'` and add before `default:`:

```ts
        case 'range':
            return `Range swap · ${Math.ceil(orderCount / 2)} windows`;
```

- `estimateStrategyCompletion(orders, type: 'dca' | 'twitter')` → `type: 'dca' | 'twitter' | 'range'` and change `if (type === 'dca')` to `if (type === 'dca' || type === 'range')`.

- [ ] **Step 4: Teach the detector and card props about `'range'`**

`strategy-detector.ts`: change the return type to `'single' | 'dca' | 'twitter' | 'range'` and add after the `twitter` explicit check:

```ts
    if (strategyData.type === 'range' || strategyData.orders[0]?.strategyType === 'range') {
        return 'range';
    }
```

Add at the bottom:

```ts
export function isRangeStrategy(strategyData: StrategyDisplayData): strategyData is StrategyDisplayData & { type: 'range' } {
    return detectStrategyType(strategyData) === 'range';
}
```

`shared-types.ts`: add

```ts
export interface RangeStrategyCardProps extends BaseStrategyCardProps {
    strategyData: StrategyDisplayData & { type: 'range' };
}
```

and extend the union: `export type StrategyCardProps = SingleOrderCardProps | DCAStrategyCardProps | TwitterStrategyCardProps | RangeStrategyCardProps;`

`useRouterTrading.tsx` line 638: `strategyType?: 'dca' | 'split' | 'batch';` → `strategyType?: 'dca' | 'split' | 'batch' | 'range';`

- [ ] **Step 5: Type check the touched files**

Run: `pnpm check-types 2>&1 | grep -E "lib/range|orders/types|strategy-formatter|strategy-detector|shared-types|useRouterTrading"`
Expected: no output (pre-existing errors in `useRouterTrading` unrelated to these lines are acceptable only if they also appear on `git stash` baseline; check with `git stash; pnpm check-types | grep useRouterTrading; git stash pop`).

- [ ] **Step 6: Commit**

```bash
git add src/lib/range/types.ts src/lib/orders/types.ts src/lib/orders/strategy-formatter.ts src/components/orders/strategy-cards/utils/strategy-detector.ts src/components/orders/strategy-cards/base/shared-types.ts src/hooks/useRouterTrading.tsx
git commit -m "feat(simple-swap): Add range strategy types and registration

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Order generation (pure)

**Files:**
- Create: `src/lib/range/generate-legs.ts`
- Test: `src/lib/range/generate-legs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/range/generate-legs.test.ts
import { describe, it, expect } from 'vitest';
import { generateRangeLegs } from './generate-legs';
import type { RangeSettings } from './types';

const settings: RangeSettings = {
  pair: { a: 'SP1.cha', b: 'SP2.susdh' },
  subnet: { a: 'SP1.cha-subnet', b: 'SP2.susdh-subnet' },
  sellStart: 0.074,
  buyStart: 0.063,
  tilt: 0.1,
  intervalHours: 24,
  windows: 3,
  perSwapUsd: 50,
  createdAt: '2026-09-23T12:00:00.000Z',
};
const prices = { a: 0.068, b: 1 };
const decimals = { a: 6, b: 6 };
const now = Date.parse('2026-09-23T12:00:00.000Z');

describe('generateRangeLegs', () => {
  it('creates a sell and a buy per window with 1-based positions', () => {
    const legs = generateRangeLegs(settings, prices, decimals, now);

    expect(legs).toHaveLength(6);
    expect(legs.map((l) => [l.window, l.leg, l.position])).toEqual([
      [1, 'sell', 1], [1, 'buy', 2], [2, 'sell', 3], [2, 'buy', 4], [3, 'sell', 5], [3, 'buy', 6],
    ]);
  });

  it('sends the sell leg from the subnet A token and the buy leg from the subnet B token', () => {
    const [sell, buy] = generateRangeLegs(settings, prices, decimals, now);

    expect(sell.inputToken).toBe('SP1.cha-subnet');
    expect(sell.outputToken).toBe('SP2.susdh-subnet');
    expect(sell.direction).toBe('gt');
    expect(buy.inputToken).toBe('SP2.susdh-subnet');
    expect(buy.outputToken).toBe('SP1.cha-subnet');
    expect(buy.direction).toBe('lt');
    expect(sell.conditionToken).toBe('SP1.cha');
    expect(sell.baseAsset).toBe('SP2.susdh');
  });

  it('sizes each leg as USD divided by that token price', () => {
    const [sell, buy] = generateRangeLegs(settings, prices, decimals, now);

    expect(sell.amountDisplay).toBe('735.294118');
    expect(buy.amountDisplay).toBe('50.000000');
  });

  it('applies the tilt linearly so the last window reaches start × (1 + tilt)', () => {
    const legs = generateRangeLegs(settings, prices, decimals, now);

    expect(Number(legs[0].targetPrice)).toBeCloseTo(0.074, 6);
    expect(Number(legs[4].targetPrice)).toBeCloseTo(0.0814, 6);
    expect(Number(legs[5].targetPrice)).toBeCloseTo(0.0693, 6);
  });

  it('gives each window a contiguous validity range', () => {
    const legs = generateRangeLegs(settings, prices, decimals, now);

    expect(legs[0].validFrom).toBe('2026-09-23T12:00:00.000Z');
    expect(legs[0].validTo).toBe('2026-09-24T12:00:00.000Z');
    expect(legs[2].validFrom).toBe('2026-09-24T12:00:00.000Z');
  });

  it('refuses invalid prices instead of guessing', () => {
    expect(() => generateRangeLegs(settings, { a: 0, b: 1 }, decimals, now)).toThrow('price');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/lib/range/generate-legs.test.ts`
Expected: FAIL, "Cannot find module './generate-legs'".

- [ ] **Step 3: Implement**

```ts
// src/lib/range/generate-legs.ts
import type { RangeLegSpec, RangeSettings } from './types';

export interface PairPrices { a: number; b: number }
export interface PairDecimals { a: number; b: number }

/** Price of line at window i (0-based). */
export function lineAt(start: number, tilt: number, i: number, windows: number): number {
  return start * (1 + tilt * (windows > 1 ? i / (windows - 1) : 0));
}

export function generateRangeLegs(
  settings: RangeSettings,
  prices: PairPrices,
  decimals: PairDecimals,
  now: number,
): RangeLegSpec[] {
  if (!(prices.a > 0) || !(prices.b > 0)) {
    throw new Error(`Cannot size range legs without a positive price for both tokens (a=${prices.a}, b=${prices.b})`);
  }
  if (settings.windows < 1) throw new Error('A range swap needs at least one window');

  const intervalMs = settings.intervalHours * 60 * 60 * 1000;
  const sellAmount = (settings.perSwapUsd / prices.a).toFixed(decimals.a);
  const buyAmount = (settings.perSwapUsd / prices.b).toFixed(decimals.b);
  const legs: RangeLegSpec[] = [];

  for (let i = 0; i < settings.windows; i++) {
    const validFrom = new Date(now + i * intervalMs).toISOString();
    const validTo = new Date(now + (i + 1) * intervalMs).toISOString();
    const common = { window: i + 1, conditionToken: settings.pair.a, baseAsset: settings.pair.b, validFrom, validTo };

    legs.push({
      ...common,
      leg: 'sell',
      position: i * 2 + 1,
      inputToken: settings.subnet.a,
      outputToken: settings.subnet.b,
      inputDecimals: decimals.a,
      amountDisplay: sellAmount,
      targetPrice: String(lineAt(settings.sellStart, settings.tilt, i, settings.windows)),
      direction: 'gt',
    });
    legs.push({
      ...common,
      leg: 'buy',
      position: i * 2 + 2,
      inputToken: settings.subnet.b,
      outputToken: settings.subnet.a,
      inputDecimals: decimals.b,
      amountDisplay: buyAmount,
      targetPrice: String(lineAt(settings.buyStart, settings.tilt, i, settings.windows)),
      direction: 'lt',
    });
  }

  return legs;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- src/lib/range/generate-legs.test.ts`
Expected: 6 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/range/generate-legs.ts src/lib/range/generate-legs.test.ts
git commit -m "feat(simple-swap): Generate range swap legs per window

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Profit preview, guardrails, runway (pure)

**Files:**
- Create: `src/lib/range/profit-preview.ts`
- Test: `src/lib/range/profit-preview.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/range/profit-preview.test.ts
import { describe, it, expect } from 'vitest';
import { rangeProfitPreview, runwayFor, windowsFor, MAX_ORDERS } from './profit-preview';

const base = { price: 0.068, sell: 0.074, buy: 0.063, perSwapUsd: 50, windows: 30 };

describe('rangeProfitPreview', () => {
  it('computes spread, slippage cost, net per cycle and the if-all total', () => {
    const p = rangeProfitPreview(base);

    expect(p.spread).toBeCloseTo(0.1746, 4);
    expect(p.slippageCost).toBeCloseTo(1.0, 6);
    expect(p.netPerCycle).toBeCloseTo(7.73, 2);
    expect(p.ifAll).toBeCloseTo(231.9, 1);
    expect(p.breakEven).toBe(0.02);
    expect(p.orderCount).toBe(60);
    expect(p.reasons).toEqual([]);
  });

  it('flags a sell line at or below current price', () => {
    expect(rangeProfitPreview({ ...base, sell: 0.068 }).reasons).toContain('Sell line must be above current price');
  });

  it('flags a buy line at or above current price', () => {
    expect(rangeProfitPreview({ ...base, buy: 0.068 }).reasons).toContain('Buy line must be below current price');
  });

  it('flags a spread under break-even', () => {
    expect(rangeProfitPreview({ ...base, sell: 0.0687, buy: 0.0674 }).reasons).toContain('Spread is below break-even (2%)');
  });

  it('flags too many orders', () => {
    expect(rangeProfitPreview({ ...base, windows: 101 }).reasons).toContain(
      `Too many orders (202). Cap is ${MAX_ORDERS} in one sitting. Widen the interval or shorten the run.`,
    );
  });

  it('flags a non-positive per-swap amount', () => {
    expect(rangeProfitPreview({ ...base, perSwapUsd: 0 }).reasons).toContain('Per swap must be more than $0');
  });
});

describe('windowsFor', () => {
  it('floors run hours over interval hours', () => {
    expect(windowsFor(30 * 24, 24)).toBe(30);
    expect(windowsFor(7 * 24, 168)).toBe(1);
    expect(windowsFor(10, 24)).toBe(0);
  });
});

describe('runwayFor', () => {
  it('counts how many legs a balance covers', () => {
    expect(runwayFor(2200, 735.29)).toBe(2);
    expect(runwayFor(0, 735.29)).toBe(0);
    expect(runwayFor(100, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/lib/range/profit-preview.test.ts`
Expected: FAIL, "Cannot find module './profit-preview'".

- [ ] **Step 3: Implement**

```ts
// src/lib/range/profit-preview.ts
export const SLIPPAGE = 0.01;
export const MAX_ORDERS = 200;
const MIN_GAP = 0.005;

export interface PreviewInput {
  price: number;
  sell: number;
  buy: number;
  perSwapUsd: number;
  windows: number;
}

export interface RangePreview {
  spread: number;
  grossPerCycle: number;
  slippageCost: number;
  netPerCycle: number;
  breakEven: number;
  ifAll: number;
  orderCount: number;
  reasons: string[];
}

export function windowsFor(runHours: number, intervalHours: number): number {
  if (intervalHours <= 0) return 0;
  return Math.floor(runHours / intervalHours);
}

export function runwayFor(balance: number, legAmount: number): number {
  if (!(legAmount > 0) || !(balance > 0)) return 0;
  return Math.floor(balance / legAmount);
}

export function rangeProfitPreview({ price, sell, buy, perSwapUsd, windows }: PreviewInput): RangePreview {
  const spread = buy > 0 ? sell / buy - 1 : 0;
  const grossPerCycle = perSwapUsd * spread;
  const slippageCost = 2 * SLIPPAGE * perSwapUsd;
  const netPerCycle = grossPerCycle - slippageCost;
  const breakEven = 2 * SLIPPAGE;
  const orderCount = windows * 2;

  const reasons: string[] = [];
  if (!(perSwapUsd > 0)) reasons.push('Per swap must be more than $0');
  if (sell <= price * (1 + MIN_GAP)) reasons.push('Sell line must be above current price');
  if (buy >= price * (1 - MIN_GAP)) reasons.push('Buy line must be below current price');
  if (spread <= breakEven) reasons.push('Spread is below break-even (2%)');
  if (windows < 1) reasons.push('Run is shorter than one window');
  if (orderCount > MAX_ORDERS) {
    reasons.push(`Too many orders (${orderCount}). Cap is ${MAX_ORDERS} in one sitting. Widen the interval or shorten the run.`);
  }

  return { spread, grossPerCycle, slippageCost, netPerCycle, breakEven, ifAll: netPerCycle * windows, orderCount, reasons };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- src/lib/range/profit-preview.test.ts`
Expected: 9 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/range/profit-preview.ts src/lib/range/profit-preview.test.ts
git commit -m "feat(simple-swap): Range swap profit preview and guardrails

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Autoscale for several prices

**Files:**
- Modify: `src/lib/charts/simple-chart-utils.ts` (`includeTargetInRange` at the bottom)
- Modify: `src/lib/charts/simple-chart-utils.test.ts`
- Modify: `src/components/condition-token-chart.tsx` (one call site, line 168)

- [ ] **Step 1: Add the failing test**

Append to `src/lib/charts/simple-chart-utils.test.ts`:

```ts
import { includeTargetsInRange } from './simple-chart-utils';

describe('includeTargetsInRange', () => {
  it('widens the range to cover every valid target', () => {
    const info = { priceRange: { minValue: 1.0, maxValue: 1.2 } };
    expect(includeTargetsInRange(info, [0.5, 2, null, 0])?.priceRange).toEqual({ minValue: 0.5, maxValue: 2 });
  });

  it('returns the original when nothing needs widening', () => {
    const info = { priceRange: { minValue: 1.0, maxValue: 1.2 } };
    expect(includeTargetsInRange(info, [1.1])).toBe(info);
  });
});
```

(Keep the existing `includeTargetInRange` tests; the old function stays as a one-target wrapper.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- src/lib/charts/simple-chart-utils.test.ts`
Expected: FAIL, "includeTargetsInRange is not a function".

- [ ] **Step 3: Implement**

Replace the `includeTargetInRange` function with:

```ts
/**
 * Widen an autoscale range so every target price line is on screen.
 */
export function includeTargetsInRange(info: AutoscaleInfo | null, targets: Array<number | null>): AutoscaleInfo | null {
  if (!info?.priceRange) return info;
  const valid = targets.filter((t): t is number => t !== null && isValidPrice(t));
  if (valid.length === 0) return info;

  const minValue = Math.min(info.priceRange.minValue, ...valid);
  const maxValue = Math.max(info.priceRange.maxValue, ...valid);
  if (minValue === info.priceRange.minValue && maxValue === info.priceRange.maxValue) return info;

  return { ...info, priceRange: { minValue, maxValue } };
}

export function includeTargetInRange(info: AutoscaleInfo | null, target: number | null): AutoscaleInfo | null {
  return includeTargetsInRange(info, [target]);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- src/lib/charts/simple-chart-utils.test.ts`
Expected: all pass (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/charts/simple-chart-utils.ts src/lib/charts/simple-chart-utils.test.ts
git commit -m "feat(simple-swap): Autoscale helper for several target prices

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Band on the trigger chart (series, future extension, drag)

**Files:**
- Modify: `src/components/condition-token-chart.tsx`

No unit test (needs DOM). Verified on the preview in Task 12.

- [ ] **Step 1: Add the band prop types and imports**

At the top of `condition-token-chart.tsx`, extend the imports and props:

```ts
import { includeTargetsInRange } from "@/lib/charts/simple-chart-utils";   // replace includeTargetInRange import
import { lineAt } from "@/lib/range/generate-legs";

export interface ChartBand {
    sell: number;
    buy: number;
    tilt: number;
    windows: number;
    intervalHours: number;
    /** Called while dragging a line, with the new start price for that line. */
    onDrag: (line: 'sell' | 'buy', price: number) => void;
}

interface Props {
    token: TokenCacheData;
    baseToken?: TokenCacheData | null;
    targetPrice: string;
    direction?: 'lt' | 'gt';
    onTargetPriceChange: (price: string) => void;
    colour?: string;
    band?: ChartBand;
}
```

- [ ] **Step 2: Add refs and a band-data helper inside the component**

After `const targetRef = useRef<number | null>(null);` add:

```ts
    const bandRef = useRef<ChartBand | undefined>(band);
    bandRef.current = band;
    const bandSeriesRef = useRef<{ sell: ISeriesApi<'Line'>; buy: ISeriesApi<'Line'> } | null>(null);
```

Add this module-level function above the component:

```ts
const HOUR = 3600;

/** Points for one band line from `from` (unix s) to the end of the run, one per hour so the future is drawn to scale. */
function bandPoints(start: number, band: ChartBand, from: number): LineData[] {
    const endTime = from + band.windows * band.intervalHours * HOUR;
    const points: LineData[] = [];
    for (let t = from; t <= endTime; t += HOUR) {
        const frac = endTime > from ? (t - from) / (endTime - from) : 0;
        points.push({ time: t as UTCTimestamp, value: start * (1 + band.tilt * frac) });
    }
    return points;
}
```

- [ ] **Step 3: Create the band series when the chart is built**

Inside the chart-building effect, right after `series.setData(data);` and before `chart.timeScale().fitContent();`, add:

```ts
        const lastTime = Number(data[data.length - 1].time);
        if (bandRef.current) {
            const opts = { lineWidth: 2 as const, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false };
            const sell = chart.addSeries(LineSeries, { ...opts, color: '#f97316' });
            const buy = chart.addSeries(LineSeries, { ...opts, color: '#22c55e' });
            sell.setData(bandPoints(bandRef.current.sell, bandRef.current, lastTime));
            buy.setData(bandPoints(bandRef.current.buy, bandRef.current, lastTime));
            bandSeriesRef.current = { sell, buy };
        } else {
            bandSeriesRef.current = null;
        }
```

Change the main series' autoscale provider to include the band:

```ts
            autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
                const b = bandRef.current;
                const ends = b ? [lineAt(b.sell, b.tilt, b.windows - 1, b.windows), lineAt(b.buy, b.tilt, b.windows - 1, b.windows)] : [];
                return includeTargetsInRange(original(), [targetRef.current, b?.sell ?? null, b?.buy ?? null, ...ends]);
            },
```

In the effect's cleanup, add `bandSeriesRef.current = null;`.

- [ ] **Step 4: Update band series when the band changes (no rebuild)**

Add a new effect after the colour effect:

```ts
    // Redraw the band when its numbers change
    useEffect(() => {
        const s = bandSeriesRef.current;
        if (!s || !band || !data || data.length === 0) return;
        const lastTime = Number(data[data.length - 1].time);
        s.sell.setData(bandPoints(band.sell, band, lastTime));
        s.buy.setData(bandPoints(band.buy, band, lastTime));
        chartRef.current?.priceScale('left').applyOptions({ autoScale: true });
    }, [band?.sell, band?.buy, band?.tilt, band?.windows, band?.intervalHours, data]);
```

- [ ] **Step 5: Drag handling**

Add an effect that attaches pointer listeners to the container when a band exists:

```ts
    // Drag a band line up or down as a whole
    useEffect(() => {
        const container = containerRef.current;
        const chart = chartRef.current;
        if (!container || !chart || !band || !data || data.length === 0) return;

        const HIT_PX = 10;
        let dragging: { line: 'sell' | 'buy'; frac: number } | null = null;

        const lineValueAt = (line: 'sell' | 'buy', x: number) => {
            const b = bandRef.current!;
            const lastTime = Number(data[data.length - 1].time);
            const endTime = lastTime + b.windows * b.intervalHours * HOUR;
            const t = chart.timeScale().coordinateToTime(x);
            const time = t === null ? lastTime : Number(t);
            const frac = Math.min(1, Math.max(0, (time - lastTime) / Math.max(1, endTime - lastTime)));
            const start = line === 'sell' ? b.sell : b.buy;
            return { value: start * (1 + b.tilt * frac), frac };
        };

        const onDown = (e: PointerEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left, y = e.clientY - rect.top;
            const s = bandSeriesRef.current;
            if (!s) return;
            for (const line of ['sell', 'buy'] as const) {
                const { value, frac } = lineValueAt(line, x);
                const ly = s[line].priceToCoordinate(value);
                if (ly !== null && Math.abs(ly - y) <= HIT_PX) {
                    dragging = { line, frac };
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                    container.setPointerCapture(e.pointerId);
                    container.style.cursor = 'ns-resize';
                    e.preventDefault();
                    return;
                }
            }
        };
        const onMove = (e: PointerEvent) => {
            if (!dragging) return;
            const rect = container.getBoundingClientRect();
            const price = seriesRef.current?.coordinateToPrice(e.clientY - rect.top);
            if (price === null || price === undefined || !isValidPrice(price)) return;
            const b = bandRef.current!;
            // The pointer sits at `frac` along the line; solve back to the start price.
            b.onDrag(dragging.line, price / (1 + b.tilt * dragging.frac));
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = null;
            chart.applyOptions({ handleScroll: true, handleScale: true });
            container.style.cursor = '';
        };

        container.addEventListener('pointerdown', onDown);
        container.addEventListener('pointermove', onMove);
        container.addEventListener('pointerup', onUp);
        container.addEventListener('pointercancel', onUp);
        return () => {
            container.removeEventListener('pointerdown', onDown);
            container.removeEventListener('pointermove', onMove);
            container.removeEventListener('pointerup', onUp);
            container.removeEventListener('pointercancel', onUp);
        };
    }, [band, data]);
```

Also set `style={{ touchAction: band ? 'none' : undefined }}` on the container div.

- [ ] **Step 6: Type check and lint**

Run: `pnpm check-types 2>&1 | grep condition-token-chart; pnpm exec eslint src/components/condition-token-chart.tsx`
Expected: no type errors; eslint 0 errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/condition-token-chart.tsx
git commit -m "feat(simple-swap): Optional draggable band on the trigger chart

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `createRangeLeg` in `useRouterTrading`

**Files:**
- Modify: `src/hooks/useRouterTrading.tsx` (add after `createSingleOrder`, export in the return block at line ~1158)

No unit test (signing needs a wallet). Verified on preview in Task 12.

- [ ] **Step 1: Add the function**

Import at the top: `import type { RangeLegSpec, RangeSettings } from '@/lib/range/types';`

After `createSingleOrder` add:

```ts
  /**
   * Create one leg of a range swap. Takes explicit tokens and condition so it never
   * depends on the swap card's selected tokens. Reuses signing and the orders POST only.
   */
  const createRangeLeg = useCallback(async (leg: RangeLegSpec, run: { strategyId: string; strategySize: number; range: RangeSettings }) => {
    if (!walletAddress) throw new Error('Connect wallet');

    const uuid = globalThis.crypto?.randomUUID() ?? Date.now().toString();
    const micro = convertToMicroUnits(leg.amountDisplay, leg.inputDecimals);
    const signature = await signTriggeredSwap({ subnet: leg.inputToken, uuid, amount: BigInt(micro) });

    const payload = {
      owner: walletAddress,
      inputToken: leg.inputToken,
      outputToken: leg.outputToken,
      amountIn: micro,
      conditionToken: leg.conditionToken,
      baseAsset: leg.baseAsset,
      targetPrice: leg.targetPrice,
      direction: leg.direction,
      recipient: walletAddress,
      signature,
      uuid,
      validFrom: leg.validFrom,
      validTo: leg.validTo,
      strategyId: run.strategyId,
      strategyType: 'range',
      strategySize: run.strategySize,
      strategyPosition: leg.position,
      leg: leg.leg,
      metadata: { range: run.range },
    };

    const res = await fetch('/api/v1/orders/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: 'unknown' }));
      throw new Error(j.error || `Order create failed (${res.status})`);
    }
    return res.json();
  }, [walletAddress]);
```

Add `createRangeLeg,` to the return object right after `createSingleOrder,`.

- [ ] **Step 2: Confirm the API accepts the extra fields**

Run: `grep -n "passthrough\|leg\|metadata" src/app/api/v1/orders/new/route.ts`
Expected: the zod schema uses `.passthrough()`. If it does not, add `leg: z.enum(['sell', 'buy']).optional()` and `metadata: z.record(z.any()).optional()` to the schema in that route and include the file in the commit.

- [ ] **Step 3: Type check**

Run: `pnpm check-types 2>&1 | grep useRouterTrading`
Expected: nothing new versus baseline.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useRouterTrading.tsx
git commit -m "feat(simple-swap): createRangeLeg for explicit-token triggered orders

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Advanced menu in the header

**Files:**
- Modify: `src/components/layout/header.tsx`

- [ ] **Step 1: Add the menu**

Import: `import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';` and `import { ChevronDown } from 'lucide-react';` (keep existing lucide imports).

Add above `navigationLinks`:

```ts
const advancedLinks = [
    { href: "/advanced/range", label: "Range Swaps", hint: "Sell high, buy back low, on a schedule" },
];
```

In the desktop `<nav>` after the `navigationLinks.map(...)` block insert:

```tsx
                        <DropdownMenu>
                            <DropdownMenuTrigger className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/[0.05] rounded-xl transition-all duration-200">
                                Advanced <ChevronDown className="h-3.5 w-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                                {advancedLinks.map((link) => (
                                    <DropdownMenuItem key={link.href} asChild>
                                        <Link href={link.href} className="flex flex-col items-start gap-0.5">
                                            <span className="text-sm text-white/90">{link.label}</span>
                                            <span className="text-xs text-white/50">{link.hint}</span>
                                        </Link>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
```

If `DropdownMenuItem` in `src/components/ui/dropdown-menu.tsx` does not accept `asChild`, render `<DropdownMenuItem onSelect={() => router.push(link.href)}>` with `useRouter` from `next/navigation` instead.

In the mobile `<nav className="flex flex-col space-y-2">`, after the `navigationLinks.map(...)` block insert:

```tsx
                                        <div className="px-4 pt-2 text-xs uppercase tracking-wider text-white/40">Advanced</div>
                                        {advancedLinks.map((link) => (
                                            <Link
                                                key={link.href}
                                                href={link.href}
                                                className="flex items-center py-3 px-4 rounded-xl text-white/70 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                {link.label}
                                            </Link>
                                        ))}
```

- [ ] **Step 2: Type check and lint**

Run: `pnpm check-types 2>&1 | grep header.tsx; pnpm exec eslint src/components/layout/header.tsx`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat(simple-swap): Advanced menu in the header with Range Swaps

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Subnet-pair token selector

**Files:**
- Create: `src/components/range/SubnetPairSelector.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client";

import TokenDropdown from '@/components/TokenDropdown';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { useTokenMetadata } from '@/contexts/token-metadata-context';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';

interface Props {
    label: string;
    selected: TokenCacheData | null;
    onSelect: (token: TokenCacheData) => void;
    /** Contract id to leave out (the other side of the pair). */
    exclude?: string | null;
}

/**
 * Mainnet tokens that have a subnet version the connected wallet actually holds.
 * A range swap sends from both sides, so anything unfunded is not offered.
 */
export function useSubnetFundedTokens(exclude?: string | null): TokenCacheData[] {
    const { tokens } = useTokenMetadata();
    const { getSubnetContractId } = useSubnetTokens();
    const { address } = useWallet();
    const { getSubnetBalance } = useBalances(address ? [address] : []);

    if (!address) return [];
    return Object.values(tokens).filter((t) => {
        if (t.type === 'SUBNET' || t.contractId === exclude) return false;
        const subnetId = getSubnetContractId(t.contractId);
        return !!subnetId && getSubnetBalance(address, subnetId) > 0;
    });
}

export default function SubnetPairSelector({ label, selected, onSelect, exclude }: Props) {
    const tokens = useSubnetFundedTokens(exclude);
    const { address } = useWallet();

    if (!address) {
        return <div className="text-sm text-white/60">Connect a wallet to pick tokens.</div>;
    }
    if (tokens.length === 0) {
        return (
            <div className="text-sm text-white/60">
                Range Swaps need tokens on the subnet. Move some over from the swap page.
            </div>
        );
    }
    return <TokenDropdown tokens={tokens} selected={selected} onSelect={onSelect} label={label} showBalances />;
}
```

- [ ] **Step 2: Type check and lint**

Run: `pnpm check-types 2>&1 | grep SubnetPairSelector; pnpm exec eslint src/components/range/SubnetPairSelector.tsx`
Expected: clean. If `TokenDropdown` has no `label` prop effect you want, that's fine; it exists in its props.

- [ ] **Step 3: Commit**

```bash
git add src/components/range/SubnetPairSelector.tsx
git commit -m "feat(simple-swap): Subnet-funded pair selector for range swaps

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Range page (controls, preview, schedule, signing loop, route)

**Files:**
- Create: `src/components/range/RangeControls.tsx`
- Create: `src/components/range/RangePreview.tsx`
- Create: `src/components/range/RangeSchedule.tsx`
- Create: `src/components/range/RangePage.tsx`
- Create: `src/app/advanced/range/page.tsx`

- [ ] **Step 1: Controls rail**

```tsx
// src/components/range/RangeControls.tsx
"use client";

import { TokenCacheData } from '@/lib/contract-registry-adapter';
import SubnetPairSelector from './SubnetPairSelector';

export interface RangeForm {
    sellPct: number;
    buyPct: number;
    perSwapUsd: number;
    intervalHours: number;
    runDays: number;
    tilt: number;
}

interface Props {
    tokenA: TokenCacheData | null;
    tokenB: TokenCacheData | null;
    onTokenA: (t: TokenCacheData) => void;
    onTokenB: (t: TokenCacheData) => void;
    form: RangeForm;
    onChange: (patch: Partial<RangeForm>) => void;
    sellPrice: number;
    buyPrice: number;
    amountA: string;
    amountB: string;
}

const INTERVALS = [{ h: 1, label: 'Hour' }, { h: 24, label: 'Day' }, { h: 168, label: 'Week' }];
const RUNS = [{ d: 7, label: '1 week' }, { d: 30, label: '1 month' }, { d: 90, label: '3 months' }];

function Seg<T extends number>({ options, value, onPick }: { options: { v: T; label: string }[]; value: T; onPick: (v: T) => void }) {
    return (
        <div className="grid grid-flow-col gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5">
            {options.map((o) => (
                <button
                    key={o.v}
                    type="button"
                    onClick={() => onPick(o.v)}
                    className={`px-2 py-1.5 text-xs font-medium rounded-md transition-colors ${value === o.v ? 'bg-white/[0.1] text-white/95' : 'text-white/60 hover:text-white/80'}`}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}

export default function RangeControls({ tokenA, tokenB, onTokenA, onTokenB, form, onChange, sellPrice, buyPrice, amountA, amountB }: Props) {
    const num = (e: React.ChangeEvent<HTMLInputElement>) => Number(e.target.value);
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs text-white/60">Pair</label>
                <div className="flex items-center gap-2">
                    <SubnetPairSelector label="Sell" selected={tokenA} onSelect={onTokenA} exclude={tokenB?.contractId} />
                    <span className="text-white/40">⇄</span>
                    <SubnetPairSelector label="For" selected={tokenB} onSelect={onTokenB} exclude={tokenA?.contractId} />
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <span>Band around current price</span>
                    <span className="font-mono">{sellPrice.toPrecision(4)} / {buyPrice.toPrecision(4)}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-orange-500/50 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="text-orange-400">Sell above</span><span className="text-white/50">+</span>
                    <input id="range-sell-pct" type="number" min={0.5} max={200} step={0.5} value={form.sellPct} onChange={(e) => onChange({ sellPct: num(e) })} className="w-full bg-transparent text-right outline-none" />
                    <span className="text-white/50">%</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-green-500/50 bg-white/[0.03] px-3 py-2 text-sm">
                    <span className="text-green-400">Buy below</span><span className="text-white/50">−</span>
                    <input id="range-buy-pct" type="number" min={0.5} max={99} step={0.5} value={form.buyPct} onChange={(e) => onChange({ buyPct: num(e) })} className="w-full bg-transparent text-right outline-none" />
                    <span className="text-white/50">%</span>
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <label htmlFor="range-usd">Per swap</label>
                    <span className="font-mono">≈ {amountA} {tokenA?.symbol ?? ''} · {amountB} {tokenB?.symbol ?? ''}</span>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                    <span className="text-white/50">$</span>
                    <input id="range-usd" type="number" min={1} step={5} value={form.perSwapUsd} onChange={(e) => onChange({ perSwapUsd: num(e) })} className="w-full bg-transparent text-lg outline-none" />
                    <span className="text-xs text-white/50">USD</span>
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-xs text-white/60">Trigger every</label>
                <Seg options={INTERVALS.map((i) => ({ v: i.h, label: i.label }))} value={form.intervalHours} onPick={(h) => onChange({ intervalHours: h })} />
            </div>

            <div className="space-y-2">
                <label className="text-xs text-white/60">Run for</label>
                <Seg options={RUNS.map((r) => ({ v: r.d, label: r.label }))} value={form.runDays} onPick={(d) => onChange({ runDays: d })} />
            </div>

            <div className="space-y-2">
                <div className="flex justify-between text-xs text-white/60">
                    <label htmlFor="range-tilt">Tilt</label>
                    <span className="font-mono">{form.tilt >= 0 ? '+' : '−'}{Math.abs(Math.round(form.tilt * 100))}% by the end</span>
                </div>
                <input id="range-tilt" type="range" min={-40} max={40} step={1} value={Math.round(form.tilt * 100)} onChange={(e) => onChange({ tilt: num(e) / 100 })} className="w-full accent-purple-400" />
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Preview card and button**

```tsx
// src/components/range/RangePreview.tsx
"use client";

import { InfoTooltip } from '@/components/ui/tooltip';
import type { RangePreview as Preview } from '@/lib/range/profit-preview';

interface Props {
    preview: Preview;
    runway: { sells: number; buys: number };
    busy: boolean;
    onCreate: () => void;
}

const usd = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;

export default function RangePreview({ preview, runway, busy, onCreate }: Props) {
    const blocked = preview.reasons.length > 0;
    return (
        <div className="space-y-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-white/60">Spread</span><span className="font-mono">{(preview.spread * 100).toFixed(1)}%</span></div>
                <div className="flex justify-between"><span className="text-white/60">Per completed cycle</span><span className={`font-mono ${preview.netPerCycle > 0 ? 'text-green-400' : 'text-orange-400'}`}>{usd(preview.netPerCycle)}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Costs per cycle</span><span className="font-mono">${preview.slippageCost.toFixed(2)} slippage, 1% per leg</span></div>
                <div className="pt-1">
                    <span className="text-2xl font-semibold">{usd(preview.ifAll)}</span>
                    <span className="ml-2 text-xs text-white/50">if every window completes a cycle</span>
                    <InfoTooltip content="A cycle only completes when price crosses both lines inside one window. If price trends one way, only one leg fires. This number is not a forecast." />
                </div>
                {blocked && (
                    <ul className="text-xs text-orange-400 list-disc pl-4 space-y-1">
                        {preview.reasons.map((r) => <li key={r}>{r}</li>)}
                    </ul>
                )}
            </div>
            <button
                type="button"
                disabled={blocked || busy}
                onClick={onCreate}
                className="w-full rounded-xl bg-purple-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
                {blocked ? 'Fix the items above' : `Create ${preview.orderCount} orders`}
                <span className="block text-xs font-normal opacity-80">
                    {preview.orderCount} signatures, one after another · sells cover {runway.sells} windows, buys cover {runway.buys}
                </span>
            </button>
        </div>
    );
}
```

- [ ] **Step 3: Schedule list**

```tsx
// src/components/range/RangeSchedule.tsx
"use client";

import { Check, Loader2, X } from 'lucide-react';
import type { RangeLegSpec } from '@/lib/range/types';

export type LegStatus = 'pending' | 'signing' | 'done' | 'error';

interface Props {
    legs: RangeLegSpec[];
    statuses: LegStatus[];
    symbols: { a: string; b: string };
}

export default function RangeSchedule({ legs, statuses, symbols }: Props) {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
            <h4 className="text-sm font-medium text-white/90 mb-3">Orders ({legs.length})</h4>
            <div className="max-h-80 overflow-y-auto space-y-1 text-xs">
                {legs.map((leg, i) => (
                    <div key={`${leg.window}-${leg.leg}`} className="grid grid-cols-[48px_1fr_auto_20px] items-center gap-3 py-1.5 border-b border-dashed border-white/[0.06]">
                        <span className="font-mono text-white/50">#{leg.window}</span>
                        <span className={leg.leg === 'sell' ? 'text-orange-400' : 'text-green-400'}>
                            {leg.leg === 'sell' ? `sell ≥ ${Number(leg.targetPrice).toPrecision(4)}` : `buy ≤ ${Number(leg.targetPrice).toPrecision(4)}`}
                            <span className="text-white/50"> · {leg.amountDisplay} {leg.leg === 'sell' ? symbols.a : symbols.b}</span>
                        </span>
                        <span className="font-mono text-white/40">{new Date(leg.validFrom).toLocaleDateString()}</span>
                        <span>
                            {statuses[i] === 'pending' && <span className="block h-3 w-3 rounded-full border border-white/20" />}
                            {statuses[i] === 'signing' && <Loader2 className="h-3 w-3 animate-spin text-blue-400" />}
                            {statuses[i] === 'done' && <Check className="h-3 w-3 text-green-400" />}
                            {statuses[i] === 'error' && <X className="h-3 w-3 text-red-400" />}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
```

- [ ] **Step 4: The page component**

```tsx
// src/components/range/RangePage.tsx
"use client";

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { usePrices } from '@/contexts/token-price-context';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { useRouterTrading } from '@/hooks/useRouterTrading';
import { generateRangeLegs } from '@/lib/range/generate-legs';
import { rangeProfitPreview, runwayFor, windowsFor } from '@/lib/range/profit-preview';
import type { RangeLegSpec, RangeSettings } from '@/lib/range/types';
import RangeControls, { RangeForm } from './RangeControls';
import RangePreview from './RangePreview';
import RangeSchedule, { LegStatus } from './RangeSchedule';

const ConditionTokenChart = dynamic(() => import('@/components/condition-token-chart'), { ssr: false });

const DEFAULT_FORM: RangeForm = { sellPct: 8, buyPct: 8, perSwapUsd: 50, intervalHours: 24, runDays: 30, tilt: 0 };

export default function RangePage() {
    const [tokenA, setTokenA] = useState<TokenCacheData | null>(null);
    const [tokenB, setTokenB] = useState<TokenCacheData | null>(null);
    const [form, setForm] = useState<RangeForm>(DEFAULT_FORM);
    const [phase, setPhase] = useState<'setup' | 'signing' | 'done'>('setup');
    const [legs, setLegs] = useState<RangeLegSpec[]>([]);
    const [statuses, setStatuses] = useState<LegStatus[]>([]);
    const [error, setError] = useState<string | null>(null);

    const { address } = useWallet();
    const { getPrice } = usePrices();
    const { getSubnetContractId } = useSubnetTokens();
    const { getSubnetBalance } = useBalances(address ? [address] : []);
    const { createRangeLeg } = useRouterTrading();

    const priceA = tokenA ? getPrice(tokenA.contractId) : null;
    const priceB = tokenB ? getPrice(tokenB.contractId) : null;
    const ready = !!tokenA && !!tokenB && priceA !== null && priceB !== null && priceA > 0 && priceB > 0;
    const ratio = ready ? priceA / priceB : 0;
    const sell = ratio * (1 + form.sellPct / 100);
    const buy = ratio * (1 - form.buyPct / 100);
    const windows = windowsFor(form.runDays * 24, form.intervalHours);
    const preview = rangeProfitPreview({ price: ratio, sell, buy, perSwapUsd: form.perSwapUsd, windows });

    const decA = tokenA?.decimals ?? 6, decB = tokenB?.decimals ?? 6;
    const amountA = ready ? form.perSwapUsd / priceA : 0;
    const amountB = ready ? form.perSwapUsd / priceB : 0;
    const subnetA = tokenA ? getSubnetContractId(tokenA.contractId) : null;
    const subnetB = tokenB ? getSubnetContractId(tokenB.contractId) : null;
    const runway = {
        sells: address && subnetA ? runwayFor(getSubnetBalance(address, subnetA) / 10 ** decA, amountA) : 0,
        buys: address && subnetB ? runwayFor(getSubnetBalance(address, subnetB) / 10 ** decB, amountB) : 0,
    };

    const patch = (p: Partial<RangeForm>) => setForm((f) => ({ ...f, ...p }));
    const onDrag = (line: 'sell' | 'buy', price: number) => {
        if (!ratio) return;
        if (line === 'sell') patch({ sellPct: Math.max(0.5, (price / ratio - 1) * 100) });
        else patch({ buyPct: Math.max(0.5, (1 - price / ratio) * 100) });
    };

    const create = async () => {
        if (!ready || !tokenA || !tokenB || !subnetA || !subnetB || preview.reasons.length) return;
        setError(null);
        const settings: RangeSettings = {
            pair: { a: tokenA.contractId, b: tokenB.contractId },
            subnet: { a: subnetA, b: subnetB },
            sellStart: sell, buyStart: buy, tilt: form.tilt,
            intervalHours: form.intervalHours, windows, perSwapUsd: form.perSwapUsd,
            createdAt: new Date().toISOString(),
        };
        const specs = generateRangeLegs(settings, { a: priceA, b: priceB }, { a: decA, b: decB }, Date.now());
        setLegs(specs);
        setStatuses(specs.map(() => 'pending'));
        setPhase('signing');
        const strategyId = globalThis.crypto?.randomUUID() ?? Date.now().toString();

        for (let i = 0; i < specs.length; i++) {
            setStatuses((s) => s.map((v, k) => (k === i ? 'signing' : v)));
            try {
                await createRangeLeg(specs[i], { strategyId, strategySize: specs.length, range: settings });
                setStatuses((s) => s.map((v, k) => (k === i ? 'done' : v)));
            } catch (err) {
                setStatuses((s) => s.map((v, k) => (k === i ? 'error' : v)));
                setError(`Stopped at order ${i + 1} of ${specs.length}: ${err instanceof Error ? err.message : String(err)}. Orders already signed are live.`);
                break;
            }
        }
        setPhase('done');
    };

    return (
        <div className="container max-w-7xl mx-auto px-4 py-6 space-y-6">
            <div>
                <h1 className="text-2xl font-semibold text-white/95">Range Swaps</h1>
                <p className="text-sm text-white/60">Sell at the top line, buy back at the bottom line, every window, for as long as you choose.</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                    {ready && tokenA && tokenB ? (
                        <ConditionTokenChart
                            token={tokenA}
                            baseToken={tokenB}
                            targetPrice=""
                            onTargetPriceChange={() => {}}
                            band={{ sell, buy, tilt: form.tilt, windows, intervalHours: form.intervalHours, onDrag }}
                        />
                    ) : (
                        <div className="h-[220px] flex items-center justify-center text-sm text-white/50">Pick two tokens to see the chart.</div>
                    )}
                </div>
                <div className="space-y-4">
                    <RangeControls
                        tokenA={tokenA} tokenB={tokenB} onTokenA={setTokenA} onTokenB={setTokenB}
                        form={form} onChange={patch}
                        sellPrice={sell} buyPrice={buy}
                        amountA={amountA.toFixed(Math.min(decA, 4))} amountB={amountB.toFixed(Math.min(decB, 4))}
                    />
                    <RangePreview preview={ready ? preview : { ...preview, reasons: ['Pick two tokens with a price'] }} runway={runway} busy={phase === 'signing'} onCreate={create} />
                    {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">{error}</div>}
                </div>
            </div>
            {legs.length > 0 && tokenA && tokenB && (
                <RangeSchedule legs={legs} statuses={statuses} symbols={{ a: tokenA.symbol, b: tokenB.symbol }} />
            )}
        </div>
    );
}
```

- [ ] **Step 5: Route**

```tsx
// src/app/advanced/range/page.tsx
"use client";

import { Header } from '@/components/layout/header';
import RangePage from '@/components/range/RangePage';

export default function AdvancedRangePage() {
    return (
        <>
            <Header />
            <RangePage />
        </>
    );
}
```

Check `src/app/orders/page.tsx` to confirm pages render `<Header />` themselves and that providers come from the root layout. Match whatever it does.

- [ ] **Step 6: Type check and lint**

Run: `pnpm check-types 2>&1 | grep -E "components/range|advanced/range"; pnpm exec eslint src/components/range src/app/advanced`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/range src/app/advanced
git commit -m "feat(simple-swap): Range Swaps page under Advanced

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Leg matching and run metrics (pure)

**Files:**
- Create: `src/lib/range/match-legs.ts`
- Test: `src/lib/range/match-legs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/range/match-legs.test.ts
import { describe, it, expect } from 'vitest';
import type { LimitOrder } from '@/lib/orders/types';
import { legOutcome, matchRangeLegs, runStatus } from './match-legs';

const NOW = Date.parse('2026-09-30T12:00:00.000Z');
const B = 'SP2.susdh';
const DEC_B = 6;

function order(p: Partial<LimitOrder> & { leg: 'sell' | 'buy'; strategyPosition: number }): LimitOrder {
  return {
    owner: 'SP1', inputToken: 'in', outputToken: 'out', amountIn: '0', recipient: 'SP1', signature: '', uuid: `u${p.strategyPosition}`,
    status: 'open', createdAt: '2026-09-23T12:00:00.000Z', strategyId: 's1', strategyType: 'range', strategySize: 6,
    validFrom: '2026-09-23T12:00:00.000Z', validTo: '2026-09-24T12:00:00.000Z',
    ...p,
  } as LimitOrder;
}
const hit = (leg: 'sell' | 'buy', pos: number, amountIn: string, amountOut: string, ts: string) =>
  order({ leg, strategyPosition: pos, status: 'confirmed', amountIn, metadata: { quote: { amountIn, amountOut, timestamp: ts } } });

const priceAt = () => 1; // sUSDh is $1 whenever asked

describe('legOutcome', () => {
  it('maps statuses and timing to outcomes', () => {
    expect(legOutcome(order({ leg: 'sell', strategyPosition: 1, status: 'confirmed' }), NOW)).toBe('hit');
    expect(legOutcome(order({ leg: 'sell', strategyPosition: 1, status: 'cancelled', cancelledAt: '2026-09-24T12:00:01.000Z' }), NOW)).toBe('expired');
    expect(legOutcome(order({ leg: 'sell', strategyPosition: 1, status: 'cancelled', cancelledAt: '2026-09-23T15:00:00.000Z' }), NOW)).toBe('cancelled');
    expect(legOutcome(order({ leg: 'sell', strategyPosition: 1, status: 'failed' }), NOW)).toBe('expired');
    expect(legOutcome(order({ leg: 'sell', strategyPosition: 1, validFrom: '2026-10-01T00:00:00.000Z', validTo: '2026-10-02T00:00:00.000Z' }), NOW)).toBe('future');
    expect(legOutcome(order({ leg: 'sell', strategyPosition: 1, validFrom: '2026-09-30T00:00:00.000Z', validTo: '2026-10-01T00:00:00.000Z' }), NOW)).toBe('open');
  });
});

describe('runStatus', () => {
  it('is live while anything is open or future, else cancelled if a leg was user-cancelled, else completed', () => {
    expect(runStatus(['hit', 'future'])).toBe('live');
    expect(runStatus(['hit', 'cancelled', 'expired'])).toBe('cancelled');
    expect(runStatus(['hit', 'expired'])).toBe('completed');
  });
});

describe('matchRangeLegs', () => {
  it('pairs each hit buy with the earliest unmatched sell before it and prices in USD', () => {
    const orders = [
      hit('sell', 1, '735000000', '54400000', '2026-09-24T01:00:00.000Z'),   // sold CHA, received 54.4 sUSDh
      hit('buy', 2, '50000000', '790000000', '2026-09-24T09:00:00.000Z'),    // spent 50 sUSDh
      hit('sell', 3, '735000000', '55000000', '2026-09-25T01:00:00.000Z'),   // unmatched
      order({ leg: 'buy', strategyPosition: 4, status: 'cancelled', cancelledAt: '2026-09-26T12:00:01.000Z', validFrom: '2026-09-25T12:00:00.000Z', validTo: '2026-09-26T12:00:00.000Z' }),
      order({ leg: 'sell', strategyPosition: 5, validFrom: '2026-10-01T12:00:00.000Z', validTo: '2026-10-02T12:00:00.000Z' }),
      order({ leg: 'buy', strategyPosition: 6, validFrom: '2026-10-01T12:00:00.000Z', validTo: '2026-10-02T12:00:00.000Z' }),
    ];

    const m = matchRangeLegs(orders, { b: B, decimalsB: DEC_B }, priceAt, NOW);

    expect(m.realizedUsd).toBeCloseTo(4.4, 6);
    expect(m.cyclesDone).toBe(1);
    expect(m.sellsHit).toBe(2);
    expect(m.buysHit).toBe(1);
    expect(m.unmatchedSells).toBe(1);
    expect(m.openPositionB).toBeCloseTo(55, 6);
    expect(m.legsEnded).toBe(4);
    expect(m.legsHit).toBe(3);
    expect(m.windowsElapsed).toBe(2);
    expect(m.status).toBe('live');
  });

  it('skips pairs it cannot price rather than guessing', () => {
    const orders = [
      hit('sell', 1, '1', '54400000', '2026-09-24T01:00:00.000Z'),
      hit('buy', 2, '50000000', '1', '2026-09-24T09:00:00.000Z'),
    ];
    const m = matchRangeLegs(orders, { b: B, decimalsB: DEC_B }, () => null, NOW);
    expect(m.realizedUsd).toBe(0);
    expect(m.unpricedPairs).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test -- src/lib/range/match-legs.test.ts`
Expected: FAIL, "Cannot find module './match-legs'".

- [ ] **Step 3: Implement**

```ts
// src/lib/range/match-legs.ts
import type { LimitOrder } from '@/lib/orders/types';

export type LegOutcome = 'hit' | 'expired' | 'cancelled' | 'open' | 'future';
export type RunStatus = 'live' | 'completed' | 'cancelled';

export interface RangeMetrics {
  realizedUsd: number;
  cyclesDone: number;
  sellsHit: number;
  buysHit: number;
  unmatchedSells: number;
  unmatchedBuys: number;
  /** Token B held from unmatched sells, in display units. */
  openPositionB: number;
  /** Token A held from unmatched buys, in display units. */
  openPositionA: number;
  legsHit: number;
  legsEnded: number;
  windowsElapsed: number;
  unpricedPairs: number;
  outcomes: Record<string, LegOutcome>;
  status: RunStatus;
}

export function legOutcome(o: LimitOrder, now: number): LegOutcome {
  const validFrom = o.validFrom ? Date.parse(o.validFrom) : 0;
  const validTo = o.validTo ? Date.parse(o.validTo) : Infinity;
  if (o.status === 'confirmed' || o.status === 'filled') return 'hit';
  if (o.status === 'failed') return 'expired';
  if (o.status === 'cancelled') {
    const at = o.cancelledAt ? Date.parse(o.cancelledAt) : now;
    return at >= validTo ? 'expired' : 'cancelled';
  }
  if (now < validFrom) return 'future';
  if (now >= validTo) return 'expired';
  return 'open';
}

export function runStatus(outcomes: LegOutcome[]): RunStatus {
  if (outcomes.some((x) => x === 'open' || x === 'future')) return 'live';
  if (outcomes.some((x) => x === 'cancelled')) return 'cancelled';
  return 'completed';
}

const quoteTime = (o: LimitOrder) => Date.parse(o.metadata?.quote?.timestamp ?? o.confirmedAt ?? o.createdAt);
const units = (raw: string | undefined, decimals: number) => Number(raw ?? '0') / 10 ** decimals;

/**
 * Realized profit counts matched cycles only: each hit buy pairs with the earliest
 * unmatched hit sell before it. Both legs are valued in token B at their own quote time.
 */
export function matchRangeLegs(
  orders: LimitOrder[],
  pair: { b: string; decimalsB: number; decimalsA?: number },
  usdPriceAt: (contractId: string, isoTime: string) => number | null,
  now: number = Date.now(),
): RangeMetrics {
  const outcomes: Record<string, LegOutcome> = {};
  for (const o of orders) outcomes[o.uuid] = legOutcome(o, now);

  const hits = orders.filter((o) => outcomes[o.uuid] === 'hit').sort((a, b) => quoteTime(a) - quoteTime(b));
  const sells: LimitOrder[] = [];
  let realizedUsd = 0, cyclesDone = 0, unpricedPairs = 0, buysHit = 0, unmatchedBuys = 0, openPositionA = 0;

  for (const o of hits) {
    if (o.leg === 'sell') { sells.push(o); continue; }
    if (o.leg !== 'buy') continue;
    buysHit++;
    const sell = sells.shift();
    if (!sell) { unmatchedBuys++; openPositionA += units(o.metadata?.quote?.amountOut, pair.decimalsA ?? 6); continue; }
    const sellTs = sell.metadata?.quote?.timestamp ?? sell.confirmedAt ?? sell.createdAt;
    const buyTs = o.metadata?.quote?.timestamp ?? o.confirmedAt ?? o.createdAt;
    const pSell = usdPriceAt(pair.b, sellTs), pBuy = usdPriceAt(pair.b, buyTs);
    if (pSell === null || pBuy === null) { unpricedPairs++; continue; }
    realizedUsd += units(sell.metadata?.quote?.amountOut, pair.decimalsB) * pSell - units(o.amountIn, pair.decimalsB) * pBuy;
    cyclesDone++;
  }

  const openPositionB = sells.reduce((sum, s) => sum + units(s.metadata?.quote?.amountOut, pair.decimalsB), 0);
  const ended = orders.filter((o) => ['hit', 'expired', 'cancelled'].includes(outcomes[o.uuid]));
  const windowsElapsed = new Set(orders.filter((o) => o.validTo && Date.parse(o.validTo) <= now).map((o) => o.validTo)).size;

  return {
    realizedUsd,
    cyclesDone,
    sellsHit: hits.filter((o) => o.leg === 'sell').length,
    buysHit,
    unmatchedSells: sells.length,
    unmatchedBuys,
    openPositionB,
    openPositionA,
    legsHit: hits.length,
    legsEnded: ended.length,
    windowsElapsed,
    unpricedPairs,
    outcomes,
    status: runStatus(Object.values(outcomes)),
  };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- src/lib/range/match-legs.test.ts`
Expected: 4 passed. If `windowsElapsed` comes out as 3 instead of 2, the fourth order's `validTo` (Sep 26) is ≤ NOW (Sep 30); adjust the expectation to the set size of distinct past `validTo` values in the fixture (Sep 24, Sep 26 → 2). Keep the assertion honest against the fixture, do not change the implementation to fit.

- [ ] **Step 5: Commit**

```bash
git add src/lib/range/match-legs.ts src/lib/range/match-legs.test.ts
git commit -m "feat(simple-swap): Match range legs into cycles and run metrics

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Range strategy card on Orders

**Files:**
- Create: `src/components/orders/strategy-cards/types/RangeStrategyCard.tsx`
- Modify: `src/components/orders/strategy-cards/StrategyCardFactory.tsx`
- Modify: `src/components/orders/strategy-cards/index.ts`

- [ ] **Step 1: The card**

```tsx
// src/components/orders/strategy-cards/types/RangeStrategyCard.tsx
"use client";

import React, { useEffect, useState } from 'react';
import type { LineData } from 'lightweight-charts';
import { RangeStrategyCardProps } from '../base/shared-types';
import { BaseStrategyCard } from '../base/BaseStrategyCard';
import { PremiumStatusBadge } from '../../orders-panel';
import { matchRangeLegs, LegOutcome } from '@/lib/range/match-legs';
import { runwayFor } from '@/lib/range/profit-preview';
import type { RangeSettings } from '@/lib/range/types';
import { usePriceSeriesService } from '@/lib/charts/price-series-service';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const usd = (n: number) => `${n < 0 ? '−' : '+'}$${Math.abs(n).toFixed(2)}`;

/** Nearest series point at or before the timestamp. Null when the series has nothing that early. */
function priceAtFrom(series: LineData[]): (isoTime: string) => number | null {
    return (isoTime) => {
        const t = Date.parse(isoTime) / 1000;
        let best: LineData | null = null;
        for (const p of series) { if (Number(p.time) <= t) best = p; else break; }
        return best ? best.value : null;
    };
}

const OUTCOME_LABEL: Record<LegOutcome, string> = { hit: 'filled', expired: 'expired', cancelled: 'cancelled', open: 'open', future: 'upcoming' };

export const RangeStrategyCard: React.FC<RangeStrategyCardProps> = (props) => {
    const { strategyData, expandedStrategies, onToggleExpansion, onCancelOrder, formatTokenAmount } = props;
    const { id, orders } = strategyData;
    const first = orders[0];
    const range = first.metadata?.range as RangeSettings | undefined;
    const isExpanded = expandedStrategies.has(id);

    const { address } = useWallet();
    const { getSubnetBalance } = useBalances(address ? [address] : []);
    const priceSeries = usePriceSeriesService();
    const [seriesB, setSeriesB] = useState<LineData[] | null>(null);
    const [seriesError, setSeriesError] = useState<string | null>(null);

    useEffect(() => {
        if (!range) return;
        let cancelled = false;
        priceSeries.fetchBulkPriceSeries([range.pair.b], '30d')
            .then((bulk) => { if (!cancelled) setSeriesB(bulk[range.pair.b] ?? []); })
            .catch((err) => { if (!cancelled) setSeriesError(err instanceof Error ? err.message : 'Failed to load prices'); });
        return () => { cancelled = true; };
    }, [range?.pair.b, priceSeries]);

    if (!range) {
        return (
            <BaseStrategyCard {...props} onClick={() => onToggleExpansion(id)}>
                <div className="text-sm text-white/80">Range swap · {orders.length} orders</div>
                <div className="text-xs text-orange-400">This run has no band settings saved, so the chart and profit can't be shown.</div>
            </BaseStrategyCard>
        );
    }

    const symA = first.leg === 'sell' ? first.inputTokenMeta.symbol : first.outputTokenMeta.symbol;
    const symB = first.leg === 'sell' ? first.outputTokenMeta.symbol : first.inputTokenMeta.symbol;
    const decA = first.leg === 'sell' ? first.inputTokenMeta.decimals ?? 6 : first.outputTokenMeta.decimals ?? 6;
    const decB = first.leg === 'sell' ? first.outputTokenMeta.decimals ?? 6 : first.inputTokenMeta.decimals ?? 6;
    const priceAt = seriesB ? priceAtFrom(seriesB) : () => null;
    const m = matchRangeLegs(orders, { b: range.pair.b, decimalsB: decB, decimalsA: decA }, (_id, ts) => priceAt(ts));

    const sellLeg = orders.find((o) => o.leg === 'sell'), buyLeg = orders.find((o) => o.leg === 'buy');
    const sellAmt = sellLeg ? Number(sellLeg.amountIn) / 10 ** decA : 0;
    const buyAmt = buyLeg ? Number(buyLeg.amountIn) / 10 ** decB : 0;
    const runway = {
        sells: address ? runwayFor(getSubnetBalance(address, range.subnet.a) / 10 ** decA, sellAmt) : 0,
        buys: address ? runwayFor(getSubnetBalance(address, range.subnet.b) / 10 ** decB, buyAmt) : 0,
    };
    const low = m.status === 'live' && (runway.sells < 3 || runway.buys < 3);
    const openUuids = orders.filter((o) => m.outcomes[o.uuid] === 'open' || m.outcomes[o.uuid] === 'future').map((o) => o.uuid);
    const currentWindow = Math.min(range.windows, m.windowsElapsed + 1);
    const cadence = range.intervalHours === 1 ? 'hourly' : range.intervalHours === 24 ? 'daily' : range.intervalHours === 168 ? 'weekly' : `every ${range.intervalHours}h`;

    const windowsList = Array.from({ length: range.windows }, (_, i) => i + 1).map((w) => ({
        w,
        sell: orders.find((o) => o.leg === 'sell' && Math.ceil((o.strategyPosition ?? 0) / 2) === w),
        buy: orders.find((o) => o.leg === 'buy' && Math.ceil((o.strategyPosition ?? 0) / 2) === w),
    }));

    return (
        <BaseStrategyCard {...props} onClick={() => onToggleExpansion(id)}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                    <div className="text-sm font-medium text-white/90">↕ {symA} ⇄ {symB}</div>
                    <div className="text-xs text-white/60">Range swap · {cadence} · window {currentWindow} of {range.windows} · started {new Date(range.createdAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-2">
                    {low && <span className="text-xs px-2 py-1 rounded-lg bg-amber-500/15 text-amber-300">{runway.sells < 3 ? `${symA} low · ${runway.sells} sells left` : `${symB} low · ${runway.buys} buys left`}</span>}
                    <PremiumStatusBadge status={m.status === 'live' ? 'open' : m.status === 'completed' ? 'confirmed' : 'cancelled'} conditionIcon={null} />
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div><div className="text-white/50 uppercase tracking-wider">Realized {seriesError ? '(prices unavailable)' : m.unpricedPairs ? `(${m.unpricedPairs} unpriced)` : 'at quote'}</div><div className={`font-mono text-base ${m.realizedUsd >= 0 ? 'text-green-400' : 'text-orange-400'}`}>{seriesB ? usd(m.realizedUsd) : '—'}</div></div>
                <div><div className="text-white/50 uppercase tracking-wider">Cycles done</div><div className="font-mono text-base">{m.cyclesDone} of {m.windowsElapsed} so far</div></div>
                <div><div className="text-white/50 uppercase tracking-wider">Hit rate</div><div className="font-mono text-base">{m.legsHit} of {m.legsEnded} legs</div></div>
                <div><div className="text-white/50 uppercase tracking-wider">Sells hit</div><div className="font-mono text-base">{m.sellsHit}{m.unmatchedSells ? ` · ${m.unmatchedSells} unmatched` : ''}</div></div>
                <div><div className="text-white/50 uppercase tracking-wider">Buys hit</div><div className="font-mono text-base">{m.buysHit}{m.unmatchedBuys ? ` · ${m.unmatchedBuys} unmatched` : ''}</div></div>
                <div><div className="text-white/50 uppercase tracking-wider">Open position</div><div className="font-mono text-base">{m.openPositionB > 0 ? `+${m.openPositionB.toFixed(2)} ${symB}` : m.openPositionA > 0 ? `+${m.openPositionA.toFixed(2)} ${symA}` : 'flat'}</div></div>
            </div>

            {m.status === 'live' && (
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-white/60"><span>Runway</span><span>refills as the other side fills</span></div>
                    <div className="flex justify-between"><span className="text-orange-400">{symA} covers {runway.sells} more sells</span>{runway.sells < 3 && <span className="text-amber-300">low</span>}</div>
                    <div className="h-1.5 rounded bg-white/[0.08]"><div className="h-full rounded bg-orange-400" style={{ width: `${Math.min(100, runway.sells * 10)}%` }} /></div>
                    <div className="flex justify-between"><span className="text-green-400">{symB} covers {runway.buys} more buys</span>{runway.buys < 3 && <span className="text-amber-300">low</span>}</div>
                    <div className="h-1.5 rounded bg-white/[0.08]"><div className="h-full rounded bg-green-400" style={{ width: `${Math.min(100, runway.buys * 10)}%` }} /></div>
                </div>
            )}

            <div className="flex items-center justify-center pt-2">
                <button onClick={(e) => { e.stopPropagation(); onToggleExpansion(id); }} className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-white/60 text-xs">
                    <span>{isExpanded ? 'Hide windows' : `Show ${range.windows} windows`}</span>
                    <ChevronDown className={cn('h-3 w-3 transition-transform', isExpanded && 'rotate-180')} />
                </button>
            </div>

            {isExpanded && (
                <div className="border-t border-white/[0.08] pt-3 space-y-1 text-xs" onClick={(e) => e.stopPropagation()}>
                    {windowsList.map(({ w, sell, buy }) => (
                        <div key={w} className="grid grid-cols-[44px_1fr_1fr] gap-2 py-1.5 border-b border-dashed border-white/[0.06]">
                            <span className="font-mono text-white/50">#{w}</span>
                            {[sell, buy].map((o, k) => o ? (
                                <span key={o.uuid} className={cn(m.outcomes[o.uuid] === 'hit' ? (k === 0 ? 'text-orange-400' : 'text-green-400') : 'text-white/50')}>
                                    {k === 0 ? 'sell ≥' : 'buy ≤'} {Number(o.targetPrice).toPrecision(4)} · {OUTCOME_LABEL[m.outcomes[o.uuid]]}
                                    {m.outcomes[o.uuid] === 'hit' && o.metadata?.quote?.amountOut && ` · ${formatTokenAmount(o.metadata.quote.amountOut, o.outputTokenMeta.decimals ?? 6)} ${o.outputTokenMeta.symbol}`}
                                    {(m.outcomes[o.uuid] === 'open' || m.outcomes[o.uuid] === 'future') && (
                                        <button onClick={() => onCancelOrder(o.uuid)} className="ml-2 text-red-400/80 hover:text-red-300">cancel</button>
                                    )}
                                </span>
                            ) : <span key={k} className="text-white/30">—</span>)}
                        </div>
                    ))}
                    {openUuids.length > 0 && (
                        <button
                            onClick={() => { if (window.confirm(`Cancel ${openUuids.length} open orders?`)) openUuids.forEach(onCancelOrder); }}
                            className="mt-2 px-3 py-1.5 rounded-lg border border-red-500/40 text-red-300 hover:bg-red-500/10"
                        >
                            Cancel remaining · {openUuids.length} open
                        </button>
                    )}
                </div>
            )}
        </BaseStrategyCard>
    );
};
```

Note: `window.confirm` is a browser dialog. Check how `onCancelOrder` in `orders-panel.tsx` confirms today (line ~995). If it already confirms per order, drop the `window.confirm` here and call `openUuids.forEach(onCancelOrder)` directly; do not double-confirm.

- [ ] **Step 2: Register it**

`StrategyCardFactory.tsx`: import `RangeStrategyCard`, add `case 'range': return <RangeStrategyCard {...props} strategyData={strategyData as StrategyDisplayData & { type: 'range' }} />;`, add `range: React.ComponentType<any>;` to `StrategyComponentRegistry` and `range: RangeStrategyCard,` to `defaultRegistry`.

`index.ts`: export `RangeStrategyCard`, `RangeStrategyCardProps`, and `isRangeStrategy`.

- [ ] **Step 3: Type check and lint**

Run: `pnpm check-types 2>&1 | grep -E "RangeStrategyCard|StrategyCardFactory|strategy-cards/index"; pnpm exec eslint src/components/orders/strategy-cards`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/components/orders/strategy-cards
git commit -m "feat(simple-swap): Range strategy card on the Orders page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Preview deployment and verification

**Files:** none.

- [ ] **Step 1: Full test run and type check**

Run: `pnpm test 2>&1 | tail -4`
Expected: all test files pass (the pre-existing `middleware.test.ts` passes once workspace packages are built; if it fails on `blaze-sdk` resolution, run `pnpm --filter "simple-swap^..." build` from the repo root and retry).

- [ ] **Step 2: Push the branch**

```bash
git push -u origin HEAD
cd /Users/ross/Documents/charisma && for i in $(seq 1 20); do sleep 20; line=$(vercel ls charisma-simple-swap --scope pointblankdev 2>&1 | grep -m1 Preview); echo "$line" | grep -qE "Ready|Error" && break; done; echo "$line"
```

- [ ] **Step 3: Verify in Chrome on the preview URL (no wallet needed)**

- `/advanced/range` loads with the Header, an Advanced menu, and the "Pick two tokens" chart placeholder.
- The Advanced ▾ menu lists Range Swaps on desktop; the mobile sheet shows it under an Advanced label.
- The Orders page still renders existing DCA and single cards unchanged.

- [ ] **Step 4: Hand off to Ross for wallet checks**

Report the preview URL and ask Ross to:
1. Pick two subnet-funded tokens and confirm the chart shows the band; drag each line; type in the % inputs; move the tilt slider.
2. Confirm the preview numbers and the button label update, and that the button disables with a reason when the band crosses price.
3. Create a small run (e.g. daily for 1 week = 14 orders) and sign through.
4. Open Orders and confirm the Range card shows the run with 14 legs, the runway bars, and cancel remaining works.

Do not merge until Ross confirms steps 1–4.
