import { describe, it, expect } from 'vitest';
import { routeCostPerCycle } from './route-cost';

// $50 per leg. A = 0.068 USD, B = 1 USD.
const priceA = 0.068, priceB = 1;
const sellIn = 50 / priceA; // A sent on the sell leg
const buyIn = 50 / priceB; // B sent on the buy leg
const midSellOut = (sellIn * priceA) / priceB; // B received at mid price
const midBuyOut = (buyIn * priceB) / priceA; // A received at mid price

describe('routeCostPerCycle', () => {
  it('costs nothing when both quotes match the mid price', () => {
    const c = routeCostPerCycle({ sellIn, sellOut: midSellOut, buyIn, buyOut: midBuyOut, priceA, priceB });
    expect(c.sellCostUsd).toBeCloseTo(0, 8);
    expect(c.buyCostUsd).toBeCloseTo(0, 8);
    expect(c.totalUsd).toBeCloseTo(0, 8);
  });

  it('costs about $1.00 when each $50 leg is quoted 1% worse than mid', () => {
    const c = routeCostPerCycle({ sellIn, sellOut: midSellOut * 0.99, buyIn, buyOut: midBuyOut * 0.99, priceA, priceB });
    expect(c.sellCostUsd).toBeCloseTo(0.5, 6);
    expect(c.buyCostUsd).toBeCloseTo(0.5, 6);
    expect(c.totalUsd).toBeCloseTo(1.0, 6);
  });

  it('goes negative when a quote beats the mid price', () => {
    const c = routeCostPerCycle({ sellIn, sellOut: midSellOut * 1.01, buyIn, buyOut: midBuyOut, priceA, priceB });
    expect(c.sellCostUsd).toBeLessThan(0);
    expect(c.totalUsd).toBeLessThan(0);
  });
});
