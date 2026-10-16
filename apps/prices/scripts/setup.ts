/**
 * One-time setup of the price tables, safe to re-run:
 * - gives the raw price columns 38 decimal places (they rounded to 9, so the cheapest tokens read as 0)
 * - adds round_trip_loss, how much a buy-and-sell round trip loses (thin liquidity)
 * - creates the candles table and builds every candle from the full history
 *
 * pnpm script scripts/setup.ts   (with GOOGLE_CLOUD_CREDENTIALS, GOOGLE_CLOUD_PROJECT and BIGQUERY_DATASET set)
 */
import { PRICES_TABLE, query, table } from '../src/lib/bigquery';
import { buildCandles, createCandlesTable } from '../src/lib/candles';

const prices = table(PRICES_TABLE);
await query(`ALTER TABLE ${prices} ALTER COLUMN usd_price SET DATA TYPE BIGNUMERIC`);
await query(`ALTER TABLE ${prices} ALTER COLUMN sbtc_price SET DATA TYPE BIGNUMERIC`);
await query(`ALTER TABLE ${prices} ADD COLUMN IF NOT EXISTS round_trip_loss FLOAT64 OPTIONS (description = "Share of value lost buying with sBTC and selling straight back; high means thin liquidity")`);
console.log('price columns widened, round_trip_loss added');

await createCandlesTable();
const [first] = await query<{ first: { value: string } }>(`SELECT MIN(calculated_at) AS first FROM ${prices}`);
const from = new Date(first.first.value);
from.setUTCHours(0, 0, 0, 0);
const t0 = Date.now();
await buildCandles(from, new Date(Date.now() + 60_000));
const [count] = await query<{ hourly: number; daily: number }>(`SELECT COUNTIF(resolution = '1h') AS hourly, COUNTIF(resolution = '1d') AS daily FROM ${table('token_price_candles')}`);
console.log(`candles built from ${from.toISOString()} in ${((Date.now() - t0) / 1000).toFixed(1)}s:`, count);
