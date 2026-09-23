import { describe, it, expect } from 'vitest';
import { estimateSplitOutput } from './split-estimate';

describe('estimateSplitOutput', () => {
  it('splits the quoted output evenly across orders and applies 1% slippage for the minimum', () => {
    const est = estimateSplitOutput({ amountOut: '1000000', slices: 4 });

    expect(est.total).toBe(1000000);
    expect(est.perOrder).toBe(250000);
    expect(est.minTotal).toBe(990000);
    expect(est.minPerOrder).toBe(247500);
  });

  it('honours a custom slippage', () => {
    const est = estimateSplitOutput({ amountOut: '1000', slices: 1, slippage: 0.05 });

    expect(est.minTotal).toBe(950);
  });

  it('returns null without a quote or with no orders', () => {
    expect(estimateSplitOutput({ amountOut: undefined, slices: 4 })).toBeNull();
    expect(estimateSplitOutput({ amountOut: '1000', slices: 0 })).toBeNull();
  });
});
