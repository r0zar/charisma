import { CANDLES_TABLE, PRICES_TABLE, query, table } from './bigquery';
import { SBTC } from './sources';

/** Candle sizes kept in the candles table. 4h and 1w are made from these when asked for. */
export const STORED = { '1h': 'HOUR', '1d': 'DAY' } as const;

/** Creates the candles table if it doesn't exist yet */
export async function createCandlesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS ${table(CANDLES_TABLE)} (
      token_contract_id STRING NOT NULL,
      resolution STRING NOT NULL,
      bucket TIMESTAMP NOT NULL,
      open_usd FLOAT64, high_usd FLOAT64, low_usd FLOAT64, close_usd FLOAT64,
      open_sbtc FLOAT64, high_sbtc FLOAT64, low_sbtc FLOAT64, close_sbtc FLOAT64,
      points INT64,
      updated_at TIMESTAMP
    )
    PARTITION BY TIMESTAMP_TRUNC(bucket, MONTH)
    CLUSTER BY token_contract_id, resolution
    OPTIONS (description = "Hourly (1h) and daily (1d) price candles built from token_prices, with junk points filtered out")`);
}

/**
 * Raw points between @from and @to that pass the junk filter, one per token per run, with the sBTC price worked out
 * from the same run's BTC price (the stored sbtc_price was rounded to 9 decimals before October 2026).
 * A point is junk when it's more than 3x off its token's hourly median or 10x off its daily median.
 * Points from the old pricing method (before February 2026) must sit within 2x of their daily median.
 */
export const CLEAN_POINTS = (prices = table(PRICES_TABLE)) => `
  WITH btc AS (
    SELECT calculated_at, ANY_VALUE(CAST(usd_price AS FLOAT64)) AS btc_usd FROM ${prices}
    WHERE token_contract_id = '${SBTC}' AND calculated_at >= @from AND calculated_at < @to
    GROUP BY calculated_at
  ),
  raw AS (
    SELECT p.token_contract_id AS token, p.calculated_at AS ts, CAST(p.usd_price AS FLOAT64) AS usd,
      COALESCE(CAST(p.usd_price AS FLOAT64) / NULLIF(btc.btc_usd, 0), CAST(p.sbtc_price AS FLOAT64)) AS sbtc,
      p.round_trip_loss AS loss, p.price_source AS source
    FROM ${prices} p LEFT JOIN btc USING (calculated_at)
    WHERE p.calculated_at >= @from AND p.calculated_at < @to AND p.usd_price > 0
    QUALIFY ROW_NUMBER() OVER (PARTITION BY p.token_contract_id, p.calculated_at) = 1
  ),
  medians AS (
    SELECT *,
      PERCENTILE_CONT(usd, 0.5) OVER (PARTITION BY token, TIMESTAMP_TRUNC(ts, HOUR)) AS hour_median,
      PERCENTILE_CONT(usd, 0.5) OVER (PARTITION BY token, TIMESTAMP_TRUNC(ts, DAY)) AS day_median,
      IF(source = 'multihop_quote', 10, 2) AS day_band
    FROM raw
  )
  SELECT token, ts, usd, sbtc, loss FROM medians
  WHERE usd BETWEEN hour_median / 3 AND hour_median * 3
    AND usd BETWEEN day_median / day_band AND day_median * day_band`;

/** Rebuilds every 1h and 1d candle that starts in [from, to). Whole buckets only, so pass bucket edges. */
export async function buildCandles(from: Date, to: Date) {
  const unions = Object.entries(STORED).map(([resolution, unit]) => `
    SELECT token, '${resolution}' AS resolution, TIMESTAMP_TRUNC(ts, ${unit}) AS bucket,
      ARRAY_AGG(usd ORDER BY ts LIMIT 1)[OFFSET(0)] AS open_usd, MAX(usd) AS high_usd, MIN(usd) AS low_usd,
      ARRAY_AGG(usd ORDER BY ts DESC LIMIT 1)[OFFSET(0)] AS close_usd,
      ARRAY_AGG(sbtc ORDER BY ts LIMIT 1)[OFFSET(0)] AS open_sbtc, MAX(sbtc) AS high_sbtc, MIN(sbtc) AS low_sbtc,
      ARRAY_AGG(sbtc ORDER BY ts DESC LIMIT 1)[OFFSET(0)] AS close_sbtc,
      COUNT(*) AS points
    FROM clean GROUP BY token, bucket`).join(' UNION ALL ');

  await query(`
    MERGE ${table(CANDLES_TABLE)} c
    USING (WITH clean AS (${CLEAN_POINTS()}) ${unions}) n
    ON c.token_contract_id = n.token AND c.resolution = n.resolution AND c.bucket = n.bucket
      AND c.bucket >= @from AND c.bucket < @to
    WHEN MATCHED THEN UPDATE SET open_usd = n.open_usd, high_usd = n.high_usd, low_usd = n.low_usd, close_usd = n.close_usd,
      open_sbtc = n.open_sbtc, high_sbtc = n.high_sbtc, low_sbtc = n.low_sbtc, close_sbtc = n.close_sbtc,
      points = n.points, updated_at = CURRENT_TIMESTAMP()
    WHEN NOT MATCHED THEN INSERT (token_contract_id, resolution, bucket, open_usd, high_usd, low_usd, close_usd,
      open_sbtc, high_sbtc, low_sbtc, close_sbtc, points, updated_at)
      VALUES (n.token, n.resolution, n.bucket, n.open_usd, n.high_usd, n.low_usd, n.close_usd,
      n.open_sbtc, n.high_sbtc, n.low_sbtc, n.close_sbtc, n.points, CURRENT_TIMESTAMP())`,
    { from, to },
    { from: 'TIMESTAMP', to: 'TIMESTAMP' },
  );
}

/** What a 5-minute run rebuilds: today's hourly and daily candles */
export function recentWindow(now = new Date()) {
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { from, to: new Date(now.getTime() + 60_000) };
}
