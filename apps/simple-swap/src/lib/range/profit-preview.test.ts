import { describe, it, expect } from 'vitest';
import { rangeProfitPreview, runwayFor, windowsFor, MAX_ORDERS, WAITING_FOR_QUOTES } from './profit-preview';

const base = { price: 0.068, sell: 0.074, buy: 0.063, perSwapUsd: 50, windows: 30, routeCostUsd: 1.0 };

describe('rangeProfitPreview', () => {
  it('computes spread, route cost, net per cycle and the if-all total', () => {
    const p = rangeProfitPreview(base);

    expect(p.spread).toBeCloseTo(0.1746, 4);
    expect(p.routeCostUsd).toBe(1.0);
    expect(p.netPerCycle).toBeCloseTo(7.73, 2);
    expect(p.ifAll).toBeCloseTo(231.9, 1);
    expect(p.breakEven).toBeCloseTo(0.02, 8);
    expect(p.orderCount).toBe(60);
    expect(p.reasons).toEqual([]);
  });

  it('waits for quotes when the route cost is unknown, without producing NaN', () => {
    const p = rangeProfitPreview({ ...base, routeCostUsd: null });
    expect(p.reasons).toContain(WAITING_FOR_QUOTES);
    expect(p.routeCostUsd).toBeNull();
    expect(Number.isFinite(p.netPerCycle)).toBe(true);
    expect(Number.isFinite(p.ifAll)).toBe(true);
    expect(p.breakEven).toBe(0);
  });

  it('flags a sell line at or below current price', () => {
    expect(rangeProfitPreview({ ...base, sell: 0.068 }).reasons).toContain('Sell line must be above current price');
  });

  it('flags a buy line at or above current price', () => {
    expect(rangeProfitPreview({ ...base, buy: 0.068 }).reasons).toContain('Buy line must be below current price');
  });

  it('flags a spread under the route cost', () => {
    expect(rangeProfitPreview({ ...base, sell: 0.0687, buy: 0.0674 }).reasons).toContain('Spread is below route cost (2.0%)');
  });

  it('scales the route-cost floor with the quoted cost', () => {
    // $2.50 on $50 is a 5% floor; a 4% spread is under it.
    expect(rangeProfitPreview({ ...base, sell: 0.068 * 1.02, buy: 0.068 * 0.98, routeCostUsd: 2.5 }).reasons).toContain('Spread is below route cost (5.0%)');
  });

  it('flags too many orders', () => {
    expect(rangeProfitPreview({ ...base, windows: 101 }).reasons).toContain(
      `Too many orders (202). Cap is ${MAX_ORDERS} in one sitting. Widen the interval or shorten the run.`,
    );
  });

  it('flags a non-positive per-swap amount', () => {
    expect(rangeProfitPreview({ ...base, perSwapUsd: 0 }).reasons).toContain('Per swap must be more than $0');
  });

  it('flags non-finite inputs instead of enabling the button', () => {
    expect(rangeProfitPreview({ ...base, sell: NaN }).reasons).toContain('Fill in every field');
    expect(rangeProfitPreview({ ...base, price: Infinity }).reasons).toContain('Fill in every field');
    expect(rangeProfitPreview({ ...base, routeCostUsd: NaN }).reasons).toContain('Fill in every field');
  });

  it('flags a sell line inside the 0.5% gap', () => {
    expect(rangeProfitPreview({ ...base, sell: 0.068 * 1.003 }).reasons).toContain('Sell line must be above current price');
  });

  it('allows lines exactly 0.5% from current price', () => {
    const { reasons } = rangeProfitPreview({ ...base, sell: 0.068 * 1.005, buy: 0.068 * 0.995 });
    expect(reasons).not.toContain('Sell line must be above current price');
    expect(reasons).not.toContain('Buy line must be below current price');
  });

  it('flags a run shorter than one window', () => {
    expect(rangeProfitPreview({ ...base, windows: 0 }).reasons).toContain('Run is shorter than one window');
  });
});

describe('windowsFor', () => {
  it('floors run hours over interval hours', () => {
    expect(windowsFor(30 * 24, 24)).toBe(30);
    expect(windowsFor(7 * 24, 168)).toBe(1);
    expect(windowsFor(10, 24)).toBe(0);
  });

  it('returns 0 for non-finite inputs', () => {
    expect(windowsFor(NaN, 24)).toBe(0);
    expect(windowsFor(24, NaN)).toBe(0);
  });
});

describe('runwayFor', () => {
  it('counts how many legs a balance covers', () => {
    expect(runwayFor(2200, 735.29)).toBe(2);
    expect(runwayFor(0, 735.29)).toBe(0);
    expect(runwayFor(100, 0)).toBe(0);
  });
});
