import { unstable_cache } from 'next/cache';
import { getHostUrl } from '@modules/discovery';
import { listTokens, type TokenCacheData } from '@repo/tokens';
import { listOrders } from '@/lib/orders/store';
import { listSwapRecords } from '@/lib/swaps/store';

/** One executed trade, on its mainnet tokens */
interface Trade {
  owner: string;
  input: string;
  output: string;
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
  topWallets: Ranked[];
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
async function poolTvl(prices: Record<string, number>): Promise<number> {
  const res = await fetch(`${getHostUrl('invest')}/api/v1/vaults`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Pool data is unavailable (invest ${res.status})`);
  const { data } = (await res.json()) as {
    data: { type: string; tokenA: { contractId: string; decimals: number }; tokenB: { contractId: string; decimals: number }; reservesA: number; reservesB: number }[];
  };
  const side = (token: { contractId: string; decimals: number }, reserve: number) =>
    (reserve / 10 ** token.decimals) * (prices[token.contractId] ?? 0);
  return data
    .filter(v => v.type === 'POOL')
    .reduce((sum, v) => sum + side(v.tokenA, v.reservesA) + side(v.tokenB, v.reservesB), 0);
}

/** Transactions looked up per Hiro request */
const TXS_PER_LOOKUP = 50;

/** Which of these transactions succeeded on chain (a sent swap can still fail, e.g. without enough funds) */
async function succeeded(txids: string[]): Promise<Set<string>> {
  const ok = new Set<string>();
  for (let i = 0; i < txids.length; i += TXS_PER_LOOKUP) {
    const batch = txids.slice(i, i + TXS_PER_LOOKUP);
    const query = batch.map(txid => `tx_id=${txid.startsWith('0x') ? txid : `0x${txid}`}`).join('&');
    const res = await fetch(`https://api.hiro.so/extended/v1/tx/multiple?${query}`, {
      headers: process.env.HIRO_API_KEY ? { 'x-api-key': process.env.HIRO_API_KEY } : {},
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Couldn't check trades on chain (Hiro ${res.status})`);
    const found = (await res.json()) as Record<string, { found: boolean; result?: { tx_status: string } }>;
    for (const txid of batch) {
      if (found[txid.startsWith('0x') ? txid : `0x${txid}`]?.result?.tx_status === 'success') ok.add(txid);
    }
  }
  return ok;
}

/** Every trade that went through on chain: instant swaps and orders the executor ran */
async function allTrades(tokens: Map<string, TokenCacheData>, prices: Record<string, number>): Promise<Trade[]> {
  // Subnet tokens trade 1:1 with the token they hold, so they count as that token
  const mainnet = (id: string) => tokens.get(id)?.base ?? id;
  const trade = (owner: string, inputId: string, outputId: string, raw: number, at: number): Trade => {
    const input = mainnet(inputId);
    const decimals = tokens.get(input)?.decimals;
    const amount = decimals === undefined ? 0 : raw / 10 ** decimals;
    const price = prices[input];
    return { owner, input, output: mainnet(outputId), amount, usd: decimals === undefined || price === undefined ? null : amount * price, at };
  };

  const [{ swaps: allSwaps }, allOrders] = await Promise.all([listSwapRecords({ limit: Number.MAX_SAFE_INTEGER }), listOrders()]);
  const swaps = allSwaps.filter(s => s.txid && s.status !== 'failed');
  const orders = allOrders.filter(o => o.txid && (o.status === 'confirmed' || o.status === 'filled'));
  const ok = await succeeded([...swaps.map(s => s.txid!), ...orders.map(o => o.txid!)]);
  return [
    ...swaps
      .filter(s => ok.has(s.txid!))
      .map(s => trade(s.owner, s.inputToken, s.outputToken, Number(s.inputAmount), s.timestamp)),
    ...orders
      .filter(o => ok.has(o.txid!))
      .map(o => trade(o.owner, o.inputToken, o.outputToken, Number(o.amountIn), Date.parse(o.confirmedAt ?? o.createdAt))),
  ];
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
  const [tokenList, prices] = await Promise.all([listTokens(), currentPrices()]);
  if (tokenList.length === 0) throw new Error("Charisma's token list is unavailable, so trades can't be valued");
  const tokens = new Map(tokenList.map(t => [t.contractId, t]));
  const [trades, tvlUsd] = await Promise.all([allTrades(tokens, prices), poolTvl(prices)]);
  if (trades.length === 0) throw new Error('No trades found in the order and swap stores');

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
    traders: new Set(trades.map(t => t.owner)).size,
    tvlUsd,
    firstTradeAt,
    perDay: average(DAY),
    perWeek: average(WEEK),
    perMonth: average(MONTH),
    last24h: since(DAY),
    last7d: since(WEEK),
    last30d: since(MONTH),
    weekly,
    topWallets: rank(trades, t => [t.owner], 10),
    topTokens: rank(trades, t => [t.input, t.output], 10).map(row => {
      const token = tokens.get(row.id);
      return { ...row, symbol: token?.symbol ?? row.id.split('.').pop() ?? row.id, image: token?.image ?? null };
    }),
    updatedAt: now,
  };
}

/** Platform totals, recomputed at most every 15 minutes (the page and its share image read the same numbers) */
export const getPlatformStats = unstable_cache(computePlatformStats, ['platform-stats-v2'], { revalidate: 900 });
