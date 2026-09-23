import { describe, it, expect } from 'vitest';
import type { TokenCacheData } from '@/lib/contract-registry-adapter';
import { getTriggerChartProps } from './trigger-chart-props';

const cha = { contractId: 'SP1.charisma-token', symbol: 'CHA' } as TokenCacheData;
const sbtc = { contractId: 'SM1.sbtc-token', symbol: 'sBTC' } as TokenCacheData;
const welsh = { contractId: 'SP2.welsh', symbol: 'WELSH' } as TokenCacheData;

const base = {
  hasPriceTrigger: false,
  hasRatioTrigger: false,
  priceTriggerToken: null,
  priceTargetPrice: '',
  priceDirection: 'gt' as const,
  ratioTriggerToken: null,
  ratioBaseToken: null,
  ratioTargetPrice: '',
  ratioDirection: 'gt' as const,
  displayedToToken: welsh,
};

describe('getTriggerChartProps', () => {
  it('in ratio mode charts the ratio token against its base even when a price trigger token is set', () => {
    const props = getTriggerChartProps({
      ...base,
      hasRatioTrigger: true,
      priceTriggerToken: cha,
      ratioTriggerToken: sbtc,
      ratioBaseToken: cha,
      ratioTargetPrice: '1236973',
      ratioDirection: 'lt',
    });

    expect(props).toEqual({ token: sbtc, baseToken: cha, targetPrice: '1236973', direction: 'lt' });
  });

  it('in USD mode never passes a base token even if a ratio base was chosen earlier', () => {
    const props = getTriggerChartProps({
      ...base,
      hasPriceTrigger: true,
      priceTriggerToken: cha,
      priceTargetPrice: '0.05',
      ratioBaseToken: sbtc,
      ratioTargetPrice: '999',
    });

    expect(props).toEqual({ token: cha, baseToken: null, targetPrice: '0.05', direction: 'gt' });
  });

  it('in ratio mode does not leak a stale USD target price', () => {
    const props = getTriggerChartProps({
      ...base,
      hasRatioTrigger: true,
      priceTargetPrice: '0.05',
      ratioTriggerToken: sbtc,
      ratioBaseToken: cha,
    });

    expect(props.targetPrice).toBe('');
  });

  it('falls back to the displayed output token when no trigger token is chosen', () => {
    const props = getTriggerChartProps({ ...base, hasPriceTrigger: true });

    expect(props.token).toBe(welsh);
  });
});
