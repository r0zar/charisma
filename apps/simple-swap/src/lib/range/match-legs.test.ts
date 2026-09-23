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
      { ...hit('sell', 3, '735000000', '55000000', '2026-09-25T01:00:00.000Z'), validFrom: '2026-09-24T12:00:00.000Z', validTo: '2026-09-25T12:00:00.000Z' },   // unmatched
      order({ leg: 'buy', strategyPosition: 4, status: 'cancelled', cancelledAt: '2026-09-26T12:00:01.000Z', validFrom: '2026-09-25T12:00:00.000Z', validTo: '2026-09-26T12:00:00.000Z' }),
      order({ leg: 'sell', strategyPosition: 5, validFrom: '2026-10-01T12:00:00.000Z', validTo: '2026-10-02T12:00:00.000Z' }),
      order({ leg: 'buy', strategyPosition: 6, validFrom: '2026-10-01T12:00:00.000Z', validTo: '2026-10-02T12:00:00.000Z' }),
    ];

    const m = matchRangeLegs(orders, { b: B, decimalsB: DEC_B, decimalsA: 6 }, priceAt, NOW);

    expect(m.realizedUsd).toBeCloseTo(4.4, 6);
    expect(m.cyclesDone).toBe(1);
    expect(m.sellsHit).toBe(2);
    expect(m.buysHit).toBe(1);
    expect(m.unmatchedSells).toBe(1);
    expect(m.openPositionB).toBeCloseTo(55, 6);
    expect(m.legsEnded).toBe(4);
    expect(m.legsHit).toBe(3);
    expect(m.windowsElapsed).toBe(3);
    expect(m.status).toBe('live');
  });

  it('skips pairs it cannot price rather than guessing', () => {
    const orders = [
      hit('sell', 1, '1', '54400000', '2026-09-24T01:00:00.000Z'),
      hit('buy', 2, '50000000', '1', '2026-09-24T09:00:00.000Z'),
    ];
    const m = matchRangeLegs(orders, { b: B, decimalsB: DEC_B, decimalsA: 6 }, () => null, NOW);
    expect(m.realizedUsd).toBe(0);
    expect(m.unpricedPairs).toBe(1);
  });

  it('values an unmatched buy in token A with the given decimals', () => {
    const orders = [
      hit('buy', 2, '50000000', '790000000', '2026-09-24T09:00:00.000Z'),
    ];
    const m = matchRangeLegs(orders, { b: B, decimalsB: 6, decimalsA: 8 }, priceAt, NOW);
    expect(m.openPositionA).toBeCloseTo(7.9, 6);
    expect(m.unmatchedBuys).toBe(1);
    expect(m.realizedUsd).toBe(0);
  });
});
