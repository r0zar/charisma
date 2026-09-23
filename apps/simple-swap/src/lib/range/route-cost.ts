/** Amounts in display units. `priceA` / `priceB` are USD prices of the two tokens. */
export interface RouteCostInput {
  /** A sent on the sell leg. */
  sellIn: number;
  /** B the router quotes back for the sell leg. */
  sellOut: number;
  /** B sent on the buy leg. */
  buyIn: number;
  /** A the router quotes back for the buy leg. */
  buyOut: number;
  priceA: number;
  priceB: number;
}

export interface RouteCost {
  sellCostUsd: number;
  buyCostUsd: number;
  totalUsd: number;
}

/**
 * USD lost to routing per completed cycle: what each leg sends at mid price minus what the router
 * quotes back at mid price. Negative when a quote beats mid; deliberately not clamped.
 */
export function routeCostPerCycle({ sellIn, sellOut, buyIn, buyOut, priceA, priceB }: RouteCostInput): RouteCost {
  const sellCostUsd = sellIn * priceA - sellOut * priceB;
  const buyCostUsd = buyIn * priceB - buyOut * priceA;
  return { sellCostUsd, buyCostUsd, totalUsd: sellCostUsd + buyCostUsd };
}
