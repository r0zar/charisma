import type { TokenCacheData } from '@/lib/contract-registry-adapter';

type Direction = 'lt' | 'gt';

interface TriggerState {
  hasPriceTrigger: boolean;
  hasRatioTrigger: boolean;
  priceTriggerToken: TokenCacheData | null;
  priceTargetPrice: string;
  priceDirection: Direction;
  ratioTriggerToken: TokenCacheData | null;
  ratioBaseToken: TokenCacheData | null;
  ratioTargetPrice: string;
  ratioDirection: Direction;
  displayedToToken: TokenCacheData | null;
}

export interface TriggerChartProps {
  token: TokenCacheData | null;
  baseToken: TokenCacheData | null;
  targetPrice: string;
  direction: Direction;
}

/**
 * Derive what the trigger chart should plot from the active trigger mode only.
 * Ratio mode wins when both triggers are enabled. State from the inactive mode
 * is never passed through, so a stale USD target or base token can't leak in.
 */
export function getTriggerChartProps(state: TriggerState): TriggerChartProps {
  if (state.hasRatioTrigger) {
    return {
      token: state.ratioTriggerToken ?? state.displayedToToken,
      baseToken: state.ratioBaseToken,
      targetPrice: state.ratioTargetPrice,
      direction: state.ratioDirection,
    };
  }

  return {
    token: state.priceTriggerToken ?? state.displayedToToken,
    baseToken: null,
    targetPrice: state.priceTargetPrice,
    direction: state.priceDirection,
  };
}
