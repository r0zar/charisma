import { ZESTY_TOKENS, type ZestyTokenKey } from './config';

export type Side = 'up' | 'down';

/** What the trade holds while it waits: ZEST to sell when it rises, sBTC to buy ZEST when it falls. */
export const heldToken = (side: Side): ZestyTokenKey => (side === 'up' ? 'zest' : 'sbtc');
export const otherToken = (key: ZestyTokenKey): ZestyTokenKey => (key === 'zest' ? 'sbtc' : 'zest');

/** Per token: USD price and raw (smallest-unit) balances in the wallet and in Zesty. */
export type Holdings = Record<ZestyTokenKey, { price: number; wallet: bigint; zesty: bigint }>;

export const toUsd = (key: ZestyTokenKey, micro: bigint, price: number) =>
  (Number(micro) / 10 ** ZESTY_TOKENS[key].decimals) * price;

const toMicro = (key: ZestyTokenKey, usd: number, price: number) =>
  BigInt(Math.floor((usd / price) * 10 ** ZESTY_TOKENS[key].decimals));

export interface FundingPlan {
  held: ZestyTokenKey;
  other: ZestyTokenKey;
  /** Wallet → Zesty deposits (on-chain calls), each confirmed before any order is signed */
  adds: { token: ZestyTokenKey; micro: bigint }[];
  /** Other-token amount (in Zesty once the adds land) converted into the held token right away */
  convertMicro: bigint;
  /** Held-token amount (in Zesty once the adds land) that goes straight into the trade */
  heldMicro: bigint;
}

/**
 * Fund a trade worth `amountUsd` from money already in Zesty first (held token, then the other token,
 * which gets converted), and only then from the wallet for any shortfall (held token, then the other).
 * Adding from the wallet is an extra on-chain step, so it's the last resort.
 */
export function planFunding(side: Side, amountUsd: number, holdings: Holdings): FundingPlan {
  const held = heldToken(side);
  const other = otherToken(held);
  let remaining = amountUsd;

  const take = (key: ZestyTokenKey, available: bigint): bigint => {
    if (remaining <= 0 || available <= 0n) return 0n;
    const { price } = holdings[key];
    const wanted = toMicro(key, remaining, price);
    const micro = wanted < available ? wanted : available;
    remaining -= toUsd(key, micro, price);
    return micro;
  };

  const heldZesty = take(held, holdings[held].zesty);
  const otherZesty = take(other, holdings[other].zesty);
  const heldWallet = take(held, holdings[held].wallet);
  const otherWallet = take(other, holdings[other].wallet);

  if (remaining > 0.01) {
    throw new Error(`Not enough money: $${amountUsd.toFixed(2)} asked, $${(amountUsd - remaining).toFixed(2)} available`);
  }

  return {
    held,
    other,
    adds: [
      ...(heldWallet > 0n ? [{ token: held, micro: heldWallet }] : []),
      ...(otherWallet > 0n ? [{ token: other, micro: otherWallet }] : []),
    ],
    convertMicro: otherZesty + otherWallet,
    heldMicro: heldZesty + heldWallet,
  };
}

export interface Exit {
  /** ZEST price in USD that triggers this exit */
  price: number;
  direction: 'gt' | 'lt';
}

/**
 * Up: sell ZEST at +target, safety net at −safety. Down: buy ZEST at −target, safety net at +safety.
 */
export function exitsFor(side: Side, zestPrice: number, targetPct: number, safetyPct: number | null) {
  const up = side === 'up';
  const target: Exit = { price: zestPrice * (up ? 1 + targetPct : 1 - targetPct), direction: up ? 'gt' : 'lt' };
  const safety: Exit | null = safetyPct === null
    ? null
    : { price: zestPrice * (up ? 1 - safetyPct : 1 + safetyPct), direction: up ? 'lt' : 'gt' };
  return { target, safety };
}

/** Each swap costs about 1% (pool fees and slippage). */
export const SWAP_COST = 0.01;

/**
 * Rough outcome of a trade worth `amountUsd`, in USD of the held-at-start value.
 * Up gains or loses with ZEST's price; down gains ZEST when it gets cheaper (more ZEST for the same money).
 */
export function outcomeUsd(side: Side, amountUsd: number, movePct: number, converts: boolean) {
  const cost = amountUsd * SWAP_COST * (converts ? 2 : 1);
  const gross = side === 'up' ? amountUsd * movePct : amountUsd * (movePct / (1 - movePct));
  return gross - cost;
}
