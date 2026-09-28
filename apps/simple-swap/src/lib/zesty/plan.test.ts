import { describe, expect, it } from 'vitest';
import { exitsFor, planFunding, type Holdings } from './plan';

// ZEST $0.20 (6 decimals), sBTC $100,000 (8 decimals)
const holdings = (h: Partial<Record<'zest' | 'sbtc', { wallet?: bigint; zesty?: bigint }>>): Holdings => ({
  zest: { price: 0.2, wallet: h.zest?.wallet ?? 0n, zesty: h.zest?.zesty ?? 0n },
  sbtc: { price: 100_000, wallet: h.sbtc?.wallet ?? 0n, zesty: h.sbtc?.zesty ?? 0n },
});

describe('planFunding', () => {
  it('uses the held token already in Zesty with no extra steps', () => {
    const plan = planFunding('up', 100, holdings({ zest: { zesty: 1_000_000_000n } })); // $200 of ZEST
    expect(plan.adds).toEqual([]);
    expect(plan.convertMicro).toBe(0n);
    expect(plan.heldMicro).toBe(500_000_000n); // 500 ZEST = $100
  });

  it('uses money already in Zesty (converting it) before adding anything from the wallet', () => {
    // up needs ZEST: $100 of sBTC in Zesty beats $0.72-style top-ups of ZEST from the wallet
    const plan = planFunding('up', 100, holdings({ zest: { wallet: 1_000_000_000n }, sbtc: { zesty: 100_000n } }));
    expect(plan.adds).toEqual([]);
    expect(plan.convertMicro).toBe(100_000n);
    expect(plan.heldMicro).toBe(0n);
  });

  it('adds from the wallet only for the shortfall', () => {
    // $150 trade, $100 of sBTC in Zesty: the remaining $50 comes from wallet ZEST
    const plan = planFunding('up', 150, holdings({ zest: { wallet: 1_000_000_000n }, sbtc: { zesty: 100_000n } }));
    expect(plan.adds).toEqual([{ token: 'zest', micro: 250_000_000n }]);
    expect(plan.convertMicro).toBe(100_000n);
    expect(plan.heldMicro).toBe(250_000_000n);
  });

  it('converts the other token when the held one runs out', () => {
    // up needs ZEST; only $100 of sBTC in the wallet
    const plan = planFunding('up', 100, holdings({ sbtc: { wallet: 100_000n } }));
    expect(plan.adds).toEqual([{ token: 'sbtc', micro: 100_000n }]);
    expect(plan.convertMicro).toBe(100_000n);
    expect(plan.heldMicro).toBe(0n);
  });

  it('mixes sources in order: held in Zesty, other in Zesty, held in wallet, other in wallet', () => {
    const plan = planFunding('down', 300, holdings({
      sbtc: { zesty: 100_000n, wallet: 50_000n }, // $100 + $50 held
      zest: { zesty: 250_000_000n, wallet: 10_000_000_000n }, // $50 + $2000 other
    }));
    expect(plan.heldMicro).toBe(150_000n);
    expect(plan.adds).toEqual([{ token: 'sbtc', micro: 50_000n }, { token: 'zest', micro: 500_000_000n }]);
    expect(plan.convertMicro).toBe(750_000_000n); // $50 in Zesty + $100 from wallet
  });

  it('never adds rounding crumbs from the wallet', () => {
    // Real prices: $20 of sBTC rounds down to whole sats, leaving a fraction of a cent
    const plan = planFunding('up', 20, {
      sbtc: { price: 83544.3, wallet: 0n, zesty: 972_649n },
      zest: { price: 0.188284841, wallet: 3_810_173n, zesty: 0n },
    });
    expect(plan.adds).toEqual([]);
  });

  it('throws a descriptive error when there is not enough money', () => {
    expect(() => planFunding('up', 1000, holdings({ zest: { zesty: 1_000_000_000n } }))).toThrow('Not enough money: $1000.00 asked, $200.00 available');
  });
});

describe('exitsFor', () => {
  it('sells higher with a safety net below when betting up', () => {
    const { target, safety } = exitsFor('up', 0.2, 0.15, 0.1);
    expect(target).toEqual({ price: expect.closeTo(0.23, 10), direction: 'gt' });
    expect(safety).toEqual({ price: expect.closeTo(0.18, 10), direction: 'lt' });
  });

  it('buys lower with a safety net above when betting down, and can skip the safety net', () => {
    const { target, safety } = exitsFor('down', 0.2, 0.25, null);
    expect(target).toEqual({ price: expect.closeTo(0.15, 10), direction: 'lt' });
    expect(safety).toBeNull();
  });
});
