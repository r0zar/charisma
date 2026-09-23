import { describe, it, expect } from 'vitest';
import type { AutoscaleInfo } from 'lightweight-charts';
import { includeTargetInRange, includeTargetsInRange } from './simple-chart-utils';

const info: AutoscaleInfo = { priceRange: { minValue: 1.0, maxValue: 1.2 } };

describe('includeTargetInRange', () => {
  it('extends the range downward when the target sits below the data', () => {
    expect(includeTargetInRange(info, 0.5)?.priceRange).toEqual({ minValue: 0.5, maxValue: 1.2 });
  });

  it('extends the range upward when the target sits above the data', () => {
    expect(includeTargetInRange(info, 2)?.priceRange).toEqual({ minValue: 1.0, maxValue: 2 });
  });

  it('leaves the range alone when the target is inside it', () => {
    expect(includeTargetInRange(info, 1.1)).toBe(info);
  });

  it('leaves the range alone when there is no valid target', () => {
    expect(includeTargetInRange(info, null)).toBe(info);
    expect(includeTargetInRange(info, 0)).toBe(info);
  });
});

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
