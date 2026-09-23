# Range Swaps Phase 2: Guide Me Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Guide me" button to the Range Swaps page that opens a six-step wizard which starts from a profit goal and ends by filling the page's controls.

**Architecture:** Two pure modules (`band-crossings` counts cycle-sized swings in a price series; `goal-solver` turns a goal, a duration, a volatility read, live route cost and wallet balances into a reachable configuration) with vitest tests. One dialog component (`RangeWizard`) renders the steps and calls `onApply` with the chosen tokens and form values. The page owns a `wizardOpen` flag and applies the result to its existing state, so everything downstream (chart, quotes, preview) re-derives on its own.

**Tech Stack:** Next.js 15, React 19, TypeScript, vitest 3 (node), existing `Dialog` primitives in `src/components/ui/dialog.tsx`, lightweight-charts data already fetched by `priceSeriesService`.

**Spec:** `docs/superpowers/specs/2026-09-23-range-swaps-design.md`, section "Guide me wizard".

**Baseline:** main at `2ba00032` (phase 1 merged). Branch: `feat/range-wizard`.

---

## Working notes for every task

- Run commands from `apps/simple-swap`. Tests: `pnpm test -- <path>`. Type check: `pnpm check-types 2>&1 | grep -E "<your files>"`. Lint: `pnpm exec eslint <files>`.
- Never build the app; local dev cannot render `/swap` or `/advanced/range`. Verify UI on a branch preview (push, then `vercel ls charisma-simple-swap --scope pointblankdev`).
- No mock data, no fallbacks. No `useMemo`/`useCallback`. Commit after every task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Phase-1 pieces you will call: `rangeProfitPreview`, `windowsFor`, `runwayFor`, `MAX_ORDERS` in `src/lib/range/profit-preview.ts`; `routeCostPerCycle` in `src/lib/range/route-cost.ts`; `useSubnetFundedTokens` and `SubnetPairSelector` in `src/components/range/SubnetPairSelector.tsx`; `RangeForm` in `src/components/range/RangeControls.tsx`; `priceSeriesService.fetchBulkPriceSeries(ids, '30d')` in `src/lib/charts/price-series-service.ts`; `getQuote` server action in `src/app/actions.ts`; `RangePage.tsx` state (`tokenA`, `tokenB`, `form`, quote effect, `swapPair`).

## File structure

| File | Responsibility |
|---|---|
| `src/lib/range/band-crossings.ts` (+ test) | Pure: count cycle-sized swings in a price series for a given band width. |
| `src/lib/range/goal-solver.ts` (+ test) | Pure: from goal, deadline, crossings per band, route cost and balances, pick band and per-swap amount, or report the closest reachable outcome. |
| `src/components/range/wizard/RangeWizard.tsx` | Dialog shell, step state, navigation, calls `onApply`. |
| `src/components/range/wizard/StepGoal.tsx` | USD goal + deadline. |
| `src/components/range/wizard/StepPair.tsx` | Two subnet-pair selectors. |
| `src/components/range/wizard/StepVolatility.tsx` | Shows the 30-day read: range and cycles per band width. |
| `src/components/range/wizard/StepRisk.tsx` | Narrow↔wide dial with what each width would have earned toward the goal. |
| `src/components/range/wizard/StepAmount.tsx` | Per-swap amount, pre-filled and capped by balances. |
| `src/components/range/wizard/StepReview.tsx` | Summary and "Looks right, take me there". |
| `src/components/range/RangePage.tsx` | "Guide me" button, `wizardOpen`, `applyWizard`. |

---

### Task 1: Band crossings (pure)

**Files:**
- Create: `src/lib/range/band-crossings.ts`
- Test: `src/lib/range/band-crossings.test.ts`

Definition: a cycle-sized swing for band width `p` is a rise of ratio `R = (1 + p) / (1 − p)` from a trough followed by a fall back by the same ratio from the peak. That is exactly the price move a sell-at-top / buy-at-bottom pair needs.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/range/band-crossings.test.ts
import { describe, it, expect } from 'vitest';
import { countBandCycles, cycleRatio } from './band-crossings';

const series = (values: number[]) => values.map((value, i) => ({ time: i * 3600, value }));

describe('cycleRatio', () => {
  it('is the top-to-bottom ratio of a symmetric band', () => {
    expect(cycleRatio(0.08)).toBeCloseTo(1.08 / 0.92, 10);
  });
});

describe('countBandCycles', () => {
  it('counts a full rise and fall of the band ratio as one cycle', () => {
    // 8% band: needs ×1.1739 up then ÷1.1739 down
    expect(countBandCycles(series([100, 118, 100]), 0.08)).toBe(1);
  });

  it('does not count a rise that never comes back down', () => {
    expect(countBandCycles(series([100, 118, 130]), 0.08)).toBe(0);
  });

  it('counts repeated swings', () => {
    expect(countBandCycles(series([100, 120, 100, 120, 100, 120, 100]), 0.08)).toBe(3);
  });

  it('tracks a drifting trough so a slow climb still counts swings from the latest low', () => {
    expect(countBandCycles(series([100, 90, 110, 92, 112]), 0.08)).toBe(1);
  });

  it('returns 0 for empty, single-point, or invalid input', () => {
    expect(countBandCycles(series([]), 0.08)).toBe(0);
    expect(countBandCycles(series([100]), 0.08)).toBe(0);
    expect(countBandCycles(series([100, 118, 100]), 0)).toBe(0);
    expect(countBandCycles(series([100, 118, 100]), 1)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/lib/range/band-crossings.test.ts`
Expected: FAIL, "Cannot find module './band-crossings'".

- [ ] **Step 3: Implement**

```ts
// src/lib/range/band-crossings.ts
import type { LineData } from 'lightweight-charts';

/** Peak-to-trough ratio a symmetric ±p band requires for one sell→buy cycle. */
export function cycleRatio(bandPct: number): number {
  return (1 + bandPct) / (1 - bandPct);
}

/**
 * Count cycle-sized swings in a price series: a rise of `cycleRatio(bandPct)` from the
 * running trough, then a fall by the same ratio from the running peak. Pure, O(n).
 */
export function countBandCycles(series: Pick<LineData, 'value'>[], bandPct: number): number {
  if (!(bandPct > 0) || !(bandPct < 1) || series.length < 2) return 0;
  const r = cycleRatio(bandPct);
  let low = series[0].value;
  let high = series[0].value;
  let seekingHigh = true;
  let cycles = 0;

  for (const { value } of series) {
    if (!(value > 0)) continue;
    if (seekingHigh) {
      if (value < low) low = value;
      if (value >= low * r) { high = value; seekingHigh = false; }
    } else {
      if (value > high) high = value;
      if (value <= high / r) { cycles++; low = value; seekingHigh = true; }
    }
  }
  return cycles;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- src/lib/range/band-crossings.test.ts`
Expected: 6 passed. Then `pnpm check-types 2>&1 | grep band-crossings` (nothing) and `pnpm exec eslint src/lib/range/band-crossings.ts src/lib/range/band-crossings.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/range/band-crossings.ts src/lib/range/band-crossings.test.ts
git commit -m "feat(simple-swap): Count cycle-sized swings in a price series

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Goal solver (pure)

**Files:**
- Create: `src/lib/range/goal-solver.ts`
- Test: `src/lib/range/goal-solver.test.ts`

Inputs are all plain numbers so the page can compute them from live data. The solver never fetches.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/range/goal-solver.test.ts
import { describe, it, expect } from 'vitest';
import { solveGoal, BAND_OPTIONS } from './goal-solver';

const base = {
  goalUsd: 100,
  runDays: 30,
  intervalHours: 24,
  // cycles observed over the last 30 days per band width (index-aligned with BAND_OPTIONS)
  cyclesPer30d: [12, 6, 2],
  // route cost per cycle as a fraction of per-swap USD (from live quotes at a reference amount)
  routeCostFraction: 0.01,
  maxPerSwapUsd: 60,
};

describe('BAND_OPTIONS', () => {
  it('goes from narrow to wide', () => {
    expect(BAND_OPTIONS).toEqual([0.04, 0.08, 0.15]);
  });
});

describe('solveGoal', () => {
  it('picks the narrowest band and the smallest per-swap amount that reaches the goal', () => {
    const r = solveGoal(base);
    // ±4%: spread 8.33%, net per cycle = usd × (0.0833 − 0.01); 12 cycles → need usd ≈ 113 > cap
    // ±8%: spread 17.39%, net = usd × 0.1639; 6 cycles → usd ≈ 101.7 > cap
    // ±15%: spread 35.29%, net = usd × 0.3429; 2 cycles → usd ≈ 145.8 > cap
    expect(r.reachable).toBe(false);
    expect(r.bandPct).toBe(0.08);           // the band that gets closest at the cap
    expect(r.perSwapUsd).toBe(60);
    expect(r.expectedUsd).toBeCloseTo(60 * 0.1639 * 6, 0);
  });

  it('reports reachable with the minimal amount when the cap allows it', () => {
    const r = solveGoal({ ...base, goalUsd: 30 });
    expect(r.reachable).toBe(true);
    expect(r.bandPct).toBe(0.04);
    expect(r.perSwapUsd).toBe(35); // ceil(30 / (12 × (1.04/0.96 − 1 − 0.01))) = ceil(34.09)
  });

  it('scales the observed cycles to the run length', () => {
    const r = solveGoal({ ...base, goalUsd: 30, runDays: 15, maxPerSwapUsd: 100 });
    expect(r.bandPct).toBe(0.04);
    expect(r.expectedCycles).toBeCloseTo(6, 6); // 12 per 30d → 6 per 15d at ±4%
  });

  it('never proposes more orders than the cap allows', () => {
    const r = solveGoal({ ...base, goalUsd: 30, intervalHours: 6, runDays: 90 });
    expect(r.reasons).toContain('Too many orders for one sitting; widen the interval or shorten the run');
  });

  it('rounds the amount up to whole dollars', () => {
    expect(Number.isInteger(solveGoal({ ...base, goalUsd: 30 }).perSwapUsd)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test -- src/lib/range/goal-solver.test.ts`
Expected: FAIL, "Cannot find module './goal-solver'".

- [ ] **Step 3: Implement**

```ts
// src/lib/range/goal-solver.ts
import { MAX_ORDERS, windowsFor } from './profit-preview';
import { cycleRatio } from './band-crossings';

/** Band half-widths the wizard offers, narrow to wide. */
export const BAND_OPTIONS = [0.04, 0.08, 0.15] as const;

export interface GoalInput {
  goalUsd: number;
  runDays: number;
  intervalHours: number;
  /** Cycles observed over the last 30 days, one entry per BAND_OPTIONS entry. */
  cyclesPer30d: number[];
  /** Route cost per cycle as a fraction of the per-swap amount. */
  routeCostFraction: number;
  /** Largest per-swap amount the smaller wallet side can fund for at least one leg. */
  maxPerSwapUsd: number;
}

export interface GoalResult {
  reachable: boolean;
  bandPct: number;
  perSwapUsd: number;
  expectedCycles: number;
  expectedUsd: number;
  reasons: string[];
}

export function solveGoal(input: GoalInput): GoalResult {
  const reasons: string[] = [];
  const windows = windowsFor(input.runDays * 24, input.intervalHours);
  if (windows * 2 > MAX_ORDERS) reasons.push('Too many orders for one sitting; widen the interval or shorten the run');
  if (!(input.goalUsd > 0)) reasons.push('Goal must be more than $0');
  if (!(input.maxPerSwapUsd > 0)) reasons.push('Wallet has no subnet balance to start with');

  let best: GoalResult | null = null;

  BAND_OPTIONS.forEach((bandPct, i) => {
    const spread = cycleRatio(bandPct) - 1;
    const netFraction = spread - input.routeCostFraction;
    const expectedCycles = (input.cyclesPer30d[i] ?? 0) * (input.runDays / 30);
    if (netFraction <= 0 || expectedCycles <= 0) return;

    const needed = Math.ceil(input.goalUsd / (expectedCycles * netFraction));
    const perSwapUsd = Math.min(needed, Math.floor(input.maxPerSwapUsd));
    const expectedUsd = perSwapUsd * netFraction * expectedCycles;
    const candidate: GoalResult = {
      reachable: needed <= input.maxPerSwapUsd,
      bandPct,
      perSwapUsd,
      expectedCycles,
      expectedUsd,
      reasons,
    };

    // First reachable band wins (narrowest); otherwise keep the band with the highest expected USD.
    if (candidate.reachable && !(best && best.reachable)) best = candidate;
    else if (!best || (!best.reachable && !candidate.reachable && candidate.expectedUsd > best.expectedUsd)) best = candidate;
  });

  if (!best) {
    return { reachable: false, bandPct: BAND_OPTIONS[1], perSwapUsd: 0, expectedCycles: 0, expectedUsd: 0, reasons: [...reasons, 'This pair did not swing enough last month for any band'] };
  }
  return best;
}
```

Note: `cyclesPer30d[i] ?? 0` is a guard against a short array, not a data fallback; document it in a comment. Note also that `fetchBulkPriceSeries` swallows per-token failures and returns `[]`, so in the wizard the `ratio.length < 2` check is the real guard; the `.catch` rarely fires.

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm test -- src/lib/range/goal-solver.test.ts`
Expected: 6 passed. If the first test's expected band differs because the expected-USD tie-break picks ±15% (60 × 0.3429 × 2 = 41.1) over ±8% (60 × 0.1639 × 6 = 59.0), the test is right and the code is wrong; do not adjust the test. Then type check and lint the two files.

- [ ] **Step 5: Commit**

```bash
git add src/lib/range/goal-solver.ts src/lib/range/goal-solver.test.ts
git commit -m "feat(simple-swap): Solve a profit goal into a range band and per-swap amount

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Wizard dialog and steps

**Files:**
- Create: `src/components/range/wizard/RangeWizard.tsx`
- Create: `src/components/range/wizard/StepGoal.tsx`, `StepPair.tsx`, `StepVolatility.tsx`, `StepRisk.tsx`, `StepAmount.tsx`, `StepReview.tsx`

No unit tests (React, no DOM). Verified on the preview in Task 5.

- [ ] **Step 1: Shell**

```tsx
// src/components/range/wizard/RangeWizard.tsx
"use client";

import { useEffect, useState } from 'react';
import type { LineData } from 'lightweight-charts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { usePrices } from '@/contexts/token-price-context';
import { useSubnetTokens } from '@/contexts/subnet-tokens-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { useWallet } from '@/contexts/wallet-context';
import { usePriceSeriesService } from '@/lib/charts/price-series-service';
import { calculateSimpleRatio, cleanPriceData } from '@/lib/charts/simple-chart-utils';
import { countBandCycles } from '@/lib/range/band-crossings';
import { routeCostPerCycle } from '@/lib/range/route-cost';
import { getQuote } from '@/app/actions';
import { convertToMicroUnits } from '@/lib/swap-utils';
import { BAND_OPTIONS, solveGoal, GoalResult } from '@/lib/range/goal-solver';
import type { RangeForm } from '../RangeControls';
import StepGoal from './StepGoal';
import StepPair from './StepPair';
import StepVolatility from './StepVolatility';
import StepRisk from './StepRisk';
import StepAmount from './StepAmount';
import StepReview from './StepReview';

export interface WizardResult { tokenA: TokenCacheData; tokenB: TokenCacheData; form: RangeForm }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (result: WizardResult) => void;
}

/** Reference amount used to quote the wizard's pair; the cost fraction is nearly flat across small amounts. */
const QUOTE_REFERENCE_USD = 20;

const STEPS = ['Goal', 'Pair', 'Volatility', 'Risk', 'Amount', 'Review'] as const;
const DEADLINES = [{ days: 7, label: '1 week' }, { days: 30, label: '1 month' }, { days: 90, label: '3 months' }];

export default function RangeWizard({ open, onOpenChange, onApply }: Props) {
  const [step, setStep] = useState(0);
  const [routeCostFraction, setRouteCostFraction] = useState<number | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [goalUsd, setGoalUsd] = useState(50);
  const [runDays, setRunDays] = useState(30);
  const [intervalHours, setIntervalHours] = useState(24);
  const [tokenA, setTokenA] = useState<TokenCacheData | null>(null);
  const [tokenB, setTokenB] = useState<TokenCacheData | null>(null);
  const [ratioSeries, setRatioSeries] = useState<LineData[] | null>(null);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [bandIndex, setBandIndex] = useState(1);
  const [perSwapUsd, setPerSwapUsd] = useState<number | null>(null);

  const { address } = useWallet();
  const { getPrice } = usePrices();
  const { getSubnetContractId } = useSubnetTokens();
  const { getSubnetBalance } = useBalances(address ? [address] : []);
  const priceSeries = usePriceSeriesService();

  const priceA = tokenA ? getPrice(tokenA.contractId) : null;
  const priceB = tokenB ? getPrice(tokenB.contractId) : null;
  const subnetA = tokenA ? getSubnetContractId(tokenA.contractId) : null;
  const subnetB = tokenB ? getSubnetContractId(tokenB.contractId) : null;

  // 30-day ratio series for the pair (same data the chart uses)
  const idA = tokenA?.contractId ?? null, idB = tokenB?.contractId ?? null;
  useEffect(() => {
    if (!idA || !idB) { setRatioSeries(null); return; }
    let cancelled = false;
    setSeriesError(null);
    priceSeries.fetchBulkPriceSeries([idA, idB], '30d').then((bulk) => {
      if (cancelled) return;
      const ratio = calculateSimpleRatio(cleanPriceData(bulk[idA]), cleanPriceData(bulk[idB]));
      if (ratio.length < 2) { setSeriesError('Not enough price history for this pair'); setRatioSeries(null); return; }
      setRatioSeries(ratio);
    }).catch((err) => { if (!cancelled) setSeriesError(err instanceof Error ? err.message : 'Failed to load price history'); });
    return () => { cancelled = true; };
  }, [idA, idB, priceSeries]);

  // Reset when reopened so a second run does not resume at Review with stale values
  useEffect(() => { if (open) { setStep(0); setPerSwapUsd(null); } }, [open]);

  // Quote the wizard's own pair at a reference amount, the same way RangePage does, so the
  // cost fraction is available even when the page has no pair yet.
  useEffect(() => {
    if (!subnetA || !subnetB || !priceA || !priceB || tokenA?.decimals === undefined || tokenB?.decimals === undefined) { setRouteCostFraction(null); return; }
    let cancelled = false;
    setQuoteError(null);
    const decA = tokenA.decimals, decB = tokenB.decimals;
    const sellIn = Number((QUOTE_REFERENCE_USD / priceA).toFixed(decA));
    const buyIn = Number((QUOTE_REFERENCE_USD / priceB).toFixed(decB));
    (async () => {
      try {
        const [sell, buy] = await Promise.all([
          getQuote(subnetA, subnetB, convertToMicroUnits(sellIn.toFixed(decA), decA)),
          getQuote(subnetB, subnetA, convertToMicroUnits(buyIn.toFixed(decB), decB)),
        ]);
        if (cancelled) return;
        if (!sell.data || !buy.data) throw new Error(sell.error || buy.error || 'No route for this pair');
        const cost = routeCostPerCycle({ sellIn, sellOut: Number(sell.data.amountOut) / 10 ** decB, buyIn, buyOut: Number(buy.data.amountOut) / 10 ** decA, priceA, priceB });
        setRouteCostFraction(cost.totalUsd / QUOTE_REFERENCE_USD);
      } catch (err) {
        if (!cancelled) { setRouteCostFraction(null); setQuoteError(err instanceof Error ? err.message : 'Failed to quote this pair'); }
      }
    })();
    return () => { cancelled = true; };
  }, [subnetA, subnetB, priceA, priceB, tokenA?.decimals, tokenB?.decimals]);

  const cyclesPer30d = ratioSeries ? BAND_OPTIONS.map((p) => countBandCycles(ratioSeries, p)) : null;
  const balanceUsdA = address && subnetA && priceA && tokenA?.decimals !== undefined ? (getSubnetBalance(address, subnetA) / 10 ** tokenA.decimals) * priceA : 0;
  const balanceUsdB = address && subnetB && priceB && tokenB?.decimals !== undefined ? (getSubnetBalance(address, subnetB) / 10 ** tokenB.decimals) * priceB : 0;
  const maxPerSwapUsd = Math.min(balanceUsdA, balanceUsdB);

  const solved: GoalResult | null = cyclesPer30d && routeCostFraction !== null
    ? solveGoal({ goalUsd, runDays, intervalHours, cyclesPer30d, routeCostFraction, maxPerSwapUsd })
    : null;

  const ready = { 0: goalUsd > 0, 1: !!tokenA && !!tokenB, 2: !!cyclesPer30d, 3: !!solved, 4: (perSwapUsd ?? solved?.perSwapUsd ?? 0) > 0, 5: true }[step];

  const apply = () => {
    if (!tokenA || !tokenB || !solved) return;
    const pct = BAND_OPTIONS[bandIndex] * 100;
    onApply({ tokenA, tokenB, form: { sellPct: pct, buyPct: pct, perSwapUsd: perSwapUsd ?? solved.perSwapUsd, intervalHours, runDays, tilt: 0 } });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-background border border-border max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white/95">Guide me</DialogTitle>
          <DialogDescription className="text-white/60">Step {step + 1} of {STEPS.length} · {STEPS[step]}</DialogDescription>
          <nav className="flex gap-1 pt-2" aria-label="Wizard steps">
            {STEPS.map((label, i) => (
              <button key={label} type="button" disabled={i > step} onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined} className={`px-2 py-0.5 text-xs rounded-md ${i === step ? 'bg-white/[0.1] text-white/95' : i < step ? 'text-white/60 hover:text-white/90' : 'text-white/30'}`}>{label}</button>
            ))}
          </nav>
        </DialogHeader>

        {step === 0 && <StepGoal goalUsd={goalUsd} onGoal={setGoalUsd} runDays={runDays} onRunDays={setRunDays} deadlines={DEADLINES} />}
        {step === 1 && <StepPair tokenA={tokenA} tokenB={tokenB} onTokenA={setTokenA} onTokenB={setTokenB} />}
        {step === 2 && <StepVolatility series={ratioSeries} error={seriesError} cyclesPer30d={cyclesPer30d} symbols={{ a: tokenA?.symbol ?? '', b: tokenB?.symbol ?? '' }} />}
        {step === 3 && <StepRisk bandIndex={bandIndex} onBand={setBandIndex} cyclesPer30d={cyclesPer30d} runDays={runDays} routeCostFraction={routeCostFraction} quoteError={quoteError} goalUsd={goalUsd} maxPerSwapUsd={maxPerSwapUsd} solved={solved} />}
        {step === 4 && <StepAmount value={perSwapUsd ?? solved?.perSwapUsd ?? 0} onChange={setPerSwapUsd} maxPerSwapUsd={maxPerSwapUsd} intervalHours={intervalHours} onInterval={setIntervalHours} runDays={runDays} symbols={{ a: tokenA?.symbol ?? '', b: tokenB?.symbol ?? '' }} solved={solved} />}
        {step === 5 && solved && tokenA && tokenB && <StepReview tokenA={tokenA} tokenB={tokenB} bandPct={BAND_OPTIONS[bandIndex]} perSwapUsd={perSwapUsd ?? solved.perSwapUsd} intervalHours={intervalHours} runDays={runDays} solved={solved} />}

        <div className="flex justify-between pt-4">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)} className="px-4 py-2 rounded-xl text-sm text-white/70 hover:bg-white/[0.05] disabled:opacity-40">Back</button>
          {step < STEPS.length - 1 ? (
            <button type="button" disabled={!ready} onClick={() => setStep((s) => s + 1)} className="px-4 py-2 rounded-xl text-sm font-medium bg-white/[0.1] text-white/95 disabled:opacity-40">Next</button>
          ) : (
            <button type="button" onClick={apply} className="px-4 py-2 rounded-xl text-sm font-semibold bg-purple-500 text-white">Looks right, take me there</button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Steps**

Each step is a small presentational component. Keep them short; copy is from the spec.

```tsx
// StepGoal.tsx
"use client";
interface Props { goalUsd: number; onGoal: (n: number) => void; runDays: number; onRunDays: (d: number) => void; deadlines: { days: number; label: string }[] }
export default function StepGoal({ goalUsd, onGoal, runDays, onRunDays, deadlines }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-medium text-white/90">How much do you want to make?</h3>
        <p className="text-sm text-white/60">A dollar goal for the whole run. We work backwards from it.</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
          <span className="text-white/50">$</span>
          <input id="wizard-goal" type="number" min={1} step={5} value={goalUsd} onChange={(e) => { const v = e.target.valueAsNumber; if (!Number.isNaN(v)) onGoal(v); }} className="w-full bg-transparent text-lg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          <span className="text-xs text-white/50">USD</span>
        </div>
      </div>
      <div>
        <h3 className="text-base font-medium text-white/90">By when?</h3>
        <div className="mt-3 grid grid-flow-col gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5" role="group" aria-label="Deadline">
          {deadlines.map((d) => (
            <button key={d.days} type="button" aria-pressed={runDays === d.days} onClick={() => onRunDays(d.days)} className={`px-2 py-1.5 text-xs rounded-md ${runDays === d.days ? 'bg-white/[0.1] text-white/95' : 'text-white/60 hover:text-white/80'}`}>{d.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

```tsx
// StepPair.tsx
"use client";
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import SubnetPairSelector from '../SubnetPairSelector';
interface Props { tokenA: TokenCacheData | null; tokenB: TokenCacheData | null; onTokenA: (t: TokenCacheData) => void; onTokenB: (t: TokenCacheData) => void }
export default function StepPair({ tokenA, tokenB, onTokenA, onTokenB }: Props) {
  return (
    <div className="space-y-3">
      <h3 className="text-base font-medium text-white/90">Which two tokens?</h3>
      <p className="text-sm text-white/60">Only tokens you hold on the subnet are offered, because a range swap sends from both sides.</p>
      <div className="flex items-center gap-2">
        <SubnetPairSelector label="Sell" selected={tokenA} onSelect={onTokenA} exclude={tokenB?.contractId} />
        <span className="text-white/40">⇄</span>
        <SubnetPairSelector label="For" selected={tokenB} onSelect={onTokenB} exclude={tokenA?.contractId} />
      </div>
    </div>
  );
}
```

```tsx
// StepVolatility.tsx
"use client";
import type { LineData } from 'lightweight-charts';
import { BAND_OPTIONS } from '@/lib/range/goal-solver';
interface Props { series: LineData[] | null; error: string | null; cyclesPer30d: number[] | null; symbols: { a: string; b: string } }
export default function StepVolatility({ series, error, cyclesPer30d, symbols }: Props) {
  if (error) return <p className="text-sm text-orange-400">{error}</p>;
  if (!series || !cyclesPer30d) return <p className="text-sm text-white/60">Loading the last 30 days…</p>;
  const values = series.map((p) => p.value);
  const lo = Math.min(...values), hi = Math.max(...values);
  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium text-white/90">How lively is {symbols.a}/{symbols.b}?</h3>
      <p className="text-sm text-white/60">Last 30 days it ranged from <span className="font-mono text-white/90">{lo.toPrecision(4)}</span> to <span className="font-mono text-white/90">{hi.toPrecision(4)}</span>. Here is how many full sell-and-buy-back swings each band width would have seen:</p>
      <div className="grid grid-cols-3 gap-2">
        {BAND_OPTIONS.map((p, i) => (
          <div key={p} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 text-center">
            <div className="text-xs text-white/50">±{Math.round(p * 100)}%</div>
            <div className="text-xl font-semibold text-white/95">{cyclesPer30d[i]}</div>
            <div className="text-xs text-white/50">cycles</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-white/40">Past swings are a read on volatility, not a forecast.</p>
    </div>
  );
}
```

```tsx
// StepRisk.tsx
"use client";
import { BAND_OPTIONS, solveGoal, GoalResult } from '@/lib/range/goal-solver';
import { cycleRatio } from '@/lib/range/band-crossings';
interface Props { bandIndex: number; onBand: (i: number) => void; cyclesPer30d: number[] | null; runDays: number; routeCostFraction: number | null; quoteError: string | null; goalUsd: number; maxPerSwapUsd: number; solved: GoalResult | null }
const usd = (n: number) => `$${n.toFixed(0)}`;
export default function StepRisk({ bandIndex, onBand, cyclesPer30d, runDays, routeCostFraction, quoteError, goalUsd, maxPerSwapUsd, solved }: Props) {
  if (quoteError) return <p className="text-sm text-orange-400">{quoteError}</p>;
  if (!cyclesPer30d || routeCostFraction === null) return <p className="text-sm text-white/60">Waiting for price history and route quotes…</p>;
  return (
    <div className="space-y-4">
      <h3 className="text-base font-medium text-white/90">How much risk?</h3>
      <p className="text-sm text-white/60">Narrow bands fill often for small gains. Wide bands fill rarely for big ones. Each card shows what that width would have earned toward your {usd(goalUsd)} goal at the largest amount your wallet can fund.</p>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Band width">
        {BAND_OPTIONS.map((p, i) => {
          const spread = cycleRatio(p) - 1;
          const cycles = cyclesPer30d[i] * (runDays / 30);
          const earned = Math.floor(maxPerSwapUsd) * (spread - routeCostFraction) * cycles;
          return (
            <button key={p} type="button" role="radio" aria-checked={bandIndex === i} onClick={() => onBand(i)} className={`rounded-lg border p-3 text-left ${bandIndex === i ? 'border-purple-400 bg-purple-500/10' : 'border-white/[0.08] bg-white/[0.02]'}`}>
              <div className="text-xs text-white/50">{i === 0 ? 'Narrow' : i === 1 ? 'Balanced' : 'Wide'} · ±{Math.round(p * 100)}%</div>
              <div className="text-lg font-semibold text-white/95">{usd(Math.max(0, earned))}</div>
              <div className="text-xs text-white/50">≈ {cycles.toFixed(1)} cycles</div>
            </button>
          );
        })}
      </div>
      {solved && !solved.reachable && (
        <p className="text-sm text-orange-400">Your goal is not reachable with what your wallet holds on the subnet. The closest is about {usd(solved.expectedUsd)} at ±{Math.round(solved.bandPct * 100)}%.</p>
      )}
      {solved?.reasons.map((r) => <p key={r} className="text-sm text-orange-400">{r}</p>)}
    </div>
  );
}
```

```tsx
// StepAmount.tsx
"use client";
import { MAX_ORDERS, windowsFor } from '@/lib/range/profit-preview';
import type { GoalResult } from '@/lib/range/goal-solver';
interface Props { value: number; onChange: (n: number) => void; maxPerSwapUsd: number; intervalHours: number; onInterval: (h: number) => void; runDays: number; symbols: { a: string; b: string }; solved: GoalResult | null }
const INTERVALS = [{ h: 6, label: '6 hours' }, { h: 24, label: 'Day' }, { h: 168, label: 'Week' }];
export default function StepAmount({ value, onChange, maxPerSwapUsd, intervalHours, onInterval, runDays, symbols, solved }: Props) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-base font-medium text-white/90">How much per swap?</h3>
        <p className="text-sm text-white/60">Pre-filled from your goal. Your wallet can start with up to ${Math.floor(maxPerSwapUsd)} per swap on the smaller side ({symbols.a} / {symbols.b}); fills refill the other side.</p>
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2">
          <span className="text-white/50">$</span>
          <input id="wizard-per-swap" type="number" min={1} step={1} value={value} onChange={(e) => { const v = e.target.valueAsNumber; if (!Number.isNaN(v)) onChange(v); }} className="w-full bg-transparent text-lg outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
          <span className="text-xs text-white/50">USD</span>
        </div>
        {solved && !solved.reachable && (
          <p className="mt-2 text-sm text-orange-400">Your goal is not reachable with this amount. The closest is about ${solved.expectedUsd.toFixed(0)} at ±{Math.round(solved.bandPct * 100)}%.</p>
        )}
      </div>
      <div>
        <h3 className="text-base font-medium text-white/90">Trigger every</h3>
        <div className="mt-3 grid grid-flow-col gap-1 bg-white/[0.03] border border-white/[0.08] rounded-lg p-0.5" role="group" aria-label="Interval">
          {INTERVALS.map((o) => {
            const over = windowsFor(runDays * 24, o.h) * 2 > MAX_ORDERS;
            return <button key={o.h} type="button" disabled={over} title={over ? 'Over the 200-order cap for this run length' : undefined} aria-pressed={intervalHours === o.h} onClick={() => onInterval(o.h)} className={`px-2 py-1.5 text-xs rounded-md ${intervalHours === o.h ? 'bg-white/[0.1] text-white/95' : 'text-white/60 hover:text-white/80'} disabled:opacity-40 disabled:cursor-not-allowed`}>{o.label}</button>;
          })}
        </div>
      </div>
    </div>
  );
}
```

```tsx
// StepReview.tsx
"use client";
import { Fragment } from 'react';
import { TokenCacheData } from '@/lib/contract-registry-adapter';
import { windowsFor } from '@/lib/range/profit-preview';
import type { GoalResult } from '@/lib/range/goal-solver';
interface Props { tokenA: TokenCacheData; tokenB: TokenCacheData; bandPct: number; perSwapUsd: number; intervalHours: number; runDays: number; solved: GoalResult }
export default function StepReview({ tokenA, tokenB, bandPct, perSwapUsd, intervalHours, runDays, solved }: Props) {
  const windows = windowsFor(runDays * 24, intervalHours);
  const rows: [string, string][] = [
    ['Pair', `${tokenA.symbol} ⇄ ${tokenB.symbol}`],
    ['Band', `sell +${Math.round(bandPct * 100)}% · buy −${Math.round(bandPct * 100)}%`],
    ['Per swap', `$${perSwapUsd}`],
    ['Schedule', `every ${intervalHours === 24 ? 'day' : intervalHours === 168 ? 'week' : `${intervalHours}h`} for ${runDays} days · ${windows} windows · ${windows * 2} orders`],
    ['Expected', `≈ $${solved.expectedUsd.toFixed(0)} if last month's pace repeats`],
  ];
  return (
    <div className="space-y-3">
      <h3 className="text-base font-medium text-white/90">Review</h3>
      <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
        {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-white/50">{k}</dt><dd className="text-white/90">{v}</dd></Fragment>))}
      </dl>
      <p className="text-xs text-white/50">You can still change anything on the page before signing.</p>
    </div>
  );
}
```

- [ ] **Step 3: Type check and lint**

Run: `pnpm check-types 2>&1 | grep "components/range/wizard"; pnpm exec eslint src/components/range/wizard`
Expected: clean. Fix any real prop mismatch against the phase-1 modules rather than casting.

- [ ] **Step 4: Commit**

```bash
git add src/components/range/wizard
git commit -m "feat(simple-swap): Guide me wizard for range swaps

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Wire the wizard into the page

**Files:**
- Modify: `src/components/range/RangePage.tsx`

- [ ] **Step 1: Button, state, apply**

- `import RangeWizard, { type WizardResult } from './wizard/RangeWizard';`
- Add `const [wizardOpen, setWizardOpen] = useState(false);`.
- `const applyWizard = ({ tokenA, tokenB, form }: WizardResult) => { setTokenA(tokenA); setTokenB(tokenB); setForm(form); };`
- Render a "✦ Guide me" button at the top of the controls column (right-aligned next to the page title on wide screens): `className="px-3 py-1.5 rounded-xl border border-purple-400/60 text-purple-300 text-sm hover:bg-purple-500/10"`, `onClick={() => setWizardOpen(true)}`.
- Render `<RangeWizard open={wizardOpen} onOpenChange={setWizardOpen} onApply={applyWizard} />` (dynamic import with `ssr: false` is not needed; the dialog is client-only already). The wizard quotes its own pair, so it works on an empty page.

- [ ] **Step 2: Type check and lint**

Run: `pnpm check-types 2>&1 | grep RangePage; pnpm exec eslint src/components/range`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/range/RangePage.tsx
git commit -m "feat(simple-swap): Guide me button opens the range wizard

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Preview and verification

- [ ] **Step 1:** `pnpm test` (all green; expect 12+ new tests), then push `feat/range-wizard` and wait for the preview.
- [ ] **Step 2:** In Chrome on the preview, with the wallet connected: open Guide me, enter a goal, pick a pair, confirm the volatility cards show cycle counts, pick a band, confirm the amount is pre-filled and capped, review, apply, and confirm the page controls now match and the chart/preview re-derived. Also confirm Escape closes the dialog and Back works on every step.
- [ ] **Step 3:** Hand off to Ross for the judgement calls: are the three band widths right, does the "closest reachable" message read well, is the expected number honest enough.

Do not merge until Ross confirms.
