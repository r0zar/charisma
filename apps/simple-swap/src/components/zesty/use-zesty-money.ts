'use client';

import { useWallet } from '@/contexts/wallet-context';
import { useBalances } from '@/contexts/wallet-balance-context';
import { usePrices } from '@/contexts/token-price-context';
import { ZESTY_TOKENS, type ZestyTokenKey } from '@/lib/zesty/config';
import { toUsd, type Holdings } from '@/lib/zesty/plan';

const KEYS = Object.keys(ZESTY_TOKENS) as ZestyTokenKey[];

/**
 * The user's money, in dollars: in Zesty (subnet tokens) and in their wallet (mainnet tokens).
 * `holdings` is null until both token prices are known.
 */
export function useZestyMoney() {
  const { address, connected, isConnecting, connectWallet, disconnectWallet } = useWallet();
  const { getTokenBalance, refreshBalances } = useBalances(address ? [address] : []);
  const { getPrice } = usePrices();

  const raw = (contractId: string) => (address ? BigInt(Math.floor(getTokenBalance(address, contractId))) : 0n);
  const prices = KEYS.map(key => getPrice(ZESTY_TOKENS[key].mainnet));

  const holdings = prices.every(price => price)
    ? (Object.fromEntries(KEYS.map((key, i) => [key, {
        price: prices[i]!,
        wallet: raw(ZESTY_TOKENS[key].mainnet),
        zesty: raw(ZESTY_TOKENS[key].subnet),
      }])) as Holdings)
    : null;

  // STX can't trade in Zesty, but it's what most people hold, so Get started offers to swap it
  const stxPrice = getPrice('.stx');
  const stxMicro = raw('.stx');
  const stx = { micro: stxMicro, usd: stxPrice === null ? null : (Number(stxMicro) / 1e6) * stxPrice };

  const total = (where: 'wallet' | 'zesty') =>
    holdings ? KEYS.reduce((sum, key) => sum + toUsd(key, holdings[key][where], holdings[key].price), 0) : null;

  return {
    address,
    connected,
    isConnecting,
    connectWallet,
    disconnectWallet,
    holdings,
    stx,
    zestPrice: getPrice(ZESTY_TOKENS.zest.mainnet),
    zestyUsd: total('zesty'),
    /** sBTC and ZEST in the wallet: what trades can use */
    walletUsd: total('wallet'),
    /** Everything in the wallet, STX included */
    walletTotalUsd: holdings && stx.usd !== null ? total('wallet')! + stx.usd : null,
    refresh: () => refreshBalances(address ? [address] : undefined),
  };
}

export const formatUsd = (usd: number) =>
  usd.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: usd < 10 ? 2 : 0 });

export const formatPrice = (usd: number) => `$${usd.toFixed(usd < 1 ? 4 : 2)}`;
