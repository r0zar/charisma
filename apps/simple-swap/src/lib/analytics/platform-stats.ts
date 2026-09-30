import { unstable_cache } from 'next/cache';
import { getHostUrl } from '@modules/discovery';
import { listTokens, type TokenCacheData } from '@repo/tokens';
import { listRouterTrades, type Side } from './router-trades';

/** One executed trade, on its mainnet tokens */
interface Trade {
  /** Null for a subnet order stored before signers were read */
  owner: string | null;
  /** Null when the pool's pair isn't known */
  input: string | null;
  output: string | null;
  /** Whole tokens of `input` */
  amount: number;
  /** Valued at today's price of `input`; null when that token has no price */
  usd: number | null;
  at: number;
}

export interface Ranked {
  id: string;
  volumeUsd: number;
  trades: number;
}

export interface WalletRanked extends Ranked {
  /** The wallet's BNS name, when it has one */
  bns: string | null;
}

export interface TokenRanked extends Ranked {
  symbol: string;
  image: string | null;
}

export interface Period {
  volumeUsd: number;
  trades: number;
}

export interface PlatformStats {
  volumeUsd: number;
  trades: number;
  traders: number;
  /** USD in Charisma liquidity pools right now */
  tvlUsd: number;
  firstTradeAt: number;
  /** Averages since the first trade */
  perDay: Period;
  perWeek: Period;
  perMonth: Period;
  last24h: Period;
  last7d: Period;
  last30d: Period;
  /** Oldest first, one entry per week (Monday UTC) since the first trade */
  weekly: (Period & { weekStart: number })[];
  topWallets: WalletRanked[];
  topTokens: TokenRanked[];
  updatedAt: number;
}

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;

/** USD price per whole token by contract id (".stx" for STX), from the same feed the swap app uses */
async function currentPrices(): Promise<Record<string, number>> {
  const res = await fetch(`${getHostUrl('lakehouse')}/api/token-prices?limit=1000`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Token prices are unavailable (lakehouse ${res.status})`);
  const { prices } = (await res.json()) as { prices: { token_contract_id: string; usd_price: number }[] };
  return Object.fromEntries(prices.map(p => [p.token_contract_id, p.usd_price]));
}

/** USD in every Charisma pool: both reserves at today's prices */
function poolTvl(vaults: Vault[], prices: Record<string, number>): number {
  const side = (token: { contractId: string; decimals: number }, reserve: number) =>
    (reserve / 10 ** token.decimals) * (prices[token.contractId] ?? 0);
  return vaults
    .filter(v => v.type === 'POOL' && v.tokenA && v.tokenB)
    .reduce((sum, v) => sum + side(v.tokenA!, v.reservesA) + side(v.tokenB!, v.reservesB), 0);
}

interface Vault {
  contractId: string;
  tokenA?: { contractId: string; decimals: number };
  tokenB?: { contractId: string; decimals: number };
  reservesA: number;
  reservesB: number;
  type: string;
}

async function listVaults(): Promise<Vault[]> {
  const res = await fetch(`${getHostUrl('invest')}/api/v1/vaults`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Pool data is unavailable (invest ${res.status})`);
  return ((await res.json()) as { data: Vault[] }).data;
}

/**
 * Every trade through Charisma's routers, from the chain. Wallet swaps name their pools, so tokens come from
 * each pool's pair; subnet orders name their tokens and carry the trader's signature.
 */
async function allTrades(tokens: Map<string, TokenCacheData>, prices: Record<string, number>, vaults: Vault[]): Promise<Trade[]> {
  // Subnet tokens trade 1:1 with the token they hold, so they count as that token
  const mainnet = (id: string) => tokens.get(id)?.base ?? id;
  const pairs = new Map<string, [string, string]>();
  for (const t of tokens.values()) if (t.tokenAContract && t.tokenBContract) pairs.set(t.contractId, [t.tokenAContract, t.tokenBContract]);
  // Only two-sided vaults are pairs (energy vaults hold a single token)
  for (const v of vaults) if (v.tokenA && v.tokenB) pairs.set(v.contractId, [v.tokenA.contractId, v.tokenB.contractId]);
  const tokenOf = (side: Side, input: boolean): string | null => {
    if ('token' in side) return mainnet(side.token);
    const pair = pairs.get(side.pool);
    if (!pair) return null;
    // Going A to B, A goes in and B comes out
    return mainnet(side.aToB === input ? pair[0] : pair[1]);
  };

  const routerTrades = await listRouterTrades();

  return routerTrades.map(t => {
    const input = tokenOf(t.in, true);
    const decimals = input ? tokens.get(input)?.decimals : undefined;
    const price = input ? prices[input] : undefined;
    const amount = decimals === undefined ? 0 : Number(t.amount) / 10 ** decimals;
    // Wallet swaps are sent by the trader; subnet orders by the executor, for the wallet that signed them
    const owner = t.signer ?? (t.router.endsWith('.multihop') ? t.sender : null);
    return { owner, input, output: tokenOf(t.out, false), amount, usd: decimals === undefined || price === undefined ? null : amount * price, at: t.at };
  });
}

/** A wallet's BNS name (a .btc one first), from BNS v2; null when it has none */
async function bnsName(address: string): Promise<string | null> {
  const res = await fetch(`https://api.bnsv2.com/names/address/${address}/valid`, { signal: AbortSignal.timeout(10000) });
  // Names are a nice extra: a lookup that fails just shows the address
  if (!res.ok) {
    console.error(`[analytics] BNS lookup for ${address} failed (${res.status})`);
    return null;
  }
  const { names } = (await res.json()) as { names: { full_name: string; namespace_string: string }[] };
  return (names.find(n => n.namespace_string === 'btc') ?? names[0])?.full_name ?? null;
}

const period = (trades: Trade[]): Period => ({
  volumeUsd: trades.reduce((sum, t) => sum + (t.usd ?? 0), 0),
  trades: trades.length,
});

/** Rank ids by volume; a trade can count for several ids (a token on either side) */
function rank(trades: Trade[], idsOf: (t: Trade) => string[], top: number): Ranked[] {
  const totals = new Map<string, Ranked>();
  for (const t of trades) {
    for (const id of new Set(idsOf(t))) {
      const row = totals.get(id) ?? { id, volumeUsd: 0, trades: 0 };
      row.volumeUsd += t.usd ?? 0;
      row.trades += 1;
      totals.set(id, row);
    }
  }
  return [...totals.values()].sort((a, b) => b.volumeUsd - a.volumeUsd || b.trades - a.trades).slice(0, top);
}

async function computePlatformStats(): Promise<PlatformStats> {
  const [tokenList, prices, vaults] = await Promise.all([listTokens(), currentPrices(), listVaults()]);
  if (tokenList.length === 0) throw new Error("Charisma's token list is unavailable, so trades can't be valued");
  const tokens = new Map(tokenList.map(t => [t.contractId, t]));
  const trades = await allTrades(tokens, prices, vaults);
  if (trades.length === 0) throw new Error('No router trades stored yet; the router-trades sync fills them');
  const tvlUsd = poolTvl(vaults, prices);

  const now = Date.now();
  const firstTradeAt = Math.min(...trades.map(t => t.at));
  const span = Math.max(now - firstTradeAt, DAY);
  const total = period(trades);
  const average = (length: number): Period => ({ volumeUsd: total.volumeUsd * (length / span), trades: total.trades * (length / span) });
  const since = (ms: number) => period(trades.filter(t => t.at >= now - ms));

  // Weeks start Monday 00:00 UTC (the epoch was a Thursday, hence the 4-day shift)
  const weekOf = (at: number) => Math.floor((at - 4 * DAY) / WEEK) * WEEK + 4 * DAY;
  const weekly: PlatformStats['weekly'] = [];
  for (let start = weekOf(firstTradeAt); start <= now; start += WEEK) {
    weekly.push({ weekStart: start, ...period(trades.filter(t => weekOf(t.at) === start)) });
  }

  return {
    ...total,
    traders: new Set(trades.map(t => t.owner).filter(Boolean)).size,
    tvlUsd,
    firstTradeAt,
    perDay: average(DAY),
    perWeek: average(WEEK),
    perMonth: average(MONTH),
    last24h: since(DAY),
    last7d: since(WEEK),
    last30d: since(MONTH),
    weekly,
    topWallets: await Promise.all(rank(trades, t => (t.owner ? [t.owner] : []), 10).map(async row => ({ ...row, bns: await bnsName(row.id) }))),
    topTokens: rank(trades, t => [t.input, t.output].filter((id): id is string => !!id), 10).map(row => {
      const token = tokens.get(row.id);
      return { ...row, symbol: token?.symbol ?? row.id.split('.').pop() ?? row.id, image: token?.image ?? null };
    }),
    updatedAt: now,
  };
}

/** Platform totals, recomputed at most every 15 minutes (the page and its share image read the same numbers) */
export const getPlatformStats = unstable_cache(computePlatformStats, ['platform-stats-v3'], { revalidate: 900 });
