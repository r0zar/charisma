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

  it('formats target prices as plain decimals the orders API accepts', () => {
    const tinySettings: RangeSettings = { ...settings, sellStart: 0.0000007, buyStart: 0.0000005 };
    const legs = generateRangeLegs(tinySettings, prices, decimals, now);

    for (const leg of legs) {
      expect(leg.targetPrice).toMatch(/^\d+(?:\.\d{1,18})?$/);
      expect(leg.targetPrice).not.toContain('e');
    }
  });

  it('a single window uses the start price with no tilt', () => {
    const singleWindowSettings: RangeSettings = { ...settings, windows: 1, tilt: 0.1 };
    const legs = generateRangeLegs(singleWindowSettings, prices, decimals, now);

    expect(Number(legs[0].targetPrice)).toBeCloseTo(0.074, 6);
    expect(Number(legs[1].targetPrice)).toBeCloseTo(0.063, 6);
  });
});
