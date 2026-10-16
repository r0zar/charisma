import { CANDLES_TABLE, PRICES_TABLE, query, table } from './bigquery';
import { CLEAN_POINTS } from './candles';
import { listTokens, poolBalances, type TokenInfo } from './sources';

/** A price older than this is flagged stale */
const STALE_MS = 15 * 60_000;
const SPARK_POINTS = 42;
/** A buy-and-sell round trip losing more than this marks the token's liquidity as thin */
const THIN_LOSS = 0.25;

export const INTERVALS = ['5m', '1h', '4h', '1d', '1w'] as const;
export type Interval = (typeof INTERVALS)[number];
export type Quote = 'usd' | 'sbtc';

export interface Change { '1h': number | null; '24h': number | null; '7d': number | null; '30d': number | null }

export interface TokenPrice extends TokenInfo {
  usd: number;
  sbtc: number;
  /** Percent change, e.g. 2.5 = +2.5% */
  change: Change;
  /** Dollar value of this token held in Charisma's pools */
  liquidityUsd: number;
  /** Percent lost buying about $1 with sBTC and selling straight back. Null for prices recorded before it was tracked. */
  roundTripLoss: number | null;
  /** True when that round trip loses more than 25%, so the price is less reliable */
  thin: boolean;
  updatedAt: string;
  stale: boolean;
  /** 7 days of USD closes, oldest first (only when asked for) */
  sparkline?: number[];
}

export interface Candle { time: number; open: number; high: number; low: number; close: number; points: number }

interface PriceRow {
  token: string; usd: number; sbtc: number; loss: number | null; ts: { value: string };
  usd_1h: number | null; usd_24h: number | null; usd_7d: number | null; usd_30d: number | null;
}

const pct = (now: number, then: number | null) => (then && then > 0 ? (100 * (now - then)) / then : null);

/** Latest clean price of every token, with its 1h, 24h, 7d and 30d change */
async function latestPrices(): Promise<PriceRow[]> {
  const now = Date.now();
  return query<PriceRow>(`
    WITH clean AS (${CLEAN_POINTS()}),
    recent AS (
      SELECT token,
        ARRAY_AGG(STRUCT(usd, sbtc, loss, ts) ORDER BY ts DESC LIMIT 1)[OFFSET(0)] AS p,
        ARRAY_AGG(IF(ts <= TIMESTAMP_SUB(@now, INTERVAL 1 HOUR), usd, NULL) IGNORE NULLS ORDER BY ts DESC LIMIT 1)[SAFE_OFFSET(0)] AS usd_1h,
        ARRAY_AGG(IF(ts <= TIMESTAMP_SUB(@now, INTERVAL 24 HOUR), usd, NULL) IGNORE NULLS ORDER BY ts DESC LIMIT 1)[SAFE_OFFSET(0)] AS usd_24h
      FROM clean GROUP BY token
    ),
    older AS (
      SELECT token_contract_id AS token,
        ARRAY_AGG(IF(bucket <= TIMESTAMP_SUB(@now, INTERVAL 7 DAY), close_usd, NULL) IGNORE NULLS ORDER BY bucket DESC LIMIT 1)[SAFE_OFFSET(0)] AS usd_7d,
        ARRAY_AGG(IF(bucket <= TIMESTAMP_SUB(@now, INTERVAL 30 DAY), close_usd, NULL) IGNORE NULLS ORDER BY bucket DESC LIMIT 1)[SAFE_OFFSET(0)] AS usd_30d
      FROM ${table(CANDLES_TABLE)}
      WHERE resolution = '1h' AND bucket >= TIMESTAMP_SUB(@now, INTERVAL 31 DAY)
      GROUP BY token
    )
    SELECT token, p.usd, p.sbtc, p.loss, p.ts, usd_1h, usd_24h, usd_7d, usd_30d
    FROM recent LEFT JOIN older USING (token)`,
    { from: new Date(now - 26 * 3600_000), to: new Date(now + 60_000), now: new Date(now) },
    { from: 'TIMESTAMP', to: 'TIMESTAMP', now: 'TIMESTAMP' },
  );
}

/** Hourly USD closes for the last 7 days, thinned to SPARK_POINTS per token */
async function sparklines(tokens: string[]): Promise<Map<string, number[]>> {
  const rows = await query<{ token: string; closes: number[] }>(`
    SELECT token_contract_id AS token, ARRAY_AGG(close_usd ORDER BY bucket) AS closes
    FROM ${table(CANDLES_TABLE)}
    WHERE resolution = '1h' AND bucket >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 7 DAY) AND token_contract_id IN UNNEST(@tokens)
    GROUP BY token`,
    { tokens }, { tokens: ['STRING'] },
  );
  return new Map(rows.map(r => {
    const step = Math.max(1, r.closes.length / SPARK_POINTS);
    const thin = Array.from({ length: Math.min(SPARK_POINTS, r.closes.length) }, (_, i) => r.closes[Math.floor(i * step)]);
    thin[thin.length - 1] = r.closes[r.closes.length - 1];
    return [r.token, thin];
  }));
}

/** Every priced token with its name, logo, price, changes and liquidity. Pass `only` to narrow the list. */
export async function getMarket({ only, sparkline = false }: { only?: string[]; sparkline?: boolean } = {}): Promise<{ btcUsd: number | null; tokens: TokenPrice[] }> {
  const [rows, tokens, held] = await Promise.all([latestPrices(), listTokens(), poolBalances()]);
  const info = new Map(tokens.map(t => [t.contractId, t]));
  const wanted = only ? new Set(only) : null;
  const picked = rows.filter(r => info.has(r.token) && (!wanted || wanted.has(r.token)));
  const sparks = sparkline && picked.length ? await sparklines(picked.map(r => r.token)) : null;
  const btc = rows.find(r => r.token === 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token')?.usd ?? null;

  const list = picked.map((r): TokenPrice => {
    const at = r.ts.value;
    return {
      ...info.get(r.token)!,
      usd: r.usd,
      sbtc: r.sbtc,
      change: { '1h': pct(r.usd, r.usd_1h), '24h': pct(r.usd, r.usd_24h), '7d': pct(r.usd, r.usd_7d), '30d': pct(r.usd, r.usd_30d) },
      liquidityUsd: (held.get(r.token) ?? 0) * r.usd,
      roundTripLoss: r.loss === null ? null : 100 * r.loss,
      thin: (r.loss ?? 0) > THIN_LOSS,
      updatedAt: at,
      stale: Date.now() - Date.parse(at) > STALE_MS,
      ...(sparks ? { sparkline: sparks.get(r.token) ?? [] } : {}),
    };
  });
  return { btcUsd: btc, tokens: list.sort((a, b) => b.liquidityUsd - a.liquidityUsd) };
}

const DEFAULT_SPAN: Record<Interval, number> = { '5m': 1, '1h': 7, '4h': 30, '1d': 3650, '1w': 3650 };
const MAX_SPAN: Record<Interval, number> = { '5m': 7, '1h': 90, '4h': 365, '1d': 3650, '1w': 3650 };

/** OHLC candles for one token, oldest first. 5m candles are the raw 5-minute points. */
export async function getHistory(token: string, interval: Interval, quote: Quote, opts: { from?: Date; to?: Date; limit: number }): Promise<Candle[]> {
  const to = opts.to ?? new Date();
  const from = opts.from ?? new Date(to.getTime() - DEFAULT_SPAN[interval] * 86400_000);
  if (to.getTime() - from.getTime() > MAX_SPAN[interval] * 86400_000) {
    throw new RangeError(`${interval} candles cover at most ${MAX_SPAN[interval]} days per request; narrow from/to or use a bigger interval`);
  }
  const q = quote === 'usd' ? 'usd' : 'sbtc';
  const candles = table(CANDLES_TABLE);
  const fromStored = (resolution: '1h' | '1d', bucketSql: string) => `
    SELECT ${bucketSql} AS b,
      ARRAY_AGG(open_${q} ORDER BY bucket LIMIT 1)[OFFSET(0)] AS open, MAX(high_${q}) AS high, MIN(low_${q}) AS low,
      ARRAY_AGG(close_${q} ORDER BY bucket DESC LIMIT 1)[OFFSET(0)] AS close, SUM(points) AS points
    FROM ${candles}
    WHERE token_contract_id = @token AND resolution = '${resolution}' AND bucket >= @from AND bucket < @to
    GROUP BY b`;
  const source = {
    '5m': `SELECT ts AS b, ${q} AS open, ${q} AS high, ${q} AS low, ${q} AS close, 1 AS points FROM (${CLEAN_POINTS()}) WHERE token = @token`,
    '1h': fromStored('1h', 'bucket'),
    '4h': fromStored('1h', 'TIMESTAMP_SECONDS(DIV(UNIX_SECONDS(bucket), 14400) * 14400)'),
    '1d': fromStored('1d', 'bucket'),
    '1w': fromStored('1d', 'TIMESTAMP_TRUNC(bucket, WEEK(MONDAY))'),
  }[interval];

  const rows = await query<{ b: { value: string }; open: number; high: number; low: number; close: number; points: number }>(
    `SELECT * FROM (${source}) ORDER BY b DESC LIMIT @limit`,
    { token, from, to, limit: opts.limit },
    { token: 'STRING', from: 'TIMESTAMP', to: 'TIMESTAMP', limit: 'INT64' },
  );
  return rows.reverse().map(r => ({
    time: Math.floor(Date.parse(r.b.value) / 1000),
    open: r.open, high: r.high, low: r.low, close: r.close, points: Number(r.points),
  }));
}

/** When prices were last recorded and how many tokens that run priced */
export async function getHealth() {
  const [last] = await query<{ last_at: { value: string } | null; tokens: number }>(`
    SELECT MAX(calculated_at) AS last_at, COUNTIF(calculated_at = (SELECT MAX(calculated_at) FROM ${table(PRICES_TABLE)} WHERE calculated_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY))) AS tokens
    FROM ${table(PRICES_TABLE)} WHERE calculated_at > TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 1 DAY)`);
  const at = last?.last_at?.value ?? null;
  const ageSeconds = at ? Math.round((Date.now() - Date.parse(at)) / 1000) : null;
  return { ok: ageSeconds !== null && ageSeconds * 1000 <= STALE_MS, lastRecordedAt: at, ageSeconds, tokensPriced: last?.tokens ?? 0 };
}

/** All-time high and low (from daily candles) and the first day this token was priced */
export async function getTokenStats(token: string) {
  const [row] = await query<{ ath: { v: number; day: { value: string } } | null; atl: { v: number; day: { value: string } } | null; since: { value: string } | null }>(`
    SELECT
      ARRAY_AGG(STRUCT(high_usd AS v, bucket AS day) ORDER BY high_usd DESC LIMIT 1)[SAFE_OFFSET(0)] AS ath,
      ARRAY_AGG(STRUCT(low_usd AS v, bucket AS day) ORDER BY low_usd LIMIT 1)[SAFE_OFFSET(0)] AS atl,
      MIN(bucket) AS since
    FROM ${table(CANDLES_TABLE)} WHERE token_contract_id = @token AND resolution = '1d'`,
    { token }, { token: 'STRING' },
  );
  return {
    ath: row?.ath ? { usd: row.ath.v, day: row.ath.day.value } : null,
    atl: row?.atl ? { usd: row.atl.v, day: row.atl.day.value } : null,
    since: row?.since?.value ?? null,
  };
}
